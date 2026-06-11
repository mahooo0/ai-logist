# Phase 5 — HUMAN UAT-06 (Demo Polish + Notifications + i18n)

**Estimated duration:** 25 minutes
**Pre-requisite:** Phase 5 Plans 00-04 + Plan 05 Task 1 complete; full suite green; Docker stack up via `docker compose up`.
**Resume signal:** Type "approved" when all 8 steps pass; describe failures otherwise.

## Setup

1. Start the stack: `docker compose up -d`
2. Confirm: `curl -s localhost:3000/api/health | jq` returns `{"status":"ok","checks":{"postgis":"3.5.x",...}}`
3. Open `http://localhost:3000/dashboard/calls` in the browser (log in via /auth/v1/login if prompted)

## Step 1 — Notification delivery (NOTIF-01 + NOTIF-02) [5 min]

Goal: confirm DRIVER_ASSIGNED + IN_TRANSIT + DELIVERED transitions send Telegram messages.

1. In a separate terminal, open psql: `docker compose exec postgres psql -U ai_logist`
2. Find a recent test order with a client.telegram_id (or seed one):
   ```sql
   SELECT o.id, o.public_token, c.telegram_id
   FROM orders o
   JOIN leads l ON l.id = o.lead_id
   JOIN clients c ON c.id = l.client_id
   WHERE c.telegram_id IS NOT NULL
   ORDER BY o.created_at DESC LIMIT 1;
   ```
3. Fire each transition manually (use the API to trigger onSuccess hooks; raw SQL updates skip them):
   ```bash
   ORDER_ID=<id from above>
   curl -X POST "localhost:3000/api/orders/$ORDER_ID/transition" -H 'content-type: application/json' -d '{"to":"DRIVER_ASSIGNED"}'
   # wait 1-2 seconds; check client's Telegram chat
   curl -X POST "localhost:3000/api/orders/$ORDER_ID/transition" -H 'content-type: application/json' -d '{"to":"IN_TRANSIT"}'
   curl -X POST "localhost:3000/api/orders/$ORDER_ID/transition" -H 'content-type: application/json' -d '{"to":"DELIVERED"}'
   ```
4. **PASS:** Telegram chat receives 3 messages, each in client's lang (RU or UA), each contains exactly one number (order number / truck plate), NONE contains `/track/` substring.
5. **FAIL:** missing message, wrong lang, or contains `/track/` substring.

## Step 2 — Pre-flight script green-light (POLISH-05) [3 min]

1. Run: `pnpm preflight`
2. **PASS:** All 6 checks show `✓` and final line says "Demo green-light. ✓"
3. **FAIL:** Any `✗` line. Document which check failed.

Optional: `pnpm preflight -- --json` for machine output (parseable in CI).

## Step 3 — Simulate inbound call modal (POLISH-02) [3 min]

1. On `/dashboard/calls`, click "▶ Simulate inbound call" button (header, top-right).
2. In the modal, click "RU — Happy path".
3. Wait up to 5 seconds for toast "Simulated call: <callId>... · order ...".
4. **PASS:** A new row appears in the calls table within 5 seconds; clicking it opens the existing CallDetailModal with transcript turns (audio player shows N/A since audio_url=NULL).
5. Repeat for "UA — Щасливий шлях".
6. Click "Prompt injection" — verify NO order is created at 1 RUB (Anti-Pitfall #1).
7. **FAIL:** No new row appears, modal errors, or visual layout breaks, or `injection_attempt` produces a 1-RUB order.

## Step 4 — Voice fallback video plays (POLISH-03) [3 min]

1. On `/dashboard/calls`, click "🎬 Видео-резерв" button (header, top-right next to Simulate).
2. **PASS:** Modal opens; clicking play starts the video; captions toggle works (Russian appears by default); audio is audible (or silent if placeholder MP4 — placeholder is intentional in pre-demo build).
3. Toggle UA captions track via the player's CC menu.
4. Close modal — confirm no JS errors in browser console.
5. **FAIL:** Video doesn't load, captions don't appear, or modal crashes.

NOTE: The shipped MP4 is a placeholder; team must re-record real ElevenLabs call before demo per `apps/web/public/demo/README.md`.

## Step 5 — i18n RU/UA toggle in admin (I18N-01 + I18N-04) [2 min]

1. Open the Customize panel (top-right gear icon in Zenith admin).
2. Switch language from EN → RU.
3. **PASS:** Sidebar labels switch to Russian; date columns now show "8 июн, ср" format.
4. Switch RU → UA.
5. **PASS:** Sidebar labels switch to Ukrainian; date columns show "8 чер, ср" format.
6. **FAIL:** Some labels stay English; dates show ISO instead of locale format.

## Step 6 — ICU plural rendering (I18N-03) [2 min]

1. Navigate to `/dashboard/default` (KPI tiles).
2. Look at the tile counts:
   - 1 order should render "1 заказ" (RU) / "1 замовлення" (UA)
   - 2 orders → "2 заказа" / "2 замовлення"
   - 5 orders → "5 заказов" / "5 замовлень"
   - 21 orders → "21 заказ" / "21 замовлення" (CLDR rule: 21 is 'one')
3. **PASS:** Counts render with correct plural forms in both langs.
4. **FAIL:** Any miscarriage (e.g., "5 заказа" or English fallback).

## Step 7 — OpenAI failover swap procedure (POLISH-06) [4 min]

1. In a terminal: `docker compose exec api env | grep LLM_PROVIDER` — confirm unset or `anthropic`.
2. Edit `.env.local`: set `LLM_PROVIDER=openai` and `OPENAI_API_KEY=sk-...` (real OpenAI key from team).
3. Restart api: `docker compose restart api`
4. Wait 5 seconds for api to come up.
5. Run: `curl -X POST localhost:3000/api/admin/simulate-call -d '{"scenarioKey":"ru_happy_path"}' -H 'content-type: application/json'`
6. **PASS:** Response contains `orderId` (non-null). Check `/dashboard/calls` — new row appears with the simulated call.
7. Revert: set `LLM_PROVIDER=anthropic`, restart api.
8. **FAIL:** API fails to start (Zod schema error), or simulate-call returns error.

## Step 8 — Final snapshot stability (POLISH-01) [2 min]

1. Run: `pnpm --filter @ai-logist/api test:snapshot`
2. **PASS:** All 10 consecutive runs green (the script loops 10× by design).
3. **FAIL:** Any run fails (snapshot drift — Pitfall §3).

## Final Sign-off

All 8 steps green → reply "approved" → Plan 05-05 SUMMARY can commit.
Any step red → describe the failure(s) → Plan 05-05 must address before merge.
