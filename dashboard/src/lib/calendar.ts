import { FULL_MONTH_LABELS } from "./labels";

// Pure month-grid math for the line chart's date picker. Dates are Madrid wall
// `YYYY-MM-DD` strings treated as plain calendar dates (no timezone work — the
// caller already resolved them in Madrid), so a UTC-midnight anchor steps days
// without DST drift, consistent with the rest of the date helpers.

const DAY_MS = 86_400_000;

function toUtcMs(iso: string): number {
  return Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
}

function toDateString(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;
}

/** Monday-indexed weekday (0 = Monday … 6 = Sunday) for a UTC timestamp. */
function mondayDow(ms: number): number {
  const dow = new Date(ms).getUTCDay(); // 0 = Sunday … 6 = Saturday
  return dow === 0 ? 6 : dow - 1;
}

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  day: number; // 1–31
  inMonth: boolean; // belongs to the displayed month (vs. a leading/trailing day)
  disabled: boolean; // outside the selectable [min, max] range
  isToday: boolean;
  isSelected: boolean;
}

export interface CalendarMonth {
  year: number;
  month: number; // 0–11
  label: string; // "junio 2026"
  weeks: CalendarDay[][]; // 6 rows × 7 cells, Monday-first
  canGoPrev: boolean; // a selectable day exists in an earlier month
  canGoNext: boolean; // …in a later month
}

export interface BuildCalendarArgs {
  year: number;
  month: number; // 0–11, the month to display
  selected: string;
  today: string;
  min: string; // earliest selectable date
  max: string; // latest selectable date
  // Past days absent from this set are disabled (they have no data). Today is
  // never disabled by it. Omit to allow every in-range day.
  available?: ReadonlySet<string>;
}

/**
 * Build a fixed 6-row, Monday-first month grid with each day flagged for the
 * picker (in-month, disabled, today, selected) plus whether prev/next months
 * still hold a selectable day.
 */
export function buildCalendarMonth({
  year,
  month,
  selected,
  today,
  min,
  max,
  available,
}: BuildCalendarArgs): CalendarMonth {
  const minMs = toUtcMs(min);
  const maxMs = toUtcMs(max);
  const firstMs = Date.UTC(year, month, 1);
  const startMs = firstMs - mondayDow(firstMs) * DAY_MS; // back up to the Monday on/before the 1st

  const weeks: CalendarDay[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: CalendarDay[] = [];
    for (let d = 0; d < 7; d++) {
      const ms = startMs + (w * 7 + d) * DAY_MS;
      const cur = new Date(ms);
      const date = toDateString(ms);
      const isToday = date === today;
      // Out of range, or a past day with no data (today is always selectable).
      const noData = available != null && !isToday && !available.has(date);
      row.push({
        date,
        day: cur.getUTCDate(),
        inMonth: cur.getUTCMonth() === month && cur.getUTCFullYear() === year,
        disabled: ms < minMs || ms > maxMs || noData,
        isToday,
        isSelected: date === selected,
      });
    }
    weeks.push(row);
  }

  const displayedYm = year * 12 + month;
  const minDate = new Date(minMs);
  const maxDate = new Date(maxMs);
  return {
    year,
    month,
    label: `${FULL_MONTH_LABELS[month] ?? ""} ${year}`,
    weeks,
    canGoPrev: displayedYm > minDate.getUTCFullYear() * 12 + minDate.getUTCMonth(),
    canGoNext: displayedYm < maxDate.getUTCFullYear() * 12 + maxDate.getUTCMonth(),
  };
}

/** Step a displayed `{year, month}` by `delta` months (handles year wrap). */
export function shiftMonth(
  year: number,
  month: number,
  delta: number
): { year: number; month: number } {
  const ym = year * 12 + month + delta;
  return { year: Math.floor(ym / 12), month: ((ym % 12) + 12) % 12 };
}

/** The `{year, month}` a `YYYY-MM-DD` date falls in — the picker's initial view. */
export function monthOf(iso: string): { year: number; month: number } {
  return { year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) - 1 };
}
