import { createClient } from "@libsql/client";
import { randomUUID } from "crypto";

const VENUES = [
  { id: 1, name: "Guindalera Principal", capacity: 120, bias: 1.00 },
  { id: 2, name: "Tetuán",               capacity: 90,  bias: 0.85 },
  { id: 3, name: "Moratalaz",            capacity: 80,  bias: 0.75 },
  { id: 4, name: "Legazpi",              capacity: 100, bias: 0.90 },
  { id: 5, name: "Villaverde",           capacity: 70,  bias: 0.68 },
  { id: 6, name: "Vallecas",             capacity: 75,  bias: 0.72 },
];

const OPENING_HOUR = 7;
const CLOSING_HOUR = 23;
const INTERVAL_MIN = 5;
const DAYS = 90;
const BATCH_SIZE = 500;

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

  const db = createClient({ url: "file:../dev.db" });

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

  const startMs = now.getTime() - DAYS * 24 * 60 * 60 * 1000;

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

    // Compute today's cutoff in Madrid hours (to stop generating future data)
    const isToday = d === DAYS - 1;
    const nowMadridHour = now.getUTCHours() + madridOffsetHours(now.getUTCMonth() + 1);
    const nowMadridMin  = now.getUTCMinutes();
    const cutoffHour    = isToday ? nowMadridHour : CLOSING_HOUR;
    const cutoffMin     = isToday ? nowMadridMin  : 0;

    const prng = makePrng(year * 10000 + month * 100 + day);
    const dayFactor = 0.82 + prng() * 0.36; // ±18% daily variation

    for (const venue of VENUES) {
      const venuePrng = makePrng(venue.id * 99991 + d * 7);
      let currentOcc = 0;
      let dailyEntries = 0;
      let dailyExits = 0;

      for (let h = OPENING_HOUR; h < CLOSING_HOUR; h++) {
        for (let m = 0; m < 60; m += INTERVAL_MIN) {
          // Stop at today's current time
          if (isToday && (h > cutoffHour || (h === cutoffHour && m >= cutoffMin))) break;

          const target = baseOccupancy(dow, h, m) * venue.bias * dayFactor;
          const noise  = (venuePrng() - 0.5) * 10;
          const pct    = clamp(currentOcc + (target - currentOcc) * 0.3 + noise, 0, 100);
          const occ    = Math.round((pct / 100) * venue.capacity);

          // Cumulative entries/exits
          const churn = Math.round(occ * 0.03 * venuePrng());
          const delta = occ - currentOcc;
          if (delta > 0) dailyEntries += delta + churn;
          else           dailyExits   += -delta + churn;

          currentOcc = occ;

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
  }

  await flush();
  console.log(`\n  Done — ${total.toLocaleString()} rows in dev.db`);
  console.log(`  Covers ${DAYS} days, 6 venues, 5-min intervals (${OPENING_HOUR}:00–${CLOSING_HOUR}:00 Madrid time)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
