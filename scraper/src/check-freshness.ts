import { pathToFileURL } from "node:url";
import type { Client } from "@libsql/client";
import { createDbClient } from "./db.js";
import { evaluateFreshness, DEFAULT_THRESHOLD_MINUTES, type FreshnessResult } from "./freshness.js";

/**
 * Resolve the staleness threshold from `FRESHNESS_THRESHOLD_MINUTES`, falling
 * back to the default when unset. Throws on a non-positive or non-numeric value
 * so a misconfigured env fails loudly rather than silently disabling alerts.
 */
export function parseThresholdMinutes(env: string | undefined): number {
  const minutes = env === undefined ? DEFAULT_THRESHOLD_MINUTES : Number(env);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new Error(
      `Invalid FRESHNESS_THRESHOLD_MINUTES="${env ?? ""}" (expected a positive number)`,
    );
  }
  return minutes;
}

/**
 * Read the newest reading timestamp from the database and evaluate whether data
 * collection has gone stale. The client is injected so this is unit-testable.
 */
export async function checkFreshness(
  client: Client,
  now: Date,
  thresholdMinutes: number,
): Promise<FreshnessResult> {
  const result = await client.execute("SELECT MAX(timestamp) AS latest FROM readings");
  const latest = (result.rows[0]?.["latest"] as string | null | undefined) ?? null;
  return evaluateFreshness(latest, now, thresholdMinutes);
}

/* v8 ignore start -- CLI glue: wires real deps, logs, and sets the exit code;
   exercised by the freshness workflow / a manual run, not by unit tests. */
async function run(): Promise<void> {
  const thresholdMinutes = parseThresholdMinutes(process.env["FRESHNESS_THRESHOLD_MINUTES"]);

  const nowEnv = process.env["MOCK_NOW"];
  const now = nowEnv ? new Date(nowEnv) : new Date();
  if (!Number.isFinite(now.getTime())) throw new Error(`Invalid MOCK_NOW="${nowEnv}"`);

  const freshness = await checkFreshness(createDbClient(), now, thresholdMinutes);
  console.log(freshness.message);

  // Exit non-zero on staleness so the scheduled GitHub Action fails and
  // notifies the repo owner.
  if (freshness.stale) {
    process.exit(1);
  }
}

// Run only when invoked as the CLI entry, not when imported by tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
/* v8 ignore stop */
