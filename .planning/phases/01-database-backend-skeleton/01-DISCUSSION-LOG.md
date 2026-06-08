# Phase 1: Database + Backend Skeleton — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-08
**Phase:** 01-database-backend-skeleton
**Mode:** auto (recommended option selected for every question)
**Areas discussed:** Migrations, Repository pattern, Monorepo tooling, Env validation, Health endpoint, Seed approach, Geo column type, Docker compose topology

---

## Migrations Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Drizzle Kit | Generate + migrate via Drizzle's own tooling. Single source of truth in `schema.ts`. | ✓ |
| Atlas | Declarative schema, separate CLI. More mature for prod but extra learning curve. | |
| Raw SQL files + node-pg-migrate | Full control, no DSL. Verbose for a 12-table schema. | |

**Auto-selected:** Drizzle Kit (recommended — already chose Drizzle as ORM, single source of truth, official PostGIS guide).

---

## Repository / Data Access Pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Thin repos per aggregate + hand SQL for PostGIS | Drizzle query builder for 80% of CRUD, `sql\`…\`` for KNN / ST_DWithin / re-rank. | ✓ |
| Pure Drizzle query builder | Wrap PostGIS in custom Drizzle ops. Brittle for spatial. | |
| Service layer + DAO | Heavier abstraction. Overkill for a modular monolith. | |

**Auto-selected:** Thin repos + hand SQL for PostGIS-heavy queries.

---

## Monorepo Tooling

| Option | Description | Selected |
|--------|-------------|----------|
| Plain pnpm workspaces | Native workspace protocol, zero extra tooling. | ✓ |
| Turborepo | Build cache, parallel tasks. Overkill for 3 packages. | |
| Nx | Full graph + generators. Major learning curve. | |

**Auto-selected:** Plain pnpm workspaces.

---

## Env Validation

| Option | Description | Selected |
|--------|-------------|----------|
| Zod schema + Node 22 `--env-file` | Fail-fast at boot, typed config object, no `dotenv` lib. | ✓ |
| dotenv + manual checks | Familiar but no type safety. | |
| envalid | Specialized lib. Adds dependency for marginal gain over Zod. | |

**Auto-selected:** Zod schema validated at boot, native `--env-file`.

---

## /api/health Contents

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal `{status: 'ok'}` | One byte, useless for demo pre-flight. | |
| Status + version + uptime + sub-checks (db, postgis, redis) | Returns `PostGIS_Version()`, version SHA, uptime. 503 on any failure. | ✓ |
| Full Prometheus metrics | Out-of-scope for demo. | |

**Auto-selected:** Comprehensive with sub-checks — addresses success criterion #1 explicitly.

---

## Seed Approach

| Option | Description | Selected |
|--------|-------------|----------|
| TypeScript script via Drizzle | Type-safe, reuses repos, idempotent via ON CONFLICT. | ✓ |
| Raw SQL fixtures | Faster to write but no compile-time safety. | |
| Mixed (SQL for cities, TS for rest) | Splits concerns awkwardly. | |

**Auto-selected:** TypeScript script using repositories.

---

## Geo Column Type

| Option | Description | Selected |
|--------|-------------|----------|
| `geography(Point, 4326)` everywhere | Spec §2 mandates; meter-accurate; spheroid-aware. | ✓ |
| `geometry(Point, 4326)` | Faster for some ops but planar — wrong for global distances. | |
| Mixed (geometry for cities, geography for trucks) | Inconsistent — pitfall magnet. | |

**Auto-selected:** `geography(Point, 4326)` everywhere + SRID CHECK constraint per Pitfall #2/#3.

---

## Docker Compose Topology

| Option | Description | Selected |
|--------|-------------|----------|
| api + web + postgres+postgis + redis + caddy | Full demo stack in one `docker compose up`. | ✓ |
| api + postgres only | Minimal but doesn't satisfy success criterion #1. | |
| Separate dev vs prod compose files (this + override) | Used: base compose + `docker-compose.prod.yml` override for TLS. | ✓ (with override pattern) |

**Auto-selected:** Full 5-service stack with prod override for TLS.

---

## Claude's Discretion

The following decisions were explicitly deferred to Claude during planning:
- Drizzle schema file layout (single `schema.ts` vs per-domain split)
- Seed fixture format (TS hardcoded vs JSON fixtures imported)
- Fastify plugin registration style (autoload vs explicit)
- Pino logger formatting (json vs pretty in dev)

## Deferred Ideas

- `/api/health` auth (currently public) → Phase 6 POLISH-05 pre-flight
- CI pipeline (GitHub Actions for migrate + tests) → Phase 6
- OpenTelemetry observability → v2 PROD-06
- Postgres backup strategy → v2
- "Scenario seeds" (empty-park, busy-park) → Phase 6 polish
- Helm chart for Kubernetes → v2 PROD
