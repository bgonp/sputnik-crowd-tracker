# Dashboard

The Next.js dashboard for Sputnik Crowd Tracker.

- **Project overview, setup, and architecture:** see the [root README](../README.md).
- **Agent / contributor conventions:** see [`AGENTS.md`](./AGENTS.md) (Next.js 16 has breaking changes — read it before writing code) and the root [`CLAUDE.md`](../CLAUDE.md).

## Quick start

```bash
pnpm install                  # from the repo root
pnpm seed-dev                 # generate local mock data → ../dev.db
cd dashboard && pnpm dev:mock # run against the local SQLite file
# → http://localhost:3000
```

Copy `.env.example` to `.env.local` and fill in `TURSO_URL` / `TURSO_AUTH_TOKEN` to point at a real Turso database instead.
