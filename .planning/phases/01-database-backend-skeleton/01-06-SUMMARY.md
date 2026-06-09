---
phase: 01-database-backend-skeleton
plan: 06
subsystem: database
tags: [drizzle, schema, channels, repos, idempotency, webhook_updates, bourse_cache, pricing_config, messages, calls, thin-repo, namespace-barrel]

# Dependency graph
requires:
  - phase: 01-database-backend-skeleton
    provides: _enums (webhookSourceEnum), clients/leads/orders/cities/trucks tables (FK targets for messages/calls + repo schema imports), Db type from db.ts, and 7 passing/10 todo Vitest suite from Plans 01-00..01-05
provides:
  - apps/api/src/persistence/schema/messages.ts — messages table (DB-07; client_id FK cascade + lead_id FK set-null + role/text + 3 indexes)
  - apps/api/src/persistence/schema/calls.ts — calls table (DB-07; lead_id FK set-null + direction + transcript jsonb default '[]' + outcome)
  - apps/api/src/persistence/schema/bourse_cache.ts — bourse_cache table (DB-07; query_hash UNIQUE + source + payload + fetched_at TTL anchor)
  - apps/api/src/persistence/schema/webhook_updates.ts — webhook_updates table (DB-09; bigserial PK + webhookSourceEnum + UNIQUE(source, external_id) for Telegram idempotency)
  - apps/api/src/persistence/schema/pricing_config.ts — pricing_config table (D-19; key/value jsonb store for rate_per_km/dir_coef/season_coef)
  - apps/api/src/persistence/repos/{trucks,cities,clients,leads,orders,messages,index}.ts — 6 thin per-aggregate repos + namespace barrel per D-07
  - All 13 spec §2 tables now declared (clients, cities, trucks, truck_positions, leads, orders, order_events, calls, messages, bourse_cache, pod_artifacts, webhook_updates, pricing_config)
  - DB-07 / DB-09 / API-02 unit stub tests flipped from .todo() to passing
affects:
  - 01-07 fastify-skeleton (`pnpm db:generate` will now snapshot the full 13-table init migration in one 0001_init.sql)
  - 01-08 rest-stubs (REST route handlers will import from @/persistence/repos for the 501 stubs' future Phase 4 fills)
  - 01-09 seed (seed run uses ordersRepo/clientsRepo/etc to insert demo data idempotently)
  - Phase 2 (FSM repos will sit ON TOP of these thin functions; PostGIS KNN uses raw sql per D-08)
  - Phase 3 (webhook_updates ON CONFLICT DO NOTHING is the Telegram idempotency primitive)
  - Phase 4 (admin REST routes call the thin repos directly)
  - Phase 5 (ordersRepo.findByPublicToken backs /track/[token])

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Thin per-aggregate repository — each repo file is a flat module of pure async functions taking Db as first arg. NO classes, NO DI container. Pattern: `export async function findById(db: Db, id: string)`."
    - "Namespace barrel re-export — `export * as trucksRepo from './trucks.js'` lets call sites stay grep-friendly (`trucksRepo.findById(db, id)`) without inflating individual import lines per consumer."
    - "Idempotent insert via composite UNIQUE — webhook_updates.UNIQUE(source, external_id) + Drizzle's onConflictDoNothing({target: [...]}) is the canonical primitive for Telegram update_id (Pitfall #5) and reusable for any future external_id-bearing webhook."
    - "Cache table with query_hash UNIQUE + fetched_at — bourse_cache pattern: hash the normalized query for the unique key, store fetched_at, let the consumer filter by freshness window. Reusable for any external-API memoization (geocoding, OSRM)."
    - "Key/value config store — pricing_config (key TEXT PK + value jsonb + updated_at) is a single-row-per-knob store for the values calcPrice reads. value is jsonb so each knob can hold whatever shape it needs (scalar, object, array)."

key-files:
  created:
    - apps/api/src/persistence/schema/messages.ts
    - apps/api/src/persistence/schema/calls.ts
    - apps/api/src/persistence/schema/bourse_cache.ts
    - apps/api/src/persistence/schema/webhook_updates.ts
    - apps/api/src/persistence/schema/pricing_config.ts
    - apps/api/src/persistence/repos/trucks.ts
    - apps/api/src/persistence/repos/cities.ts
    - apps/api/src/persistence/repos/clients.ts
    - apps/api/src/persistence/repos/leads.ts
    - apps/api/src/persistence/repos/orders.ts
    - apps/api/src/persistence/repos/messages.ts
    - apps/api/src/persistence/repos/index.ts
  modified:
    - apps/api/src/persistence/schema/index.ts — appended 5 alphabetical re-exports (bourse_cache, calls, messages, pricing_config, webhook_updates)
    - apps/api/tests/unit/phase-1-stubs.test.ts — DB-07 / DB-09 / API-02 flipped from test.todo() to real test() with Object.keys + source-grep + repos-barrel-import assertions

key-decisions:
  - "messages.role is text not ENUM — values today are {client, ai, manager} per spec §2 with plausible future {system, broadcast}. text + write-time validation in the producing code paths is more flexible than churning an ENUM each time a new actor type appears."
  - "calls.outcome is text not ENUM — same reasoning as messages.role. Domain evolves through Phase 3 (no-answer / busy / completed / dropped / voicemail / …)."
  - "calls.transcript default `'[]'::jsonb` not `'{}'::jsonb` — transcript is an array of segments {speaker, text, ts} per spec §5.2, so the empty-shape default is the empty array."
  - "messages.client_id FK cascade, lead_id FK set-null — a client deletion blows away their chat history (privacy + demo cleanup); a lead deletion preserves chat history (chat predates lead promotion)."
  - "calls.lead_id FK set-null (nullable) — a call may exist before a lead is matched, and lead deletion should not delete the call record."
  - "bourse_cache query_hash UNIQUE via uniqueIndex (not .unique() shortcut) — explicit index name 'bourse_cache_query_hash_unq' for migration clarity and so the ON CONFLICT target can reference it by name if needed."
  - "webhook_updates.id is bigserial (RESEARCH.md §verbatim) — Telegram update_id is bigint, voice/gps push ids may also be large; bigserial gives us a numeric PK that won't collide with the external_id semantics."
  - "Thin repos use namespace re-export (`export * as trucksRepo from './trucks.js'`) — keeps the barrel's surface small (6 named namespaces) while preserving import-statement determinism in call sites (`trucksRepo.findById` not `findById_from_trucks`)."
  - "PostGIS-heavy queries deliberately NOT added to repos in this plan — D-08 says nearestTruck, ST_DWithin, ST_Distance CTE re-rank ship via raw `db.execute(sql\`…\`)` in Phase 2. Keeping them out of Phase 1 repos avoids leaking half-baked spatial helpers that Phase 2 would have to refactor."

patterns-established:
  - "Thin repo per aggregate — 6 repo files (trucks, cities, clients, leads, orders, messages); each exports flat async functions (no classes); always takes Db as first arg so transactions just pass `tx` in place of `db`."
  - "Namespace barrel — `export * as fooRepo from './foo.js'` (not `export * from './foo.js'`) keeps call-site grep deterministic."
  - "Idempotency table pattern — composite UNIQUE on (source, external_id) with `onConflictDoNothing({target: [...]})`. Reusable for any future external-source webhook beyond Telegram."
  - "TTL cache pattern — query_hash UNIQUE + fetched_at timestamp, with consumer-side freshness filter. Reusable for OSRM / Nominatim / geocoding memoization."

requirements-completed: [DB-07, DB-09, API-02]

# Metrics
duration: 4m 10s
completed: 2026-06-09
---

# Phase 01 Plan 06: Schema-Channels-Repos Summary

**Five channel/config schema tables (messages, calls, bourse_cache, webhook_updates with Telegram idempotency UNIQUE, pricing_config) plus six thin per-aggregate repos and a namespace barrel; Phase 1 schema now covers all 13 spec §2 tables; unit suite jumps from 7/17 to 10/17 passing.**

## Performance

- **Duration:** 4m 10s
- **Started:** 2026-06-09T05:56:47Z
- **Completed:** 2026-06-09T06:00:57Z
- **Tasks:** 3
- **Files created:** 12
- **Files modified:** 2

## Accomplishments

- **`messages` table (DB-07):** id (uuid), client_id (FK cascade), lead_id (FK set-null, nullable — chat may predate lead), role (text — 'client'/'ai'/'manager' per spec §2), text (text), createdAt. Three indexes on client_id / lead_id / createdAt. `Message` + `NewMessage` types exported.
- **`calls` table (DB-07):** id, lead_id (FK set-null), direction (text — 'inbound'/'outbound'), duration_s (bigint mode:number, nullable while in-progress), transcript (jsonb default `'[]'::jsonb`), recording_url (nullable text), outcome (text — 'completed'/'no-answer'/'busy'/'voicemail'/…), createdAt. Two indexes on lead_id / createdAt. `Call` + `NewCall` types exported.
- **`bourse_cache` table (DB-07; Phase 2 MATCH-02 fallback):** id, query_hash (text UNIQUE — SHA-256 of normalized from→to→tons→body), source (text — 'ati.su'/'lardi-trans'/'mock'), payload (jsonb), fetched_at (timestamp). uniqueIndex `bourse_cache_query_hash_unq` + source index. `BourseCache` + `NewBourseCache` types exported.
- **`webhook_updates` table (DB-09; Pitfall #5 Telegram idempotency):** bigserial id, source (webhookSourceEnum), external_id (text), payload (jsonb), received_at. Composite `unique('webhook_updates_source_ext_unq').on(t.source, t.externalId)` so the webhook handler can `INSERT … ON CONFLICT (source, external_id) DO NOTHING RETURNING id` and ack-200 on duplicates without re-running side effects. `WebhookUpdate` + `NewWebhookUpdate` types exported.
- **`pricing_config` table (D-19):** key (text PK), value (jsonb), updated_at. Holds Plan 01-09's three canonical keys: `rate_per_km` (kopecks/km), `dir_coef` (object keyed by 'from->to' with fallback), `season_coef` (scalar). `PricingConfig` + `NewPricingConfig` types exported.
- **Schema barrel updated:** `apps/api/src/persistence/schema/index.ts` now re-exports all 13 spec §2 tables alphabetically (5 new in this plan: bourse_cache, calls, messages, pricing_config, webhook_updates). All 13 `pgTable(` declarations confirmed via grep.
- **6 thin per-aggregate repos (D-07):**
  - `trucksRepo`: findById, findByPlate, list ({status?}), create, update (auto-bumps updatedAt)
  - `citiesRepo`: findBySlug, upsert (onConflictDoNothing target slug + re-fetch fallback throws on the impossible case), list
  - `clientsRepo`: findById, findByPhone, findByTelegramId, create, update (auto-bumps updatedAt)
  - `leadsRepo`: findById, listByStage (typed via Lead['stage']), create, update (auto-bumps updatedAt)
  - `ordersRepo`: findById, findByPublicToken (Phase 5 `/track/[token]` driver), listByStatus, create, update (auto-bumps updatedAt)
  - `messagesRepo`: listByClient (desc createdAt + configurable limit), create
- **Repos barrel:** namespace re-export — `export * as trucksRepo from './trucks.js'` x 6 — keeps call sites grep-friendly (`trucksRepo.findById(db, id)`) without exploding the barrel's named-export surface.
- **3 stub tests flipped:** DB-07 (calls/messages/bourse_cache column presence), DB-09 (webhook_updates UNIQUE source-grep), API-02 (repos barrel import + 6 namespace × thin-function shape assertions). Vitest now reports `10 passed | 7 todo (17)`.

## Task Commits

1. **Task 1: 5 channel/config schema tables + barrel append** — `1630923` (feat)
2. **Task 2: 6 thin repos + namespace barrel per D-07** — `c0f7f75` (feat)
3. **Task 3: flip DB-07 / DB-09 / API-02 stub tests to passing** — `a6fe783` (test)

**Plan metadata:** *(committed at end of execution)*

## Files Created/Modified

### Created (12)
- `apps/api/src/persistence/schema/messages.ts` — DB-07 messages
- `apps/api/src/persistence/schema/calls.ts` — DB-07 calls
- `apps/api/src/persistence/schema/bourse_cache.ts` — DB-07 bourse_cache
- `apps/api/src/persistence/schema/webhook_updates.ts` — DB-09 idempotency
- `apps/api/src/persistence/schema/pricing_config.ts` — D-19 config store
- `apps/api/src/persistence/repos/trucks.ts` — 5 funcs (findById/findByPlate/list/create/update)
- `apps/api/src/persistence/repos/cities.ts` — 3 funcs (findBySlug/upsert/list)
- `apps/api/src/persistence/repos/clients.ts` — 5 funcs (findById/findByPhone/findByTelegramId/create/update)
- `apps/api/src/persistence/repos/leads.ts` — 4 funcs (findById/listByStage/create/update)
- `apps/api/src/persistence/repos/orders.ts` — 5 funcs (findById/findByPublicToken/listByStatus/create/update)
- `apps/api/src/persistence/repos/messages.ts` — 2 funcs (listByClient/create)
- `apps/api/src/persistence/repos/index.ts` — namespace barrel (6 repos)

### Modified (2)
- `apps/api/src/persistence/schema/index.ts` — 5 new alphabetical re-exports
- `apps/api/tests/unit/phase-1-stubs.test.ts` — DB-07 / DB-09 / API-02 from `test.todo()` to real `test()`

## Decisions Made

- **`messages.role` and `calls.outcome` are plain `text`, not ENUM.** Both domains are guaranteed to grow (system/broadcast actors; voicemail/dropped/escalated outcomes), and PostgreSQL ENUM migrations require ALTER TYPE for each new value. The producing code paths (Phase 3 telegram pipeline; Phase 3 voice handler) carry the validation set in TypeScript.
- **`calls.transcript` defaults to `'[]'::jsonb`, not `'{}'::jsonb`.** Transcript is an array of `{speaker, text, ts}` segments per spec §5.2; the empty default should match the array shape so consumers can append without a null-check.
- **`messages.client_id` cascades on delete; `lead_id` set-nulls.** Chat history is owned by the client (cascade is privacy-correct on hard delete); a deleted lead must not vacuum the chat that produced it (set-null).
- **`bourse_cache.query_hash` UNIQUE via `uniqueIndex` (not `.unique()` shortcut).** Explicit `'bourse_cache_query_hash_unq'` name makes the ON CONFLICT target in Phase 2's cache writer self-documenting in raw SQL.
- **`webhook_updates.id` is `bigserial`.** Telegram update_id is bigint; voice/gps external ids may also exceed int32. bigserial gives us a numeric PK independent of the external_id semantics.
- **Repos use namespace re-export (`export * as fooRepo`), not `export *`.** Call sites stay grep-friendly (`trucksRepo.findById` is greppable as a unit; `findById` alone is ambiguous across 6 repos).
- **PostGIS-heavy methods deliberately omitted from repos in this plan.** D-08 mandates raw `db.execute(sql\`…\`)` for KNN / ST_DWithin / CTE re-rank. Adding half-baked spatial helpers here would force Phase 2 to refactor them — keep the repo surface to plain CRUD.

## Deviations from Plan

None — plan executed exactly as written. Both Task 1 and Task 2 produced one Biome auto-format pass each (collapsing short single-line index arrays in `calls.ts`, sorting imports in `cities.ts`) — these are zero-discretion `biome check --write` cleanups, not deviations.

## Issues Encountered

**None.** All 13 schema files compile under strict TS; all 7 repo files compile and pass Biome; Vitest unit suite reports `10 passed | 7 todo` exactly as the plan predicted.

## User Setup Required

**None for this plan.** Schema lives in source; the consolidated init migration is still deferred to Plan 01-07's `pnpm db:generate` run. Once Plan 01-07 emits `0001_init.sql`, the developer/verifier will run:

```bash
docker compose up -d postgres
pnpm --filter @ai-logist/api db:generate   # produces 0001_init.sql covering all 13 tables
pnpm --filter @ai-logist/api db:migrate    # applies it

# Verify the 5 new tables landed correctly
docker exec ailogist-postgres psql -U ailogist -d ailogist -c "\d webhook_updates"
# expected: source (webhook_source NOT NULL), external_id (text NOT NULL),
#           UNIQUE (source, external_id) → webhook_updates_source_ext_unq

docker exec ailogist-postgres psql -U ailogist -d ailogist -c "\d bourse_cache"
# expected: query_hash text NOT NULL UNIQUE → bourse_cache_query_hash_unq

docker exec ailogist-postgres psql -U ailogist -d ailogist -c "\d pricing_config"
# expected: key text PRIMARY KEY, value jsonb NOT NULL
```

## Next Phase Readiness

**Plan 01-07 (fastify-skeleton + init migration generation) is unblocked.** Plan 01-07 will:
1. Wire the Fastify v5 app + plugins (db, redis, swagger, sensible, type-provider-zod)
2. Run `pnpm db:generate` to produce the single `0001_init.sql` covering ALL 13 spec §2 tables in one migration (postgis extension already in `0000_postgis_extension.sql` from Plan 01-03)
3. Land `/api/health` with PostGIS_Version() check (flips API-01)

**Phase 1 schema snapshot after Plan 01-06:**
- All 13 spec §2 tables declared: clients, cities, trucks, truck_positions, leads, orders, order_events, calls, messages, bourse_cache, pod_artifacts, webhook_updates, pricing_config
- 6 thin per-aggregate repos: trucks, cities, clients, leads, orders, messages
- All 7 pgEnums in use (lead_stage, order_status, order_event_type, body_type_t, truck_status, client_lang, webhook_source)
- All geo columns honour `geographyPoint` customType + GiST + (nullable-safe) CHECK SRID
- All money columns are `bigint` (kopecks) per D-05
- All FSM-relevant columns in place: lead_stage / order_status / order_event_type ENUMs, version BIGINT columns on leads + orders, UNIQUE(order_id, type) on order_events
- Telegram idempotency primitive in place via `UNIQUE(source, external_id)` on webhook_updates
- DB-01..09 (minus DB-10 seed) + API-02 acceptance tests green

**Carry-over concerns:**
- Live `pnpm db:migrate` smoke against Docker Postgres still pending — Docker daemon blocker on Claude's runner (Plans 01-02 / 01-03 / 01-04 / 01-05 all logged this). Plan 01-07 will need the verifier or developer to run it on a properly configured machine, or Plan 01-10 (readme-smoke) will book it as the end-of-phase verification gate.
- 7 stub tests remain todo: DB-10 (seed — Plan 01-09), API-01 (health route — Plan 01-07), API-16 (Zod request validation — Plan 01-08), DEPLOY-01..04 (compose / env-rejection / workspace resolution / README — Plans 01-07/01-10).

## Self-Check: PASSED

**Files verified:**
- FOUND: apps/api/src/persistence/schema/messages.ts
- FOUND: apps/api/src/persistence/schema/calls.ts
- FOUND: apps/api/src/persistence/schema/bourse_cache.ts
- FOUND: apps/api/src/persistence/schema/webhook_updates.ts
- FOUND: apps/api/src/persistence/schema/pricing_config.ts
- FOUND: apps/api/src/persistence/schema/index.ts (modified — 5 new exports, 13 total table re-exports + _enums + _columns)
- FOUND: apps/api/src/persistence/repos/trucks.ts
- FOUND: apps/api/src/persistence/repos/cities.ts
- FOUND: apps/api/src/persistence/repos/clients.ts
- FOUND: apps/api/src/persistence/repos/leads.ts
- FOUND: apps/api/src/persistence/repos/orders.ts
- FOUND: apps/api/src/persistence/repos/messages.ts
- FOUND: apps/api/src/persistence/repos/index.ts
- FOUND: apps/api/tests/unit/phase-1-stubs.test.ts (modified — 3 todos flipped to test())

**Commits verified:**
- FOUND: 1630923 (Task 1 — feat: 5 schema tables + barrel)
- FOUND: c0f7f75 (Task 2 — feat: 6 thin repos + barrel)
- FOUND: a6fe783 (Task 3 — test: flip DB-07/09 + API-02)

**Invariant counts verified:**
- 13 `pgTable(` declarations across `apps/api/src/persistence/schema/*.ts` (all 13 spec §2 tables present)
- 6 `export * as` lines in `apps/api/src/persistence/repos/index.ts` (matches plan: trucksRepo, citiesRepo, clientsRepo, leadsRepo, ordersRepo, messagesRepo)
- `unique('webhook_updates_source_ext_unq').on(t.source, t.externalId)` declared verbatim in `webhook_updates.ts`
- `uniqueIndex('bourse_cache_query_hash_unq').on(t.queryHash)` declared in `bourse_cache.ts`

**Vitest unit suite:** 10 passed / 7 todo (was 7 / 10 after Plan 01-05); DB-07 / DB-09 / API-02 now green; remaining todos: DB-10, API-01, API-16, DEPLOY-01..04

**TypeScript + Biome:**
- `pnpm exec tsc --noEmit -p apps/api/tsconfig.json` → exit 0
- `pnpm exec biome check apps/api/src/persistence` → exit 0 (23 files)
- `pnpm exec biome check apps/api/tests` → exit 0 (3 files)

## Known Stubs

None. Every artifact produced by this plan is production-shape:
- Schema tables fully express the spec §2 contract (no TODO comments, no placeholder columns).
- Repos return real `Promise<T | undefined>` or `Promise<T[]>` results from Drizzle queries — no mock returns, no `throw new Error('not implemented')`.
- Tests are real assertions, not placeholder `expect(true).toBe(true)`.

The 7 remaining `test.todo()` markers are scoped to future plans (DB-10 seed, API-01 health, API-16 Zod, DEPLOY-01..04) and tracked as the Phase 1 acceptance coverage roadmap, not as stubs in this plan's output.

---
*Phase: 01-database-backend-skeleton*
*Completed: 2026-06-09*
