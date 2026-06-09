---
phase: 3
slug: telegram-channel
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-09
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for the Telegram channel.
> Reuses Vitest 4 + testcontainers + dialog-harness from Phase 2.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4 (continued from Phase 2) — unit / integration / smoke projects |
| **Config file** | `apps/api/vitest.config.ts` (no changes — reused) |
| **Quick run command** | `pnpm --filter @ai-logist/api test:unit` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | unit ~5s, integration ~60s (testcontainers PG boot), smoke ~5s |

Auxiliary commands:
- `pnpm --filter @ai-logist/api typecheck` — `tsc --noEmit`
- `pnpm exec biome check .` — lint + format
- `pnpm db:migrate:check` — re-apply migrations, expect zero diff
- `pnpm --filter @ai-logist/api test:tg` — gated on `TELEGRAM_BOT_TOKEN` (real bot smoke, manual only)

---

## Sampling Rate

- **After every task commit:** typecheck + biome on changed files + relevant unit slice
- **After every plan wave:** `pnpm test:unit` + `pnpm test:integration`
- **Before `/gsd:verify-work`:** Full suite green; webhook latency assertion <100ms passes
- **Max feedback latency:** typecheck/unit <30s, integration <90s

---

## Per-Task Verification Map

(Filled by planner. Layout below shows expected shape.)

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-W0-01 | 00 | 0 | infra | bootstrap | `test -f apps/api/tests/_helpers/telegram-mock.ts && test -f apps/api/tests/unit/phase-3-stubs.test.ts` | ❌ W0 | ⬜ pending |
| 3-W0-02 | 00 | 0 | infra | stubs | `grep -c "test.todo" apps/api/tests/unit/phase-3-stubs.test.ts` ≥ 9 | ❌ W0 | ⬜ pending |
| 3-01-XX | 01 | 1 | infra | unit | `vitest run config tests + grep TELEGRAM_BOT_USERNAME` | ❌ W0 | ⬜ pending |
| 3-01-XX | 01 | 1 | infra | migration | `db:migrate:check + grep "manager_active" 0003_*.sql` | ❌ W0 | ⬜ pending |
| 3-02-XX | 02 | 2 | TG-01,02 | integration | `vitest run --project integration webhook-idempotency.test` (same update_id 10× → 1 row) | ❌ W0 | ⬜ pending |
| 3-02-XX | 02 | 2 | TG-01,02 | integration | `webhook-latency.test` — `expect(elapsed_ms < 100)` | ❌ W0 | ⬜ pending |
| 3-02-XX | 02 | 2 | API-13,15 | integration | `vitest run --project integration webhook-auth.test` (secret_token verify) | ❌ W0 | ⬜ pending |
| 3-03-XX | 03 | 3 | TG-03,04 | integration | `vitest run --project integration adapter+keyboard.test` (callback → synthetic 'да' → state advance) | ❌ W0 | ⬜ pending |
| 3-04-XX | 04 | 4 | TG-05 | integration | `vitest run --project integration driver-confirmation.test` (real send if telegram_id; stub if null) | ❌ W0 | ⬜ pending |
| 3-04-XX | 04 | 4 | TG-07 | integration | `vitest run --project integration client-notifications.test` (FSM transition → bot sendMessage called) | ❌ W0 | ⬜ pending |
| 3-05-XX | 05 | 5 | TG-06 | integration | `vitest run --project integration manager-intercept.test` (flag flip → intake skips LLM) | ❌ W0 | ⬜ pending |
| 3-05-XX | 05 | 5 | all | smoke | `vitest run --project unit phase-3-stubs.test` (≥9 passing, 0 todo) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 ships Telegram-specific test infra BEFORE any production code.

### Test Harness & Mocks
- [ ] **`apps/api/tests/_helpers/telegram-mock.ts`** — MockTelegramBot class implementing the subset of grammY Bot API used by Phase 3 (`api.sendMessage`, `api.editMessageReplyMarkup`, `api.answerCallbackQuery`, `api.getMe`, `handleUpdate`). Calls recorded for assertion.
- [ ] **`apps/api/tests/fixtures/telegram-updates.json`** — canonical update payloads: text message, callback_query (confirm/reject/change), driver callback, /start, /help, non-text (sticker), short message ("ок"), long message with UA markers.
- [ ] **`apps/api/tests/_helpers/webhook-driver.ts`** — wraps `app.inject({method:'POST', url:'/webhook/telegram', payload, headers})` with proper headers and latency measurement.

### Test Categories
- [ ] **`apps/api/tests/unit/phase-3-stubs.test.ts`** — 9 `test.todo()` markers, one per Phase 3 requirement (API-13, API-15, TG-01..07)
- [ ] **`apps/api/tests/PHASE-3.md`** — docs how to test Telegram channel

### Integration test scaffolds (stub files with `test.todo`)
- [ ] `apps/api/tests/integration/webhook-idempotency.test.ts`
- [ ] `apps/api/tests/integration/webhook-latency.test.ts`
- [ ] `apps/api/tests/integration/webhook-auth.test.ts`
- [ ] `apps/api/tests/integration/telegram-adapter.test.ts`
- [ ] `apps/api/tests/integration/telegram-keyboards.test.ts`
- [ ] `apps/api/tests/integration/driver-confirmation.test.ts`
- [ ] `apps/api/tests/integration/client-notifications.test.ts`
- [ ] `apps/api/tests/integration/manager-intercept.test.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Telegram chat completes pipeline (ROADMAP success criterion #1) | TG-01..04 | Requires real Telegram account + bot token + ngrok tunnel; can't be automated in CI | (1) Create bot via @BotFather, copy TOKEN. (2) Start ngrok: `ngrok http 3000`. (3) `TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... TELEGRAM_PUBLIC_URL=https://xxx.ngrok.io pnpm telegram:setup`. (4) From a real Telegram account write: "Киев-Львов, 18 тонн, тент". (5) Bot offers quote with inline buttons. (6) Tap "Подтвердить рейс". (7) `psql -c "SELECT stage FROM leads ORDER BY created_at DESC LIMIT 1"` returns ORDER_CREATED. |
| Driver Telegram confirmation flow | TG-05 | Requires second real Telegram account for driver | (1) Update `trucks.driver_telegram_id` of one seeded truck to your driver-test account ID. (2) Trigger flow above. (3) After order created, driver account receives "Принять/Отказаться" buttons. (4) Tap Принять → `orders.status` becomes DRIVER_ASSIGNED. |
| Manager intercept end-to-end | TG-06 | Requires admin UI from Phase 4 OR raw psql/curl | (1) During an active chat, `curl -X POST /api/leads/:id/intercept`. (2) Client sends next message — bot does NOT respond automatically. (3) `curl -X POST /api/leads/:id/manager-message {text}` — client receives manager message. (4) `curl -X POST /api/leads/:id/release` — bot resumes. |
| Client status notifications | TG-07 | Same as above — requires real bot + driver accounts | (1) Complete order creation. (2) `curl -X POST /api/orders/:id/transition {type: 'driver_assigned'}` or trigger via /api/leads/:id/match. (3) Client receives Telegram message "Машина назначена! Номер: ..." in their lang. |

---

## Validation Sign-Off

- [ ] All 6 plans have `<automated_check>` blocks for every task
- [ ] Webhook latency assertion <100ms passes 10/10 runs (success criterion #2)
- [ ] Idempotency test: same update_id 10× → exactly 1 messages row, 1 lead row (success criterion #2)
- [ ] All 9 stub todos flipped to passing assertions by end of Phase 3
- [ ] tsc + biome clean across all new files
- [ ] `nyquist_compliant: true` set after planner fills Per-Task table

**Approval:** pending

---

## Notes for Planner

- **MUST produce 1 Wave 0 plan** shipping test infra + 8 integration test scaffolds BEFORE any production code
- **MUST tag every task with `<automated_check>`** referencing commands in this strategy
- **For grammY tests:** Always use MockTelegramBot (no real Telegram API calls in CI). Real bot only in `test:tg` smoke gated by `TELEGRAM_BOT_TOKEN`
- **Webhook latency budget:** 100ms total includes header verification + INSERT + return. Use `performance.now()` in test
- **Wave structure suggestion** (per RESEARCH.md):
  - W0: test infra (1 plan)
  - W1: env config + migration 0003 + Fastify plugin scaffold (1 plan)
  - W2: webhook route (`/webhook/telegram`) + idempotency + auth (1 plan)
  - W3: adapter + inline keyboards + callback handler + outbound abstraction (1 plan)
  - W4: driver confirmation + client notifications + order-fsm hook (1 plan)
  - W5: manager intercept endpoints + final stub-flip + readme update (1 plan)
- **D-20 override:** `trucks.driver_telegram_id` is TEXT (already exists in Phase 1), not BIGINT. Migration 0003 must NOT re-add this column
- **D-19 simplification:** Driver decline → `order→CLOSED + lead→LOST(reason='driver_declined')`. There's no backward FSM transition; document this in CONTEXT/SUMMARY
- **outbound abstraction:** Define `OutboundChannel` interface in `apps/api/src/pipeline/outbound.ts` + add `outbound?: OutboundRegistry` arg to intake. Call `outbound.get('telegram')?.sendQuoteKeyboard(...)` AFTER tx commits (not inside)
