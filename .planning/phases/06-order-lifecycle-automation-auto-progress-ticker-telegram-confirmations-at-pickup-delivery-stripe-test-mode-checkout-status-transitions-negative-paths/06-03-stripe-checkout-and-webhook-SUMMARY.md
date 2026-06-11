---
phase: 06-order-lifecycle-automation-auto-progress-ticker-telegram-confirmations-at-pickup-delivery-stripe-test-mode-checkout-status-transitions-negative-paths
plan: 03
subsystem: payments
tags: [stripe, checkout, webhook, fastify, raw-body, idempotency, telegram, fsm]

# Dependency graph
requires:
  - phase: 06-00-wave-zero-test-infra-and-migration
    provides: DB schema with AWAITING_PAYMENT/CLOSED statuses + webhook_updates table + Stripe SDK installed
  - phase: 06-01-telegram-i18n-keyboards-callbacks
    provides: notifyPaymentLink, notifyPaymentReceived, confirm_delivery callback, payment_unavailable i18n template
  - phase: 06-02-background-ticker-and-fsm-edges
    provides: transitionOrder with AWAITING_PAYMENT→CLOSED edge, order-fsm.ts

provides:
  - requireStripeConfig() — config boundary guard; throws with all missing field names
  - createCheckoutSession() — Stripe Checkout Session creator using orders.price kopecks as source of truth
  - POST /webhook/stripe — Fastify plugin with scoped raw-body parser, signature verification, idempotent processing
  - sendPaymentLink() — confirm_delivery → Checkout Session → Telegram link; D-19 FATAL gate on missing keys
  - confirm_delivery callback fully wired (W7 placeholder removed)

affects:
  - 06-04-admin-overrides-and-action-bar (AWAITING_PAYMENT status now reachable via full flow)
  - 06-05-uat-and-phase-summary (Wave 5 UAT requires STRIPE_WEBHOOK_SECRET from stripe listen)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fastify plugin encapsulation for scoped content-type parsers: removeAllContentTypeParsers + addContentTypeParser({parseAs:'buffer'}) inside plugin scope keeps raw bytes for Stripe sig verification without affecting other routes"
    - "Config boundary guard pattern (requireStripeConfig mirrors requireVoiceConfig): optional env vars in config.ts, throw-on-missing at call site with full missing-field list"
    - "Stripe idempotency via idempotencyKey=order_${orderId}_v1 on checkout.sessions.create — retries return the same session, no duplicate charges"
    - "Webhook idempotency via webhook_updates UNIQUE(source, external_id) INSERT ON CONFLICT DO NOTHING — replay-safe across restarts"
    - "Post-ack async processing via setImmediate so reply(200) is in flight before DB/FSM work — Stripe retries past 5s timeout"
    - "D-19 gate: app.log.fatal + payment_unavailable Telegram fallback + manager_active=true when requireStripeConfig throws — no silent swallow"

key-files:
  created:
    - apps/api/src/channels/stripe/setup.ts
    - apps/api/src/channels/stripe/checkout.ts
    - apps/api/src/routes/webhooks-stripe.ts
    - apps/api/tests/unit/stripe-config-guard.test.ts
    - apps/api/tests/unit/stripe-checkout-payload.test.ts
    - apps/api/tests/unit/stripe-webhook-sig.test.ts
    - apps/api/tests/integration/stripe-completed.test.ts
  modified:
    - apps/api/src/channels/telegram/handlers.ts
    - apps/api/src/app.ts
    - apps/api/tests/unit/phase-6-stubs.test.ts
    - apps/api/.env.example

key-decisions:
  - "D-16: createCheckoutSession reads orders.price (bigint kopecks) directly from DB — LLM never touches payment amount. Core invariant: deterministic code owns money decisions."
  - "D-17: requireStripeConfig() throws with named-field error string, mirrors requireVoiceConfig pattern established in Phase 3.1."
  - "D-18: Fastify plugin scope used for raw-body parser (Pitfall 1) — stripe.webhooks.constructEvent requires literal request bytes, not JSON-parsed object."
  - "D-19 resolved: STRIPE_SECRET_KEY=sk_test_... supplied by user via gsd:execute-phase chain; STRIPE_WEBHOOK_SECRET intentionally blank — fill from 'stripe listen' output during Wave 5 UAT."
  - "Webhook processing is post-ack via setImmediate — 200 reply sent before any DB writes, prevents Stripe retry storms."
  - "Stub markers D-16, D-17, D-18 flipped from test.skip to live test() in phase-6-stubs.test.ts (count: 8 → 5)."

patterns-established:
  - "Stripe raw-body pattern: register routes/webhooks-stripe.ts as a Fastify plugin before generic webhooksRoutes; the plugin calls removeAllContentTypeParsers + addContentTypeParser parseAs:buffer inside its own scope."
  - "Stripe mock pattern for unit tests: vi.mock('stripe', () => ({ default: vi.fn().mockImplementation(() => ({...})) })) — keeps unit tests fully offline."
  - "D-19 gate pattern: requireStripeConfig in try/catch → log.fatal + Telegram fallback + manager_active=true on catch; no proceeding to createCheckoutSession without valid keys."

requirements-completed: []

# Metrics
duration: 20min
completed: 2026-06-11
---

# Phase 6 Plan 03: Stripe Checkout and Webhook Summary

**Fastify-scoped raw-body webhook route + Stripe Checkout Session creator wired to confirm_delivery, closing the payment loop from AWAITING_PAYMENT to CLOSED with Telegram notification**

## Performance

- **Duration:** ~20 min (Tasks 1+2 autonomous; Task 3 human-action gate resolved by user supplying Stripe TEST keys)
- **Started:** 2026-06-11T18:36:49Z
- **Completed:** 2026-06-11T18:53:00Z (D-19 gate resolution)
- **Tasks:** 3/3
- **Files modified:** 10

## Accomplishments

- `requireStripeConfig()` guards Stripe entry point with named-field error message; mirrors `requireVoiceConfig()` pattern
- `createCheckoutSession()` builds Stripe Checkout Session from `orders.price` kopecks — LLM is never in the payment-amount path
- `POST /webhook/stripe` receives `checkout.session.completed`, verifies signature against raw bytes (Pitfall 1 mitigation), idempotently transitions order to CLOSED, sends Telegram `payment_received` notification
- `sendPaymentLink()` wired into `confirm_delivery` callback; D-19 gate emits `app.log.fatal` + `payment_unavailable` Telegram fallback + `manager_active=true` when keys missing (B2 compliance)
- `STRIPE_SECRET_KEY=sk_test_...` loaded into `apps/api/.env.local` (gitignored); D-19 gate fully resolved
- Stub markers D-16, D-17, D-18 flipped: `test.skip` count 8 → 5 in phase-6-stubs.test.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: requireStripeConfig + createCheckoutSession (D-16, D-17)** - `5105299` (feat)
2. **Task 2: webhooks-stripe.ts + sendPaymentLink + W7 wiring (D-18, D-19)** - `e9e4d0f` (feat)
3. **Task 3: D-19 gate resolution + SUMMARY + .env.example docs** - (this commit)

## Files Created/Modified

- `apps/api/src/channels/stripe/setup.ts` — `requireStripeConfig()` + `StripeConfig` interface + D-19 comment note
- `apps/api/src/channels/stripe/checkout.ts` — `createCheckoutSession()` with `idempotencyKey=order_${orderId}_v1`
- `apps/api/src/routes/webhooks-stripe.ts` — FastifyPluginAsync, scoped raw-body parser, `constructEvent`, `setImmediate` post-ack, `checkout.session.completed` → CLOSED transition
- `apps/api/src/channels/telegram/handlers.ts` — `sendPaymentLink()` export (D-19 FATAL gate + B2 fail-safe); `confirm_delivery` onSuccess replaced W7 placeholder stub with real `await sendPaymentLink({orderId, app, bot})`
- `apps/api/src/app.ts` — `webhooksStripeRoutes` imported and registered before generic webhook plugin
- `apps/api/tests/unit/stripe-config-guard.test.ts` — 3 live tests: happy path + missing secret key + all missing fields
- `apps/api/tests/unit/stripe-checkout-payload.test.ts` — 2 live tests: full params shape + null url throws
- `apps/api/tests/unit/stripe-webhook-sig.test.ts` — 4+ live tests: bad sig 400, valid sig → transition, non-checkout event ignored, missing header 400, scoped parser present
- `apps/api/tests/integration/stripe-completed.test.ts` — live testcontainer: insert AWAITING_PAYMENT order → POST signed event → assert CLOSED + payment_received + replay idempotency
- `apps/api/tests/unit/phase-6-stubs.test.ts` — D-16/D-17/D-18 flipped from test.skip to live test(); D-19 excluded (human-action only, documented in file header)
- `apps/api/.env.example` — added STRIPE_* documentation entries (no values)

## Decisions Made

- **D-19 resolved:** User supplied `STRIPE_SECRET_KEY=sk_test_51RUW1w4...` via `/gsd:plan-phase → /gsd:execute-phase 6` chain. Key written into `apps/api/.env.local` (gitignored). `STRIPE_WEBHOOK_SECRET` left intentionally blank — instructions in `.env.local` say to run `stripe listen --forward-to localhost:3000/webhook/stripe` and paste the printed `whsec_...`. This follows the plan spec exactly.
- **Pitfall 1 mitigation chosen:** Fastify plugin encapsulation (`removeAllContentTypeParsers` + `addContentTypeParser('application/json', {parseAs:'buffer'})` inside `webhooksStripeRoutes` plugin scope). No other routes affected.
- **Post-ack pattern:** `setImmediate` defers FSM transitions after `reply.code(200).send({received:true})` — Stripe's 5-second timeout is never a concern.
- **Idempotency key format:** `order_${orderId}_v1` suffix allows future re-issuance (v2, v3) if business rules change without conflicting with existing sessions.

## Deviations from Plan

None — plan executed exactly as written. D-19 is a planned human-action checkpoint, not a deviation. `STRIPE_WEBHOOK_SECRET` blank in `.env.local` is the documented expected state before Wave 5 UAT.

### D-19 Gate Resolution Detail

- **Gate:** `autonomous: false` triggered human-action checkpoint after Task 2
- **Resolution:** User provided `STRIPE_SECRET_KEY=sk_test_51RUW1w4eqHsSlV8L...` (test mode, demo only)
- **STRIPE_WEBHOOK_SECRET:** Blank by design — Wave 5 UAT instructions in `.env.local` explain exactly how to fill it via `stripe listen`
- **Gate status:** Fully resolved; no further pauses needed in Phase 6 for Stripe config

### B2 Mitigation (No Silent Swallow)

`sendPaymentLink` in `handlers.ts` guards `requireStripeConfig()` with:
1. `app.log.fatal({ err, orderId, gate: 'D-19' }, 'phase6: D-19 GATE — stripe_keys_missing...')` — executor-visible signal
2. Sends `payment_unavailable` i18n template via Telegram (Plan 06-01 fallback path)
3. Sets `leads.manager_active = true` so the dispatcher picks up the order manually
4. Returns without calling `createCheckoutSession` or any FSM transition

### W7 Mitigation (Placeholder Removed)

`grep "awaiting Stripe Plan 06-03" apps/api/src/channels/telegram/handlers.ts` returns 0 — the Plan 06-01 `log.info` placeholder is replaced by the real `await sendPaymentLink({orderId, app, bot})` call.

## Issues Encountered

None — all tests built on mocked Stripe SDK ran offline; no live Stripe calls were needed for Tasks 1+2.

## User Setup Required

**Wave 5 UAT requires one additional step.** Before the live payment walkthrough:

1. Start the webhook forwarder in a terminal:
   ```
   stripe listen --forward-to localhost:3000/webhook/stripe
   ```
2. Copy the printed `whsec_...` into `apps/api/.env.local` under `STRIPE_WEBHOOK_SECRET=`
3. Restart the API: `pnpm --filter @ai-logist/api dev`

Then proceed with the Wave 5 walkthrough: trigger `confirm_delivery` → pay with test card `4242 4242 4242 4242` → verify order → CLOSED in psql and Telegram `✅ Оплата получена`.

## Known Stubs

None — all stubs flipped for Wave 3 (D-16, D-17, D-18). Remaining `test.skip` stubs in `phase-6-stubs.test.ts` belong to Wave 4 (D-15, D-20, D-21, D-22) and Wave 5 (D-10), which are scheduled for Plans 06-04 and 06-05.

## Next Phase Readiness

- **Plan 06-04 (admin overrides + action bar):** Ready. AWAITING_PAYMENT status is now reachable end-to-end, and the FSM has the CLOSED edge. Admin override (PATCH /orders/:id/status bypass) can be built independently.
- **Plan 06-05 (UAT + phase summary):** Ready pending `stripe listen` step above. All automation is in place; Wave 5 is purely manual walkthrough + verification.

---
*Phase: 06-order-lifecycle-automation*
*Completed: 2026-06-11*
