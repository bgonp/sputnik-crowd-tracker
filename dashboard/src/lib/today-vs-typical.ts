import type { Unit } from "@/components/UnitToggle";
import type { TodayVsTypicalPoint } from "./queries";

/** How many previous same-weekday sessions feed the "typical" baseline. */
export const TYPICAL_WEEKS = 5;
/** Time-of-day bucket width (minutes) used to align today with the baseline. */
export const BUCKET_MINUTES = 15;

/**
 * `YYYY-MM-DD` for `now` in Europe/Madrid. Assembled from `formatToParts` so it
 * doesn't depend on any locale's date ordering (e.g. en-CA's ISO output), which
 * isn't guaranteed across ICU builds and feeds the date filter in the queries.
 */
export function madridDateString(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: "year" | "month" | "day") =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/**
 * The local Madrid dates of the previous `weeks` same-weekday occurrences,
 * most recent first (e.g. the last 5 Saturdays before today). Stepping in whole
 * UTC days from a UTC-midnight anchor keeps the weekday stable and is DST-safe
 * at date granularity — the same fidelity the rest of the queries assume.
 */
export function sameWeekdayDates(now: Date, weeks: number): string[] {
  const iso = madridDateString(now);
  const base = Date.UTC(
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10))
  );
  const out: string[] = [];
  for (let k = 1; k <= weeks; k++) {
    const d = new Date(base - k * 7 * 86_400_000);
    out.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
        d.getUTCDate()
      ).padStart(2, "0")}`
    );
  }
  return out;
}

/** Monday-indexed weekday (0 = Monday … 6 = Sunday) for `now` in Madrid. */
export function madridWeekdayMondayIndexed(now: Date): number {
  const iso = madridDateString(now);
  const dow = new Date(
    Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
  ).getUTCDay(); // 0 = Sunday … 6 = Saturday
  return dow === 0 ? 6 : dow - 1;
}

/** "HH:MM" label for a minute-of-day bucket (e.g. 615 → "10:15"). */
export function formatMinuteOfDay(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(
    2,
    "0"
  )}`;
}

export interface TodayVsTypicalDatum {
  time: string;
  today: number | null;
  typical: number | null;
}

/** Pick the per-unit values and shape the points for the line chart. */
export function buildTodayVsTypicalSeries(
  points: TodayVsTypicalPoint[],
  unit: Unit
): TodayVsTypicalDatum[] {
  const absolute = unit === "absolute";
  return points.map((p) => ({
    time: formatMinuteOfDay(p.minuteOfDay),
    today: absolute ? p.todayOccupancy : p.todayPercentage,
    typical: absolute ? p.typicalOccupancy : p.typicalPercentage,
  }));
}
