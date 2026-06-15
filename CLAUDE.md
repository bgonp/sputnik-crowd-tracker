# CLAUDE.md

Sputnik Crowd Tracker — a pnpm monorepo that scrapes gym occupancy data every 60s and visualizes it.

Full agent context (architecture, where things live, what to read first): @AGENT_ONBOARDING.md

## Non-negotiable conventions

- **English everywhere in code** — identifiers, comments, DB columns — even though the domain is Spanish. The only Spanish allowed: mapping the Spanish API field names on ingest (`scraper/src/transform.ts`) and user-facing UI labels (`dashboard/src/lib/labels.ts`). See the gym API contract in `scraper/API.md`.
- **TypeScript strict, no `any`.** The scraper also runs `noUncheckedIndexedAccess`.
- **Timestamps are UTC in the DB.** Convert to `Europe/Madrid` at query time with the DST-aware `madridOffsetModifier()` in `dashboard/src/lib/queries.ts`. Never store local time.
- **Keep Turso reads low.** Components fetch through `dashboard/src/lib/cached-queries.ts` (`unstable_cache` with staggered revalidation), not raw `queries.ts`. New queries: add to `queries.ts`, test, then expose via `cached-queries.ts`.
- **This is Next.js 16, not the version in your training data** — breaking API changes. Read the guides under `dashboard/node_modules/next/dist/docs/` before writing dashboard code (see `dashboard/AGENTS.md`). Prefer server components.

## Deployment reality

The scraper runs on a **Raspberry Pi** (cron/systemd, every 60s) — the gym server blocks datacenter IPs, so cloud cron (GitHub Actions/AWS) does not work. The dashboard runs on Vercel and queries Turso directly. `PLAN.md` is the original design doc; where it disagrees with the code (it references a GitHub Actions workflow and an `api/readings/` route that were never built), trust the code.

## Keeping docs in sync

These docs are the project's source of truth for humans and agents — keep them current **as part of the change that makes them stale**, not as an afterthought. When a change touches one of these areas, update the matching doc in the same commit:

| If you change…                                              | Update…                          |
| ----------------------------------------------------------- | -------------------------------- |
| Setup, scripts, env vars, or how to run things              | `README.md`                      |
| The gym API request flow, response fields, or field mapping | `scraper/API.md`                 |
| Architecture, conventions, or where things live             | `AGENT_ONBOARDING.md` + this file |
| Deployment (the Pi scraper, Vercel, scheduling)             | `README.md` + `PLAN.md`          |
| The `readings` schema or derived metrics                    | `README.md` + `PLAN.md`          |

`PLAN.md` is the original design doc — when reality diverges, fix the divergence or note it; don't silently leave it wrong. If a change makes none of these stale, no doc update is needed — don't churn docs for their own sake.

## Git workflow (default for every task)

Every task is done on its own branch and delivered as a PR. **Never commit directly to `main`, and never merge the PR yourself.**

1. **Branch from fresh `main`:** `git switch main && git pull && git switch -c <type>/<short-kebab-desc>`. Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf` (e.g. `feat/venue-comparison`, `fix/madrid-dst-offset`).
2. **Commit logically:** one concern per commit, imperative subject line. Group related changes; keep unrelated pre-existing changes in their own commits. End each commit message with the `Co-Authored-By` trailer.
3. **Keep docs in sync** in the same PR (see the table above).
4. **Finish with a PR:** `git push -u origin <branch>` then `gh pr create`. Title = concise summary; body = what changed, why, and how it was verified (tests/lint run).
5. **Wait for CI to pass before considering the task done.** After pushing, watch the PR's checks (`gh pr checks <n> --watch`, or poll `gh pr checks <n>`). The task is **not** done while CI is failing — read the failing job's logs (`gh run view <run-id> --log-failed`), fix the cause, and push again until every check is green. A local build/test pass is not a substitute: CI builds against an empty database and a clean install, so it catches things local runs miss.
6. **Wait for GitHub Copilot's review and address it.** Copilot auto-reviews PRs here. Give it a moment after pushing, then read its comments (`gh pr view <n> --comments`, and `gh api repos/{owner}/{repo}/pulls/<n>/comments` for inline review threads). The task is **not** done while Copilot has open feedback — for each actionable comment, either fix it and push, or reply explaining why it doesn't apply; ignore only clearly spurious ones, and say so. Copilot re-reviews after each push, so repeat until it has nothing actionable left.
7. **Stop there.** Leave review and merge to the user — do not merge the PR.

## Local dev

```bash
pnpm install
pnpm seed-dev                 # ~90 days mock data → ./dev.db
cd dashboard && pnpm dev:mock # dashboard against local SQLite (no Turso creds needed)
pnpm test                     # Vitest, both packages
```
