---
phase: 01-database-backend-skeleton
plan: 04
type: execute
wave: 4
depends_on: ["01-03"]
files_modified:
  - apps/api/src/persistence/schema/clients.ts
  - apps/api/src/persistence/schema/cities.ts
  - apps/api/src/persistence/schema/trucks.ts
  - apps/api/src/persistence/schema/truck_positions.ts
  - apps/api/src/persistence/schema/index.ts
  - apps/api/tests/unit/phase-1-stubs.test.ts
autonomous: true
requirements: ["DB-02", "DB-03", "DB-04"]
must_haves:
  truths:
    - "clients table has lang (client_lang enum), tax_id, tax_id_country per DB-02 + D-04"
    - "cities table has name_ru, name_ua, slug UNIQUE, geom geography(Point, 4326), GiST index on geom, CHECK ST_SRID=4326"
    - "trucks table has geom geography(Point, 4326), GiST index, capacity_t (bigint kopecks-style number), body_type (enum), status (enum), CHECK ST_SRID=4326"
    - "truck_positions has truck_id FK, geom (geography), recorded_at, UNIQUE(truck_id, recorded_at), GiST index"
    - "drizzle-kit generate produces SQL containing 'geography(Point, 4326)', 'USING gist', 'CHECK (ST_SRID(...) = 4326)'"
  artifacts:
    - path: "apps/api/src/persistence/schema/clients.ts"
      provides: "clients table with lang/tax_id/tax_id_country/telegram_id/phone"
      exports: ["clients", "Client", "NewClient"]
    - path: "apps/api/src/persistence/schema/cities.ts"
      provides: "cities table with slug/name_ru/name_ua/country_code/geom + GiST"
      exports: ["cities", "City", "NewCity"]
    - path: "apps/api/src/persistence/schema/trucks.ts"
      provides: "trucks table with geom/capacity_t/body_type/status + GiST + CHECK"
      exports: ["trucks", "Truck", "NewTruck"]
    - path: "apps/api/src/persistence/schema/truck_positions.ts"
      provides: "truck_positions table for tracking history (Phase 5)"
      exports: ["truckPositions", "TruckPosition", "NewTruckPosition"]
  key_links:
    - from: "apps/api/src/persistence/schema/trucks.ts"
      to: "apps/api/src/persistence/schema/_columns.ts (geographyPoint)"
      via: "import + geom column declaration"
      pattern: "geographyPoint\\('geom'\\)"
    - from: "apps/api/src/persistence/schema/cities.ts"
      to: "apps/api/src/persistence/schema/_enums.ts (none directly — uses TEXT for country_code)"
      via: "—"
      pattern: "name_ru"
    - from: "apps/api/src/persistence/schema/truck_positions.ts"
      to: "apps/api/src/persistence/schema/trucks.ts"
      via: "references(() => trucks.id)"
      pattern: "references\\(\\) => trucks"
---

<objective>
Wave 3b ships the four geo-bearing tables: `clients` (DB-02), `cities` (DB-03), `trucks` (DB-04), and `truck_positions` (demo-credibility addition per CONTEXT D-04 — feeds Phase 5 tracking). All geo columns use `geographyPoint` from Wave 3a, all geo columns get GiST index + CHECK SRID=4326 constraint per D-02/D-03 and Pitfall #3.

Purpose: Cover the three Phase 1 DB requirements that block Phase 2's `nearestTruck` KNN query. After this plan, drizzle-kit can generate a valid initial migration containing both the geo DDL and the GiST indexes.

Output: 4 new schema files + updated barrel + flipped DB-02/03/04 stub tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/01-database-backend-skeleton/01-CONTEXT.md
@.planning/phases/01-database-backend-skeleton/01-RESEARCH.md
@CLAUDE.md
@apps/api/src/persistence/schema/index.ts
@apps/api/src/persistence/schema/_enums.ts
@apps/api/src/persistence/schema/_columns.ts
@ai-logist-logic-spec.md
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: clients + cities + trucks + truck_positions schema files</name>
  <read_first>
    - apps/api/src/persistence/schema/_enums.ts (Wave 3a — bodyTypeEnum, truckStatusEnum, clientLangEnum)
    - apps/api/src/persistence/schema/_columns.ts (Wave 3a — geographyPoint)
    - .planning/phases/01-database-backend-skeleton/01-RESEARCH.md — sections "Drizzle schema for trucks with GiST index + CHECK constraint"
    - .planning/phases/01-database-backend-skeleton/01-CONTEXT.md — D-02, D-03, D-04 (clients extensions), D-05 (bigint financial)
    - ai-logist-logic-spec.md §2 (clients, cities, trucks definitions — source of truth)
  </read_first>
  <files>
    - apps/api/src/persistence/schema/clients.ts
    - apps/api/src/persistence/schema/cities.ts
    - apps/api/src/persistence/schema/trucks.ts
    - apps/api/src/persistence/schema/truck_positions.ts
    - apps/api/src/persistence/schema/index.ts
  </files>
  <action>
    Four schema files. Each uses `geographyPoint` from `_columns.js`, enum imports from `_enums.js`. Drizzle 0.45.2 conventions: `pgTable('name', columns, (t) => [indexes...])` (callback returns an ARRAY in 0.45.2+, not an object).

    Important per RESEARCH.md Pitfall #6 + ESM strict: every import inside schema/ uses `.js` extension (NodeNext + ESM).

    **`apps/api/src/persistence/schema/clients.ts`** (DB-02 + D-04 — extended with tax_id/tax_id_country):

    ```typescript
    import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
    import { clientLangEnum } from './_enums.js';

    export const clients = pgTable('clients', {
      id: uuid('id').primaryKey().defaultRandom(),
      name: text('name').notNull(),
      phone: text('phone').notNull().unique(), // E.164, used by seed onConflictDoNothing
      telegramId: text('telegram_id'), // nullable — set when client first writes to bot
      lang: clientLangEnum('lang').notNull().default('ru'),

      // CONTEXT D-04 — demo-credibility extension for legal entity hint
      taxId: text('tax_id'),           // ИНН (RU) / EDRPOU (UA), nullable
      taxIdCountry: text('tax_id_country'), // 'RU' | 'UA', nullable

      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    });

    export type Client = typeof clients.$inferSelect;
    export type NewClient = typeof clients.$inferInsert;
    ```

    **`apps/api/src/persistence/schema/cities.ts`** (DB-03 + D-02 SRID CHECK):

    ```typescript
    import { sql } from 'drizzle-orm';
    import {
      check,
      index,
      pgTable,
      text,
      timestamp,
      uniqueIndex,
      uuid,
    } from 'drizzle-orm/pg-core';
    import { geographyPoint } from './_columns.js';

    export const cities = pgTable(
      'cities',
      {
        id: uuid('id').primaryKey().defaultRandom(),
        slug: text('slug').notNull(), // ASCII Latin canonical (e.g. 'kyiv', 'lviv', 'moscow')
        nameRu: text('name_ru').notNull(),
        nameUa: text('name_ua').notNull(),
        countryCode: text('country_code').notNull(), // 'RU' | 'UA' | 'border'
        geom: geographyPoint('geom').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      },
      (t) => [
        uniqueIndex('cities_slug_unq').on(t.slug),
        index('cities_geom_gist').using('gist', t.geom),
        check('cities_geom_srid_chk', sql`ST_SRID(${t.geom}) = 4326`),
      ]
    );

    export type City = typeof cities.$inferSelect;
    export type NewCity = typeof cities.$inferInsert;
    ```

    **`apps/api/src/persistence/schema/trucks.ts`** (DB-04 — per RESEARCH.md §"Drizzle schema for trucks", with bigint capacity_t per D-05 financial convention adapted to tonnes):

    ```typescript
    import { sql } from 'drizzle-orm';
    import {
      bigint,
      check,
      index,
      pgTable,
      text,
      timestamp,
      uuid,
    } from 'drizzle-orm/pg-core';
    import { bodyTypeEnum, truckStatusEnum } from './_enums.js';
    import { geographyPoint } from './_columns.js';

    export const trucks = pgTable(
      'trucks',
      {
        id: uuid('id').primaryKey().defaultRandom(),
        name: text('name').notNull(),
        plateNumber: text('plate_number').notNull().unique(), // ON CONFLICT in seed
        driverName: text('driver_name').notNull(),
        driverPhone: text('driver_phone').notNull(), // E.164
        driverTelegramId: text('driver_telegram_id'), // nullable; set when driver onboarded in Phase 3
        capacityT: bigint('capacity_t', { mode: 'number' }).notNull(), // tonnes (whole numbers OK)
        bodyType: bodyTypeEnum('body_type').notNull(),
        geom: geographyPoint('geom').notNull(),
        status: truckStatusEnum('status').notNull().default('available'),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      },
      (t) => [
        index('trucks_geom_gist').using('gist', t.geom),
        index('trucks_status_idx').on(t.status),
        check('trucks_geom_srid_chk', sql`ST_SRID(${t.geom}) = 4326`),
      ]
    );

    export type Truck = typeof trucks.$inferSelect;
    export type NewTruck = typeof trucks.$inferInsert;
    ```

    **`apps/api/src/persistence/schema/truck_positions.ts`** (D-04 — history table for Phase 5 tracking):

    ```typescript
    import { sql } from 'drizzle-orm';
    import {
      check,
      index,
      pgTable,
      timestamp,
      uniqueIndex,
      uuid,
    } from 'drizzle-orm/pg-core';
    import { geographyPoint } from './_columns.js';
    import { trucks } from './trucks.js';

    export const truckPositions = pgTable(
      'truck_positions',
      {
        id: uuid('id').primaryKey().defaultRandom(),
        truckId: uuid('truck_id')
          .notNull()
          .references(() => trucks.id, { onDelete: 'cascade' }),
        geom: geographyPoint('geom').notNull(),
        recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      },
      (t) => [
        uniqueIndex('truck_positions_truck_recorded_unq').on(t.truckId, t.recordedAt),
        index('truck_positions_geom_gist').using('gist', t.geom),
        index('truck_positions_truck_id_idx').on(t.truckId),
        check('truck_positions_geom_srid_chk', sql`ST_SRID(${t.geom}) = 4326`),
      ]
    );

    export type TruckPosition = typeof truckPositions.$inferSelect;
    export type NewTruckPosition = typeof truckPositions.$inferInsert;
    ```

    Edit `apps/api/src/persistence/schema/index.ts` — APPEND (do NOT overwrite Wave 3a content):

    ```typescript
    export * from './clients.js';
    export * from './cities.js';
    export * from './trucks.js';
    export * from './truck_positions.js';
    ```

    Final `index.ts` content (verify):
    ```typescript
    export * from './_enums.js';
    export * from './_columns.js';
    export * from './clients.js';
    export * from './cities.js';
    export * from './trucks.js';
    export * from './truck_positions.js';
    ```

    Verify TS compiles: `pnpm exec tsc --noEmit -p apps/api/tsconfig.json`.

    Verify Biome passes: `pnpm exec biome check apps/api/src/persistence/schema`.

    Do NOT run drizzle-kit generate yet — Wave 3c + 3d add more tables and we want ONE init migration. Generation happens in Plan 01-07 (Fastify skeleton + first init migration).
  </action>
  <verify>
    <automated>test -f apps/api/src/persistence/schema/clients.ts && test -f apps/api/src/persistence/schema/cities.ts && test -f apps/api/src/persistence/schema/trucks.ts && test -f apps/api/src/persistence/schema/truck_positions.ts && grep -q "geographyPoint('geom')" apps/api/src/persistence/schema/trucks.ts && grep -q "using('gist'" apps/api/src/persistence/schema/trucks.ts && grep -q "ST_SRID" apps/api/src/persistence/schema/trucks.ts && grep -q "clientLangEnum" apps/api/src/persistence/schema/clients.ts && grep -q "taxId\\|tax_id" apps/api/src/persistence/schema/clients.ts && grep -q "nameRu\\|name_ru" apps/api/src/persistence/schema/cities.ts && grep -q "references" apps/api/src/persistence/schema/truck_positions.ts && pnpm exec tsc --noEmit -p apps/api/tsconfig.json 2>&1 | tail -3 && pnpm exec biome check apps/api/src/persistence/schema 2>&1 | tail -3 && echo OK</automated>
  </verify>
  <done>
    All 4 schema files compile under strict TS; Biome is clean; each geo table uses `geographyPoint` + GiST + CHECK SRID; clients has tax_id columns per D-04; truck_positions FKs to trucks.
  </done>
  <acceptance_criteria>
    - `test -f apps/api/src/persistence/schema/clients.ts && test -f apps/api/src/persistence/schema/cities.ts && test -f apps/api/src/persistence/schema/trucks.ts && test -f apps/api/src/persistence/schema/truck_positions.ts` returns 0
    - `grep -q "tax_id" apps/api/src/persistence/schema/clients.ts && grep -q "tax_id_country" apps/api/src/persistence/schema/clients.ts` returns 0
    - `grep -q "name_ru\\|nameRu" apps/api/src/persistence/schema/cities.ts && grep -q "name_ua\\|nameUa" apps/api/src/persistence/schema/cities.ts` returns 0
    - `grep -q "geographyPoint" apps/api/src/persistence/schema/cities.ts && grep -q "geographyPoint" apps/api/src/persistence/schema/trucks.ts && grep -q "geographyPoint" apps/api/src/persistence/schema/truck_positions.ts` returns 0
    - `grep -c "using('gist'" apps/api/src/persistence/schema/` (counting cities, trucks, truck_positions) is at least 3 (use `grep -r "using('gist'" apps/api/src/persistence/schema/ | wc -l`)
    - `grep -c "ST_SRID" apps/api/src/persistence/schema/` (CHECK constraints) is at least 3 (use `grep -r "ST_SRID" apps/api/src/persistence/schema/ | wc -l`)
    - `grep -q "references(() => trucks.id" apps/api/src/persistence/schema/truck_positions.ts` returns 0
    - `pnpm exec tsc --noEmit -p apps/api/tsconfig.json` exits 0
    - `pnpm exec biome check apps/api/src/persistence/schema` exits 0
    - Final `apps/api/src/persistence/schema/index.ts` re-exports all 4 new modules
  </acceptance_criteria>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Flip DB-02 / DB-03 / DB-04 stub tests to passing — assert generated DDL</name>
  <read_first>
    - apps/api/tests/unit/phase-1-stubs.test.ts (Wave 0 with Wave 3a's DB-01 update)
    - apps/api/src/persistence/schema/clients.ts (Task 1)
    - apps/api/src/persistence/schema/cities.ts (Task 1)
    - apps/api/src/persistence/schema/trucks.ts (Task 1)
    - apps/api/src/persistence/schema/truck_positions.ts (Task 1)
  </read_first>
  <files>
    - apps/api/tests/unit/phase-1-stubs.test.ts
  </files>
  <action>
    Edit `apps/api/tests/unit/phase-1-stubs.test.ts`. Flip three todos (DB-02, DB-03, DB-04) to real assertions. Test strategy: import the Drizzle schema objects and assert the DDL Drizzle would emit via the column metadata. Since drizzle-kit generate happens later in Plan 01-07, here we assert against the in-process schema definitions.

    The simplest, no-dependencies-on-running-DB tests:

    ```typescript
    import { describe, expect, test } from 'vitest';

    // ... keep existing DB-01 test from Wave 3a ...

    describe('Phase 1: Database & Schema (DB-*)', () => {
      test('DB-01: postgis extension loaded in first migration (0000_postgis_extension.sql)', async () => {
        const fs = await import('node:fs/promises');
        const sql = await fs.readFile('drizzle/0000_postgis_extension.sql', 'utf-8');
        expect(sql).toMatch(/CREATE EXTENSION IF NOT EXISTS postgis/i);
      });

      test('DB-02: clients table has lang/tax_id/tax_id_country columns', async () => {
        const { clients } = await import('../../src/persistence/schema/clients.js');
        const cols = Object.keys(clients);
        expect(cols).toContain('lang');
        expect(cols).toContain('taxId');
        expect(cols).toContain('taxIdCountry');
        expect(cols).toContain('telegramId');
        expect(cols).toContain('phone');
      });

      test('DB-03: cities table has name_ru/name_ua + geography(Point, 4326)', async () => {
        const { cities } = await import('../../src/persistence/schema/cities.js');
        const cols = Object.keys(cities);
        expect(cols).toContain('nameRu');
        expect(cols).toContain('nameUa');
        expect(cols).toContain('slug');
        expect(cols).toContain('geom');
        // Verify the customType emits the geography DDL
        const fs = await import('node:fs/promises');
        const src = await fs.readFile('src/persistence/schema/_columns.ts', 'utf-8');
        expect(src).toMatch(/geography\(Point, 4326\)/);
      });

      test('DB-04: trucks table has geom + GiST + CHECK SRID + bigint capacity_t + body_type/status', async () => {
        const { trucks } = await import('../../src/persistence/schema/trucks.js');
        const cols = Object.keys(trucks);
        expect(cols).toContain('geom');
        expect(cols).toContain('capacityT');
        expect(cols).toContain('bodyType');
        expect(cols).toContain('status');
        expect(cols).toContain('plateNumber');
        // Verify schema source declares the GiST index and CHECK constraint
        const fs = await import('node:fs/promises');
        const src = await fs.readFile('src/persistence/schema/trucks.ts', 'utf-8');
        expect(src).toMatch(/using\(['"]gist['"]/);
        expect(src).toMatch(/ST_SRID/);
      });

      test.todo('DB-05: leads table has extended cargo fields + price_overrides jsonb[]');
      test.todo('DB-06: orders + order_events tables with UNIQUE (order_id, type)');
      test.todo('DB-07: calls, messages, bourse_cache tables exist');
      test.todo('DB-08: pod_artifacts table with signature_url, photo_url, gps, captured_at');
      test.todo('DB-09: webhook_updates with UNIQUE(source, external_id) + ON CONFLICT DO NOTHING');
      test.todo('DB-10: seed populates 12 trucks, ~30 cities, 8 clients idempotently');
    });

    // ... keep the other describe blocks (API-*, DEPLOY-*) unchanged ...
    ```

    Run from `apps/api`:
    ```bash
    pnpm exec vitest run --project unit
    ```

    Expected: 4 passing (DB-01..04), 13 todo. Exit 0.
  </action>
  <verify>
    <automated>cd apps/api && pnpm exec vitest run --project unit 2>&1 | tee /tmp/vitest.out | tail -10 && grep -E "Tests.*passed|passed.*todo" /tmp/vitest.out && grep -q "4 passed" /tmp/vitest.out && echo OK</automated>
  </verify>
  <done>
    4 tests passing (DB-01..04); remaining 13 todos still red. Vitest exits 0.
  </done>
  <acceptance_criteria>
    - `cd apps/api && pnpm exec vitest run --project unit 2>&1 | grep -c "✓"` is at least 4 (DB-01..04 passing)
    - `cd apps/api && pnpm exec vitest run --project unit` exits 0
    - File contains 4 active `test(` calls for DB-01 through DB-04 (verify: `grep -c "^      test('DB-0[1-4]" apps/api/tests/unit/phase-1-stubs.test.ts` should be 4)
    - DB-05..10, API-*, DEPLOY-* remain `test.todo()`
  </acceptance_criteria>
</task>

</tasks>

<verification>
- `pnpm exec tsc --noEmit -p apps/api/tsconfig.json` passes
- `pnpm exec biome check apps/api/src/persistence/schema apps/api/tests/unit/phase-1-stubs.test.ts` passes
- `cd apps/api && pnpm exec vitest run --project unit` passes with 4 green / 13 todo
- `grep -r "geographyPoint" apps/api/src/persistence/schema/ | wc -l` returns at least 3 (cities, trucks, truck_positions)
- `grep -r "using('gist'" apps/api/src/persistence/schema/ | wc -l` returns at least 3 (one per geo table)
- `grep -r "ST_SRID" apps/api/src/persistence/schema/ | wc -l` returns at least 3 (one CHECK per geo table)
</verification>

<success_criteria>
1. Four schema files (clients, cities, trucks, truck_positions) compile under strict TS and pass Biome.
2. Every geo column uses `geographyPoint('geom')` from Wave 3a.
3. Every geo table has both a GiST index AND a CHECK ST_SRID=4326 constraint (per D-02/D-03 + Pitfall #3).
4. clients includes tax_id + tax_id_country per D-04.
5. truck_positions has UNIQUE (truck_id, recorded_at) for tracking idempotency (D-04).
6. DB-02, DB-03, DB-04 stub tests now pass; total project unit suite shows 4 passing / 13 todo.
</success_criteria>

<output>
After completion, create `.planning/phases/01-database-backend-skeleton/01-04-SUMMARY.md` documenting:
- Schema file count (4 new, + barrel update)
- `pnpm exec tsc --noEmit` clean
- `pnpm exec biome check` clean
- Vitest unit suite: 4 passing / 13 todo
- Note that drizzle-kit generate is deferred to Plan 01-07 (so we ship ONE init migration covering Waves 3b/3c/3d together)
</output>
