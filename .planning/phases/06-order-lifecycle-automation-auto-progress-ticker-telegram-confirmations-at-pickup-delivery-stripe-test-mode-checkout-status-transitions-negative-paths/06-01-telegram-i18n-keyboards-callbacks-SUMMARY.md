---
phase: 6
plan: 1
subsystem: api+telegram
tags: [telegram, i18n, keyboards, callbacks, fsm, decline-path]
dependency_graph:
  requires:
    - apps/api/src/lib/i18n.ts (renderBotReply, BotReplyKey — Phase 5)
    - apps/api/src/channels/telegram/keyboards.ts (quoteKeyboard, driverKeyboard — Phase 3)
    - apps/api/src/channels/telegram/notifications.ts (notifyDriver, notifyClient — Phase 3)
    - apps/api/src/channels/telegram/handlers.ts (registerTelegramHandlers — Phase 3)
    - apps/api/src/pipeline/lifecycle/order-fsm.ts (transitionOrder, AT_LOADING→CANCELED edge — Plan 06-00)
    - apps/api/tests/unit/phase-6-stubs.test.ts (21 markers baseline — Plan 06-00)
  provides:
    - apps/api/src/lib/i18n.ts (renderPhase6Template + Phase6Transition type)
    - apps/api/src/channels/telegram/keyboards.ts (loadingKeyboard + deliveryKeyboard)
    - apps/api/src/channels/telegram/notifications.ts (5 notify* helpers)
    - apps/api/src/channels/telegram/handlers.ts (handleDecline export + Phase 6 callbackQuery block)
    - apps/api/tests/unit/i18n-phase6.test.ts (live, 8 tests)
    - apps/api/tests/unit/telegram-keyboards-phase6.test.ts (live, 13 tests)
    - apps/api/tests/unit/telegram-callbacks.test.ts (live, 6 tests)
    - apps/api/tests/integration/decline-path.test.ts (live, vi.waitFor pattern)
  affects:
    - Plan 06-02: Wave 2 ticker can call notifyApproach/notifyLoadingPrompt/notifyDeliveryPrompt directly
    - Plan 06-03: Wave 3 Stripe handler calls notifyPaymentLink/notifyPaymentReceived directly
    - apps/api/tests/unit/phase-6-stubs.test.ts stub count drops 21→17
tech_stack:
  added: []
  patterns:
    - Phase6Transition type + renderPhase6Template() — same defensive posture as renderNotificationTemplate (LLM never produces these strings)
    - grammY InlineKeyboard with 2 rows per keyboard builder (D-08)
    - handleDecline onSuccess hook — post-commit fire-and-forget (RESEARCH Pitfall #3)
    - Explicit audit row insert for CANCELED terminal status (STATUS_TO_EVENT.CANCELED = null)
    - vi.waitFor polls for post-commit side effects in integration test (B3 race-fix)
key_files:
  created: []
  modified:
    - apps/api/src/lib/i18n.ts
    - apps/api/src/channels/telegram/keyboards.ts
    - apps/api/src/channels/telegram/notifications.ts
    - apps/api/src/channels/telegram/handlers.ts
    - apps/api/tests/unit/i18n-phase6.test.ts
    - apps/api/tests/unit/telegram-keyboards-phase6.test.ts
    - apps/api/tests/unit/telegram-callbacks.test.ts
    - apps/api/tests/integration/decline-path.test.ts
    - apps/api/tests/unit/phase-6-stubs.test.ts
decisions:
  - "W7 placeholder: confirm_delivery branch logs 'phase6: delivery confirmed, awaiting Stripe Plan 06-03 wiring' — Plan 06-03 replaces with notifyPaymentLink"
  - "handleDecline inserts loading_declined/delivery_declined explicitly (STATUS_TO_EVENT.CANCELED=null means transitionOrder writes no audit row)"
  - "Truck + lead side effects in a db.transaction inside onSuccess post-commit hook — atomic but decoupled from FSM transaction"
  - "Integration test uses testcontainers Postgres via startPostgisContainer helper (same pattern as bourse-fallback.test.ts)"
metrics:
  duration: "7m 16s"
  completed_date: "2026-06-11"
  tasks: 2
  files: 9
---

# Phase 6 Plan 1: Telegram i18n Keyboards Callbacks Summary

**One-liner:** Wave 1 adds 14 Phase 6 RU/UA Telegram templates, loadingKeyboard/deliveryKeyboard InlineKeyboard builders, 5 notify* sender helpers, Phase 6 callback regex with confirm/decline branches, and handleDecline with post-commit truck+lead+event side effects.

## What Was Built

### Task 1: i18n.ts extension + keyboard builders (TDD)

**`apps/api/src/lib/i18n.ts` extended:**
- `Phase6Transition` union type: 7 keys (`truck_approaching_pickup`, `confirm_loading`, `truck_approaching_delivery`, `confirm_delivery`, `payment_link`, `payment_received`, `payment_unavailable`)
- `Phase6Row` interface with `number`, `plate_number`, `from_city`, `to_city`, `payment_url` fields
- `renderPhase6Template(transition, row, lang)` — 14 strings total (7 × RU + UA). `payment_url: null | undefined` renders em-dash placeholder. `payment_unavailable` is the B2 D-19 fail-safe fallback.

**`apps/api/src/channels/telegram/keyboards.ts` extended:**
- `loadingKeyboard(orderId, lang)` — 2-row InlineKeyboard: `confirm_loading:<orderId>` / `decline_loading:<orderId>`
- `deliveryKeyboard(orderId, lang)` — 2-row InlineKeyboard: `confirm_delivery:<orderId>` / `decline_delivery:<orderId>`
- RU labels: `✅ Да, подтверждаю` / `⚠️ Нет, есть проблема` (loading); `✅ Да, получил` / `⚠️ Нет, есть проблема` (delivery)
- UA labels: `✅ Так, підтверджую` / `⚠️ Ні, є проблема` (loading); `✅ Так, отримав` / `⚠️ Ні, є проблема` (delivery)

**Tests flipped:** `i18n-phase6.test.ts` (8 tests) + `telegram-keyboards-phase6.test.ts` (13 tests) — all green.

### Task 2: notifications.ts senders + handlers.ts callback/decline (TDD)

**`apps/api/src/channels/telegram/notifications.ts` extended with 5 new exports:**

| Helper | Template | Keyboard | Notes |
|--------|----------|----------|-------|
| `notifyApproach` | `truck_approaching_pickup` / `truck_approaching_delivery` | none | leg param selects template |
| `notifyLoadingPrompt` | `confirm_loading` | `loadingKeyboard` | no event insert (transitionOrder handles) |
| `notifyDeliveryPrompt` | `confirm_delivery` | `deliveryKeyboard` | no event insert (transitionOrder handles) |
| `notifyPaymentLink` | `payment_link` | none | passes `paymentUrl` as `payment_url` |
| `notifyPaymentReceived` | `payment_received` | none | called by Wave 3 Stripe webhook |

All 5 use `sendPhase6()` internal helper — single JOIN for `order.number + client.telegram_id + client.lang`, render template, send. Errors logged + swallowed (fire-and-forget per Pitfall #3).

**`apps/api/src/channels/telegram/handlers.ts` extended:**

`handleDecline(args: HandleDeclineArgs)` — exported function (callable from callbacks + Plan 06-02 timeout escalation):
1. `transitionOrder(db, { orderId, to: 'CANCELED', actor: 'system', onSuccess })` — STATUS_TO_EVENT.CANCELED=null means no audit row from transitionOrder
2. Inside `onSuccess` (post-commit, fire-and-forget):
   - `db.transaction` atomically: UPDATE trucks `status='available'` WHERE `status='busy'`; UPDATE leads `manager_active=true`
   - INSERT `loading_declined` or `delivery_declined` into `order_events` (ON CONFLICT DO NOTHING)
   - Best-effort bot.api.sendMessage: RU "Хорошо, передаю коллеге…" / UA "Гаразд, передаю колезі…"

Phase 6 `callbackQuery` block registered AFTER Phase 3 regexes (not replacing them):
- `confirm_loading` → `transitionOrder(to: 'IN_TRANSIT')` + `loading_confirmed` event + `progress_percent=0` reset
- `confirm_delivery` → `transitionOrder(to: 'AWAITING_PAYMENT')` + `delivery_confirmed` event + W7 placeholder log
- `decline_loading` / `decline_delivery` → `handleDecline()`

**Tests flipped:**
- `telegram-callbacks.test.ts` (6 tests) — regex matching + handlers.ts source content assertions
- `decline-path.test.ts` (integration, testcontainers) — vi.waitFor polls for B3 race-fix
- `phase-6-stubs.test.ts` — D-06, D-08, D-09, D-14 flipped from `test.skip` to `test()`

## Deviations from Plan

None — plan executed exactly as written. All template strings match the verbatim text from RESEARCH §Example 6. The `payment_unavailable` fail-safe key was added as 7th key (plan said "7 new Phase6Transition types" but noted 12/14 strings, clarified to 7 keys × 2 langs = 14).

## Wave 2 + Wave 3 Handoff

Wave 2 ticker (Plan 06-02) can call the following directly without re-implementing:
- `notifyApproach({ orderId, leg: 'DRIVER_ASSIGNED', db, bot, log })` — fires at 90% progress on leg 1
- `notifyLoadingPrompt({ orderId, db, bot, log })` — fires when ticker transitions AT_LOADING
- `notifyApproach({ orderId, leg: 'IN_TRANSIT', db, bot, log })` — fires at 90% progress on leg 2
- `notifyDeliveryPrompt({ orderId, db, bot, log })` — fires when ticker transitions DELIVERED_PENDING

Wave 3 Stripe handler (Plan 06-03) can call:
- `notifyPaymentLink({ orderId, paymentUrl, db, bot, log })` — after Stripe Checkout Session created
- `notifyPaymentReceived({ orderId, db, bot, log })` — after `checkout.session.completed` webhook

## Known Stubs

- `confirm_delivery` branch in handlers.ts logs `'phase6: delivery confirmed, awaiting Stripe Plan 06-03 wiring'` instead of calling `notifyPaymentLink`. This is an intentional W7 placeholder — Plan 06-03 will replace the log line with actual Stripe invocation.

## Self-Check: PASSED
