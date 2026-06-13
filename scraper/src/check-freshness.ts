import { createClient } from "@libsql/client";
import { evaluateFreshness, DEFAULT_THRESHOLD_MINUTES } from "./freshness.js";

async function run(): Promise<void> {
  const thresholdEnv = process.env["FRESHNESS_THRESHOLD_MINUTES"];
  const thresholdMinutes = thresholdEnv === undefined ? DEFAULT_THRESHOLD_MINUTES : Number(thresholdEnv);
  if (!Number.isFinite(thresholdMinutes) || thresholdMinutes <= 0) {
    throw new Error(
      `Invalid FRESHNESS_THRESHOLD_MINUTES="${thresholdEnv ?? ""}" (expected a positive number)`,
    );
  }

  const url = process.env["TURSO_URL"];
  const authToken = process.env["TURSO_AUTH_TOKEN"];
  if (!url) throw new Error("Missing TURSO_URL env var");
  if (authToken === undefined) throw new Error("Missing TURSO_AUTH_TOKEN env var");

  const client = createClient({ url, authToken });

  const result = await client.execute("SELECT MAX(timestamp) AS latest FROM readings");
  const latest = (result.rows[0]?.["latest"] as string | null | undefined) ?? null;

  const nowEnv = process.env["MOCK_NOW"];
  const now = nowEnv ? new Date(nowEnv) : new Date();
  if (!Number.isFinite(now.getTime())) throw new Error(`Invalid MOCK_NOW="${nowEnv}"`);
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
