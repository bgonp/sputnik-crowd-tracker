import type { Row } from "@libsql/client";
import { db } from "./db";
import {
  sameWeekdayDatesFromDateString,
  recentMadridDates,
  madridDateString,
  TYPICAL_WEEKS,
  SELECTABLE_DAYS,
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
  minuteOfDay: number; // minutes from local (Madrid) midnight (per-minute)
  todayOccupancy: number | null;
  todayPercentage: number | null;
  typicalOccupancy: number | null;
  typicalPercentage: number | null;
}

/**
 * The Madrid dates within the last `days` for which `venueId` has at least one
 * reading — used to disable empty days in the line chart's date picker, so a
 * user can't pick a day that returns nothing. Bounded to the picker window and
 * filtered by `(venue_id, timestamp)` (indexed), so it's a tight scan returning
 * ≤ `days` rows. The set changes at most once a day, hence the long cache TTL.
 */
export async function getDatesWithData(
  venueId: number,
  now = new Date(),
  days = SELECTABLE_DAYS
): Promise<string[]> {
  const offsetMod = madridOffsetModifier(now);
  const window = recentMadridDates(now, days);
  const floor = window[window.length - 1] ?? madridDateString(now);
  // A day of slack on the UTC floor covers the timezone shift, matching how the
  // other date-filtered queries bound their scans.
  const from = new Date(Date.parse(`${floor}T00:00:00Z`) - 86_400_000).toISOString();
  const to = now.toISOString();
  const result = await db.execute({
    sql: `
      SELECT DISTINCT strftime('%Y-%m-%d', datetime(timestamp, ?)) AS d
      FROM readings
      WHERE venue_id = ? AND timestamp >= ? AND timestamp <= ?
      ORDER BY d
    `,
    args: [offsetMod, venueId, from, to],
  });
  return result.rows.map((r) => r.d as string);
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
      HAVING hour >= 6
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
 * Returns one row per minute-of-day, each carrying today's reading and the
 * average across the previous `weeks` same-weekday sessions (e.g. the last 5
 * Saturdays). Grouping by minute-of-day aligns the per-day readings, whose exact
 * second drifts between days. Minutes that today hasn't reached yet have
 * `today*` = `null` (so the live line stops at "now" while the baseline runs to
 * close); minutes with no readings at all simply don't appear.
 *
 * One Turso read: today + the N baseline dates are computed here and bound as a
 * local-date `IN (…)` filter, with a UTC timestamp range to keep the scan tight.
 *
 * When `openWindow` is given, buckets outside the venue's open hours are dropped
 * (a `HAVING` on `minuteOfDay`). This crops the chart to opening hours even
 * though older baseline days predate the "collect only while open" change and so
 * still carry overnight readings. Pass `null` to keep every bucket.
 *
 * `anchorDate` re-points the primary line at a chosen recent Madrid date instead
 * of today (the chart's day selector), with the baseline taken from that date's
 * own same-weekday history. A past day is complete, so its line runs to close;
 * today's still stops at `now`.
 */
export async function getTodayVsTypical(
  venueId: number,
  now = new Date(),
  weeks = TYPICAL_WEEKS,
  openWindow: { openMin: number; closeMin: number } | null = null,
  anchorDate?: string
): Promise<TodayVsTypicalPoint[]> {
  const todayStr = madridDateString(now);
  // The day plotted as the primary ("today") line: today by default, or the
  // selected recent date. The "typical" baseline is that day's same-weekday avg.
  const primary = anchorDate ?? todayStr;
  const isToday = primary === todayStr;
  // Convert with the offset for the *plotted* day, so a past date sitting in a
  // different DST period still aligns (the 30-day window rarely crosses one).
  const offsetMod = madridOffsetModifier(isToday ? now : new Date(`${primary}T12:00:00Z`));
  const baselineDates = sameWeekdayDatesFromDateString(primary, weeks);
  const dates = [primary, ...baselineDates];
  const placeholders = dates.map(() => "?").join(", ");

  // Bound the scan to the window the IN filter cares about (oldest baseline date
  // minus a day of slack for the timezone shift), so SQLite can prune by timestamp.
  const oldest = baselineDates[baselineDates.length - 1] ?? primary;
  const from = new Date(Date.parse(`${oldest}T00:00:00Z`) - 86_400_000).toISOString();
  // Today's live line stops at `now`; a completed past day runs to its end (a
  // 2-day pad past its UTC midnight comfortably covers local close — the IN
  // filter is what actually scopes the rows to `primary`).
  const to = (
    isToday ? now : new Date(Date.parse(`${primary}T00:00:00Z`) + 2 * 86_400_000)
  ).toISOString();

  // Crop to open hours: keep minutes from openMin up to (but not including) closeMin.
  const having = openWindow ? "HAVING minuteOfDay >= ? AND minuteOfDay < ?" : "";
  const windowArgs = openWindow ? [openWindow.openMin, openWindow.closeMin] : [];

  const result = await db.execute({
    sql: `
      SELECT
        CAST(strftime('%H', datetime(timestamp, ?)) AS INTEGER) * 60
          + CAST(strftime('%M', datetime(timestamp, ?)) AS INTEGER) AS minuteOfDay,
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
      ${having}
      ORDER BY minuteOfDay
    `,
    args: [
      offsetMod, offsetMod,
      offsetMod, primary,
      offsetMod, primary,
      offsetMod, primary,
      offsetMod, primary,
      venueId,
      from, to,
      offsetMod, ...dates,
      ...windowArgs,
    ],
  });
  return toPlain<TodayVsTypicalPoint>(result.rows);
}
