import { createClient } from "@libsql/client";
import { randomUUID } from "crypto";
import { windowForVenue, type OpenWindow } from "./open-hours.js";
import { buildVenueSyncPlan } from "./sync-venues.js";

const VENUES = [
  { id: 1, name: "Alcobendas Principal", capacity: 290, bias: 0.82 },
  { id: 2, name: "Las Rozas Principal",  capacity: 489, bias: 0.70 },
  { id: 3, name: "Berango Principal",    capacity: 290, bias: 0.75 },
  { id: 4, name: "Legazpi Principal",    capacity: 495, bias: 0.88 },
  { id: 5, name: "Chamberí Principal",   capacity: 292, bias: 0.92 },
  { id: 6, name: "Guindalera Principal", capacity: 246, bias: 1.00 },
];

// Fallback window for any venue without a configured schedule, so the seeder
// still produces data if VENUES and open-hours.ts drift apart.
const FALLBACK_WINDOW: OpenWindow = { openMin: 7 * 60, closeMin: 23 * 60 };
const BATCH_SIZE = 500;

// Defaults reproduce the original ~90-day, 1-minute local dataset. Override via
// env to generate a smaller fixture (e.g. the committed Vercel-preview DB):
//   SEED_OUT          output libsql URL          (default file:../dev.db)
//   SEED_DAYS         days of history            (default 90)
//   SEED_INTERVAL_MIN minutes between readings   (default 1, matches the Pi's 60s cadence)
const OUT = process.env.SEED_OUT ?? "file:../dev.db";
const DAYS = positiveInt("SEED_DAYS", 90);
const INTERVAL_MIN = positiveInt("SEED_INTERVAL_MIN", 1);

// Mirror scraper/src/db.ts: local file:/:memory: URLs ignore the token, but a
// remote URL needs one — fail fast rather than surfacing a confusing 401, and
// guard against accidentally seeding (and wiping) a remote DB without credentials.
const isLocalOut = OUT.startsWith("file:") || OUT.startsWith(":memory:");
const OUT_AUTH = process.env.TURSO_AUTH_TOKEN ?? "";
if (!isLocalOut && !OUT_AUTH) {
  throw new Error(`TURSO_AUTH_TOKEN is required for a remote SEED_OUT URL (${OUT.split(":")[0]}://…)`);
}

// Parse a positive-integer env override; reject 0/NaN/negatives so a typo can't
// silently produce an empty dataset (or, for the interval, an infinite loop).
function positiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${name} must be a positive integer, got ${JSON.stringify(raw)}`);
  }
  return n;
}

// Approximate Madrid UTC offset (DST: +2 Apr–Oct, +1 otherwise)
function madridOffsetHours(month: number): number {
  return month >= 4 && month <= 10 ? 2 : 1;
}

function toUTC(year: number, month: number, day: number, hour: number, min: number): string {
  const utcHour = hour - madridOffsetHours(month);
  return new Date(Date.UTC(year, month - 1, day, utcHour, min)).toISOString();
}

// Base target occupancy % given day-of-week (0=Sun) and Madrid time
function baseOccupancy(dow: number, hour: number, min: number): number {
  const isWeekend = dow === 0 || dow === 6;
  const t = hour + min / 60;

  if (isWeekend) {
    if (t < 9)    return 8;
    if (t < 10)   return 8 + (t - 9) * 32;          // 8 → 40
    if (t < 12.5) return 40 + (t - 10) * 14;         // 40 → 75
    if (t < 14)   return 75;                          // peak
    if (t < 16)   return 75 - (t - 14) * 15;         // 75 → 45
    if (t < 19)   return 45 - (t - 16) * 8;          // 45 → 21
    if (t < 21)   return 21;
    return 12;
  } else {
    if (t < 8.5)  return 12;
    if (t < 9.5)  return 12 + (t - 8.5) * 10;       // 12 → 22
    if (t < 13)   return 22 + (t - 9.5) * 4;         // 22 → 36
    if (t < 14)   return 36 + (t - 13) * 24;         // 36 → 60  lunch peak
    if (t < 15)   return 60 - (t - 14) * 28;         // 60 → 32  post-lunch
    if (t < 17.5) return 32 - (t - 15) * 4;          // 32 → 22
    if (t < 19.5) return 22 + (t - 17.5) * 29;       // 22 → 80  evening ramp
    if (t < 21)   return 80;                          // evening peak
    if (t < 22.5) return 80 - (t - 21) * 40;         // 80 → 20  taper
    return 15;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// Cheap deterministic PRNG (LCG) seeded per day+venue
function makePrng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s, 1664525) + 1013904223;
    return (s >>> 0) / 0xffffffff;
  };
}

async function main() {
  const mockNow = process.env.MOCK_NOW;
  const now = mockNow ? new Date(mockNow) : new Date();

  const db = createClient({ url: OUT, authToken: OUT_AUTH });

  await db.execute(`
    CREATE TABLE IF NOT EXISTS readings (
      id         TEXT    PRIMARY KEY,
      timestamp  TEXT    NOT NULL,
      venue_id   INTEGER NOT NULL,
      venue_name TEXT    NOT NULL,
      occupancy  INTEGER,
      entries    INTEGER,
      exits      INTEGER,
      capacity   INTEGER
    )
  `);
  await db.execute("DELETE FROM readings");

  // Mirror migrate.ts so the dashboard's venue + hours queries work against the
  // local/preview fixture too.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS venues (
      venue_id   INTEGER PRIMARY KEY,
      name       TEXT    NOT NULL,
      capacity   INTEGER,
      updated_at TEXT
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS venue_hours (
      venue_id  INTEGER NOT NULL,
      dow       INTEGER NOT NULL,
      open_min  INTEGER NOT NULL,
      close_min INTEGER NOT NULL,
      PRIMARY KEY (venue_id, dow)
    )
  `);
  await db.execute("DELETE FROM venues");
  await db.execute("DELETE FROM venue_hours");

  // DAYS days ending *today* (inclusive): the last iteration lands on `now`'s
  // date, generated partially up to the current time; earlier days are full.
  const startMs = now.getTime() - (DAYS - 1) * 24 * 60 * 60 * 1000;

  let pending: Parameters<typeof db.batch>[0] = [];
  let total = 0;

  const flush = async () => {
    if (pending.length === 0) return;
    await db.batch(pending, "write");
    total += pending.length;
    process.stdout.write(`\r  ${total.toLocaleString()} rows inserted...`);
    pending = [];
  };

  for (let d = 0; d < DAYS; d++) {
    const date = new Date(startMs + d * 86_400_000);
    const year  = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day   = date.getUTCDate();
    const dow   = date.getUTCDay();

    // Compute today's cutoff as a Madrid minute-of-day (to stop generating
    // future data); past days run to each venue's own closing time. Match on the
    // actual UTC date rather than the loop index so the cutoff tracks `now`.
    const isToday =
      year === now.getUTCFullYear() && month === now.getUTCMonth() + 1 && day === now.getUTCDate();
    // Clamp to 23:xx: near midnight UTC the +1/+2 offset can push the Madrid
    // hour to 24+, which would let the cutoff exceed the day and emit "future"
    // readings for the last day.
    const nowMadridHour = Math.min(23, now.getUTCHours() + madridOffsetHours(now.getUTCMonth() + 1));
    const nowMadridMin  = now.getUTCMinutes();
    const cutoffMinute  = isToday ? nowMadridHour * 60 + nowMadridMin : Number.POSITIVE_INFINITY;

    const prng = makePrng(year * 10000 + month * 100 + day);
    const dayFactor = 0.82 + prng() * 0.36; // ±18% daily variation

    for (const venue of VENUES) {
      const venuePrng = makePrng(venue.id * 99991 + d * 7);
      let currentPct = 0;
      let prevOcc = 0;
      let dailyEntries = 0;
      let dailyExits = 0;

      // Generate readings only within this venue's open window for the day —
      // mirrors the scraper, which collects only while a venue is open.
      const win = windowForVenue(venue.name, dow) ?? FALLBACK_WINDOW;

      for (let minute = win.openMin; minute < win.closeMin; minute += INTERVAL_MIN) {
        if (minute >= cutoffMinute) break; // stop at today's current time
        const h = Math.floor(minute / 60);
        const m = minute % 60;

        const target = baseOccupancy(dow, h, m) * venue.bias * dayFactor;
        const noise  = (venuePrng() - 0.5) * 10;
        currentPct   = clamp(currentPct + (target - currentPct) * 0.3 + noise, 0, 100);
        const occ    = Math.round((currentPct / 100) * venue.capacity);

        // Cumulative entries/exits
        const churn = Math.round(occ * 0.03 * venuePrng());
        const delta = occ - prevOcc;
        if (delta > 0) dailyEntries += delta + churn;
        else           dailyExits   += -delta + churn;

        prevOcc = occ;

        pending.push({
          sql: `INSERT INTO readings
                  (id, timestamp, venue_id, venue_name, occupancy, entries, exits, capacity)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            randomUUID(),
            toUTC(year, month, day, h, m),
            venue.id, venue.name,
            occ, dailyEntries, dailyExits, venue.capacity,
          ],
        });

        if (pending.length >= BATCH_SIZE) await flush();
      }
    }
  }

  await flush();

  // Populate the venue master + hours tables from the same config the scraper
  // uses, reusing the production sync logic.
  const plan = buildVenueSyncPlan(
    VENUES.map((v) => ({ venueId: v.id, name: v.name, capacity: v.capacity })),
    now.toISOString(),
  );
  await db.batch(
    [
      ...plan.venues.map((v) => ({
        sql: `INSERT INTO venues (venue_id, name, capacity, updated_at) VALUES (?, ?, ?, ?)`,
        args: [v.venueId, v.name, v.capacity, v.updatedAt],
      })),
      ...plan.hours.map((h) => ({
        sql: `INSERT INTO venue_hours (venue_id, dow, open_min, close_min) VALUES (?, ?, ?, ?)`,
        args: [h.venueId, h.dow, h.openMin, h.closeMin],
      })),
    ],
    "write",
  );

  console.log(`\n  Done — ${total.toLocaleString()} rows in ${OUT}`);
  console.log(`  Covers ${DAYS} days, ${VENUES.length} venues, ${INTERVAL_MIN}-min intervals (per-venue open hours, Madrid time)`);
  console.log(`  Seeded ${plan.venues.length} venues + ${plan.hours.length} venue_hours rows`);
}

main().catch((err) => { console.error(err); process.exit(1); });
