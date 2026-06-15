# Agent onboarding — Sputnik Crowd Tracker

Paste this as the opening context when starting a new AI agent to build a feature or improvement in this repo.

---

You are working on **Sputnik Crowd Tracker**, a personal side project that tracks how busy the Sputnik Climbing gym venues are over time and visualizes it in a dashboard.

## What the project does

A scraper polls the gym's public occupancy API every 60 seconds and stores one row per venue per reading in a database. A Next.js dashboard reads that accumulated history and renders charts (heatmap, time series, hourly/daily averages, live status) so a user can tell the best and worst times to visit each venue.

## Architecture (3 parts, pnpm monorepo)

1. **`scraper/`** — a `tsx` CLI. `src/index.ts` fetches the gym page for a CSRF token + cookie, POSTs to the occupancy endpoint, maps the **Spanish API fields to English** in `src/transform.ts`, and batch-inserts into the DB. Runs on a Raspberry Pi via cron/systemd every 60s (not in the cloud — the gym server blocks datacenter IPs). `seed-dev.ts` generates ~90 days of realistic mock data for local dev.
2. **Database** — Turso (LibSQL/SQLite). Single table `readings(id, timestamp, venue_id, venue_name, occupancy, entries, exits, capacity)`. Derived metrics (e.g. occupancy %) are computed in SQL, not stored.
3. **`dashboard/`** — Next.js 16 App Router, React 19. Server components in `src/components/sections/` fetch data via `src/lib/cached-queries.ts` (which wrap `src/lib/queries.ts` in `unstable_cache`). There is **no API route** — server components query Turso directly. Minimal client components handle interactivity (venue selector, theme toggle, unit toggle, 60s auto-refresh).

## Conventions you MUST follow

- **English everywhere in code** — identifiers, variables, comments, table/column names are all English, even though the domain (gym, venues) is Spanish. The only Spanish that belongs in code: (a) mapping the Spanish API field names on ingest in `transform.ts`, and (b) user-facing UI labels (day/hour names live in `lib/labels.ts`).
- **TypeScript strict mode, no `any`.** The scraper also uses `noUncheckedIndexedAccess`.
- **Timestamps are UTC in the DB.** Always convert to `Europe/Madrid` at query time using the existing DST-aware helper (`madridOffsetModifier()` in `queries.ts`). Do not store local time.
- **Keep Turso reads low** — that's why queries are cached with staggered revalidation (live: 60s, aggregates: 300s, venues: 3600s). New data-fetching should go through `cached-queries.ts`, not raw `queries.ts`, in components.
- **This is NOT the Next.js in your training data.** Next.js 16 has breaking API changes. Before writing dashboard code, read the relevant guide under `dashboard/node_modules/next/dist/docs/` and heed deprecation notices (this is the standing instruction in `dashboard/AGENTS.md`).
- **Prefer server components**; reach for client components only when interactivity genuinely requires it.

## Local development

```bash
pnpm install
pnpm seed-dev                 # generate ~90 days mock data into ./dev.db
cd dashboard && pnpm dev:mock # run dashboard against the local SQLite file
pnpm test                     # Vitest across both packages
```

`dev:mock` sets `TURSO_URL=file:../dev.db`, so you don't need real Turso credentials to develop the dashboard. Use `MOCK_NOW=<ISO timestamp>` to freeze "now" for reproducible views/tests.

## Files worth reading first

- `scraper/src/index.ts` and `transform.ts` — ingestion + the Spanish→English mapping.
- `dashboard/src/lib/queries.ts` — all SQL, the timezone handling, the metric definitions.
- `dashboard/src/lib/cached-queries.ts` — caching layer.
- `dashboard/src/app/page.tsx` — how sections and search params (`?venue=`, `?unit=`) compose the dashboard.
- `PLAN.md` — original design intent. **Caveat:** parts are aspirational (the GitHub Actions cron and an `api/readings/` route were never built). Trust the code over the plan.

## Working agreement

- **Git:** work on a branch per task (`type/kebab-desc`), make logical commits, then push and open a PR at the end — never commit to `main` or merge the PR yourself. See `CLAUDE.md` → "Git workflow" for the full flow.
- **The task isn't done until CI is green.** After opening the PR, watch its checks (`gh pr checks <n> --watch`); if a check fails, read the logs (`gh run view <run-id> --log-failed`), fix it, and push until everything passes. CI builds against an empty DB and a clean install, so a green local run doesn't guarantee a green CI run.
- When you add a query, add it to `queries.ts`, write a Vitest test for it, and expose it through `cached-queries.ts` with an appropriate revalidation window.
- Match the surrounding code's style and altitude.
- Mention any new env vars and update `README.md` if you change setup, scripts, or env.

**Now, here's what I'd like you to build:** <describe the feature/improvement>
