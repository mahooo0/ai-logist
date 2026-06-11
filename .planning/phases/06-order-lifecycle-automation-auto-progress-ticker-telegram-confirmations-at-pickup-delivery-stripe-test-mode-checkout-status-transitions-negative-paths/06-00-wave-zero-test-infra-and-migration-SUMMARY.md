---
phase: 6
plan: 0
subsystem: api+schema+tests
tags: [migration, test-scaffolding, stripe, order-fsm, enums, config]
dependency_graph:
  requires: []
  provides:
    - apps/api/drizzle/0006_order_lifecycle.sql
    - apps/api/src/persistence/schema/_enums.ts (extended)
    - apps/api/src/persistence/schema/orders.ts (autoProgressPaused column)
    - apps/api/src/pipeline/lifecycle/order-fsm.ts (extended OrderStatus + ORDER_TRANSITIONS + STATUS_TO_EVENT)
    - apps/api/src/config.ts (DEMO_TICKER_*, STRIPE_*, ADMIN_API_SECRET)
    - apps/api/tests/unit/phase-6-stubs.test.ts (21 markers)
    - 20 test scaffold files (all test.skip, Wave 0 baseline)
  affects:
    - All Phase 6 plans (Wave 1–5 flip test.skip to live tests)
    - apps/api/tests/unit/order-fsm.test.ts (updated assertions for new statuses)
    - apps/api/tests/unit/phase-2-stubs.test.ts (FSM-02 assertion updated 7→10)
tech_stack:
  added:
    - stripe@22.2.0 (apps/api dependencies, exact pin)
  patterns:
    - Manual SQL migration pattern (ALTER TYPE ADD VALUE outside transaction — Pitfall 5)
    - requireXConfig() boundary guard pattern (config.ts optional fields + throw at route)
    - B5 Path A: STATUS_TO_EVENT.AT_LOADING = 'loading_prompted' (single source of truth for timeout SQL)
    - Monotonic stub-marker file (phase-6-stubs.test.ts, 21 markers, grep-c verified)
key_files:
  created:
    - apps/api/drizzle/0006_order_lifecycle.sql
    - apps/api/tests/unit/phase-6-stubs.test.ts
    - apps/api/tests/unit/order-ticker.test.ts
    - apps/api/tests/unit/ticker-loop.test.ts
    - apps/api/tests/unit/polyline-interpolate.test.ts
    - apps/api/tests/unit/i18n-phase6.test.ts
    - apps/api/tests/unit/telegram-keyboards-phase6.test.ts
    - apps/api/tests/unit/telegram-callbacks.test.ts
    - apps/api/tests/unit/stripe-checkout-payload.test.ts
    - apps/api/tests/unit/stripe-config-guard.test.ts
    - apps/api/tests/unit/stripe-webhook-sig.test.ts
    - apps/api/tests/unit/approach-idempotent.test.ts
    - apps/api/tests/integration/order-fsm-phase6.test.ts
    - apps/api/tests/integration/order-events-write.test.ts
    - apps/api/tests/integration/stripe-completed.test.ts
    - apps/api/tests/integration/schema-introspect-phase6.test.ts
    - apps/api/tests/integration/timeout-reminder.test.ts
    - apps/api/tests/integration/timeout-escalation.test.ts
    - apps/api/tests/integration/decline-path.test.ts
    - apps/api/tests/integration/admin-override.test.ts
    - apps/api/tests/integration/ticker-pause.test.ts
    - apps/web/tests/order-action-bar.test.tsx
  modified:
    - apps/api/package.json (stripe@22.2.0 added)
    - apps/api/src/persistence/schema/_enums.ts (3+14+1 enum values)
    - apps/api/src/persistence/schema/orders.ts (autoProgressPaused boolean column)
    - apps/api/src/pipeline/lifecycle/order-fsm.ts (OrderStatus +3, ORDER_TRANSITIONS +8 edges, STATUS_TO_EVENT B5 Path A)
    - apps/api/src/config.ts (7 new env vars)
    - apps/api/tests/unit/order-fsm.test.ts (assertions updated for 10 statuses)
    - apps/api/tests/unit/phase-2-stubs.test.ts (FSM-02 assertion 7→10)
    - pnpm-lock.yaml
decisions:
  - B5 Path A chosen: STATUS_TO_EVENT.AT_LOADING = 'loading_prompted' (not legacy 'at_loading'). This is the single source of truth for Plan 06-02's timeout SQL (WHERE type IN ('loading_prompted', 'delivery_prompted')).
  - CLOSED status now maps to 'closed' event type (was null pre-Phase-6). Terminal admin status now produces an audit-log row.
  - CANCELED status maps to null in STATUS_TO_EVENT — decline/escalation events are written explicitly by their handlers, not via this map.
  - Migration 0006 must be applied manually via psql (not drizzle-kit migrate) — Pitfall 5 invariant.
  - Local DB not running at plan execution time — migration apply skipped; documented here for Plan 06-01 setup.
metrics:
  duration: 11m 24s
  completed_date: "2026-06-11"
  tasks: 3
  files: 29
---

# Phase 6 Plan 0: Wave Zero — Test Infrastructure and Migration Summary

**One-liner:** Phase 6 Wave 0: stripe@22.2.0 installed, migration 0006 hand-written for manual psql apply, 3 TypeScript enums extended, FSM expanded to 10 statuses with 8 new edges (B5 Path A), config extended with 7 env vars, and 21-marker stub file + 20 test scaffolds created.

## What Was Built

### Task 1: Stripe SDK + Migration + Source Extensions

**Stripe SDK installed:** `stripe@22.2.0` pinned in `apps/api/package.json` dependencies (no caret).

**Migration `apps/api/drizzle/0006_order_lifecycle.sql`** (hand-written, no `BEGIN/COMMIT`):
- 3 `ALTER TYPE order_status ADD VALUE IF NOT EXISTS` statements: `DELIVERED_PENDING`, `AWAITING_PAYMENT`, `CANCELED`
- 14 `ALTER TYPE order_event_type ADD VALUE IF NOT EXISTS` statements: `approach_notified`, `loading_prompted`, `loading_confirmed`, `loading_declined`, `delivery_approach_notified`, `delivery_prompted`, `delivery_confirmed`, `delivery_declined`, `payment_link_sent`, `payment_received`, `reminder_sent`, `operator_escalated`, `admin_override`, `closed`
- 1 `ALTER TYPE webhook_source ADD VALUE IF NOT EXISTS 'stripe'`
- 1 `ALTER TABLE orders ADD COLUMN IF NOT EXISTS auto_progress_paused BOOLEAN NOT NULL DEFAULT false`

**CRITICAL — Manual apply required:**
```bash
psql "$DATABASE_URL" -f apps/api/drizzle/0006_order_lifecycle.sql
```
This MUST be applied before Plan 06-01 integration tests can pass. `drizzle-kit migrate` will fail with "ALTER TYPE cannot run inside a transaction block" (Pitfall 5).

**`_enums.ts` extended:** `orderStatusEnum` (+3), `orderEventTypeEnum` (+14), `webhookSourceEnum` (+stripe).

**`orders.ts` extended:** `autoProgressPaused: boolean('auto_progress_paused').notNull().default(false)` column added after `progressPercent`.

**`order-fsm.ts` extended:**
- `OrderStatus` union: +3 values (DELIVERED_PENDING, AWAITING_PAYMENT, CANCELED)
- `ORDER_TRANSITIONS`: 7→10 statuses, 8 new edges per D-11
- `STATUS_TO_EVENT` (B5 Path A): `AT_LOADING` → `'loading_prompted'` (NOT legacy `'at_loading'`); `CLOSED` → `'closed'`; new: `DELIVERED_PENDING` → `'delivery_prompted'`, `AWAITING_PAYMENT` → `'payment_link_sent'`, `CANCELED` → `null`

**`config.ts` extended:** 7 new env vars:
- `DEMO_TICKER_ENABLED` (boolean, default false)
- `DEMO_TICKER_INTERVAL_SEC` (number, default 30)
- `DEMO_TICKER_DELTA_PCT` (number 1-100, default 10)
- `STRIPE_SECRET_KEY` (optional string)
- `STRIPE_WEBHOOK_SECRET` (optional string)
- `STRIPE_PRICE_CURRENCY` (string, default 'rub')
- `STRIPE_SUCCESS_URL` (optional url)
- `STRIPE_CANCEL_URL` (optional url)
- `ADMIN_API_SECRET` (optional string)

### Task 2a: Phase 6 Stub-Marker + 11 API Unit Scaffolds

**`phase-6-stubs.test.ts`:** 21 `test.skip` markers — one per decision D-01..D-22 (D-19 excluded as human-only manual step). `grep -c 'phase-6-stub'` = 21.

**11 unit scaffold files created** (all `test.skip`, vitest collects without Docker):
`order-ticker`, `ticker-loop` (3 skips), `polyline-interpolate`, `i18n-phase6`, `telegram-keyboards-phase6`, `telegram-callbacks`, `stripe-checkout-payload`, `stripe-config-guard` (2 skips), `stripe-webhook-sig` (2 skips), `approach-idempotent`

### Task 2b: 9 API Integration Scaffolds + Web Scaffold

**9 integration scaffold files created** (all `test.skip`):
`order-fsm-phase6`, `order-events-write`, `stripe-completed`, `schema-introspect-phase6`, `timeout-reminder`, `timeout-escalation`, `decline-path`, `admin-override` (2 skips), `ticker-pause`

**1 web scaffold:** `apps/web/tests/order-action-bar.test.tsx`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] phase-2-stubs.test.ts FSM-02 assertion updated 7→10**
- **Found during:** Task 2a
- **Issue:** `phase-2-stubs.test.ts:260` asserted `Object.keys(ORDER_TRANSITIONS).toHaveLength(7)`. Task 1 expanded `ORDER_TRANSITIONS` to 10 entries (Phase 6 D-11), which directly broke this test.
- **Fix:** Updated assertion text to `toHaveLength(10)` — a direct consequence of Task 1's changes.
- **Files modified:** `apps/api/tests/unit/phase-2-stubs.test.ts`
- **Commit:** b08bf82

### Out-of-Scope Pre-existing Failures

The following test failures existed before Phase 6 execution (confirmed via git stash check) and are NOT caused by this plan's changes:
- `tests/snapshots/extract-request.snap.ts` — MockAnthropicClient fixture key hashes changed in a prior phase; deferred to `deferred-items.md`
- `tests/unit/extract-request.test.ts` — same fixture key issue
- `tests/unit/i18n-dict.test.ts` — template text assertions from a prior phase update

These are documented as pre-existing; not caused by Phase 6 Wave 0.

## Migration Apply Instructions

The local PostgreSQL instance was not running at plan execution time (Docker daemon not running). The migration file was authored and verified for syntax correctness.

**Before running Plan 06-01 integration tests, apply the migration:**
```bash
# Ensure Docker is running and the database is up
docker compose up -d db

# Apply migration
psql "$DATABASE_URL" -f apps/api/drizzle/0006_order_lifecycle.sql

# Verify
psql "$DATABASE_URL" -c "SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='order_status' ORDER BY enumsortorder;"
# Expected output includes: DELIVERED_PENDING, AWAITING_PAYMENT, CANCELED

psql "$DATABASE_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_name='orders' AND column_name='auto_progress_paused';"
# Expected output: auto_progress_paused
```

## Self-Check: PASSED
