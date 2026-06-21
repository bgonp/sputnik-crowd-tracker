import type { TodayVsTypicalPoint } from "./queries";

/** How many previous same-weekday sessions feed the "typical" baseline. */
export const TYPICAL_WEEKS = 5;

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

/** "HH:MM" label for a minute-of-day (e.g. 615 → "10:15"). */
export function formatMinuteOfDay(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(
    2,
    "0"
  )}`;
}

export interface TodayVsTypicalDatum {
  time: string;
  // Percentage drives the plotted lines; the absolute counts ride along so the
  // tooltip can show both ("42% · 31 pers.") now that the unit toggle is gone.
  todayPct: number | null;
  todayAbs: number | null;
  typicalPct: number | null;
  typicalAbs: number | null;
}

/** Radius (in minutes) of the centred moving average applied to the baseline. */
export const BASELINE_SMOOTH_RADIUS = 3; // ±3 min → 7-minute window

/**
 * Centred moving average over a per-minute series: each point becomes the mean
 * of itself and up to `radius` neighbours on each side. Nulls are skipped, and a
 * window with no values stays null. Assumes consecutive minutes (the chart's
 * series is dense across open hours), so the window is by index = by time.
 */
export function movingAverage(
  values: (number | null)[],
  radius: number
): (number | null)[] {
  return values.map((_, i) => {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - radius); j <= Math.min(values.length - 1, i + radius); j++) {
      const v = values[j];
      if (v !== null && v !== undefined) {
        sum += v;
        count += 1;
      }
    }
    return count > 0 ? sum / count : null;
  });
}

/**
 * Shape the query points for the line chart, carrying both % and people. The
 * baseline ("typical") line is lightly smoothed with a moving average — at
 * minute resolution it averages only a handful of same-weekday samples per
 * minute, so it's jittery — while today's line is left raw (the live reading).
 */
export function buildTodayVsTypicalSeries(
  points: TodayVsTypicalPoint[]
): TodayVsTypicalDatum[] {
  const typicalPct = movingAverage(
    points.map((p) => p.typicalPercentage),
    BASELINE_SMOOTH_RADIUS
  );
  const typicalAbs = movingAverage(
    points.map((p) => p.typicalOccupancy),
    BASELINE_SMOOTH_RADIUS
  );
  return points.map((p, i) => ({
    time: formatMinuteOfDay(p.minuteOfDay),
    todayPct: p.todayPercentage,
    todayAbs: p.todayOccupancy,
    typicalPct: typicalPct[i] ?? null,
    typicalAbs: typicalAbs[i] ?? null,
  }));
}
