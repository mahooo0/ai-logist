<!-- GSD:project-start source:PROJECT.md -->
## Project

**AI-Логист**

Бэкенд-оркестратор + веб-админка для логистической компании, который принимает обращения клиентов через Telegram-бот и голосовые звонки, автоматически распознаёт заявку, подбирает ближайшую свободную машину из собственного парка (или с биржи как fallback), рассчитывает цену, проводит лида по воронке продаж и создаёт заказ с живым GPS-трекингом до выгрузки. Менеджер видит всё в админке: диалоги, воронку Kanban, парк, заказы, живую карту перевозок, KPI.

**Core Value:** **Диалог ведёт LLM, но решения по деньгам и подбору принимает детерминированный код** — цена и подбор машины должны быть предсказуемыми, тестируемыми, воспроизводимыми. Если этот принцип нарушен — система теряет доверие бизнеса.

### Constraints

- **Tech stack — бэкенд**: PostgreSQL 15+ с расширением PostGIS (KNN-запросы по точкам, GiST-индексы), Redis для кэша/состояния FSM (опц.). Язык/фреймворк бэкенда не зафиксирован спекой — будет выбран на этапе research (вероятно Node.js/TypeScript для единства со фронтом, либо Python для удобства LLM-интеграций).
- **Tech stack — фронт**: жёстко зафиксирован спекой §7.1 — Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Zustand, react-hook-form + zod, sonner, lucide-react, libphonenumber-js, date-fns, @dnd-kit, pnpm. Lint — Biome.
- **Шаблон админки**: mahooo0/next-shadcn-admin-dashboard, MIT-лицензия. Не ломаем существующие экраны, добавляем новые по конвенции из его CLAUDE.md (§7.3).
- **Двуязычие**: интерфейс админки + диалоги бота должны работать на RU и UA. Автоопределение языка клиента из текста.
- **Демо-срок**: реалистично собрать в 1-2 недели с упором на §9 спеки. Реальные интеграции (голос, биржи, Wialon) откладываются.
- **LLM**: используется Claude или GPT-4o с function calling. Промпт принуждает строгий JSON — нераспознанные поля = null.
- **Геоданные**: PostGIS обязателен для запроса «ближайшая свободная машина» (KNN `<->` оператор).
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## TL;DR — The Decision
## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Node.js** | 22.x LTS | Backend runtime | LTS until Apr 2027. Fastify v5 requires Node ≥ 20; 22 is "safest production choice in 2026" per Hono/Fastify docs. |
| **TypeScript** | 5.7+ | Language | Shared with frontend; Zod-first inference works only on recent TS. Strict mode mandatory. |
| **Fastify** | 5.8.5+ | HTTP framework | Schema-based JSON validation matches the spec's "strict JSON or null" contract for `extractRequest`. Fastest mainstream Node framework (~62k req/s), built-in webhook ergonomics, mature `@fastify/websocket` for `/ws/tracking` + `/ws/inbox`. Lighter than NestJS — we don't need DI for a 2-week demo. |
| **PostgreSQL** | 17.x | Primary database | Released May 2026, ~2× faster bulk COPY (matters for sidecar seeding §9.1), incremental backups, JSON_TABLE. Spec §2 mandates Postgres + PostGIS. |
| **PostGIS** | 3.5.x | Spatial extension | Spec §4.2 mandates `<->` KNN operator on `geography(Point)` columns with GiST index. PostGIS 3.5 is current stable, compatible with PG 14–18. KNN avg query time <1ms on 64-thread benchmark. |
| **Redis** | 7.4+ | Cache + FSM state + job broker | FSM state for funnel/voice (§4.4, §5.2), geocoding cache, `bourse_cache` TTL (§4.6), BullMQ broker. |
| **Drizzle ORM** | 0.45.2 (stable) or 1.0.0-beta | Postgres ORM + schema | **Has official PostGIS guide** (`geometry('point', { type: 'point', srid: 4326 })`, `index('spatial_idx').using('gist', t.location)`, `<->` raw SQL). Code-first, ~7KB runtime, no separate schema language. Generates migrations via `drizzle-kit`. Recommend pinning 0.45.2 for stability; revisit 1.0 when GA. |
| **grammY** | 1.43.x | Telegram bot framework | TS-native, webhook-first, modern. Per official comparison: "rethinks a type-safe bot framework with approachability first." Compatible with Cloudflare Workers if we ever go edge. |
| **@anthropic-ai/sdk** | 0.102.x | LLM client | Default Claude per project. Ships `betaZodTool` + `toolRunner` for the §4.1 `extractRequest` flow — Zod schema in, typed object out, automatic tool-call loop. Falls back cleanly to GPT-4o via the OpenAI SDK if needed. |
| **BullMQ** | 5.x | Job queue + scheduling | TypeScript-first Bull successor. Redis Streams under the hood, repeatable jobs perfect for the §4.7 every-N-minutes tracking loop, parent-child flows for multi-step order events. |
### Supporting Libraries (Backend)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | 3.23+ | Schema validation | LLM output validation (§4.1), REST request bodies, env var parsing. Shared with frontend. |
| `ioredis` | 5.11.x | Redis client | Required by BullMQ. Cluster/Sentinel support, battle-tested. Prefer over node-redis here because BullMQ depends on it. |
| `drizzle-kit` | 0.30+ | Migrations | Companion to drizzle-orm. `drizzle-kit generate` + `drizzle-kit migrate`. |
| `@fastify/websocket` | 11.x | WebSocket transport | `/ws/tracking` + `/ws/inbox` per §6. Native `ws` under the hood, integrates with Fastify lifecycle (hooks, decorators). |
| `pino` | 9.x | Structured logging | Fastify's default; JSON logs out of the box, fast. |
| `pino-pretty` | 11.x | Dev log formatting | Devtime only. |
| `dotenv` / native `--env-file` | — | Env loading | Use Node 22's built-in `--env-file=.env`. No dotenv dep needed. |
| `dayjs` or native `Intl` | — | Date math | `date-fns` if matching frontend; otherwise dayjs (2KB). Spec doesn't mandate. |
| `@grammyjs/conversations` | 2.x | Conversation FSM | Optional — useful if dialog state outgrows simple Redis hash. For demo, keep state in Redis directly. |
| `undici` | — | HTTP client | Built into Node 22. Use for OSRM / Nominatim / ATI.SU calls. No `axios`/`got` needed. |
| `nanoid` | 5.x | Short IDs | Order number generation (`#KU-4471` style — wrap nanoid in a custom alphabet). |
### Frontend Stack (locked by spec §7.1 — confirmed versions)
| Library | Version | Confirmed Current |
|---------|---------|-------------------|
| Next.js | 16.x (App Router, Turbopack) | Locked by template |
| React | 19.x | Locked by template |
| TypeScript | 5.7+ strict | Locked |
| Tailwind CSS | v4.x | Locked |
| shadcn/ui | latest | Locked |
| Zustand | 5.x | Locked |
| react-hook-form | 7.x | Locked |
| zod | 3.23+ | **Shared with backend** |
| sonner | 1.x | Locked |
| lucide-react | latest | Locked |
| libphonenumber-js | 1.x | Locked (driver phone validation on `/fleet`) |
| date-fns | 4.x | Locked |
| @dnd-kit/core | 6.x | Locked (Kanban §7.2) |
| pnpm | 9.x | Locked |
| Biome | 1.9+ | Locked (lint + format) |
| Library | Purpose |
|---------|---------|
| `leaflet` + `react-leaflet` | `/dashboard/tracking` map, OSM tiles (free). Spec §7 mentions Leaflet. |
| `@types/leaflet` | TS types |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| **pnpm workspaces** | Monorepo glue | Single repo: `apps/backend`, `apps/admin`, `packages/shared` (Zod schemas, types). |
| **Docker + Docker Compose** | Local dev + demo deploy | `postgis/postgis:17-3.5`, `redis:7-alpine`, backend, admin, optional `osrm/osrm-backend`, optional `nominatim`. |
| **Caddy 2** | Reverse proxy + auto HTTPS | For demo: simpler than Traefik (~2-line config, ~30MB RAM, Let's Encrypt automatic). Switch to Traefik only if we need dynamic service discovery. |
| **Biome** | Lint + format | Already used by admin template; reuse config in backend. Replaces ESLint + Prettier. |
| **tsx** | Dev runner | `tsx watch src/index.ts`. No build step needed in dev. |
| **vitest** | Unit + integration tests | Deterministic-code coverage on `calcPrice` (§4.3), FSM transitions (§4.4/§4.5), KNN matcher (§4.2). Vitest is the de facto Node test runner in 2026. |
| **testcontainers** | DB integration tests | Spin up real PostGIS in CI for KNN tests — no mocking spatial SQL. |
## Installation
# Backend (apps/backend)
# Frontend additions (apps/admin)
# Shared package (packages/shared)
## Free-Tier Path (Demo — Zero $$ Blockers)
| Subsystem | Free Path | Upgrade Path |
|-----------|-----------|--------------|
| **LLM** | Anthropic API (pay-per-token, ~$3/M input on Sonnet) — only real $ cost in demo, ~$5–20 budget should cover the demo run | — |
| **Geocoding** | **OSM Nominatim public API** (1 req/sec limit) for the demo — cache aggressively in `cities` table per §2 | Self-host `mediagis/nominatim` Docker (60GB disk, 2GB RAM) → 191 req/s on a laptop. Or paid HERE/Mapbox. |
| **Routing (route_km, ETA)** | **OSRM public demo server** `router.project-osrm.org` (fair-use, fine for demo) | Self-host `osrm/osrm-backend` Docker (~5× region OSM file size in RAM) |
| **Map tiles** | OSM tile servers via Leaflet (attribution required) | Mapbox / MapTiler for production volume |
| **Telegram** | Telegram Bot API — free, no quota matters for demo | — |
| **GPS** | Spec §9 says "приложение водителя/симуляция" — `POST /webhook/gps` with simulated coords | Wialon Open API (paid) when needed |
| **Bourse (ATI/Lardi)** | Spec §9 says stub `bourse_cache` — return mock JSON | Real API keys (paid) post-demo |
| **Hosting** | Docker Compose on a $6/mo Hetzner CX22 or $5/mo DigitalOcean droplet | Same shape scales horizontally; or move backend to Fly.io/Railway |
| **HTTPS** | Caddy + Let's Encrypt — free, automatic | — |
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **Node.js + TypeScript** | Python 3.12 + FastAPI + aiogram + SQLAlchemy 2.0 + GeoAlchemy2 + Anthropic Python SDK | Team is Python-native, or voice channel via ElevenLabs ships before text and you want the richer Python audio/ML ecosystem from day one. FastAPI is just as fast (ASGI/Starlette), aiogram is the gold standard for Telegram in Python, GeoAlchemy2 covers PostGIS. **Decision is close — choose Python only if the team is more comfortable there.** |
| **Fastify** | NestJS | Team > 8 backend devs, long-lived enterprise codebase needing DI/decorators. Overkill for a 2-week demo. |
| **Fastify** | Hono | Deploying to Cloudflare Workers / edge. We're on a long-running Node server with WebSockets — Fastify is the better fit. |
| **Fastify** | Express | Never for new code in 2026 — Fastify is strictly faster, has built-in schema validation, and has a healthier plugin ecosystem. |
| **Drizzle** | Prisma 7 | Want schema-first DSL, team allergic to writing SQL. Prisma 7 (late 2025) dropped the Rust engine for pure TS/WASM (1.6MB gzipped), so the historical "Prisma is heavy" complaint is gone. **But Prisma's PostGIS story is weaker** — you end up with `$queryRaw` for KNN anyway. Drizzle's `geometry()` column + `<->` raw SQL is more honest. |
| **BullMQ** | pg-boss | You want to avoid Redis entirely and your job rate is <100/s. For our tracking loop (1 truck = 1 job every N min), pg-boss would actually work. **But we already need Redis for FSM state + cache**, so BullMQ adds zero new infra and gives us rate limiting + repeatable jobs for free. |
| **BullMQ** | node-cron / `setInterval` | Single-instance, no retries needed, no persistence required. For the demo MVP this is honestly fine — start with `setInterval` for the tracking loop and add BullMQ when reliability becomes critical. |
| **grammY** | Telegraf | Mature middleware ecosystem you depend on. For greenfield TS, grammY is more pleasant. |
| **ioredis** | node-redis 4+ | Greenfield projects without BullMQ. Since we use BullMQ (which depends on ioredis), pick ioredis to avoid two Redis clients in node_modules. |
| **OSM/Nominatim + OSRM** | Mapbox / HERE | Production scale (>1 req/s sustained on geocode, fleet-grade routing matrix). For demo, free OSM stack is perfect. |
| **Leaflet** | Mapbox GL JS | Need vector tiles, 3D, heavy styling. Leaflet is lighter, works with free OSM tiles, spec mentions it explicitly. |
| **Caddy** | Traefik | Many dynamic Docker services (>10), Kubernetes ingress. For 3 services and Compose, Caddy is simpler. |
| **Vitest** | Jest | Need Jest's snapshot ecosystem. Vitest is faster and ESM-native — preferred in 2026 for new Node projects. |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Express.js** | Slow vs Fastify, no built-in schema validation, ecosystem stagnant in 2026 | Fastify |
| **Bull (v3, legacy)** | In maintenance mode — author moved to BullMQ | BullMQ |
| **node-telegram-bot-api** | No TypeScript support, "fails horribly at scalability beyond 50 LOC" per grammY comparison | grammY |
| **Sequelize** | Slow, weak TS, no PostGIS guide | Drizzle |
| **TypeORM** | Decorator-heavy, weak PostGIS support, maintenance issues throughout 2024–2025 | Drizzle |
| **Prisma <7** | Old Rust engine bloat, no real PostGIS support | Drizzle (or Prisma 7 if you must) |
| **Socket.IO** for /ws/tracking | Heavy, opinionated, custom protocol — overkill for one-way GPS push from server | Native `@fastify/websocket` (raw `ws`). Use Socket.IO only if you need namespaces/rooms with reconnect logic for inbox. |
| **node-cron** for tracking loop | No retries, no observability, dies with the process | BullMQ repeatable jobs (or `setInterval` in MVP) |
| **MongoDB / DynamoDB** | No spatial KNN with GiST. Spec mandates PostGIS. | PostgreSQL + PostGIS |
| **Google Maps API for routing** | Per-request billing escalates fast for fleet routing | OSRM self-hosted or Mapbox |
| **dotenv** | Node 22 has native `--env-file=.env` | `node --env-file=.env dist/index.js` |
| **axios / got** | Bundle bloat, third-party deps | Native `fetch` (or `undici` directly) |
## Stack Patterns by Variant
- Replace Fastify → **FastAPI 0.115+** (ASGI, Pydantic v2)
- Replace Drizzle → **SQLAlchemy 2.0 + GeoAlchemy2 0.15+** + **Alembic** for migrations
- Replace grammY → **aiogram 3.13+** (async, webhook via FastAPI)
- Replace `@anthropic-ai/sdk` → **`anthropic` Python SDK 0.39+** (has Pydantic tool helper)
- Replace BullMQ → **Celery 5.4 + Redis** OR **APScheduler 3.10** (simpler for the §4.7 loop) OR **arq 0.26** (asyncio-native, lighter than Celery)
- Keep PostgreSQL 17 + PostGIS 3.5 + Redis 7 + OSM stack — identical
- Voice path becomes slightly easier: ElevenLabs Python SDK + `twilio` lib are well-trodden
- Trade-off: lose shared Zod schemas with frontend; gain Python's audio/ML ecosystem
- Move backend to multiple instances behind a load balancer; FSM state in Redis already supports this
- Replace public Nominatim / OSRM with self-hosted Docker containers
- Add `pg_partman` for partitioning `order_events` and `messages` by month
- Replace Anthropic-only with multi-provider (Claude + GPT-4o fallback) via a thin adapter
- Add OpenTelemetry → Grafana Tempo/Loki
- Add **ElevenLabs Agents SDK** (`@elevenlabs/elevenlabs-js` 1.x)
- Add **Twilio Node SDK** or **Telnyx Node SDK** for SIP trunk
- Reuse the **same** tool definitions from the Telegram pipeline — function-calling tools are channel-agnostic per spec §5.2
## Version Compatibility
| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Fastify 5.x | Node ≥ 20 (22 LTS recommended) | v5 drops Node 18 support |
| Drizzle 0.45.2 | Postgres 12–18 | PostGIS via `geometry()` column type |
| Drizzle 1.0.0-beta | Same | `getColumns` helper requires 1.0.0-beta.2+; otherwise use `getTableColumns` |
| PostGIS 3.5 | Postgres 14–18 | Tested combo: PG 17 + PostGIS 3.5 (image `postgis/postgis:17-3.5`) |
| BullMQ 5.x | Redis ≥ 6.2 (Streams) | ioredis 5.x required as Redis client |
| grammY 1.43.x | Node ≥ 18 | Webhook support out of the box |
| @anthropic-ai/sdk 0.102 | Node ≥ 20, TS ≥ 4.9 | `betaZodTool` requires `zod` ≥ 3.x peer |
| `@fastify/websocket` 11.x | Fastify 5.x | Built on `ws` library |
| Next.js 16 | Node ≥ 20 | React 19 required |
- Drizzle is mid-migration to 1.0; pin a specific version (`0.45.2` or `1.0.0-beta.X`) and don't `^` it.
- BullMQ + ioredis: use `maxRetriesPerRequest: null` for connections passed to BullMQ workers (BullMQ requirement; ioredis default will throw).
- Fastify v5 logging defaults changed; explicitly configure `pino` log levels per env.
- PostGIS column type in Drizzle defaults to `srid: 4326` (WGS84) — match spec assumption of lat/lng.
## Sources
- [Drizzle ORM — PostGIS geometry point guide](https://orm.drizzle.team/docs/guides/postgis-geometry-point) — official `geometry()` column, GiST index, `<->` KNN
- [Anthropic SDK TypeScript — helpers.md](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/helpers.md) — `betaZodTool` + `toolRunner`
- [Anthropic SDK TypeScript — tools-helpers-zod example](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/examples/tools-helpers-zod.ts)
- [Fastify v5 release notes / migration guide](https://fastify.dev/docs/latest/Guides/Migration-Guide-V5/) — Node 20+ requirement, current 5.8.5
- [grammY official site + GitHub](https://github.com/grammyjs/grammy) — 1.43.x, TS-native
- [grammY framework comparison](https://grammy.dev/resources/comparison) — vs Telegraf, vs node-telegram-bot-api
- [BullMQ docs](https://docs.bullmq.io/) — repeatable jobs, flows, TS-first
- [PostGIS 3.5 manual](https://postgis.net/docs/manual-3.5/postgis-en.html) — KNN via `<->`, GiST
- [PostgreSQL 17 release notes](https://www.postgresql.org/docs/release/17.0/) — May 2026
- [PostgreSQL — GiST Indexes](https://www.postgresql.org/docs/current/gist.html)
- [postgis/postgis:17-3.5 Docker image](https://hub.docker.com/r/postgis/postgis/)
- [@hono/node-ws](https://www.npmjs.com/package/@hono/node-ws) — alternative if we ever swap framework
- [OSRM backend GitHub](https://github.com/Project-OSRM/osrm-backend) — services, Docker
- [Nominatim](https://nominatim.org/) + [usage policy](https://operations.osmfoundation.org/policies/nominatim/) — 1 req/s public limit
- [NestJS vs Fastify vs Hono 2026 (Encore)](https://encore.dev/articles/nestjs-vs-fastify-vs-hono) — recommends Fastify default for new APIs
- [Best Node.js frameworks 2026 (HireNodeJS)](https://www.hirenodejs.com/blog/nodejs-frameworks-compared-2026)
- [Drizzle vs Prisma 2026 (Bytebase)](https://www.bytebase.com/blog/drizzle-vs-prisma/)
- [Drizzle vs Prisma 2026 (MakerKit)](https://makerkit.dev/blog/tutorials/drizzle-vs-prisma)
- [BullMQ vs Bee-Queue vs pg-boss 2026 (PkgPulse)](https://www.pkgpulse.com/guides/bullmq-vs-bee-queue-vs-pg-boss-job-queues-nodejs-2026)
- [Background job processing Node.js 2026 (DEV)](https://dev.to/young_gao/background-job-processing-in-nodejs-bullmq-queues-and-worker-patterns-31d4)
- [Caddy vs Traefik vs Nginx Proxy Manager 2026 (PkgPulse)](https://www.pkgpulse.com/guides/caddy-vs-traefik-vs-nginx-proxy-manager-reverse-proxies-2026)
- [OSRM logistics architecture (ayedo)](https://ayedo.de/en/posts/osrm-die-referenz-architektur-fur-blitzschnelles-routing-logistik-ohne-api-kosten/)
- [ioredis vs node-redis 2026 (PkgPulse)](https://www.pkgpulse.com/guides/ioredis-vs-node-redis-vs-upstash-redis-clients-2026)
- [Fastify WebSocket plugin](https://www.npmjs.com/package/@fastify/websocket)
- [FastAPI deployment guide 2026 (Zestminds)](https://www.zestminds.com/blog/fastapi-deployment-guide/)
- [aiogram on PyPI](https://pypi.org/project/aiogram/)
- [aiogram-fastapi-server](https://pypi.org/project/aiogram-fastapi-server/)
## Confidence Assessment per Decision
| Decision | Confidence | Why |
|----------|------------|-----|
| Node.js over Python | HIGH | Frontend lock + shared Zod + Drizzle PostGIS guide + Anthropic Zod helper converge unambiguously. Only counter is team preference. |
| Fastify over NestJS/Hono/Express | HIGH | 2026 framework comparisons consistently recommend Fastify for greenfield APIs of this shape. |
| PostgreSQL 17 + PostGIS 3.5 | HIGH | Official `postgis/postgis:17-3.5` Docker tag exists and is current. |
| Drizzle over Prisma | HIGH | Official Drizzle PostGIS guide is the deciding evidence — Prisma forces `$queryRaw` for KNN. |
| BullMQ over alternatives | HIGH | TS-first, Redis already in stack, BullMQ author maintains both Bull and BullMQ; pg-boss only wins if we wanted to drop Redis. |
| grammY over Telegraf/NTBA | MEDIUM-HIGH | Telegraf is also fine; grammY has better TS DX. Either works. |
| Anthropic SDK default (Claude) | HIGH | Project owner uses Claude; Sonnet 4 / Opus 4.x with `betaZodTool` is the path of least resistance. Keep an `LLM_PROVIDER` env to swap in GPT-4o via OpenAI SDK if needed. |
| OSM/Nominatim/OSRM for demo | HIGH | Free, well-documented, demo budget = $0. Upgrade path to Mapbox/HERE is clear. |
| Leaflet over Mapbox GL on frontend | HIGH | Spec mentions Leaflet; free OSM tiles; lighter bundle. |
| `@fastify/websocket` over Socket.IO | MEDIUM-HIGH | Native is simpler for server→client GPS push. Socket.IO only justified if reconnect/rooms become complex. |
| Caddy over Traefik for demo | MEDIUM | Both work. Caddy is simpler at 3 services; Traefik wins at scale. |
| Vitest over Jest | MEDIUM-HIGH | Vitest is the new default in 2026; Jest still acceptable. |
| pnpm workspaces monorepo | HIGH | Frontend template already uses pnpm; one repo = shared Zod = less cognitive overhead. |
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
