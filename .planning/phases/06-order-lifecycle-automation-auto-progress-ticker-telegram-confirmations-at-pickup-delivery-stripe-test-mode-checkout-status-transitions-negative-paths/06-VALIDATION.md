---
phase: 6
slug: order-lifecycle-automation-auto-progress-ticker-telegram-confirmations-at-pickup-delivery-stripe-test-mode-checkout-status-transitions-negative-paths
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-11
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `06-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 (workspace projects: `unit`, `integration`, `smoke`) |
| **Config file** | `apps/api/vitest.config.ts` (existing) · `apps/web/vitest.config.ts` (existing) |
| **Quick run command** | `pnpm --filter @ai-logist/api test:unit` |
| **Full suite command** | `pnpm --filter @ai-logist/api test && pnpm --filter @ai-logist/web test` |
| **Estimated runtime** | ~3s unit (api) · ~30–60s full suite (with integration if Docker up) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @ai-logist/api test:unit`
- **After every plan wave:** Run `pnpm --filter @ai-logist/api test` (unit + integration when Docker up)
- **Before `/gsd:verify-work`:** Full suite green · `pnpm typecheck` clean · `pnpm biome check` clean · `phase-6-stubs` marker count = 0
- **Max feedback latency:** 5s for unit, 60s for integration

---

## Per-Task Verification Map

> Plan-IDs (`06-XX-*`) are placeholders the planner will fill. Decisions D-01..D-22 are the requirement set (no REQ-IDs in REQUIREMENTS.md for Phase 6).

| Decision | Plan | Wave | Behavior | Test Type | Automated Command | File Exists | Status |
|----------|------|------|----------|-----------|-------------------|-------------|--------|
| D-01 | 06-02 ticker | 2 | Ticker registers + skips in `NODE_ENV=test` | unit | `pnpm -F @ai-logist/api test:unit -t order-ticker` | ❌ W0 | ⬜ pending |
| D-02 | 06-02 ticker | 2 | Status disambiguates which leg | unit (FSM) | `pnpm -F @ai-logist/api test:unit -t order-fsm` | ✅ extend | ⬜ pending |
| D-03 | 06-02 ticker | 2 | Tick rules: increment, fire 90%, transition 100% | unit | `pnpm -F @ai-logist/api test:unit -t ticker-loop` | ❌ W0 | ⬜ pending |
| D-03 (edge) | 06-02 ticker | 2 | Same tick crossing 90 & 100 → only transition fires | unit | `pnpm -F @ai-logist/api test:unit -t ticker-boundary` | ❌ W0 | ⬜ pending |
| D-04 | 06-02 ticker | 2 | Polyline interpolation matches web's math | unit (snapshot) | `pnpm -F @ai-logist/api test:unit -t polyline-interpolate` | ❌ W0 | ⬜ pending |
| D-05 | 06-02 ticker | 2 | `order_events` row written per ticker transition | integration | `pnpm -F @ai-logist/api test:integration -t order-events-write` | ❌ W0 | ⬜ pending |
| D-06 | 06-01 i18n | 1 | All 12 templates exist (6 keys × RU/UA) | unit | `pnpm -F @ai-logist/api test:unit -t i18n-phase6` | ❌ W0 | ⬜ pending |
| D-07 | 06-02 ticker | 2 | Approach idempotent — second tick at 90% no-op | unit (mocked DB) | `pnpm -F @ai-logist/api test:unit -t approach-idempotent` | ❌ W0 | ⬜ pending |
| D-08 | 06-01 i18n | 1 | Loading & delivery inline keyboards built | unit | `pnpm -F @ai-logist/api test:unit -t telegram-keyboards-phase6` | ❌ W0 | ⬜ pending |
| D-09 | 06-01 i18n | 1 | Callback regex matches 4 new actions | unit | `pnpm -F @ai-logist/api test:unit -t telegram-callbacks` | ❌ W0 | ⬜ pending |
| D-10 | 06-00 schema | 0 | Migration adds 3 statuses + N new event types + auto_progress_paused | integration (introspection) | `pnpm -F @ai-logist/api test:integration -t schema-introspect-phase6` | ❌ W0 | ⬜ pending |
| D-11 | 06-02 ticker | 2 | All 8 new edges allowed in `ORDER_TRANSITIONS` | unit | `pnpm -F @ai-logist/api test:unit -t order-fsm` (extend) | ✅ extend | ⬜ pending |
| D-12 | 06-02 ticker | 2 | 10-min reminder SQL fires once | integration (fake clock) | `pnpm -F @ai-logist/api test:integration -t timeout-reminder` | ❌ W0 | ⬜ pending |
| D-13 | 06-02 ticker | 2 | 30-min escalation sets manager_active=true | integration (fake clock) | `pnpm -F @ai-logist/api test:integration -t timeout-escalation` | ❌ W0 | ⬜ pending |
| D-14 | 06-01 i18n | 1 | Decline → CANCELED + truck=available + manager_active=true | integration | `pnpm -F @ai-logist/api test:integration -t decline-path` | ❌ W0 | ⬜ pending |
| D-15 | 06-04 admin | 4 | PATCH /orders/:id/status bypasses FSM | integration (app.inject) | `pnpm -F @ai-logist/api test:integration -t admin-override` | ❌ W0 | ⬜ pending |
| D-16 | 06-03 stripe | 3 | Checkout Session payload shape correct | unit (mocked Stripe) | `pnpm -F @ai-logist/api test:unit -t stripe-checkout-payload` | ❌ W0 | ⬜ pending |
| D-17 | 06-03 stripe | 3 | `requireStripeConfig()` throws when missing | unit | `pnpm -F @ai-logist/api test:unit -t stripe-config-guard` | ❌ W0 | ⬜ pending |
| D-18 | 06-03 stripe | 3 | Webhook signature verification (positive + negative) | unit (mocked Stripe.webhooks) | `pnpm -F @ai-logist/api test:unit -t stripe-webhook-sig` | ❌ W0 | ⬜ pending |
| D-18 | 06-03 stripe | 3 | `checkout.session.completed` → CLOSED + PAYMENT_RECEIVED event | integration | `pnpm -F @ai-logist/api test:integration -t stripe-completed` | ❌ W0 | ⬜ pending |
| D-19 | 06-03 stripe | 3 | (Manual — keys provided mid-execution by user) | manual | N/A | manual | ⬜ pending |
| D-20 | 06-04 admin | 4 | ADMIN_OVERRIDE event written with reason | integration | `pnpm -F @ai-logist/api test:integration -t admin-override` | ❌ W0 | ⬜ pending |
| D-21 | 06-04 admin | 4 | POST /orders/:id/ticker pauses (auto_progress_paused=true) | integration | `pnpm -F @ai-logist/api test:integration -t ticker-pause` | ❌ W0 | ⬜ pending |
| D-22 | 06-04 admin | 4 | Admin action bar renders + calls API | unit (apps/web RTL) | `pnpm -F @ai-logist/web test -t order-action-bar` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/tests/unit/order-ticker.test.ts` — registers + skips in test env (D-01)
- [ ] `apps/api/tests/unit/ticker-loop.test.ts` — pure tick logic with mocked DB (D-03)
- [ ] `apps/api/tests/unit/polyline-interpolate.test.ts` — port web tests; snapshot equivalence (D-04)
- [ ] `apps/api/tests/unit/i18n-phase6.test.ts` — covers D-06 (12 template assertions)
- [ ] `apps/api/tests/unit/telegram-keyboards-phase6.test.ts` — covers D-08
- [ ] `apps/api/tests/unit/telegram-callbacks.test.ts` — covers D-09
- [ ] `apps/api/tests/unit/stripe-checkout-payload.test.ts` — covers D-16
- [ ] `apps/api/tests/unit/stripe-config-guard.test.ts` — covers D-17
- [ ] `apps/api/tests/unit/stripe-webhook-sig.test.ts` — covers D-18
- [ ] `apps/api/tests/unit/approach-idempotent.test.ts` — covers D-07
- [ ] `apps/api/tests/integration/order-fsm-phase6.test.ts` — covers D-11
- [ ] `apps/api/tests/integration/order-events-write.test.ts` — covers D-05
- [ ] `apps/api/tests/integration/stripe-completed.test.ts` — covers D-18 end-to-end
- [ ] `apps/api/tests/integration/schema-introspect-phase6.test.ts` — covers D-10
- [ ] `apps/api/tests/integration/timeout-reminder.test.ts` — covers D-12
- [ ] `apps/api/tests/integration/timeout-escalation.test.ts` — covers D-13
- [ ] `apps/api/tests/integration/decline-path.test.ts` — covers D-14
- [ ] `apps/api/tests/integration/admin-override.test.ts` — covers D-15, D-20, D-21
- [ ] `apps/api/tests/integration/ticker-pause.test.ts` — covers D-21
- [ ] `apps/web/tests/order-action-bar.test.tsx` — covers D-22
- [ ] `apps/api/tests/unit/phase-6-stubs.test.ts` — marker test, asserts no `phase-6-stub` strings remain

Framework already installed; only new install is `stripe@22.2.0` (apps/api). No top-level test-runner changes needed.

---

## Manual-Only Verifications

| Behavior | Decision | Why Manual | Test Instructions |
|----------|----------|------------|-------------------|
| Real Stripe sandbox keys wired and live `checkout.session.completed` event received | D-19 | Demo pauses for user-provided keys; we cannot ship live keys in fixtures. | 1) User supplies `STRIPE_SECRET_KEY=sk_test_...` + `STRIPE_WEBHOOK_SECRET=whsec_...`. 2) Start API. 3) `stripe listen --forward-to localhost:3000/webhook/stripe`. 4) Trigger order to `AWAITING_PAYMENT`. 5) Pay with `4242 4242 4242 4242`. 6) Verify order moves to `CLOSED` and Telegram client receives "payment received" message. |
| Telegram end-to-end happy path (live bot) | All B-section | Requires real `@TelegramBot` and a human typing on a phone. | Run `/gsd:verify-work` UAT-style walkthrough from order creation to CLOSED with a real Telegram session. |
| Dashboard action bar UX (pause/resume/reset/status override) | D-22 | Visual interaction; RTL covers wiring, not perceived UX. | Open `/dashboard/orders/[id]` for an in-flight order. Pause → progress halts on next tick. Resume → progress resumes. Reset → progress_percent returns to 0. Status override dropdown writes `ADMIN_OVERRIDE` event with reason. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s (full suite)
- [ ] `nyquist_compliant: true` set in frontmatter once Wave 0 scaffolding lands

**Approval:** pending
