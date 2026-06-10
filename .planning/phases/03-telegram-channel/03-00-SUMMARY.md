---
phase: 03-telegram-channel
plan: 00
subsystem: testing
tags: [vitest, telegram, grammy, webhook, mock, fixtures, test-infra]

# Dependency graph
requires:
  - phase: 02-llm-pipeline-deterministic-core-high-risk
    provides: "dialog-harness.ts pattern, integration-env.ts setupFile, dockerAvailable guard convention, vitest 4 unit/integration projects"
  - phase: 01-database-backend-skeleton
    provides: "test-db.ts testcontainers PostGIS boot, webhook_updates UNIQUE(source,external_id) for idempotency tests"
provides:
  - "MockTelegramBot factory (createMockBot) recording sends + callback responses with NO network access"
  - "postTelegramWebhook helper measuring ack latency via process.hrtime.bigint for sub-ms precision"
  - "11 canonical Telegram Update fixtures (text/callback/command/sticker shapes)"
  - "phase-3-stubs.test.ts with EXACTLY 9 test.todo placeholders (API-13, API-15, TG-01..07)"
  - "9 integration test scaffolds under describe.skipIf(!dockerAvailable) — webhook-idempotency/latency/auth/voice-stub, telegram-adapter/keyboards, driver-confirmation, client-notifications, manager-intercept"
  - "PHASE-3.md harness usage doc with flip schedule + grep-count protocol"
affects:
  - 03-01-foundation
  - 03-02-webhook-route
  - 03-03-adapter-keyboards-outbound
  - 03-04-notifications-driver-fsm-hook
  - 03-05-manager-intercept-readme

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Structural mock without library import — telegram-mock.ts implements grammY 1.43 surface (api.sendMessage / api.answerCallbackQuery / api.editMessageReplyMarkup / botInfo / handleUpdate) WITHOUT importing grammy (Wave 1 owns the install). Lets Wave 0 ship before Wave 1 and lets tests stay vendor-stable."
    - "Latency-measuring driver via process.hrtime.bigint — converts to ms by dividing by 1_000_000 for tight <100ms assertions immune to Date.now() ms granularity."
    - "Fixture JSON keyed by behavior, not by Telegram type — textKyivLviv, callbackConfirm, sticker etc.; downstream waves import { type: 'json' } and reference by key."
    - "Local dockerAvailable per file (matches Phase 1+2 convention process.env.AI_LOGIST_NO_DOCKER !== '1'); no shared export from test-db.ts."
    - "Grep-count gate hygiene — header docstring intentionally avoids literal marker name; the verifier counts via `grep -c 'test.todo'` and prose mentions would corrupt the count."

key-files:
  created:
    - apps/api/tests/_helpers/telegram-mock.ts
    - apps/api/tests/_helpers/webhook-driver.ts
    - apps/api/tests/fixtures/telegram-updates.json
    - apps/api/tests/PHASE-3.md
    - apps/api/tests/unit/phase-3-stubs.test.ts
    - apps/api/tests/integration/webhook-idempotency.test.ts
    - apps/api/tests/integration/webhook-latency.test.ts
    - apps/api/tests/integration/webhook-auth.test.ts
    - apps/api/tests/integration/webhook-voice-stub.test.ts
    - apps/api/tests/integration/telegram-adapter.test.ts
    - apps/api/tests/integration/telegram-keyboards.test.ts
    - apps/api/tests/integration/driver-confirmation.test.ts
    - apps/api/tests/integration/client-notifications.test.ts
    - apps/api/tests/integration/manager-intercept.test.ts
  modified: []

key-decisions:
  - "MockTelegramBot ships callbackQueries[] recorder beyond the verbatim RESEARCH Code Block 13 mock — handlers.ts callback flow calls answerCallbackQuery before answering the user, and Wave 3 tests need to assert that the answerCallbackQuery happened (200ms requirement is part of TG-03's UX)."
  - "Voice-stub scaffold (webhook-voice-stub.test.ts) ships as the 9th integration file — API-15 is a 501 → 200 flip but still belongs to Phase 3; Wave 2 flips both webhook routes together so coupling them in the same wave makes sense."
  - "phase-3-stubs.test.ts header explicitly avoids the literal marker substring to keep the grep-count gate clean (Phase 1+2 lesson burned three times)."
  - "Webhook driver returns { res, elapsedMs } rather than mutating a closure — matches Phase 2's runScript shape (returns ScriptResult) and lets latency assertions sit inline next to status-code assertions."
  - "Mock sendMessage return shape mirrors the Telegram Bot API Message contract (message_id, chat, text, date) — Wave 3 code may chain .then on a sendMessage response when implementing handlers.ts; keeping the shape realistic prevents surprise test rewrites."

patterns-established:
  - "Wave 0 deliverables ship as the FIRST plan in a multi-wave phase — test infra before any production code; mirrors Phase 1 Plan 01-00 and Phase 2 Plan 02-00."
  - "Per-plan fixture JSON colocated in apps/api/tests/fixtures/ — extends the Phase 2 pattern (canonical-inputs.json, llm-responses.json, injection-attempts.json, cities-extra.json)."
  - "Each integration scaffold is a single describe.skipIf(!dockerAvailable) block with one test.todo placeholder — minimal shape so flip waves only have to add it() calls without restructuring."

requirements-completed: [API-13, API-15, TG-01, TG-02, TG-03, TG-04, TG-05, TG-06, TG-07]

# Metrics
duration: 5min
completed: 2026-06-10
---

# Phase 3 Plan 00: Test Infrastructure Summary

**MockTelegramBot + latency-measuring webhook driver + 11 canonical Telegram Update fixtures + 9 acceptance stubs + 9 integration scaffolds — every Phase 3 requirement now has a flippable test target.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-10T05:35:06Z
- **Completed:** 2026-06-10T05:40:00Z
- **Tasks:** 2 (both `auto` with `tdd="true"`)
- **Files created:** 14

## Accomplishments

- `apps/api/tests/_helpers/telegram-mock.ts` ships a structural grammY 1.43 mock (`createMockBot()` → `{ bot, sent, callbackQueries }`) with NO grammy import — Wave 1 owns the package install, Wave 0 stays vendor-stable.
- `apps/api/tests/_helpers/webhook-driver.ts` measures ack latency via `process.hrtime.bigint() / 1_000_000` — sub-ms precision lets the TG-02 `expect(elapsedMs < 100)` assertion be tight without flakes.
- `apps/api/tests/fixtures/telegram-updates.json` ships 11 canonical Telegram Update payloads keyed by behavior (textKyivLviv, textConfirm, textShortOk, callbackConfirm, callbackReject, callbackChange, callbackDriverAccept, callbackDriverDecline, commandStart, commandHelp, sticker). All `callback_query.data` follow D-13 `<action>:<id>` format with placeholder UUIDs.
- `apps/api/tests/unit/phase-3-stubs.test.ts` carries EXACTLY 9 `test.todo()` markers (verified via `grep -c` AND vitest report "9 todo (9)"). One per Phase 3 requirement: API-13, API-15, TG-01..07.
- 9 integration scaffolds at `apps/api/tests/integration/{webhook-idempotency,webhook-latency,webhook-auth,webhook-voice-stub,telegram-adapter,telegram-keyboards,driver-confirmation,client-notifications,manager-intercept}.test.ts` — each one `describe.skipIf(!dockerAvailable)` + 1 `test.todo()` placeholder. Imports nothing from Phase 3 production code (it doesn't exist yet) — only test helpers.
- `apps/api/tests/PHASE-3.md` documents the harness with grep-friendly sections: MockTelegramBot, webhook-driver, telegram-updates fixtures, real-bot smoke gate, todo flip schedule, integration scaffold inventory.

## Task Commits

Each task was committed atomically:

1. **Task 1: MockTelegramBot + webhook-driver + fixtures + PHASE-3.md** — `32a5025` (test)
2. **Task 2: phase-3-stubs.test.ts (9 todos) + 9 integration scaffolds** — `2c6279f` (test)

**Plan metadata:** (final commit follows this summary)

## Files Created/Modified

### Created (14)

- `apps/api/tests/_helpers/telegram-mock.ts` — `createMockBot()` factory returning `{ bot, sent, callbackQueries }`; SentMessage and CallbackQueryRecord interfaces; structural grammY 1.43 surface with NO grammy import.
- `apps/api/tests/_helpers/webhook-driver.ts` — `postTelegramWebhook(app, payload, opts)` → `{ res, elapsedMs }`; defaults `x-telegram-bot-api-secret-token` from `opts.secretToken`; supports `extraHeaders` override.
- `apps/api/tests/fixtures/telegram-updates.json` — 11 canonical Telegram Update payloads keyed by behavior.
- `apps/api/tests/PHASE-3.md` — harness usage doc (MockTelegramBot, webhook-driver, fixtures, real-bot smoke gating, flip schedule).
- `apps/api/tests/unit/phase-3-stubs.test.ts` — 9 `test.todo` placeholders, one per Phase 3 requirement.
- `apps/api/tests/integration/webhook-idempotency.test.ts` — TG-02 idempotency scaffold.
- `apps/api/tests/integration/webhook-latency.test.ts` — TG-02 latency scaffold.
- `apps/api/tests/integration/webhook-auth.test.ts` — TG-01 / API-13 secret_token scaffold.
- `apps/api/tests/integration/webhook-voice-stub.test.ts` — API-15 voice stub scaffold.
- `apps/api/tests/integration/telegram-adapter.test.ts` — Adapter mapping scaffold.
- `apps/api/tests/integration/telegram-keyboards.test.ts` — TG-03 / TG-04 keyboards scaffold.
- `apps/api/tests/integration/driver-confirmation.test.ts` — TG-05 driver notify scaffold.
- `apps/api/tests/integration/client-notifications.test.ts` — TG-07 FSM-hook scaffold.
- `apps/api/tests/integration/manager-intercept.test.ts` — TG-06 intercept scaffold.

### Modified

None.

## Decisions Made

- **callbackQueries[] recorder added beyond RESEARCH Code Block 13** — the verbatim mock only records `sent[]`. Phase 3's callback handler flow (D-15) calls `ctx.answerCallbackQuery()` BEFORE answering the user; Wave 3 tests need to assert this call happened (200ms requirement). Adding `callbackQueries[]` is the minimum extension to make those assertions trivial.
- **`webhook-voice-stub.test.ts` is the 9th integration file** — VALIDATION.md called out 8 named files; API-15 (voice 501→200) was the orphan. Coupling it here means Wave 2 flips webhook-telegram + webhook-voice together; both endpoints live in the same routes module and share secret_token / sensible default patterns.
- **`dockerAvailable` defined locally per file** — Phase 1+2 convention (`process.env.AI_LOGIST_NO_DOCKER !== '1'`). No shared export from `test-db.ts` was created earlier; replicating the local pattern keeps the diff focused on Phase 3 scaffolds.
- **Mock `sendMessage` return shape mirrors real Telegram Message** — `{ message_id, chat, text, date }`. Wave 3 production handlers may chain `.then()` on send responses; realistic shape prevents test rewrites when production code lands.
- **PHASE-3.md flip-schedule table is the spec for downstream waves** — encodes which plan flips which todo, ensuring the `grep -c "test.todo"` gate decreases monotonically: 9 → 5 (after 03-02) → 3 (after 03-03) → 1 (after 03-04) → 0 (after 03-05).

## Deviations from Plan

None — plan executed exactly as written.

The plan's RESEARCH Code Block 13 mock was extended with `callbackQueries[]` and `CallbackQueryRecord` interface (called out in the plan's `<action>` block 1 explicitly: "Optional `callbackQueries: CallbackQueryRecord[]` array records `answerCallbackQuery` calls" — so this is in-plan, not a deviation).

All 11 fixture keys, 9 stub todos, 9 integration files, PHASE-3.md sections, biome formatting, and typecheck cleanliness landed on the first attempt.

## Issues Encountered

- Biome 2.4 line-length formatter wrapped two `test.todo(...)` calls onto multi-line shape after first write; auto-fix via `biome check --write` resolved without changing semantics. The `grep -c "test.todo"` count stayed at 9 (biome wraps args, not the `test.todo` identifier). Reusable lesson: biome wrapping is line-based and never splits the function-name token, so grep gates are biome-safe.

## Next Phase Readiness

- **Wave 1 (Plan 03-01)** can `import { createMockBot } from '../_helpers/telegram-mock.js'` and `import { postTelegramWebhook } from '../_helpers/webhook-driver.js'` immediately. Telegram plugin scaffold can be wired against the mock for unit-level smoke (e.g., assert `app.bot.botInfo.username === 'test_bot'` after `app.decorate('bot', mock.bot)`).
- **Wave 2 (Plan 03-02)** flips API-13, API-15, TG-01, TG-02 placeholders. webhook-latency.test.ts, webhook-idempotency.test.ts, webhook-auth.test.ts, and webhook-voice-stub.test.ts scaffolds are ready for `it(...)` implementations.
- **Wave 3 (Plan 03-03)** flips TG-03, TG-04 — telegram-keyboards.test.ts and telegram-adapter.test.ts ready; fixtures (`textKyivLviv`, `callbackConfirm/Reject/Change`) immediately consumable.
- **Wave 4 (Plan 03-04)** flips TG-05, TG-07 — driver-confirmation.test.ts and client-notifications.test.ts ready; `callbackDriverAccept/Decline` fixtures immediately consumable.
- **Wave 5 (Plan 03-05)** flips TG-06 + final stub-count gate (0 todos) + checkpoint:human-verify.

**No blockers.** Stub count locked at 9, typecheck + biome clean across all 14 new files, unit suite reports `148 passed | 9 todo` (148 from Phases 1+2 preserved, 9 new Phase 3 stubs).

## Known Stubs

None — Plan 03-00 is itself a stub-shipping plan. The 9 `test.todo()` placeholders in `phase-3-stubs.test.ts` and the 9 integration scaffold placeholders are the EXPECTED Wave 0 output; they are not unintentional stubs. They are tracked for downstream flip waves per the schedule in PHASE-3.md.

## Self-Check: PASSED

Verified all created files exist:
- apps/api/tests/_helpers/telegram-mock.ts — FOUND
- apps/api/tests/_helpers/webhook-driver.ts — FOUND
- apps/api/tests/fixtures/telegram-updates.json — FOUND
- apps/api/tests/PHASE-3.md — FOUND
- apps/api/tests/unit/phase-3-stubs.test.ts — FOUND (9 `test.todo` markers, vitest reports `9 todo (9)`)
- apps/api/tests/integration/webhook-idempotency.test.ts — FOUND
- apps/api/tests/integration/webhook-latency.test.ts — FOUND
- apps/api/tests/integration/webhook-auth.test.ts — FOUND
- apps/api/tests/integration/webhook-voice-stub.test.ts — FOUND
- apps/api/tests/integration/telegram-adapter.test.ts — FOUND
- apps/api/tests/integration/telegram-keyboards.test.ts — FOUND
- apps/api/tests/integration/driver-confirmation.test.ts — FOUND
- apps/api/tests/integration/client-notifications.test.ts — FOUND
- apps/api/tests/integration/manager-intercept.test.ts — FOUND

Verified commits exist:
- 32a5025 (Task 1) — FOUND
- 2c6279f (Task 2) — FOUND

Verified gates:
- `grep -c "test.todo" apps/api/tests/unit/phase-3-stubs.test.ts` = 9
- `pnpm --filter @ai-logist/api typecheck` exit 0
- `pnpm exec biome check apps/api/tests/_helpers apps/api/tests/unit apps/api/tests/integration apps/api/tests/fixtures` exit 0
- `pnpm test:unit` → 148 passed | 9 todo / 0 failures
- All 11 fixture keys present with valid `update_id`

---
*Phase: 03-telegram-channel*
*Completed: 2026-06-10*
