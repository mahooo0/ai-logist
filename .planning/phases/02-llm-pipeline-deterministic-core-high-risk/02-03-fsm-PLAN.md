---
phase: 02-llm-pipeline-deterministic-core-high-risk
plan: 03
type: execute
wave: 2
depends_on:
  - "02-01"
files_modified:
  - apps/api/src/pipeline/lifecycle/errors.ts
  - apps/api/src/pipeline/lifecycle/lead-fsm.ts
  - apps/api/src/pipeline/lifecycle/order-fsm.ts
  - apps/api/tests/unit/lead-fsm.test.ts
  - apps/api/tests/unit/order-fsm.test.ts
  - apps/api/tests/integration/fsm-concurrency.test.ts
  - apps/api/tests/integration/fsm-events-audit.test.ts
autonomous: true
requirements:
  - FSM-01
  - FSM-02
  - FSM-03
  - FSM-05

must_haves:
  truths:
    - "LEAD_TRANSITIONS table-driven: NEW→[QUALIFIED,LOST]; QUALIFIED→[MATCHED,LOST]; MATCHED→[QUOTED,LOST]; QUOTED→[AGREED,LOST]; AGREED→[ORDER_CREATED,LOST]; ORDER_CREATED→[IN_PROGRESS]; IN_PROGRESS→[DONE]; DONE→[]; LOST→[]."
    - "ORDER_TRANSITIONS table-driven: CREATED→[DRIVER_ASSIGNED]; DRIVER_ASSIGNED→[AT_LOADING]; AT_LOADING→[IN_TRANSIT]; IN_TRANSIT→[AT_BORDER,DELIVERED]; AT_BORDER→[IN_TRANSIT]; DELIVERED→[CLOSED]; CLOSED→[]."
    - "transitionLead wraps everything in db.transaction: SELECT...FOR UPDATE → validate target in TRANSITIONS table → UPDATE leads SET stage=$to, version=version+1 WHERE id=$id AND version=$expected → INSERT lead_events."
    - "transitionLead throws IllegalTransition when target not in allowed list."
    - "transitionLead throws VersionMismatch when UPDATE returns 0 rows (CAS lost)."
    - "transitionOrder follows the same pattern using order_events table (UNIQUE(order_id, type) makes geofence events idempotent in Phase 5)."
    - "Concurrency test: Promise.all([transitionLead(A), transitionLead(B)]) on same lead — repeated 100× — ALWAYS exactly 1 fulfilled + 1 rejected. The rejected reason is VersionMismatch OR IllegalTransition (both acceptable)."
    - "Every successful transitionLead inserts a lead_events row with actor (ai|manager|system) and payload jsonb."
  artifacts:
    - path: "apps/api/src/pipeline/lifecycle/lead-fsm.ts"
      provides: "transitionLead + LEAD_TRANSITIONS + LeadStage type"
      contains: "FOR UPDATE"
    - path: "apps/api/src/pipeline/lifecycle/order-fsm.ts"
      provides: "transitionOrder + ORDER_TRANSITIONS"
      contains: "FOR UPDATE"
    - path: "apps/api/src/pipeline/lifecycle/errors.ts"
      provides: "IllegalTransition + VersionMismatch"
      contains: "VersionMismatch"
  key_links:
    - from: "src/pipeline/lifecycle/lead-fsm.ts"
      to: "leads.version"
      via: "UPDATE leads SET version = version + 1 WHERE version = ${expected}"
      pattern: "version.*=.*version.*\\+.*1|version = version \\+ 1"
    - from: "src/pipeline/lifecycle/lead-fsm.ts"
      to: "lead_events"
      via: "INSERT INTO lead_events with actor + payload"
      pattern: "INSERT INTO lead_events"
    - from: "src/pipeline/lifecycle/order-fsm.ts"
      to: "order_events"
      via: "INSERT INTO order_events with actor + payload"
      pattern: "INSERT INTO order_events"
---

<objective>
Wave 2b — ship the deterministic FSM modules. Runs IN PARALLEL with Plan 02-02 (LLM tools) — zero file overlap.

Purpose:
- Hand-rolled FSM with explicit transition table (CONTEXT D-28 — XState rejected).
- transitionLead / transitionOrder defend against concurrency via 3 layers: row-level SELECT FOR UPDATE + version compare-and-set + UNIQUE(order_id, type) for order events (already in Phase 1 schema).
- Audit-log every transition into lead_events / order_events (FSM-05).
- The TODOS for FSM-01, FSM-02, FSM-03, FSM-05 are flipped in the dedicated Plan 02-03b stub-flips (post-Wave-2 atomic merge) — NOT in this plan. This plan ships the source code + integration tests; the stub flips happen serially after 02-02 + 02-03 merge to avoid file overlap on phase-2-stubs.test.ts.

Closes Pitfall #6 (FSM races). Concurrency test runs 100× to prove determinism (VALIDATION.md sign-off bullet #4).

Output: 3 source files in lifecycle/, 2 unit + 2 integration tests. Does NOT modify phase-2-stubs.test.ts (Plan 02-03b owns that file).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-CONTEXT.md
@.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-RESEARCH.md
@.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-VALIDATION.md
@.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-01-SUMMARY.md
@apps/api/src/persistence/schema/_enums.ts
@apps/api/src/persistence/schema/leads.ts
@apps/api/src/persistence/schema/orders.ts
@apps/api/src/persistence/schema/lead_events.ts
@apps/api/src/persistence/schema/order_events.ts
@apps/api/src/persistence/repos/lead_events.ts
@apps/api/src/db.ts
@apps/api/tests/_helpers/test-db.ts

<interfaces>
<!-- Wave 1 (and Phase 1) interfaces this plan consumes. -->

Phase 1 enums (in DB and Drizzle):
```typescript
// lead_stage (Phase 1) values:
// 'NEW' | 'QUALIFIED' | 'MATCHED' | 'QUOTED' | 'AGREED' | 'ORDER_CREATED' | 'IN_PROGRESS' | 'DONE' | 'LOST'

// order_status (Phase 1) values:
// 'CREATED' | 'DRIVER_ASSIGNED' | 'AT_LOADING' | 'IN_TRANSIT' | 'AT_BORDER' | 'DELIVERED' | 'CLOSED'

// lead_event_actor (Wave 1):
// 'ai' | 'manager' | 'system'

// order_event_type (Phase 1) values:
// 'created' | 'driver_assigned' | 'at_loading' | 'in_transit' | 'at_border' | 'delivered'
// NOTE: order_event_type values are lowercase (event types) — DIFFERENT from order_status (uppercase)
```

Phase 1 + Wave 1 leads schema:
```typescript
leads.id: uuid PK
leads.stage: lead_stage (default 'NEW')
leads.version: bigint NOT NULL DEFAULT 0  (Phase 1)
leads.tokensIn / tokensOut / llmCalls (Wave 1)
leads.updatedAt: timestamptz
```

Phase 1 orders schema:
```typescript
orders.id: uuid PK
orders.status: order_status (default 'CREATED')
orders.version: bigint NOT NULL DEFAULT 0
```

Phase 1 order_events schema:
```typescript
order_events.id uuid PK
order_events.orderId uuid FK CASCADE
order_events.type order_event_type NOT NULL
order_events.actor text DEFAULT 'system'  -- Phase 1 used text, NOT an enum
order_events.payload jsonb DEFAULT '{}'::jsonb
order_events.geom geography(Point,4326) NULLABLE
-- UNIQUE(order_id, type) — idempotency for Phase 5 geofence events
```

Wave 1 lead_events schema:
```typescript
lead_events.id uuid PK
lead_events.leadId uuid FK CASCADE
lead_events.fromStage lead_stage NOT NULL
lead_events.toStage lead_stage NOT NULL
lead_events.actor lead_event_actor NOT NULL  -- enum 'ai'|'manager'|'system'
lead_events.payload jsonb DEFAULT '{}'::jsonb
```

Wave 1 leadEventsRepo:
```typescript
export async function appendEvent(db: Db, input: NewLeadEvent): Promise<LeadEvent>;
export async function listByLead(db: Db, leadId: string): Promise<LeadEvent[]>;
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: errors.ts + lead-fsm.ts (transitionLead with FOR UPDATE + version CAS + audit) + unit tests for transition table</name>
  <files>apps/api/src/pipeline/lifecycle/errors.ts, apps/api/src/pipeline/lifecycle/lead-fsm.ts, apps/api/tests/unit/lead-fsm.test.ts</files>
  <behavior>
    - errors.ts exports IllegalTransition (code 'illegal_transition') + VersionMismatch (code 'version_mismatch') classes extending Error.
    - LEAD_TRANSITIONS is a `Record<LeadStage, LeadStage[]>` matching D-28 exactly (table in must_haves).
    - LeadStage type = the 9-value union, exact match to lead_stage enum.
    - transitionLead(db, args) implements the 4-step protocol from RESEARCH.md §6:
      1. db.transaction → SELECT id, stage, version FROM leads WHERE id = $1 FOR UPDATE
      2. Validate LEAD_TRANSITIONS[current.stage].includes(args.to); else IllegalTransition
      3. UPDATE leads SET stage=$to, version=version+1, updated_at=NOW() WHERE id=$1 AND version=$expected RETURNING version; if 0 rows → VersionMismatch
      4. INSERT INTO lead_events (lead_id, from_stage, to_stage, actor, payload)
    - Returns `{from: LeadStage, to: LeadStage, version: number}`.
    - Unit tests for transition table use a mocked db with `transaction` returning the lock row; cover legal + illegal transitions, all 9 stages.
  </behavior>
  <read_first>
    - .planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-RESEARCH.md §6 (transitionLead + errors VERBATIM)
    - .planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-CONTEXT.md D-28..D-30, FSM-01, FSM-03, FSM-05
    - apps/api/src/persistence/schema/_enums.ts (lead_stage enum values)
    - apps/api/src/persistence/schema/leads.ts (version column)
    - apps/api/src/persistence/schema/lead_events.ts (Wave 1 — column shape)
  </read_first>
  <action>
    **(a) apps/api/src/pipeline/lifecycle/errors.ts** — paste VERBATIM from RESEARCH.md §6 errors block:
    ```ts
    export class IllegalTransition extends Error {
      readonly code = 'illegal_transition' as const;
      constructor(message: string) {
        super(message);
        this.name = 'IllegalTransition';
      }
    }

    export class VersionMismatch extends Error {
      readonly code = 'version_mismatch' as const;
      constructor(message: string) {
        super(message);
        this.name = 'VersionMismatch';
      }
    }
    ```

    **(b) apps/api/src/pipeline/lifecycle/lead-fsm.ts** — paste VERBATIM from RESEARCH.md §6 main block. Key parts:
    - `LeadStage` type union of 9 values (matches lead_stage enum exactly).
    - `LEAD_TRANSITIONS` Record<LeadStage, LeadStage[]> from D-28.
    - `LeadActor` type = 'ai' | 'manager' | 'system'.
    - `transitionLead(db, args)` function exactly as RESEARCH.md §6.

    The SQL inside `db.transaction(async (tx) => {...})`:
    ```sql
    -- step 1
    SELECT id, stage, version FROM leads WHERE id = ${args.leadId} FOR UPDATE

    -- step 3 (compare-and-set)
    UPDATE leads
    SET stage = ${args.to}::lead_stage,
        version = version + 1,
        updated_at = NOW()
    WHERE id = ${args.leadId}
      AND version = ${row.version}
    RETURNING version

    -- step 4 (audit)
    INSERT INTO lead_events (lead_id, from_stage, to_stage, actor, payload)
    VALUES (
      ${args.leadId},
      ${row.stage}::lead_stage,
      ${args.to}::lead_stage,
      ${args.actor}::lead_event_actor,
      ${JSON.stringify(args.payload ?? {})}::jsonb
    )
    ```

    Error mapping:
    - SELECT returns 0 rows → throw `new IllegalTransition('lead ${id} not found')` (or a separate `LeadNotFound`; spec accepts the more generic IllegalTransition per RESEARCH.md §6).
    - LEAD_TRANSITIONS[current.stage].includes(args.to) === false → throw IllegalTransition.
    - UPDATE returns 0 rows → throw VersionMismatch.

    **(c) apps/api/tests/unit/lead-fsm.test.ts** — table-driven without testcontainers:
    - Build a mocked Db type whose `transaction` callback receives a fake `tx` with `execute` returning canned rows. (Cleaner: just import the FSM functions and TEST_THE_TABLE table itself. The actual SQL execution path is exercised by the integration test.)
    - Cases (in-process, no Docker):
      ```ts
      it('LEAD_TRANSITIONS has exactly 9 stages', () => {
        expect(Object.keys(LEAD_TRANSITIONS)).toHaveLength(9);
      });
      it('NEW → QUALIFIED is allowed', () => {
        expect(LEAD_TRANSITIONS.NEW).toContain('QUALIFIED');
      });
      it('NEW → MATCHED is rejected', () => {
        expect(LEAD_TRANSITIONS.NEW).not.toContain('MATCHED');
      });
      it('DONE and LOST are terminal', () => {
        expect(LEAD_TRANSITIONS.DONE).toEqual([]);
        expect(LEAD_TRANSITIONS.LOST).toEqual([]);
      });
      it.each([
        ['NEW', ['QUALIFIED','LOST']],
        ['QUALIFIED', ['MATCHED','LOST']],
        ['MATCHED', ['QUOTED','LOST']],
        ['QUOTED', ['AGREED','LOST']],
        ['AGREED', ['ORDER_CREATED','LOST']],
        ['ORDER_CREATED', ['IN_PROGRESS']],
        ['IN_PROGRESS', ['DONE']],
        ['DONE', []],
        ['LOST', []],
      ])('stage %s allows %j', (stage, allowed) => {
        expect(LEAD_TRANSITIONS[stage]).toEqual(allowed);
      });
      it('IllegalTransition includes target in message', () => {
        const err = new IllegalTransition('lead X cannot transition NEW → MATCHED');
        expect(err.code).toBe('illegal_transition');
        expect(err.message).toContain('MATCHED');
      });
      it('VersionMismatch is distinct from IllegalTransition', () => {
        const v = new VersionMismatch('stale');
        const i = new IllegalTransition('illegal');
        expect(v.code).toBe('version_mismatch');
        expect(i.code).toBe('illegal_transition');
      });
      ```

    **(d) DO NOT modify phase-2-stubs.test.ts in this task** — todo flips for FSM-01/02/03/05 happen in dedicated Plan 02-03b stub-flips.

    Constraints:
    - Use `sql` template from `drizzle-orm` exactly as RESEARCH.md §6.
    - The transition table values are uppercase (lead_stage enum); order_event_type values are lowercase (Phase 1) — order-fsm.ts must handle mapping.
    - DO NOT use console.* — log via injected logger or omit entirely (errors thrown carry the info).

    Sequence:
    1. Write `errors.ts` (paste from §6).
    2. Write `lead-fsm.ts` (paste from §6).
    3. Write `lead-fsm.test.ts` (table assertions above).
    4. Run typecheck + biome.
  </action>
  <verify>
    <automated>cd apps/api && test -f src/pipeline/lifecycle/errors.ts && test -f src/pipeline/lifecycle/lead-fsm.ts && grep -q "class IllegalTransition" src/pipeline/lifecycle/errors.ts && grep -q "class VersionMismatch" src/pipeline/lifecycle/errors.ts && grep -q "LEAD_TRANSITIONS" src/pipeline/lifecycle/lead-fsm.ts && grep -q "FOR UPDATE" src/pipeline/lifecycle/lead-fsm.ts && grep -q "version = version + 1" src/pipeline/lifecycle/lead-fsm.ts && grep -q "INSERT INTO lead_events" src/pipeline/lifecycle/lead-fsm.ts && pnpm --filter @ai-logist/api typecheck 2>&1 | tail -10 && pnpm --filter @ai-logist/api test:unit -- lead-fsm 2>&1 | tail -10</automated>
  </verify>
  <done>
    errors.ts + lead-fsm.ts exist; LEAD_TRANSITIONS table-driven (9 stages); FOR UPDATE + version+1 CAS in transitionLead; lead-fsm.test.ts asserts table shape. phase-2-stubs.test.ts UNCHANGED (Plan 02-03b will flip).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: order-fsm.ts (transitionOrder) + unit table-driven test</name>
  <files>apps/api/src/pipeline/lifecycle/order-fsm.ts, apps/api/tests/unit/order-fsm.test.ts</files>
  <behavior>
    - ORDER_TRANSITIONS table-driven (D-32):
      ```
      CREATED → [DRIVER_ASSIGNED]
      DRIVER_ASSIGNED → [AT_LOADING]
      AT_LOADING → [IN_TRANSIT]
      IN_TRANSIT → [AT_BORDER, DELIVERED]
      AT_BORDER → [IN_TRANSIT]
      DELIVERED → [CLOSED]
      CLOSED → []
      ```
    - transitionOrder(db, args) mirror of transitionLead but writes into order_events table.
    - args shape: `{orderId, type, actor, payload?, geom?}`. The `type` parameter is the new order_status value AND the order_event_type value, BUT note Phase 1's order_event_type enum is lowercase ('created', 'driver_assigned', etc.) while order_status is uppercase. Mapping handled by a helper `toEventType(status: OrderStatus): OrderEventType` — see action.
    - INSERT INTO order_events uses `ON CONFLICT (order_id, type) DO NOTHING` to preserve Phase 5 idempotency for geofence-triggered events (UNIQUE constraint from Phase 1). If conflict → no audit row created, but the status update + version bump still succeed.
    - Returns `{from: OrderStatus, to: OrderStatus, version: number, audit_row_inserted: boolean}`.
  </behavior>
  <read_first>
    - .planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-RESEARCH.md §6 (transitionLead is the template — adapt for orders)
    - .planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-CONTEXT.md D-32, D-33, D-34
    - apps/api/src/persistence/schema/_enums.ts (order_status uppercase, order_event_type lowercase — note the case difference)
    - apps/api/src/persistence/schema/order_events.ts (UNIQUE(order_id, type) constraint + actor text default 'system')
    - apps/api/src/pipeline/lifecycle/lead-fsm.ts (Task 1 — same pattern)
  </read_first>
  <action>
    Create `apps/api/src/pipeline/lifecycle/order-fsm.ts`:

    ```ts
    import { sql } from 'drizzle-orm';
    import type { Db } from '../../db.js';
    import { IllegalTransition, VersionMismatch } from './errors.js';

    export type OrderStatus =
      | 'CREATED' | 'DRIVER_ASSIGNED' | 'AT_LOADING' | 'IN_TRANSIT'
      | 'AT_BORDER' | 'DELIVERED' | 'CLOSED';

    export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
      CREATED:         ['DRIVER_ASSIGNED'],
      DRIVER_ASSIGNED: ['AT_LOADING'],
      AT_LOADING:      ['IN_TRANSIT'],
      IN_TRANSIT:      ['AT_BORDER', 'DELIVERED'],
      AT_BORDER:       ['IN_TRANSIT'],
      DELIVERED:       ['CLOSED'],
      CLOSED:          [],
    };

    // Phase 1's order_event_type is lowercase. Map uppercase status → lowercase event.
    const STATUS_TO_EVENT: Record<OrderStatus, string | null> = {
      CREATED:         'created',
      DRIVER_ASSIGNED: 'driver_assigned',
      AT_LOADING:      'at_loading',
      IN_TRANSIT:      'in_transit',
      AT_BORDER:       'at_border',
      DELIVERED:       'delivered',
      CLOSED:          null,  // no event type for CLOSED (it's a terminal admin action)
    };

    export type OrderActor = 'ai' | 'manager' | 'system';

    export interface TransitionOrderArgs {
      orderId: string;
      to: OrderStatus;
      actor: OrderActor;
      payload?: Record<string, unknown>;
      /** Optional WKT point for geofence events (Phase 5). Format: 'POINT(lon lat)'. */
      geomWkt?: string;
    }

    export async function transitionOrder(
      db: Db,
      args: TransitionOrderArgs
    ): Promise<{ from: OrderStatus; to: OrderStatus; version: number; audit_row_inserted: boolean }> {
      return await db.transaction(async (tx) => {
        // 1. Pessimistic row lock.
        const lockResult = await tx.execute(sql`
          SELECT id, status, version
          FROM orders
          WHERE id = ${args.orderId}
          FOR UPDATE
        `);
        const row = lockResult.rows[0] as
          | { id: string; status: OrderStatus; version: number }
          | undefined;
        if (!row) {
          throw new IllegalTransition(`order ${args.orderId} not found (cannot transition to ${args.to})`);
        }

        // 2. Validate transition.
        const allowed = ORDER_TRANSITIONS[row.status];
        if (!allowed.includes(args.to)) {
          throw new IllegalTransition(`cannot transition order ${row.status} → ${args.to} (allowed: ${allowed.join(', ')})`);
        }

        // 3. Compare-and-set version.
        const updated = await tx.execute(sql`
          UPDATE orders
          SET status = ${args.to}::order_status,
              version = version + 1,
              updated_at = NOW()
          WHERE id = ${args.orderId}
            AND version = ${row.version}
          RETURNING version
        `);
        const newVersion = (updated.rows[0] as { version: number } | undefined)?.version;
        if (newVersion === undefined) {
          throw new VersionMismatch(`order ${args.orderId} version ${row.version} stale (concurrent write)`);
        }

        // 4. Audit log into order_events. UNIQUE(order_id, type) makes geofence re-fires no-ops.
        const eventType = STATUS_TO_EVENT[args.to];
        let auditRowInserted = false;
        if (eventType !== null) {
          const insertResult = await tx.execute(sql`
            INSERT INTO order_events (order_id, type, actor, payload, geom)
            VALUES (
              ${args.orderId},
              ${eventType}::order_event_type,
              ${args.actor},
              ${JSON.stringify(args.payload ?? {})}::jsonb,
              ${args.geomWkt ? sql`ST_GeogFromText(${'SRID=4326;' + args.geomWkt})` : null}
            )
            ON CONFLICT (order_id, type) DO NOTHING
            RETURNING id
          `);
          auditRowInserted = insertResult.rows.length > 0;
        }

        return { from: row.status, to: args.to, version: newVersion, audit_row_inserted: auditRowInserted };
      });
    }
    ```

    NOTE: The `geom` column on order_events is `geography(Point, 4326)` per Phase 1. The conditional `ST_GeogFromText` cast for non-null geom is the trickiest part — Drizzle's `sql\`...${value}...\`` template doesn't natively switch between scalar and SQL fragment cleanly. Two acceptable patterns:
    1. Build the INSERT as raw `sql` two ways (with-geom / without-geom).
    2. Always pass NULL when no geomWkt, like:
       ```ts
       ${args.geomWkt ? sql`ST_GeogFromText('SRID=4326;' || ${args.geomWkt})` : sql`NULL`}
       ```
    Use whichever the executor finds cleaner; the public contract is identical.

    **Unit test** `apps/api/tests/unit/order-fsm.test.ts` — table-driven, no Docker:
    ```ts
    it('ORDER_TRANSITIONS has exactly 7 statuses', () => {
      expect(Object.keys(ORDER_TRANSITIONS)).toHaveLength(7);
    });
    it.each([
      ['CREATED', ['DRIVER_ASSIGNED']],
      ['DRIVER_ASSIGNED', ['AT_LOADING']],
      ['AT_LOADING', ['IN_TRANSIT']],
      ['IN_TRANSIT', ['AT_BORDER', 'DELIVERED']],
      ['AT_BORDER', ['IN_TRANSIT']],
      ['DELIVERED', ['CLOSED']],
      ['CLOSED', []],
    ])('status %s allows %j', (s, a) => expect(ORDER_TRANSITIONS[s]).toEqual(a));
    it('CREATED → IN_TRANSIT illegal (must go through DRIVER_ASSIGNED + AT_LOADING)', () => {
      expect(ORDER_TRANSITIONS.CREATED).not.toContain('IN_TRANSIT');
    });
    ```

    **DO NOT modify phase-2-stubs.test.ts** — Plan 02-03b owns the todo flips.
  </action>
  <verify>
    <automated>cd apps/api && test -f src/pipeline/lifecycle/order-fsm.ts && grep -q "ORDER_TRANSITIONS" src/pipeline/lifecycle/order-fsm.ts && grep -q "FOR UPDATE" src/pipeline/lifecycle/order-fsm.ts && grep -q "INSERT INTO order_events" src/pipeline/lifecycle/order-fsm.ts && grep -q "ON CONFLICT (order_id, type) DO NOTHING" src/pipeline/lifecycle/order-fsm.ts && grep -q "STATUS_TO_EVENT" src/pipeline/lifecycle/order-fsm.ts && pnpm --filter @ai-logist/api typecheck 2>&1 | tail -10 && pnpm --filter @ai-logist/api test:unit -- order-fsm 2>&1 | tail -10</automated>
  </verify>
  <done>
    order-fsm.ts exists; ORDER_TRANSITIONS has 7 statuses; transitionOrder uses FOR UPDATE + version+1 CAS + ON CONFLICT DO NOTHING on order_events; STATUS_TO_EVENT maps uppercase→lowercase. phase-2-stubs.test.ts UNCHANGED.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Integration tests — FSM concurrency (100× determinism) + audit log (FSM-05)</name>
  <files>apps/api/tests/integration/fsm-concurrency.test.ts, apps/api/tests/integration/fsm-events-audit.test.ts</files>
  <behavior>
    - fsm-concurrency.test.ts boots testcontainers (Phase 1 helper), applies migrations 0000+0001+0002, runs seed, inserts a lead in QUOTED stage with version=0.
    - Calls Promise.allSettled([transitionLead(db, {lead, to:'AGREED', actor:'ai'}), transitionLead(db, {lead, to:'AGREED', actor:'manager'})]) inside a loop of 100 iterations (each loop resets the lead row).
    - For EVERY iteration: exactly 1 fulfilled + 1 rejected; rejected reason is `VersionMismatch` OR `IllegalTransition` (winner moved out of QUOTED before loser could lock).
    - After 100 iterations: total = 100 fulfilled + 100 rejected. Determinism rate = 100%.
    - fsm-events-audit.test.ts: after every successful transitionLead, listByLead(db, leadId) returns the new lead_events row with correct actor + payload jsonb.
  </behavior>
  <read_first>
    - .planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-RESEARCH.md §13 (concurrency test VERBATIM)
    - .planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-VALIDATION.md "Validation Sign-Off" #4 (100 runs required — original spec)
    - apps/api/tests/_helpers/test-db.ts (startPostgisContainer / getTestDb)
    - apps/api/src/pipeline/lifecycle/lead-fsm.ts (Task 1)
    - apps/api/src/persistence/repos/lead_events.ts (Wave 1 — listByLead)
    - apps/api/src/seed/run.ts (seed() for the fleet + cities)
  </read_first>
  <action>
    **(a) apps/api/tests/integration/fsm-concurrency.test.ts** — base on RESEARCH.md §13 VERBATIM with 100× loop per VALIDATION.md:
    ```ts
    import { describe, it, expect, beforeAll, afterAll } from 'vitest';
    import { sql } from 'drizzle-orm';
    import { transitionLead } from '../../src/pipeline/lifecycle/lead-fsm.js';
    import { VersionMismatch, IllegalTransition } from '../../src/pipeline/lifecycle/errors.js';
    import { startPostgisContainer, stopPostgisContainer, getTestDb } from '../_helpers/test-db.js';

    describe('FSM concurrency — exactly 1 success, 1 failure across 100 iterations', () => {
      let db: any;
      let clientId: string;

      beforeAll(async () => {
        await startPostgisContainer();
        db = await getTestDb();
        await import('../../src/seed/run.js').then((m) => m.seed(db));
        const clientRow = await db.execute(sql`SELECT id FROM clients LIMIT 1`);
        clientId = (clientRow.rows[0] as { id: string }).id;
      }, 90_000);

      afterAll(async () => { await stopPostgisContainer(); });

      it('Promise.all on same lead — 100 iterations all deterministic', async () => {
        const iterations = 100;
        const stats = { fulfilled: 0, rejected: 0, illegal: 0, versionMismatch: 0 };

        for (let i = 0; i < iterations; i++) {
          // Reset lead each iteration (fresh row in QUOTED, version=0).
          const insert = await db.execute(sql`
            INSERT INTO leads (client_id, channel, stage, version, quoted_price)
            VALUES (${clientId}, 'test', 'QUOTED', 0, 2500000)
            RETURNING id
          `);
          const leadId = (insert.rows[0] as { id: string }).id;

          const results = await Promise.allSettled([
            transitionLead(db, { leadId, to: 'AGREED', actor: 'ai', payload: { src: 'A' } }),
            transitionLead(db, { leadId, to: 'AGREED', actor: 'manager', payload: { src: 'B' } }),
          ]);

          const ful = results.filter((r) => r.status === 'fulfilled').length;
          const rej = results.filter((r) => r.status === 'rejected').length;
          expect(ful).toBe(1);
          expect(rej).toBe(1);

          const rejReason = (results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason;
          expect(rejReason instanceof VersionMismatch || rejReason instanceof IllegalTransition).toBe(true);

          stats.fulfilled += ful;
          stats.rejected += rej;
          if (rejReason instanceof VersionMismatch) stats.versionMismatch++;
          if (rejReason instanceof IllegalTransition) stats.illegal++;
        }

        expect(stats.fulfilled).toBe(iterations);
        expect(stats.rejected).toBe(iterations);
        expect(stats.illegal + stats.versionMismatch).toBe(iterations);
      }, 60_000);
    });
    ```

    NOTE: 100 iterations × 2 promises = 200 calls. Within 60s budget on testcontainers Postgres (each iteration: 1 INSERT + 2 SELECT FOR UPDATE + 2 UPDATE + 1 lead_events INSERT ≈ 30-50ms, so 100 × 50ms = ~5s actual runtime).

    **(b) apps/api/tests/integration/fsm-events-audit.test.ts** — FSM-05:
    ```ts
    import { describe, it, expect, beforeAll, afterAll } from 'vitest';
    import { sql } from 'drizzle-orm';
    import { transitionLead } from '../../src/pipeline/lifecycle/lead-fsm.js';
    import { leadEventsRepo } from '../../src/persistence/repos/index.js';
    import { startPostgisContainer, stopPostgisContainer, getTestDb } from '../_helpers/test-db.js';

    describe('FSM-05 — audit log of every transition', () => {
      let db: any;

      beforeAll(async () => {
        await startPostgisContainer();
        db = await getTestDb();
        await import('../../src/seed/run.js').then((m) => m.seed(db));
      }, 90_000);
      afterAll(async () => { await stopPostgisContainer(); });

      it('transitionLead inserts lead_events row with actor + payload', async () => {
        const clientRow = await db.execute(sql`SELECT id FROM clients LIMIT 1`);
        const clientId = (clientRow.rows[0] as { id: string }).id;
        const ins = await db.execute(sql`
          INSERT INTO leads (client_id, channel, stage, version)
          VALUES (${clientId}, 'test', 'NEW', 0) RETURNING id
        `);
        const leadId = (ins.rows[0] as { id: string }).id;

        await transitionLead(db, { leadId, to: 'QUALIFIED', actor: 'ai', payload: { extracted: true } });
        await transitionLead(db, { leadId, to: 'MATCHED', actor: 'system', payload: { trucks_found: 3 } });

        const events = await leadEventsRepo.listByLead(db, leadId);
        expect(events).toHaveLength(2);
        expect(events[0].fromStage).toBe('NEW');
        expect(events[0].toStage).toBe('QUALIFIED');
        expect(events[0].actor).toBe('ai');
        expect(events[0].payload).toMatchObject({ extracted: true });
        expect(events[1].actor).toBe('system');
        expect(events[1].payload).toMatchObject({ trucks_found: 3 });
      }, 30_000);
    });
    ```

    **DO NOT modify phase-2-stubs.test.ts** — Plan 02-03b owns todo flips for FSM-01/02/03/05.

    Constraints:
    - Integration tests need Docker. On Docker-less Claude runner they'll skip (Phase 1 convention).
    - 100 iterations matches VALIDATION.md "Validation Sign-Off" #4 explicitly.
  </action>
  <verify>
    <automated>cd apps/api && test -f tests/integration/fsm-concurrency.test.ts && test -f tests/integration/fsm-events-audit.test.ts && grep -q "iterations = 100" tests/integration/fsm-concurrency.test.ts && grep -q "VersionMismatch" tests/integration/fsm-concurrency.test.ts && grep -q "leadEventsRepo.listByLead" tests/integration/fsm-events-audit.test.ts && pnpm --filter @ai-logist/api typecheck 2>&1 | tail -10</automated>
  </verify>
  <done>
    Concurrency test loops 100× and asserts exactly 1 success + 1 failure each iteration; audit test asserts lead_events rows match actor + payload. phase-2-stubs.test.ts UNCHANGED in this plan.
  </done>
</task>

</tasks>

<verification>
Wave 2b overall gates:
1. `pnpm --filter @ai-logist/api typecheck` — passes
2. `pnpm exec biome check apps/api/src/pipeline/lifecycle apps/api/tests` — passes
3. `pnpm --filter @ai-logist/api test:unit -- lead-fsm order-fsm` — table-driven unit tests green
4. `pnpm --filter @ai-logist/api test:integration -- fsm-concurrency fsm-events-audit` — Docker-equipped only; 100/100 iterations show 1 success + 1 failure
5. phase-2-stubs.test.ts is NOT modified by this plan (Plan 02-03b owns the FSM-01/02/03/05 flips)
</verification>

<success_criteria>
- 3 source files in lifecycle/ (errors, lead-fsm, order-fsm) match RESEARCH.md §6 patterns.
- LEAD_TRANSITIONS has 9 stages exactly matching D-28.
- ORDER_TRANSITIONS has 7 statuses exactly matching D-32.
- transitionLead + transitionOrder both use FOR UPDATE + version+1 CAS + audit-log INSERT.
- transitionOrder uses ON CONFLICT (order_id, type) DO NOTHING for Phase 5 idempotency preservation.
- STATUS_TO_EVENT maps uppercase order_status → lowercase order_event_type values correctly.
- Concurrency test (100 iterations) shows 100% determinism: exactly 1 fulfilled + 1 rejected per iteration.
- Audit test shows lead_events row written with correct actor + payload per transition.
- phase-2-stubs.test.ts is NOT in files_modified (file overlap with 02-02 eliminated; Plan 02-03b owns all stub flips).
- Closes Pitfall #6 (FSM races) at the code level.
</success_criteria>

<output>
After completion, create `.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-03-SUMMARY.md` documenting:
- LEAD_TRANSITIONS + ORDER_TRANSITIONS tables (verbatim)
- transitionLead / transitionOrder signatures (Wave 3 intake.ts and Wave 4 routes/leads.ts both consume)
- STATUS_TO_EVENT map (uppercase status → lowercase event type)
- Concurrency test result: 100 iterations × 2 promises = 200 calls = 100 success + 100 failure (100% determinism)
- Plan 02-03b (post-Wave-2 atomic) is responsible for flipping FSM-01, FSM-02, FSM-03, FSM-05 todos in phase-2-stubs.test.ts
- Closes Pitfall #6 (FSM races) at the code level
</output>
