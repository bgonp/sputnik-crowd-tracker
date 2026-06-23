# Contributing

Sputnik Crowd Tracker is a personal side project, but pull requests for bug fixes, improvements, and new features are welcome. A few things to know first.

## Getting started

See [README.md](README.md) for the full setup, dev workflow, and environment variables. The short version:

```bash
pnpm install
pnpm seed-dev                 # ~90 days mock data → ./dev.db
cd dashboard && pnpm dev:mock # dashboard at http://localhost:3000 (no Turso needed)
pnpm test                     # Vitest across both packages
```

## Code conventions

- **English in code.** All identifiers, comments, and column names are English, even though the domain is Spanish. The only Spanish that belongs in source code: mapping the gym's Spanish API field names on ingest (`scraper/src/transform.ts`) and user-facing UI copy (`dashboard/src/lib/labels.ts`).
- **TypeScript strict, no `any`.** The scraper also runs `noUncheckedIndexedAccess`.
- **Timestamps are UTC in the DB.** Convert to `Europe/Madrid` at query time with the DST-aware helper in `dashboard/src/lib/queries.ts`. Never store local time.
- **Keep Turso reads low.** New data-fetching belongs in `cached-queries.ts` with an appropriate `unstable_cache` revalidation window, not raw `queries.ts`.
- **Test new behaviour.** Queries and pure helpers get unit tests; React components get React Testing Library tests on happy-dom. Brittle surfaces (Recharts internals, async-only server components) can be skipped — note it in the PR.
- **Prefer server components.** Reach for client components only when interactivity genuinely requires it.

## Submitting a pull request

1. **Branch from `main`** with a short descriptive name (`feat/…`, `fix/…`, `docs/…`).
2. **Make logical commits** — one concern per commit, imperative subject line.
3. **Include a test** for any new logic.
4. **Push and open a PR.** CI runs lint, type-check, tests, and a build on every PR. The PR isn't ready until all checks are green.
5. **Keep docs in sync.** If your change affects setup, architecture, the DB schema, or the gym API contract, update the relevant doc in the same PR (see the table in [CLAUDE.md](CLAUDE.md)).

## What makes a good contribution

- Bug fixes and correctness improvements
- Performance improvements that keep the Turso read budget low
- New chart types or derived metrics grounded in the existing data model
- Improvements to the scraper's resilience or accuracy

If you're planning something large, open an issue first — saves everyone time.

## License

By contributing you agree your work will be released under the project's [MIT license](LICENSE).
