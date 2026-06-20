import { pathToFileURL } from "node:url";
import type { Client } from "@libsql/client";
import { createDbClient } from "./db.js";
import { windowForVenue } from "./open-hours.js";

/**
 * Populate the `venues` and `venue_hours` tables from the venues actually seen
 * in `readings` (the venue_id↔name mapping comes from real data) joined to the
 * opening-hours config in open-hours.ts. This reads/writes the DB only — no gym
 * API call — so it can run from anywhere with Turso credentials, and it does not
 * run on the 60s scrape path (so it adds no per-cycle writes).
 *
 * Run it once after deploying, and again whenever the set of venues changes:
 *   pnpm --filter scraper sync-venues
 */

/** A venue observed in the readings table. */
export interface ObservedVenue {
  venueId: number;
  name: string;
  capacity: number | null;
}

export interface VenueRow {
  venueId: number;
  name: string;
  capacity: number | null;
  updatedAt: string;
}

export interface VenueHoursRow {
  venueId: number;
  dow: number;
  openMin: number;
  closeMin: number;
}

export interface VenueSyncPlan {
  venues: VenueRow[];
  hours: VenueHoursRow[];
  /** Names of observed venues with no configured schedule (their hours are skipped). */
  unknown: string[];
}

/**
 * Pure: turn the observed venues into the rows to write. Each known venue gets
 * 7 `venue_hours` rows (one per day-of-week); a venue with no configured
 * schedule still gets a `venues` row but no hours, and is reported in `unknown`.
 */
export function buildVenueSyncPlan(observed: ObservedVenue[], updatedAt: string): VenueSyncPlan {
  const venues: VenueRow[] = [];
  const hours: VenueHoursRow[] = [];
  const unknown: string[] = [];

  for (const v of observed) {
    venues.push({ venueId: v.venueId, name: v.name, capacity: v.capacity, updatedAt });

    let known = false;
    for (let dow = 0; dow < 7; dow++) {
      const window = windowForVenue(v.name, dow);
      if (window) {
        hours.push({ venueId: v.venueId, dow, openMin: window.openMin, closeMin: window.closeMin });
        known = true;
      }
    }
    if (!known) unknown.push(v.name);
  }

  return { venues, hours, unknown };
}

/**
 * Read each venue's name + capacity from its **newest** reading — exactly one row
 * per venue_id. `readings` has no (venue_id, timestamp) uniqueness constraint, so
 * we rank by (timestamp, rowid) and take the top row; the rowid tie-breaker keeps
 * it deterministic even if two readings share the newest timestamp.
 */
export async function readObservedVenues(client: Client): Promise<ObservedVenue[]> {
  const result = await client.execute(`
    SELECT venueId, name, capacity FROM (
      SELECT
        venue_id AS venueId, venue_name AS name, capacity,
        ROW_NUMBER() OVER (PARTITION BY venue_id ORDER BY timestamp DESC, rowid DESC) AS rn
      FROM readings
    )
    WHERE rn = 1
    ORDER BY venueId
  `);
  return result.rows.map((r) => ({
    venueId: Number(r["venueId"]),
    name: String(r["name"]),
    capacity: r["capacity"] == null ? null : Number(r["capacity"]),
  }));
}

/** Read observed venues, build the plan, and upsert both tables. */
export async function syncVenues(client: Client, now: Date): Promise<VenueSyncPlan> {
  const observed = await readObservedVenues(client);
  const plan = buildVenueSyncPlan(observed, now.toISOString());

  const statements = [
    ...plan.venues.map((v) => ({
      sql: `INSERT INTO venues (venue_id, name, capacity, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(venue_id) DO UPDATE SET
              name = excluded.name, capacity = excluded.capacity, updated_at = excluded.updated_at`,
      args: [v.venueId, v.name, v.capacity, v.updatedAt],
    })),
    ...plan.hours.map((h) => ({
      sql: `INSERT INTO venue_hours (venue_id, dow, open_min, close_min)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(venue_id, dow) DO UPDATE SET
              open_min = excluded.open_min, close_min = excluded.close_min`,
      args: [h.venueId, h.dow, h.openMin, h.closeMin],
    })),
  ];

  if (statements.length > 0) {
    await client.batch(statements, "write");
  }
  return plan;
}

/* v8 ignore start -- CLI glue: wires real deps and logs; exercised by a manual
   run, not by unit tests (the pure plan + DB sync are tested directly). */
async function run(): Promise<void> {
  const nowEnv = process.env["MOCK_NOW"];
  const now = nowEnv ? new Date(nowEnv) : new Date();
  if (!Number.isFinite(now.getTime())) throw new Error(`Invalid MOCK_NOW="${nowEnv}"`);

  const plan = await syncVenues(createDbClient(), now);
  console.log(`Synced ${plan.venues.length} venues, ${plan.hours.length} venue_hours rows.`);
  if (plan.unknown.length > 0) {
    console.warn(`No configured hours for: ${plan.unknown.join(", ")} (add them to open-hours.ts).`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
/* v8 ignore stop */
