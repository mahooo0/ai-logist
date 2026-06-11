---
phase: 06-order-lifecycle-automation-auto-progress-ticker-telegram-confirmations-at-pickup-delivery-stripe-test-mode-checkout-status-transitions-negative-paths
plan: 4
subsystem: api, ui
tags: [fastify, admin-auth, shared-secret, react, testing-library, stripe, order-fsm]

# Dependency graph
requires:
  - phase: 06-00-wave-zero-test-infra-and-migration
    provides: auto_progress_paused column, order_events admin_override type, ADMIN_API_SECRET config
  - phase: 06-02-background-ticker-and-fsm-edges
    provides: tickerLoop with auto_progress_paused=false filter, order-fsm bypass patterns
  - phase: 06-03-stripe-checkout-and-webhook
    provides: AWAITING_PAYMENT status, PATCH /progress endpoint reuse
provides:
  - Admin-authenticated PATCH /api/orders/:id/status (FSM bypass, admin_override audit event)
  - Admin-authenticated POST /api/orders/:id/ticker (pause/resume auto-progress)
  - adminAuthPlugin: requireAdmin preHandler with optional shared-secret (X-Admin-Secret header)
  - OrderActionBar React component with status dropdown + pause/resume + reset
  - /payment/success and /payment/cancel public stub pages (Stripe redirect targets)
  - autoProgressPaused field in OrderSchema (W8 typed contract)
affects: [06-05-uat-and-phase-summary, downstream order management UI]

# Tech tracking
tech-stack:
  added: ["@testing-library/jest-dom ^6.9.1 (dev)"]
  patterns:
    - "Admin shared-secret preHandler: requireAdmin is a no-op when ADMIN_API_SECRET unset, guards when set"
    - "Mock app builder pattern for route integration tests: include serializerCompiler + validatorCompiler + sensible"
    - "Zod v4 strict UUID validation: test fixtures must use version-4 UUIDs (not all-zero nil UUIDs)"
    - "jest-dom matchers via vitest: extend via matchers import + tests/vitest.d.ts type augmentation"
    - "W8 schema extension: add optional field to OrderSchema without breaking existing typed fixtures"

key-files:
  created:
    - apps/api/src/plugins/admin-auth.ts
    - apps/web/src/app/(main)/dashboard/orders/[id]/_components/order-action-bar.tsx
    - apps/web/src/app/payment/success/page.tsx
    - apps/web/src/app/payment/cancel/page.tsx
    - apps/web/tests/vitest.d.ts
    - apps/web/tests/_helpers/jest-dom.d.ts
  modified:
    - apps/api/src/app.ts
    - apps/api/src/routes/orders.ts
    - apps/api/tests/integration/admin-override.test.ts
    - apps/api/tests/integration/ticker-pause.test.ts
    - apps/api/tests/unit/phase-6-stubs.test.ts
    - apps/web/src/app/(main)/dashboard/orders/[id]/_components/order-detail-app.tsx
    - apps/web/tests/order-action-bar.test.tsx
    - apps/web/tests/_helpers/render.ts
    - apps/web/vitest.config.ts
    - packages/shared-types/src/api/orders.ts

key-decisions:
  - "Admin auth: shared-secret X-Admin-Secret header when ADMIN_API_SECRET env set; no-op when unset preserves open dev posture (Pitfall 6 mitigation)"
  - "Mock app builder in integration tests must include Zod type provider (serializerCompiler + validatorCompiler) — bare Fastify causes AJV schema validation error"
  - "autoProgressPaused uses z.boolean().optional() not .default(false) so TypeScript inferred type stays optional and existing test fixtures don't break"
  - "Test UUIDs must be valid v4 format — Zod v4 rejects nil/all-zero UUIDs in params validation"
  - "vi.mock() calls moved to top-level of ticker-pause.test.ts to avoid future vitest hoisting error"

patterns-established:
  - "Pattern 1: requireAdmin decorator — no-op when ADMIN_API_SECRET unset; guards otherwise"
  - "Pattern 2: integration test buildMockApp always sets validatorCompiler + serializerCompiler"
  - "Pattern 3: jest-dom matchers wired via expect.extend in setup file + vitest.d.ts type declaration"

requirements-completed: [D-15, D-20, D-21, D-22]

# Metrics
duration: 45min
completed: 2026-06-11
---

# Phase 6 Plan 4: Admin Overrides and Action Bar Summary

**Admin FSM bypass endpoints (PATCH /status, POST /ticker) guarded by optional X-Admin-Secret + OrderActionBar client component with SWR revalidation, Stripe redirect stub pages, and W8 typed schema extension**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-06-11T20:00:00Z
- **Completed:** 2026-06-11T20:45:00Z
- **Tasks:** 2 of 2
- **Files modified:** 15

## Accomplishments

- Admin-auth plugin with shared-secret preHandler: open when ADMIN_API_SECRET unset (demo), guards when set (production hardening)
- PATCH /api/orders/:id/status bypasses FSM, writes admin_override audit event with operator-supplied reason
- POST /api/orders/:id/ticker sets auto_progress_paused flag; ticker SELECT already excludes paused rows
- OrderActionBar React component: status dropdown (10 values), Pause/Resume toggle, Reset Progress button; all actions SWR-revalidate
- Payment stub pages /payment/success and /payment/cancel as public Next.js server components
- W8: autoProgressPaused added to OrderSchema in shared-types; GET /orders/:id SELECT alias updated

## Task Commits

1. **Task 1: admin-auth plugin + PATCH /status + POST /ticker** - `77a3e9c` (feat)
2. **Task 2: OrderActionBar + payment stubs + W8 schema** - `a26919d` (feat)

## Auth-Secret Behavior Matrix

| ADMIN_API_SECRET env | X-Admin-Secret header | Result |
|---------------------|----------------------|--------|
| unset (default)     | absent               | 200 — open for dev/demo |
| unset (default)     | any value            | 200 — header ignored |
| set                 | absent               | 401 unauthorized |
| set                 | wrong value          | 401 unauthorized |
| set                 | correct value        | 200 authorized |

## Action Bar Test-IDs (for downstream Playwright/Cypress UAT)

| data-testid        | Element        | Action                        |
|--------------------|----------------|-------------------------------|
| `order-action-bar` | wrapper div    | container for all controls    |
| `status-dropdown`  | select element | force status change           |
| `pause-toggle`     | button         | Пауза / Возобновить toggle    |
| `reset-progress`   | button         | reset progress_percent to 0   |

## Stripe Success/Cancel Stub URLs

- **Success:** `/payment/success?session_id=<stripe_session_id>`
- **Cancel:** `/payment/cancel`

Both are public routes (no auth middleware), outside `(main)` route group.

## Files Created/Modified

- `apps/api/src/plugins/admin-auth.ts` — requireAdmin Fastify decorator, X-Admin-Secret check
- `apps/api/src/app.ts` — adminAuthPlugin registered before route plugins
- `apps/api/src/routes/orders.ts` — 2 new endpoints + serializeOrder autoProgressPaused + GET alias
- `apps/api/tests/integration/admin-override.test.ts` — B1 auth matrix (a/b/c/d) + FSM bypass tests
- `apps/api/tests/integration/ticker-pause.test.ts` — POST /ticker route + tickerLoop SQL filter
- `apps/api/tests/unit/phase-6-stubs.test.ts` — D-15/D-20/D-21/D-22 flipped; 1 skip remains (D-10)
- `apps/web/src/app/(main)/dashboard/orders/[id]/_components/order-action-bar.tsx` — D-22 component
- `apps/web/src/app/(main)/dashboard/orders/[id]/_components/order-detail-app.tsx` — action bar mounted
- `apps/web/src/app/payment/success/page.tsx` — Stripe success landing page
- `apps/web/src/app/payment/cancel/page.tsx` — Stripe cancel landing page
- `apps/web/tests/order-action-bar.test.tsx` — 5 RTL tests
- `apps/web/tests/vitest.d.ts` — jest-dom type augmentation for toBeInTheDocument etc.
- `apps/web/tests/_helpers/render.ts` — jest-dom matchers + cleanup added
- `apps/web/vitest.config.ts` — include tests/*.test.tsx at root level
- `packages/shared-types/src/api/orders.ts` — autoProgressPaused: z.boolean().optional()

## Decisions Made

- Admin auth uses shared-secret header (not JWT) — fast to implement, adequate for single-admin demo
- `requireAdmin` registered as Fastify decorator so any future route can add it as preHandler
- Test mock app builder explicitly wires `validatorCompiler` + `serializerCompiler` + `@fastify/sensible` — bare Fastify causes AJV schema errors with Zod schemas
- `z.boolean().optional()` instead of `.default(false)` — keeps TypeScript type optional so existing test fixtures compile without adding the field
- All test UUIDs use real v4 format (Zod v4's UUID validator rejects nil UUIDs)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fastify mock app missing Zod type provider**
- **Found during:** Task 1 (admin-override integration test)
- **Issue:** `buildMockApp` in tests used bare `Fastify()` without `setValidatorCompiler`/`setSerializerCompiler`. This caused AJV to try to validate the raw Zod schema as JSON Schema, producing "data/required must be array" error.
- **Fix:** Added `serializerCompiler`, `validatorCompiler`, and `@fastify/sensible` to `buildMockApp` in both test files.
- **Files modified:** admin-override.test.ts, ticker-pause.test.ts
- **Committed in:** 77a3e9c

**2. [Rule 1 - Bug] Test UUIDs failing Zod v4 UUID validation**
- **Found during:** Task 1 (admin-override integration test)
- **Issue:** Test orderId `'00000000-0000-0000-0000-000000000001'` fails Zod v4 UUID regex (requires version nibble 1-8).
- **Fix:** Replaced with valid v4 UUID `'be20a98e-7782-4f6c-8880-e35279f219d8'`.
- **Files modified:** admin-override.test.ts, ticker-pause.test.ts
- **Committed in:** 77a3e9c

**3. [Rule 2 - Missing Critical] jest-dom matchers not installed for web RTL tests**
- **Found during:** Task 2 (order-action-bar.test.tsx)
- **Issue:** `@testing-library/jest-dom` not in web package.json; `toBeInTheDocument` fails at runtime.
- **Fix:** Installed `@testing-library/jest-dom`, extended vitest expect via `matchers` import in render helper, added `tests/vitest.d.ts` type augmentation file.
- **Files modified:** apps/web/package.json, apps/web/tests/_helpers/render.ts, new apps/web/tests/vitest.d.ts
- **Committed in:** a26919d

---

**Total deviations:** 3 auto-fixed (2 Rule 1 bugs, 1 Rule 2 missing critical)
**Impact on plan:** All fixes necessary for test correctness. No scope creep.

## Issues Encountered

- Zod v4 strict UUID validation breaks test fixtures that use all-zero orderId patterns — required changing test UUIDs to valid v4 format.
- `@testing-library/jest-dom` v6 changed import path: use `from '@testing-library/jest-dom/matchers'` + `expect.extend()` rather than direct import (which requires `expect` as global).

## Known Stubs

None — all controls in OrderActionBar make real fetch calls. Payment pages are intentionally minimal (no order data displayed, per spec Open Q 5).

## Next Phase Readiness

- All 4 Wave 4 decisions implemented (D-15, D-20, D-21, D-22)
- phase-6-stubs.test.ts: 1 remaining skip (D-10, requires DB migration apply)
- Plan 06-05 (UAT walkthrough) can proceed: action bar test-ids documented above for Playwright/Cypress
- Admin can now override stuck orders from /dashboard/orders/[id] without needing DB access
- Stripe redirect pages are live at /payment/success and /payment/cancel

---
*Phase: 06-order-lifecycle-automation*
*Completed: 2026-06-11*
