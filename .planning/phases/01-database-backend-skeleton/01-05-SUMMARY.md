---
phase: 01-database-backend-skeleton
plan: 05
subsystem: database
tags: [drizzle, schema, leads, orders, order_events, pod_artifacts, jsonb-array, fsm-idempotency, bigint-kopecks, public-token]

# Dependency graph
requires:
  - phase: 01-database-backend-skeleton
    provides: clients/cities/trucks/_enums/_columns from Plans 01-03 / 01-04 (FK targets + leadStageEnum/orderStatusEnum/orderEventTypeEnum/bodyTypeEnum + geographyPoint)
provides:
  - apps/api/src/persistence/schema/orders.ts — orders table (DB-06 + D-04 public_token + D-05 bigint price + FSM-03 version)
  - apps/api/src/persistence/schema/leads.ts — leads table (DB-05 + D-04 extended cargo + price_overrides jsonb[] + version)
  - apps/api/src/persistence/schema/order_events.ts — order_events table (DB-06 UNIQUE(order_id, type) for FSM idempotency)
  - apps/api/src/persistence/schema/pod_artifacts.ts — pod_artifacts table (DB-08 signature/photo/gps/captured_at)
  - schema/index.ts barrel re-exporting the 4 new tables alphabetically
  - DB-05 / DB-06 / DB-08 unit tests flipped from .todo() to passing
affects:
  - 01-06 schema-channels-repos (calls/messages/bourse_cache/webhook_updates/pricing_config will round out the domain)
  - 01-07 fastify-skeleton (init migration generation — orders/leads/order_events/pod_artifacts now part of the snapshot)
  - 01-08 rest-stubs (orders/leads route stubs will reference the Order/Lead/OrderEvent/PodArtifact types)
  - 01-09 seed (creates orders + leads + pod_artifacts when seeding demo journeys; consumes public_token + status enum)
  - Phase 2 (FSM uses leads.version + orders.version + order_events.UNIQUE for idempotent transitions)
  - Phase 5 (PUBLIC tracking page reads orders.public_token; geofence auto-events use order_events.UNIQUE)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Forward-referencing FK via lazy callback — orders.lead_id is a raw uuid (no .references()) and leads.order_id uses references(() => orders.id) to close the circular ref at runtime. Drizzle's init migration emits ALTER TABLE ADD CONSTRAINT in the correct order."
    - "Nullable-safe SRID CHECK — order_events.geom and pod_artifacts.gps are optional, so the CHECK constraint reads `IS NULL OR ST_SRID(geom) = 4326`. Same shape can be reused for any future optional geo column."
    - "FSM idempotency via UNIQUE(parent_id, type) on event tables — order_events_order_type_unq makes geofence re-fires (Phase 5) and webhook retries no-ops via ON CONFLICT DO NOTHING."
    - "jsonb[] column for audit trails — leads.price_overrides uses jsonb('col').array().default(sql`'{}'::jsonb[]`); each entry will be a {at, who, reason, old_price, new_price} blob appended by the override endpoint in Phase 2."
    - "bigint kopecks everywhere for money — leads.budget/declared_value/quoted_price + orders.price all use bigint(mode:'bigint'); rounding lives in calcPrice (Phase 2), never in the DB."
    - "Optimistic concurrency column — both leads.version and orders.version are bigint(mode:'number') default 0; Phase 2 will UPDATE … WHERE version = $expected RETURNING version to detect FSM races."

key-files:
  created:
    - apps/api/src/persistence/schema/orders.ts
    - apps/api/src/persistence/schema/leads.ts
    - apps/api/src/persistence/schema/order_events.ts
    - apps/api/src/persistence/schema/pod_artifacts.ts
  modified:
    - apps/api/src/persistence/schema/index.ts (4 alphabetical re-exports inserted between clients.js and truck_positions.js)
    - apps/api/tests/unit/phase-1-stubs.test.ts (DB-05 / DB-06 / DB-08 flipped from test.todo() to real test())

key-decisions:
  - "orders before leads in source order — leads.order_id references orders.id. Although Drizzle's lazy `references(() => orders.id)` callback resolves circular refs at runtime, leaving the source-order intuitive (orders first, leads second) avoids confusion for future readers and matches the order the init migration's ALTER TABLE ADD CONSTRAINT statements will run in."
  - "orders.lead_id intentionally has no .references() callback — orders are created from a lead but stand independently; if the lead is later force-deleted (demo cleanup), we don't want the order to vanish or block. leads.order_id carries the FK constraint instead."
  - "publicToken is text not uuid — Phase 5's /track/[token] URL is shortlink-aesthetic ('aB3xZ9..'), generated via nanoid 5 in Plan 01-09 seed/Plan 02-* createOrder. uuid would work but bloat the URL; text + UNIQUE is the right shape."
  - "currency column on orders is plain text default 'RUB' — for v1 we only need {RUB, UAH} and an ENUM forces a migration for every new currency. Validation moves to the createOrder handler in Phase 2."
  - "order_events.actor stored as text not ENUM — values are {ai, manager, system, driver} per FSM-05 with the possibility of new actor types (geofence, webhook, scheduler) as Phase 5 lands. ENUM would force a migration; text + write-time validation in the appendEvent helper is more flexible."
  - "pod_artifacts has no GiST on gps — POD points are written once per order at delivery and never queried by KNN/radius. GiST adds write cost for zero read benefit until a hypothetical Phase 6 'delivered-density heatmap' feature appears."
  - "Test assertion strategy mirrors Plan 01-04 — Object.keys(schemaObj) for column presence + source-grep for SQL-level invariants (UNIQUE, jsonb[]) that Drizzle's public runtime API doesn't expose. Plan 01-07's init migration will permit DDL-string-level assertions in stricter tests later."

patterns-established:
  - "Domain table template for FSM-driven aggregates: pgEnum status column + bigint version column for optimistic concurrency + dedicated _events table with UNIQUE(parent_id, type) for FSM idempotency."
  - "Forward FK pattern: declare both tables; the dependent (leads.order_id → orders.id) uses references(() => orders.id) callback; the independent (orders.lead_id) is a bare uuid column. Drizzle handles the migration ordering."
  - "Schema files import enums from './_enums.js' and customType from './_columns.js' — established Plan 01-04, reinforced here. Biome organizeImports sorts alphabetically."

requirements-completed: [DB-05, DB-06, DB-08]

# Metrics
duration: 2m 30s
completed: 2026-06-09
---

# Phase 01 Plan 05: Schema Domain Summary

**Four domain tables — orders, leads, order_events, pod_artifacts — landed in apps/api/src/persistence/schema/ with FSM-ready columns (status enums + version concurrency), public_token for Phase 5 tracking, extended cargo + price_overrides jsonb[] audit on leads, and UNIQUE(order_id, type) idempotency on order_events. DB-05 / DB-06 / DB-08 stub tests now passing; unit suite 7 passed / 10 todo.**

## Performance

- **Duration:** 2m 30s
- **Started:** 2026-06-09T05:49:54Z
- **Completed:** 2026-06-09T05:52:24Z
- **Tasks:** 2
- **Files created:** 4
- **Files modified:** 2

## Accomplishments

- **`orders` table (DB-06 + D-04 + D-05):** id (UUID), number (text UNIQUE — human-readable '#KU-4471'), lead_id (uuid — bare, no FK to allow lead deletion), client_id (FK restrict), truck_id (FK set-null), from_city_id / to_city_id (FK cities), distance_km (numeric 10,2), price (bigint kopecks per D-05), currency (text default 'RUB'), status (order_status ENUM default 'CREATED'), **public_token (text UNIQUE)** for Phase 5 PUBLIC-01/02 `/track/[token]`, **version (bigint default 0)** for FSM-03 optimistic concurrency, timestamps. Indexes on status, client_id, lead_id. `Order` + `NewOrder` types exported.
- **`leads` table (DB-05 + D-04 + D-05):** id, client_id (FK restrict), channel (text — telegram/call), stage (lead_stage ENUM default 'NEW'), from/to cities, tons (numeric), body_type (ENUM nullable), budget (bigint kopecks), **5 extended cargo fields per D-04** (volume_m3, dimensions_lxwxh, packaging, adr_class, declared_value), matched_truck_id (FK), quoted_price (bigint kopecks), order_id (FK orders.id — forward ref via lazy callback), **price_overrides jsonb[]** with default `'{}'::jsonb[]` for the audit-log endpoint, **version (bigint default 0)** for FSM-03, timestamps. Indexes on stage, client_id. `Lead` + `NewLead` types exported.
- **`order_events` table (DB-06 + TRACK-04):** id, order_id (FK cascade), type (order_event_type ENUM), actor (text default 'system' — 'ai'/'manager'/'system'/'driver'), payload (jsonb default `'{}'::jsonb`), geom (geography(Point, 4326) **nullable** — only geofence events carry GPS), createdAt. **`uniqueIndex(order_id, type)` enforces FSM auto-transition idempotency** — Phase 5 geofence re-fires become ON CONFLICT no-ops. `order_id` lookup index + nullable-safe CHECK SRID. `OrderEvent` + `NewOrderEvent` types exported.
- **`pod_artifacts` table (DB-08):** id, order_id (FK cascade), signature_url (nullable), photo_url (nullable), gps (geography(Point, 4326) nullable), captured_at (timestamp), createdAt. `order_id` index + nullable-safe CHECK SRID. No GiST on gps (POD points are write-once and never queried spatially). `PodArtifact` + `NewPodArtifact` types exported.
- **Barrel updated:** `apps/api/src/persistence/schema/index.ts` now re-exports all four new modules in alphabetical position (leads, order_events, orders, pod_artifacts), keeping Biome organizeImports happy.
- **3 DB requirement stub tests flipped:** DB-05 / DB-06 / DB-08 now pass real assertions on column names + source-grep invariants. Unit suite reports 7 passed / 10 todo (was 4 / 13 after Plan 01-04). Remaining todos: DB-07, DB-09, DB-10, all API-*, all DEPLOY-*.

## Forward FK Compilation Confirmation

The plan's specific concern — that `leads.order_id` references `orders.id` while `orders` is declared in a separate file imported AFTER leads in the alphabetical barrel — was verified:

- `apps/api/src/persistence/schema/leads.ts` line 20: `import { orders } from './orders.js';`
- `apps/api/src/persistence/schema/leads.ts` line 56: `orderId: uuid('order_id').references(() => orders.id),` — lazy callback resolves at runtime, not at import.
- `apps/api/src/persistence/schema/order_events.ts`: `references(() => orders.id, { onDelete: 'cascade' })` — same pattern.
- `apps/api/src/persistence/schema/pod_artifacts.ts`: `references(() => orders.id, { onDelete: 'cascade' })` — same pattern.
- `pnpm exec tsc --noEmit -p apps/api/tsconfig.json` → exit 0
- `pnpm exec biome check apps/api/src/persistence/schema apps/api/tests` → exit 0
- `cd apps/api && pnpm exec vitest run --project unit` → 7 passed / 10 todo, exit 0

Drizzle's lazy callback API (`references(() => target.id)`) is exactly the documented escape hatch for circular FKs — the callback is evaluated when Drizzle Kit walks the schema graph to emit DDL, by which time both tables have been registered.

## Task Commits

1. **Task 1: orders + leads + order_events + pod_artifacts schema files + barrel update** — `32c3035` (feat)
2. **Task 2: flip DB-05/06/08 stub tests to passing** — `44b92bf` (test)

**Plan metadata:** *(committed at end of execution)*

## Files Created/Modified

### Created
- `apps/api/src/persistence/schema/orders.ts` — orders table per DB-06 + D-04 public_token + D-05 bigint price, exports `orders` / `Order` / `NewOrder`.
- `apps/api/src/persistence/schema/leads.ts` — leads table per DB-05 + D-04 extended cargo + price_overrides jsonb[], exports `leads` / `Lead` / `NewLead`.
- `apps/api/src/persistence/schema/order_events.ts` — order_events with UNIQUE(order_id, type) for FSM idempotency, exports `orderEvents` / `OrderEvent` / `NewOrderEvent`.
- `apps/api/src/persistence/schema/pod_artifacts.ts` — pod_artifacts per DB-08, exports `podArtifacts` / `PodArtifact` / `NewPodArtifact`.

### Modified
- `apps/api/src/persistence/schema/index.ts` — appended 4 alphabetical re-exports (leads, order_events, orders, pod_artifacts).
- `apps/api/tests/unit/phase-1-stubs.test.ts` — DB-05 / DB-06 / DB-08 flipped from `test.todo()` to real `test()` with Object.keys + source-grep assertions.

## Decisions Made

- **`orders` declared before `leads` in source ordering.** Although Drizzle's lazy `references(() => orders.id)` resolves circular refs at runtime, declaring orders first keeps the conceptual flow intuitive (a lead becomes an order; order is the more "stable" entity).
- **`orders.lead_id` has no FK callback.** Orders are created from a lead but stand independently — deleting the lead later (demo cleanup) shouldn't cascade or block the order. `leads.order_id` carries the FK constraint instead, making the relationship navigable from the lead side.
- **`publicToken` is `text` not `uuid`.** Phase 5's `/track/[token]` URL is meant to look short and shareable ('aB3xZ9rQ'). `nanoid` 5 will generate the values in Plan 01-09 seed / Phase 2 createOrder. `uuid` would balloon the URL; `text` + UNIQUE is the right shape.
- **`currency` is `text` default 'RUB' not an ENUM.** For v1 the domain is {RUB, UAH}; ENUM would force a migration for any new currency. Validation lives in createOrder (Phase 2).
- **`order_events.actor` is `text` not an ENUM.** Values are {ai, manager, system, driver} today with likely additions (geofence, webhook, scheduler) in Phase 5. `text` + write-time validation in the appendEvent helper is more flexible than churning an ENUM.
- **`pod_artifacts.gps` has no GiST index.** POD points are written once per order at delivery and never queried by `<->` KNN / `ST_DWithin`. Adding GiST would pay write cost for zero read benefit until a hypothetical "delivered-density heatmap" feature appears (Phase 6).
- **Nullable-safe SRID CHECK pattern** — `${col} IS NULL OR ST_SRID(${col}) = 4326`. Used by both `order_events.geom` and `pod_artifacts.gps`. Mandatory invariant whenever a geo column is optional.

## Deviations from Plan

None — plan executed exactly as written. Both task action blocks landed verbatim. After Task 1's Write tool calls, Biome's `--write` was used once to auto-format imports (single-line collapse, alphabetical sort) per the project's organizeImports rule — this is the standard zero-discretion formatting cleanup, not a deviation. TypeScript + Biome + Vitest all clean.

## Issues Encountered

**None.** The Plan 01-04 foundation (clients/cities/trucks/truck_positions + 7 pgEnums + geographyPoint customType) provided every import the new tables needed, and the lazy `references(() => x.id)` callback handled the leads↔orders circular FK cleanly. No TS or Biome fixups beyond the one auto-format pass.

## User Setup Required

**None for this plan.** Same as Plan 01-04 — schema lives in source; no migration generated yet (deferred to Plan 01-07's single combined `0001_init.sql`).

When Plan 01-07 generates the init migration, the developer/verifier will run:

```bash
docker compose up -d postgres
pnpm --filter @ai-logist/api db:generate    # produces 0001_init.sql covering all 13 tables
pnpm --filter @ai-logist/api db:migrate     # applies it
docker exec ailogist-postgres psql -U ailogist -d ailogist -c "\d orders"
# expected: public_token (text NOT NULL UNIQUE), price (bigint NOT NULL), status (order_status enum), version (bigint NOT NULL DEFAULT 0)
docker exec ailogist-postgres psql -U ailogist -d ailogist -c "\d+ order_events"
# expected: UNIQUE INDEX order_events_order_type_unq ON (order_id, type)
docker exec ailogist-postgres psql -U ailogist -d ailogist -c "\d+ leads"
# expected: price_overrides jsonb[] DEFAULT '{}'::jsonb[]
```

## Next Phase Readiness

**Wave 3d (Plan 01-06, schema-channels-repos) is unblocked.** Plan 01-06 will add `calls`, `messages`, `bourse_cache`, `webhook_updates`, `pricing_config` and the thin repo layer. Most of those tables are standalone (no FKs into orders/leads), but `messages.client_id` and `calls.client_id` will land FKs to `clients.id` (already exported). All four tables shipped here are now importable from the barrel.

**Phase 1 schema snapshot after Plan 01-05:**
- ✓ 9 of 13 planned tables declared (`clients`, `cities`, `trucks`, `truck_positions`, `orders`, `leads`, `order_events`, `pod_artifacts`, plus the two `_*` helper files)
- ✓ All geo columns follow the GiST+CHECK SRID invariant (or nullable-safe CHECK for `order_events.geom` / `pod_artifacts.gps`)
- ✓ All FSM-relevant columns in place: `leads.stage`, `leads.version`, `orders.status`, `orders.version`, `orders.public_token`, `order_events.type` + UNIQUE
- ✓ All financial columns are `bigint` (kopecks) per D-05
- ✓ Extended cargo + price audit log on `leads` per D-04
- ✓ Forward FK (`leads.order_id` → `orders.id`) compiles + types via lazy callback
- ✓ DB-05 / DB-06 / DB-08 acceptance tests green

**Carry-over concerns:**
- `drizzle-kit generate` still deferred to Plan 01-07. After Plan 01-06 lands the last 5 tables, the single `0001_init.sql` will cover the entire Phase 1 DDL.
- Live `pnpm db:migrate` smoke against Docker Postgres still pending — same Docker daemon blocker as Plans 01-02 / 01-03 / 01-04. Verifier or developer must run it on a properly configured machine once the migration exists.

## Self-Check: PASSED

**Files verified:**
- FOUND: apps/api/src/persistence/schema/orders.ts
- FOUND: apps/api/src/persistence/schema/leads.ts
- FOUND: apps/api/src/persistence/schema/order_events.ts
- FOUND: apps/api/src/persistence/schema/pod_artifacts.ts
- FOUND: apps/api/src/persistence/schema/index.ts (modified — 4 new exports)
- FOUND: apps/api/tests/unit/phase-1-stubs.test.ts (modified — 3 todos flipped)

**Commits verified:**
- FOUND: 32c3035 (Task 1 — feat: 4 schema files + barrel)
- FOUND: 44b92bf (Task 2 — test: flip DB-05/06/08)

**Invariant counts verified:**
- 5 extended cargo cols in leads.ts (volumeM3, dimensionsLxwxh, packaging, adrClass, declaredValue): present
- `priceOverrides: jsonb('price_overrides').array().notNull().default(sql\`'{}'::jsonb[]\`)`: present
- `publicToken: text('public_token').notNull().unique()`: present
- `uniqueIndex('order_events_order_type_unq').on(t.orderId, t.type)`: present
- 4 `bigint(..., { mode: 'bigint' })` money columns total (orders.price, leads.budget, leads.declaredValue, leads.quotedPrice)
- 2 nullable-safe SRID CHECKs (order_events.geom, pod_artifacts.gps)

**Vitest unit suite:** 7 passed / 10 todo (DB-01..06 + DB-08 green; DB-07/09/10, all API-*, all DEPLOY-* still todo)

**TypeScript + Biome:** apps/api/tsconfig.json `tsc --noEmit` exit 0; `biome check apps/api/src/persistence/schema apps/api/tests` exit 0

---
*Phase: 01-database-backend-skeleton*
*Completed: 2026-06-09*
