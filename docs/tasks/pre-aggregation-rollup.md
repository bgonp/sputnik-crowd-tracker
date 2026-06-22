# Task B — Pre-aggregation rollup

> Read `CLAUDE.md` + `AGENT_ONBOARDING.md` first. This brief adds task-specific context only.

## Goal

Stop the aggregate dashboard queries from scanning **all** historical `readings` on every
cache miss. Precompute a rollup so read cost stays bounded as history grows.

## Why now

The scraper writes every 60s → ~1,440 rows/venue/day × ~6 venues ≈ **8.6k rows/day**, growing
without bound. The project memory already flagged this: *"heatmap/hourly/daily aggregate
queries scan all historical rows on each cache miss — pre-aggregation is the future fix if
reads climb again."* Turso's free tier has a monthly read budget (the repo previously sat at
~65M reads/month before query-level caching was added in commit `92a55af`).

## Current state

`dashboard/src/lib/queries.ts` has three aggregate queries, all of which `GROUP BY` over the
full `readings` table for the selected venue(s):

- `getHeatmap(venueIds)` → avg occupancy % per **(day-of-week, hour)** (`HAVING hour >= 7`)
- `getHourlyAverages(venueIds)` → avg occupancy % & count per **hour** (`HAVING hour >= 7`)
- `getDailyAverages(venueIds)` → avg occupancy % per **day-of-week**

They share structure: each averages `occupancy / capacity * 100` (and raw `occupancy`),
grouped by some subset of (dow, hour), converting UTC→Madrid via
`madridOffsetModifier()` applied as a SQLite `datetime(timestamp, ?)` modifier. Day-of-week
is remapped (`%w` Sun=0 → Mon=0).

`getTimeSeries(venueId, from, to)` returns raw points for a date range — **not** an aggregate;
likely leave it on raw `readings` (or see Task D).

Caching: `dashboard/src/lib/cached-queries.ts` wraps these in `unstable_cache` (heatmap/hourly/
daily at 300s). Caching helps repeated hits but each *miss* still does the full scan, and more
filter combinations (Task D) mean more cache keys → more misses.

Schema + migration: `scraper/src/migrate.ts` (single `readings` table, index on
`(venue_id, timestamp)`).

## Approach (recommended)

Precompute a **per-(venue_id, date, hour) rollup** storing sums + counts, not finished averages:

```sql
CREATE TABLE readings_hourly (
  venue_id   INTEGER NOT NULL,
  date       TEXT    NOT NULL,  -- Madrid local date, 'YYYY-MM-DD'
  hour       INTEGER NOT NULL,  -- Madrid local hour 0–23
  sum_pct    REAL    NOT NULL,  -- Σ (occupancy/capacity*100)
  sum_occ    REAL    NOT NULL,  -- Σ occupancy
  n          INTEGER NOT NULL,  -- sample count
  PRIMARY KEY (venue_id, date, hour)
);
```

Store **sum + count** (not averages) so you can re-aggregate correctly across dates/dow/hours:
`AVG = SUM/COUNT`. Averaging pre-averaged buckets would mis-weight.

Then the dashboard aggregates read the rollup instead of `readings`:
- heatmap → group rollup by (dow-derived-from-date, hour)
- hourly → group by hour
- daily → group by dow
…each computing `ROUND(SUM(sum_pct)/SUM(n))`. **Crucially, a date dimension is kept** so Task D's
date-range filter still works (see below). Day-of-week derives from `date` at read time.

**Where to compute it:** keep `readings` as the source of truth; refresh the rollup
incrementally. Options (pick and justify):
- A periodic job (cleanest: a scheduled GitHub Action like `freshness.yml`, but **read+write** →
  needs the read-write token, not the read-only secret) that upserts rollup rows for recent
  dates/hours.
- Or fold it into the scraper after each insert (simplest, but couples ingestion to rollup).

Either way you need a **one-time backfill** of existing history, and the refresh must be
idempotent (re-running a bucket overwrites, not double-counts — `INSERT … ON CONFLICT … SET`).

Mind the **current (in-progress) hour**: its bucket keeps changing, so always recompute the
most recent bucket(s) rather than assuming finalized.

## Coordination with the other task (D)

Task D adds a **date-range** filter to the aggregates. A naïve (venue, dow, hour) rollup
aggregates over *all* history and **cannot** serve an arbitrary date range — that's why this
brief keeps a `date` column. Keep the rollup at **(venue, date, hour)** granularity so D can
sum only the in-range dates. If D lands first, make sure its date-range params thread into
whatever you change here; if this lands first, expose the queries so D can add a date filter.
Both edit `queries.ts` / `cached-queries.ts` — expect a merge touchpoint.

## Acceptance criteria

- Heatmap/hourly/daily produce the **same numbers** as today (verify against the current
  queries on the seeded dataset).
- Aggregate reads no longer scale with total `readings` row count.
- Rollup refresh is idempotent and handles the in-progress hour.
- Existing history is backfilled.
- Tests for the rollup aggregation logic (follow `queries.test.ts` patterns — mock `db`).
- Timezone (Madrid, DST via `madridOffsetModifier`) and the `hour >= 7` opening-hour filter
  are preserved.

## Gotchas

- All timestamps are UTC in `readings`; bucketing must convert to Madrid (DST-aware) — do it
  once when writing the rollup, store Madrid-local `date`/`hour`.
- `capacity > 0` guard (avoids divide-by-zero) — `seed-dev` and real data can have rows.
- `entries`/`exits` are cumulative daily counters — not relevant to these averages, ignore.
- Don't break `getTimeSeries` (raw points) or the live queries.
- Local dev: `pnpm seed-dev` (≈ several hundred k rows at 1/min over 90 days) then
  `cd dashboard && pnpm dev:mock` — good for measuring before/after.
