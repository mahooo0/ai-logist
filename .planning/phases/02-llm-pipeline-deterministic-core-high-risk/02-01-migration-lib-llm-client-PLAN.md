---
phase: 02-llm-pipeline-deterministic-core-high-risk
plan: 01
type: execute
wave: 1
depends_on:
  - "02-00"
files_modified:
  - apps/api/drizzle/0002_phase2_lead_events_tokens.sql
  - apps/api/drizzle/meta/_journal.json
  - apps/api/src/persistence/schema/_enums.ts
  - apps/api/src/persistence/schema/lead_events.ts
  - apps/api/src/persistence/schema/index.ts
  - apps/api/src/persistence/repos/lead_events.ts
  - apps/api/src/persistence/repos/index.ts
  - apps/api/src/lib/money.ts
  - apps/api/src/lib/price-guard.ts
  - apps/api/src/lib/lang-detect.ts
  - apps/api/src/lib/geocoding.ts
  - apps/api/src/lib/routing.ts
  - apps/api/src/lib/bourse-stub.ts
  - apps/api/src/lib/bourse-stub.json
  - apps/api/src/pipeline/llm-client.ts
  - apps/api/src/config.ts
  - apps/api/package.json
  - apps/api/tests/unit/money.test.ts
  - apps/api/tests/unit/price-guard.test.ts
  - apps/api/tests/unit/lang-detect.test.ts
  - apps/api/tests/unit/routing.test.ts
  - apps/api/tests/unit/phase-2-stubs.test.ts
autonomous: true
requirements:
  - LOGIC-02
  - LOGIC-03
  - MATCH-02
  - MATCH-04
  - MATCH-06

must_haves:
  truths:
    - "Migration 0002 applies cleanly on top of 0001 (after Phase 1 schema). Re-apply is idempotent (zero diff)."
    - "leads.tokens_in, leads.tokens_out, leads.llm_calls columns exist as BIGINT/BIGINT/INTEGER (NOT NULL DEFAULT 0)."
    - "lead_events table exists with FK to leads, lead_event_actor enum ('ai'|'manager'|'system')."
    - "roundTo50Rubles(kopecks) rounds half-up to multiples of 5000n."
    - "priceGuard rejects ANY number in LLM text not equal to quoted_price AND not in [min,max] corridor."
    - "cyrillicHeuristic returns ua for є/і/ї/ґ; null otherwise. detectLang short-circuits messages < 20 chars to ru."
    - "routeKm calls OSRM with 2s timeout; on failure falls back to haversine × 1.3."
    - "llm-client.ts exports a class implementing the same LlmProvider interface as MockAnthropicClient (Wave 0)."
    - "config.ts validates ANTHROPIC_API_KEY + LLM_MODEL + LLM_TOKEN_BUDGET_PER_LEAD + OSRM_URL + NOMINATIM_URL."
  artifacts:
    - path: "apps/api/drizzle/0002_phase2_lead_events_tokens.sql"
      provides: "Migration adding tokens columns + lead_events + lead_event_actor enum"
      contains: "CREATE TABLE \"lead_events\""
    - path: "apps/api/src/persistence/schema/lead_events.ts"
      provides: "Drizzle schema for lead_events"
      contains: "export const leadEvents"
    - path: "apps/api/src/persistence/repos/lead_events.ts"
      provides: "appendEvent helper"
      contains: "export async function appendEvent"
    - path: "apps/api/src/lib/money.ts"
      provides: "roundTo50Rubles + formatPriceKop"
      contains: "export function roundTo50Rubles"
    - path: "apps/api/src/lib/price-guard.ts"
      provides: "priceGuard regex check for D-25 step 4"
      contains: "export function priceGuard"
    - path: "apps/api/src/lib/lang-detect.ts"
      provides: "Cyrillic-script heuristic + two-detector vote"
      contains: "cyrillicHeuristic"
    - path: "apps/api/src/lib/routing.ts"
      provides: "OSRM routeKm + haversine fallback"
      contains: "export async function routeKm"
    - path: "apps/api/src/lib/geocoding.ts"
      provides: "Nominatim adapter"
      contains: "export async function geocode"
    - path: "apps/api/src/lib/bourse-stub.json"
      provides: "5 fake external trucks for MATCH-02 fallback"
      contains: "ati.su"
    - path: "apps/api/src/lib/bourse-stub.ts"
      provides: "Bourse stub query + bourse_cache write"
      contains: "export async function queryBourseStub"
    - path: "apps/api/src/pipeline/llm-client.ts"
      provides: "Anthropic SDK wrapper implementing LlmProvider (matches Wave 0 mock interface)"
      contains: "export class AnthropicLlmClient"
  key_links:
    - from: "apps/api/src/lib/routing.ts"
      to: "router.project-osrm.org"
      via: "fetch with AbortSignal.timeout(2000)"
      pattern: "OSRM_URL|router.project-osrm"
    - from: "apps/api/src/lib/geocoding.ts"
      to: "nominatim.openstreetmap.org"
      via: "fetch with User-Agent header"
      pattern: "User-Agent.*ai-logist"
    - from: "apps/api/src/pipeline/llm-client.ts"
      to: "tests/_helpers/mock-anthropic.ts"
      via: "Shared LlmProvider interface"
      pattern: "interface LlmProvider|class AnthropicLlmClient.*implements"
    - from: "apps/api/src/persistence/schema/index.ts"
      to: "apps/api/src/persistence/schema/lead_events.ts"
      via: "barrel re-export"
      pattern: "lead_events"
---

<objective>
Wave 1 — ship the migration + all lib/* primitives + the Anthropic LLM client wrapper.

Purpose:
- Land migration 0002 (tokens columns + lead_events + lead_event_actor enum). NOTE: leads.version + orders.version ALREADY EXIST from Phase 1.
- Create deterministic primitives that LLM tools (Wave 2) consume: money, price-guard, lang-detect, geocoding, routing, bourse-stub.
- Create llm-client.ts that wraps `@anthropic-ai/sdk` 0.102's `betaZodTool` + `toolRunner` AND implements the same `LlmProvider` interface as Wave 0's MockAnthropicClient (so tests inject either).
- Wire ANTHROPIC_API_KEY/LLM_MODEL/etc into config.ts Zod schema.
- Add `@anthropic-ai/sdk` to apps/api/package.json (the ONLY new top-level dep for Phase 2 per RESEARCH.md "Standard Stack").
- Flip 4 of 18 `test.todo()` markers in phase-2-stubs.test.ts (LOGIC-02, MATCH-02, MATCH-04, MATCH-06) — implementation-only requirements that don't need a DB.

Output: All primitives unit-tested; migration applies idempotently; LLM client implements LlmProvider; 4 todos flipped to real `it()` assertions.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-CONTEXT.md
@.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-RESEARCH.md
@.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-VALIDATION.md
@.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-00-SUMMARY.md
@apps/api/src/persistence/schema/_enums.ts
@apps/api/src/persistence/schema/leads.ts
@apps/api/src/persistence/schema/order_events.ts
@apps/api/src/persistence/repos/index.ts
@apps/api/src/config.ts
@apps/api/src/db.ts
@apps/api/package.json
@apps/api/tests/_helpers/mock-anthropic.ts
@apps/api/drizzle/0001_init.sql

<interfaces>
<!-- Existing Phase 1 contracts this plan must conform to. -->

Db type:
```typescript
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from './persistence/schema/index.js';
export type Db = NodePgDatabase<typeof schema>;
```

Phase 1 leads table (already has version, NO tokens_in/out/llm_calls):
```typescript
// apps/api/src/persistence/schema/leads.ts (existing)
version: bigint('version', { mode: 'number' }).notNull().default(0),
// quoted_price (bigint kopecks, nullable) already exists
// price_overrides jsonb[] already exists
```

Phase 1 leadStageEnum (existing — referenced by lead_events.fromStage / toStage):
```typescript
export const leadStageEnum = pgEnum('lead_stage', ['NEW','QUALIFIED','MATCHED','QUOTED','AGREED','ORDER_CREATED','IN_PROGRESS','DONE','LOST']);
```

Wave 0 LlmProvider interface (this plan's llm-client.ts must implement):
```typescript
export interface LlmProvider {
  runTurn(args: {
    systemPrompt: string;
    userMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
    toolNames: string[];
  }): Promise<{
    toolCalls: Array<{ name: string; args: unknown }>;
    finalText: string | null;
    usage: { input_tokens: number; output_tokens: number };
  }>;
}
```

Phase 1 repos barrel (this plan adds lead_events):
```typescript
// apps/api/src/persistence/repos/index.ts (existing)
export * as citiesRepo from './cities.js';
export * as clientsRepo from './clients.js';
export * as leadsRepo from './leads.js';
// ... add: export * as leadEventsRepo from './lead_events.js';
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Migration 0002 + lead_events schema/repo + token-ledger columns</name>
  <files>apps/api/drizzle/0002_phase2_lead_events_tokens.sql, apps/api/drizzle/meta/_journal.json, apps/api/src/persistence/schema/_enums.ts, apps/api/src/persistence/schema/lead_events.ts, apps/api/src/persistence/schema/index.ts, apps/api/src/persistence/repos/lead_events.ts, apps/api/src/persistence/repos/index.ts, apps/api/tests/integration/migration-0002.test.ts, apps/api/tests/unit/lead-events-repo.test.ts</files>
  <behavior>
    - After migrate(): `\d leads` shows tokens_in BIGINT NOT NULL DEFAULT 0, tokens_out BIGINT NOT NULL DEFAULT 0, llm_calls INTEGER NOT NULL DEFAULT 0.
    - After migrate(): `\d lead_events` shows all columns (id uuid PK, lead_id uuid FK CASCADE, from_stage lead_stage NOT NULL, to_stage lead_stage NOT NULL, actor lead_event_actor NOT NULL, payload jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT NOW()).
    - lead_event_actor enum has exactly three values: 'ai', 'manager', 'system'.
    - appendEvent(db, {leadId, fromStage, toStage, actor, payload}) inserts a row and returns LeadEvent; payload defaults to {} when omitted.
    - listByLead(db, leadId) returns events ordered by created_at ASC.
    - Re-running drizzle-kit check after migrate shows zero diff (idempotency).
    - Test: migration applied twice → second apply no-op (uses meta journal).
  </behavior>
  <read_first>
    - .planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-RESEARCH.md §7 (lead_events schema + 0002 migration SQL VERBATIM)
    - .planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-CONTEXT.md D-37 (migration scope reminder)
    - apps/api/src/persistence/schema/leads.ts (confirm version column already exists — DO NOT re-add)
    - apps/api/src/persistence/schema/orders.ts (confirm version column already exists — DO NOT re-add)
    - apps/api/src/persistence/schema/_enums.ts (existing 7 pgEnums)
    - apps/api/src/persistence/schema/order_events.ts (analogous pattern for the new lead_events table)
    - apps/api/src/persistence/repos/index.ts (barrel re-export style: `export * as fooRepo from './foo.js'`)
    - apps/api/drizzle/meta/_journal.json (drizzle-kit journal format — append entry for 0002)
    - apps/api/tests/_helpers/test-db.ts (testcontainers helper for integration test)
  </read_first>
  <action>
    **(a) apps/api/src/persistence/schema/_enums.ts** — APPEND (do NOT replace) this single line at the end of the file:
    ```ts
    export const leadEventActorEnum = pgEnum('lead_event_actor', ['ai', 'manager', 'system']);
    ```

    **(b) apps/api/src/persistence/schema/lead_events.ts** — NEW file. Paste VERBATIM from RESEARCH.md §7 (the Drizzle schema block). Final shape:
    ```ts
    import { sql } from 'drizzle-orm';
    import { index, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
    import { leadEventActorEnum, leadStageEnum } from './_enums.js';
    import { leads } from './leads.js';

    export const leadEvents = pgTable(
      'lead_events',
      {
        id: uuid('id').primaryKey().defaultRandom(),
        leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
        fromStage: leadStageEnum('from_stage').notNull(),
        toStage: leadStageEnum('to_stage').notNull(),
        actor: leadEventActorEnum('actor').notNull(),
        payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      },
      (t) => [index('lead_events_lead_id_idx').on(t.leadId)]
    );
    export type LeadEvent = typeof leadEvents.$inferSelect;
    export type NewLeadEvent = typeof leadEvents.$inferInsert;
    ```

    **(c) apps/api/src/persistence/schema/index.ts** — APPEND single line: `export * from './lead_events.js';` (after the existing `order_events` re-export, keep alphabetical).

    **(d) apps/api/src/persistence/repos/lead_events.ts** — NEW thin repo (D-07 pattern):
    ```ts
    import { asc, eq } from 'drizzle-orm';
    import type { Db } from '../../db.js';
    import { type LeadEvent, leadEvents, type NewLeadEvent } from '../schema/lead_events.js';

    export async function appendEvent(db: Db, input: NewLeadEvent): Promise<LeadEvent> {
      const rows = await db.insert(leadEvents).values(input).returning();
      const created = rows[0];
      if (!created) throw new Error('leadEventsRepo.appendEvent returned no row');
      return created;
    }

    export async function listByLead(db: Db, leadId: string): Promise<LeadEvent[]> {
      return db.select().from(leadEvents).where(eq(leadEvents.leadId, leadId)).orderBy(asc(leadEvents.createdAt));
    }
    ```

    **(e) apps/api/src/persistence/repos/index.ts** — APPEND alphabetically:
    ```ts
    export * as leadEventsRepo from './lead_events.js';
    ```

    **(f) apps/api/drizzle/0002_phase2_lead_events_tokens.sql** — NEW migration. Paste VERBATIM the SQL from RESEARCH.md §7 (the `BEGIN; ... COMMIT;` block). CRITICAL: do NOT add `ALTER TABLE leads ADD COLUMN version` or `ALTER TABLE orders ADD COLUMN version` — those exist from Phase 1 (RESEARCH.md Pitfall #4):
    ```sql
    -- apps/api/drizzle/0002_phase2_lead_events_tokens.sql
    -- D-37 mini-migration: tokens columns + lead_events + lead_event_actor enum.
    -- NOTE: leads.version and orders.version ALREADY EXIST (Phase 1 Plan 01-05).

    CREATE TYPE "lead_event_actor" AS ENUM ('ai', 'manager', 'system');

    CREATE TABLE "lead_events" (
      "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "lead_id"     uuid NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
      "from_stage"  "lead_stage" NOT NULL,
      "to_stage"    "lead_stage" NOT NULL,
      "actor"       "lead_event_actor" NOT NULL,
      "payload"     jsonb NOT NULL DEFAULT '{}'::jsonb,
      "created_at"  timestamptz NOT NULL DEFAULT NOW()
    );
    CREATE INDEX "lead_events_lead_id_idx" ON "lead_events" ("lead_id");

    ALTER TABLE "leads" ADD COLUMN "tokens_in"  bigint  NOT NULL DEFAULT 0;
    ALTER TABLE "leads" ADD COLUMN "tokens_out" bigint  NOT NULL DEFAULT 0;
    ALTER TABLE "leads" ADD COLUMN "llm_calls"  integer NOT NULL DEFAULT 0;
    ```

    Wrapping `BEGIN; ... COMMIT;` is OPTIONAL — drizzle-kit migrate already runs each migration in its own transaction. Match the existing Phase 1 0001_init.sql convention.

    ALSO: append `leads.tokens_in/tokens_out/llm_calls` columns to `apps/api/src/persistence/schema/leads.ts` (so Drizzle's runtime schema matches DDL):
    ```ts
    // Append inside the pgTable block, after `version`:
    tokensIn:  bigint('tokens_in',  { mode: 'number' }).notNull().default(0),
    tokensOut: bigint('tokens_out', { mode: 'number' }).notNull().default(0),
    llmCalls:  integer('llm_calls').notNull().default(0),
    ```

    **(g) apps/api/drizzle/meta/_journal.json** — APPEND a journal entry for `0002_phase2_lead_events_tokens`. Read existing entry shape from the file and follow it (drizzle-kit generate convention). If the planner prefers, run `pnpm db:generate` and let drizzle-kit produce the journal — then HAND-EDIT the generated SQL to match block (f) above (drizzle-kit may produce slightly different formatting).

    **(h) apps/api/tests/integration/migration-0002.test.ts** — NEW integration test (uses testcontainers):
    - beforeAll: startPostgisContainer(), apply migrations 0000+0001+0002.
    - Test 1 (`lead_events table exists`): `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name='lead_events'` → 7 rows including all expected cols.
    - Test 2 (`lead_event_actor enum has 3 values`): `SELECT unnest(enum_range(NULL::lead_event_actor))` → exactly `['ai','manager','system']`.
    - Test 3 (`leads tokens columns exist`): `SELECT column_name FROM information_schema.columns WHERE table_name='leads' AND column_name IN ('tokens_in','tokens_out','llm_calls')` → 3 rows.
    - Test 4 (`leads.version unchanged`): same query for 'version' → 1 row (Phase 1's column, not re-added).
    - Test 5 (`re-apply is no-op`): apply 0002 a second time → drizzle-kit's journal makes it no-op, no errors.
    - afterAll: stopPostgisContainer.

    **(i) apps/api/tests/unit/lead-events-repo.test.ts** — testcontainers-backed unit test for appendEvent + listByLead. Insert a client + lead first; then appendEvent twice; assert listByLead returns 2 rows ordered ascending by createdAt.

    Constraints:
    - DO NOT touch `leads.version` or `orders.version` in 0002 (Pitfall #4).
    - drizzle-kit generate may emit `"lead_event_actor"` quoted; if so, the existing `db:generate` post-process script handles it.
    - Run `pnpm --filter @ai-logist/api db:generate` to refresh journal/meta — verify the SQL matches block (f); otherwise overwrite.
  </behavior>
  <action>Follow the behavior block above. Sequence:
    1. Edit `_enums.ts` (append leadEventActorEnum)
    2. Create `schema/lead_events.ts` from RESEARCH.md §7
    3. Edit `schema/leads.ts` (append tokensIn, tokensOut, llmCalls)
    4. Edit `schema/index.ts` (append re-export)
    5. Create `repos/lead_events.ts`
    6. Edit `repos/index.ts` (append re-export)
    7. Run `pnpm --filter @ai-logist/api db:generate` from `apps/api/`
    8. INSPECT generated SQL. If it doesn't match the RESEARCH.md §7 block, replace its body with the VERBATIM SQL above. The post-process script handles `geography()` quoting (not relevant here).
    9. Write the two test files (integration migration test + unit repo test).
    10. Run `pnpm --filter @ai-logist/api typecheck` + `pnpm exec biome check apps/api/src apps/api/tests`.
  </action>
  <verify>
    <automated>cd apps/api && test -f drizzle/0002_phase2_lead_events_tokens.sql && grep -q "lead_event_actor" drizzle/0002_phase2_lead_events_tokens.sql && grep -q "CREATE TABLE \"lead_events\"" drizzle/0002_phase2_lead_events_tokens.sql && ! grep -q "ADD COLUMN \"version\"" drizzle/0002_phase2_lead_events_tokens.sql && grep -q "leadEventActorEnum" src/persistence/schema/_enums.ts && grep -q "export const leadEvents" src/persistence/schema/lead_events.ts && grep -q "appendEvent" src/persistence/repos/lead_events.ts && grep -q "leadEventsRepo" src/persistence/repos/index.ts && grep -q "tokensIn" src/persistence/schema/leads.ts && pnpm --filter @ai-logist/api typecheck 2>&1 | tail -10</automated>
  </verify>
  <done>
    Migration file exists and does NOT re-add version; lead_events schema + repo present; index barrel updated; leads schema has new tokens columns; tsc passes. Integration test asserts schema shape (requires Docker — gate behavior matches Phase 1: passes locally on Docker-equipped machines, skipped without Docker).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: lib primitives (money, price-guard, lang-detect, geocoding, routing, bourse-stub) + unit tests + 4 todos flipped</name>
  <files>apps/api/src/lib/money.ts, apps/api/src/lib/price-guard.ts, apps/api/src/lib/lang-detect.ts, apps/api/src/lib/geocoding.ts, apps/api/src/lib/routing.ts, apps/api/src/lib/bourse-stub.json, apps/api/src/lib/bourse-stub.ts, apps/api/tests/unit/money.test.ts, apps/api/tests/unit/price-guard.test.ts, apps/api/tests/unit/lang-detect.test.ts, apps/api/tests/unit/routing.test.ts, apps/api/tests/unit/phase-2-stubs.test.ts</files>
  <behavior>
    - **money**: roundTo50Rubles(0n)→0n, roundTo50Rubles(2499n)→0n (half-up boundary), roundTo50Rubles(2500n)→5000n, roundTo50Rubles(4999n)→5000n, roundTo50Rubles(5001n)→5000n, roundTo50Rubles(7500n)→10000n. formatPriceKop(2380000n, 'ru')='23 800' (NBSP) or similar Intl-formatted; formatPriceKop(2380000n, 'ua')='23 800' with uk-UA locale.
    - **price-guard** (RESEARCH.md §15 VERBATIM regex + behavior):
      - Input `"Цена 23 800 руб"` vs quoted=2380000n, min=2023000n, max=2737000n → ok: true.
      - Input `"Цена 100 руб"` vs quoted=2380000n, min=2023000n, max=2737000n → ok: false, badNumbers: [100].
      - Input `"Маршрут 550 км, 18 тонн, цена 23 800 руб"` → 550 and 18 ignored (< 100 minimum filter); ok: true.
      - Input `"Цена 23,8 тыс"` vs quoted=2380000n → ok: true (multiplier handles тыс).
      - Input `"Цена 25 000 ₽"` vs corridor [20000..30000] → ok: true (in corridor, not exact).
    - **lang-detect** (RESEARCH.md §16 VERBATIM):
      - cyrillicHeuristic('Київ-Львів 18т')='ua' confidence 1.0.
      - cyrillicHeuristic('Київ → Львов')='ua' (any of є/і/ї/ґ marker).
      - cyrillicHeuristic('Киев-Львов 18т')=null (no UA marker).
      - cyrillicHeuristic('ок')=null.
      - detectLang('ок', mockLlm)={lang:'ru', confidence:0, source:'default'} (text < 20 chars).
      - detectLang('Привет, нужна машина Москва-Воронеж', mockLlm-returns-{lang:ru,confidence:0.9})={lang:'ru', source:'llm'}.
      - detectLang('Поїхали Київ-Львів 18 тонн', mockLlm)={lang:'ua', confidence:1.0, source:'cyrillic_heuristic'}.
    - **routing**:
      - When fetch returns `{code:'Ok', routes:[{distance:540000, duration:25000}]}` → routeKm returns `{route_km:540, eta_sec:25000, source:'osrm'}`.
      - When fetch throws AbortError → routeKm returns `{source:'haversine_fallback'}` with km = haversineKm × 1.3.
      - haversineKm(Kyiv, Lviv) ≈ 467 km (within ±5 km).
      - Cached call returns cached value within TTL.
    - **bourse-stub**:
      - bourse-stub.json has 5 entries with shape `{source:'ati.su'|'lardi', id, geom_wkt, capacity_t, body_type, contact_phone}`.
      - queryBourseStub(db, {tons, bodyType}) filters by tons + body, returns top 3, INSERTs one row into bourse_cache with source = 'stub', query_hash = sha256(JSON.stringify(params)).
  </behavior>
  <read_first>
    - .planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-RESEARCH.md §5 (calcPrice + money helper VERBATIM), §8 (routing VERBATIM), §9 (geocoding VERBATIM), §15 (price-guard VERBATIM), §16 (lang-detect VERBATIM)
    - .planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-CONTEXT.md D-21..D-27 (lib semantics)
    - apps/api/src/persistence/schema/bourse_cache.ts (bourse_cache table — used by bourse-stub.ts)
    - apps/api/src/persistence/repos/index.ts (no bourseCacheRepo yet — use raw db.execute(sql\`...\`) for the cache write)
    - apps/api/tests/_helpers/fake-timers.ts (Wave 0 — required for tests with TTL)
    - apps/api/tests/unit/phase-2-stubs.test.ts (Wave 0 — file to edit for flipping 4 todos)
  </read_first>
  <action>
    Create six lib files, one JSON fixture, and four unit-test files. Sources: paste VERBATIM from RESEARCH.md sections noted in read_first.

    **(a) apps/api/src/lib/money.ts** — paste from RESEARCH.md §5 (the `// apps/api/src/lib/money.ts — D-27 helper` block). Verify `roundTo50Rubles` uses bigint `5000n` step + `2500n` half. Add a small JSDoc comment explaining the boundary case (`2499n→0n`).

    **(b) apps/api/src/lib/price-guard.ts** — paste from RESEARCH.md §15 VERBATIM. Confirm the PRICE_PATTERN regex with `u` flag covers NBSP (U+00A0) + normal space. Implements `priceGuard({llmText, quotedPriceKop, minKop, maxKop})`.

    **(c) apps/api/src/lib/lang-detect.ts** — paste from RESEARCH.md §16 VERBATIM. Notes:
    - `detectLang(text, llmDetect)` is async, takes the llmDetect callback (Wave 2's `detectLanguage` tool will invoke this).
    - Export type Lang = 'ru'|'ua'.
    - Export `UA_MARKERS` regex constant for testing.

    **(d) apps/api/src/lib/geocoding.ts** — paste from RESEARCH.md §9 VERBATIM. Notes:
    - User-Agent format: `ai-logist/0.2 (demo; contact: ${CONTACT_EMAIL})` (Pitfall #10).
    - Returns `{pointWkt, display_name, country_code}` or null.
    - AbortSignal.timeout(3000).
    - Logs warning via injected `log?: {warn: (msg: string) => void}` (do NOT use console).

    **(e) apps/api/src/lib/routing.ts** — paste from RESEARCH.md §8 VERBATIM. Notes:
    - In-memory `Map` cache with `expires_at`. CACHE_TTL_MS = 60*60*1000.
    - OSRM_TIMEOUT_MS = 2000.
    - ROAD_FACTOR = 1.3.
    - Returns `{route_km, eta_sec, source: 'osrm'|'haversine_fallback'}`.
    - Export `haversineKm` too (referenced from tests).
    - Export a `clearRouteCache(): void` test helper (so unit tests can reset between runs).

    **(f) apps/api/src/lib/bourse-stub.json** — 5 entries matching the shape used by Wave 2's nearestTruck fallback (D-23):
    ```json
    [
      { "source": "ati.su", "external_id": "ATI-1001", "geom_wkt": "POINT(30.5234 50.4501)", "capacity_t": 20, "body_type": "tent", "contact_phone": "+380501234567", "rate_per_km_kopecks": 4500 },
      { "source": "ati.su", "external_id": "ATI-1002", "geom_wkt": "POINT(30.7234 50.4501)", "capacity_t": 18, "body_type": "tent", "contact_phone": "+380501234568", "rate_per_km_kopecks": 4400 },
      { "source": "lardi",  "external_id": "LRD-2001", "geom_wkt": "POINT(31.5234 50.6501)", "capacity_t": 22, "body_type": "ref",  "contact_phone": "+380501234569", "rate_per_km_kopecks": 5200 },
      { "source": "ati.su", "external_id": "ATI-1003", "geom_wkt": "POINT(30.5234 50.6501)", "capacity_t": 25, "body_type": "container", "contact_phone": "+380501234570", "rate_per_km_kopecks": 4800 },
      { "source": "lardi",  "external_id": "LRD-2002", "geom_wkt": "POINT(30.5234 50.4501)", "capacity_t": 15, "body_type": "iso",  "contact_phone": "+380501234571", "rate_per_km_kopecks": 4900 }
    ]
    ```

    **(g) apps/api/src/lib/bourse-stub.ts** — MATCH-02 stub:
    ```ts
    import { createHash } from 'node:crypto';
    import { sql } from 'drizzle-orm';
    import type { Db } from '../db.js';
    import stubData from './bourse-stub.json' with { type: 'json' };

    export interface BourseStubTruck {
      source: 'ati.su' | 'lardi';
      external_id: string;
      geom_wkt: string;
      capacity_t: number;
      body_type: 'tent' | 'ref' | 'iso' | 'container';
      contact_phone: string;
      rate_per_km_kopecks: number;
    }

    export interface BourseQuery {
      tons: number;
      bodyType: 'tent' | 'ref' | 'iso' | 'container' | null;
    }

    export async function queryBourseStub(db: Db, q: BourseQuery): Promise<BourseStubTruck[]> {
      const candidates = (stubData as BourseStubTruck[]).filter(
        (r) => r.capacity_t >= q.tons && (q.bodyType === null || r.body_type === q.bodyType)
      ).slice(0, 3);

      const queryHash = createHash('sha256').update(JSON.stringify(q)).digest('hex');
      await db.execute(sql`
        INSERT INTO bourse_cache (query_hash, source, payload, fetched_at)
        VALUES (${queryHash}, 'stub', ${JSON.stringify(candidates)}::jsonb, NOW())
        ON CONFLICT (query_hash) DO UPDATE SET payload = EXCLUDED.payload, fetched_at = NOW()
      `);
      return candidates;
    }
    ```
    NOTE: Phase 1 created `bourse_cache.query_hash` as UNIQUE via `uniqueIndex` (named `bourse_cache_query_hash_unq`). Adjust the ON CONFLICT target to use the column directly (`ON CONFLICT (query_hash)` works either way). Verify by reading `apps/api/src/persistence/schema/bourse_cache.ts` first.

    **(h) Unit tests** — create FOUR test files (testcontainers NOT needed for these):

    `apps/api/tests/unit/money.test.ts`: table-driven `it.each([[0n,0n],[2499n,0n],[2500n,5000n],[4999n,5000n],[5001n,5000n],[7500n,10000n]])` for roundTo50Rubles. Plus formatPriceKop assertions for ru/ua.

    `apps/api/tests/unit/price-guard.test.ts`: 6+ cases covering the behavior block above. Use NBSP literal in test strings: `'Цена 23 800 руб'`.

    `apps/api/tests/unit/lang-detect.test.ts`: 8+ cases. For detectLang, pass a stub llmDetect callback returning fixed values.

    `apps/api/tests/unit/routing.test.ts`: mock `globalThis.fetch` via `vi.stubGlobal('fetch', vi.fn())`. Cases:
    - fetch returns OSRM Ok response → routeKm returns osrm source.
    - fetch throws AbortError → routeKm returns haversine_fallback.
    - haversineKm(Kyiv {30.5234,50.4501}, Lviv {24.0297,49.8397}) ≈ 469 ± 5 km.
    - Before each test call `clearRouteCache()`.

    **(i) Flip 4 todos in apps/api/tests/unit/phase-2-stubs.test.ts**:
    Replace these four `test.todo()` markers with real `it()` calls that import from the new files:
    - `LOGIC-02` → import detectLang/cyrillicHeuristic; assert UA-marker path.
    - `MATCH-02` → import queryBourseStub; assert filter logic on stubData (skip the DB write check unless testcontainers boots — gate via `describe.skipIf(!process.env.DOCKER)`).
    - `MATCH-04` → import routeKm with mocked fetch returning OSRM Ok; assert km = 540.
    - `MATCH-06` → import priceGuard; assert mismatch rejection.

    Remaining 14 todos stay as `test.todo()` markers — Waves 2-4 flip them.

    Constraints:
    - All new files use `.js` extensions on relative imports.
    - tsc + Biome must pass.
    - Tests do NOT require Docker (use mocks).
  </action>
  <verify>
    <automated>cd apps/api && test -f src/lib/money.ts && test -f src/lib/price-guard.ts && test -f src/lib/lang-detect.ts && test -f src/lib/geocoding.ts && test -f src/lib/routing.ts && test -f src/lib/bourse-stub.ts && test -f src/lib/bourse-stub.json && node -e "const a=JSON.parse(require('fs').readFileSync('src/lib/bourse-stub.json','utf8'));if(a.length!==5)throw new Error('expected 5 stub entries');" && grep -q "roundTo50Rubles" src/lib/money.ts && grep -q "5000n" src/lib/money.ts && grep -q "User-Agent.*ai-logist" src/lib/geocoding.ts && grep -q "AbortSignal.timeout(2000)" src/lib/routing.ts && grep -q "UA_MARKERS" src/lib/lang-detect.ts && grep -q "queryBourseStub" src/lib/bourse-stub.ts && pnpm --filter @ai-logist/api test:unit -- money price-guard lang-detect routing 2>&1 | tail -15 && test "$(grep -c "test.todo" tests/unit/phase-2-stubs.test.ts)" = "14" && pnpm --filter @ai-logist/api typecheck 2>&1 | tail -10</automated>
  </verify>
  <done>
    All 6 lib files + JSON fixture exist; 4 unit-test files pass; phase-2-stubs.test.ts has 14 todos (4 flipped); tsc + Biome pass.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Anthropic LLM client wrapper + config.ts env + @anthropic-ai/sdk dep + token accounting</name>
  <files>apps/api/src/pipeline/llm-client.ts, apps/api/src/config.ts, apps/api/package.json, .env.example, apps/api/tests/unit/llm-client.test.ts</files>
  <behavior>
    - config.ts requires LLM_MODEL (default 'claude-sonnet-4-7'), LLM_TOKEN_BUDGET_PER_LEAD (default 30000), OSRM_URL (default 'https://router.project-osrm.org'), NOMINATIM_URL (default 'https://nominatim.openstreetmap.org'), NOMINATIM_CONTACT_EMAIL (default 'demo@ai-logist.local').
    - ANTHROPIC_API_KEY is optional in config.ts (test mode uses MockAnthropicClient).
    - AnthropicLlmClient implements LlmProvider interface (same signature as Wave 0 MockAnthropicClient).
    - runTurn returns `{toolCalls, finalText, usage: {input_tokens, output_tokens}}` — caller (Wave 3 intake.ts) uses usage to increment leads.tokens_in/out/llm_calls atomically.
    - When ANTHROPIC_API_KEY is unset and instantiation attempted in prod → throws clear error. Tests inject MockAnthropicClient, so no key needed.
    - Unit test (with MockAnthropicClient injected): `runTurn({systemPrompt:'x', userMessages:[{role:'user',content:'y'}], toolNames:['extractRequest']})` returns the fixture-keyed response.
    - apps/api/package.json gains "@anthropic-ai/sdk": "^0.102.0" in dependencies.
    - .env.example documents the 5 new vars.
  </behavior>
  <read_first>
    - .planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-RESEARCH.md §1 (llm-client.ts VERBATIM — Anthropic SDK runToolLoop), "Standard Stack" (SDK version 0.102.0)
    - .planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-CONTEXT.md D-01..D-03, D-36, "code_context" Integration Points
    - apps/api/src/config.ts (current Zod schema — extend, do NOT replace)
    - apps/api/tests/_helpers/mock-anthropic.ts (Wave 0 LlmProvider interface that this plan must mirror)
    - apps/api/package.json (current dependencies)
    - .env.example (root) (current env documentation)
  </read_first>
  <action>
    **(a) apps/api/package.json** — add `"@anthropic-ai/sdk": "^0.102.0"` to dependencies. Run `pnpm install` from repo root to refresh lockfile.

    **(b) apps/api/src/config.ts** — extend the existing Zod schema. Replace `ANTHROPIC_API_KEY: z.string().optional()` with:
    ```ts
    ANTHROPIC_API_KEY: z.string().optional(),
    LLM_MODEL: z.string().default('claude-sonnet-4-7'),
    LLM_TOKEN_BUDGET_PER_LEAD: z.coerce.number().int().positive().default(30_000),
    OSRM_URL: z.string().url().default('https://router.project-osrm.org'),
    NOMINATIM_URL: z.string().url().default('https://nominatim.openstreetmap.org'),
    NOMINATIM_CONTACT_EMAIL: z.string().email().default('demo@ai-logist.local'),
    ```
    Keep ANTHROPIC_API_KEY optional (tests use MockAnthropicClient). The AnthropicLlmClient constructor below throws if instantiated without the key, so production failure mode is loud but predictable.

    **(c) apps/api/src/pipeline/llm-client.ts** — Anthropic SDK wrapper implementing LlmProvider:
    ```ts
    // CONTEXT D-01, D-02, D-36 — Anthropic Claude via betaZodTool + toolRunner.
    // Implements the SAME LlmProvider interface as tests/_helpers/mock-anthropic.ts
    // so the production code path and the test mock are swappable at the call site.

    import Anthropic from '@anthropic-ai/sdk';
    import type { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
    import { config } from '../config.js';

    export interface LlmProvider {
      runTurn(args: {
        systemPrompt: string;
        userMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
        toolNames: string[];
      }): Promise<{
        toolCalls: Array<{ name: string; args: unknown }>;
        finalText: string | null;
        usage: { input_tokens: number; output_tokens: number };
      }>;
    }

    /** Anthropic-backed production LlmProvider. Tests use MockAnthropicClient instead. */
    export class AnthropicLlmClient implements LlmProvider {
      private readonly client: Anthropic;
      private readonly model: string;

      constructor(opts?: { apiKey?: string; model?: string }) {
        const apiKey = opts?.apiKey ?? config.ANTHROPIC_API_KEY;
        if (!apiKey) {
          throw new Error('AnthropicLlmClient requires ANTHROPIC_API_KEY. Tests should inject MockAnthropicClient.');
        }
        this.client = new Anthropic({ apiKey });
        this.model = opts?.model ?? config.LLM_MODEL;
      }

      async runTurn(args: Parameters<LlmProvider['runTurn']>[0]): Promise<Awaited<ReturnType<LlmProvider['runTurn']>>> {
        // The pipeline (Wave 3) passes tools through a separate path because betaZodTool
        // schemas must be defined at the call site. This LlmProvider abstraction only
        // exposes tool NAMES so the mock can key fixtures by name. The actual tool
        // execution loop is wired in pipeline/intake.ts via client.beta.messages.toolRunner.
        //
        // For Wave 1's verification we expose a minimal path: send the message, return
        // usage and any final text. Wave 3 swaps in toolRunner with the real tools.
        const response = await this.client.beta.messages.create({
          model: this.model,
          max_tokens: 1024,
          system: args.systemPrompt,
          messages: args.userMessages.map((m) => ({ role: m.role, content: m.content })),
        });
        const textBlock = response.content.find((b): b is { type: 'text'; text: string } => b.type === 'text');
        return {
          toolCalls: [],
          finalText: textBlock?.text ?? null,
          usage: {
            input_tokens: response.usage.input_tokens,
            output_tokens: response.usage.output_tokens,
          },
        };
      }
    }

    /**
     * Helper for Wave 3: run a full tool-execution loop. Tools come from buildToolRegistry(ctx)
     * (Wave 2). usage is returned so the caller increments leads.tokens_in/tokens_out/llm_calls
     * atomically per D-36.
     */
    export async function runToolLoop(
      llm: AnthropicLlmClient,
      args: {
        systemPrompt: string;
        messages: Array<{ role: 'user' | 'assistant'; content: string }>;
        tools: ReturnType<typeof betaZodTool>[];
        maxIterations?: number;
      }
    ): Promise<{ finalMessage: Anthropic.Beta.BetaMessage; usage: { input_tokens: number; output_tokens: number } }> {
      // Access the underlying client by re-creating one — internal API
      const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
      const runner = client.beta.messages.toolRunner({
        model: config.LLM_MODEL,
        max_tokens: 1024,
        system: args.systemPrompt,
        messages: args.messages as never,
        tools: args.tools as never,
        max_iterations: args.maxIterations ?? 6,
      });
      const finalMessage = await runner;
      return {
        finalMessage: finalMessage as never,
        usage: {
          input_tokens: finalMessage.usage?.input_tokens ?? 0,
          output_tokens: finalMessage.usage?.output_tokens ?? 0,
        },
      };
    }
    ```

    Note: The toolRunner API surface in `@anthropic-ai/sdk@0.102.0` is exposed via `client.beta.messages.toolRunner(...)` per RESEARCH.md §1. If the SDK installed yields a slightly different shape at compile time (e.g. helpers split between `@anthropic-ai/sdk/helpers/beta/zod` and `@anthropic-ai/sdk/beta`), follow SDK helpers.md and adapt — the LlmProvider interface (the public contract) MUST stay identical to Wave 0's mock.

    **(d) apps/api/tests/unit/llm-client.test.ts** — unit test verifying:
    - `new AnthropicLlmClient({apiKey: 'sk-test'})` — does not throw.
    - `new AnthropicLlmClient()` with no env ANTHROPIC_API_KEY — throws the documented error.
    - `MockAnthropicClient` from `tests/_helpers/mock-anthropic.ts` and `AnthropicLlmClient` BOTH satisfy `const x: LlmProvider = ...` (compile-time check via a `satisfies` line or simple variable assignment in a describe.skip block).

    **(e) .env.example** — add documentation for the 5 new vars:
    ```bash
    # Phase 2 — LLM pipeline
    ANTHROPIC_API_KEY=                # Required in prod; tests use MockAnthropicClient
    LLM_MODEL=claude-sonnet-4-7
    LLM_TOKEN_BUDGET_PER_LEAD=30000
    OSRM_URL=https://router.project-osrm.org
    NOMINATIM_URL=https://nominatim.openstreetmap.org
    NOMINATIM_CONTACT_EMAIL=demo@ai-logist.local
    ```
    Append to existing .env.example — do NOT replace.

    Constraints:
    - DO NOT add console.log; use injected log object or Fastify decorator.
    - The `as never` casts in runToolLoop bridge the SDK helper typings; document with a comment if used.
    - LlmProvider interface in llm-client.ts MUST be byte-identical to the one in Wave 0's mock-anthropic.ts (Wave 4 plan will refactor to a single shared types module if needed; Wave 1 leaves them as parallel definitions).
  </action>
  <verify>
    <automated>cd apps/api && test -f src/pipeline/llm-client.ts && grep -q "class AnthropicLlmClient" src/pipeline/llm-client.ts && grep -q "interface LlmProvider" src/pipeline/llm-client.ts && grep -q "ANTHROPIC_API_KEY" src/config.ts && grep -q "LLM_MODEL" src/config.ts && grep -q "LLM_TOKEN_BUDGET_PER_LEAD" src/config.ts && grep -q "OSRM_URL" src/config.ts && grep -q "@anthropic-ai/sdk" package.json && cd ../.. && grep -q "LLM_MODEL" .env.example && grep -q "ANTHROPIC_API_KEY" .env.example && pnpm install --frozen-lockfile=false 2>&1 | tail -5 && pnpm --filter @ai-logist/api typecheck 2>&1 | tail -10 && pnpm --filter @ai-logist/api test:unit -- llm-client 2>&1 | tail -10</automated>
  </verify>
  <done>
    `@anthropic-ai/sdk@^0.102.0` installed; config.ts has 5 new env vars; llm-client.ts exports AnthropicLlmClient implementing LlmProvider; .env.example documents new vars; llm-client unit test passes; tsc passes.
  </done>
</task>

</tasks>

<verification>
Wave 1 overall gates (sequential):
1. `pnpm install` — lockfile updated with anthropic-sdk
2. `pnpm --filter @ai-logist/api typecheck` — strict TS passes
3. `pnpm exec biome check apps/api` — Biome passes
4. `pnpm --filter @ai-logist/api test:unit` — money + price-guard + lang-detect + routing + llm-client + lead-events-repo all green
5. `pnpm --filter @ai-logist/api db:migrate:check` — migration 0002 produces zero diff after apply (Docker-equipped only; gracefully skips otherwise)
6. phase-2-stubs.test.ts shows 14 todos + 4 real assertions (LOGIC-02, MATCH-02, MATCH-04, MATCH-06)
</verification>

<success_criteria>
- Migration 0002 file present; does NOT re-add version columns; idempotent (drizzle journal).
- lead_events Drizzle schema + repo present in barrels.
- 6 lib files (money, price-guard, lang-detect, geocoding, routing, bourse-stub) shipped with unit-test coverage.
- bourse-stub.json has exactly 5 entries; queryBourseStub filters by tons+body and writes to bourse_cache.
- llm-client.ts exports AnthropicLlmClient implementing the LlmProvider interface (same signature as Wave 0 mock).
- config.ts adds 5 new env vars with defaults; .env.example documents them.
- @anthropic-ai/sdk@0.102+ installed in apps/api.
- phase-2-stubs.test.ts has 14 todos (LOGIC-02, MATCH-02, MATCH-04, MATCH-06 flipped to real assertions).
- Closes Pitfall #2 (regex price guard), Pitfall #4 (no version re-add), Pitfall #6 (token-ledger columns), Pitfall #7 (sticky lang stub), Pitfall #10 (Nominatim User-Agent).
</success_criteria>

<output>
After completion, create `.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-01-SUMMARY.md` documenting:
- Files created (migration, schema additions, repos, lib/*, llm-client)
- LlmProvider interface (the production contract Wave 2 tools and Wave 3 intake consume)
- bourse-stub.json shape (Wave 2 nearestTruck consumes on empty CTE)
- Migration order: 0000 → 0001 → 0002 (verified idempotent)
- Confirmed: leads.version + orders.version were NOT re-added (Pitfall #4 closed)
- 4 todos flipped: LOGIC-02, MATCH-02, MATCH-04, MATCH-06
- Anti-patterns avoided: console.log → log object; `!` non-null → explicit guard
</output>
