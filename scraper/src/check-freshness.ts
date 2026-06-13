import { createClient } from "@libsql/client";
import { evaluateFreshness, DEFAULT_THRESHOLD_MINUTES } from "./freshness.js";

async function run(): Promise<void> {
  const thresholdMinutes = Number(process.env["FRESHNESS_THRESHOLD_MINUTES"]) || DEFAULT_THRESHOLD_MINUTES;

  const client = createClient({
    url: process.env["TURSO_URL"] ?? "",
    authToken: process.env["TURSO_AUTH_TOKEN"] ?? "",
  });

  const result = await client.execute("SELECT MAX(timestamp) AS latest FROM readings");
  const latest = (result.rows[0]?.["latest"] as string | null | undefined) ?? null;
  const now = process.env["MOCK_NOW"] ? new Date(process.env["MOCK_NOW"]) : new Date();

  const freshness = evaluateFreshness(latest, now, thresholdMinutes);
  console.log(freshness.message);

  // Exit non-zero on staleness so the scheduled GitHub Action fails and
  // notifies the repo owner.
  if (freshness.stale) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
