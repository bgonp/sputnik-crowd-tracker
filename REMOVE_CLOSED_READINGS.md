# Remove out-of-hours readings (one-off)

Older rows predate the "collect only while open" change, so the prod DB still
carries readings recorded while venues were **closed**. This deletes them using
the open windows from `scraper/src/open-hours.ts`.

Run it **once, while every venue is closed**, to avoid racing the scraper.

## Assumptions

- All data is from June 2026 (first row 2026-06-11), entirely in CEST, so the
  Madrid offset is a flat `+2 hours` — no DST split needed.
- Venues are matched by name prefix (handles the `" Principal"` suffix). Rows
  whose `venue_name` matches no prefix are left untouched (fail-safe).
- Boundary semantics match the scraper: a reading exactly at `open_min` is kept,
  one exactly at `close_min` is deleted (open window is `[open_min, close_min)`).

Open windows (minutes from local midnight):

| | open | close |
|---|---|---|
| weekday (all but Berango) | 07:00 | 23:00 |
| Berango weekday | 10:00 | 22:00 |
| Saturday | 09:00 | 22:00 (Alcobendas/Berango 21:00) |
| Sunday | 09:00 (Las Rozas 08:00) | 21:00 (all) |

## Steps

```bash
# 1. Back up first — the DELETE is irreversible.
turso db shell <db> ".dump" > sputnik-backup-$(date +%F).sql

# 2. (optional) Eyeball the count by running the SELECT variant below.

# 3. Run the DELETE.
turso db shell <db> < REMOVE_CLOSED_READINGS.md   # paste the SQL block, or copy it into the shell
```

## Dry-run count (optional)

Replace the final `DELETE … ( … )` with this to see how many rows would go:

```sql
SELECT venue_name, count(*) AS closed_rows
FROM windowed
WHERE minute < open_min OR minute >= close_min
GROUP BY venue_name
ORDER BY closed_rows DESC;
```

(prefix it with the same `WITH windowed AS (…)` block below.)

## The statement

```sql
WITH windowed AS (
  SELECT id, venue_name,
    CAST(strftime('%w', datetime(timestamp, '+2 hours')) AS INTEGER) AS dow,
    CAST(strftime('%H', datetime(timestamp, '+2 hours')) AS INTEGER) * 60
      + CAST(strftime('%M', datetime(timestamp, '+2 hours')) AS INTEGER) AS minute,
    CASE
      WHEN venue_name LIKE 'Berango%' THEN 600
      WHEN CAST(strftime('%w', datetime(timestamp, '+2 hours')) AS INTEGER) = 0
        THEN CASE WHEN venue_name LIKE 'Las Rozas%' THEN 480 ELSE 540 END
      WHEN CAST(strftime('%w', datetime(timestamp, '+2 hours')) AS INTEGER) = 6 THEN 540
      ELSE 420
    END AS open_min,
    CASE
      WHEN CAST(strftime('%w', datetime(timestamp, '+2 hours')) AS INTEGER) = 0 THEN 1260
      WHEN CAST(strftime('%w', datetime(timestamp, '+2 hours')) AS INTEGER) = 6
        THEN CASE WHEN venue_name LIKE 'Alcobendas%' OR venue_name LIKE 'Berango%' THEN 1260 ELSE 1320 END
      ELSE CASE WHEN venue_name LIKE 'Berango%' THEN 1320 ELSE 1380 END
    END AS close_min
  FROM readings
  WHERE venue_name LIKE 'Alcobendas%' OR venue_name LIKE 'Las Rozas%'
     OR venue_name LIKE 'Legazpi%'    OR venue_name LIKE 'Chamber%'
     OR venue_name LIKE 'Guindalera%' OR venue_name LIKE 'Berango%'
)
DELETE FROM readings WHERE id IN (
  SELECT id FROM windowed WHERE minute < open_min OR minute >= close_min
);
```
