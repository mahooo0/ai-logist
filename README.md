# AI-Логист

Bilingual (RU/UA) logistics dispatching demo: Telegram + LLM + PostGIS + admin web + live tracking.

> **Phase 1 status (Database + Backend Skeleton).** Schema, migrations, Fastify skeleton, seed and `/api/health` are wired. Business logic (LLM extract / KNN match / pricing / FSM) lands in Phase 2. Telegram bot in Phase 3. Admin web in Phase 4. Live tracking in Phase 5. Polish in Phase 6.

## Prerequisites

- **Node.js 22.x LTS** (`node --version`)
- **pnpm 9.x** — install via `corepack enable && corepack prepare pnpm@9.15.0 --activate`
- **Docker Desktop** or Docker Engine + Compose v2 (`docker compose version`)
- macOS / Linux (Windows: use WSL2)

## Local setup (≤ 10 minutes on a clean machine)

```bash
# 1. Clone + env (~30s)
git clone <repo-url>
cd ai-logist
cp .env.example .env.local

# 2. Boot infrastructure: Postgres + PostGIS, Redis (~60s — first pull only)
docker compose up -d postgres redis

# 3. Install dependencies (~2-3 min — first install)
pnpm install

# 4. Apply migrations + seed (~30s)
pnpm db:migrate
pnpm seed   # prints "Canonical KNN smoke (pickup = Kyiv center)" — 3 nearest trucks

# 5. Start API (~5s)
pnpm dev
```

### Verify

In another terminal:

```bash
curl http://localhost:3000/api/health | jq
# → { "status": "ok", "version": "dev", "uptime_s": …,
#     "checks": { "db": "ok", "postgis": "3.5.x …", "redis": "ok" } }

open http://localhost:3000/api/docs   # Swagger UI — every endpoint listed
```

## Full stack (via Caddy on :80)

```bash
# Boot all 5 services (postgres, redis, api, web, caddy)
docker compose up -d
open http://localhost
```

Routing:
- `http://localhost/api/health` → Fastify
- `http://localhost/api/docs` → Swagger UI
- `http://localhost/` → Next.js placeholder (admin lands in Phase 4)

## VPS deploy (production overlay)

```bash
# On a fresh VM with Docker installed
git clone <repo-url> && cd ai-logist
cp .env.example .env.local
# Edit .env.local — set DB_PASSWORD, set DOMAIN (e.g., ai-logist.example.com)
# Edit Caddyfile — replace ':80' with your domain so Caddy auto-provisions Let's Encrypt

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Caddy automatically acquires a TLS cert via Let's Encrypt for the configured domain. No further config.

## Telegram Dev Setup

Wire a real Telegram bot to your local API in ~5 minutes via ngrok. Phase 3 ships
the full webhook pipeline (idempotency, secret_token auth, two-stage handler,
manager intercept, driver/client notifications); this section walks through
running it against the live Telegram Bot API.

1. **Create the bot.** Message [@BotFather](https://t.me/BotFather) on Telegram,
   send `/newbot`, follow the prompts (name + username, must end in `bot`). Save:
   - the bot **TOKEN** (e.g. `123456:ABC-DEF...`)
   - the bot **username** (e.g. `ai_logist_demo_bot`)

2. **Generate a webhook secret.** Telegram echoes this back in the
   `x-telegram-bot-api-secret-token` header on every update — the route rejects
   any update that doesn't match.

   ```bash
   openssl rand -hex 32
   ```

3. **Update `.env.local`** at the repo root with the values from steps 1 and 2:

   ```bash
   TELEGRAM_BOT_TOKEN=<token from BotFather>
   TELEGRAM_WEBHOOK_SECRET=<openssl output>
   TELEGRAM_BOT_USERNAME=<bot username without @>
   ```

4. **Start ngrok** in a separate terminal. The free tier gives you an HTTPS URL
   that proxies to localhost:3000:

   ```bash
   ngrok http 3000
   # Forwarding  https://abcd1234.ngrok.io -> http://localhost:3000
   ```

   Add the HTTPS URL to `.env.local`:

   ```bash
   TELEGRAM_PUBLIC_URL=https://abcd1234.ngrok.io
   ```

5. **Boot the API:**

   ```bash
   docker compose up -d postgres redis
   pnpm install
   pnpm --filter @ai-logist/api db:migrate
   pnpm --filter @ai-logist/api seed
   pnpm --filter @ai-logist/api dev
   ```

6. **Register the webhook with Telegram:**

   ```bash
   pnpm --filter @ai-logist/api telegram:setup
   # → { "ok": true, "url": "https://abcd1234.ngrok.io/webhook/telegram" }
   ```

   Verify:

   ```bash
   curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo" | jq
   # → url matches, last_error_message: null, pending_update_count: 0
   ```

7. **Test from your real Telegram account.** Open your bot, send `/start`
   (expect Russian greeting), then a realistic order:
   `Киев-Львов, 18 тонн, тент`. The bot should reply with a quote card + three
   inline buttons (Подтвердить рейс ✅ / Отказаться / Изменить). Tap
   **Подтвердить** to create the order; the next reply contains the order
   number + tracking link `/track/<token>`. The bot also pushes a
   "Машина назначена" notification when the driver is auto-assigned.

8. **Tear down** when finished:

   ```bash
   curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/deleteWebhook"
   ```

### Phase 3 health probe

```bash
curl http://localhost:3000/api/health | jq .checks.telegram
# → "ok" when the bot is configured and Telegram is reachable,
#   "not_configured" when TELEGRAM_BOT_TOKEN is unset,
#   "error" when Telegram refuses the bot.api.getMe() call.
```

The Telegram subcheck is cached in-process for 60s to avoid Telegram rate-limit
risk on `/health` scrape loops.

## Voice Channel Dev Setup

Wire a real ElevenLabs Conversational AI Agent + Twilio number to your local
API in ~10 minutes (excluding regulatory KYC). Phase 3.1 ships the full voice
webhook pipeline (HMAC signature verification, idempotency via
`webhook_updates`, per-conversation advisory locks, price-lock,
anti-injection, sticky lang); this section walks through one-time bootstrap
against the live ElevenLabs + Twilio APIs.

### Prerequisites

- **ElevenLabs account** → API key (Starter $6/mo tier is the minimum that
  unlocks Agents)
- **Twilio account** → Account SID + Auth Token + 1 phone number
  (~$3/mo + per-minute)
- **ngrok** or equivalent (public HTTPS URL for ElevenLabs Agent + Twilio
  webhooks) — the Telegram setup already needs this; reuse the same tunnel.
- `apps/api` Phase 1 / 2 / 3 already running locally

### Step 1 — Provision phone number

1. Twilio Console → Phone Numbers → Buy a number.
2. Search by region: RU `+7`, UA `+380`, or US `+1` (US works for local dev
   and doesn't require regulatory KYC).
3. Note the number in E.164 format — you'll need it in `.env.local`.
4. **WARNING:** RU/UA regulatory KYC can take 24–48h (sometimes longer).
   Provision the number 3+ days before any demo or buyer evaluation. If
   the number is still in `pending` state at demo time, the fallback video
   (POLISH-03) covers the gap.

### Step 2 — Get API keys

```bash
# Generate the ElevenLabs webhook secret used for HMAC verification:
openssl rand -hex 32
```

- ElevenLabs Dashboard → Profile → API Keys → copy the key.
- Twilio Console → top of dashboard → copy Account SID + Auth Token.
- Save the `openssl` output above as your `ELEVENLABS_WEBHOOK_SECRET`.

### Step 3 — Configure environment

Add to `.env.local` at the repo root:

```bash
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_WEBHOOK_SECRET=<openssl-rand-hex-32-output>
# ELEVENLABS_AGENT_ID=  # leave blank on first run; voice:setup creates and
                       # prints the id you should paste back here

TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+15555550100         # E.164 format
TWILIO_WEBHOOK_SIGNATURE_SECRET=         # = TWILIO_AUTH_TOKEN (Twilio signs
                                         #   with the auth token by default)

VOICE_PUBLIC_URL=https://abcd1234.ngrok.io   # falls back to TELEGRAM_PUBLIC_URL
```

### Step 4 — Start ngrok

If you already have an ngrok tunnel from the Telegram setup, reuse it (set
`VOICE_PUBLIC_URL` to the same value as `TELEGRAM_PUBLIC_URL` — the voice
handler scopes its routes to `/webhook/voice/*` so they don't collide).

```bash
ngrok http 3000
# Copy the https URL → set as VOICE_PUBLIC_URL in .env.local
```

### Step 5 — Run migrations + bootstrap

```bash
pnpm --filter @ai-logist/api db:migrate   # idempotent; ok if already applied
pnpm --filter @ai-logist/api voice:setup
# →
# === Voice Channel Bootstrap (Phase 3.1) ===
# ✓ ELEVENLABS_API_KEY
# ✓ ELEVENLABS_WEBHOOK_SECRET
# ✓ TWILIO_ACCOUNT_SID
# ✓ TWILIO_AUTH_TOKEN
# ✓ TWILIO_PHONE_NUMBER
# ✓ VOICE_PUBLIC_URL (or TELEGRAM_PUBLIC_URL)
#
# --- ElevenLabs Agent ---
# ✓ Loaded system prompt from elevenlabs-agent-config.md (... chars)
# ✓ Agent created: agent_xxxxx
#   → ADD TO .env.local: ELEVENLABS_AGENT_ID=agent_xxxxx
#
# --- Twilio Number ---
# ✓ Twilio number +15555550100 configured (sid: PN...)
#   voiceUrl       = https://abcd1234.ngrok.io/webhook/voice/twilio/twiml
#   statusCallback = https://abcd1234.ngrok.io/webhook/voice/twilio/status
#
# --- Manual Steps Required ---
# [ ] ... (checklist for SIP integration + test call + DB verification)
```

After the first run, add the printed `ELEVENLABS_AGENT_ID` to `.env.local`,
then re-run `pnpm voice:setup` — the second invocation PATCHes the existing
agent instead of creating a new one (idempotent).

### Step 6 — Manual SIP integration (one-time)

`voice:setup` cannot click through the UI on your behalf. Complete these
manual steps from the script's checklist:

1. In **ElevenLabs Dashboard → Agent → SIP integration** → enable SIP
   trunking. ElevenLabs displays your agent's SIP URI:
   `sip:<agent_id>@sip.elevenlabs.io`.
2. In **Twilio Console → Phone Numbers → your number → Voice** → confirm
   the webhook URL = `<VOICE_PUBLIC_URL>/webhook/voice/twilio/twiml`
   (already set by `voice:setup`; this step is a sanity check).
3. Optional but recommended: configure ElevenLabs Agent first-message
   templates per language in the dashboard (RU + UA) to match the prompts
   in `apps/api/src/channels/voice/elevenlabs-agent-config.md`.

### Step 7 — Test from a real phone

1. Dial `TWILIO_PHONE_NUMBER` from your mobile.
2. Speak: «Здравствуйте! Киев-Львов, 18 тонн, тент.»
3. Listen for: greeting → price quote → «Подтверждаете?» → say «да».
4. Verify in psql:
   ```bash
   psql -c "SELECT id, elevenlabs_conversation_id, outcome, lang, duration_s
            FROM calls ORDER BY created_at DESC LIMIT 1;"
   # → row with outcome='completed', lang='ru', duration_s > 0

   psql -c "SELECT id, price_kopecks, status
            FROM orders ORDER BY created_at DESC LIMIT 1;"
   # → order with price_kopecks matching the quote you heard
   ```

### Phase 3.1 health probe

```bash
curl http://localhost:3000/api/health | jq .checks.voice
# → { "status": "ok" }                       # ElevenLabs + Twilio both reachable
# → { "status": "not_configured" }           # any voice env var missing
# → { "status": "error", "detail": "..." }   # ElevenLabs or Twilio refused
```

Cached in-process for 60s (mirrors the Telegram subcheck) so `/health` scrape
loops don't burn ElevenLabs rate-limit budget.

### Cost guards

- **ElevenLabs Turbo:** $0.10/min — a 10-minute call = $1.
- **Twilio minutes:** ~$0.02/min outbound, ~$0.013/min inbound — negligible.
- **Hard cap:** the Agent body sent by `voice:setup` sets
  `conversation_config.conversation.max_duration_seconds = 600` (10 min);
  ElevenLabs hangs up automatically at the cap.
- **Demo budget:** ~$15 total (one-time ElevenLabs Starter $6 + one-time
  Twilio number $3 + ~$5 in minutes for UAT + demo dry run).

### Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| All `/webhook/voice/*` callbacks return 401 | HMAC signature header drift (Pitfall #5) | Inspect ngrok request inspector → confirm header name; update `signature.ts` if the SDK shipped a different casing. |
| Caller hears silence | Twilio TwiML not returning `<Dial><Sip>` | Confirm `voiceUrl` in Twilio Console = `<VOICE_PUBLIC_URL>/webhook/voice/twilio/twiml` (re-run `pnpm voice:setup`). |
| Tool callbacks time out | Tool handler >5s; Agent gives up | Check `voice.tool.latency_ms` in pino logs; `calc-price` should be <500ms (PostGIS hot), `extract-request` <1500ms (Anthropic call). |
| Audio recording missing | TwiML `record` attribute not set on `<Dial>` | Re-run `voice:setup`; the TwiML endpoint always emits `record='record-from-answer-dual'`. |
| `voice:setup` exits with `Twilio number ... not found` | Number not yet bought, or wrong account SID | Twilio Console → Phone Numbers → confirm the number is listed under the account whose SID you're using. |
| ElevenLabs returns 402/429 | Free-tier limit hit or Agent not on Starter | ElevenLabs Dashboard → upgrade to Starter $6/mo. |

### Pre-flight checklist (before demo)

```bash
[ ] pnpm --filter @ai-logist/api voice:setup        # exits 0
[ ] curl -s $VOICE_PUBLIC_URL/api/health | jq .checks.voice.status  # = "ok"
[ ] Test call from a real phone completes successfully
[ ] psql -c "SELECT audio_url, transcript, outcome FROM calls
             ORDER BY created_at DESC LIMIT 1;"      # all populated
[ ] ElevenLabs dashboard shows recent conversation
[ ] Twilio dashboard shows recent call with recording
```

## Admin Dashboard Dev Setup

The web admin (Next.js 16 + Zenith template) runs on port 3001 behind Caddy at `/`. It reads from the Fastify API at `/api/*`. Phase 4 ships 6 dashboard pages (default / analytics / chat / calls / orders / orders/[id]); kanban / fleet / calendar / tracking are deferred to v2 per the 2026-06-09 pivot.

1. **Install deps** — already done if you ran `pnpm install` at repo root.
2. **Generate an admin password hash:**

   ```bash
   pnpm --filter @ai-logist/web gen:admin-password
   # → prints ADMIN_PASSWORD_HASH=$2b$12$...
   # Copy the printed value into apps/web/.env.local
   ```

3. **Generate an auth cookie secret:**

   ```bash
   openssl rand -hex 32
   # Copy the output into AUTH_COOKIE_SECRET in apps/web/.env.local
   ```

4. **Set env vars** (in `apps/web/.env.local`):

   ```bash
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD_HASH=<output from step 2>
   AUTH_COOKIE_SECRET=<output from step 3>
   API_INTERNAL_URL=http://api:3000   # or http://localhost:3000 outside docker
   ```

5. **Start the dev server:**

   ```bash
   pnpm --filter @ai-logist/web dev
   # http://localhost:3001 → redirects to /auth/v1/login
   ```

6. **Log in** with `admin` + your password → lands on `/dashboard/default`.

7. **Reachable pages (v1):** `/dashboard/default`, `/dashboard/analytics`, `/dashboard/chat`, `/dashboard/calls`, `/dashboard/orders`, `/dashboard/orders/[id]`. NOT in v1: `/dashboard/kanban`, `/dashboard/fleet`, `/dashboard/calendar`, `/dashboard/tracking` (deferred to v2 per 2026-06-09 pivot).

**Details:** see `apps/web/README.md`.
**UAT protocol:** see `.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/HUMAN-UAT-05.md`.

### Pre-flight checklist

- [ ] `pnpm --filter @ai-logist/web build` exits 0
- [ ] `pnpm --filter @ai-logist/web exec tsc --noEmit` exits 0
- [ ] `pnpm exec biome check` exits 0
- [ ] Login form rejects bad password (401)
- [ ] Customize-panel language toggle flips RU↔UA on chat header

### Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Redirect loop on `/dashboard/*` | `AUTH_COOKIE_SECRET` empty or rotated | Re-generate + re-login |
| `/api/*` returns 502 | API container not up | `docker compose ps`, `docker compose logs api` |
| Recharts crashes on `/analytics` | Stale `analytics-app.tsx` cache | `rm -rf apps/web/.next` and retry |
| Russian shows as `??????` | Missing dictionary key | grep `lib/i18n/dict.ts` for missing entry |
| Border colors look wrong | Tailwind v4 default change (Pitfall #13) | Replace bare `border` with `border-border` |

## Demo Day Checklist (Phase 5)

Run 5 minutes before showing the demo to confirm green-light:

1. **Pre-flight check (`pnpm preflight`)** — 6 sequential fail-fast checks per CONTEXT D-34:
   - Telegram bot alive (`bot.api.getMe()` returns username)
   - Twilio number registered (lookup by E.164)
   - DB seeded (`COUNT(*) trucks WHERE status='available'` ≥ 10)
   - `/api/health` returns 200 + PostGIS 3.5.x
   - LLM provider key (Anthropic `messages.create` with `max_tokens: 1`)
   - E2E smoke (`POST /api/admin/simulate-call` for both `ru_happy_path` and `ua_happy_path` — both produce `orderId`)

   ```bash
   pnpm preflight                  # human-readable
   pnpm preflight -- --json        # machine-readable: {exitCode, results: [{name, status, duration_ms, error?}]}
   ```

   Exits 0 on all-pass; loud `✗` + exit 1 on first failure (sequential fail-fast).

2. **Provider failover (30-second swap)** — if Anthropic API has issues during demo:

   ```bash
   # 1. Edit .env.local — set LLM_PROVIDER=openai + OPENAI_API_KEY=sk-...
   # 2. Restart api:
   docker compose restart api
   # 3. Wait 5s; re-verify:
   curl -s localhost:3000/api/health | jq .checks
   ```

   Revert by setting `LLM_PROVIDER=anthropic` + restart. Both adapters wrap the same Zod schema, so behavior is byte-identical (snapshot tests prove it — see Plan 05-03).

3. **Fallback content (if Twilio/ElevenLabs unavailable):**
   - **"▶ Simulate inbound call"** button on `/dashboard/calls` — runs 5 canned voice scenarios through the live LLM pipeline (no external APIs needed):
     - `ru_happy_path` / `ua_happy_path` — order created
     - `injection_attempt` — Anti-Pitfall #1 verified (no 1-RUB order)
     - `ambiguous_clarification` — agent asks for more info
     - `abandon_mid_call` — graceful hangup
   - **"🎬 Видео-резерв"** button on `/dashboard/calls` — plays a pre-recorded real ElevenLabs call (MP4 + RU/UA captions). File: `apps/web/public/demo/voice-fallback.mp4` (≤15 MB hard cap).

4. **Full 8-step UAT protocol:** see `.planning/phases/05-demo-polish-notifications-final-i18n/HUMAN-UAT-06.md` (~25 min).

## Project layout

```
ai-logist/
├── apps/
│   ├── api/                 # Fastify backend (this phase)
│   │   ├── src/
│   │   │   ├── app.ts                  # buildApp() — plugins + zod + swagger + routes
│   │   │   ├── config.ts               # Zod-validated env (Node 22 --env-file)
│   │   │   ├── db.ts                   # Drizzle client factory
│   │   │   ├── plugins/{db,redis}.ts   # Fastify plugins
│   │   │   ├── routes/{health,leads,…}.ts  # /api/* and /webhook/* (health = real; rest = 501 stubs)
│   │   │   ├── persistence/
│   │   │   │   ├── schema/             # Drizzle tables (13 spec §2 tables + extensions)
│   │   │   │   └── repos/              # Thin per-aggregate CRUD
│   │   │   └── seed/                   # JSON fixtures + run.ts + smoke KNN
│   │   ├── drizzle/                    # Generated migrations
│   │   ├── tests/{unit,integration,smoke}/
│   │   └── package.json
│   │
│   └── web/                # Next.js 16 placeholder (Phase 4 forks Zenith Admin)
│
├── packages/
│   └── shared-types/       # Zod DTO schemas (consumed by api + web)
│       └── src/{api,domain}/
│
├── docker-compose.yml      # postgres + redis + api + web + caddy
├── docker-compose.prod.yml # production overlay (TLS via Caddy, restart=always)
├── Caddyfile               # /api,/webhook,/ws → api; else → web
├── tsconfig.base.json      # Strict TS 5.7, ESM, NodeNext
├── biome.json              # Lint + format
└── pnpm-workspace.yaml
```

## Scripts

```bash
# Root (delegates via pnpm --filter)
pnpm dev                     # Start API on :3000
pnpm dev:web                 # Start Next.js placeholder on :3001
pnpm build                   # Build all workspaces
pnpm tsc                     # Type-check all workspaces
pnpm lint                    # Biome check
pnpm lint:fix                # Biome auto-fix
pnpm test                    # Run all tests

pnpm db:generate             # Drizzle Kit: produce migration from schema diff
pnpm db:migrate              # Drizzle Kit: apply pending migrations
pnpm seed                    # Idempotent seed (cities + trucks + clients + pricing)

pnpm compose:up              # docker compose up -d postgres redis (infra only)
pnpm compose:full            # docker compose up -d (full stack incl. api + web + caddy)
pnpm compose:down            # docker compose down
```

Inside `apps/api/`:

```bash
pnpm test:unit               # Fast unit tests (no Docker)
pnpm test:integration        # Real PostGIS via Testcontainers (needs Docker)
pnpm test:smoke              # Full-stack smoke (needs Docker + Caddy up)
pnpm db:studio               # Drizzle Studio at :4983
```

## Phase 1 status — what's done

Spec coverage for Phase 1:

| Req | Description | Status |
|-----|-------------|--------|
| DB-01 | Postgres 17 + PostGIS 3.5 in docker-compose, CREATE EXTENSION in first migration | ✅ |
| DB-02..09 | 13 tables from spec §2 + demo-credibility extensions | ✅ |
| DB-10 | Seed: 12 trucks, ~30 cities (RU+UA pairs + 5 borders), 8 clients, pricing config | ✅ |
| API-01 | Fastify v5 + `/api/health` returning `PostGIS_Version()` | ✅ |
| API-02 | Drizzle migrations + thin per-aggregate repos | ✅ |
| API-16 | Schema-validated routes via Zod + `packages/shared-types` | ✅ |
| DEPLOY-01..04 | docker-compose, --env-file, pnpm workspaces, 10-min README | ✅ |

See `.planning/REQUIREMENTS.md` for the full mapping; `.planning/ROADMAP.md` for phase order.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `pnpm install` warns about missing pnpm-workspace.yaml | Ran inside `apps/api/` instead of root | Run from repo root |
| `pnpm db:migrate` fails with `type "geography" does not exist` | PostGIS extension migration didn't apply first | Verify `drizzle/0000_postgis_extension.sql` runs before `0001_init.sql` |
| `curl /api/health` returns 503 with `checks.postgis: 'fail'` | PostGIS not loaded — DB exists but `CREATE EXTENSION` failed | `docker exec ailogist-postgres psql -U ailogist -d ailogist -c 'CREATE EXTENSION IF NOT EXISTS postgis;'` |
| `curl /api/health` returns 503 with `checks.redis: 'fail'` | Redis container not running | `docker compose up -d redis` |
| `Fastify` warns about Zod v3 vs v4 mismatch | Wrong zod import path | Use `import { z } from 'zod/v4'` everywhere |
| `docker compose up` says image not found | First-time pull, takes ~60s | Wait + retry |
| API serves but Caddy returns 404 for /api/health | Used `handle_path` instead of `handle` in Caddyfile (strips prefix) | Use `handle /api/*` per the documented Caddyfile |
| `pnpm seed` fails with "duplicate key" | Re-running without `.onConflictDoNothing()` | Should not happen — file a bug if it does |
| Port 5432 already in use | Local Postgres running outside Docker | `brew services stop postgresql` or change host port in `docker-compose.yml` |

## Roadmap

Phase 1 (this) → Phase 2 (LLM pipeline + deterministic core) → Phase 3 (Telegram) → Phase 4 (Admin web) → Phase 5 (Tracking + public link) → Phase 6 (Polish + i18n).

See `.planning/ROADMAP.md`.

## License

Private — demo for buyer evaluation.
