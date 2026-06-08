---
phase: 01-database-backend-skeleton
plan: 05
type: execute
wave: 5
depends_on: ["01-04"]
files_modified:
  - apps/api/src/persistence/schema/orders.ts
  - apps/api/src/persistence/schema/leads.ts
  - apps/api/src/persistence/schema/order_events.ts
  - apps/api/src/persistence/schema/pod_artifacts.ts
  - apps/api/src/persistence/schema/index.ts
  - apps/api/tests/unit/phase-1-stubs.test.ts
autonomous: true
requirements: ["DB-05", "DB-06", "DB-08"]
must_haves:
  truths:
    - "leads table has extended cargo fields (volume_m3, dimensions_lxwxh, packaging, adr_class, declared_value) per D-04"
    - "leads.price_overrides is jsonb[] (array) for audit log per D-04"
    - "leads.version is bigint with default 0 for optimistic concurrency (FSM races defense)"
    - "leads.budget, leads.declared_value, leads.quoted_price are bigint (kopecks) per D-05"
    - "orders table has public_token UNIQUE (for Phase 5 /track/[token]) per D-04"
    - "order_events has UNIQUE (order_id, type) per DB-06 (FSM auto-transition idempotency)"
    - "pod_artifacts has signature_url, photo_url, gps (geography), captured_at per DB-08"
  artifacts:
    - path: "apps/api/src/persistence/schema/orders.ts"
      provides: "orders table — number, lead_id, client_id, truck_id, distance_km, price, currency, status, public_token"
      exports: ["orders", "Order", "NewOrder"]
    - path: "apps/api/src/persistence/schema/leads.ts"
      provides: "leads table with extended cargo + price_overrides jsonb[] + version column"
      exports: ["leads", "Lead", "NewLead"]
    - path: "apps/api/src/persistence/schema/order_events.ts"
      provides: "order_events table with UNIQUE (order_id, type) for FSM idempotency"
      exports: ["orderEvents", "OrderEvent", "NewOrderEvent"]
    - path: "apps/api/src/persistence/schema/pod_artifacts.ts"
      provides: "pod_artifacts table — signature_url, photo_url, gps (geography), captured_at"
      exports: ["podArtifacts", "PodArtifact", "NewPodArtifact"]
  key_links:
    - from: "apps/api/src/persistence/schema/leads.ts"
      to: "apps/api/src/persistence/schema/clients.ts + orders.ts + trucks.ts + cities.ts + _enums.ts"
      via: "references() FKs + leadStageEnum"
      pattern: "references\\(\\)"
    - from: "apps/api/src/persistence/schema/orders.ts"
      to: "apps/api/src/persistence/schema/leads.ts (lead_id), clients.ts, trucks.ts, cities.ts"
      via: "references() FKs + orderStatusEnum"
      pattern: "references\\(\\)"
    - from: "apps/api/src/persistence/schema/order_events.ts"
      to: "apps/api/src/persistence/schema/orders.ts + orderEventTypeEnum"
      via: "FK + UNIQUE (order_id, type)"
      pattern: "uniqueIndex.*orderId.*type"
---

<objective>
Wave 3c ships the four domain tables that drive the funnel and order lifecycle: `orders` (lead → order conversion with public_token for Phase 5 tracking), `leads` (the central CRM funnel object with extended cargo + price_overrides audit log + version concurrency column), `order_events` (FSM timeline with UNIQUE idempotency for Phase 5 geofence auto-transitions), and `pod_artifacts` (Proof of Delivery with geography column for delivery-site GPS).

Note ordering: `orders` BEFORE `leads` because leads has FK `order_id` referencing orders. Drizzle resolves circular FK refs at runtime, but source order avoids the issue.

Purpose: Close DB-05 (extended cargo + price audit), DB-06 (orders + order_events UNIQUE), DB-08 (POD). Lock the schema down for the funnel + lifecycle FSMs that Phase 2 implements.

Output: 4 new schema files + updated barrel + flipped DB-05/06/08 stub tests.
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
@apps/api/src/persistence/schema/clients.ts
@apps/api/src/persistence/schema/cities.ts
@apps/api/src/persistence/schema/trucks.ts
@apps/api/src/persistence/schema/_enums.ts
@apps/api/src/persistence/schema/_columns.ts
@ai-logist-logic-spec.md
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: orders + leads + order_events + pod_artifacts schema files</name>
  <read_first>
    - apps/api/src/persistence/schema/clients.ts (Wave 3b — clients.id for FK)
    - apps/api/src/persistence/schema/cities.ts (Wave 3b — cities.id for FK)
    - apps/api/src/persistence/schema/trucks.ts (Wave 3b — trucks.id for FK)
    - apps/api/src/persistence/schema/_enums.ts (Wave 3a — leadStageEnum, orderStatusEnum, orderEventTypeEnum, bodyTypeEnum)
    - apps/api/src/persistence/schema/_columns.ts (Wave 3a — geographyPoint)
    - .planning/phases/01-database-backend-skeleton/01-RESEARCH.md — section "leads table with extended cargo fields + price_overrides jsonb[]"
    - .planning/phases/01-database-backend-skeleton/01-CONTEXT.md — D-04 (price_overrides, public_token, pod_artifacts), D-05 (bigint kopecks)
    - ai-logist-logic-spec.md §2 (orders, leads, order_events definitions)
    - ai-logist-logic-spec.md §4.4, §4.5 (FSM stage/status definitions)
  </read_first>
  <files>
    - apps/api/src/persistence/schema/orders.ts
    - apps/api/src/persistence/schema/leads.ts
    - apps/api/src/persistence/schema/order_events.ts
    - apps/api/src/persistence/schema/pod_artifacts.ts
    - apps/api/src/persistence/schema/index.ts
  </files>
  <action>
    Four schema files. Mind the order: orders before leads (because leads.order_id references orders.id).

    **`apps/api/src/persistence/schema/orders.ts`** (DB-06 + D-04 public_token + D-05 bigint price):

    ```typescript
    import {
      bigint,
      index,
      numeric,
      pgTable,
      text,
      timestamp,
      uuid,
    } from 'drizzle-orm/pg-core';
    import { clients } from './clients.js';
    import { cities } from './cities.js';
    import { trucks } from './trucks.js';
    import { orderStatusEnum } from './_enums.js';

    export const orders = pgTable(
      'orders',
      {
        id: uuid('id').primaryKey().defaultRandom(),
        number: text('number').notNull().unique(), // human-readable '#KU-4471'
        leadId: uuid('lead_id'), // set after creation; FK added in leads table to avoid circular
        clientId: uuid('client_id')
          .notNull()
          .references(() => clients.id, { onDelete: 'restrict' }),
        truckId: uuid('truck_id').references(() => trucks.id, { onDelete: 'set null' }),
        fromCityId: uuid('from_city_id').references(() => cities.id),
        toCityId: uuid('to_city_id').references(() => cities.id),

        distanceKm: numeric('distance_km', { precision: 10, scale: 2 }), // road km
        price: bigint('price', { mode: 'bigint' }).notNull(), // kopecks per D-05
        currency: text('currency').notNull().default('RUB'), // 'RUB' | 'UAH'

        status: orderStatusEnum('status').notNull().default('CREATED'),

        // CONTEXT D-04 — public_token for /track/[token] (Phase 5 PUBLIC-01/02)
        publicToken: text('public_token').notNull().unique(),

        // CONTEXT FSM-03 — optimistic concurrency (Phase 2)
        version: bigint('version', { mode: 'number' }).notNull().default(0),

        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
      },
      (t) => [
        index('orders_status_idx').on(t.status),
        index('orders_client_id_idx').on(t.clientId),
        index('orders_lead_id_idx').on(t.leadId),
      ]
    );

    export type Order = typeof orders.$inferSelect;
    export type NewOrder = typeof orders.$inferInsert;
    ```

    **`apps/api/src/persistence/schema/leads.ts`** (DB-05 — extended cargo + price_overrides; copy VERBATIM from RESEARCH.md §"`leads` table"):

    ```typescript
    import { sql } from 'drizzle-orm';
    import {
      bigint,
      index,
      jsonb,
      numeric,
      pgTable,
      text,
      timestamp,
      uuid,
    } from 'drizzle-orm/pg-core';
    import { clients } from './clients.js';
    import { cities } from './cities.js';
    import { trucks } from './trucks.js';
    import { orders } from './orders.js';
    import { leadStageEnum, bodyTypeEnum } from './_enums.js';

    export const leads = pgTable(
      'leads',
      {
        id: uuid('id').primaryKey().defaultRandom(),
        clientId: uuid('client_id')
          .notNull()
          .references(() => clients.id, { onDelete: 'restrict' }),
        channel: text('channel').notNull(), // 'telegram' | 'call'
        stage: leadStageEnum('stage').notNull().default('NEW'),
        fromCityId: uuid('from_city_id').references(() => cities.id),
        toCityId: uuid('to_city_id').references(() => cities.id),
        tons: numeric('tons', { precision: 10, scale: 2 }),
        bodyType: bodyTypeEnum('body_type'),
        budget: bigint('budget', { mode: 'bigint' }), // kopecks per D-05

        // CONTEXT D-04 — extended cargo fields (demo-credibility)
        volumeM3: numeric('volume_m3', { precision: 10, scale: 2 }),
        dimensionsLxwxh: text('dimensions_lxwxh'), // 'LxWxH' string per CONTEXT D-04
        packaging: text('packaging'),
        adrClass: text('adr_class'),
        declaredValue: bigint('declared_value', { mode: 'bigint' }), // kopecks

        matchedTruckId: uuid('matched_truck_id').references(() => trucks.id),
        quotedPrice: bigint('quoted_price', { mode: 'bigint' }), // kopecks
        orderId: uuid('order_id').references(() => orders.id),

        // CONTEXT D-04 — price override audit log
        priceOverrides: jsonb('price_overrides')
          .array()
          .notNull()
          .default(sql`'{}'::jsonb[]`),

        // CONTEXT FSM-03 — optimistic concurrency (Phase 2)
        version: bigint('version', { mode: 'number' }).notNull().default(0),

        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
      },
      (t) => [
        index('leads_stage_idx').on(t.stage),
        index('leads_client_id_idx').on(t.clientId),
      ]
    );

    export type Lead = typeof leads.$inferSelect;
    export type NewLead = typeof leads.$inferInsert;
    ```

    **`apps/api/src/persistence/schema/order_events.ts`** (DB-06 — UNIQUE (order_id, type) for FSM idempotency):

    ```typescript
    import { sql } from 'drizzle-orm';
    import {
      check,
      index,
      jsonb,
      pgTable,
      timestamp,
      uniqueIndex,
      uuid,
    } from 'drizzle-orm/pg-core';
    import { geographyPoint } from './_columns.js';
    import { orders } from './orders.js';
    import { orderEventTypeEnum } from './_enums.js';

    export const orderEvents = pgTable(
      'order_events',
      {
        id: uuid('id').primaryKey().defaultRandom(),
        orderId: uuid('order_id')
          .notNull()
          .references(() => orders.id, { onDelete: 'cascade' }),
        type: orderEventTypeEnum('type').notNull(),
        actor: text('actor').notNull().default('system'), // 'ai' | 'manager' | 'system' per FSM-05
        payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
        geom: geographyPoint('geom'), // nullable — geofence events have it; manual transitions don't
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      },
      (t) => [
        // DB-06 + TRACK-04: UNIQUE prevents double-fire on geofence re-entry (Phase 5)
        uniqueIndex('order_events_order_type_unq').on(t.orderId, t.type),
        index('order_events_order_id_idx').on(t.orderId),
        check('order_events_geom_srid_chk', sql`${t.geom} IS NULL OR ST_SRID(${t.geom}) = 4326`),
      ]
    );

    export type OrderEvent = typeof orderEvents.$inferSelect;
    export type NewOrderEvent = typeof orderEvents.$inferInsert;
    ```

    **`apps/api/src/persistence/schema/pod_artifacts.ts`** (DB-08 — Proof of Delivery):

    ```typescript
    import { sql } from 'drizzle-orm';
    import {
      check,
      index,
      pgTable,
      text,
      timestamp,
      uuid,
    } from 'drizzle-orm/pg-core';
    import { geographyPoint } from './_columns.js';
    import { orders } from './orders.js';

    export const podArtifacts = pgTable(
      'pod_artifacts',
      {
        id: uuid('id').primaryKey().defaultRandom(),
        orderId: uuid('order_id')
          .notNull()
          .references(() => orders.id, { onDelete: 'cascade' }),
        signatureUrl: text('signature_url'), // S3-style URL — nullable; demo stub
        photoUrl: text('photo_url'),         // nullable
        gps: geographyPoint('gps'),          // nullable — set when driver captures location
        capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      },
      (t) => [
        index('pod_artifacts_order_id_idx').on(t.orderId),
        check('pod_artifacts_gps_srid_chk', sql`${t.gps} IS NULL OR ST_SRID(${t.gps}) = 4326`),
      ]
    );

    export type PodArtifact = typeof podArtifacts.$inferSelect;
    export type NewPodArtifact = typeof podArtifacts.$inferInsert;
    ```

    Edit `apps/api/src/persistence/schema/index.ts` — APPEND in correct order (orders before leads is irrelevant for re-export but matters for FK reading):

    ```typescript
    export * from './orders.js';
    export * from './leads.js';
    export * from './order_events.js';
    export * from './pod_artifacts.js';
    ```

    Verify TS compiles. Verify Biome passes. Do NOT run drizzle-kit generate yet (Plan 01-07 does it).
  </action>
  <verify>
    <automated>test -f apps/api/src/persistence/schema/orders.ts && test -f apps/api/src/persistence/schema/leads.ts && test -f apps/api/src/persistence/schema/order_events.ts && test -f apps/api/src/persistence/schema/pod_artifacts.ts && grep -q "price_overrides" apps/api/src/persistence/schema/leads.ts && grep -q "jsonb('price_overrides').array()" apps/api/src/persistence/schema/leads.ts && grep -q "dimensions_lxwxh\\|dimensionsLxwxh" apps/api/src/persistence/schema/leads.ts && grep -q "public_token\\|publicToken" apps/api/src/persistence/schema/orders.ts && grep -q "uniqueIndex.*orderId.*type" apps/api/src/persistence/schema/order_events.ts && grep -q "signature_url\\|signatureUrl" apps/api/src/persistence/schema/pod_artifacts.ts && pnpm exec tsc --noEmit -p apps/api/tsconfig.json 2>&1 | tail -3 && pnpm exec biome check apps/api/src/persistence/schema 2>&1 | tail -3 && echo OK</automated>
  </verify>
  <done>
    4 schema files compile under strict TS; Biome clean; price_overrides is jsonb[] with default '{}'::jsonb[]; orders.public_token is UNIQUE; order_events has UNIQUE (orderId, type); pod_artifacts has gps geography column with SRID CHECK; all extended cargo fields per D-04 present in leads.
  </done>
  <acceptance_criteria>
    - `test -f apps/api/src/persistence/schema/orders.ts && test -f apps/api/src/persistence/schema/leads.ts && test -f apps/api/src/persistence/schema/order_events.ts && test -f apps/api/src/persistence/schema/pod_artifacts.ts` returns 0
    - `grep -q "jsonb('price_overrides')" apps/api/src/persistence/schema/leads.ts && grep -q "\\.array()" apps/api/src/persistence/schema/leads.ts` returns 0
    - `grep -E "volume_m3|volumeM3" apps/api/src/persistence/schema/leads.ts && grep -E "dimensions_lxwxh|dimensionsLxwxh" apps/api/src/persistence/schema/leads.ts && grep -q "packaging" apps/api/src/persistence/schema/leads.ts && grep -q "adr_class\\|adrClass" apps/api/src/persistence/schema/leads.ts && grep -q "declared_value\\|declaredValue" apps/api/src/persistence/schema/leads.ts` returns 0 (all 5 extended cargo fields present)
    - `grep -q "version.*default(0)" apps/api/src/persistence/schema/leads.ts` returns 0 (FSM-03 concurrency column)
    - `grep -q "public_token\\|publicToken" apps/api/src/persistence/schema/orders.ts && grep -q "\\.unique()" apps/api/src/persistence/schema/orders.ts` returns 0
    - `grep -q "bigint.*mode.*bigint" apps/api/src/persistence/schema/orders.ts` returns 0 (price as bigint kopecks per D-05)
    - `grep -E "uniqueIndex.*on\\(t\\.orderId,\\s*t\\.type\\)|uniqueIndex.*orderId.*type" apps/api/src/persistence/schema/order_events.ts` returns 0
    - `grep -q "geographyPoint\\('gps'\\)" apps/api/src/persistence/schema/pod_artifacts.ts` returns 0
    - `pnpm exec tsc --noEmit -p apps/api/tsconfig.json` exits 0
    - `pnpm exec biome check apps/api/src/persistence/schema` exits 0
    - `apps/api/src/persistence/schema/index.ts` re-exports all 4 new modules
  </acceptance_criteria>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Flip DB-05 / DB-06 / DB-08 stub tests to passing</name>
  <read_first>
    - apps/api/tests/unit/phase-1-stubs.test.ts (after Wave 3b)
    - apps/api/src/persistence/schema/leads.ts (Task 1)
    - apps/api/src/persistence/schema/orders.ts (Task 1)
    - apps/api/src/persistence/schema/order_events.ts (Task 1)
    - apps/api/src/persistence/schema/pod_artifacts.ts (Task 1)
  </read_first>
  <files>
    - apps/api/tests/unit/phase-1-stubs.test.ts
  </files>
  <action>
    Edit `apps/api/tests/unit/phase-1-stubs.test.ts`. Flip DB-05, DB-06, DB-08 from `.todo()` to real tests. Replace these three lines:

    ```typescript
      test('DB-05: leads table has extended cargo fields + price_overrides jsonb[]', async () => {
        const { leads } = await import('../../src/persistence/schema/leads.js');
        const cols = Object.keys(leads);
        expect(cols).toContain('volumeM3');
        expect(cols).toContain('dimensionsLxwxh');
        expect(cols).toContain('packaging');
        expect(cols).toContain('adrClass');
        expect(cols).toContain('declaredValue');
        expect(cols).toContain('priceOverrides');
        expect(cols).toContain('version');
        // Verify source for jsonb[] declaration
        const fs = await import('node:fs/promises');
        const src = await fs.readFile('src/persistence/schema/leads.ts', 'utf-8');
        expect(src).toMatch(/jsonb\(['"]price_overrides['"]\)\s*\.array\(\)/);
      });

      test('DB-06: orders + order_events tables with UNIQUE (order_id, type)', async () => {
        const { orders } = await import('../../src/persistence/schema/orders.js');
        const { orderEvents } = await import('../../src/persistence/schema/order_events.js');
        const orderCols = Object.keys(orders);
        const eventCols = Object.keys(orderEvents);
        expect(orderCols).toContain('number');
        expect(orderCols).toContain('publicToken');
        expect(orderCols).toContain('status');
        expect(orderCols).toContain('price');
        expect(eventCols).toContain('orderId');
        expect(eventCols).toContain('type');
        expect(eventCols).toContain('actor');
        // Verify UNIQUE (orderId, type) declared in source
        const fs = await import('node:fs/promises');
        const src = await fs.readFile('src/persistence/schema/order_events.ts', 'utf-8');
        expect(src).toMatch(/uniqueIndex[^)]*\)\.on\(t\.orderId,\s*t\.type\)/);
      });

      test('DB-08: pod_artifacts table with signature_url, photo_url, gps, captured_at', async () => {
        const { podArtifacts } = await import('../../src/persistence/schema/pod_artifacts.js');
        const cols = Object.keys(podArtifacts);
        expect(cols).toContain('orderId');
        expect(cols).toContain('signatureUrl');
        expect(cols).toContain('photoUrl');
        expect(cols).toContain('gps');
        expect(cols).toContain('capturedAt');
      });
    ```

    Run `pnpm exec vitest run --project unit` from `apps/api/`. Expected: 7 passing (DB-01..06 except DB-07, plus DB-08), 10 todo.

    Wait — let me re-count. After Wave 3b: DB-01..04 pass (4 tests). After Wave 3c flipping DB-05, DB-06, DB-08: 4 + 3 = 7 passing. Todos remaining: DB-07, DB-09, DB-10, API-01, API-02, API-16, DEPLOY-01..04 = 10 todos. Total 17 = 7+10. Correct.
  </action>
  <verify>
    <automated>cd apps/api && pnpm exec vitest run --project unit 2>&1 | tee /tmp/vitest.out | tail -10 && grep -E "passed|todo" /tmp/vitest.out && grep -q "7 passed" /tmp/vitest.out && echo OK</automated>
  </verify>
  <done>
    7 passing (DB-01..06, DB-08), 10 todo. Vitest exits 0.
  </done>
  <acceptance_criteria>
    - `cd apps/api && pnpm exec vitest run --project unit 2>&1 | grep -c "✓"` is at least 7
    - `cd apps/api && pnpm exec vitest run --project unit` exits 0
    - Active tests for DB-01, DB-02, DB-03, DB-04, DB-05, DB-06, DB-08 (verify: `grep -c "^      test('DB-0[12345689]" apps/api/tests/unit/phase-1-stubs.test.ts` is at least 7)
    - DB-07, DB-09, DB-10, all API-* and DEPLOY-* remain `test.todo()`
  </acceptance_criteria>
</task>

</tasks>

<verification>
- `pnpm exec tsc --noEmit -p apps/api/tsconfig.json` passes
- `pnpm exec biome check apps/api/src/persistence/schema apps/api/tests` passes
- `cd apps/api && pnpm exec vitest run --project unit` passes with 7 green / 10 todo
- Forward FK refs work (leads.order_id → orders.id) — Drizzle resolves at runtime
</verification>

<success_criteria>
1. Four schema files (orders, leads, order_events, pod_artifacts) compile and pass Biome.
2. leads has all 5 extended cargo columns (volume_m3, dimensions_lxwxh, packaging, adr_class, declared_value) + price_overrides jsonb[] + version.
3. orders has public_token UNIQUE for Phase 5 tracking link.
4. order_events has UNIQUE (order_id, type) for FSM auto-transition idempotency.
5. pod_artifacts has signature_url, photo_url, gps (geography with SRID CHECK), captured_at.
6. All financial columns are bigint (kopecks per D-05).
7. DB-05, DB-06, DB-08 stub tests now passing; total unit suite: 7 passing / 10 todo.
</success_criteria>

<output>
After completion, create `.planning/phases/01-database-backend-skeleton/01-05-SUMMARY.md` documenting:
- Schema file count (4 new)
- Test result: 7 passing / 10 todo
- Confirmation that all forward FKs (leads.order_id → orders, order_events.order_id → orders, pod_artifacts.order_id → orders) compile under strict TS via runtime resolution
- Noted that drizzle-kit generate is still deferred to Plan 01-07
</output>
