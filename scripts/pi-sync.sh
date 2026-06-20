#!/usr/bin/env bash
#
# Keep the Raspberry Pi's checkout in sync with origin/main.
#
# The Pi is a deploy target (it only runs the scraper), not a dev box, so this
# force-matches origin/main rather than merging. Untracked files (your .env) are
# left untouched. Dependencies are reinstalled only when the lockfile or a
# package.json actually changed, so the common "nothing new" path is just a quick
# fetch-and-exit.
#
# Schema/data steps are deliberately NOT automated here — `migrate` and
# `sync-venues` write to Turso and are rare/sensitive, so run them by hand after a
# deploy that touches the schema (the dashboard degrades gracefully until you do).
#
# Install (point it at your checkout — either edit the REPO_DIR default below or
# export SPUTNIK_REPO_DIR), then add to `crontab -e`:
#   */15 * * * * /home/pi/sputnik-crowd-tracker/scripts/pi-sync.sh >> /home/pi/sputnik-sync.log 2>&1

set -euo pipefail

REPO_DIR="${SPUTNIK_REPO_DIR:-/home/pi/sputnik-crowd-tracker}"
BRANCH="main"

# cron runs with a minimal PATH; point it at the same node/pnpm your scrape cron
# uses (override SPUTNIK_PNPM_PATH if pnpm lives elsewhere).
export PATH="${SPUTNIK_PNPM_PATH:-$HOME/.local/share/pnpm}:/usr/local/bin:/usr/bin:$PATH"

cd "$REPO_DIR"
git fetch --quiet origin "$BRANCH"

local_rev=$(git rev-parse HEAD)
remote_rev=$(git rev-parse "origin/$BRANCH")
[ "$local_rev" = "$remote_rev" ] && exit 0   # already current — nothing to do

echo "$(date -Is) syncing ${local_rev:0:7} -> ${remote_rev:0:7}"

# Decide whether deps need reinstalling before moving HEAD. Plain `git diff`
# (no --exit-code) returns 0 even when there are differences, but guard with
# `|| true` so a non-zero from any git quirk can't trip `set -e` here.
deps_changed=$(git diff --name-only "$local_rev" "$remote_rev" -- pnpm-lock.yaml '**/package.json' || true)

git reset --hard "origin/$BRANCH"

if [ -n "$deps_changed" ]; then
  echo "$(date -Is) dependency manifests changed — running pnpm install"
  pnpm install --frozen-lockfile
fi

echo "$(date -Is) now at $(git rev-parse --short HEAD)"
