/**
 * The scraper writes one cycle for all open venues at the same instant, so the
 * freshest reading across venues is the timestamp of the last successful scrape
 * — that's what the dashboard surfaces as "last updated". Closed venues keep
 * their older closing-time readings, so we take the max rather than any single
 * venue's value.
 */
export function latestReadingTimestamp(
  readings: { timestamp: string }[]
): string | null {
  let latest: string | null = null;
  for (const { timestamp } of readings) {
    // Timestamps are UTC ISO strings, so lexical comparison matches chronological.
    if (latest === null || timestamp > latest) latest = timestamp;
  }
  return latest;
}

const madridTimeFormatter = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Format a UTC ISO timestamp as a Madrid wall-clock time, e.g. "19:42".
 * DST-aware via the Intl time zone; deterministic across server and client
 * (fixed locale + time zone) so it's hydration-safe.
 */
export function formatMadridTime(iso: string): string {
  return madridTimeFormatter.format(new Date(iso));
}
