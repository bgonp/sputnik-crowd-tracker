# Sputnik Crowd Tracker

Scrapes occupancy data every 60 seconds from the [Sputnik Climbing](https://sputnikclimbing.deporsite.net) gym network, stores it over time in a SQLite/Turso database, and presents a dashboard with charts to find the best (and worst) times to visit.

The dataset is built incrementally — every reading is a snapshot of how full each venue is. With enough history, the dashboard surfaces patterns: which hours are quiet, which days are packed, and how busy a venue is *right now* versus its typical level.

## How it works

```
┌────────────┐   every 60 sec   ┌─────────────┐   server queries   ┌──────────────┐
│  scraper   │ ───────────────► │  Turso DB   │ ◄───────────────── │  dashboard   │
│  (tsx CLI, │  fetch + insert  │  (readings) │   cached reads     │  (Next.js,   │
│  on a Pi)  │                  │             │                    │  on Vercel)  │
└────────────┘                  └─────────────┘                    └──────────────┘
```

1. **Scraper** — fetches the gym page to extract a CSRF token + session cookie, POSTs to the occupancy API, maps the Spanish API fields to English, generates a UUID per reading, and batch-inserts one row per venue into Turso.
2. **Database** — a single `readings` table; every metric (e.g. occupancy percentage) is derived on query.
3. **Dashboard** — a Next.js App Router app whose server components query Turso directly (no API layer), with `unstable_cache` wrappers to keep Turso reads low.

## Tech stack

| Concern           | Choice                                              |
| ----------------- | --------------------------------------------------- |
| Language          | TypeScript throughout                               |
| Monorepo          | pnpm workspaces (`scraper` + `dashboard`)           |
| Scraper runtime   | `tsx` CLI on a Raspberry Pi, cron every 60s         |
| Database          | Turso (LibSQL/SQLite) via `@libsql/client`          |
| Dashboard         | Next.js 16 App Router, React 19, server components  |
| UI                | Tailwind CSS 4, shadcn/ui + Base UI, lucide-react   |
| Charts            | Recharts 3                                          |
| Theming           | next-themes (dark/light)                            |
| Tests             | Vitest                                              |
| Dashboard hosting | Vercel                                              |
| Analytics         | Vercel Web Analytics (`@vercel/analytics`)          |

## Repository layout

```
sputnik-crowd-tracker/
├── scraper/                  # data ingestion package
│   └── src/
│       ├── index.ts          # entry: fetch → transform → insert
│       ├── db.ts             # Turso client factory (URL-aware token validation)
│       ├── transform.ts      # Spanish API → English Reading mapping
│       ├── migrate.ts        # CREATE TABLE + indexes (readings, venues, venue_hours)
│       ├── open-hours.ts     # per-venue opening-hours config + "open now?" helpers
│       ├── sync-venues.ts    # CLI: populate venues + venue_hours from readings + config
│       ├── seed-dev.ts       # generates ~90 days of realistic mock data
│       ├── freshness.ts      # pure staleness evaluation
│       ├── check-freshness.ts # CLI: alert if no recent readings (freshness monitor)
│       └── __tests__/
├── dashboard/                # Next.js dashboard package
│   └── src/
│       ├── app/
│       │   ├── layout.tsx          # root layout + ThemeProvider
│       │   └── [[...venue]]/
│       │       └── page.tsx        # all-venues overview at / and per-venue dashboard at /<venue-slug>
│       ├── components/
│       │   ├── ui/            # shadcn/Base UI primitives
│       │   ├── sections/      # server components that fetch + render
│       │   └── *.tsx          # charts + client interactivity
│       └── lib/
│           ├── db.ts          # Turso client singleton
│           ├── queries.ts     # SQL queries (Madrid-timezone aware)
│           ├── cached-queries.ts  # unstable_cache wrappers
│           ├── open-status.ts # "open now? / next opening" from venue_hours
│           ├── today-vs-typical.ts # same-weekday baseline date math + chart series
│           ├── venues.ts      # venue name → URL slug helpers
│           └── labels.ts      # Spanish day/hour labels
├── PLAN.md                   # original project plan (some parts aspirational)
└── pnpm-workspace.yaml
```

## Database schema

The `readings` table holds the time series — derived metrics like occupancy
percentage are computed on demand. Two small companion tables back the venue
list and opening-hours features.

```sql
CREATE TABLE readings (
  id          TEXT    PRIMARY KEY,  -- UUID v4, generated in the scraper
  timestamp   TEXT    NOT NULL,     -- ISO 8601, UTC
  venue_id    INTEGER NOT NULL,
  venue_name  TEXT    NOT NULL,
  occupancy   INTEGER,              -- current head count
  entries     INTEGER,              -- cumulative daily counter
  exits       INTEGER,              -- cumulative daily counter
  capacity    INTEGER
);

CREATE INDEX idx_readings_venue_ts ON readings (venue_id, timestamp);

CREATE TABLE venues (              -- venue master: identity + last-seen capacity
  venue_id   INTEGER PRIMARY KEY,
  name       TEXT    NOT NULL,
  capacity   INTEGER,
  updated_at TEXT
);

CREATE TABLE venue_hours (         -- per-venue opening hours, Madrid local time
  venue_id  INTEGER NOT NULL,
  dow       INTEGER NOT NULL,      -- 0 = Sunday … 6 = Saturday
  open_min  INTEGER NOT NULL,      -- minutes from local midnight
  close_min INTEGER NOT NULL,
  PRIMARY KEY (venue_id, dow)
);
```

`venues` and `venue_hours` are populated by `pnpm --filter scraper sync-venues`,
which reads the venues actually seen in `readings` (so the `venue_id`↔name
mapping comes from real data) and joins them to the hours config in
`scraper/src/open-hours.ts`. It's a DB-only job — no gym API call — so run it once
after migrating and again whenever the set of venues changes. The dashboard reads
these tables to list venues cheaply and to show "Cerrado / Abre a las HH:MM"
instead of a stale reading when a venue is shut; if they're empty or not migrated
yet it falls back gracefully (venue list from `readings`, every venue open).

Timestamps are stored in **UTC**; the dashboard converts to **Europe/Madrid** at query time (DST-aware, see `madridOffsetModifier()` in `queries.ts`).

## Getting started

Requires Node.js and pnpm.

```bash
pnpm install
```

### Run the dashboard against local mock data (no Turso needed)

```bash
# 1. Seed ~90 days of realistic mock data into a local SQLite file (dev.db)
pnpm seed-dev

# 2. Start the dashboard pointed at the local file
cd dashboard && pnpm dev:mock
# → http://localhost:3000
```

`dev:mock` sets `TURSO_URL=file:../dev.db` so the app reads the local SQLite file instead of remote Turso.

### Run the scraper once (against the real gym API)

Copy `scraper/.env.example` to `scraper/.env` and fill in your Turso credentials
(use a **read-write** token — the scraper is the only writer). The scraper scripts
load this file automatically (`--env-file-if-exists=.env`), falling back to the
ambient environment when it's absent (as on the Pi and in CI).

```bash
pnpm scrape   # one fetch + insert cycle
```

### Tests

```bash
pnpm test            # runs Vitest across both packages
pnpm test:coverage   # same, plus a coverage report (text + HTML in coverage/)
```

Both packages use Vitest. Dashboard React components are tested with
[React Testing Library](https://testing-library.com/) on
[happy-dom](https://github.com/capricorn86/happy-dom) (configured in
`dashboard/vitest.config.ts` + `dashboard/vitest.setup.ts`); queries and pure
helpers are plain unit tests. New functionality should ship with a test.

Coverage is **report-only** — there are no thresholds and it never fails CI; it's
a visibility signal, not a gate. CI prints the summary in the job log on every PR.
Vendored UI primitives, static/edge files, and dev tooling are excluded; the
remaining numbers reflect our own logic, so a drop flags newly-untested code.
Deliberately-uncovered surfaces (Recharts charts, async server `sections/`, the
scraper's network/DB entry points) show as low and are expected.

## Continuous integration

`.github/workflows/ci.yml` runs on every pull request (and on pushes to `main`):
it installs dependencies, runs the Vitest suites (printing a report-only coverage
summary), lints the dashboard, type-checks both packages (`tsc --noEmit`), and builds it. Open a PR per change and let CI go
green before merging — test, lint, typecheck, and build are all required to pass.
(`tsc` matters because the scraper runs under `tsx`, which skips type checking.)

## Environment variables

| Variable                      | Used by             | Notes                                                              |
| ----------------------------- | ------------------- | ------------------------------------------------------------------ |
| `TURSO_URL`                   | scraper + dashboard | `libsql://…` for remote, or a `file:` URL for local mock / previews (`file:../dev.db` local, `file:preview.db` on Vercel previews) |
| `TURSO_AUTH_TOKEN`            | scraper + dashboard | **read-write** for the scraper, **read-only** for the dashboard; for a local `file:` URL the value is ignored, but set it empty (`TURSO_AUTH_TOKEN=`) rather than omitting it |
| `MOCK_NOW`                    | dashboard / seed    | ISO timestamp to freeze "now" for reproducible views/tests         |
| `SEED_OUT` / `SEED_DAYS` / `SEED_INTERVAL_MIN` | seed | Override the seed script's output URL, days of history, and reading interval (defaults: `file:../dev.db`, 90, 1). `pnpm seed-preview` sets these to build the trimmed `dashboard/preview.db` fixture |
| `NEXT_PUBLIC_SITE_URL`        | dashboard           | Public base URL for canonical links, Open Graph, sitemap & robots; falls back to Vercel's production URL, then `http://localhost:3000` |
| `FRESHNESS_THRESHOLD_MINUTES` | scraper             | Staleness threshold for `check-freshness` (default 15)             |

Each package keeps its own git-ignored env file — `scraper/.env` and
`dashboard/.env.local` (templates: `scraper/.env.example`, `dashboard/.env.example`).
The `TURSO_URL` is the same in both; the tokens differ by privilege.

**Least privilege:** the scraper is the only writer, so give it a **read-write**
token; the dashboard and the freshness monitor only read, so use a **read-only**
token there (`turso db tokens create <db> --read-only`). In production these come
from the host environment, not the files above: Vercel env (dashboard, read-only),
the Pi's service environment (scraper, read-write), and the `TURSO_AUTH_TOKEN` repo
secret (freshness Action, read-only).

## Deployment

- **Schema** → run `pnpm --filter scraper migrate` once against Turso to create the tables, then `pnpm --filter scraper sync-venues` to populate `venues` + `venue_hours` (and re-run `sync-venues` whenever the set of venues changes). The dashboard degrades gracefully if `sync-venues` hasn't run yet.
- **Dashboard** → Vercel (connect the repo; set `TURSO_URL` + `TURSO_AUTH_TOKEN` env vars).
- **Scraper** → runs on a **Raspberry Pi**, scheduled by cron/systemd to run `pnpm scrape` every 60 seconds, writing to Turso. It only collects while venues are open (hours in `scraper/src/open-hours.ts`): when every venue is closed it skips the cycle entirely, and otherwise inserts only the venues currently open. This cuts overnight writes and keeps the readings table smaller. The cron still fires every 60s — the gate is a cheap early-exit, so no schedule change is needed on the Pi.
- **Visitor analytics** → [Vercel Web Analytics](https://vercel.com/docs/analytics) is wired in via the `<Analytics />` component in `dashboard/src/app/layout.tsx`. It's cookieless (no consent banner required) and needs no env vars — just enable Web Analytics for the project in the Vercel dashboard.

### Preview deployments (don't spend Turso reads)

Vercel builds a preview for every PR. To keep those previews from querying production
Turso (and burning read quota), point them at a committed SQLite fixture instead:

1. A trimmed mock DB lives at `dashboard/preview.db` (14 days, 6 venues, 5-min
   readings). Regenerate it with `pnpm seed-preview` and commit the result when you
   want fresher sample data.
2. In the Vercel project, set **Preview**-scoped env vars (Settings → Environment
   Variables, or `vercel env add <name> preview`):
   - `TURSO_URL=file:preview.db`
   - `TURSO_AUTH_TOKEN=` (empty — ignored for `file:` URLs)

   Leave the **Production** values pointing at real Turso. Vercel scopes env vars per
   environment, so only previews use the fixture.

`next.config.ts` ships `preview.db` into the serverless trace
(`outputFileTracingIncludes`), and `src/lib/db.ts` resolves the relative `file:` URL
to an absolute path and copies it into the writable `/tmp` at startup (the Vercel
bundle filesystem is read-only). The live card always shows the fixture's newest
reading; "today" visitor totals may be empty if the fixture predates the request date
— set `MOCK_NOW` to the fixture's last day on Preview if you want them populated.

> **Why a Raspberry Pi and not the cloud?** The gym server blocks requests from
> datacenter IP ranges — GitHub Actions, Claude workers, and AWS all get blocked.
> Running from a residential connection on the Pi avoids that, with no rate limits
> observed. This is why the original GitHub Actions cron plan (in `PLAN.md`) was
> dropped and there is no `.github/workflows/scrape.yml`.

> Note: `PLAN.md` is the original design doc. A couple of pieces it describes (the
> GitHub Actions **scraper** cron and an `app/api/readings/` route) were never built
> — the scraper runs on the Pi, and the dashboard queries Turso directly from server
> components. (GitHub Actions *is* used, but only for CI and monitoring — see below —
> not scraping.) Treat the actual code as the source of truth.

## Monitoring

`.github/workflows/freshness.yml` runs every 15 minutes and checks how old the
newest reading in Turso is (via `pnpm --filter scraper check-freshness`). If no
reading has landed within `FRESHNESS_THRESHOLD_MINUTES` (default 15), the job
fails — which emails the repo owner — flagging that data collection has stalled
(Pi down, IP block, or the gym API changed). It only reads Turso, so it runs fine
from GitHub's runners even though scraping can't.

The check is **open-hours-aware** (it shares `scraper/src/open-hours.ts` with the
scraper): when every venue is closed it pauses staleness alerts, so the scraper's
intentional overnight pause is not flagged as a fault. That's why the cron runs
around the clock — no daytime-only window hack is needed, and the suppression is
per-venue and weekend-aware rather than a fixed time band.

Requires the `TURSO_URL` and `TURSO_AUTH_TOKEN` repo secrets (a read-only token
is sufficient — it only reads). Run it on demand from the Actions tab
(`workflow_dispatch`).

## License

See [LICENSE](./LICENSE).
