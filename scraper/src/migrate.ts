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

// Venue master table — identity + last-seen capacity. Populated from observed
// readings by `sync-venues` (the venue_id↔name mapping comes from real data,
// not a guessed list).
await client.execute(`
  CREATE TABLE IF NOT EXISTS venues (
    venue_id   INTEGER PRIMARY KEY,
    name       TEXT    NOT NULL,
    capacity   INTEGER,
    updated_at TEXT
  )
`);

// Per-venue, per-day-of-week opening hours (minutes from local midnight, Madrid
// time). dow: 0 = Sunday … 6 = Saturday. Seeded from scraper/src/open-hours.ts
// by `sync-venues`; the dashboard reads this table to show open/closed + hours.
await client.execute(`
  CREATE TABLE IF NOT EXISTS venue_hours (
    venue_id  INTEGER NOT NULL,
    dow       INTEGER NOT NULL,
    open_min  INTEGER NOT NULL,
    close_min INTEGER NOT NULL,
    PRIMARY KEY (venue_id, dow)
  )
`);

console.log("Migration complete");
