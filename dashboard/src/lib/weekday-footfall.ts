import type { WeekdayFootfall } from "./queries";
import { DAY_LABELS, FULL_DAY_LABELS } from "./labels";

/** How many weeks back the weekday averages span (≈ this many samples per
 *  weekday) — recent enough to reflect current habits, long enough to be stable. */
export const WEEKDAY_FOOTFALL_WEEKS = 8;

export interface WeekdayFootfallDatum {
  day: number; // Monday-indexed: 0 = Monday … 6 = Sunday
  label: string; // short weekday label ("Lun" … "Dom")
  fullLabel: string; // full weekday name ("lunes" … "domingo") for the tooltip
  avgVisitors: number; // mean daily footfall for that weekday over the window
  hasData: boolean; // false → no readings for that weekday (bar drawn at 0, muted)
}

/**
 * Expand the query's per-weekday averages into a fixed Monday→Sunday series, so
 * the chart always renders all seven bars in week order (a weekday with no
 * readings becomes a 0-height, `hasData: false` bar rather than a gap).
 */
export function buildWeekdayFootfallSeries(
  data: WeekdayFootfall[]
): WeekdayFootfallDatum[] {
  const byDay = new Map(data.map((d) => [d.day, d.avgVisitors]));
  return DAY_LABELS.map((label, day) => ({
    day,
    label,
    fullLabel: FULL_DAY_LABELS[day] ?? label,
    avgVisitors: byDay.get(day) ?? 0,
    hasData: byDay.has(day),
  }));
}

/**
 * Relative activity position of each bar on a 0→1 scale (quietest = 0, busiest =
 * 1), so the chart can colour them on the green→red occupancy scale and the
 * best/worst day to visit pops out. Days with no data — and every day when they
 * all tie (no meaningful ranking) — get `null`, which the chart renders neutral.
 */
export function weekdayActivityScale(
  series: WeekdayFootfallDatum[]
): (number | null)[] {
  const values = series.filter((d) => d.hasData).map((d) => d.avgVisitors);
  if (values.length === 0) return series.map(() => null);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return series.map(() => null); // all equal → no ranking
  return series.map((d) => (d.hasData ? (d.avgVisitors - min) / (max - min) : null));
}
