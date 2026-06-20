import type { Row } from "@libsql/client";
import { db } from "./db";

function toPlain<T>(rows: Row[]): T[] {
  return rows.map((r) => ({ ...r })) as T[];
}

export function madridOffsetModifier(now = new Date()): string {
  const madridHour = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Madrid" })).getHours();
  let offset = madridHour - now.getUTCHours();
  if (offset > 12) offset -= 24;
  if (offset < -12) offset += 24;
  return `${offset >= 0 ? "+" : ""}${offset} hours`;
}

export interface Venue {
  id: number;
  name: string;
}

export interface VenueHours {
  venueId: number;
  dow: number; // 0 = Sunday … 6 = Saturday
  openMin: number; // minutes from local midnight, Madrid time
  closeMin: number;
}

export interface HeatmapCell {
  day: number;   // 0 = Monday … 6 = Sunday
  hour: number;  // 0–23
  avgPercentage: number;
}

export interface TimeSeriesPoint {
  timestamp: string;
  percentage: number;
  occupancy: number;
  capacity: number;
}

export interface HourlyBar {
  hour: number;
  avgPercentage: number;
  avgOccupancy: number;
}

export interface DailyBar {
  day: number;
  avgPercentage: number;
  avgOccupancy: number;
}

export interface LiveReading {
  venueId: number;
  venueName: string;
  occupancy: number;
  capacity: number;
  percentage: number;
  timestamp: string;
}

export interface DailyVisitorCount {
  venueId: number;
  total: number;
}

export async function getVenues(): Promise<Venue[]> {
  // Prefer the venue master table (a tiny read). Fall back to scanning readings
  // when it's empty or not migrated yet (e.g. before `sync-venues` has run), so
  // the dashboard never goes venue-less during the rollout.
  try {
    const result = await db.execute("SELECT venue_id AS id, name FROM venues ORDER BY venue_id");
    if (result.rows.length > 0) return toPlain<Venue>(result.rows);
  } catch {
    // venues table doesn't exist yet — fall through to the readings scan.
  }
  const fallback = await db.execute(
    "SELECT DISTINCT venue_id AS id, venue_name AS name FROM readings ORDER BY venue_id"
  );
  return toPlain<Venue>(fallback.rows);
}

export async function getVenueHours(): Promise<VenueHours[]> {
  // Returns [] when the table is absent/empty; openStatusFor then treats every
  // venue as open (fail-safe), so live data still shows during the rollout.
  try {
    const result = await db.execute(
      "SELECT venue_id AS venueId, dow, open_min AS openMin, close_min AS closeMin FROM venue_hours"
    );
    return toPlain<VenueHours>(result.rows);
  } catch {
    return [];
  }
}

export async function getLiveReadings(): Promise<LiveReading[]> {
  const result = await db.execute(`
    SELECT venue_id AS venueId, venue_name AS venueName, occupancy, capacity,
           ROUND(CAST(occupancy AS REAL) / capacity * 100) AS percentage,
           timestamp
    FROM readings
    WHERE (venue_id, timestamp) IN (
      SELECT venue_id, MAX(timestamp) FROM readings GROUP BY venue_id
    )
    ORDER BY venue_id
  `);
  return toPlain<LiveReading>(result.rows);
}

export async function getTodayVisitorCounts(now = new Date()): Promise<DailyVisitorCount[]> {
  const offsetMod = madridOffsetModifier(now);
  const result = await db.execute({
    sql: `
      SELECT
        venue_id AS venueId,
        MAX(entries) AS total
      FROM readings
      WHERE strftime('%Y-%m-%d', datetime(timestamp, ?)) = strftime('%Y-%m-%d', datetime(?, ?))
        AND capacity > 0
      GROUP BY venue_id
    `,
    args: [offsetMod, now.toISOString(), offsetMod],
  });
  return toPlain<DailyVisitorCount>(result.rows);
}

export async function getHeatmap(venueIds: number[]): Promise<HeatmapCell[]> {
  const placeholders = venueIds.map(() => "?").join(",");
  const offsetMod = madridOffsetModifier();
  const result = await db.execute({
    sql: `
      SELECT
        CAST(strftime('%w', datetime(timestamp, ?)) AS INTEGER) AS dayRaw,
        CAST(strftime('%H', datetime(timestamp, ?)) AS INTEGER) AS hour,
        ROUND(AVG(CAST(occupancy AS REAL) / capacity * 100)) AS avgPercentage
      FROM readings
      WHERE venue_id IN (${placeholders}) AND capacity > 0
      GROUP BY dayRaw, hour
      HAVING hour >= 7
      ORDER BY dayRaw, hour
    `,
    args: [offsetMod, offsetMod, ...venueIds],
  });

  return toPlain<{ dayRaw: number; hour: number; avgPercentage: number }>(result.rows).map(
    (r) => ({
      day: r.dayRaw === 0 ? 6 : r.dayRaw - 1,
      hour: r.hour,
      avgPercentage: r.avgPercentage,
    })
  );
}

export async function getTimeSeries(
  venueId: number,
  from: string,
  to: string
): Promise<TimeSeriesPoint[]> {
  const result = await db.execute({
    sql: `
      SELECT timestamp,
             ROUND(CAST(occupancy AS REAL) / capacity * 100) AS percentage,
             occupancy,
             capacity
      FROM readings
      WHERE venue_id = ? AND capacity > 0
        AND timestamp >= ? AND timestamp <= ?
      ORDER BY timestamp
    `,
    args: [venueId, from, to],
  });
  return toPlain<TimeSeriesPoint>(result.rows);
}

export async function getHourlyAverages(venueIds: number[]): Promise<HourlyBar[]> {
  const placeholders = venueIds.map(() => "?").join(",");
  const offsetMod = madridOffsetModifier();
  const result = await db.execute({
    sql: `
      SELECT
        CAST(strftime('%H', datetime(timestamp, ?)) AS INTEGER) AS hour,
        ROUND(AVG(CAST(occupancy AS REAL) / capacity * 100)) AS avgPercentage,
        ROUND(AVG(occupancy)) AS avgOccupancy
      FROM readings
      WHERE venue_id IN (${placeholders}) AND capacity > 0
      GROUP BY hour
      HAVING hour >= 7
      ORDER BY hour
    `,
    args: [offsetMod, ...venueIds],
  });
  return toPlain<HourlyBar>(result.rows);
}

export async function getDailyAverages(venueIds: number[]): Promise<DailyBar[]> {
  const placeholders = venueIds.map(() => "?").join(",");
  const offsetMod = madridOffsetModifier();
  const result = await db.execute({
    sql: `
      SELECT
        CAST(strftime('%w', datetime(timestamp, ?)) AS INTEGER) AS dayRaw,
        ROUND(AVG(CAST(occupancy AS REAL) / capacity * 100)) AS avgPercentage,
        ROUND(AVG(occupancy)) AS avgOccupancy
      FROM readings
      WHERE venue_id IN (${placeholders}) AND capacity > 0
      GROUP BY dayRaw
      ORDER BY dayRaw
    `,
    args: [offsetMod, ...venueIds],
  });
  return toPlain<{ dayRaw: number; avgPercentage: number; avgOccupancy: number }>(result.rows).map((r) => ({
    day: r.dayRaw === 0 ? 6 : r.dayRaw - 1,
    avgPercentage: r.avgPercentage,
    avgOccupancy: r.avgOccupancy,
  }));
}
