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
1. `GET` the gym page → extract CSRF token + session cookie
2. `POST` to the occupancy endpoint
3. Map Spanish API fields to English on ingest
4. Generate a UUID per venue per reading
5. Bulk insert all venue rows into Turso via `@libsql/client`

Scheduled on the Raspberry Pi (cron or systemd timer) to run `pnpm scrape` every 60 seconds.

### Phase 3 — Dashboard
Next.js App Router with server components reading from Turso directly.

**Charts:**
- Heatmap — day of week × hour, colored by average occupancy % (core "best time to go" view)
- Line chart — occupancy over a selected date range, one line per selected venue
- Bar chart — average occupancy by hour of day
- Bar chart — average occupancy by day of week
- Live view — latest reading per venue (current status)

**Filters:**
- Venue selector (single or multi, with comparison mode)
- Date range picker
- Day-of-week toggle
- Time range slider

### Phase 4 — Deploy
- Pull the repo onto the Raspberry Pi → cron/systemd runs the scraper every 60s
- Connect repo to Vercel → dashboard live

---

## Out of scope (for now)
- AI-generated insight summary via Claude API — easy to add once data accumulates
- Occupancy drop alerts
