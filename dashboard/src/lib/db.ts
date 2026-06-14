import { createClient } from "@libsql/client";

export const db = createClient({
  url: process.env.TURSO_URL!,
  // Token value is ignored for local file: URLs but may be undefined there;
  // default to "" so we never pass undefined (matches the scraper).
  authToken: process.env.TURSO_AUTH_TOKEN ?? "",
});
