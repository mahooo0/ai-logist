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
