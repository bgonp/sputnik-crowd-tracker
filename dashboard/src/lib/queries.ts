import type { Row } from "@libsql/client";
import { db } from "./db";

function toPlain<T>(rows: Row[]): T[] {
  return rows.map((r) => ({ ...r })) as T[];
}

export interface Venue {
  id: number;
  name: string;
}

export interface HeatmapCell {
  day: number;   // 0 = Monday … 6 = Sunday
  hour: number;  // 0–23
  avgPercentage: number;
}

export interface TimeSeriesPoint {
  timestamp: string;
  percentage: number;
}

export interface HourlyBar {
  hour: number;
  avgPercentage: number;
}

export interface DailyBar {
  day: number;
  avgPercentage: number;
}

export interface LiveReading {
  venueId: number;
  venueName: string;
  occupancy: number;
  capacity: number;
  percentage: number;
  timestamp: string;
}

export async function getVenues(): Promise<Venue[]> {
  const result = await db.execute(
    "SELECT DISTINCT venue_id AS id, venue_name AS name FROM readings ORDER BY venue_id"
  );
  return toPlain<Venue>(result.rows);
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

export async function getHeatmap(venueIds: number[]): Promise<HeatmapCell[]> {
  const placeholders = venueIds.map(() => "?").join(",");
  const result = await db.execute({
    sql: `
      SELECT
        CAST(strftime('%w', timestamp) AS INTEGER) AS dayRaw,
        CAST(strftime('%H', timestamp) AS INTEGER) AS hour,
        ROUND(AVG(CAST(occupancy AS REAL) / capacity * 100)) AS avgPercentage
      FROM readings
      WHERE venue_id IN (${placeholders}) AND capacity > 0
      GROUP BY dayRaw, hour
      ORDER BY dayRaw, hour
    `,
    args: venueIds,
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
             ROUND(CAST(occupancy AS REAL) / capacity * 100) AS percentage
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
  const result = await db.execute({
    sql: `
      SELECT
        CAST(strftime('%H', timestamp) AS INTEGER) AS hour,
        ROUND(AVG(CAST(occupancy AS REAL) / capacity * 100)) AS avgPercentage
      FROM readings
      WHERE venue_id IN (${placeholders}) AND capacity > 0
      GROUP BY hour
      ORDER BY hour
    `,
    args: venueIds,
  });
  return toPlain<HourlyBar>(result.rows);
}

export async function getDailyAverages(venueIds: number[]): Promise<DailyBar[]> {
  const placeholders = venueIds.map(() => "?").join(",");
  const result = await db.execute({
    sql: `
      SELECT
        CAST(strftime('%w', timestamp) AS INTEGER) AS dayRaw,
        ROUND(AVG(CAST(occupancy AS REAL) / capacity * 100)) AS avgPercentage
      FROM readings
      WHERE venue_id IN (${placeholders}) AND capacity > 0
      GROUP BY dayRaw
      ORDER BY dayRaw
    `,
    args: venueIds,
  });
  return toPlain<{ dayRaw: number; avgPercentage: number }>(result.rows).map((r) => ({
    day: r.dayRaw === 0 ? 6 : r.dayRaw - 1,
    avgPercentage: r.avgPercentage,
  }));
}
