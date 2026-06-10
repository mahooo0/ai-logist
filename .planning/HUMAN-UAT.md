# AI-Логист — Human UAT Backlog

Cross-phase tracker of manual verifications that were **auto-approved** during
`--auto` mode execution but still require a real human pass before each phase
can be marked "buyer-eval ready."

Per-phase HUMAN-UAT logs (if any) live alongside the phase plans in
`.planning/phases/XX-name/HUMAN-UAT.md`.

## Status legend

- ⏳ pending — auto-approved, awaiting real human pass
- ✅ verified — real human ran the steps and signed off
- ❌ failed — real human hit a blocker; needs follow-up plan

---

## UAT-01: 10-minute fresh-developer README walkthrough (Phase 1, Plan 01-10)

**Status:** ⏳ pending (auto-approved 2026-06-09 in `--auto` orchestrator mode)

**Phase log:** `.planning/phases/01-database-backend-skeleton/HUMAN-UAT.md` (UAT-01 detail)

**Why deferred:** Plan 01-10 ended with a `checkpoint:human-verify` task. Orchestrator was invoked with `--auto`, so the executor auto-approved per `<auto_mode_directive>`. The README path was verified statically (file content + grep + unit tests) but no real human has actually executed the 10-minute sequence on a clean machine yet.

**Acceptance:** ✅ if a real human can follow README and reach `/api/health 200` within 10 minutes.

---

## UAT-03: Phase 3 Telegram channel — real chat smoke + ngrok walkthrough (Plan 03-05)

**Status:** ⏳ pending (auto-approved 2026-06-10 in `--auto` orchestrator mode)

**Why deferred:** Plan 03-05 ended with a `checkpoint:human-verify` task gating
the only fully-real validation Phase 3 cannot automate — a live Telegram
conversation against a real bot via ngrok. Orchestrator was invoked with
`--auto`, so the executor auto-approved per `<auto_mode_directive>`. The
webhook path was verified statically (route+helper presence, typecheck, biome,
157 unit tests, integration tests Docker-gated under `AI_LOGIST_NO_DOCKER=1`),
but the real BotFather flow + real Telegram dialog has not been exercised yet.

**Verification protocol (9 steps):**

1. **Boot infra + apply seed:**
   ```bash
   docker compose up -d postgres redis
   pnpm install
   pnpm --filter @ai-logist/api db:migrate
   pnpm --filter @ai-logist/api seed
   ```

2. **Create the bot** via [@BotFather](https://t.me/BotFather): `/newbot`,
   save TOKEN + USERNAME.

3. **Generate webhook secret** + populate `.env.local`:
   ```bash
   openssl rand -hex 32
   ```
   Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_BOT_USERNAME`.

4. **Start ngrok** + register webhook:
   ```bash
   ngrok http 3000
   # → save https://abcd1234.ngrok.io into TELEGRAM_PUBLIC_URL in .env.local
   pnpm --filter @ai-logist/api dev   # in another terminal
   pnpm --filter @ai-logist/api telegram:setup
   # → { "ok": true, "url": "https://abcd1234.ngrok.io/webhook/telegram" }
   ```

5. **From a real Telegram account**, send the bot:
   `Киев-Львов, 18 тонн, тент`

6. Bot offers a quote card with three inline buttons (Подтвердить рейс ✅ /
   Отказаться / Изменить).

7. Tap **Подтвердить рейс ✅** → bot replies with order number + tracking
   link.

8. **Verify via psql:**
   ```bash
   docker exec ailogist-postgres psql -U ailogist -d ailogist \
     -c "SELECT stage FROM leads ORDER BY created_at DESC LIMIT 1"
   # → ORDER_CREATED
   docker exec ailogist-postgres psql -U ailogist -d ailogist \
     -c "SELECT status FROM orders ORDER BY created_at DESC LIMIT 1"
   # → DRIVER_ASSIGNED (Wave 4 auto-advance)
   ```

9. **Confirm driver leg** — if `driver_telegram_id` is seeded on the matched
   truck, the driver Telegram account receives a "Новый рейс" notification
   with Принять/Отказаться buttons. Tap Принять → bot logs `driver accepted`.

**Bonus (manager intercept TG-06):**

```bash
# Find the most recent open lead id from psql, then:
curl -X POST http://localhost:3000/api/leads/<lead-id>/intercept
# → bot pushes "Здравствуйте, я Иван, менеджер..." to the client
# Now send a follow-up from the client account — bot is SILENT.
curl -X POST http://localhost:3000/api/leads/<lead-id>/manager-message \
  -H 'content-type: application/json' \
  -d '{"text": "Привет от менеджера"}'
# → message arrives in Telegram client.
curl -X POST http://localhost:3000/api/leads/<lead-id>/release
# → handover message arrives; bot resumes normal flow.
```

**Tear down:**

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/deleteWebhook"
```

**Acceptance:** ✅ if a real human can follow the steps end-to-end without
fall-through, with `leads.stage = ORDER_CREATED` and
`orders.status = DRIVER_ASSIGNED` in the DB after a single confirmed dialog.

**Verifier checklist:**

- [ ] `pnpm telegram:setup` exits 0 with `{ ok: true, url: ... }`
- [ ] `getWebhookInfo` shows `last_error_message: null`,
      `pending_update_count: 0`
- [ ] Bot replies to real chat with the quote card + 3 inline buttons
- [ ] Confirm tap creates an order; `SELECT stage FROM leads` →
      `ORDER_CREATED`
- [ ] `/api/health.checks.telegram` returns `'ok'`
- [ ] Manager intercept loop (intercept/manager-message/release) works
      against real chat
- [ ] Tear down via `deleteWebhook` succeeds

**On failure:** Open a hotfix plan with the specific gap (e.g.
`03-06-telegram-uat-hotfix-PLAN.md`).

---

*Last updated: 2026-06-10 (Plan 03-05 auto-approval).*
