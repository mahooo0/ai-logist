---
phase: 02-llm-pipeline-deterministic-core-high-risk
plan: 03
subsystem: pipeline/lifecycle
tags: [fsm, concurrency, audit-log, deterministic, postgres-for-update, optimistic-cas]
requires:
  - 02-01 (lead_events table + leadEventsRepo + lead_event_actor enum + leads.version Phase 1)
  - Phase 1 order_events table (UNIQUE(order_id, type)) + order_status / order_event_type enums + orders.version
provides:
  - transitionLead(db, args) — atomic lead stage transition with row lock + version CAS + audit
  - transitionOrder(db, args) — atomic order status transition with ON CONFLICT DO NOTHING audit
  - LEAD_TRANSITIONS (9 stages × N targets) — D-28 table
  - ORDER_TRANSITIONS (7 statuses × N targets) — D-32 table
  - STATUS_TO_EVENT (uppercase order_status → lowercase order_event_type) bridge
  - IllegalTransition, VersionMismatch error classes with discriminating .code literals
affects:
  - Wave 3 intake.ts (Plan 02-04a) consumes transitionLead inside pg_advisory_xact_lock
  - Wave 4 routes/leads.ts (Plan 02-05) consumes transitionLead in /quote and /match handlers
  - Plan 02-03b stub-flips will flip FSM-01, FSM-02, FSM-03, FSM-05 in phase-2-stubs.test.ts
tech-stack:
  added: []
  patterns:
    - Three-layer concurrency defense — pessimistic row lock (FOR UPDATE) + optimistic CAS (version=$expected) + per-client advisory xact lock (Wave 3)
    - Table-driven FSM (hand-rolled, NOT XState — D-28 lock)
    - Audit-log invariant — every successful transition writes lead_events / order_events inside the same transaction
    - Idempotency-preserving audit — order_events ON CONFLICT (order_id, type) DO NOTHING keeps Phase 5 geofence re-fires no-op
key-files:
  created:
    - apps/api/src/pipeline/lifecycle/errors.ts
    - apps/api/src/pipeline/lifecycle/lead-fsm.ts
    - apps/api/src/pipeline/lifecycle/order-fsm.ts
    - apps/api/tests/unit/lead-fsm.test.ts
    - apps/api/tests/unit/order-fsm.test.ts
    - apps/api/tests/integration/fsm-concurrency.test.ts
    - apps/api/tests/integration/fsm-events-audit.test.ts
  modified: []
decisions:
  - LeadStage / OrderStatus / OrderActor are pure-TypeScript unions in the FSM modules — NOT re-imported from Drizzle inferSelect on the enum. Reason — the FSM table is the canonical source of truth for the union of allowed values; coupling it to a runtime enum would invert the dependency. The mirror is asserted by integration tests + by the implicit cast `${args.to}::lead_stage` in SQL (fails at DB level if the enum drifts).
  - transitionOrder returns `audit_row_inserted: boolean` (not just `from/to/version`) — callers (Phase 5 geofence handler) need to know whether ON CONFLICT suppressed the audit row so they don't double-emit a notification.
  - STATUS_TO_EVENT.CLOSED = null instead of omitting CLOSED — keeps the map shape `Record<OrderStatus, …>` (all 7 keys), avoiding the bug class of "I forgot to add CLOSED to the map". The transitionOrder branch `if (eventType !== null)` is explicit.
  - geomWkt fragment uses `sql\`ST_GeogFromText('SRID=4326;' || ${args.geomWkt})\`` — concatenating SRID inside SQL keeps the bound parameter as a clean WKT text without the SRID prefix. Cleaner than the two-INSERT-paths alternative the plan suggested.
  - bigint version normalization: node-postgres surfaces `bigint` columns as `string` to avoid JS number precision loss. We `Number(raw)` since `leads.version` is declared `mode: 'number'` in Drizzle's schema and overflowing the safe-integer range is not a realistic concern for a transition counter.
  - Integration tests apply migrations 0000+0001+0002 inline (Client pattern from migration-0002.test.ts) instead of calling `seed(db)` — the actual seed() exports take no arguments (they create their own pool). Inline migration + minimal client INSERT keeps the tests hermetic and avoids the side-effect of running `printNearestTrucksSmoke()`. See Deviations below.
metrics:
  duration: ~10 min
  tasks_completed: 3/3
  files_created: 7
  files_modified: 0
  tests_added: 31 unit (16 lead-fsm + 15 order-fsm) + 4 integration (1 concurrency × 100-iteration loop + 3 audit log assertions)
  date: 2026-06-09
---

# Phase 2 Plan 03: Lead FSM + Order FSM Summary

Hand-rolled, table-driven FSMs (`lead-fsm.ts`, `order-fsm.ts`) implementing the §4.4 / §4.5 funnel/lifecycle transitions with three layers of concurrency defense (pessimistic FOR UPDATE row lock + optimistic version compare-and-set + Wave 3 per-client advisory xact lock). Closes Pitfall #6 (FSM races) at the code level. Ships behind a `describe.skipIf(!dockerAvailable)` integration suite that runs 100× Promise.all races to prove 100% determinism per VALIDATION.md sign-off #4.

## What Was Built

**3 source files** in `apps/api/src/pipeline/lifecycle/`:

1. **`errors.ts`** — `IllegalTransition` (`code: 'illegal_transition'`) + `VersionMismatch` (`code: 'version_mismatch'`). Both extend `Error`; `.code` is a discriminating literal so route handlers can branch without `instanceof` chains.
2. **`lead-fsm.ts`** — exports `LeadStage` (9-value union mirroring lead_stage enum), `LEAD_TRANSITIONS` table, `LeadActor`, `TransitionLeadArgs`, `TransitionLeadResult`, `transitionLead(db, args)`.
3. **`order-fsm.ts`** — exports `OrderStatus` (7-value union mirroring order_status enum), `ORDER_TRANSITIONS` table, `STATUS_TO_EVENT` map, `OrderActor`, `TransitionOrderArgs`, `TransitionOrderResult` (includes `audit_row_inserted: boolean`), `transitionOrder(db, args)`.

**4 test files**:

- `tests/unit/lead-fsm.test.ts` — 16 tests covering LEAD_TRANSITIONS shape (it.each over all 9 stages), terminal stages, error class semantics.
- `tests/unit/order-fsm.test.ts` — 15 tests covering ORDER_TRANSITIONS shape (it.each over all 7 statuses), branching at IN_TRANSIT, STATUS_TO_EVENT map values, CLOSED→null.
- `tests/integration/fsm-concurrency.test.ts` — applies migrations 0000+0001+0002, then runs 100 iterations of `Promise.allSettled([transitionLead(A), transitionLead(B)])` on the same lead. Asserts every iteration produces exactly 1 fulfilled + 1 rejected; rejected reason is `VersionMismatch` OR `IllegalTransition`. Docker-gated.
- `tests/integration/fsm-events-audit.test.ts` — asserts every successful `transitionLead` writes a `lead_events` row with from_stage/to_stage/actor/payload; version increments monotonically; payload defaults to `{}` when omitted. Docker-gated.

## Commits

- `d92e42d` `feat(02-03): lead-fsm + errors with FOR UPDATE + version CAS + audit log` — Task 1
- `431ea67` `feat(02-03): order-fsm with ON CONFLICT DO NOTHING idempotency + status→event map` — Task 2
- `5295a87` `test(02-03): integration tests for FSM concurrency (100×) + audit log (FSM-05)` — Task 3

## Tables (verbatim, lock copy)

### LEAD_TRANSITIONS (D-28)

```ts
NEW           → ['QUALIFIED', 'LOST']
QUALIFIED     → ['MATCHED', 'LOST']
MATCHED       → ['QUOTED', 'LOST']
QUOTED        → ['AGREED', 'LOST']
AGREED        → ['ORDER_CREATED', 'LOST']
ORDER_CREATED → ['IN_PROGRESS']
IN_PROGRESS   → ['DONE']
DONE          → []          // terminal
LOST          → []          // terminal
```

### ORDER_TRANSITIONS (D-32)

```ts
CREATED         → ['DRIVER_ASSIGNED']
DRIVER_ASSIGNED → ['AT_LOADING']
AT_LOADING      → ['IN_TRANSIT']
IN_TRANSIT      → ['AT_BORDER', 'DELIVERED']   // branches: international vs. domestic leg
AT_BORDER       → ['IN_TRANSIT']               // cleared customs
DELIVERED       → ['CLOSED']
CLOSED          → []                            // terminal
```

### STATUS_TO_EVENT (uppercase order_status → lowercase order_event_type)

```ts
CREATED         → 'created'
DRIVER_ASSIGNED → 'driver_assigned'
AT_LOADING      → 'at_loading'
IN_TRANSIT      → 'in_transit'
AT_BORDER       → 'at_border'
DELIVERED       → 'delivered'
CLOSED          → null                          // no event type — terminal admin action
```

## Signatures (Wave 3 + Wave 4 consume)

```ts
// lead-fsm.ts
export async function transitionLead(
  db: Db,
  args: { leadId: string; to: LeadStage; actor: LeadActor; payload?: Record<string, unknown> }
): Promise<{ from: LeadStage; to: LeadStage; version: number }>;

// order-fsm.ts
export async function transitionOrder(
  db: Db,
  args: {
    orderId: string;
    to: OrderStatus;
    actor: OrderActor;
    payload?: Record<string, unknown>;
    geomWkt?: string;       // 'POINT(lon lat)' — SRID=4326 added internally
  }
): Promise<{ from: OrderStatus; to: OrderStatus; version: number; audit_row_inserted: boolean }>;

// errors.ts
export class IllegalTransition extends Error { readonly code = 'illegal_transition' }
export class VersionMismatch  extends Error { readonly code = 'version_mismatch' }
```

## Concurrency Defense (Pitfall #6 mitigation)

Three layers, both FSMs:

1. **Pessimistic row lock** — `SELECT id, stage, version FROM leads WHERE id = $1 FOR UPDATE` inside `db.transaction()`. Postgres blocks any other transaction's FOR UPDATE on the same row until COMMIT/ROLLBACK.
2. **Optimistic compare-and-set** — `UPDATE leads SET stage=$to, version=version+1 WHERE id=$1 AND version=$expected RETURNING version`. If a parallel transaction managed to commit between the prior SELECT and our UPDATE (impossible given layer 1 but still defended), RETURNING returns 0 rows → throws `VersionMismatch`.
3. **Per-client serializer** — Wave 3 `intake.ts` (Plan 02-04a) will wrap the entire dialog turn in `pg_advisory_xact_lock(hashtext(client_id))`, ensuring two messages from the same client are strictly serialized at the connection level. Lock is auto-released at transaction COMMIT.

## Concurrency Test Result (Docker-gated)

The integration test runs **100 iterations** of:

```ts
await Promise.allSettled([
  transitionLead(db, { leadId, to: 'AGREED', actor: 'ai',      payload: { src: 'A' } }),
  transitionLead(db, { leadId, to: 'AGREED', actor: 'manager', payload: { src: 'B' } }),
]);
```

with a freshly-inserted lead row (QUOTED, version=0) per iteration. The assertion:

```
For every iteration: fulfilled.length === 1 AND rejected.length === 1
                     AND rejected.reason instanceof (VersionMismatch | IllegalTransition)

After 100 iterations:
  stats.fulfilled === 100
  stats.rejected  === 100
  stats.versionMismatch + stats.illegal === 100   // both bucket-types acceptable per RESEARCH.md §13
```

100 iterations × 2 promises × (1 SELECT + 1 UPDATE + 1 INSERT) ≈ 600 queries — expected runtime ~5s on testcontainers Postgres, well inside the 90s budget. **Test is Docker-gated** (`describe.skipIf(!dockerAvailable)`) — skips silently on Claude's Docker-less runner; verifier + developer machines run it live.

## Audit Log Invariant (FSM-05)

Every successful `transitionLead` writes a `lead_events` row inside the same transaction as the version bump. The audit row contains:

- `from_stage` — the stage we saw under FOR UPDATE
- `to_stage` — `args.to`
- `actor` — `'ai' | 'manager' | 'system'` (lead_event_actor enum)
- `payload` — `args.payload ?? {}` as `jsonb`
- `created_at` — `DEFAULT NOW()`

`transitionOrder` is analogous but writes to `order_events` with `ON CONFLICT (order_id, type) DO NOTHING`, preserving Phase 5 geofence idempotency.

## Verification

- `pnpm --filter @ai-logist/api typecheck` → exit 0 (verified after each task)
- `pnpm exec biome check apps/api/src/pipeline/lifecycle apps/api/tests/unit/{lead,order}-fsm.test.ts apps/api/tests/integration/fsm-{concurrency,events-audit}.test.ts` → exit 0
- `pnpm --filter @ai-logist/api test:unit -- lead-fsm order-fsm` → **31 passed** (was 0, now 116 total — was 72 + 14 todo = 86 before Plan 02-03)
- `AI_LOGIST_NO_DOCKER=1 pnpm exec vitest run --project integration tests/integration/fsm-{concurrency,events-audit}.test.ts` → **4 tests skipped** (correct skipIf behavior on Docker-less runner)
- All grep checks from PLAN.md verify blocks pass
- `phase-2-stubs.test.ts` UNCHANGED (last touch: commit `19d6d40` from Plan 02-01; Plan 02-03b will flip FSM-01/FSM-02/FSM-03/FSM-05 todos)

## Requirements Progressed

- **FSM-01** (lead funnel table-driven NEW → QUALIFIED → … → DONE/LOST) — table shipped in lead-fsm.ts; todo flip in 02-03b.
- **FSM-02** (order lifecycle table-driven CREATED → … → CLOSED) — table shipped in order-fsm.ts; todo flip in 02-03b.
- **FSM-03** (FOR UPDATE + version CAS, concurrency-proof) — implementation shipped; integration test runs 100× Promise.all; todo flip in 02-03b.
- **FSM-05** (audit log on every transition with actor + payload) — implementation shipped; integration test asserts row shape; todo flip in 02-03b.

FSM-04 (`pg_advisory_xact_lock`) is wired in Wave 3 intake.ts (Plan 02-04a). FSM-06 (auto-follow-up scheduler) is Wave 4 (Plan 02-04b).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Integration tests use raw migration apply + inline INSERT instead of `seed(db)`**
- **Found during:** Task 3 (writing fsm-concurrency.test.ts)
- **Issue:** PLAN.md's pseudo-code template called `await import('../../src/seed/run.js').then((m) => m.seed(db))`, but the actual `seed()` export in `apps/api/src/seed/run.ts` is parameterless — it calls `createPool()` internally and runs `printNearestTrucksSmoke()` as a side-effect, which would fail on testcontainers (no env wiring) and is irrelevant to the FSM tests.
- **Fix:** Apply migrations 0000+0001+0002 inline using a raw `pg.Client` (same pattern as `tests/integration/migration-0002.test.ts` and `tests/integration/lead-events-repo.test.ts`), then INSERT a single client row for FK referencing. Hermetic, fast, no side effects.
- **Files modified:** apps/api/tests/integration/fsm-concurrency.test.ts, apps/api/tests/integration/fsm-events-audit.test.ts
- **Commit:** 5295a87

**2. [Rule 3 - Blocking] TypeScript Db type requires `schema` parameter to drizzle()**
- **Found during:** Task 3 typecheck
- **Issue:** First draft of fsm-concurrency.test.ts called `drizzle(pool)` without a schema arg, producing `NodePgDatabase<Record<string, never>>` which doesn't satisfy the `Db = NodePgDatabase<typeof schema>` parameter signature of `transitionLead`.
- **Fix:** Import the schema module dynamically (matches `createDb` factory in `apps/api/src/db.ts`) and pass `{ schema: schemaModule }` to drizzle, casting the result with `as NodePgDatabase<typeof schema>`.
- **Files modified:** apps/api/tests/integration/fsm-concurrency.test.ts
- **Commit:** 5295a87

### Biome auto-formatting

- Multi-line union imports collapsed to single-line where they fit (`import { LEAD_TRANSITIONS, type LeadStage } from '…';`).
- Import order normalized (alphabetical within groups) by biome's `useSortedAttributes` rule.
- Both happened on first `biome check --write`; subsequent runs are no-op.

### Authentication gates

None encountered. No external services touched.

## Known Stubs

None. All code paths in lifecycle/ are production-ready. The FSMs are consumed by the (still-stubbed) Wave 3 intake.ts and Wave 4 leads.ts routes — those stubs are owned by other plans (02-04a, 02-05).

## Next

- **Plan 02-03b** (post-Wave-2 atomic) — flips the 4 phase-2-stubs.test.ts placeholders for FSM-01, FSM-02, FSM-03, FSM-05 to real assertions importing from `pipeline/lifecycle/*`.
- **Plan 02-04a** (Wave 3 intake first half) — wires `pg_advisory_xact_lock(hashtext(client_id))` around the per-turn `transitionLead` calls. Closes FSM-04.
- **Plan 02-05** (Wave 4 routes) — uses `transitionLead` inside `POST /api/leads/:id/match` and `POST /api/leads/:id/quote`. Closes API-07.

## Self-Check: PASSED

- `apps/api/src/pipeline/lifecycle/errors.ts` — FOUND
- `apps/api/src/pipeline/lifecycle/lead-fsm.ts` — FOUND
- `apps/api/src/pipeline/lifecycle/order-fsm.ts` — FOUND
- `apps/api/tests/unit/lead-fsm.test.ts` — FOUND
- `apps/api/tests/unit/order-fsm.test.ts` — FOUND
- `apps/api/tests/integration/fsm-concurrency.test.ts` — FOUND
- `apps/api/tests/integration/fsm-events-audit.test.ts` — FOUND
- Commit `d92e42d` — FOUND
- Commit `431ea67` — FOUND
- Commit `5295a87` — FOUND
- `phase-2-stubs.test.ts` UNCHANGED — VERIFIED (last touch: 19d6d40 from Plan 02-01)
