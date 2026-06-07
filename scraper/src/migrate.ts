import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env["TURSO_URL"] ?? "",
  authToken: process.env["TURSO_AUTH_TOKEN"] ?? "",
});

await client.execute(`
  CREATE TABLE IF NOT EXISTS readings (
    id          TEXT    PRIMARY KEY,
    timestamp   TEXT    NOT NULL,
    venue_id    INTEGER NOT NULL,
    venue_name  TEXT    NOT NULL,
    occupancy   INTEGER,
    entries     INTEGER,
    exits       INTEGER,
    capacity    INTEGER
  )
`);

console.log("Migration complete");
