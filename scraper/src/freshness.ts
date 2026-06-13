export const DEFAULT_THRESHOLD_MINUTES = 15;

export interface FreshnessResult {
  stale: boolean;
  latest: string | null;
  ageMinutes: number | null;
  thresholdMinutes: number;
  message: string;
}

/**
 * Pure freshness evaluation: given the most recent reading timestamp, decide
 * whether data collection has stalled. Measuring the data's age (not the time
 * since the last check) means this is robust to cron scheduling jitter.
 */
export function evaluateFreshness(
  latest: string | null,
  now: Date,
  thresholdMinutes: number,
): FreshnessResult {
  if (!latest) {
    return {
      stale: true,
      latest: null,
      ageMinutes: null,
      thresholdMinutes,
      message: "No readings found in the database — data collection has never run or the table is empty.",
    };
  }

  const latestMs = new Date(latest).getTime();
  if (!Number.isFinite(latestMs)) {
    return {
      stale: true,
      latest,
      ageMinutes: null,
      thresholdMinutes,
      message: `STALE: latest reading timestamp "${latest}" could not be parsed as a date.`,
    };
  }

  const rawAgeMinutes = (now.getTime() - latestMs) / 60_000;
  const ageMinutes = Math.round(rawAgeMinutes * 10) / 10;
  const stale = rawAgeMinutes > thresholdMinutes;
  return {
    stale,
    latest,
    ageMinutes,
    thresholdMinutes,
    message: stale
      ? `STALE: latest reading is ${ageMinutes} min old (threshold ${thresholdMinutes} min) — the scraper may be down.`
      : `OK: latest reading is ${ageMinutes} min old (threshold ${thresholdMinutes} min).`,
  };
}
