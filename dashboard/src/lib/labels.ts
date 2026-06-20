export const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
  `${String(i).padStart(2, "0")}:00`
);
export const OPENING_HOUR = 7;

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

/** "Media de 5 sábados" — label for the same-weekday baseline line. */
export function typicalAverageLabel(mondayIndexedDay: number, weeks: number): string {
  const day = FULL_DAY_LABELS[mondayIndexedDay] ?? "días";
  // Spanish weekday plurals: only those ending in a vowel take an "-s"
  // (sábado→sábados, domingo→domingos); lunes…viernes are invariable.
  const plural = day.endsWith("s") ? day : `${day}s`;
  return `Media de ${weeks} ${plural}`;
}
