import { createDbClient } from "./db.js";
import { toReadings, type Reading } from "./transform.js";
import { madridMoment, anyVenueOpenAt, isVenueOpenAt } from "./open-hours.js";

const GYM_URL = "https://sputnikclimbing.deporsite.net/aforo-guindalera";
const OCCUPANCY_API_URL =
  "https://sputnikclimbing.deporsite.net/ajax/TInnova_v2/Listado_OcupacionAforo/llamadaAjax/obtenerOcupacion";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const BROWSER_HEADERS = {
  "User-Agent": USER_AGENT,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

async function fetchCsrfToken(): Promise<{ csrf: string; cookie: string }> {
  const response = await fetch(GYM_URL, {
    headers: BROWSER_HEADERS,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "(unreadable)");
    console.error("Response headers:", Object.fromEntries(response.headers));
    console.error("Response body (first 500 chars):", body.slice(0, 500));
    throw new Error(`Failed to fetch gym page: ${response.status}`);
  }

  const html = await response.text();
  const match = html.match(/csrf-token" content="([^"]+)"/);
  if (!match?.[1]) {
    throw new Error("CSRF token not found in page");
  }

  // getSetCookie() returns all cookies as an array; extract name=value pairs only
  const cookies = response.headers.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""];
  const cookie = cookies
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");

  return { csrf: match[1], cookie };
}

interface ApiVenue {
  IdRecinto: number;
  Recinto: string;
  Ocupacion: number;
  Entradas: number;
  Salidas: number;
  Aforo: number;
}

async function fetchOccupancy(csrf: string, cookie: string): Promise<ApiVenue[]> {
  const response = await fetch(OCCUPANCY_API_URL, {
    method: "POST",
    headers: {
      ...BROWSER_HEADERS,
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "*/*",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
      "X-CSRF-TOKEN": csrf,
      "X-Requested-With": "XMLHttpRequest",
      "Referer": GYM_URL,
      "Cookie": cookie,
    },
  });

  if (!response.ok) {
    throw new Error(`Occupancy API returned ${response.status}`);
  }

  return response.json() as Promise<ApiVenue[]>;
}


async function insertReadings(readings: Reading[]): Promise<void> {
  const client = createDbClient();

  await client.batch(
    readings.map((r) => ({
      sql: `INSERT INTO readings (id, timestamp, venue_id, venue_name, occupancy, entries, exits, capacity)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [r.id, r.timestamp, r.venueId, r.venueName, r.occupancy, r.entries, r.exits, r.capacity],
    })),
    "write"
  );

  console.log(`Inserted ${readings.length} readings at ${readings[0]?.timestamp}`);
}

/** Format a Madrid minute-of-day as "HH:MM" for log messages. */
function formatMinute(minuteOfDay: number): string {
  const hh = String(Math.floor(minuteOfDay / 60)).padStart(2, "0");
  const mm = String(minuteOfDay % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

async function run(): Promise<void> {
  const now = new Date();
  const moment = madridMoment(now);

  // Skip the whole cycle when every venue is closed — no fetch, no write. This
  // is where the bulk of the overnight read/write savings come from.
  if (!anyVenueOpenAt(moment)) {
    console.log(`All venues closed at Madrid ${formatMinute(moment.minuteOfDay)} (dow ${moment.dow}) — skipping scrape.`);
    return;
  }

  const timestamp = now.toISOString();
  const { csrf, cookie } = await fetchCsrfToken();
  const venues = await fetchOccupancy(csrf, cookie);

  // Some venues open later / close earlier than others, so drop readings for
  // venues that are individually closed right now even when others are open.
  const readings = toReadings(venues, timestamp).filter((r) => isVenueOpenAt(r.venueName, moment));
  if (readings.length === 0) {
    console.log(`No venues open at Madrid ${formatMinute(moment.minuteOfDay)} — nothing to insert.`);
    return;
  }

  await insertReadings(readings);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
