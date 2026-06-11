# Phase 6 Human UAT — Order Lifecycle Automation End-to-End

**Tester:** _____________
**Date:** _____________
**Environment:** _____________ (localhost / ngrok / VPS)

## Prerequisites

- [ ] `psql "$DATABASE_URL" -f apps/api/drizzle/0006_order_lifecycle.sql` ran without error.
- [ ] `pnpm --filter @ai-logist/api test:integration -t "schema-introspect-phase6"` exits 0 (confirms migration landed and all 3 statuses + auto_progress_paused column exist).
- [ ] `apps/api/.env.local` has `STRIPE_SECRET_KEY=sk_test_...`, `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL`.
- [ ] `apps/api/.env.local` has `DEMO_TICKER_ENABLED=true`, `DEMO_TICKER_INTERVAL_SEC=5`, `DEMO_TICKER_DELTA_PCT=25` (speeds up demo to ~4 ticks reaching 100%).
- [ ] API running: `pnpm --filter @ai-logist/api dev` — confirm "registerOrderTicker: registered" in logs at boot.
- [ ] Web running: `pnpm --filter @ai-logist/web dev` — http://localhost:3001 loads.
- [ ] `stripe listen --forward-to localhost:3000/webhook/stripe` running in a second terminal. Copy the printed `whsec_...` value.
- [ ] Paste `STRIPE_WEBHOOK_SECRET=whsec_...` (from step above) into `apps/api/.env.local` and restart the API: `pnpm --filter @ai-logist/api dev`.

---

## Happy Path — Steps 1–10

### 1. Apply migration and verify enum values
```bash
psql "$DATABASE_URL" -f apps/api/drizzle/0006_order_lifecycle.sql
psql "$DATABASE_URL" -c "SELECT enumlabel FROM pg_enum WHERE enumtypid='order_status'::regtype ORDER BY enumsortorder;"
```
**Expected:** Output includes `DELIVERED_PENDING`, `AWAITING_PAYMENT`, `CANCELED` alongside the original statuses.
Also verify column:
```bash
psql "$DATABASE_URL" -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='orders' AND column_name='auto_progress_paused';"
```
**Expected:** Row returned for `auto_progress_paused` (boolean).

Result: ⬜ PASS / ⬜ FAIL — note: ______________________

---

### 2. Create order via Telegram and observe assignment
Start a conversation with the Telegram bot. Place a route order (e.g. Киев → Львів, 18 тонн, тент). Confirm the quoted price when the bot presents it.

In admin web at http://localhost:3001/dashboard/orders/kanban — the new order appears in the `DRIVER_ASSIGNED` column (the bot's `confirmOrder` shortcut advances it automatically).

**Expected:** Order visible in Kanban with status `DRIVER_ASSIGNED` and `progress_percent=0`.
Optional DB check:
```bash
psql "$DATABASE_URL" -c "SELECT id, number, status, progress_percent FROM orders ORDER BY created_at DESC LIMIT 1;"
```

Result: ⬜ PASS / ⬜ FAIL — note: ______________________

---

### 3. Leg 1 ticker advances progress_percent (driver → pickup)
With `DEMO_TICKER_INTERVAL_SEC=5` and `DEMO_TICKER_DELTA_PCT=25`, the progress bar advances every 5 seconds.

Open the order detail page: http://localhost:3001/dashboard/orders/[id]

**Expected:** `progress_percent` climbs 0 → 25 → 50 → 75 over ~15 seconds. The progress bar in the UI reflects this.

At progress ≥ 90% (i.e. after the 75→100 tick crosses 90 first): Telegram client receives a text message:
- RU: `🚚 Машина подъезжает к точке загрузки`
- UA: `🚚 Машина під'їжджає до місця завантаження`

**Expected:** Message arrives exactly once (idempotency: second tick at ≥90% sends no second message because `approach_notified` row already exists in `order_events`).

Result: ⬜ PASS / ⬜ FAIL — note: ______________________

---

### 4. Leg 1 reaches 100% — loading prompt with inline keyboard
One tick after the 90% approach notification, progress hits 100%.

**Expected:**
- `orders.status` flips from `DRIVER_ASSIGNED` → `AT_LOADING`.
- `orders.progress_percent` resets to `0`.
- Telegram client receives message with inline keyboard:
  - RU: `🚚 Машина прибыла на загрузку` + buttons `✅ Да, подтверждаю` / `⚠️ Нет, есть проблема`
  - UA: `🚚 Машина прибула на завантаження` + buttons `✅ Так, підтверджую` / `⚠️ Ні, є проблема`
- Kanban at http://localhost:3001/dashboard/orders/kanban shows order moved to `AT_LOADING` column.

Result: ⬜ PASS / ⬜ FAIL — note: ______________________

---

### 5. Confirm loading — start leg 2
Tap `✅ Да, подтверджую` (or UA equivalent) in Telegram.

**Expected:**
- Bot acknowledges (inline keyboard replaced with acknowledgment text).
- `orders.status` → `IN_TRANSIT`.
- `order_events` has a `loading_confirmed` row for this order.
- `orders.progress_percent` = 0 (already reset at AT_LOADING transition; confirmed here).
- Leg 2 ticker starts immediately on next tick.

DB check:
```bash
psql "$DATABASE_URL" -c "SELECT type, created_at FROM order_events WHERE order_id='<id>' ORDER BY created_at;"
```
**Expected events so far:** `loading_prompted`, `approach_notified`, `loading_confirmed` (in that order).

Result: ⬜ PASS / ⬜ FAIL — note: ______________________

---

### 6. Leg 2 truck animation on tracking map
Open http://localhost:3001/dashboard/tracking.

**Expected:** The truck marker for this order slides along the road polyline from pickup toward drop-off as `progress_percent` climbs. (`trucks.geom` updates in DB each tick via `interpolateAlongPolyline`.)

Optional DB check between ticks:
```bash
psql "$DATABASE_URL" -c "SELECT ST_AsText(geom) FROM trucks WHERE status='busy' LIMIT 1;"
```
**Expected:** WKT `POINT(lng lat)` value changes across ticks.

At progress ≥ 90% on leg 2: Telegram client receives:
- RU: `📍 Машина подъезжает к точке выгрузки`
- UA: `📍 Машина під'їжджає до місця вивантаження`

Result: ⬜ PASS / ⬜ FAIL — note: ______________________

---

### 7. Leg 2 reaches 100% — delivery prompt
**Expected:**
- `orders.status` flips to `DELIVERED_PENDING`.
- `orders.progress_percent` resets to `0`.
- Telegram client receives delivery inline keyboard:
  - RU: `📦 Машина прибыла на выгрузку` + `✅ Да, получил` / `⚠️ Нет, есть проблема`
  - UA: `📦 Машина прибула на вивантаження` + `✅ Так, отримав` / `⚠️ Ні, є проблема`

Tap `✅ Да, получил` (or UA equivalent).

**Expected after tap:**
- `orders.status` → `AWAITING_PAYMENT`.
- `order_events` has `delivery_confirmed` row.
- Telegram client receives payment link message:
  - RU: `💳 Спасибо! Для завершения заказа оплатите, пожалуйста, по ссылке: https://checkout.stripe.com/...`
  - UA: `💳 Дякуємо! Щоб завершити замовлення, оплатіть за посиланням: https://checkout.stripe.com/...`
- Open the Stripe Checkout URL in a browser. **Expected:** Stripe-hosted page renders showing `"Грузоперевозка #KU-XXXXX"` and the order's price in RUB.

Result: ⬜ PASS / ⬜ FAIL — note: ______________________

---

### 8. Pay with test card — webhook closes order
On the Stripe Checkout page, pay with:
- Card number: `4242 4242 4242 4242`
- Expiry: `12/34`
- CVC: `123`
- Postal code: any 5-digit value

**Expected sequence after clicking Pay:**
1. Browser redirects to http://localhost:3001/payment/success — page renders `Спасибо! / Дякуємо!`.
2. `stripe listen` terminal logs `checkout.session.completed` event forwarded to `localhost:3000/webhook/stripe`. API terminal logs `stripe webhook: order <id> → CLOSED`.
3. `orders.status` = `CLOSED` in DB:
   ```bash
   psql "$DATABASE_URL" -c "SELECT status FROM orders WHERE id='<id>';"
   ```
4. Telegram client receives:
   - RU: `✅ Оплата получена. Заказ #KU-XXXXX закрыт. Спасибо, что воспользовались нашим сервисом!`
   - UA: `✅ Оплату отримано. Замовлення #KU-XXXXX закрито. Дякуємо!`
5. `order_events` has rows: `payment_link_sent`, `payment_received`, `closed`.
6. `webhook_updates` has one row for this `checkout.session.id` (idempotency). Replaying the webhook produces no second status change.

Result: ⬜ PASS / ⬜ FAIL — note: ______________________

---

### 9. Decline path (separate order — negative branch)
Create a second order and advance it to `AT_LOADING` (repeat steps 2–4 with a new order, or fast-advance using psql:
```bash
psql "$DATABASE_URL" -c "UPDATE orders SET status='AT_LOADING', progress_percent=0 WHERE id='<new-order-id>';"
```

When the loading prompt arrives in Telegram, tap `⚠️ Нет, есть проблема` (or UA `⚠️ Ні, є проблема`).

**Expected:**
- `orders.status` → `CANCELED`.
- The truck assigned to this order: `trucks.status` flips from `'busy'` → `'available'`.
- `leads.manager_active` = `true` for the linked lead.
- Ticker stops for this order automatically (next tick ignores it — filtered by `status IN ('DRIVER_ASSIGNED','IN_TRANSIT')`).
- Bot sends:
  - RU: `Хорошо, передаю коллеге, он свяжется в ближайшее время.`
  - UA: `Гаразд, передаю колезі, він зв'яжеться найближчим часом.`
- `order_events` has `loading_declined` row.
- http://localhost:3001/dashboard/tracking — the truck marker is back in the fleet (status available, no longer highlighted as busy).

Result: ⬜ PASS / ⬜ FAIL — note: ______________________

---

### 10. Admin override and action bar (Plan 06-04)
Create a third order and advance to `DRIVER_ASSIGNED`.

Open http://localhost:3001/dashboard/orders/[id] — the `OrderActionBar` is visible below the order detail section.

**Sub-step A — Pause ticker:**
Click `Пауза` button.
**Expected:** API call to `POST /api/orders/:id/ticker { paused: true }`. `orders.auto_progress_paused` = `true`. Ticker no-ops this row on next tick (progress does not advance for 15 seconds after pause).

**Sub-step B — Resume ticker:**
Click `Возобновить` button.
**Expected:** `auto_progress_paused` = `false`. Progress resumes advancing on next tick.

**Sub-step C — Reset progress:**
Click `Сброс прогресса` button.
**Expected:** `orders.progress_percent` = `0` (confirmed in order detail page or DB).

**Sub-step D — Status override:**
From the status dropdown, select `CANCELED`. Enter reason `manual stop` in the confirmation.
**Expected:**
- `orders.status` = `CANCELED` immediately (FSM bypass).
- `order_events` has `admin_override` row with `payload.status='CANCELED'`, `payload.reason='manual stop'`, `actor='manager'`.
- DB check:
  ```bash
  psql "$DATABASE_URL" -c "SELECT type, payload FROM order_events WHERE order_id='<id>' AND type='admin_override';"
  ```

Result: ⬜ PASS / ⬜ FAIL — note: ______________________

---

## Timeout Escalation — Optional Extended Test

*(Requires temporarily editing timeout intervals for demo speed. Revert after testing.)*

Edit `apps/api/src/pipeline/lifecycle/timeout-escalation.ts` — change reminder threshold from `10 * 60 * 1000` to `30 * 1000` (30 seconds) and escalation threshold from `30 * 60 * 1000` to `60 * 1000` (60 seconds). Restart API.

Create an order and advance to `AT_LOADING`. Do NOT tap any keyboard button.

- At ~30 seconds: **Expected:** Telegram receives reminder message (same loading prompt keyboard again). `order_events` has `reminder_sent` row.
- At ~60 seconds: **Expected:** `order_events` has `operator_escalated` row. `leads.manager_active` = `true`. Status unchanged (`AT_LOADING`). Admin picks up the order via http://localhost:3001/dashboard/orders/kanban.

After verifying, revert `timeout-escalation.ts` to original thresholds and restart API.

Result: ⬜ PASS / ⬜ FAIL — note: ______________________

---

## Sign-Off Table

| Step | Description                                 | Pass | Fail | Notes |
|------|---------------------------------------------|------|------|-------|
| 1    | Migration applied + enum values verified    |      |      |       |
| 2    | Order created via Telegram + Kanban         |      |      |       |
| 3    | Leg 1 ticker advances + approach notify     |      |      |       |
| 4    | Leg 1 100% → AT_LOADING + loading keyboard  |      |      |       |
| 5    | Confirm loading → IN_TRANSIT + leg 2 starts |      |      |       |
| 6    | Leg 2 truck animates on map + approach msg  |      |      |       |
| 7    | Leg 2 100% → DELIVERED_PENDING + Stripe URL |      |      |       |
| 8    | Test card payment → CLOSED + Telegram ack   |      |      |       |
| 9    | Decline path → CANCELED + truck available   |      |      |       |
| 10   | Admin action bar: pause/resume/reset/force  |      |      |       |

**Smoke tests (run before walkthrough):**
```bash
pnpm --filter @ai-logist/api test:unit   # must exit 0
pnpm --filter @ai-logist/web test         # must exit 0
```

**Phase 6 sign-off (circle one):** APPROVED / CONDITIONAL / NEEDS-REWORK

If CONDITIONAL or NEEDS-REWORK, list defects below and trigger `/gsd:plan-phase 6 --gaps`.

**Tester signature:** _______________________
**Date signed:** _______________________
