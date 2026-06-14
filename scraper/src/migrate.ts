import { createDbClient } from "./db.js";

const client = createDbClient();

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

await client.execute(`
  CREATE INDEX IF NOT EXISTS idx_readings_venue_ts
  ON readings (venue_id, timestamp)
`);

console.log("Migration complete");
