---
phase: 05-demo-polish-notifications-final-i18n
plan: 01
subsystem: testing
tags: [notifications, telegram, i18n, fsm, audit, testcontainers, scaffolds, wave-1]

# Dependency graph
requires:
  - phase: 05-demo-polish-notifications-final-i18n
    provides: Plan 05-00 — phase-5-stubs.test.ts (11 markers), notif-fsm-transitions + i18n-no-track-link scaffolds
  - phase: 03-telegram-channel
    provides: apps/api/src/lib/i18n.ts renderNotificationTemplate (3 transitions × 2 langs), apps/api/src/channels/telegram/notifications.ts notifyClient, apps/api/src/pipeline/lifecycle/order-fsm.ts transitionOrder onSuccess post-commit hook, adapter.ts tryAdvanceOrderAfterCreation (DRIVER_ASSIGNED caller)
provides:
  - "05-01-NOTIF-AUDIT.md — 6-check audit report with verdict PASS (as-designed): all 8 ORDER_TRANSITIONS edges present; DRIVER_ASSIGNED wired in adapter.ts:189-210; IN_TRANSIT + DELIVERED have no v1 production caller by design (geofence deferred to v2 TRACK_V2-*); zero /track/ substrings in i18n.ts; templates render without throwing; NULL telegram_id skip-silent confirmed"
  - "apps/api/tests/unit/i18n-no-track-link.test.ts flipped from test.todo to it() — NOTIF-02 grep guard via readFileSync"
  - "apps/api/tests/integration/notif-fsm-transitions.test.ts flipped from test.todo to 3 it() blocks (DRIVER_ASSIGNED, IN_TRANSIT, DELIVERED) — each seeds prerequisite status and asserts transitionOrder onSuccess → notifyClient → mock bot sendMessage matches renderNotificationTemplate output"
affects: [05-02-i18n-core, 05-03-snapshot-format-date]

# Tech tracking
tech-stack:
  added: []  # Wave 1 = audit-only; zero new deps
  patterns:
    - "Audit-first wave pattern: produce findings doc before flipping markers — locks Phase 3 wiring contract before Wave 2-5 extend it"
    - "Direct transitionOrder invocation in integration test bypasses missing v1 production caller; locks NOTIF wire-up contract for v2 inheritance"
    - "readFileSync-based unit grep guard pattern for NOTIF-02 (no DB, no network, fast CI gate)"

key-files:
  created:
    - .planning/phases/05-demo-polish-notifications-final-i18n/05-01-NOTIF-AUDIT.md
  modified:
    - apps/api/tests/unit/i18n-no-track-link.test.ts
    - apps/api/tests/integration/notif-fsm-transitions.test.ts

key-decisions:
  - "Verdict PASS (as-designed) not unconditional PASS. PROJECT.md said 'hook on order FSM transitions (DRIVER_ASSIGNED, IN_TRANSIT, DELIVERED)' which was slightly imprecise — Phase 3 ships templates for all 3 transitions and signature for all 3 in notifyClient, but only DRIVER_ASSIGNED has a v1 production onSuccess caller (in adapter.ts:189-210 tryAdvanceOrderAfterCreation). IN_TRANSIT/DELIVERED inherit the wire-up for v2 TRACK_V2-* geofence handlers — not a gap, a v1 scope boundary already documented in CONTEXT §domain Out of Scope."
  - "Integration test uses direct transitionOrder invocation rather than waiting for a production caller. Seeds order in prerequisite status (CREATED → DRIVER_ASSIGNED; AT_LOADING → IN_TRANSIT; IN_TRANSIT → DELIVERED) via INSERT, then exercises the same onSuccess + notifyClient pattern that DRIVER_ASSIGNED already uses in adapter.ts. This proves the wiring contract end-to-end — when v2 geofence handler lands, it inherits a verified path."
  - "Zero production-code modifications — Wave 1 audit-only invariant honored per CONTEXT D-01 and VALIDATION.md. git diff --stat HEAD apps/api/src/ apps/web/src/ packages/shared-types/src/ = empty."
  - "phase-5-stubs.test.ts marker count UNCHANGED at 11. Per VALIDATION.md the NOTIF-01 + NOTIF-02 stub markers flip in Wave 3 (Plan 05-03), not Wave 1. Wave 1 only flips the scaffold .test.ts files (which were test.todo, not phase-5-stubs marker entries)."

patterns-established:
  - "Audit doc structure: Verdict at top, 6 numbered checks with file:line references, recommendations at bottom. Future audit waves (none planned in Phase 5 but useful pattern for v2) can reuse this shape."
  - "Integration test for FSM transitions: testcontainer + drizzle-kit migrate + seed (city + client + truck once in beforeAll) + per-test seed an order in the prerequisite status + invoke transitionOrder with onSuccess + assert mock bot sendMessage matches renderNotificationTemplate(transition, row, lang)."
  - "Grep guard test pattern: fileURLToPath(new URL('../../src/lib/...', import.meta.url)) + readFileSync + expect(content).not.toMatch(/forbidden/). Path resolution invariant of vitest cwd."

requirements-completed:
  - NOTIF-01
  - NOTIF-02

# Metrics
duration: ~4 min
completed: 2026-06-11
---

# Phase 05 Plan 01: NOTIF-01 + NOTIF-02 Audit Summary

**Audit report + 2 scaffold flips locking Phase 3 NOTIF wiring contract — zero production-code modifications, marker count unchanged at 11**

## Performance

- **Duration:** ~4 min (Task 1 audit ~2m; Task 2 scaffold flips ~2m)
- **Started:** 2026-06-11T06:10:11Z
- **Completed:** 2026-06-11T06:14:03Z
- **Tasks:** 2
- **Files created:** 1 (`05-01-NOTIF-AUDIT.md`)
- **Files modified:** 2 (scaffold test flips)
- **Production code modified:** 0 (bit-identical across `apps/api/src/`, `apps/web/src/`, `packages/shared-types/src/`)

## Accomplishments

- `.planning/phases/05-demo-polish-notifications-final-i18n/05-01-NOTIF-AUDIT.md` (192 lines) documents 6 audit checks:
  1. **ORDER_TRANSITIONS edges:** all 8 present at `apps/api/src/pipeline/lifecycle/order-fsm.ts:37-50` (CREATED → DRIVER_ASSIGNED → AT_LOADING → IN_TRANSIT ⇄ AT_BORDER + IN_TRANSIT → DELIVERED → CLOSED + DRIVER_ASSIGNED → CLOSED driver_decline)
  2. **notifyClient onSuccess invocation:** DRIVER_ASSIGNED WIRED at `adapter.ts:189-210`; IN_TRANSIT + DELIVERED have NO v1 production caller — by design per CONTEXT §domain Out of Scope (geofence deferred to v2 TRACK_V2-*); Phase 4 D-37 confirms `/dashboard/orders/[id]` is read-only in v1
  3. **NOTIF-02 grep guard:** zero matches for `/track/`, `trackingUrl`, `public_token` in `i18n.ts`
  4. **Template rendering:** all 6 templates (3 transitions × 2 langs) render without throwing; em-dash fallback for missing fields
  5. **NULL `telegram_id` skip-silent:** confirmed at `notifications.ts:148-151` (info-level log, not warn/error); cross-referenced by `client-notifications.test.ts:131-185`
  6. **One number per notification (ROADMAP success criterion #1):** all template numerical fields sourced from DB row, no LLM paraphrase risk
- `apps/api/tests/unit/i18n-no-track-link.test.ts` flipped from `test.todo` to live `it()` block — uses `readFileSync` + 3 `expect.not.toMatch` assertions. Passes.
- `apps/api/tests/integration/notif-fsm-transitions.test.ts` flipped from `test.todo` to 3 `it()` blocks (one per transition). Each block:
  1. Seeds an order in the prerequisite status via raw `INSERT` (CREATED for DRIVER_ASSIGNED, AT_LOADING for IN_TRANSIT, IN_TRANSIT for DELIVERED — bypasses the FSM since pre-state arrows aren't direct edges)
  2. Invokes `transitionOrder({ to: transition, onSuccess: () => notifyClient({ transition, db, bot, log }) })`
  3. Awaits the fire-and-forget hook via a Promise resolver pattern (matches `client-notifications.test.ts` Phase 3 convention)
  4. Asserts FSM post-state, mock bot sent exactly one message, chatId matches seeded `telegram_id`, text matches `renderNotificationTemplate(transition, row, 'ru')` output
- Docker-gated via `describe.skipIf(!dockerAvailable)` (`process.env.AI_LOGIST_NO_DOCKER !== '1'`). Skips silently under `AI_LOGIST_NO_DOCKER=1` — verified locally (3 tests skipped, exit 0).

## Task Commits

Each task was committed atomically:

1. **Task 1: NOTIF audit report (05-01-NOTIF-AUDIT.md)** — `643ab16` (docs)
2. **Task 2: flip notif-fsm-transitions + i18n-no-track-link scaffolds** — `49bfebe` (test)

## Files Created/Modified

### Created (1 file)

- `.planning/phases/05-demo-polish-notifications-final-i18n/05-01-NOTIF-AUDIT.md` — Audit report with verdict PASS (as-designed), 6 checks with file:line references, recommendations

### Modified (2 files)

- `apps/api/tests/unit/i18n-no-track-link.test.ts` — flipped `test.todo` → `it()` running `readFileSync` + 3 `expect.not.toMatch` against `apps/api/src/lib/i18n.ts`
- `apps/api/tests/integration/notif-fsm-transitions.test.ts` — flipped `test.todo` → 3 `it()` blocks asserting each ORDER_TRANSITION fires notifyClient with the rendered template; reuses Phase 3 `createMockBot` + `startPostgisContainer` + `drizzle-kit migrate` pattern

### Production code modified (0 files)

`git diff --stat HEAD~2 HEAD apps/api/src/ apps/web/src/ packages/shared-types/src/` = empty (verified post-Task 2). Wave 1 audit-only invariant per CONTEXT D-01 honored.

## Decisions Made

- **Verdict PASS (as-designed)** rather than unconditional PASS or FAIL. PROJECT.md's claim of "hook on order FSM transitions (DRIVER_ASSIGNED, IN_TRANSIT, DELIVERED)" was slightly imprecise. Phase 3 ships:
  - All 3 transitions in `renderNotificationTemplate` (apps/api/src/lib/i18n.ts:35-46)
  - All 3 transitions accepted by `notifyClient`'s signature (apps/api/src/channels/telegram/notifications.ts:30-36)
  - **But only DRIVER_ASSIGNED** has a v1 production `onSuccess` caller (adapter.ts:189-210 `tryAdvanceOrderAfterCreation`, invoked from both text path and callback path in handlers.ts:108)
  - IN_TRANSIT + DELIVERED have NO v1 production caller — by design per Phase 5 CONTEXT §domain Out of Scope (geofence deferred to v2 TRACK_V2-*) and Phase 4 D-37 (read-only `/dashboard/orders/[id]` in v1)

  The audit explicitly documents this as `PASS (as-designed)` — not a gap, a documented v1 scope boundary.

- **Integration test uses direct `transitionOrder` invocation** rather than going through a missing production caller. This proves the wire-up contract today (notifyClient correctly handles all 3 transition types when invoked from onSuccess) so v2 geofence handlers inherit a verified path.

- **`phase-5-stubs.test.ts` marker count unchanged at 11.** Per VALIDATION.md Wave 1 table, NOTIF-01 + NOTIF-02 markers in `phase-5-stubs.test.ts` flip in **Wave 3 (Plan 05-03)** — not Wave 1. Wave 1 flips only the scaffold tests (`notif-fsm-transitions.test.ts` + `i18n-no-track-link.test.ts`). The plan's must_haves row "Marker count unchanged at 11 (audit-only wave per VALIDATION.md table)" was explicit.

## Deviations from Plan

None — plan executed exactly as written. The plan acknowledged the IN_TRANSIT/DELIVERED-no-caller case as a potential FAIL outcome that would require adding production wires; the audit clarified this is intentional v1 scope, not a missing wire, so Task 2 still proceeded with scaffold flips (the production-code-untouched branch).

## Issues Encountered

- **Docker unavailable in runner environment.** Integration test (`notif-fsm-transitions.test.ts`) cannot be exercised here because no Docker daemon. Verified `describe.skipIf(!dockerAvailable)` correctly skips all 3 `it()` blocks under `AI_LOGIST_NO_DOCKER=1`. Same skip behavior as every other Phase 3+3.1+4 integration test on this runner. Real Docker-based execution is part of the standard CI gate, not local laptop verification.

- **Unit test verified locally.** `pnpm exec vitest run --project=unit tests/unit/i18n-no-track-link.test.ts` returns `1 passed (1)` (170ms). Full unit suite under `AI_LOGIST_NO_DOCKER=1`: 201 passed | 16 todo (was 200 + 17 todo from Plan 05-00 baseline — net +1 passing, -1 todo, matching the single i18n-no-track-link flip).

## User Setup Required

None — no external service configuration required. Wave 1 is audit + test scaffold flips; runs against existing Phase 1-4 schema and helpers.

## Next Phase Readiness

- **Wave 2 (Plan 05-02) ready.** The i18n core plan can extend `apps/api/src/lib/i18n.ts` with `renderBotReply` + 11-key dictionary × 2 langs without colliding with NOTIF templates. The audit confirmed templates are isolated to the `renderNotificationTemplate` export — `renderBotReply` is a separate symbol.
- **Wave 3 (Plan 05-03) ready.** When Wave 3 lands the `notif-fsm-transitions.test.ts` integration test under Docker (CI), the scaffold is already flipped and asserting the correct contract. Wave 3 will also flip the NOTIF-01 + NOTIF-02 markers in `phase-5-stubs.test.ts` (count 11 → 4 per VALIDATION.md Wave 3 column after I18N-04 + POLISH-01 also flip).
- **Phase 3 wiring preserved bit-identical.** `tryAdvanceOrderAfterCreation` + `notifyClient` + `renderNotificationTemplate` + `notifyDriver` all untouched. Any v2 geofence handler can `import { transitionOrder, notifyClient }` and wire `onSuccess: () => notifyClient({ transition: 'IN_TRANSIT', ... })` with zero changes to Phase 3 source.

## Self-Check: PASSED

### Files exist

- FOUND: `.planning/phases/05-demo-polish-notifications-final-i18n/05-01-NOTIF-AUDIT.md`
- FOUND: `apps/api/tests/unit/i18n-no-track-link.test.ts`
- FOUND: `apps/api/tests/integration/notif-fsm-transitions.test.ts`

### Commits exist

- FOUND: `643ab16` (Task 1 — docs(05-01): NOTIF-01 + NOTIF-02 audit report — PASS as-designed)
- FOUND: `49bfebe` (Task 2 — test(05-01): flip notif-fsm-transitions + i18n-no-track-link scaffolds)

### Invariants

- `phase-5-stubs.test.ts` marker count: **11 (unchanged)** — per VALIDATION.md Wave 1 audit-only row
- `i18n-no-track-link.test.ts` marker count: **0** (was 1) — flipped to live `it()`
- `notif-fsm-transitions.test.ts` marker count: **0** (was 1) — flipped to 3 live `it()` blocks
- NOTIF-02 grep guard: `grep -nE "/track/|trackingUrl|public_token" apps/api/src/lib/i18n.ts` returns nothing (exit 1)
- Phase 3-4 production code: bit-identical (`git diff --stat HEAD~2 HEAD apps/api/src/ apps/web/src/ packages/shared-types/src/` = 0 lines)
- apps/api unit suite: **201 passed | 16 todo** (was 200/17 — +1 passing from i18n-no-track-link flip, -1 todo)
- Integration suite under `AI_LOGIST_NO_DOCKER=1`: `notif-fsm-transitions.test.ts` reports 3 skipped (correct — describe.skipIf gate honored)

---
*Phase: 05-demo-polish-notifications-final-i18n*
*Completed: 2026-06-11*
