# Task D — Dashboard filters

> Read `CLAUDE.md` + `AGENT_ONBOARDING.md` first. This brief adds task-specific context only.

## Goal

Add the filters `PLAN.md` always intended but were never built: a **date-range picker**, a
**day-of-week toggle**, and a **time-of-day range**. Today the only controls are the venue
selector and the percentage/absolute unit toggle, and the time series is a fixed 30-day window.

## Current state — how the dashboard is wired

`dashboard/src/app/page.tsx` is an async server component. State lives in the **URL search
params** (`?venue=&unit=`), parsed at the top of the page and passed down. This is the pattern
to extend — add filters as more search params, keep everything server-rendered.

- **Sections** (`dashboard/src/components/sections/`): `HeatmapSection`, `TimeSeriesSection`,
  `HourlySection`, `DailySection` — each server component fetches via `cached-queries.ts` and
  renders a client chart.
- **Queries** (`dashboard/src/lib/queries.ts`): `getHeatmap(venueIds)`,
  `getHourlyAverages(venueIds)`, `getDailyAverages(venueIds)` aggregate over **all** history;
  `getTimeSeries(venueId, from, to)` already takes a range (page currently hardcodes 30 days,
  see `thirtyDaysAgo` in `page.tsx`). UTC→Madrid conversion via `madridOffsetModifier()`.
- **Caching** (`dashboard/src/lib/cached-queries.ts`): `unstable_cache` wrappers. **Cache keys
  are the function args** — any new filter param must be passed as an argument so it varies the
  cache key (see how `getCachedTodayVisitorCounts` takes `nowIso`).
- **Client controls** to mirror: `UnitToggle.tsx` (writes `?unit=` and `router.push`),
  `LiveCards.tsx` (venue selection). New controls follow the same shape: a `"use client"`
  component that updates a search param.
- **UI kit**: Tailwind 4 + shadcn/Base UI (`components/ui/`), `lucide-react` icons. **User-facing
  text is Spanish**; day/hour labels live in `dashboard/src/lib/labels.ts`. Code identifiers stay
  English.

## Approach

1. **Define the params** (e.g. `from`, `to`, `days` (a `dow` bitmask/list), `hourFrom`, `hourTo`)
   and parse/validate them in `page.tsx` with sane defaults (current behavior = no filter).
2. **Thread them into the queries** — add optional filter args to `getHeatmap` / `getHourlyAverages`
   / `getDailyAverages` / `getTimeSeries`: a `timestamp` range (`WHERE timestamp BETWEEN …`), a
   day-of-week `IN (…)` on the Madrid-converted `%w`, and an hour range (extend the existing
   `HAVING hour >= 7`). Keep the Madrid/DST handling.
3. **Update the cached wrappers** so the new args are part of the cache key.
4. **Build the controls** as client components (date-range picker, a 7-button day-of-week toggle,
   a time-of-day range/slider), wired to search params like `UnitToggle`. Spanish labels.
5. Apply consistently across the relevant charts (heatmap/hourly/daily honor dow + hour + date
   range; time series honors date range).

## Coordination with the other task (B)

Task B replaces the all-history aggregate scans with a precomputed **(venue, date, hour)** rollup.
Your **date-range** and **day-of-week** and **hour** filters must work against whatever B lands —
the rollup is intentionally kept at date+hour granularity so range/dow/hour filtering is still
possible (dow derives from `date`). If B lands first, add your filters on top of the rollup-backed
queries; if you land first, design the query args so B can swap the data source underneath without
changing the signatures. Both tasks edit `queries.ts` / `cached-queries.ts` — expect a merge
touchpoint, and prefer landing B first if you can.

## Acceptance criteria

- Each filter changes the charts and is reflected in the URL (shareable/bookmarkable), default
  state matches today's behavior.
- Server-component + search-param pattern preserved (no client-side data fetching).
- New query args flow through `cached-queries.ts` so cache keys stay correct.
- Spanish UI labels; English code.
- Tests for any new/changed query logic (mock `db`, follow `queries.test.ts`).
- `pnpm -r run typecheck`, tests, lint, and the dashboard build all pass (CI gates).

## Gotchas

- **Cache-key explosion**: more filter combinations = more cache entries = more cold misses (each
  a full scan until Task B lands). Be mindful; this is the main argument for doing B first.
- All timestamps are UTC; day-of-week and hour must be computed on the **Madrid-converted** value
  (`madridOffsetModifier`), consistent with the existing queries.
- `OPENING_HOUR = 7` is currently a hard `HAVING hour >= 7`; a time-of-day filter should layer on
  top sensibly (don't silently override it).
- Keep `?venue=`/`?unit=` working; add params, don't replace the scheme.
- This is **Next.js 16** — read the relevant guide under `dashboard/node_modules/next/dist/docs/`
  before touching routing/`searchParams` (see `dashboard/AGENTS.md`).
