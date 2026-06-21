import type { Row } from "@libsql/client";
import { db } from "./db";
import {
  sameWeekdayDates,
  madridDateString,
  TYPICAL_WEEKS,
  BUCKET_MINUTES,
} from "./today-vs-typical";

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

/** True for a "no such table" error — the only case the venue queries tolerate
 *  (the table hasn't been migrated yet). Anything else is a real failure. */
function isMissingTableError(err: unknown): boolean {
  return err instanceof Error && /no such table/i.test(err.message);
}

export interface TodayVsTypicalPoint {
  minuteOfDay: number; // minutes from local (Madrid) midnight, bucketed
  todayOccupancy: number | null;
  todayPercentage: number | null;
  typicalOccupancy: number | null;
  typicalPercentage: number | null;
}

export async function getVenues(): Promise<Venue[]> {
  // Prefer the venue master table (a tiny read). Fall back to scanning readings
  // when it's empty or not migrated yet (e.g. before `sync-venues` has run), so
  // the dashboard never goes venue-less during the rollout.
  try {
    const result = await db.execute("SELECT venue_id AS id, name FROM venues ORDER BY venue_id");
    if (result.rows.length > 0) return toPlain<Venue>(result.rows);
  } catch (err) {
    if (!isMissingTableError(err)) throw err; // don't mask real failures
  }
  const fallback = await db.execute(
    "SELECT DISTINCT venue_id AS id, venue_name AS name FROM readings ORDER BY venue_id"
  );
  return toPlain<Venue>(fallback.rows);
}

export async function getVenueHours(): Promise<VenueHours[]> {
  // Returns [] when the table hasn't been migrated yet; openStatusFor then treats
  // every venue as open (fail-safe), so live data still shows during the rollout.
  try {
    const result = await db.execute(
      "SELECT venue_id AS venueId, dow, open_min AS openMin, close_min AS closeMin FROM venue_hours"
    );
    return toPlain<VenueHours>(result.rows);
  } catch (err) {
    if (!isMissingTableError(err)) throw err; // don't mask real failures as "all open"
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

/**
 * Today's occupancy through the day vs. the same-weekday baseline.
 *
 * Returns one row per `BUCKET_MINUTES` time-of-day slot, each carrying today's
 * average and the average across the previous `weeks` same-weekday sessions
 * (e.g. the last 5 Saturdays). Buckets that today hasn't reached yet have
 * `today*` = `null` (so the live line stops at "now" while the baseline runs to
 * close); slots with no readings at all simply don't appear.
 *
 * One Turso read: today + the N baseline dates are computed here and bound as a
 * local-date `IN (…)` filter, with a UTC timestamp range to keep the scan tight.
 */
export async function getTodayVsTypical(
  venueId: number,
  now = new Date(),
  weeks = TYPICAL_WEEKS
): Promise<TodayVsTypicalPoint[]> {
  const offsetMod = madridOffsetModifier(now);
  const today = madridDateString(now);
  const baselineDates = sameWeekdayDates(now, weeks);
  const dates = [today, ...baselineDates];
  const placeholders = dates.map(() => "?").join(", ");

  // Bound the scan to the window the IN filter cares about (oldest baseline date
  // minus a day of slack for the timezone shift), so SQLite can prune by timestamp.
  const oldest = baselineDates[baselineDates.length - 1] ?? today;
  const from = new Date(Date.parse(`${oldest}T00:00:00Z`) - 86_400_000).toISOString();
  const to = now.toISOString();

  const result = await db.execute({
    // BUCKET_MINUTES is a trusted integer constant, inlined so SQLite does
    // *integer* division (a bound `?` binds as REAL → float division, which
    // would leave minuteOfDay un-bucketed).
    sql: `
      SELECT
        (CAST(strftime('%H', datetime(timestamp, ?)) AS INTEGER) * 60
          + CAST(strftime('%M', datetime(timestamp, ?)) AS INTEGER)) / ${BUCKET_MINUTES} * ${BUCKET_MINUTES} AS minuteOfDay,
        ROUND(AVG(CASE WHEN strftime('%Y-%m-%d', datetime(timestamp, ?)) = ?  THEN occupancy END)) AS todayOccupancy,
        ROUND(AVG(CASE WHEN strftime('%Y-%m-%d', datetime(timestamp, ?)) = ?  THEN CAST(occupancy AS REAL) / capacity * 100 END)) AS todayPercentage,
        ROUND(AVG(CASE WHEN strftime('%Y-%m-%d', datetime(timestamp, ?)) <> ? THEN occupancy END)) AS typicalOccupancy,
        ROUND(AVG(CASE WHEN strftime('%Y-%m-%d', datetime(timestamp, ?)) <> ? THEN CAST(occupancy AS REAL) / capacity * 100 END)) AS typicalPercentage
      FROM readings
      WHERE venue_id = ?
        AND capacity > 0
        AND timestamp >= ? AND timestamp <= ?
        AND strftime('%Y-%m-%d', datetime(timestamp, ?)) IN (${placeholders})
      GROUP BY minuteOfDay
      ORDER BY minuteOfDay
    `,
    args: [
      offsetMod, offsetMod,
      offsetMod, today,
      offsetMod, today,
      offsetMod, today,
      offsetMod, today,
      venueId,
      from, to,
      offsetMod, ...dates,
    ],
  });
  return toPlain<TodayVsTypicalPoint>(result.rows);
}
