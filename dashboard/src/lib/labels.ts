export const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
  `${String(i).padStart(2, "0")}:00`
);
/**
 * First hour column shown in the heatmap. Set one hour before the earliest venue
 * opening (07:00) so the grid always carries a leading closed column — that makes
 * it read as "the gym is closed here", not as a cropped chart.
 */
export const HEATMAP_FIRST_HOUR = 6;

// Monday-indexed (matches DAY_LABELS / the Madrid weekday helpers).
export const FULL_DAY_LABELS = [
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
];

export const TODAY_LABEL = "Hoy";

/** Lowercase Spanish month abbreviations, January-indexed. */
export const MONTH_LABELS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

/** Lowercase Spanish month names, January-indexed (calendar header). */
export const FULL_MONTH_LABELS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/**
 * "Sáb 20 jun" — compact label for a `YYYY-MM-DD` Madrid date, used by the line
 * chart's day selector and the primary-line legend. Self-contained (derives the
 * weekday from the date) so callers don't have to thread one in.
 */
export function dateLineLabel(iso: string): string {
  const day = Number(iso.slice(8, 10));
  const month = MONTH_LABELS[Number(iso.slice(5, 7)) - 1] ?? "";
  const utcDay = new Date(
    Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, day)
  ).getUTCDay(); // 0 = Sunday … 6 = Saturday
  const weekday = DAY_LABELS[utcDay === 0 ? 6 : utcDay - 1] ?? "";
  return `${weekday} ${day} ${month}`;
}

/**
 * "Últimos sábados" — label for the same-weekday baseline line. The number of
 * weeks averaged is intentionally not surfaced; the phrasing just says "recent
 * <weekday>s".
 */
export function lastWeekdaysLabel(mondayIndexedDay: number): string {
  const day = FULL_DAY_LABELS[mondayIndexedDay] ?? "día";
  // Spanish weekday plurals: only those ending in a vowel take an "-s"
  // (sábado→sábados, domingo→domingos); lunes…viernes are invariable.
  const plural = day.endsWith("s") ? day : `${day}s`;
  return `Últimos ${plural}`;
}
