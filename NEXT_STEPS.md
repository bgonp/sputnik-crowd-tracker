# NEXT_STEPS — post-merge checklist

> Local scratch file — **not committed**. Delete it once you've worked through it.

Status: **#20 merged**, **#22 merged**, **#23** CI-green/ready to merge.

---

## ▢ DB setup for the dashboard open-hours feature (#22, merged)

The dashboard reads the `venues` / `venue_hours` tables. Until they're populated it
degrades gracefully (venue list from `readings`, every venue shown as open), so do
this once against production Turso to light up the "Cerrado / Abre a las HH:MM" state:

1. **Create the tables** (idempotent) — with prod `TURSO_URL` + read-write `TURSO_AUTH_TOKEN` in the env:
   ```bash
   pnpm --filter scraper migrate
   ```
   - ⚠️ There is currently **no `migrate` script** in `scraper/package.json` (being added in PR #24).
     Until #24 merges, run it directly:
     ```bash
     pnpm --filter scraper exec tsx --env-file-if-exists=.env src/migrate.ts
     ```
2. **Populate** `venues` + `venue_hours` from observed readings + the hours config:
   ```bash
   pnpm --filter scraper sync-venues
   ```
   - DB-only (no gym fetch) → run from **anywhere** with Turso creds, not just the Pi.
   - Re-run whenever the **set of venues** changes (new venue, rename).
3. **Verify**: open the dashboard overnight (Madrid time) and confirm closed venues
   show "Cerrado · Abre a las HH:MM" instead of a stale %, and the venue list still appears.

---

## ▢ After PR #23 merges — *pi-sync.sh*

1. **Pull once manually** on the Pi (bootstrap before cron takes over):
   ```bash
   cd /home/bgonp/code/sputnik-crowd-tracker && git pull --ff-only
   chmod +x scripts/pi-sync.sh   # ensure executable
   ```
2. **Add two cron lines** (`crontab -e`) — the sync, plus the scrape wrapped in the
   **same** `flock` so a sync never updates the worktree under a running scrape.
   Adjust paths (and the `PATH=` to where pnpm lives — cron's PATH is minimal):
   ```
   */15 * * * * /home/bgonp/code/sputnik-crowd-tracker/scripts/pi-sync.sh >> /home/bgonp/sputnik-sync.log 2>&1
   * * * * * PATH=/home/bgonp/.local/share/pnpm:/usr/local/bin:/usr/bin flock -n /tmp/sputnik.lock pnpm --dir /home/bgonp/code/sputnik-crowd-tracker scrape
   ```
   - The sync line needs no `PATH=` prefix — the script sets its own PATH.
   - `flock` lives in util-linux (standard on Raspberry Pi OS); without it the sync runs unlocked.
   - Override `SPUTNIK_REPO_DIR` / `SPUTNIK_PNPM_PATH` / `SPUTNIK_LOCK` if your paths differ.
   - It hard-resets to `origin/main` (deploy-target sync) — don't keep local commits on the Pi; `.env` is safe (untracked).
3. **Confirm it runs**: `tail -f /home/bgonp/sputnik-sync.log` after the next interval.

---

## Ongoing reminders

- **Hours source of truth** = `scraper/src/open-hours.ts`. When the gym changes hours:
  edit that file → it deploys to the Pi via pi-sync (gate uses new hours) → **re-run
  `sync-venues`** so the dashboard's `venue_hours` reflects them.
- **Weekly drift-check routine** `venue-hours-drift-check` runs Mondays ~06:00 UTC and
  opens a PR if the published hours drift from `open-hours.ts`. If it opens one:
  review + merge, then re-run `sync-venues`.
  Manage: https://claude.ai/code/routines/trig_01P298ri6SuzQrTjNVFdMMKN
- **Schema changes are never auto-applied** by pi-sync — always run `migrate` (and
  `sync-venues` if venues/hours changed) by hand after a deploy that touches the schema.
