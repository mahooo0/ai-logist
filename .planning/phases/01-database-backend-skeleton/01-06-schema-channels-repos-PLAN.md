---
phase: 01-database-backend-skeleton
plan: 06
type: execute
wave: 6
depends_on: ["01-05"]
files_modified:
  - apps/api/src/persistence/schema/messages.ts
  - apps/api/src/persistence/schema/calls.ts
  - apps/api/src/persistence/schema/bourse_cache.ts
  - apps/api/src/persistence/schema/webhook_updates.ts
  - apps/api/src/persistence/schema/pricing_config.ts
  - apps/api/src/persistence/schema/index.ts
  - apps/api/src/persistence/repos/trucks.ts
  - apps/api/src/persistence/repos/cities.ts
  - apps/api/src/persistence/repos/clients.ts
  - apps/api/src/persistence/repos/leads.ts
  - apps/api/src/persistence/repos/orders.ts
  - apps/api/src/persistence/repos/messages.ts
  - apps/api/src/persistence/repos/index.ts
  - apps/api/tests/unit/phase-1-stubs.test.ts
autonomous: true
requirements: ["DB-07", "DB-09", "API-02"]
must_haves:
  truths:
    - "messages table has client_id FK, lead_id FK (nullable), role (text), text, created_at per spec §2"
    - "calls table has lead_id FK, direction, duration_s, transcript jsonb, recording_url, outcome per spec §2"
    - "bourse_cache table has query_hash UNIQUE, source, payload jsonb, fetched_at per DB-07 + Phase 2 MATCH-02 fallback"
    - "webhook_updates table has UNIQUE (source, external_id) for idempotent ON CONFLICT DO NOTHING per DB-09"
    - "pricing_config (key/value) table — bonus for Plan 01-08 seed (rate_per_km, dir_coef, season_coef)"
    - "7 repo files exist (trucks, cities, clients, leads, orders, messages, plus barrel index) per D-07; each exports thin per-aggregate functions"
  artifacts:
    - path: "apps/api/src/persistence/schema/messages.ts"
      provides: "messages table per spec §2"
      exports: ["messages", "Message", "NewMessage"]
    - path: "apps/api/src/persistence/schema/calls.ts"
      provides: "calls table per spec §2"
      exports: ["calls", "Call", "NewCall"]
    - path: "apps/api/src/persistence/schema/bourse_cache.ts"
      provides: "bourse_cache with query_hash UNIQUE for ATI.SU/Lardi-Trans stub"
      exports: ["bourseCache", "BourseCache", "NewBourseCache"]
    - path: "apps/api/src/persistence/schema/webhook_updates.ts"
      provides: "webhook_updates with UNIQUE (source, external_id) for Telegram idempotency (DB-09)"
      exports: ["webhookUpdates", "WebhookUpdate", "NewWebhookUpdate"]
    - path: "apps/api/src/persistence/schema/pricing_config.ts"
      provides: "key/value config store for rate_per_km, dir_coef, season_coef"
      exports: ["pricingConfig", "PricingConfig", "NewPricingConfig"]
    - path: "apps/api/src/persistence/repos/index.ts"
      provides: "Barrel re-export of all 6 repos"
      exports: ["trucksRepo", "citiesRepo", "clientsRepo", "leadsRepo", "ordersRepo", "messagesRepo"]
  key_links:
    - from: "apps/api/src/persistence/schema/webhook_updates.ts"
      to: "_enums.ts (webhookSourceEnum)"
      via: "source column type + unique constraint"
      pattern: "webhookSourceEnum"
    - from: "apps/api/src/persistence/repos/trucks.ts"
      to: "schema/trucks.ts + db.ts (Db type)"
      via: "named exports of findById, list, create, update"
      pattern: "export (const|async function) (findById|list|create|update)"
---

<objective>
Wave 3d closes the remaining 5 schema tables (`messages`, `calls`, `bourse_cache`, `webhook_updates`, `pricing_config`) and ships the thin per-aggregate repository layer per D-07. After this plan ALL 13 spec tables exist; Plan 01-07 generates the init migration.

Purpose: Close DB-07, DB-09, API-02. Establish the thin-repo pattern that every downstream phase uses for typed CRUD on aggregates.

Output: 5 new schema files + 6 repo files + 1 repo barrel + flipped DB-07/09 + API-02 stub tests.
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
@apps/api/src/persistence/schema/clients.ts
@apps/api/src/persistence/schema/orders.ts
@apps/api/src/persistence/schema/leads.ts
@apps/api/src/db.ts
@ai-logist-logic-spec.md
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: 5 remaining schema tables — messages, calls, bourse_cache, webhook_updates, pricing_config</name>
  <read_first>
    - apps/api/src/persistence/schema/_enums.ts (Wave 3a — webhookSourceEnum)
    - apps/api/src/persistence/schema/clients.ts (Wave 3b)
    - apps/api/src/persistence/schema/leads.ts (Wave 3c)
    - .planning/phases/01-database-backend-skeleton/01-RESEARCH.md — section "`webhook_updates` table with `external_id` UNIQUE for idempotency"
    - .planning/phases/01-database-backend-skeleton/01-CONTEXT.md — D-04 (webhook_updates), D-19 (pricing_config keys)
    - ai-logist-logic-spec.md §2 (messages, calls, bourse_cache definitions)
  </read_first>
  <files>
    - apps/api/src/persistence/schema/messages.ts
    - apps/api/src/persistence/schema/calls.ts
    - apps/api/src/persistence/schema/bourse_cache.ts
    - apps/api/src/persistence/schema/webhook_updates.ts
    - apps/api/src/persistence/schema/pricing_config.ts
    - apps/api/src/persistence/schema/index.ts
  </files>
  <action>
    Five schema files. All standard tables — no geography columns.

    **`apps/api/src/persistence/schema/messages.ts`** (per spec §2):

    ```typescript
    import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
    import { clients } from './clients.js';
    import { leads } from './leads.js';

    export const messages = pgTable(
      'messages',
      {
        id: uuid('id').primaryKey().defaultRandom(),
        clientId: uuid('client_id')
          .notNull()
          .references(() => clients.id, { onDelete: 'cascade' }),
        leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
        role: text('role').notNull(), // 'client' | 'ai' | 'manager' per spec §2
        text: text('text').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      },
      (t) => [
        index('messages_client_id_idx').on(t.clientId),
        index('messages_lead_id_idx').on(t.leadId),
        index('messages_created_at_idx').on(t.createdAt),
      ]
    );

    export type Message = typeof messages.$inferSelect;
    export type NewMessage = typeof messages.$inferInsert;
    ```

    **`apps/api/src/persistence/schema/calls.ts`** (per spec §2):

    ```typescript
    import { sql } from 'drizzle-orm';
    import {
      bigint,
      index,
      jsonb,
      pgTable,
      text,
      timestamp,
      uuid,
    } from 'drizzle-orm/pg-core';
    import { leads } from './leads.js';

    export const calls = pgTable(
      'calls',
      {
        id: uuid('id').primaryKey().defaultRandom(),
        leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
        direction: text('direction').notNull(), // 'inbound' | 'outbound'
        durationS: bigint('duration_s', { mode: 'number' }), // seconds, nullable while in-progress
        transcript: jsonb('transcript').notNull().default(sql`'[]'::jsonb`),
        recordingUrl: text('recording_url'),
        outcome: text('outcome'), // 'completed' | 'no-answer' | 'busy' | …
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      },
      (t) => [
        index('calls_lead_id_idx').on(t.leadId),
        index('calls_created_at_idx').on(t.createdAt),
      ]
    );

    export type Call = typeof calls.$inferSelect;
    export type NewCall = typeof calls.$inferInsert;
    ```

    **`apps/api/src/persistence/schema/bourse_cache.ts`** (DB-07 — query_hash UNIQUE, payload jsonb):

    ```typescript
    import {
      index,
      jsonb,
      pgTable,
      text,
      timestamp,
      uniqueIndex,
      uuid,
    } from 'drizzle-orm/pg-core';

    export const bourseCache = pgTable(
      'bourse_cache',
      {
        id: uuid('id').primaryKey().defaultRandom(),
        queryHash: text('query_hash').notNull(), // SHA256 of normalized query (from→to→tons→body)
        source: text('source').notNull(), // 'ati.su' | 'lardi-trans' | 'mock'
        payload: jsonb('payload').notNull(),
        fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
      },
      (t) => [
        uniqueIndex('bourse_cache_query_hash_unq').on(t.queryHash),
        index('bourse_cache_source_idx').on(t.source),
      ]
    );

    export type BourseCache = typeof bourseCache.$inferSelect;
    export type NewBourseCache = typeof bourseCache.$inferInsert;
    ```

    **`apps/api/src/persistence/schema/webhook_updates.ts`** (DB-09 — per RESEARCH.md §"`webhook_updates` table" — copy VERBATIM):

    ```typescript
    import {
      bigserial,
      jsonb,
      pgTable,
      text,
      timestamp,
      unique,
    } from 'drizzle-orm/pg-core';
    import { webhookSourceEnum } from './_enums.js';

    export const webhookUpdates = pgTable(
      'webhook_updates',
      {
        id: bigserial('id', { mode: 'bigint' }).primaryKey(),
        source: webhookSourceEnum('source').notNull(),
        externalId: text('external_id').notNull(), // Telegram update_id, voice call id, gps push id
        payload: jsonb('payload').notNull(),
        receivedAt: timestamp('received_at', { withTimezone: true })
          .notNull()
          .defaultNow(),
      },
      (t) => [unique('webhook_updates_source_ext_unq').on(t.source, t.externalId)]
    );

    export type WebhookUpdate = typeof webhookUpdates.$inferSelect;
    export type NewWebhookUpdate = typeof webhookUpdates.$inferInsert;
    ```

    **`apps/api/src/persistence/schema/pricing_config.ts`** (D-19 — key/value store for rate_per_km, dir_coef, season_coef):

    ```typescript
    import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

    export const pricingConfig = pgTable('pricing_config', {
      key: text('key').primaryKey(), // 'rate_per_km' | 'dir_coef' | 'season_coef'
      value: jsonb('value').notNull(),
      updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    });

    export type PricingConfig = typeof pricingConfig.$inferSelect;
    export type NewPricingConfig = typeof pricingConfig.$inferInsert;
    ```

    APPEND to `apps/api/src/persistence/schema/index.ts`:

    ```typescript
    export * from './messages.js';
    export * from './calls.js';
    export * from './bourse_cache.js';
    export * from './webhook_updates.js';
    export * from './pricing_config.js';
    ```

    Verify TS + Biome.
  </action>
  <verify>
    <automated>for f in messages calls bourse_cache webhook_updates pricing_config; do test -f "apps/api/src/persistence/schema/$f.ts" || { echo MISSING:$f; exit 1; }; done && grep -q "webhookSourceEnum" apps/api/src/persistence/schema/webhook_updates.ts && grep -q "unique('webhook_updates_source_ext_unq'" apps/api/src/persistence/schema/webhook_updates.ts && grep -q "uniqueIndex('bourse_cache_query_hash_unq'" apps/api/src/persistence/schema/bourse_cache.ts && grep -q "queryHash" apps/api/src/persistence/schema/bourse_cache.ts && grep -q "role" apps/api/src/persistence/schema/messages.ts && grep -q "direction" apps/api/src/persistence/schema/calls.ts && pnpm exec tsc --noEmit -p apps/api/tsconfig.json 2>&1 | tail -3 && pnpm exec biome check apps/api/src/persistence/schema 2>&1 | tail -3 && echo OK</automated>
  </verify>
  <done>
    All 5 schema files compile under strict TS; Biome clean; webhook_updates has UNIQUE(source, external_id); bourse_cache has UNIQUE on query_hash.
  </done>
  <acceptance_criteria>
    - `test -f apps/api/src/persistence/schema/messages.ts && test -f apps/api/src/persistence/schema/calls.ts && test -f apps/api/src/persistence/schema/bourse_cache.ts && test -f apps/api/src/persistence/schema/webhook_updates.ts && test -f apps/api/src/persistence/schema/pricing_config.ts` returns 0
    - `grep -q "role" apps/api/src/persistence/schema/messages.ts` returns 0
    - `grep -q "direction" apps/api/src/persistence/schema/calls.ts && grep -q "transcript" apps/api/src/persistence/schema/calls.ts && grep -q "outcome" apps/api/src/persistence/schema/calls.ts` returns 0
    - `grep -q "query_hash\\|queryHash" apps/api/src/persistence/schema/bourse_cache.ts && grep -q "uniqueIndex" apps/api/src/persistence/schema/bourse_cache.ts` returns 0
    - `grep -q "webhookSourceEnum" apps/api/src/persistence/schema/webhook_updates.ts && grep -q "external_id\\|externalId" apps/api/src/persistence/schema/webhook_updates.ts && grep -q "unique.*source.*external" apps/api/src/persistence/schema/webhook_updates.ts` returns 0
    - `grep -q "pricing_config\\|pricingConfig" apps/api/src/persistence/schema/pricing_config.ts && grep -q "primaryKey()" apps/api/src/persistence/schema/pricing_config.ts` returns 0
    - `pnpm exec tsc --noEmit -p apps/api/tsconfig.json` exits 0
    - `pnpm exec biome check apps/api/src/persistence/schema` exits 0
    - All 13 spec §2 tables now declared (clients, cities, trucks, truck_positions, leads, orders, order_events, calls, messages, bourse_cache, pod_artifacts, webhook_updates, pricing_config)
  </acceptance_criteria>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Thin per-aggregate repos — trucks, cities, clients, leads, orders, messages + barrel</name>
  <read_first>
    - apps/api/src/db.ts (Wave 3a — Db type)
    - apps/api/src/persistence/schema/index.ts (after Task 1 — all 13 tables)
    - .planning/phases/01-database-backend-skeleton/01-RESEARCH.md — Pattern 3: Thin per-aggregate repository
    - .planning/phases/01-database-backend-skeleton/01-CONTEXT.md — D-07, D-08, D-09
  </read_first>
  <files>
    - apps/api/src/persistence/repos/trucks.ts
    - apps/api/src/persistence/repos/cities.ts
    - apps/api/src/persistence/repos/clients.ts
    - apps/api/src/persistence/repos/leads.ts
    - apps/api/src/persistence/repos/orders.ts
    - apps/api/src/persistence/repos/messages.ts
    - apps/api/src/persistence/repos/index.ts
  </files>
  <action>
    Per D-07: each repo file exports a set of pure functions taking a `Db` (or transaction) as first argument. NO classes, NO DI. Thin — basic CRUD only; PostGIS-heavy queries (KNN, geofence) ship in Phase 2 via raw `sql\`\`` per D-08.

    **`apps/api/src/persistence/repos/trucks.ts`**:

    ```typescript
    import { eq } from 'drizzle-orm';
    import type { Db } from '../../db.js';
    import { trucks, type NewTruck, type Truck } from '../schema/trucks.js';

    export async function findById(db: Db, id: string): Promise<Truck | undefined> {
      const rows = await db.select().from(trucks).where(eq(trucks.id, id)).limit(1);
      return rows[0];
    }

    export async function findByPlate(db: Db, plate: string): Promise<Truck | undefined> {
      const rows = await db.select().from(trucks).where(eq(trucks.plateNumber, plate)).limit(1);
      return rows[0];
    }

    export async function list(db: Db, opts: { status?: 'available' | 'busy' | 'maintenance' } = {}): Promise<Truck[]> {
      const q = db.select().from(trucks);
      if (opts.status) {
        return q.where(eq(trucks.status, opts.status));
      }
      return q;
    }

    export async function create(db: Db, input: NewTruck): Promise<Truck> {
      const rows = await db.insert(trucks).values(input).returning();
      const created = rows[0];
      if (!created) throw new Error('trucksRepo.create returned no row');
      return created;
    }

    export async function update(db: Db, id: string, patch: Partial<NewTruck>): Promise<Truck | undefined> {
      const rows = await db.update(trucks).set({ ...patch, updatedAt: new Date() }).where(eq(trucks.id, id)).returning();
      return rows[0];
    }
    ```

    **`apps/api/src/persistence/repos/cities.ts`**:

    ```typescript
    import { eq } from 'drizzle-orm';
    import type { Db } from '../../db.js';
    import { cities, type City, type NewCity } from '../schema/cities.js';

    export async function findBySlug(db: Db, slug: string): Promise<City | undefined> {
      const rows = await db.select().from(cities).where(eq(cities.slug, slug)).limit(1);
      return rows[0];
    }

    export async function upsert(db: Db, input: NewCity): Promise<City> {
      const rows = await db
        .insert(cities)
        .values(input)
        .onConflictDoNothing({ target: cities.slug })
        .returning();
      if (rows[0]) return rows[0];
      const existing = await findBySlug(db, input.slug);
      if (!existing) throw new Error(`citiesRepo.upsert: slug ${input.slug} neither inserted nor found`);
      return existing;
    }

    export async function list(db: Db): Promise<City[]> {
      return db.select().from(cities);
    }
    ```

    **`apps/api/src/persistence/repos/clients.ts`**:

    ```typescript
    import { eq } from 'drizzle-orm';
    import type { Db } from '../../db.js';
    import { clients, type Client, type NewClient } from '../schema/clients.js';

    export async function findById(db: Db, id: string): Promise<Client | undefined> {
      const rows = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
      return rows[0];
    }

    export async function findByPhone(db: Db, phone: string): Promise<Client | undefined> {
      const rows = await db.select().from(clients).where(eq(clients.phone, phone)).limit(1);
      return rows[0];
    }

    export async function findByTelegramId(db: Db, telegramId: string): Promise<Client | undefined> {
      const rows = await db.select().from(clients).where(eq(clients.telegramId, telegramId)).limit(1);
      return rows[0];
    }

    export async function create(db: Db, input: NewClient): Promise<Client> {
      const rows = await db.insert(clients).values(input).returning();
      const created = rows[0];
      if (!created) throw new Error('clientsRepo.create returned no row');
      return created;
    }

    export async function update(db: Db, id: string, patch: Partial<NewClient>): Promise<Client | undefined> {
      const rows = await db.update(clients).set({ ...patch, updatedAt: new Date() }).where(eq(clients.id, id)).returning();
      return rows[0];
    }
    ```

    **`apps/api/src/persistence/repos/leads.ts`**:

    ```typescript
    import { eq } from 'drizzle-orm';
    import type { Db } from '../../db.js';
    import { leads, type Lead, type NewLead } from '../schema/leads.js';

    export async function findById(db: Db, id: string): Promise<Lead | undefined> {
      const rows = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
      return rows[0];
    }

    export async function listByStage(db: Db, stage: Lead['stage']): Promise<Lead[]> {
      return db.select().from(leads).where(eq(leads.stage, stage));
    }

    export async function create(db: Db, input: NewLead): Promise<Lead> {
      const rows = await db.insert(leads).values(input).returning();
      const created = rows[0];
      if (!created) throw new Error('leadsRepo.create returned no row');
      return created;
    }

    export async function update(db: Db, id: string, patch: Partial<NewLead>): Promise<Lead | undefined> {
      const rows = await db.update(leads).set({ ...patch, updatedAt: new Date() }).where(eq(leads.id, id)).returning();
      return rows[0];
    }
    ```

    **`apps/api/src/persistence/repos/orders.ts`**:

    ```typescript
    import { eq } from 'drizzle-orm';
    import type { Db } from '../../db.js';
    import { orders, type NewOrder, type Order } from '../schema/orders.js';

    export async function findById(db: Db, id: string): Promise<Order | undefined> {
      const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
      return rows[0];
    }

    export async function findByPublicToken(db: Db, token: string): Promise<Order | undefined> {
      const rows = await db.select().from(orders).where(eq(orders.publicToken, token)).limit(1);
      return rows[0];
    }

    export async function listByStatus(db: Db, status: Order['status']): Promise<Order[]> {
      return db.select().from(orders).where(eq(orders.status, status));
    }

    export async function create(db: Db, input: NewOrder): Promise<Order> {
      const rows = await db.insert(orders).values(input).returning();
      const created = rows[0];
      if (!created) throw new Error('ordersRepo.create returned no row');
      return created;
    }

    export async function update(db: Db, id: string, patch: Partial<NewOrder>): Promise<Order | undefined> {
      const rows = await db.update(orders).set({ ...patch, updatedAt: new Date() }).where(eq(orders.id, id)).returning();
      return rows[0];
    }
    ```

    **`apps/api/src/persistence/repos/messages.ts`**:

    ```typescript
    import { desc, eq } from 'drizzle-orm';
    import type { Db } from '../../db.js';
    import { messages, type Message, type NewMessage } from '../schema/messages.js';

    export async function listByClient(db: Db, clientId: string, limit = 100): Promise<Message[]> {
      return db
        .select()
        .from(messages)
        .where(eq(messages.clientId, clientId))
        .orderBy(desc(messages.createdAt))
        .limit(limit);
    }

    export async function create(db: Db, input: NewMessage): Promise<Message> {
      const rows = await db.insert(messages).values(input).returning();
      const created = rows[0];
      if (!created) throw new Error('messagesRepo.create returned no row');
      return created;
    }
    ```

    **`apps/api/src/persistence/repos/index.ts`** — barrel using namespace re-export to keep call sites grep-friendly (`trucksRepo.findById(db, id)`):

    ```typescript
    export * as trucksRepo from './trucks.js';
    export * as citiesRepo from './cities.js';
    export * as clientsRepo from './clients.js';
    export * as leadsRepo from './leads.js';
    export * as ordersRepo from './orders.js';
    export * as messagesRepo from './messages.js';
    ```

    Verify TS compiles and Biome passes.
  </action>
  <verify>
    <automated>for f in trucks cities clients leads orders messages index; do test -f "apps/api/src/persistence/repos/$f.ts" || { echo MISSING:$f; exit 1; }; done && grep -q "trucksRepo" apps/api/src/persistence/repos/index.ts && grep -q "messagesRepo" apps/api/src/persistence/repos/index.ts && grep -q "export async function findById" apps/api/src/persistence/repos/trucks.ts && grep -q "export async function findBySlug" apps/api/src/persistence/repos/cities.ts && grep -q "export async function findByTelegramId" apps/api/src/persistence/repos/clients.ts && pnpm exec tsc --noEmit -p apps/api/tsconfig.json 2>&1 | tail -3 && pnpm exec biome check apps/api/src/persistence/repos 2>&1 | tail -3 && echo OK</automated>
  </verify>
  <done>
    6 repo files + barrel exist, all under strict TS + Biome clean; each repo exports thin per-aggregate CRUD functions taking `Db` as first arg.
  </done>
  <acceptance_criteria>
    - All 7 files exist (`test -f` for each of trucks, cities, clients, leads, orders, messages, index)
    - `grep -c "^export.*async function\\|^export const" apps/api/src/persistence/repos/trucks.ts` returns at least 5 (findById, findByPlate, list, create, update)
    - `grep -q "trucksRepo\\|citiesRepo\\|clientsRepo\\|leadsRepo\\|ordersRepo\\|messagesRepo" apps/api/src/persistence/repos/index.ts` returns 0
    - `grep -c "export \\* as.*Repo" apps/api/src/persistence/repos/index.ts` returns 6
    - `pnpm exec tsc --noEmit -p apps/api/tsconfig.json` exits 0
    - `pnpm exec biome check apps/api/src/persistence/repos` exits 0
  </acceptance_criteria>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Flip DB-07 / DB-09 / API-02 stub tests to passing</name>
  <read_first>
    - apps/api/tests/unit/phase-1-stubs.test.ts (after Wave 3c)
    - apps/api/src/persistence/schema/calls.ts (Task 1)
    - apps/api/src/persistence/schema/messages.ts (Task 1)
    - apps/api/src/persistence/schema/bourse_cache.ts (Task 1)
    - apps/api/src/persistence/schema/webhook_updates.ts (Task 1)
    - apps/api/src/persistence/repos/index.ts (Task 2)
  </read_first>
  <files>
    - apps/api/tests/unit/phase-1-stubs.test.ts
  </files>
  <action>
    Edit `apps/api/tests/unit/phase-1-stubs.test.ts`. Flip 3 more todos:

    ```typescript
      test('DB-07: calls, messages, bourse_cache tables exist', async () => {
        const { calls } = await import('../../src/persistence/schema/calls.js');
        const { messages } = await import('../../src/persistence/schema/messages.js');
        const { bourseCache } = await import('../../src/persistence/schema/bourse_cache.js');
        expect(Object.keys(calls)).toContain('direction');
        expect(Object.keys(calls)).toContain('transcript');
        expect(Object.keys(messages)).toContain('role');
        expect(Object.keys(messages)).toContain('text');
        expect(Object.keys(bourseCache)).toContain('queryHash');
        expect(Object.keys(bourseCache)).toContain('source');
        expect(Object.keys(bourseCache)).toContain('payload');
      });

      test('DB-09: webhook_updates with UNIQUE(source, external_id) + ON CONFLICT DO NOTHING', async () => {
        const { webhookUpdates } = await import('../../src/persistence/schema/webhook_updates.js');
        expect(Object.keys(webhookUpdates)).toContain('source');
        expect(Object.keys(webhookUpdates)).toContain('externalId');
        expect(Object.keys(webhookUpdates)).toContain('payload');
        // Verify UNIQUE constraint declared in source
        const fs = await import('node:fs/promises');
        const src = await fs.readFile('src/persistence/schema/webhook_updates.ts', 'utf-8');
        expect(src).toMatch(/unique\([^)]*\)\.on\(t\.source,\s*t\.externalId\)/);
      });

      test.todo('DB-10: seed populates 12 trucks, ~30 cities, 8 clients idempotently');
    });
    ```

    Add a new API-02 test in the API-* describe block:

    ```typescript
    describe('Phase 1: Backend API & Infrastructure (API-*)', () => {
      test.todo('API-01: GET /api/health returns 200 with PostGIS_Version() in checks.postgis');

      test('API-02: Drizzle repos for all 6 aggregates exist with thin CRUD per D-07', async () => {
        const repos = await import('../../src/persistence/repos/index.js');
        expect(repos.trucksRepo).toBeDefined();
        expect(repos.trucksRepo.findById).toBeTypeOf('function');
        expect(repos.trucksRepo.list).toBeTypeOf('function');
        expect(repos.trucksRepo.create).toBeTypeOf('function');
        expect(repos.citiesRepo.findBySlug).toBeTypeOf('function');
        expect(repos.clientsRepo.findByTelegramId).toBeTypeOf('function');
        expect(repos.leadsRepo.listByStage).toBeTypeOf('function');
        expect(repos.ordersRepo.findByPublicToken).toBeTypeOf('function');
        expect(repos.messagesRepo.listByClient).toBeTypeOf('function');
      });

      test.todo('API-16: routes validate request body via Zod and reject malformed input with 400');
    });
    ```

    Run from `apps/api`: `pnpm exec vitest run --project unit`. Expected: 10 passing (DB-01..09 minus DB-10 = 8, plus API-02 = 9 ... hmm let me recount).

    Before Wave 3d Task 3: 7 passing (DB-01..06, DB-08), 10 todo.
    This task flips DB-07 + DB-09 (2 more) + API-02 (1 more) = 3 more passing.
    Total: 7 + 3 = 10 passing. Todos remaining: 10 - 3 = 7 todo (DB-10, API-01, API-16, DEPLOY-01..04).

    Verify: `grep -c "^      test('" apps/api/tests/unit/phase-1-stubs.test.ts` should be 10, `grep -c "test.todo" apps/api/tests/unit/phase-1-stubs.test.ts` should be 7.
  </action>
  <verify>
    <automated>cd apps/api && pnpm exec vitest run --project unit 2>&1 | tee /tmp/vitest.out | tail -10 && grep -E "(passed|todo)" /tmp/vitest.out && grep -q "10 passed" /tmp/vitest.out && echo OK</automated>
  </verify>
  <done>
    10 unit tests passing (DB-01..09 minus DB-10, plus API-02). 7 still todo. Vitest exits 0.
  </done>
  <acceptance_criteria>
    - `cd apps/api && pnpm exec vitest run --project unit 2>&1 | grep -c "✓"` is at least 10
    - `cd apps/api && pnpm exec vitest run --project unit` exits 0
    - DB-07, DB-09, API-02 are now real `test(...)` calls (not `test.todo`)
    - DB-10, API-01, API-16, DEPLOY-01..04 remain `test.todo`
  </acceptance_criteria>
</task>

</tasks>

<verification>
- `pnpm exec tsc --noEmit -p apps/api/tsconfig.json` passes for all 13 spec §2 tables + 6 repos
- `pnpm exec biome check apps/api/src/persistence` passes
- `cd apps/api && pnpm exec vitest run --project unit` passes with 10 green / 7 todo
- `apps/api/src/persistence/schema/index.ts` re-exports all 13 tables
- `apps/api/src/persistence/repos/index.ts` re-exports 6 namespaces
</verification>

<success_criteria>
1. All 13 spec §2 tables now declared (clients, cities, trucks, truck_positions, leads, orders, order_events, calls, messages, bourse_cache, pod_artifacts, webhook_updates, pricing_config).
2. `webhook_updates` has UNIQUE(source, external_id) for DB-09 Telegram idempotency.
3. `bourse_cache` has UNIQUE on query_hash for Phase 2 MATCH-02 fallback caching.
4. 6 thin per-aggregate repos shipped per D-07 — pure functions taking Db as first arg, no classes/DI.
5. DB-07, DB-09, API-02 stub tests now passing. Unit suite: 10 passing / 7 todo.
6. Plan 01-07 (next) can run `pnpm db:generate` to produce the init migration covering all 13 tables.
</success_criteria>

<output>
After completion, create `.planning/phases/01-database-backend-skeleton/01-06-SUMMARY.md` documenting:
- 5 new schema files (messages, calls, bourse_cache, webhook_updates, pricing_config)
- 6 new repo files + 1 barrel (trucks, cities, clients, leads, orders, messages)
- Confirmed all 13 spec §2 tables present (count via `grep -c "pgTable(" apps/api/src/persistence/schema/*.ts`)
- Unit suite: 10 passing / 7 todo
- Ready for Plan 01-07: `pnpm db:generate` will produce the init migration
</output>
