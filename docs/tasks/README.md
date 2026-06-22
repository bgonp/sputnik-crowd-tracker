# Task briefs

Self-contained context for agents picking up a specific piece of work. Each brief
assumes you've **first read the repo's `CLAUDE.md` and `AGENT_ONBOARDING.md`** (conventions,
the branch-per-task + PR workflow, local-dev commands, CI gates). The brief only adds
task-specific detail.

- [`pre-aggregation-rollup.md`](./pre-aggregation-rollup.md) — Follow-up **B**: stop the
  heatmap/hourly/daily queries from scanning all history; precompute a rollup.
- [`dashboard-filters.md`](./dashboard-filters.md) — Follow-up **D**: add date-range,
  day-of-week, and time-of-day filters to the dashboard.

> **B and D overlap** — both touch `dashboard/src/lib/queries.ts` and the chart sections,
> and there's a real design dependency between them (see the "Coordination with the other
> task" section in each brief). Read both before starting either.

Delete a brief once its work has merged.
