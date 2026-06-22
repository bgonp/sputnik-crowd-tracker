// Decides what to do with a fetched occupancy payload, kept pure (no network,
// no DB, no clock) so the branching is unit-testable — `index.ts`'s `run()`
// only fetches, calls this, then logs/inserts the result.
//
// Crucially this separates two outcomes the old inline code conflated: an
// empty API payload (a transient blip — we already passed the open-hours gate)
// versus a payload whose venues are all individually closed right now. Both
// produced the misleading "No venues open … nothing to insert" log.
import { toReadings, type ApiVenue, type Reading } from "./transform.js";
import { isVenueOpenAt, type MadridMoment } from "./open-hours.js";

export type IngestPlan =
  /** The API returned no venues at all — a transient blip, not a closed gym. */
  | { kind: "empty-payload" }
  /** Venues came back, but none are open (or all had zero capacity) right now. */
  | { kind: "no-open-venues"; fetched: number }
  /** Readings to insert. */
  | { kind: "insert"; readings: Reading[] };

/**
 * Classify a fetched payload into an actionable plan. `moment` is the Madrid
 * wall-clock instant the cycle started at (shared with the open-hours gate).
 */
export function planIngest(
  venues: ApiVenue[],
  timestamp: string,
  moment: MadridMoment
): IngestPlan {
  if (venues.length === 0) {
    return { kind: "empty-payload" };
  }

  // Some venues open later / close earlier than others, so drop readings for
  // venues that are individually closed right now even when others are open.
  const readings = toReadings(venues, timestamp).filter((r) =>
    isVenueOpenAt(r.venueName, moment)
  );
  if (readings.length === 0) {
    return { kind: "no-open-venues", fetched: venues.length };
  }

  return { kind: "insert", readings };
}
