---
phase: 01-database-backend-skeleton
plan: 04
subsystem: database
tags: [drizzle, postgis, schema, gist, srid, geography, clients, cities, trucks, truck_positions, enums]

# Dependency graph
requires:
  - phase: 01-database-backend-skeleton
    provides: geographyPoint customType + 7 pgEnums + drizzle stack (Plan 01-03)
provides:
  - apps/api/src/persistence/schema/clients.ts — clients table (DB-02 + D-04 tax_id)
  - apps/api/src/persistence/schema/cities.ts — cities table (DB-03 + GiST + CHECK SRID)
  - apps/api/src/persistence/schema/trucks.ts — trucks table (DB-04 + GiST + CHECK SRID)
  - apps/api/src/persistence/schema/truck_positions.ts — GPS history (D-04 demo-credibility)
  - schema/index.ts barrel re-exporting the 4 new tables
  - DB-02 / DB-03 / DB-04 unit tests flipped from .todo() to passing assertions
affects: [01-05 schema-domain (leads/orders reference cities + clients + trucks), 01-06 schema-channels-repos, 01-07 fastify-skeleton (init migration generation), 01-09 seed (consumes all 4 tables)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Every geography column gets BOTH a GiST index AND a CHECK ST_SRID = 4326 (Pitfall #3 / D-02 / D-03)"
    - "Drizzle 0.45.2 callback API returns an ARRAY of indexes/checks (not an object); tuple form: pgTable(name, cols, (t) => [...])"
    - "Foreign-key cascade on history tables — truck_positions.truck_id ON DELETE CASCADE so deleted trucks don't leave orphans"
    - "Idempotency by (truck_id, recorded_at) UNIQUE index on truck_positions enables ON CONFLICT DO NOTHING for replayed GPS pushes"
    - "Stub-test pattern: import the schema object + Object.keys to assert column drizzle-names; grep source files for GiST/CHECK invariants that won't show up in JS property iteration"

key-files:
  created:
    - apps/api/src/persistence/schema/clients.ts
    - apps/api/src/persistence/schema/cities.ts
    - apps/api/src/persistence/schema/trucks.ts
    - apps/api/src/persistence/schema/truck_positions.ts
  modified:
    - apps/api/src/persistence/schema/index.ts (4 new barrel exports, alphabetical order)
    - apps/api/tests/unit/phase-1-stubs.test.ts (DB-02/03/04 flipped from .todo() to real tests)

key-decisions:
  - "Used Drizzle 0.45.2 callback-array API for table indexes (returned ARRAY of index/check builders, not object). Older Drizzle docs show the object form; 0.45.2 requires the tuple form for type inference on getTableConfig()."
  - "truck_positions.truck_id is ON DELETE CASCADE — if a truck is hard-deleted, its position history goes with it. Demo data is recreated on every seed run so this is safe; production would soft-delete trucks instead."
  - "trucks.driver_telegram_id added (D-04) but nullable so Phase 3 driver-onboarding can populate it; spec §2 doesn't list this column but it's required by the bot-driven driver-confirmation loop."
  - "Test strategy: assert in-process schema objects via Object.keys + grep source files for SQL-level invariants (GiST, CHECK). Drizzle's column metadata doesn't expose indexes/checks via public API, so a source grep is the cleanest read. The init migration produced in Plan 01-07 will verify the actual DDL string."
  - "cities.country_code is plain TEXT (not an ENUM) — values include 'RU', 'UA', 'border' (for pograniychnye perekhody). An ENUM would force a migration every time a new country shows up; TEXT is the right shape for a tiny domain that may grow."

patterns-established:
  - "Geo table invariant template: geographyPoint('geom') + .using('gist', t.geom) + check(sql\`ST_SRID(${t.geom}) = 4326\`). All future geo tables (pod_artifacts.gps in Plan 01-05) MUST follow this triple."
  - "Schema files import enums from './_enums.js' and customType from './_columns.js' (ESM .js extensions — NodeNext + type:'module' requirement)."
  - "Per-table file → barrel re-export (alphabetical, Biome organizeImports enforced)."

requirements-completed: [DB-02, DB-03, DB-04]

# Metrics
duration: 2m 12s
completed: 2026-06-09
---

# Phase 01 Plan 04: Schema Geo Summary

**4 geo-bearing tables — clients, cities, trucks, truck_positions — landed in apps/api/src/persistence/schema/ with the full GiST + CHECK SRID=4326 invariant on every geography column. DB-02 / DB-03 / DB-04 stub tests now assert real schema; unit suite 4 passing / 13 todo.**

## Performance

- **Duration:** 2m 12s
- **Started:** 2026-06-09T05:43:48Z
- **Completed:** 2026-06-09T05:46:00Z
- **Tasks:** 2
- **Files created:** 4
- **Files modified:** 2

## Accomplishments

- **`clients` table (DB-02 + D-04):** id (UUID), name, phone (UNIQUE — seed onConflict target), telegram_id, lang (client_lang ENUM, default 'ru'), tax_id, tax_id_country, createdAt, updatedAt. Drizzle inferred `Client` + `NewClient` types exported for repo consumers in Plan 01-06.
- **`cities` table (DB-03):** id, slug (UNIQUE index), name_ru, name_ua, country_code, geom (geography(Point, 4326)), createdAt. GiST index `cities_geom_gist` + CHECK constraint `cities_geom_srid_chk` per Pitfall #3.
- **`trucks` table (DB-04):** id, name, plate_number (UNIQUE — seed onConflict target), driver_name, driver_phone, driver_telegram_id (nullable), capacity_t (bigint mode:number, tonnes), body_type (body_type_t ENUM), geom, status (truck_status ENUM, default 'available'), timestamps. GiST `trucks_geom_gist` + status index `trucks_status_idx` + CHECK `trucks_geom_srid_chk`.
- **`truck_positions` table (D-04 demo-credibility — feeds Phase 5 live tracking):** id, truck_id (FK trucks.id ON DELETE CASCADE), geom, recorded_at, createdAt. UNIQUE index `(truck_id, recorded_at)` for idempotent GPS pushes (Pitfall: replayed Telegram update_id + delayed GPS retry), GiST `truck_positions_geom_gist`, FK index `truck_positions_truck_id_idx`, CHECK SRID=4326.
- **Barrel updated:** `apps/api/src/persistence/schema/index.ts` re-exports all 4 new modules alphabetically (Biome organizeImports auto-sort).
- **3 DB requirement stub tests flipped:** DB-02 / DB-03 / DB-04 now pass real assertions on column names + source-grep invariants. Unit suite reports 4 passing / 13 todo (was 1 passing / 16 todo at end of Plan 01-03).

## Task Commits

1. **Task 1: 4 geo-table schema files + barrel update** — `e0fd0a7` (feat)
2. **Task 2: flip DB-02/03/04 stub tests** — `3faac1d` (test)

**Plan metadata:** *(committed at end of execution)*

## Files Created/Modified

### Created
- `apps/api/src/persistence/schema/clients.ts` — clients table per DB-02 + D-04, exports `clients` / `Client` / `NewClient`.
- `apps/api/src/persistence/schema/cities.ts` — cities table per DB-03 + D-02 SRID CHECK, exports `cities` / `City` / `NewCity`.
- `apps/api/src/persistence/schema/trucks.ts` — trucks table per DB-04 + D-05 bigint, exports `trucks` / `Truck` / `NewTruck`.
- `apps/api/src/persistence/schema/truck_positions.ts` — Phase 5 tracking history table per D-04, exports `truckPositions` / `TruckPosition` / `NewTruckPosition`.

### Modified
- `apps/api/src/persistence/schema/index.ts` — appended 4 alphabetical re-exports (`cities`, `clients`, `truck_positions`, `trucks`).
- `apps/api/tests/unit/phase-1-stubs.test.ts` — DB-02 / DB-03 / DB-04 flipped from `test.todo()` to real `test()` with Object.keys + source-grep assertions.

## Decisions Made

- **`country_code` is TEXT, not an ENUM.** Values today: 'RU', 'UA', 'border'. ENUM would force a migration on every new country/region; TEXT keeps it open. Seed data validates the set at write time.
- **`truck_positions.truck_id` uses ON DELETE CASCADE.** Demo data is recreated by `pnpm seed` on every reset; orphan position rows would clutter the live tracking map. Production would soft-delete trucks instead.
- **`trucks.driver_telegram_id` is added beyond spec §2.** D-04 of CONTEXT.md explicitly extends spec for demo credibility — Phase 3 driver-onboarding bot needs a place to land the chat_id. Nullable so seed data doesn't have to fake it.
- **Drizzle 0.45.2 callback API uses tuple/array form.** `pgTable('name', cols, (t) => [index(...), check(...)])` — older docs (and Drizzle 0.40 examples) use the object form `(t) => ({ ... })`. The array form is the 0.45.2-mandated path that keeps `getTableConfig()` type inference correct.
- **Test assertion strategy: Object.keys + source-grep.** Drizzle's public API doesn't expose indexes/checks at runtime via the table object. The `clients`/`cities`/`trucks`/`truckPositions` objects iterate columns only. To assert the GiST + CHECK invariants we grep the source file. The eventual init migration (Plan 01-07) will produce DDL that a stricter test in that plan can assert against.

## Deviations from Plan

None — plan executed exactly as written. All four schema files, the barrel update, and the three flipped tests landed verbatim from the plan's action block. TypeScript + Biome + Vitest all clean on first run; no auto-fixes needed.

## Issues Encountered

**None.** Plan 01-03's foundation (geographyPoint customType + 7 pgEnums) was correctly shaped — all four schema files imported the foundation symbols and compiled without any TS or Biome fixups.

## User Setup Required

**None for this plan.** The schema lives in source; no migration was generated (that's Plan 01-07's job per the plan's explicit deferral — one combined `0001_init.sql` will cover Waves 3b + 3c + 3d).

When Plan 01-07 generates the init migration, the developer/verifier must run:

```bash
docker compose up -d postgres
pnpm --filter @ai-logist/api db:generate   # produces 0001_init.sql
pnpm --filter @ai-logist/api db:migrate    # applies it
docker exec ailogist-postgres psql -U ailogist -d ailogist -c "\d trucks"
# expected output: geom column type = geography(Point,4326), gist index on geom, CHECK constraint
```

## Next Phase Readiness

**Wave 3c (Plan 01-05, schema-domain) is unblocked.** Plan 01-05 will add `leads`, `orders`, `order_events`, `pod_artifacts` — these all reference the tables shipped here (`leads.client_id → clients.id`, `leads.from_city_id → cities.id`, `leads.matched_truck_id → trucks.id`, `orders.lead_id → leads.id`, `pod_artifacts.order_id → orders.id`). The import path is `import { clients } from './clients.js'` etc., already proven by `truck_positions.ts`.

**Wave 3b snapshot:**
- ✓ All 4 geo-bearing tables declared with strict TS types
- ✓ geographyPoint applied uniformly (3 geo columns: cities.geom, trucks.geom, truck_positions.geom)
- ✓ GiST index on every geo column (Pitfall #3 invariant)
- ✓ CHECK ST_SRID = 4326 on every geo column (Pitfall #3 invariant)
- ✓ ENUMs wired (clients.lang, trucks.body_type, trucks.status)
- ✓ FK cascade on truck_positions
- ✓ UNIQUE indexes on seed-conflict targets (clients.phone, cities.slug, trucks.plate_number, truck_positions.(truck_id, recorded_at))
- ✓ DB-02 / DB-03 / DB-04 acceptance tests green

**Carry-over concerns:**
- `drizzle-kit generate` is deferred to Plan 01-07 so Waves 3b + 3c + 3d ship as ONE init migration. Until then, `apps/api/drizzle/` contains only the `0000_postgis_extension.sql` migration.
- Live `pnpm db:migrate` smoke against Docker Postgres is still deferred (Docker daemon unreachable on this runner — same blocker as Plans 01-02 / 01-03). Verifier or developer must run it on a properly configured machine.

## Self-Check: PASSED

**Files verified:**
- FOUND: apps/api/src/persistence/schema/clients.ts
- FOUND: apps/api/src/persistence/schema/cities.ts
- FOUND: apps/api/src/persistence/schema/trucks.ts
- FOUND: apps/api/src/persistence/schema/truck_positions.ts
- FOUND: apps/api/src/persistence/schema/index.ts (modified)
- FOUND: apps/api/tests/unit/phase-1-stubs.test.ts (modified)

**Commits verified:**
- FOUND: e0fd0a7 (Task 1 — feat)
- FOUND: 3faac1d (Task 2 — test)

**Invariant counts verified:**
- geographyPoint references in schema/: 7 (3 column declarations + 3 CHECK SRID refs + 1 import × 3 files = expected 7 hits)
- `.using('gist',` declarations: 3 (cities, trucks, truck_positions — one per geo table)
- ST_SRID literal occurrences: 5 (3 CHECK constraints + 2 source-doc comments)

**Vitest unit suite:** 4 passed / 13 todo (DB-01..04 green; DB-05..10, API-*, DEPLOY-* still todo)

---
*Phase: 01-database-backend-skeleton*
*Completed: 2026-06-09*
