# AI-Логист — Deploy Handoff

**Cold-start brief for the next agent / engineer.**
**As of:** 2026-06-13, commit `fe1fd29` on `main`.
**Phase 6 just shipped** (order lifecycle automation: ticker → Telegram confirms → Stripe → CLOSED + negative paths). All code is committed. Three things stand between you and a green demo: apply migration 0006, supply two webhook secrets, run the UAT walkthrough.

---

## 1. Where the project stands

| Item | State |
|------|-------|
| Branch | `main` |
| HEAD | `fe1fd29` — fix(ticker): reset progress only after transitionOrder succeeds |
| Last phase | **Phase 6 complete** — 22/22 D-decisions verified in code; HUMAN-UAT auto-deferred |
| Milestone | v1.0 + Phase 6 extension |
| Test state | apps/api: 402 passed / 32 failed (failures are **pre-existing Phase 5 snapshot drift**, not Phase 6); typecheck clean across api + web |
| Migration debt | `apps/api/drizzle/0006_order_lifecycle.sql` written but **NOT applied** to the live DB. Must be applied manually before Phase 6 runtime works. See §6. |
| Stripe state | `sk_test_…` loaded in `apps/api/.env.local`. `STRIPE_WEBHOOK_SECRET=` is empty — fill from `stripe listen` output. See §7. |

**Where to dig deeper** (do NOT read all of these upfront; pull on demand):
- `.planning/PROJECT.md` — vision, core value, validated requirements per phase
- `.planning/ROADMAP.md` — phase plan / progress
- `.planning/STATE.md` — current position
- `.planning/phases/06-…/06-PHASE-SUMMARY.md` — comprehensive Phase 6 aggregation
- `.planning/phases/06-…/HUMAN-UAT-06.md` — 10-step walkthrough
- `./CLAUDE.md` — stack lock + project invariants ("LLM ведёт диалог, детерминированный код принимает решения по деньгам")

---

## 2. Stack snapshot

**Runtime / language:** Node 22 LTS · TypeScript 5.7 strict · pnpm workspaces monorepo

**Apps:**
- `apps/api` — Fastify 5.8.5 · grammY 1.43 (Telegram) · Anthropic SDK + OpenAI SDK (failover) · Stripe 22.2.0 · Drizzle ORM 0.45.2
- `apps/web` — Next.js 16 (App Router, Turbopack) · React 19 · Tailwind v4 · shadcn/ui · Zustand · SWR · Leaflet

**Infra:**
- Postgres 17 + PostGIS 3.5 (`postgis/postgis:17-3.5`)
- Redis 7 (`redis:7-alpine`)
- Caddy 2 (reverse proxy + auto Let's Encrypt on prod)

**Service topology** (from `docker-compose.yml`):
```
caddy :80/:443
  ├─ /api/*     → api:3000
  ├─ /webhook/* → api:3000
  ├─ /ws/*      → api:3000   (WS reserved for v2)
  └─ /*         → web:3001
api → postgres:5432, redis:6379
web → api:3000 (server-side fetch via API_INTERNAL_URL)
```

---

## 3. Critical pending items (do these in order)

### a. Apply migration `0006_order_lifecycle.sql`

Adds 3 new `order_status` enum values (`DELIVERED_PENDING`, `AWAITING_PAYMENT`, `CANCELED`), 14 new `order_event_type` values, `webhook_source += 'stripe'`, and `orders.auto_progress_paused boolean`.

**Why manual:** Postgres `ALTER TYPE … ADD VALUE` cannot run inside a transaction. `drizzle-kit migrate` wraps each migration in a tx, so it will fail. Apply with raw `psql`.

**Command (docker-compose path — recommended):**
```bash
docker exec -i ailogist-postgres psql -U ailogist -d ailogist \
  < apps/api/drizzle/0006_order_lifecycle.sql
```

**Or direct (if Postgres is exposed on localhost:5432):**
```bash
psql "postgresql://ailogist:ailogist@localhost:5432/ailogist?sslmode=disable" \
  -f apps/api/drizzle/0006_order_lifecycle.sql
```

**Verify (must return 3 rows):**
```bash
docker exec ailogist-postgres psql -U ailogist -d ailogist -c \
  "SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid \
   WHERE t.typname='order_event_type' \
   AND enumlabel IN ('loading_prompted','delivery_prompted','approach_notified') \
   ORDER BY enumlabel;"
```

**Then flip the last test stub:** edit `apps/api/tests/unit/phase-6-stubs.test.ts` — change the one remaining `test.skip(` for D-10 to `test(` (around line 59). Re-run `pnpm --filter @ai-logist/api test:unit -t phase-6-stubs` → expect 0 skips, 0 failures.

### b. Fill `STRIPE_WEBHOOK_SECRET`

```bash
# In a long-running terminal:
stripe listen --forward-to localhost:3000/webhook/stripe

# It prints:  "Ready! Your webhook signing secret is whsec_xxxxxxxxxxxx"
# Copy whsec_… and paste into apps/api/.env.local under STRIPE_WEBHOOK_SECRET=
# Restart the API.
```

For prod: create a webhook endpoint at https://dashboard.stripe.com/test/webhooks pointing at `https://<DOMAIN>/webhook/stripe`, enable event `checkout.session.completed`, copy its signing secret.

### c. Run `HUMAN-UAT-06.md` (10 steps)

Path: `.planning/phases/06-order-lifecycle-automation-…/HUMAN-UAT-06.md`. Covers: migration apply → API+Web boot → stripe listen → create order via Telegram → observe ticker → confirm loading → confirm delivery → pay with test card `4242 4242 4242 4242` → verify CLOSED + "Оплата получена" message → decline path + admin override smoke. ~25 min end-to-end.

---

## 4. Local dev — first boot

```bash
# 0. Prereqs: Docker Desktop running, pnpm installed.
pnpm install

# 1. Copy env templates and fill them (see §5 for the required minimum).
cp .env.example .env.local
cp apps/api/.env.example apps/api/.env.local
# Edit both with real values.

# 2. Bring up Postgres + Redis (api + web run on the host in dev).
docker compose up -d postgres redis

# 3. Apply schema (uses drizzle-kit; FINE for migrations 0001-0005).
pnpm --filter @ai-logist/api db:migrate

# 4. Apply migration 0006 manually (drizzle-kit can't — see §3a).
docker exec -i ailogist-postgres psql -U ailogist -d ailogist \
  < apps/api/drizzle/0006_order_lifecycle.sql

# 5. Seed 30 cities + 12 trucks + 8 clients.
pnpm seed

# 6. Start API (port 3000) and Web (port 3001) in two terminals.
pnpm --filter @ai-logist/api dev
pnpm --filter @ai-logist/web dev

# 7. Optional: pre-flight checklist (Telegram bot getMe, Anthropic key, etc.)
pnpm preflight
```

**To exercise Phase 6 ticker:** set `DEMO_TICKER_ENABLED=true` in `apps/api/.env.local`, restart API. Look for log line `order-ticker registered` at boot.

**Webhook hosts for local dev:**
- Telegram: `ngrok http 3000` → set `TELEGRAM_PUBLIC_URL=https://<ngrok-host>` → `pnpm --filter @ai-logist/api exec tsx scripts/telegram-setup.ts` to register webhook.
- Stripe: `stripe listen --forward-to localhost:3000/webhook/stripe` (see §3b).
- Voice (ElevenLabs/Twilio): `VOICE_PUBLIC_URL=https://<ngrok-host>` → `pnpm --filter @ai-logist/api exec tsx scripts/voice-setup.ts` (only if testing voice channel).

---

## 5. Env var reference

Two `.env` files matter. **Both are gitignored.** Root `.env.local` feeds the dev scripts (tsx --env-file). `apps/api/.env.local` is where Stripe + Phase 6 toggles live (current convention; the Stripe agent put them here during Phase 6 execution).

### Minimum for the API to boot

| Var | Source | Required? |
|-----|--------|-----------|
| `DATABASE_URL` | Default `postgresql://ailogist:ailogist@localhost:5432/ailogist?sslmode=disable` | Yes |
| `REDIS_URL` | Default `redis://localhost:6379` | Yes |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com/ | Yes (LLM pipeline) |
| `LLM_PROVIDER` | `anthropic` (default) or `openai` | No |
| `OPENAI_API_KEY` | https://platform.openai.com/ | Only if `LLM_PROVIDER=openai` |

### Telegram channel (Phase 3)

| Var | Source | Required? |
|-----|--------|-----------|
| `TELEGRAM_BOT_TOKEN` | @BotFather → `/newbot` | Yes for Telegram |
| `TELEGRAM_BOT_USERNAME` | bot username without `@` | Yes |
| `TELEGRAM_WEBHOOK_SECRET` | `openssl rand -hex 32` | Yes |
| `TELEGRAM_PUBLIC_URL` | ngrok / your domain | Yes for webhook |
| `TELEGRAM_SET_WEBHOOK_ON_BOOT` | `true` to auto-register on app start | No |

### Voice channel (Phase 3.1 — optional)

| Var | Source |
|-----|--------|
| `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_WEBHOOK_SECRET`, `ELEVENLABS_VOICE_ID` | https://elevenlabs.io/app/settings/api-keys |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `TWILIO_WEBHOOK_SIGNATURE_SECRET` | https://console.twilio.com/ |
| `VOICE_PUBLIC_URL` | ngrok / your domain (defaults to `TELEGRAM_PUBLIC_URL`) |

### Phase 6 — ticker

| Var | Default | Notes |
|-----|---------|-------|
| `DEMO_TICKER_ENABLED` | `false` | **Set to `true`** to enable the auto-progress demo ticker |
| `DEMO_TICKER_INTERVAL_SEC` | `30` | seconds between ticks |
| `DEMO_TICKER_DELTA_PCT` | `10` | progress percentage points added per tick |

### Phase 6 — Stripe

| Var | Default / Source | Notes |
|-----|------------------|-------|
| `STRIPE_SECRET_KEY` | https://dashboard.stripe.com/test/apikeys (`sk_test_…`) | **Already loaded** in `apps/api/.env.local`. For prod replace with live key. |
| `STRIPE_WEBHOOK_SECRET` | `stripe listen` output OR dashboard endpoint creation (`whsec_…`) | **EMPTY** — see §3b |
| `STRIPE_PRICE_CURRENCY` | `rub` | ISO code for `line_items.unit_amount` |
| `STRIPE_SUCCESS_URL` | `http://localhost:3000/payment/success` (defaults set in `.env.local`) | Replace with HTTPS prod URL |
| `STRIPE_CANCEL_URL` | `http://localhost:3000/payment/cancel` | Same |

### Phase 6 — admin auth (optional shared secret)

| Var | Default | Notes |
|-----|---------|-------|
| `ADMIN_API_SECRET` | unset → no-op | If set, `PATCH /api/orders/:id/status` + `POST /api/orders/:id/ticker` require `X-Admin-Secret: <value>` header. Mismatch → 401. Web's server-side fetches must attach the header. |

### Web (Phase 4 admin login)

| Var | Source |
|-----|--------|
| `ADMIN_USERNAME` | default `admin` |
| `ADMIN_PASSWORD_HASH` | `pnpm --filter @ai-logist/web gen:admin-password` |
| `AUTH_COOKIE_SECRET` | `openssl rand -hex 32` |
| `API_INTERNAL_URL` | `http://api:3000` (docker-compose hostname) |

### External services (optional overrides)

| Var | Default |
|-----|---------|
| `OSRM_URL` | `https://router.project-osrm.org` (free demo server) |
| `NOMINATIM_URL` | `https://nominatim.openstreetmap.org` (1 req/sec policy) |
| `NOMINATIM_CONTACT_EMAIL` | required by Nominatim policy |
| `LLM_MODEL` | `claude-sonnet-4-7` |
| `LLM_TOKEN_BUDGET_PER_LEAD` | `30000` |

---

## 6. Phase 6 specific — what landed and why the ticker has been a pain

### What ships with Phase 6

- Background `setInterval` ticker at `apps/api/src/pipeline/lifecycle/order-ticker.ts` — advances `orders.progress_percent` for orders in `DRIVER_ASSIGNED` / `IN_TRANSIT`, fires `notifyApproach` at 90% (per-leg event types — Pitfall 4), transitions to `AT_LOADING` / `DELIVERED_PENDING` at 100% via `transitionOrder` post-commit hook (Pitfall 2: mutual exclusion).
- FSM extension: 8 new `ORDER_TRANSITIONS` edges in `apps/api/src/pipeline/lifecycle/order-fsm.ts`. Critical: `STATUS_TO_EVENT.AT_LOADING = 'loading_prompted'` (B5 Path A — NOT the legacy `'at_loading'`). Timeout SQL in `timeout-escalation.ts` queries this value.
- 14 new Telegram templates RU+UA via `renderPhase6Template`, including `payment_unavailable` (D-19 fail-safe).
- Stripe Checkout Session creator (`apps/api/src/channels/stripe/checkout.ts`) + Fastify-scoped raw-body webhook (`apps/api/src/routes/webhooks-stripe.ts`, Pitfall 1 — `removeAllContentTypeParsers` + `parseAs:'buffer'` inside the plugin scope only, no `fastify-raw-body` dep).
- `sendPaymentLink` in `apps/api/src/channels/telegram/handlers.ts` — if `requireStripeConfig()` throws → `app.log.fatal({gate:'D-19'})` + sends `payment_unavailable` Telegram message + sets `leads.manager_active=true`. **No silent swallow.**
- Admin overrides — `PATCH /api/orders/:id/status` (FSM bypass + `admin_override` audit) and `POST /api/orders/:id/ticker` (pause flag). Optional `X-Admin-Secret` guard via `apps/api/src/plugins/admin-auth.ts`.
- Frontend action bar `apps/web/src/app/(main)/dashboard/orders/[id]/_components/order-action-bar.tsx` + public `/payment/success` and `/payment/cancel` stub pages.

### Why the ticker can look silent

The migration is the load-bearing prerequisite. Without it, `transitionOrder` tries to insert `'loading_prompted'::order_event_type`, the enum cast fails, the FSM transaction rolls back, no Telegram message is sent. Watch API logs for `order-ticker: transition failed` to confirm. Symptom user observed: order's progress climbed to 100, status stayed at `DRIVER_ASSIGNED`, no Telegram message.

Commit `fe1fd29` (just before this handoff) moves the `progress_percent = 0` reset INTO the `onSuccess` callback of `transitionOrder`. Effect: on a failed transition, progress stays at 100 and the next tick retries without re-walking 0 → 100. Once migration 0006 is applied, the next tick of any stuck order will transition successfully and the Telegram prompt will arrive.

### Pitfalls already mitigated in code (so you don't re-introduce them)

| # | What | Where |
|---|------|-------|
| 1 | Fastify global JSON parser breaks Stripe HMAC verification | `webhooks-stripe.ts` — scoped `removeAllContentTypeParsers` + `parseAs:'buffer'` |
| 2 | Same tick crossing 90% AND 100% would double-fire | `order-ticker.ts` — `if newPct >= 100 … else if newPct >= 90` |
| 3 | Truck `geom` interpolation needs polyline per leg | `order-ticker.ts` — leg-2-only animation (leg 1 deferred) |
| 4 | `UNIQUE(order_id, type)` blocks per-leg event re-insertion | distinct types `approach_notified` (leg 1) vs `delivery_approach_notified` (leg 2) |
| 5 | `ALTER TYPE ADD VALUE` cannot run inside a transaction | `0006_order_lifecycle.sql` has MANUAL APPLY header; do NOT use `drizzle-kit migrate` |
| 6 | Backend has no auth | `admin-auth.ts` — optional `X-Admin-Secret` shared-secret guard |
| 8 | Ticker mutating CANCELED rows | `order-ticker.ts` — UPDATE has `WHERE status IN ('DRIVER_ASSIGNED','IN_TRANSIT')` |

---

## 7. Webhook setup checklist

### Telegram

```bash
# 1. Get token from @BotFather → /newbot → save as TELEGRAM_BOT_TOKEN
# 2. Generate secret: openssl rand -hex 32 → TELEGRAM_WEBHOOK_SECRET
# 3. Expose API: ngrok http 3000  (or use your prod HTTPS URL)
# 4. Set TELEGRAM_PUBLIC_URL=https://<host>
# 5. Register the webhook:
pnpm --filter @ai-logist/api exec tsx scripts/telegram-setup.ts

# Sanity check (should return result.url = your public URL):
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

### Stripe (test mode)

```bash
# Option A — local dev with stripe-cli (recommended):
stripe listen --forward-to localhost:3000/webhook/stripe
# Copy the printed whsec_… into apps/api/.env.local STRIPE_WEBHOOK_SECRET=
# Restart API.

# Option B — public endpoint (for staging / prod):
# dashboard.stripe.com/test/webhooks → "Add endpoint" →
#   URL: https://<DOMAIN>/webhook/stripe
#   Event: checkout.session.completed
# Copy "Signing secret" → STRIPE_WEBHOOK_SECRET

# Test card during UAT:
#   4242 4242 4242 4242  exp 12/34  cvc 123  zip any
```

### ElevenLabs / Twilio (only if voice channel is in scope)

```bash
pnpm --filter @ai-logist/api exec tsx scripts/voice-setup.ts
# Creates/updates ElevenLabs Agent + registers Twilio webhook.
# Reads ELEVENLABS_*, TWILIO_*, VOICE_PUBLIC_URL from env.
```

---

## 8. Production deploy (VPS + Caddy + Let's Encrypt)

```bash
# On VPS (Ubuntu / Debian assumed):
git clone <repo-url> ai-logist && cd ai-logist
cp .env.example .env.local                    # fill secrets (production values)
cp apps/api/.env.example apps/api/.env.local  # fill Stripe + Phase 6 vars

# Replace ':80 {' in Caddyfile with your domain so Caddy auto-acquires TLS.
sed -i 's/^:80 {/<DOMAIN> {/' Caddyfile
# Or create Caddyfile.prod manually.

# Set DOMAIN env var so caddy service can read it.
echo "DOMAIN=ai-logist.example.com" >> .env.local

# Open firewall on 80 + 443.

# Build + start (prod overlay disables host port exposure for postgres/redis).
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# First-run schema (postgres healthcheck ensures it's ready first):
docker compose exec api pnpm --filter @ai-logist/api db:migrate
docker exec -i ailogist-postgres psql -U ailogist -d ailogist \
  < apps/api/drizzle/0006_order_lifecycle.sql
docker compose exec api pnpm seed

# Watch logs:
docker compose logs -f api web caddy
```

**Webhook URLs in production:**
- Telegram: `https://<DOMAIN>/webhook/telegram`
- Stripe: `https://<DOMAIN>/webhook/stripe`
- Voice (Twilio): `https://<DOMAIN>/webhook/voice/twiml` (and friends — see `voice-setup.ts`)

**Health check:** `https://<DOMAIN>/api/health` should return `{ status: "ok", postgis_version: "3.5…" }`.

There is also a `Caddyfile.dokploy` — alternative reverse-proxy config for the Dokploy PaaS. Use the plain `Caddyfile` for vanilla VPS deploys.

---

## 9. Verification commands

```bash
# Unit tests (api): 402 passing, 32 pre-existing Phase 5 snapshot failures, 12 skipped.
# The 32 failures are NOT regressions from Phase 6 — they predate it.
pnpm --filter @ai-logist/api test:unit

# Typecheck (must exit 0):
pnpm --filter @ai-logist/api typecheck
pnpm --filter @ai-logist/web typecheck

# Lint (Biome):
pnpm biome check .

# Phase 6 stub markers (should be 0 after D-10 flip post-migration):
grep -c "phase-6-stub" apps/api/tests/unit/phase-6-stubs.test.ts

# Enum sanity (should return 3 rows after migration 0006 applied):
docker exec ailogist-postgres psql -U ailogist -d ailogist -tAc \
  "SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid \
   WHERE t.typname='order_event_type' \
   AND enumlabel IN ('loading_prompted','delivery_prompted','approach_notified');"
```

---

## 10. Known issues / non-blockers

- **32 pre-existing unit test failures** in `i18n-dict`, `i18n-no-track-link`, `extract-request` snapshots. These predate Phase 6 (flagged by Phase 6 verifier in `06-VERIFICATION.md`). Address as separate cleanup; do NOT block deploy.
- **WebSocket endpoints (`/ws/tracking`, `/ws/inbox`) and public tracking link (`/track/[token]`) are deferred to v2.** Caddy still routes `/ws/*` per the Caddyfile so when those land they won't need infra changes.
- **Real GPS via `/webhook/gps` returns 501.** Phase 6 demo flow uses the auto-progress ticker instead.
- **Stripe RUB currency** works in test mode universally. Live mode acceptance depends on the Stripe account configuration (see RESEARCH Pitfall 7). Out of scope for the demo.
- **Backend has no general API auth** beyond the optional `X-Admin-Secret` on admin endpoints. Acceptable behind Caddy on a single-VM demo; not for public exposure. Document this for the customer if they ask.

---

## 11. Quick triage when something looks broken

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Order reaches 100% but no Telegram prompt | Migration 0006 not applied → `loading_prompted` enum value missing → transitionOrder rolls back | §3a |
| `pnpm --filter @ai-logist/api db:migrate` fails on `ALTER TYPE ADD VALUE` | Trying to run 0006 via drizzle-kit (wrapped in tx) | Apply 0006 manually via psql — §3a |
| Stripe webhook returns 400 "invalid signature" | `STRIPE_WEBHOOK_SECRET` empty OR wrong | `stripe listen` and paste the printed `whsec_…` — §3b |
| `/dashboard/orders/[id]` action bar Pause button does nothing | `ADMIN_API_SECRET` set but Web isn't sending `X-Admin-Secret` server-side fetch header | Either unset `ADMIN_API_SECRET` (demo posture) or wire the header in `apps/web` server fetches |
| Ticker never fires | `DEMO_TICKER_ENABLED` not `true` OR `NODE_ENV=test` | Set in `.env.local`, restart API. Look for `order-ticker registered` log at boot. |
| Telegram bot doesn't respond | Webhook not registered OR `TELEGRAM_PUBLIC_URL` not reachable | Re-run `scripts/telegram-setup.ts`; check `getWebhookInfo` |
| `/api/health` returns 500 | PostGIS extension not loaded | Postgres container should be `postgis/postgis:17-3.5` (not plain `postgres`); check `\dx` output |

---

## 12. Useful commands

```bash
# Open Drizzle Studio for ad-hoc DB inspection:
pnpm --filter @ai-logist/api db:studio

# Re-seed (DESTRUCTIVE — wipes leads/orders/messages):
pnpm seed

# Tail API logs in dev:
pnpm --filter @ai-logist/api dev   # logs to stdout, pino-pretty in dev

# Inspect Stripe events being replayed locally:
stripe events resume
stripe trigger checkout.session.completed   # synthetic event for offline testing
```

---

*Generated 2026-06-13 at HEAD `fe1fd29`. If you're picking this up later than ~one week from that date, re-read PROJECT.md and ROADMAP.md — facts may have shifted.*
