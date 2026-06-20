# Sputnik Crowd Tracker — Project Plan

## What it does

Periodically scrapes occupancy data from the Sputnik Climbing gym network, stores it over time, and presents a dashboard with charts to identify the best and worst times to visit.

---

## Data source

- **URL**: `https://sputnikclimbing.deporsite.net/aforo-guindalera`
- **Endpoint**: `POST https://sputnikclimbing.deporsite.net/ajax/TInnova_v2/Listado_OcupacionAforo/llamadaAjax/obtenerOcupacion`
- **Auth**: session cookie + CSRF token extracted from the main page (no login required)
- **Response**: JSON array with all 7 venues — occupancy, entries (cumulative daily), exits (cumulative daily), capacity
- No headless browser needed — plain HTTP requests suffice

---

## Stack

| Concern            | Choice                              |
|--------------------|-------------------------------------|
| Language           | TypeScript throughout               |
| Scraper runtime    | Raspberry Pi (local), every 60s     |
| Database           | Turso (LibSQL/SQLite)               |
| Dashboard          | Next.js App Router + shadcn/ui charts |
| Dashboard hosting  | Vercel (free)                       |

> **Why not GitHub Actions / cloud?** The original plan was a GitHub Actions cron.
> In practice the gym server blocks requests from datacenter IP ranges (GitHub
> Actions, Claude workers, AWS all get blocked). The scraper therefore runs
> locally on a Raspberry Pi on a residential connection, polling every 60 seconds.

---

## Database schema

```sql
CREATE TABLE readings (
  id          TEXT    PRIMARY KEY,  -- UUID v4, generated in TS
  timestamp   TEXT    NOT NULL,     -- ISO 8601
  venue_id    INTEGER NOT NULL,
  venue_name  TEXT    NOT NULL,
  occupancy   INTEGER,
  entries     INTEGER,              -- cumulative daily counter
  exits       INTEGER,              -- cumulative daily counter
  capacity    INTEGER
  -- percentage computed on demand: occupancy / capacity * 100
);

-- Companion tables, populated by `sync-venues` from observed readings + the
-- open-hours.ts config (the dashboard reads them for the venue list + open/closed):
CREATE TABLE venues (venue_id INTEGER PRIMARY KEY, name TEXT NOT NULL, capacity INTEGER, updated_at TEXT);
CREATE TABLE venue_hours (venue_id INTEGER, dow INTEGER, open_min INTEGER, close_min INTEGER, PRIMARY KEY (venue_id, dow));
```

---

## Project structure

```
sputnik-crowd-tracker/
├── scraper/
│   ├── index.ts          # fetch → transform → write to Turso
│   └── package.json
├── dashboard/            # Next.js app
│   ├── app/
│   │   ├── page.tsx      # main dashboard
│   │   └── api/
│   │       └── readings/ # server route querying Turso
│   └── components/
│       └── charts/
└── pnpm-workspace.yaml

# scraper is scheduled by cron/systemd on the Raspberry Pi, not in-repo
```

---

## Phases

### Phase 1 — Database setup
1. Create a free Turso account and database
2. Run the `CREATE TABLE` migration
3. Save `TURSO_URL` and `TURSO_AUTH_TOKEN` in the Raspberry Pi's `.env` and as Vercel env vars

### Phase 2 — Scraper
TypeScript script using `tsx` to run directly in Actions:
0. Skip the cycle entirely if every venue is currently closed (per-venue hours in `src/open-hours.ts`; the API exposes no hours, so they're maintained config)
1. `GET` the gym page → extract CSRF token + session cookie
2. `POST` to the occupancy endpoint
3. Map Spanish API fields to English on ingest
4. Generate a UUID per venue per reading
5. Bulk insert the rows for venues that are open right now via `@libsql/client`

Scheduled on the Raspberry Pi (cron or systemd timer) to run `pnpm scrape` every 60 seconds. Collecting only during open hours trims overnight reads/writes and keeps the `readings` table smaller.

### Phase 3 — Dashboard
Next.js App Router with server components reading from Turso directly.

**Charts:**
- Heatmap — day of week × hour, colored by average occupancy % (core "best time to go" view)
- Line chart — occupancy over a selected date range, one line per selected venue _(temporarily removed to reduce Turso reads; full-history scan was the heaviest read driver — revisit later)_
- Bar chart — average occupancy by hour of day
- Bar chart — average occupancy by day of week _(temporarily removed to reduce Turso reads — revisit later)_
- Live view — latest reading per venue (current status); shows "Cerrado / Abre a las HH:MM" from `venue_hours` when a venue is closed, instead of its last pre-close reading

**Filters:**
- Venue selector (single or multi, with comparison mode)
- Date range picker
- Day-of-week toggle
- Time range slider

### Phase 4 — Deploy
- Pull the repo onto the Raspberry Pi → cron/systemd runs the scraper every 60s
- Connect repo to Vercel → dashboard live
- Point Vercel **Preview** deployments at the committed `dashboard/preview.db` fixture (`TURSO_URL=file:preview.db`) so PR previews don't spend production Turso reads — see README → "Preview deployments"

---

## Out of scope (for now)
- AI-generated insight summary via Claude API — easy to add once data accumulates
- Occupancy drop alerts
