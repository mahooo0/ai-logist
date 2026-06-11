# Phase 6 Phase Summary — Order Lifecycle Automation

**Status:** Pending UAT sign-off (Wave 5 walkthrough)
**Completed:** _____________ (fill in after UAT sign-off)
**Plans:** 06-00, 06-01, 06-02, 06-03, 06-04, 06-05
**Phase boundary:** CREATED → CLOSED fully automated on the happy path; plus decline path, timeout escalation, admin overrides.

---

## Phase Goal Achievement

The context brief defined the following domain happy path. Status after Waves 0–4:

| Step | Domain event | Implementation | Status |
|------|-------------|---------------|--------|
| 1 | Background ticker advances `orders.progress_percent` on fixed cadence | `order-ticker.ts` setInterval; `DEMO_TICKER_ENABLED`, delta, interval configurable | ✓ Plan 06-02 |
| 2 | Ticker at 90% → approach notification to client Telegram | `approach_notified` event + `notifyApproach()` with Pitfall-2 mutual exclusion guard | ✓ Plan 06-02 |
| 3 | Ticker at 100% (leg 1) → status `AT_LOADING`, loading inline keyboard | `transitionOrder(to:'AT_LOADING')` + `notifyLoadingPrompt()` + `loadingKeyboard()` | ✓ Plans 06-01, 06-02 |
| 4 | Client taps Да → status `IN_TRANSIT`, leg 2 ticker starts | `confirm_loading` callback handler → `transitionOrder(to:'IN_TRANSIT')` | ✓ Plan 06-01 |
| 5 | Leg 2 truck geom interpolated along OSRM polyline | `polyline-interpolate.ts` + `trucks.geom` updated per tick | ✓ Plan 06-02 |
| 6 | Leg 2 at 100% → status `DELIVERED_PENDING`, delivery keyboard | `transitionOrder(to:'DELIVERED_PENDING')` + `notifyDeliveryPrompt()` | ✓ Plans 06-01, 06-02 |
| 7 | Client taps Да → `AWAITING_PAYMENT`, Stripe Checkout URL sent via Telegram | `confirm_delivery` callback → `sendPaymentLink()` → `createCheckoutSession()` | ✓ Plans 06-01, 06-03 |
| 8 | Stripe webhook `checkout.session.completed` → `CLOSED` | `POST /webhook/stripe` raw-body + sig verify + `transitionOrder(to:'CLOSED')` | ✓ Plan 06-03 |
| 9 | Decline path: Нет на любом этапе → CANCELED + truck available + manager_active | `handleDecline()` + truck/lead side effects | ✓ Plan 06-01 |
| 10 | Timeout: no reply in 10 min → reminder; 30 min → operator escalation | `evaluateTimeouts()` with ON CONFLICT idempotency | ✓ Plan 06-02 |
| 11 | Admin override via action bar: pause ticker / force status / reset progress | `PATCH /api/orders/:id/status` + `POST /api/orders/:id/ticker` + `OrderActionBar` | ✓ Plan 06-04 |

---

## What Shipped (Wave-by-Wave)

### Plan 06-00 — Test Infrastructure and Migration
- `stripe@22.2.0` exact-pinned in `apps/api/package.json`
- `apps/api/drizzle/0006_order_lifecycle.sql` — hand-written migration (no BEGIN/COMMIT; Pitfall 5)
  - 3 new `order_status` values: `DELIVERED_PENDING`, `AWAITING_PAYMENT`, `CANCELED`
  - 14 new `order_event_type` values: `approach_notified`, `loading_prompted`, `loading_confirmed`, `loading_declined`, `delivery_approach_notified`, `delivery_prompted`, `delivery_confirmed`, `delivery_declined`, `payment_link_sent`, `payment_received`, `reminder_sent`, `operator_escalated`, `admin_override`, `closed`
  - 1 new `webhook_source` value: `stripe`
  - 1 new `orders` column: `auto_progress_paused BOOLEAN NOT NULL DEFAULT false`
- `apps/api/src/persistence/schema/_enums.ts` extended (all 3 enum union types)
- `apps/api/src/persistence/schema/orders.ts` extended (`autoProgressPaused` column)
- `apps/api/src/pipeline/lifecycle/order-fsm.ts` extended: OrderStatus +3, ORDER_TRANSITIONS +8 edges, STATUS_TO_EVENT B5 Path A
- `apps/api/src/config.ts` extended: 7 new env vars (DEMO_TICKER_*, STRIPE_*, ADMIN_API_SECRET)
- `apps/api/tests/unit/phase-6-stubs.test.ts` — 21 `test.skip` markers (D-01..D-22, D-19 excluded)
- 20 test scaffold files created (11 unit + 9 integration + 1 web, all `test.skip` at baseline)
- **Commits:** b506c4c, b08bf82, 9e3e7bd, ad45a43

### Plan 06-01 — Telegram i18n Keyboards Callbacks
- `apps/api/src/lib/i18n.ts` extended: `Phase6Transition` union (7 keys × RU/UA = 14 strings), `renderPhase6Template()`
- `apps/api/src/channels/telegram/keyboards.ts` extended: `loadingKeyboard()`, `deliveryKeyboard()` (2-button InlineKeyboard each)
- `apps/api/src/channels/telegram/notifications.ts` extended: 5 notify* helpers (`notifyApproach`, `notifyLoadingPrompt`, `notifyDeliveryPrompt`, `notifyPaymentLink`, `notifyPaymentReceived`)
- `apps/api/src/channels/telegram/handlers.ts` extended: `handleDecline()` export + Phase 6 `callbackQuery` block (4 actions: confirm_loading, confirm_delivery, decline_loading, decline_delivery)
- Tests flipped: `i18n-phase6` (8), `telegram-keyboards-phase6` (13), `telegram-callbacks` (6), `decline-path` (integration)
- Stub count: 21 → 17 (D-06, D-08, D-09, D-14 flipped)
- **Commits:** 9192c1c, 89539b0, 80c9ca0

### Plan 06-02 — Background Ticker and FSM Edges
- `apps/api/src/lib/polyline-interpolate.ts` — verbatim port of web equirectangular math (`buildSegments`, `interpolateAlongPolyline`, `closestPointOnPolyline`)
- `apps/api/src/pipeline/lifecycle/order-ticker.ts` — `tickerLoop()` + `registerOrderTicker()`:
  - SELECT … FOR UPDATE SKIP LOCKED (DRIVER_ASSIGNED/IN_TRANSIT, auto_progress_paused=false)
  - Pitfall 2: `if newPct>=100 / else-if newPct>=90` mutual exclusion
  - Pitfall 4: per-leg event types (`approach_notified` vs `delivery_approach_notified`)
  - Pitfall 3: only leg 2 (IN_TRANSIT) updates `trucks.geom`
  - Pitfall 8: UPDATE WHERE status IN ('DRIVER_ASSIGNED','IN_TRANSIT') race defense
  - Returns early if `nodeEnv==='test'` or `!DEMO_TICKER_ENABLED`
- `apps/api/src/pipeline/lifecycle/timeout-escalation.ts` — `evaluateTimeouts()`:
  - 10-min reminder: ON CONFLICT DO NOTHING → re-send prompt
  - 30-min escalation: ON CONFLICT DO NOTHING → `leads.manager_active=true`
- `apps/api/src/app.ts` updated: `registerOrderTicker(app)` wired after `registerFollowUpScheduler`
- Tests flipped: polyline-interpolate (8), order-ticker (live), ticker-loop (live), approach-idempotent (live), order-fsm-phase6, order-events-write, timeout-reminder, timeout-escalation
- Stub count: 17 → 8 (D-01..D-05, D-07, D-11, D-12, D-13 flipped)
- **Commits:** b361119, d7a378a, 21e5db4, 6fc0975

### Plan 06-03 — Stripe Checkout and Webhook
- `apps/api/src/channels/stripe/setup.ts` — `requireStripeConfig()` boundary guard (throws with named-field list)
- `apps/api/src/channels/stripe/checkout.ts` — `createCheckoutSession()` with `idempotencyKey=order_${orderId}_v1`
- `apps/api/src/routes/webhooks-stripe.ts` — Fastify plugin with scoped raw-body parser (`removeAllContentTypeParsers` + `addContentTypeParser(parseAs:'buffer')`), `stripe.webhooks.constructEvent`, post-ack via `setImmediate`, `checkout.session.completed` → CLOSED transition, `webhook_updates` idempotency (`ON CONFLICT DO NOTHING`)
- `apps/api/src/channels/telegram/handlers.ts` updated: `confirm_delivery` W7 placeholder replaced with real `sendPaymentLink()` call + D-19 FATAL gate (Telegram fallback + `manager_active=true` when keys missing)
- `apps/api/src/app.ts` updated: `webhooksStripeRoutes` registered before generic webhook plugin
- Tests flipped: stripe-config-guard (3), stripe-checkout-payload (2), stripe-webhook-sig (4+), stripe-completed (integration)
- D-19 resolved: STRIPE_SECRET_KEY supplied by user; STRIPE_WEBHOOK_SECRET set from `stripe listen` output before UAT
- Stub count: 8 → 5 (D-16, D-17, D-18 flipped; D-19 excluded — human-only)
- **Commits:** 5105299, e9e4d0f, 9b60280, c5f6ae0

### Plan 06-04 — Admin Overrides and Action Bar
- `apps/api/src/plugins/admin-auth.ts` — `requireAdmin` Fastify decorator (no-op when ADMIN_API_SECRET unset, guards when set)
- `apps/api/src/routes/orders.ts` extended: `PATCH /api/orders/:id/status` (FSM bypass + `admin_override` audit), `POST /api/orders/:id/ticker` (pause/resume), GET endpoint updated to include `autoProgressPaused`
- `packages/shared-types/src/api/orders.ts` extended: `autoProgressPaused: z.boolean().optional()`
- `apps/web/src/app/(main)/dashboard/orders/[id]/_components/order-action-bar.tsx` — OrderActionBar component (status dropdown, Pause/Resume, Reset Progress; all SWR-revalidating)
- `apps/web/src/app/(main)/dashboard/orders/[id]/_components/order-detail-app.tsx` updated: OrderActionBar mounted
- `apps/web/src/app/payment/success/page.tsx` — public Stripe redirect stub
- `apps/web/src/app/payment/cancel/page.tsx` — public Stripe redirect stub
- Tests flipped: admin-override (integration, B1 auth matrix), ticker-pause (integration), order-action-bar (RTL, 5 tests)
- Stub count: 5 → 1 (D-15, D-20, D-21, D-22 flipped; D-10 pending manual migration)
- **Commits:** 77a3e9c, a26919d, fde0095

### Plan 06-05 — UAT Walkthrough and Phase Close-out
- `HUMAN-UAT-06.md` — 10-step happy path walkthrough + decline path + timeout escalation + admin override
- `06-PHASE-SUMMARY.md` (this file) — full phase aggregation
- D-10 stub: **PENDING** — `psql not found` at execution time; `test.skip` for D-10 remains in `phase-6-stubs.test.ts` until `psql "$DATABASE_URL" -f apps/api/drizzle/0006_order_lifecycle.sql` is run during UAT Step 1, after which `test.skip` becomes `test(` (1 line edit)

---

## Pitfalls Handled

| # | Pitfall | Mitigation | Plan |
|---|---------|-----------|------|
| 1 | Fastify pre-parses JSON globally; Stripe sig verification needs raw bytes | Fastify plugin encapsulation — `removeAllContentTypeParsers` + `addContentTypeParser(parseAs:'buffer')` scoped to `webhooksStripeRoutes` plugin | 06-03 |
| 2 | Same tick: 90% approach AND 100% transition fire independently (double event) | Mutual exclusion `if (newPct>=100) { ... } else if (newPct>=90) { ... }` — never two independent `if` | 06-02 |
| 3 | Leg 1 truck position teleport (no start snapshot column) | Leg 1 animation deferred — only leg 2 (`IN_TRANSIT`) calls `interpolateAlongPolyline` to update `trucks.geom` | 06-02 |
| 4 | `UNIQUE(order_id, type)` in `order_events` blocks having both an approach event per order | Distinct event types: `approach_notified` (leg 1) vs `delivery_approach_notified` (leg 2) | 06-02 |
| 5 | `ALTER TYPE ADD VALUE` cannot run inside a transaction block | Hand-written `0006_order_lifecycle.sql` without `BEGIN/COMMIT`; manual `psql -f` apply; `drizzle-kit migrate` bypassed | 06-00 |
| 6 | No backend authentication on admin endpoints | Optional `X-Admin-Secret` header guard via `requireAdmin` decorator; documented as trusted-network-only for demo | 06-04 |
| 7 | RUB live Stripe account constraints | Test mode only (`sk_test_*`); live mode deferred to v2 | 06-03 |
| 8 | Ticker UPDATE could mutate a CANCELED/CLOSED row between SELECT and UPDATE (race) | UPDATE statement includes `WHERE status IN ('DRIVER_ASSIGNED','IN_TRANSIT')` — stale row becomes safe no-op | 06-02 |

---

## Decision Traceability — D-01 through D-22

All 22 decisions D-01..D-22 implemented (D-19 is human-action only — Stripe keys supplied by user mid-execution).

| Decision | Description | Plan | Status |
|----------|-------------|------|--------|
| D-01 | Single background ticker at boot, DEMO_TICKER_ENABLED=true gate | 06-02 | ✓ |
| D-02 | Status disambiguates leg 1 (DRIVER_ASSIGNED) vs leg 2 (IN_TRANSIT) | 06-02 | ✓ |
| D-03 | Tick rules: increment by delta, fire approach at ≥90%, transition at 100% | 06-02 | ✓ |
| D-04 | Truck geom interpolated via OSRM polyline per tick (leg 2 only) | 06-02 | ✓ |
| D-05 | order_events row written per ticker-driven FSM transition | 06-02 | ✓ |
| D-06 | 6 new RU+UA Telegram templates × 2 langs = 14 strings | 06-01 | ✓ |
| D-07 | Approach notification idempotent (ON CONFLICT DO NOTHING on event type) | 06-02 | ✓ |
| D-08 | Loading + delivery inline keyboards with 2 buttons each | 06-01 | ✓ |
| D-09 | Callback regex extended to match 4 new actions | 06-01 | ✓ |
| D-10 | Migration adds 3 statuses + 14 event types + auto_progress_paused column | 06-00 (authored); 06-05 (DB apply) | ✓ (PENDING UAT Step 1 for test flip) |
| D-11 | 8 new FSM edges in ORDER_TRANSITIONS | 06-00 | ✓ |
| D-12 | 10-min reminder SQL fires once per stuck AT_LOADING/DELIVERED_PENDING | 06-02 | ✓ |
| D-13 | 30-min escalation sets leads.manager_active=true | 06-02 | ✓ |
| D-14 | Decline → CANCELED + truck=available + manager_active=true | 06-01 | ✓ |
| D-15 | PATCH /orders/:id/status bypasses FSM for admin (admin_override event) | 06-04 | ✓ |
| D-16 | Stripe Checkout Session: mode=payment, kopecks→unit, idempotencyKey | 06-03 | ✓ |
| D-17 | Test-mode only; requireStripeConfig() throws at call site if keys missing | 06-03 | ✓ |
| D-18 | POST /webhook/stripe: raw bytes, sig verify, checkout.session.completed → CLOSED | 06-03 | ✓ |
| D-19 | Pause execution before Stripe wiring; user supplies sk_test_* keys | 06-03 human-action | ✓ (keys supplied by user) |
| D-20 | ADMIN_OVERRIDE event written with reason and actor fields | 06-04 | ✓ |
| D-21 | POST /orders/:id/ticker sets auto_progress_paused; ticker filters it out | 06-04 | ✓ |
| D-22 | /dashboard/orders/[id] action bar: status dropdown + pause + reset | 06-04 | ✓ |

---

## Test Inventory (Final State, Wave 4 Complete)

### Unit Tests (apps/api/tests/unit/)
| File | Tests | Wave |
|------|-------|------|
| phase-6-stubs.test.ts | 21 total, **1 skip** (D-10, pending DB) | baseline |
| order-ticker.test.ts | live | W2 |
| ticker-loop.test.ts | 3 live | W2 |
| polyline-interpolate.test.ts | 8 live | W2 |
| i18n-phase6.test.ts | 8 live | W1 |
| telegram-keyboards-phase6.test.ts | 13 live | W1 |
| telegram-callbacks.test.ts | 6 live | W1 |
| stripe-checkout-payload.test.ts | 2 live | W3 |
| stripe-config-guard.test.ts | 3 live | W3 |
| stripe-webhook-sig.test.ts | 4+ live | W3 |
| approach-idempotent.test.ts | live | W2 |

### Integration Tests (apps/api/tests/integration/)
| File | Tests | Wave |
|------|-------|------|
| order-fsm-phase6.test.ts | live (.skipIf no DB) | W2 |
| order-events-write.test.ts | live (.skipIf no DB) | W2 |
| stripe-completed.test.ts | live (testcontainer) | W3 |
| schema-introspect-phase6.test.ts | live (.skipIf no DB) | W5 UAT |
| timeout-reminder.test.ts | live (.skipIf no DB) | W2 |
| timeout-escalation.test.ts | live (.skipIf no DB) | W2 |
| decline-path.test.ts | live (testcontainer, vi.waitFor) | W1 |
| admin-override.test.ts | live (mock Fastify app) | W4 |
| ticker-pause.test.ts | live (mock Fastify app) | W4 |

### Web Tests (apps/web/tests/)
| File | Tests | Wave |
|------|-------|------|
| order-action-bar.test.tsx | 5 RTL live | W4 |

### Stub Marker Progression (monotonic verifier)
| Wave | Plan | test.skip count | Decisions flipped |
|------|------|-----------------|-------------------|
| W0 baseline | 06-00 | 21 | — |
| W1 | 06-01 | 17 | D-06, D-08, D-09, D-14 |
| W2 | 06-02 | 8 | D-01, D-02, D-03, D-04, D-05, D-07, D-11, D-12, D-13 |
| W3 | 06-03 | 5 | D-16, D-17, D-18 |
| W4 | 06-04 | 1 | D-15, D-20, D-21, D-22 |
| W5 (UAT) | 06-05 | **0 (target)** | D-10 (after migration + DB apply) |

---

## Commits

All Phase 6 commits in chronological order:

| Commit | Type | Description |
|--------|------|-------------|
| b506c4c | feat(06-00) | install stripe@22.2.0, migration 0006, extend enums + FSM types + config |
| b08bf82 | test(06-00) | Phase 6 stub-marker (21 markers) + 11 API unit test scaffolds |
| 9e3e7bd | test(06-00) | 9 API integration scaffolds + web action-bar scaffold (all test.skip) |
| ad45a43 | docs(06-00) | complete wave-zero-test-infra-and-migration plan |
| 9192c1c | feat(06-01) | Phase 6 i18n templates + loading/delivery keyboards |
| 89539b0 | feat(06-01) | Phase 6 notification senders, handleDecline, callback regex (D-09, D-14) |
| 80c9ca0 | docs(06-01) | complete telegram-i18n-keyboards-callbacks plan |
| b361119 | feat(06-02) | port polyline-interpolate.ts from web + 8 live unit tests |
| d7a378a | feat(06-02) | implement order-ticker.ts with mutual exclusion + 10 live unit tests |
| 21e5db4 | feat(06-02) | wire registerOrderTicker into app.ts + flip timeout integration tests |
| 6fc0975 | docs(06-02) | complete background-ticker-and-fsm-edges plan |
| 5105299 | feat(06-03) | implement requireStripeConfig + createCheckoutSession (D-16, D-17) |
| e9e4d0f | feat(06-03) | Fastify-scoped raw-body webhook route + sendPaymentLink + W7 wiring (D-18, D-19) |
| 9b60280 | docs(06-03) | complete stripe-checkout-and-webhook plan (D-19 resolved, keys supplied) |
| c5f6ae0 | chore(06-03) | update STATE.md + ROADMAP.md after stripe-checkout-and-webhook plan complete |
| 77a3e9c | feat(06-04) | admin-auth plugin + PATCH /status + POST /ticker endpoints |
| a26919d | feat(06-04) | OrderActionBar component + payment stub pages + W8 schema |
| fde0095 | docs(06-04) | complete admin-overrides-and-action-bar plan |

---

## Known Follow-Ups (Out of Phase)

1. **D-10 stub flip (1 file, 1 line):** After Wave 5 UAT Step 1 applies the migration against a live DB, change `test.skip(` to `test(` on line 59 of `apps/api/tests/unit/phase-6-stubs.test.ts`. Run `pnpm --filter @ai-logist/api test:unit` to confirm green. This is the only remaining `test.skip` in the file.

2. **STRIPE_WEBHOOK_SECRET:** Blank in `apps/api/.env.local` by design. During UAT, run `stripe listen --forward-to localhost:3000/webhook/stripe`, copy the printed `whsec_...`, paste into `.env.local`, restart API.

3. **Real GPS hookup:** `POST /webhook/gps` returns 501 stub. Real Wialon / GPS device integration is v2 scope.

4. **Stripe refunds:** No refund flow implemented. Manual admin action for now; Stripe Refunds API is v2 scope.

5. **Multi-currency:** RUB only for test mode demo. UAH/EUR deferred to post-launch.

6. **Per-order ticker tunables:** Single global `DEMO_TICKER_DELTA_PCT` and `DEMO_TICKER_INTERVAL_SEC`. Per-order speed (long-haul vs city) deferred to v2.

7. **WebSocket `/ws/tracking`:** Tracking page still uses polling. Live push via `@fastify/websocket` deferred to v2.

---

## UAT Live Test Results

*(Append after walkthrough — leave blank until human tester signs off)*

| Step | Outcome | Notes |
|------|---------|-------|
| 1 — Migration applied | PENDING | |
| 2 — Order created via Telegram | PENDING | |
| 3 — Leg 1 ticker + approach notify | PENDING | |
| 4 — Loading keyboard | PENDING | |
| 5 — Confirm loading → IN_TRANSIT | PENDING | |
| 6 — Leg 2 truck animation | PENDING | |
| 7 — Delivery prompt + Stripe link | PENDING | |
| 8 — Test card payment → CLOSED | PENDING | |
| 9 — Decline path | PENDING | |
| 10 — Admin action bar | PENDING | |

**Phase sign-off:** PENDING UAT
