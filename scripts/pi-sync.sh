#!/usr/bin/env bash
#
# Keep the Raspberry Pi's checkout in sync with origin/main.
#
# The Pi is a deploy target (it only runs the scraper), not a dev box, so this
# force-matches origin/main rather than merging. Untracked files (your .env) are
# left untouched. The scraper's deps are reinstalled only when pnpm-lock.yaml
# actually changed (the canonical signal), so the common "nothing new" path is
# just a quick fetch-and-exit.
#
# Schema/data steps are deliberately NOT automated here — `migrate` and
# `sync-venues` write to Turso and are rare/sensitive, so run them by hand after a
# deploy that touches the schema (the dashboard degrades gracefully until you do).
#
# When `flock` is available (standard on Raspberry Pi OS / util-linux) it takes a
# non-blocking lock so it never updates the worktree / node_modules underneath a
# scrape; without flock it runs unlocked (so install util-linux for that
# protection). Wrap the scrape cron with the SAME lock so the two never overlap.
# cron's PATH is minimal, so prefix the scrape line with one that includes pnpm
# (adjust to where pnpm lives):
#   * * * * * PATH=/home/pi/.local/share/pnpm:/usr/local/bin:/usr/bin flock -n /tmp/sputnik.lock pnpm --dir /home/pi/sputnik-crowd-tracker scrape
#
# Install (point it at your checkout — either edit the REPO_DIR default below or
# export SPUTNIK_REPO_DIR), then add to `crontab -e`:
#   */15 * * * * /home/pi/sputnik-crowd-tracker/scripts/pi-sync.sh >> /home/pi/sputnik-sync.log 2>&1

set -euo pipefail

REPO_DIR="${SPUTNIK_REPO_DIR:-/home/pi/sputnik-crowd-tracker}"
BRANCH="main"
LOCK="${SPUTNIK_LOCK:-/tmp/sputnik.lock}"

# Serialize against other sputnik jobs (other syncs, and the scrape cron if you
# wrap it with the same lock) so a reset/install never lands under a running
# scrape. Non-blocking: if something else holds the lock, skip this round.
if command -v flock >/dev/null 2>&1; then
  exec 9>"$LOCK"
  flock -n 9 || { echo "$(date -Is) another sputnik job holds the lock — skipping this sync"; exit 0; }
fi

# cron runs with a minimal PATH; point it at the same node/pnpm your scrape cron
# uses (override SPUTNIK_PNPM_PATH if pnpm lives elsewhere). HOME/PATH are guarded
# with :- so an unset var can't trip `set -u`.
export PATH="${SPUTNIK_PNPM_PATH:-${HOME:-}/.local/share/pnpm}:/usr/local/bin:/usr/bin${PATH:+:$PATH}"

cd "$REPO_DIR"
git fetch --quiet origin "$BRANCH"

local_rev=$(git rev-parse HEAD)
remote_rev=$(git rev-parse "origin/$BRANCH")
[ "$local_rev" = "$remote_rev" ] && exit 0   # already current — nothing to do

echo "$(date -Is) syncing ${local_rev:0:7} -> ${remote_rev:0:7}"

# Decide whether deps need reinstalling before moving HEAD. pnpm-lock.yaml is the
# canonical signal — any real dependency change updates it (and a package.json
# edit that didn't would fail `--frozen-lockfile` anyway), so a single lockfile
# check covers root + every workspace without fragile package.json globbing.
# Plain `git diff` (no --exit-code) returns 0 even with differences; `|| true`
# keeps any git quirk from tripping `set -e`.
deps_changed=$(git diff --name-only "$local_rev" "$remote_rev" -- pnpm-lock.yaml || true)

git reset --hard "origin/$BRANCH"

if [ -n "$deps_changed" ]; then
  # The Pi only runs the scraper, so install just that workspace's deps.
  echo "$(date -Is) pnpm-lock.yaml changed — installing scraper deps"
  pnpm install --frozen-lockfile --filter scraper
fi

echo "$(date -Is) now at $(git rev-parse --short HEAD)"
