import { createClient, type Client } from "@libsql/client";

/**
 * Build a Turso client from TURSO_URL / TURSO_AUTH_TOKEN.
 *
 * Local URLs (file:, :memory:) ignore the token, so a missing one is fine there.
 * Remote URLs need a real token — fail fast with an actionable message rather
 * than passing "" and surfacing a confusing 401 on the first query.
 */
export function createDbClient(): Client {
  const url = process.env["TURSO_URL"];
  if (!url) {
    throw new Error("TURSO_URL is not set");
  }

  const isLocal = url.startsWith("file:") || url.startsWith(":memory:");
  const authToken = process.env["TURSO_AUTH_TOKEN"] ?? "";
  if (!isLocal && !authToken) {
    throw new Error(`TURSO_AUTH_TOKEN is required for a remote database URL (${url.split(":")[0]}://…)`);
  }

  return createClient({ url, authToken });
}
