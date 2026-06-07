import { createClient } from "@libsql/client";

const GYM_URL = "https://sputnikclimbing.deporsite.net/aforo-guindalera";
const OCCUPANCY_API_URL =
  "https://sputnikclimbing.deporsite.net/ajax/TInnova_v2/Listado_OcupacionAforo/llamadaAjax/obtenerOcupacion";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

interface ApiVenue {
  IdRecinto: number;
  Recinto: string;
  Ocupacion: number;
  Entradas: number;
  Salidas: number;
  Aforo: number;
}

interface Reading {
  id: string;
  timestamp: string;
  venueId: number;
  venueName: string;
  occupancy: number;
  entries: number;
  exits: number;
  capacity: number;
}

async function fetchCsrfToken(): Promise<{ csrf: string; cookie: string }> {
  const response = await fetch(GYM_URL, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch gym page: ${response.status}`);
  }

  const html = await response.text();
  const match = html.match(/csrf-token" content="([^"]+)"/);
  if (!match?.[1]) {
    throw new Error("CSRF token not found in page");
  }

  const cookie = response.headers.get("set-cookie") ?? "";
  return { csrf: match[1], cookie };
}

async function fetchOccupancy(csrf: string, cookie: string): Promise<ApiVenue[]> {
  const response = await fetch(OCCUPANCY_API_URL, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded",
      "X-CSRF-TOKEN": csrf,
      "X-Requested-With": "XMLHttpRequest",
      Referer: GYM_URL,
      Cookie: cookie,
    },
  });

  if (!response.ok) {
    throw new Error(`Occupancy API returned ${response.status}`);
  }

  return response.json() as Promise<ApiVenue[]>;
}

function toReadings(venues: ApiVenue[], timestamp: string): Reading[] {
  return venues
    .filter((v) => v.Aforo > 0)
    .map((v) => ({
      id: crypto.randomUUID(),
      timestamp,
      venueId: v.IdRecinto,
      venueName: v.Recinto,
      occupancy: v.Ocupacion,
      entries: v.Entradas,
      exits: v.Salidas,
      capacity: v.Aforo,
    }));
}

async function insertReadings(readings: Reading[]): Promise<void> {
  const client = createClient({
    url: process.env["TURSO_URL"] ?? "",
    authToken: process.env["TURSO_AUTH_TOKEN"] ?? "",
  });

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

async function run(): Promise<void> {
  const timestamp = new Date().toISOString();
  const { csrf, cookie } = await fetchCsrfToken();
  const venues = await fetchOccupancy(csrf, cookie);
  const readings = toReadings(venues, timestamp);
  await insertReadings(readings);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
