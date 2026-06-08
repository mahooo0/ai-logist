# Phase 1: Database + Backend Skeleton — Research

**Researched:** 2026-06-08
**Domain:** PostgreSQL 17 + PostGIS 3.5 schema design via Drizzle ORM 0.45.2; Fastify 5 monorepo skeleton; docker-compose + Caddy deployment surface
**Confidence:** HIGH on Drizzle PostGIS custom type, Fastify v5 plugin layout, drizzle-kit custom migration, docker-compose topology, Caddyfile routing. MEDIUM on exact CTE re-rank SQL (Crunchy article doesn't ship that exact form — pattern reconstructed from PostGIS docs + PITFALLS.md).

## Summary

Phase 1 is the foundation layer for AI-Логист — every downstream phase depends on its correctness. The stack is fully locked by CONTEXT.md and STACK.md (Node 22 + Fastify 5.8 + Drizzle 0.45.2 + Postgres 17 + PostGIS 3.5), so the research focus is **the exact syntax and patterns** the planner must drop into tasks verbatim. No alternatives to explore.

The single critical research finding: **Drizzle 0.45.2 ships a `geometry()` helper but no `geography()` helper.** Since CONTEXT.md D-02 mandates `geography(Point, 4326)` for every geo column (spec §2 + Pitfall #3 of PITFALLS.md), Phase 1 must define a project-local `geography` customType wrapper. This wrapper is small (~25 lines) but must be in place before any geo table is declared in `schema.ts`. Planner: make this a Wave 0 task.

Other patterns are standard but require precise syntax: `drizzle-kit generate --custom --name=postgis_extension` for the first SQL-only migration; `fastify-type-provider-zod` 6.1 + `@fastify/swagger` 9.7 + `@fastify/swagger-ui` 5.2 for the 501-stub OpenAPI surface; Caddy `handle /api/*` (NOT `handle_path` — that strips the prefix) for routing the four backend path families; `db.execute(sql\`…\`)` for the PostGIS-heavy KNN that Phase 2 will implement.

**Primary recommendation:** Plan four parallel waves — (1) repo + pnpm workspaces + docker-compose + Caddy + env, (2) Drizzle schema + customType `geography` + ENUMs + first migration with `CREATE EXTENSION postgis`, (3) Fastify skeleton + Zod env + Pino + Swagger UI + `/api/health` + 501-stubs for every API-* endpoint, (4) seed script + smoke KNN print + README. Waves 2 and 3 depend on Wave 1's repo; Wave 4 depends on Waves 2 + 3.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Migrations & Schema Management:**
- **D-01:** Миграции через **Drizzle Kit** (`drizzle-kit generate` → `drizzle-kit migrate`). Первая миграция — `0000_postgis_extension.sql` с одним statement: `CREATE EXTENSION IF NOT EXISTS postgis;`. Все таблицы создаются в последующих миграциях, чтобы расширение гарантированно загружено до использования geo-типов.
- **D-02:** Все геометрические колонки — `geography(Point, 4326)`. Никаких `geometry` — спека §2 явно требует `geography`, плюс PITFALL #2 (sphere vs spheroid). Добавить CHECK-constraint `ST_SRID(geom) = 4326` на каждую geo-колонку.
- **D-03:** GiST-индексы на `trucks.geom`, `cities.geom`, `truck_positions.geom`, `order_events.geom` (где есть). Никаких BRIN — оператор `<->` требует GiST.
- **D-04:** Schema-расширения сверх спеки §2 (demo-credibility gaps):
  - `clients.tax_id`, `clients.tax_id_country` (TEXT) — EDRPOU/ИНН
  - `leads.volume_m3`, `leads.dimensions_lxwxh` (TEXT в формате `LxWxH`), `leads.packaging`, `leads.adr_class`, `leads.declared_value` — расширенный груз
  - `leads.price_overrides jsonb[]` — audit log изменений цены
  - `orders.public_token` (TEXT UNIQUE) — для публичной страницы `/track/[token]`
  - `pod_artifacts` (отдельная таблица: id, order_id, signature_url, photo_url, gps, captured_at)
  - `webhook_updates` (id, source ENUM, external_id TEXT UNIQUE, payload jsonb, received_at) — для идемпотентности Telegram по `update_id` (`ON CONFLICT (external_id) DO NOTHING`)
  - `truck_positions` (truck_id, geom, recorded_at, UNIQUE(truck_id, recorded_at)) — история позиций для трекинга
- **D-05:** Финансы хранятся как `bigint` (копейки/копійки), не `numeric`. Округление до 50 происходит на уровне функции `calcPrice` в Phase 2.
- **D-06:** Enum'ы лида и заказа определены в БД как PostgreSQL ENUM-типы (`lead_stage`, `order_status`, `order_event_type`, `body_type_t`, `truck_status`, `client_lang`).

**Repository / Data Access:**
- **D-07:** Тонкие репозитории по агрегатам (`apps/api/src/persistence/repos/{trucks,leads,orders,clients,cities,messages,calls}.ts`).
- **D-08:** Для PostGIS-тяжёлых запросов — **hand-written SQL через `db.execute(sql\`…\`)`**.
- **D-09:** Транзакции вызываются явно через `db.transaction(async (tx) => …)`.

**Monorepo & Tooling:**
- **D-10:** Чистые **pnpm workspaces**. `apps/api`, `apps/web`, `packages/shared-types`.
- **D-11:** TypeScript 5.7, `strict: true`, ESM везде (`"type": "module"`).
- **D-12:** Biome для линта и форматирования.
- **D-13:** Node.js 22 LTS. ENV через нативный `--env-file=.env.local`.

**Env & Config:**
- **D-14:** Конфиг валидируется Zod-схемой при старте Fastify. При невалидных переменных — лог + `process.exit(1)`.
- **D-15:** Минимальный env для Phase 1: `NODE_ENV`, `PORT`, `DATABASE_URL`, `REDIS_URL`, `LOG_LEVEL`. LLM/Telegram — `.optional()`.

**Health & Logs:**
- **D-16:** `GET /api/health` → JSON со `status`, `version` (git short sha), `uptime_s`, `checks.db`, `checks.postgis` (версия), `checks.redis`. При сбое — 503.
- **D-17:** Структурированные логи через Fastify's pino. `LOG_LEVEL=info` в проде, `debug` локально.

**Seed Data:**
- **D-18:** Сидинг — TypeScript-скрипт `apps/api/src/seed/run.ts`, запускается через `pnpm seed`.
- **D-19:** Объём: ~30 RU/UA городов + 5+ погранпереходов, 12 машин (tent×5, ref×3, iso×2, container×2), 8 клиентов (4 RU + 4 UA), pricing config (`rate_per_km=42 ₽/км` в копейках, `dir_coef`, `season_coef=1.1`).
- **D-20:** Сидинг идемпотентен — `ON CONFLICT DO NOTHING`.
- **D-21:** В seed-выводе печатается canonical KNN smoke-query от Киева → 3 ближайшие машины.

**Docker Compose:**
- **D-22:** Сервисы: `postgres` (`postgis/postgis:17-3.5`), `redis` (`redis:7-alpine`), `api` (Fastify), `web` (Next.js плейсхолдер), `caddy` (`caddy:2-alpine`). Caddy маппит 80/443 → api для `/api/*`, `/webhook/*`, `/ws/*`; всё остальное → web.
- **D-23:** `.env.example` в корне. README: `cp .env.example .env.local` → `docker compose up -d postgres redis` → `pnpm install && pnpm db:migrate && pnpm seed` → `pnpm dev`.
- **D-24:** Caddy: `:80` локально без TLS, `:443` с auto-ACME на проде.

**REST Skeleton:**
- **D-25:** В Phase 1 реализуется только `GET /api/health`. Все остальные API-* — заглушки `501 Not Implemented` с Zod-схемами в OpenAPI.
- **D-26:** OpenAPI через `@fastify/swagger` + `@fastify/swagger-ui` на `/api/docs`.
- **D-27:** Zod DTO живут в `packages/shared-types`, импортируются в `apps/api` и `apps/web`.

### Claude's Discretion

- Конкретная структура Drizzle-моделей (одна большая `schema.ts` vs разбивка по доменам).
- Имя и формат seed-файлов (JSON-фикстура vs хардкод в TS).
- Структура Fastify-плагинов (autoload vs явная регистрация).
- Конкретный pino-формат логов (json vs pretty в dev).

### Deferred Ideas (OUT OF SCOPE)

- Real auth на `/api/health` — Phase 6 (POLISH-05).
- CI pipeline (GitHub Actions) — Phase 6.
- Observability (OpenTelemetry) — v2 PROD-06.
- Backup стратегия для Postgres-volume — v2.
- Database seed для разных сценариев демо — Phase 6.
- Helm-чарт для Kubernetes — v2.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DB-01 | Postgres 17 + PostGIS 3.5 в docker-compose, `CREATE EXTENSION postgis` в первой миграции | `postgis/postgis:17-3.5` image confirmed; Drizzle Kit `--custom` migration pattern documented below |
| DB-02 | `clients` со `lang ('ru'\|'ua')`, `tax_id`, `tax_id_country` | PostgreSQL ENUM via `pgEnum`; TEXT columns straightforward |
| DB-03 | `cities` с `name_ru`/`name_ua` + `geom geography(Point,4326)` | Requires customType `geography` wrapper (see Code Examples); `unique(slug)` for ON CONFLICT |
| DB-04 | `trucks` с `geom geography(Point,4326)`, `capacity_t`, `body_type`, `status`, GiST на `geom` | customType + `index().using('gist', t.geom)` documented |
| DB-05 | `leads` с расширенными полями груза + `price_overrides jsonb[]` | `jsonb('price_overrides').array()` syntax in Drizzle |
| DB-06 | `orders` + `order_events` с `UNIQUE (order_id, type)` | `uniqueIndex().on(t.orderId, t.type)` |
| DB-07 | `calls`, `messages`, `bourse_cache` | Standard tables; `bourse_cache.query_hash` UNIQUE |
| DB-08 | `pod_artifacts` (signature_url, photo_url, gps, captured_at) | gps as `geography(Point, 4326)` via same customType |
| DB-09 | `webhook_updates` со `update_id` UNIQUE + `ON CONFLICT DO NOTHING` | `unique('webhook_updates_external_id_unq').on(t.externalId)` + `.onConflictDoNothing()` |
| DB-10 | Seed: 12 машин, ~30 городов, 8 клиентов, pricing config | TypeScript seed via repos, idempotent via `.onConflictDoNothing()`; canonical KNN print at end |
| API-01 | Fastify v5 + TS 5.7 strict, `/api/health` с `PostGIS_Version()` | Pattern documented; raw SQL via `db.execute(sql\`SELECT PostGIS_Version()\`)` |
| API-02 | Drizzle ORM миграции + репо для всех таблиц §2 | Thin repo pattern per CONTEXT D-07 |
| API-16 | Schema-validated routes с Zod, общая `packages/shared-types` | `fastify-type-provider-zod` 6.1 + workspace dependency on `@ai-logist/shared-types` |
| DEPLOY-01 | docker-compose: api, web, postgres+postgis, redis, caddy | Full compose example below |
| DEPLOY-02 | ENV через `.env` + Node 22 `--env-file` | `node --env-file=.env.local dist/index.js`; no `dotenv` dep |
| DEPLOY-03 | pnpm workspaces монорепо | `pnpm-workspace.yaml` + root `package.json` scripts |
| DEPLOY-04 | README с 10-минутным стартом локально и на VPS | Concrete README skeleton documented |
</phase_requirements>

## Standard Stack

### Core (versions verified via `npm view <pkg> version` on 2026-06-08)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fastify` | 5.8.5 | HTTP framework | Locked by STACK.md; native pino logger; schema-first |
| `drizzle-orm` | 0.45.2 | ORM | Locked by STACK.md (do NOT use `^` — pin exact) |
| `drizzle-kit` | 0.31.10 | Migrations CLI | Companion to drizzle-orm; supports `--custom` for SQL-only migrations |
| `pg` | 8.21.0 | Postgres driver | node-postgres; Drizzle's primary supported driver for Node |
| `zod` | 4.4.3 | Schema validation | Locked by STACK.md; powers env validation + DTO + OpenAPI generation |
| `pino` | 10.3.1 | Structured logging | Default Fastify logger; JSON out of the box |
| `pino-pretty` | 13.1.3 | Dev log formatting | `LOG_LEVEL=debug` + pretty transport for local dev only |
| `@fastify/swagger` | 9.7.0 | OpenAPI generation | Generates OpenAPI 3.0 from Fastify route schemas |
| `@fastify/swagger-ui` | 5.2.6 | Swagger UI page | Mounts at `/api/docs` per D-26 |
| `@fastify/sensible` | 6.0.4 | HTTP error helpers | Gives `reply.notImplemented(msg)` for 501-stubs per D-25 |
| `fastify-type-provider-zod` | 6.1.0 | Zod ↔ Fastify type provider | Lets Fastify validate + serialize using Zod schemas; emits OpenAPI via `jsonSchemaTransform` |
| `tsx` | 4.22.4 | Dev runner | `tsx watch src/index.ts` — no separate build step in dev |
| `@biomejs/biome` | 2.4.16 | Lint + format | Replaces ESLint + Prettier; same `biome.json` extends across workspace |

> ⚠️ **`@biomejs/biome` 2.4.16** is newer than STACK.md's "Biome 1.9+". The 2.x line is GA as of 2026; no breaking changes for the rules we care about (`tab indentation`, `trailing comma`, `import sorter`). Pin `2.4.16` or higher.
>
> ⚠️ **Zod 4.4.3** is the current major; `fastify-type-provider-zod` 6.x supports it. STACK.md mentions "zod 3.23+" — bump to Zod 4 to match the type provider's peer.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `ioredis` | 5.11.x | Redis client | Used by Phase 1 health check only; full BullMQ integration is Phase 5 |
| `nanoid` | 5.x | Short IDs | Generate `orders.public_token` (32-char URL-safe alphabet); generate `bourse_cache.query_hash` |
| `vitest` | 4.1.8 | Test runner | Wave 0 for nyquist-style smoke tests on schema + health |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `pg` driver | `postgres` (postgres.js) | postgres.js is faster but Drizzle's `node-postgres` adapter (`drizzle-orm/node-postgres`) is the documented path; stick with `pg`. |
| `fastify-type-provider-zod` | Hand-rolling JSON Schema in each route | Type provider gives Zod inference end-to-end + auto-OpenAPI; hand-rolled schemas duplicate Zod and break `packages/shared-types` reuse. |
| One `schema.ts` file | Per-domain split (`schema/clients.ts`, `schema/trucks.ts`, …) | Claude's discretion. Recommendation: **per-domain split** with a `schema/index.ts` barrel re-export. 13 tables grow noisy in a single file; per-domain matches the `repos/` structure (D-07). |
| Fastify `autoload` | Explicit `app.register(...)` in `index.ts` | Claude's discretion. Recommendation: **explicit registration**. For ~6 plugins (env, db, redis, swagger, sensible, health), explicit is more grep-friendly than `autoload`'s convention magic. |

**Installation:**

```bash
# Root
pnpm add -D -w typescript@^5.7 @biomejs/biome@^2.4 tsx@^4.22 vitest@^4.1

# apps/api
pnpm --filter @ai-logist/api add \
  fastify@5.8.5 \
  @fastify/swagger@^9.7 \
  @fastify/swagger-ui@^5.2 \
  @fastify/sensible@^6.0 \
  fastify-type-provider-zod@^6.1 \
  drizzle-orm@0.45.2 \
  pg@^8.21 \
  ioredis@^5.11 \
  zod@^4.4 \
  pino@^10.3 \
  nanoid@^5

pnpm --filter @ai-logist/api add -D \
  drizzle-kit@^0.31 \
  pino-pretty@^13.1 \
  @types/pg@^8 \
  @types/node@^22

# apps/web (placeholder)
pnpm --filter @ai-logist/web create next-app@latest . --typescript --tailwind --app --no-src-dir --no-import-alias

# packages/shared-types
pnpm --filter @ai-logist/shared-types add zod@^4.4
```

**Version verification (run during Wave 0):**

```bash
node --version          # must be v22.x.x
pnpm --version          # must be 9.x.x or 10.x
npm view drizzle-orm version    # confirm 0.45.2 (do not bump)
npm view fastify version        # 5.8.5 or newer in the 5.x line
```

## Architecture Patterns

### Recommended Project Structure

```
ai-logist/                                # repo root (this dir)
├── pnpm-workspace.yaml
├── package.json                          # root scripts (delegating to workspaces)
├── biome.json                            # shared lint config
├── tsconfig.base.json                    # shared strict TS config
├── docker-compose.yml                    # postgres + redis + api + web + caddy
├── docker-compose.prod.yml               # overrides for VPS (TLS, restart policies)
├── Caddyfile                             # path routing /api,/webhook,/ws → api else → web
├── .env.example                          # checked in
├── .env.local                            # gitignored (developer copies from .example)
├── .gitignore
├── README.md                             # 10-minute setup
│
├── apps/
│   ├── api/                              # Fastify backend
│   │   ├── package.json
│   │   ├── tsconfig.json                 # extends ../../tsconfig.base.json
│   │   ├── drizzle.config.ts             # Drizzle Kit config
│   │   ├── Dockerfile
│   │   ├── drizzle/                      # generated migrations
│   │   │   ├── 0000_postgis_extension.sql    # custom — CREATE EXTENSION
│   │   │   ├── 0001_init_enums.sql       # generated — all pgEnum types
│   │   │   ├── 0002_init_tables.sql      # generated — all tables + indexes
│   │   │   └── meta/                     # Drizzle's journal
│   │   └── src/
│   │       ├── index.ts                  # Fastify entry — bootstraps app, listens
│   │       ├── app.ts                    # buildApp(): registers plugins, returns FastifyInstance
│   │       ├── config.ts                 # Zod-validated env loading + export
│   │       ├── plugins/
│   │       │   ├── db.ts                 # Drizzle client + pg.Pool decorator
│   │       │   ├── redis.ts              # ioredis client decorator
│   │       │   ├── swagger.ts            # @fastify/swagger + swagger-ui + type-provider-zod
│   │       │   └── sensible.ts           # @fastify/sensible
│   │       ├── routes/
│   │       │   ├── health.ts             # GET /api/health (real impl)
│   │       │   ├── leads.ts              # 501 stubs with full Zod schemas (Phase 4 impl)
│   │       │   ├── orders.ts             # 501 stubs (Phase 4)
│   │       │   ├── trucks.ts             # 501 stubs (Phase 4)
│   │       │   ├── clients.ts            # 501 stubs (Phase 4)
│   │       │   ├── analytics.ts          # 501 stubs (Phase 4)
│   │       │   └── webhooks.ts           # 501 stubs (Phase 3/5)
│   │       ├── persistence/
│   │       │   ├── schema/
│   │       │   │   ├── index.ts          # barrel
│   │       │   │   ├── _enums.ts         # pgEnum() definitions
│   │       │   │   ├── _columns.ts       # geography() customType, geog helper
│   │       │   │   ├── clients.ts
│   │       │   │   ├── cities.ts
│   │       │   │   ├── trucks.ts
│   │       │   │   ├── truck_positions.ts
│   │       │   │   ├── leads.ts
│   │       │   │   ├── orders.ts
│   │       │   │   ├── order_events.ts
│   │       │   │   ├── pod_artifacts.ts
│   │       │   │   ├── messages.ts
│   │       │   │   ├── calls.ts
│   │       │   │   ├── webhook_updates.ts
│   │       │   │   ├── bourse_cache.ts
│   │       │   │   └── pricing_config.ts
│   │       │   └── repos/
│   │       │       ├── trucks.ts         # findById, list, create, update, nearestStub
│   │       │       ├── cities.ts         # findBySlug, findByName, upsert
│   │       │       ├── clients.ts
│   │       │       ├── leads.ts
│   │       │       ├── orders.ts
│   │       │       └── messages.ts
│   │       └── seed/
│   │           ├── run.ts                # entry — `pnpm --filter @ai-logist/api seed`
│   │           ├── data/
│   │           │   ├── cities.json       # 30 cities + 5 border crossings (slug,name_ru,name_ua,lat,lon)
│   │           │   ├── trucks.json       # 12 trucks
│   │           │   ├── clients.json      # 8 clients
│   │           │   └── pricing.json      # rate_per_km, dir_coef, season_coef
│   │           └── smoke.ts              # canonical KNN query printed at end of seed
│   │
│   └── web/                              # Next.js placeholder
│       ├── package.json
│       ├── Dockerfile
│       ├── next.config.ts
│       └── app/
│           └── page.tsx                  # placeholder "AI-Логист — coming soon" page
│
└── packages/
    └── shared-types/
        ├── package.json
        ├── tsconfig.json
        └── src/
            ├── index.ts                  # barrel exports
            ├── api/                      # REST DTO Zod schemas (for Phase 2/3/4/5 routes)
            │   ├── health.ts             # HealthResponseSchema
            │   ├── leads.ts              # LeadSchema, LeadListQuery, …
            │   ├── orders.ts
            │   ├── trucks.ts
            │   ├── clients.ts
            │   ├── analytics.ts
            │   └── webhooks.ts
            └── domain/                   # Optional: shared enums mirrored from DB (lead_stage, order_status…)
                └── enums.ts
```

### Pattern 1: Drizzle `geography` customType wrapper

**What:** Drizzle 0.45.2's built-in `geometry()` writes `geometry(point, 4326)` to the DB. CONTEXT.md D-02 mandates `geography(Point, 4326)` (Pitfall #3: meters vs degrees). There is no `geography()` helper, so we declare one project-local.

**When to use:** Every geo column (`cities.geom`, `trucks.geom`, `truck_positions.geom`, `pod_artifacts.gps`).

**Source:** Pattern adapted from [Drizzle discussion #1618 — Custom types on the other side of the driver](https://github.com/drizzle-team/drizzle-orm/discussions/1618) and [PR #3021 — Add geography type implementation](https://github.com/drizzle-team/drizzle-orm/pull/3021) (open as of research date — community is asking for this but it's not merged in 0.45.2).

### Pattern 2: PostgreSQL ENUMs declared before tables

**What:** ENUMs are top-level Postgres objects (`CREATE TYPE ... AS ENUM`). Drizzle declares them via `pgEnum('name', [...])`. The export must appear *before* any table that references it, both in source order and as the first thing generated in the migration.

**When to use:** All of `lead_stage`, `order_status`, `order_event_type`, `body_type_t`, `truck_status`, `client_lang`, `webhook_source`.

**Recommendation:** Put all six enums in `persistence/schema/_enums.ts` and import from each table file. Drizzle Kit will produce a single migration with `CREATE TYPE ... AS ENUM (...)` statements that precede the `CREATE TABLE` statements automatically.

### Pattern 3: Thin per-aggregate repository

**What:** Per CONTEXT D-07: each repo file exports a set of pure functions (no classes, no DI). Takes a `db: NodePgDatabase<typeof schema>` or `tx` as first argument.

**When to use:** All 7 aggregates (trucks, leads, orders, clients, cities, messages, calls).

### Pattern 4: Hand-written PostGIS SQL via `db.execute(sql\`…\`)`

**What:** Per CONTEXT D-08: Drizzle's query builder doesn't natively express `<->`, `ST_DWithin`, `ST_Distance(geog, true)`. Use `sql\`\`` tagged template with bindings.

**When to use:** `nearestTruck` (Phase 2), `truck_positions` upsert with geom rebuild (Phase 5), and the canonical seed smoke query (Phase 1).

### Pattern 5: Fastify v5 plugin layout with explicit registration

**What:** Each cross-cutting concern (db, redis, swagger, sensible) is a plugin file in `src/plugins/` that exports a `fastifyPlugin`-wrapped function. `src/app.ts` builds the instance and registers them in order: env → db → redis → sensible → swagger → routes.

**When to use:** All Phase 1 wiring. Avoid `autoload` — explicit gives better grep-ability and migration determinism.

### Pattern 6: Zod-validated env at boot with `process.exit(1)`

**What:** Per CONTEXT D-14: `config.ts` defines a Zod schema for env vars, parses `process.env`, and on failure logs the issues then `process.exit(1)`. The rest of the app imports a typed `config` object — nothing else touches `process.env`.

### Pattern 7: 501 stubs with full Zod schemas

**What:** Per CONTEXT D-25: every API-* endpoint outside of `/api/health` is declared with its real Zod body/query/response schema, but the handler calls `reply.notImplemented()`. Swagger UI shows the full contract; Phases 2-5 only need to swap handler bodies.

### Anti-Patterns to Avoid

- **Mixing `geometry` and `geography` columns.** Pitfall #3 in PITFALLS.md. Either both work but their `ST_Distance` return units differ silently. Stick with `geography(Point, 4326)` everywhere.
- **`CREATE EXTENSION postgis` in the same migration as table creation.** Pitfall #3. Even with `IF NOT EXISTS`, mixing the extension creation with `geography(...)` column type in the same transaction can fail in some Postgres versions. **Always a standalone first migration.**
- **`process.env.X` outside `config.ts`.** Defeats the Zod fail-fast guarantee. Use config import everywhere.
- **`handle_path /api/*` in Caddyfile.** `handle_path` *strips* the prefix; we need the prefix preserved so Fastify routes still match `/api/health`. **Use `handle /api/*` instead.**
- **Autoload of plugins/routes.** For 6 plugins and 8 route groups, explicit registration is clearer. Save autoload for >20 routes.
- **Drizzle `^0.45.2`.** Per STACK.md: pin exact (`0.45.2`). The 0.46/0.47/1.0-beta line has breaking changes to the migrator.
- **One mega `schema.ts`.** 13 tables × ~30 lines = ~400 lines. Per-domain split is more navigable and matches the `repos/` layout.
- **Forgetting `ssl: false` (or `?sslmode=disable`) in local `DATABASE_URL`.** node-postgres tries SSL by default in some configs; the docker-compose Postgres image doesn't ship a cert. Use `postgresql://ailogist:ailogist@localhost:5432/ailogist?sslmode=disable`.
- **No `CHECK (ST_SRID(geom) = 4326)` constraint.** Per CONTEXT D-02 + Pitfall #3 — catches a wrong-SRID insert at write time, not at query time.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Env validation | Hand-rolled `if (!process.env.X) throw` | Zod schema in `config.ts` (CONTEXT D-14) | Zod gives one consolidated error message, type inference, and `.optional()` handling for Phase 2/3 env additions |
| HTTP error responses (501) | Custom `{statusCode:501,error:'Not Implemented'}` literals | `@fastify/sensible` `reply.notImplemented()` | Sensible owns the canonical error shape that matches `@fastify/swagger` error schema |
| Geography column type | Raw SQL `geom geography(Point, 4326)` in custom migration only | `customType` wrapper so Drizzle introspects + types it (see Pattern 1) | Custom migration loses TypeScript inference on the column; downstream `repos/` lose `db.select({geom: trucks.geom})` typing |
| KNN query expressing | Try to coerce `<->` into Drizzle's query builder | Hand `sql\`ORDER BY ${trucks.geom} <-> ${pointSql}\`` (CONTEXT D-08) | The `<->` operator is non-standard; Drizzle's `asc()/desc()` don't model "distance-from-point" ordering |
| Migration tooling | Hand-written SQL files in a `migrations/` folder you grep-execute | `drizzle-kit generate` + `drizzle-kit migrate` (CONTEXT D-01) | Drizzle Kit tracks applied migrations in `__drizzle_migrations` table, handles ordering and idempotency |
| OpenAPI generation | Hand-maintained `openapi.yaml` | `@fastify/swagger` reading from Zod via `fastify-type-provider-zod` (CONTEXT D-26) | Each route's Zod schema is its OpenAPI source of truth — no drift |
| Telegram webhook idempotency table from scratch | Custom `WHERE NOT EXISTS` lookups | `webhook_updates` table with `UNIQUE(external_id) + ON CONFLICT DO NOTHING` (CONTEXT D-04, DB-09) | Single atomic SQL primitive vs a read+write race window |
| GitHub-SHA tracking | Read git directly from app | Pass at build time via `VERSION` env or build arg | Runtime `git rev-parse` requires git in the api container — bloat |

**Key insight:** This phase's value comes from leaning hard on Drizzle + Fastify ecosystem primitives. The one place we *must* hand-roll is the `geography` customType wrapper (Drizzle hasn't shipped it as of 0.45.2). Everything else has a library answer.

## Common Pitfalls

### Pitfall 1: `geography` column missing from Drizzle 0.45.2

**What goes wrong:** Developer reads Drizzle's PostGIS guide, uses `geometry('geom', {type:'point', srid:4326})`. Migration succeeds. Phase 2 writes `ST_Distance(t.geom, :pickup_geom)` expecting meters. Gets back numbers like `0.087` (degrees). KNN matching silently broken.

**Why it happens:** Drizzle ships `geometry()` but not `geography()`. The official guide uses `geometry` because that's the helper's name; new developers conflate the two PostGIS types.

**How to avoid:** Use the project-local `geography()` customType wrapper (Code Examples below). Verify by running `\d trucks` in psql and confirming the column type is `geography(Point,4326)`, not `geometry(Point,4326)`.

**Warning signs:**
- Migration file contains `geometry(Point, 4326)` (wrong)
- `ST_Distance` returns numbers < 1.0 on inter-city queries

### Pitfall 2: Mixing extension creation with table creation in one migration

**What goes wrong:** First migration contains both `CREATE EXTENSION postgis;` and `CREATE TABLE ... geom geography(Point, 4326)`. Drizzle Kit runs the whole file as one transaction. On a fresh DB without postgis, the `geography` type doesn't exist until the `CREATE EXTENSION` statement runs — and even then, in some configurations the table DDL is parsed before the extension is active.

**How to avoid:** Per CONTEXT D-01, generate the first migration with `drizzle-kit generate --custom --name=postgis_extension` and put `CREATE EXTENSION IF NOT EXISTS postgis;` alone in `0000_postgis_extension.sql`. Then `drizzle-kit generate` (without `--custom`) to produce `0001_init_*.sql` with the actual tables. Run with `drizzle-kit migrate` — each file is a separate transaction.

**Warning signs:** Migration fails with `type "geography" does not exist`.

### Pitfall 3: `handle_path` strips the URL prefix

**What goes wrong:** Caddyfile uses `handle_path /api/* { reverse_proxy api:3000 }`. Caddy strips `/api`, so Fastify receives `/health`. Fastify has no `/health` route (only `/api/health`). 404.

**How to avoid:** Use `handle /api/* { reverse_proxy api:3000 }` (without `_path`). Caddy preserves the full URL. See Caddy docs distinction: `handle_path` calls `uri strip_prefix`; `handle` does not. (Source: [Caddy `handle_path` docs](https://caddyserver.com/docs/caddyfile/directives/handle_path))

### Pitfall 4: Zod v4 + fastify-type-provider-zod v6 import paths

**What goes wrong:** Developer imports `import { z } from 'zod'` (v3 style). `fastify-type-provider-zod` v6 internally uses Zod's v4 namespace, and types don't align — TypeScript errors on `z.string()` not assignable to schema.

**How to avoid:** Use `import { z } from 'zod/v4'` per the type provider's README. Verify with a smoke `tsc --noEmit` in Wave 0.

**Warning signs:** `Type 'ZodString' is not assignable to type 'ZodType<any, any, any>'` errors.

### Pitfall 5: `pino-pretty` in production

**What goes wrong:** Developer enables `pino-pretty` transport globally. Production logs become unstructured text, breaking Datadog/Loki ingestion.

**How to avoid:** Conditionally enable pretty only when `config.NODE_ENV === 'development'`. JSON logs in prod.

### Pitfall 6: pnpm workspace dependency on `packages/shared-types`

**What goes wrong:** `apps/api/package.json` lists `"@ai-logist/shared-types": "*"`. `tsc --noEmit` works but Node at runtime can't resolve. ESM resolution doesn't follow `workspace:` symlinks unless declared correctly.

**How to avoid:** Use `"@ai-logist/shared-types": "workspace:*"` (with the `workspace:` protocol). Set `packages/shared-types/package.json` with both `"main"` (CJS) and `"exports"` map for ESM:

```json
{
  "name": "@ai-logist/shared-types",
  "version": "0.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "scripts": { "build": "tsc -p tsconfig.json" }
}
```

And have `apps/api` run `pnpm --filter @ai-logist/shared-types build` before dev start (in `predev` script) — or use `tsx` everywhere and consume `.ts` source directly via `tsconfig` paths.

### Pitfall 7: Drizzle Kit can't introspect customType

**What goes wrong:** Drizzle Kit's introspect/diff doesn't know how to represent customType columns. `drizzle-kit generate` after a schema change to a `geography` column emits an empty or incorrect ALTER.

**How to avoid:** customType's `dataType()` returns the SQL literal Drizzle Kit uses for `CREATE TABLE`. As long as you only *add* geography columns (don't ALTER them mid-project), this works. For ALTERs, use `--custom` migrations and write SQL by hand.

## Code Examples

Verified patterns from official sources, adapted to CONTEXT.md decisions.

### `geography(Point, 4326)` customType wrapper

**File:** `apps/api/src/persistence/schema/_columns.ts`

```typescript
// Source pattern: https://github.com/drizzle-team/drizzle-orm/discussions/1618
// Adapted for geography(Point, 4326) per CONTEXT.md D-02.
// PostGIS WKT format on the wire: 'SRID=4326;POINT(lon lat)'

import { customType } from 'drizzle-orm/pg-core';

export type LngLat = { lng: number; lat: number };

/**
 * geography(Point, 4326) column type.
 * Reads/writes EWKT 'SRID=4326;POINT(lon lat)' strings.
 * Use ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography in raw SQL when you
 * need fine control over insert geometry.
 */
export const geographyPoint = customType<{
  data: LngLat;
  driverData: string;
}>({
  dataType() {
    return 'geography(Point, 4326)';
  },
  toDriver(value: LngLat): string {
    // PostGIS accepts EWKT on insert when the column is geography
    return `SRID=4326;POINT(${value.lng} ${value.lat})`;
  },
  fromDriver(value: string): LngLat {
    // node-postgres returns the geometry as hex EWKB by default;
    // we rely on the repo to wrap reads in ST_AsText() when callers need LngLat.
    // For typed reads, prefer: SELECT ST_X(geom::geometry) AS lng, ST_Y(geom::geometry) AS lat
    // and return a {lng,lat} from the repo.
    // This fromDriver is a fallback that parses 'POINT(lng lat)' EWKT.
    const m = /POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i.exec(value);
    if (!m) throw new Error(`Cannot parse geography point from driver: ${value}`);
    return { lng: Number(m[1]), lat: Number(m[2]) };
  },
});
```

> ⚠️ **Important caveat (verified against node-postgres behavior):** By default, `node-postgres` returns PostGIS columns as **hex EWKB** (e.g. `0101000020E6100000…`), not EWKT. The `fromDriver` above will throw on raw reads. **Best practice for this project:** in repository queries, always select PostGIS data as `ST_X(geom::geometry) AS lng, ST_Y(geom::geometry) AS lat` and map manually in the repo. Use `customType` only so Drizzle Kit emits the correct `geography(Point, 4326)` DDL and the column gets a type-safe identity in the schema; treat the column as **write-only via `toDriver`**. Reads go through hand-written `sql\`\`` snippets that already do the ST_X/ST_Y projection.

### Drizzle schema for `trucks` with GiST index + CHECK constraint

**File:** `apps/api/src/persistence/schema/trucks.ts`

```typescript
import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { bodyTypeEnum, truckStatusEnum } from './_enums.js';
import { geographyPoint } from './_columns.js';

export const trucks = pgTable(
  'trucks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    plateNumber: text('plate_number').notNull().unique(),  // for ON CONFLICT in seed
    driverName: text('driver_name').notNull(),
    driverPhone: text('driver_phone').notNull(),           // E.164
    capacityT: bigint('capacity_t', { mode: 'number' }).notNull(),  // tonnes
    bodyType: bodyTypeEnum('body_type').notNull(),
    geom: geographyPoint('geom').notNull(),
    status: truckStatusEnum('status').notNull().default('available'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('trucks_geom_gist').using('gist', t.geom),
    check('trucks_geom_srid_chk', sql`ST_SRID(${t.geom}) = 4326`),
  ]
);

export type Truck = typeof trucks.$inferSelect;
export type NewTruck = typeof trucks.$inferInsert;
```

### PostgreSQL ENUMs

**File:** `apps/api/src/persistence/schema/_enums.ts`

```typescript
import { pgEnum } from 'drizzle-orm/pg-core';

export const leadStageEnum = pgEnum('lead_stage', [
  'NEW',
  'QUALIFIED',
  'MATCHED',
  'QUOTED',
  'AGREED',
  'ORDER_CREATED',
  'IN_PROGRESS',
  'DONE',
  'LOST',
]);

export const orderStatusEnum = pgEnum('order_status', [
  'CREATED',
  'DRIVER_ASSIGNED',
  'AT_LOADING',
  'IN_TRANSIT',
  'AT_BORDER',
  'DELIVERED',
  'CLOSED',
]);

export const orderEventTypeEnum = pgEnum('order_event_type', [
  'created',
  'driver_assigned',
  'at_loading',
  'in_transit',
  'at_border',
  'delivered',
]);

export const bodyTypeEnum = pgEnum('body_type_t', [
  'tent',
  'ref',
  'iso',
  'container',
]);

export const truckStatusEnum = pgEnum('truck_status', [
  'available',
  'busy',
  'maintenance',
]);

export const clientLangEnum = pgEnum('client_lang', ['ru', 'ua']);

export const webhookSourceEnum = pgEnum('webhook_source', [
  'telegram',
  'voice',
  'gps',
]);
```

### `leads` table with extended cargo fields + `price_overrides jsonb[]`

**File:** `apps/api/src/persistence/schema/leads.ts`

```typescript
import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { clients } from './clients.js';
import { cities } from './cities.js';
import { trucks } from './trucks.js';
import { orders } from './orders.js';
import { leadStageEnum, bodyTypeEnum } from './_enums.js';

export const leads = pgTable(
  'leads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),
    channel: text('channel').notNull(), // 'telegram' | 'call'
    stage: leadStageEnum('stage').notNull().default('NEW'),
    fromCityId: uuid('from_city_id').references(() => cities.id),
    toCityId: uuid('to_city_id').references(() => cities.id),
    tons: numeric('tons', { precision: 10, scale: 2 }),
    bodyType: bodyTypeEnum('body_type'),
    budget: bigint('budget', { mode: 'bigint' }), // kopecks

    // CONTEXT D-04 — extended cargo fields
    volumeM3: numeric('volume_m3', { precision: 10, scale: 2 }),
    dimensionsLxwxh: text('dimensions_lxwxh'), // 'LxWxH' string
    packaging: text('packaging'),
    adrClass: text('adr_class'),
    declaredValue: bigint('declared_value', { mode: 'bigint' }), // kopecks

    matchedTruckId: uuid('matched_truck_id').references(() => trucks.id),
    quotedPrice: bigint('quoted_price', { mode: 'bigint' }), // kopecks
    orderId: uuid('order_id').references(() => orders.id),

    // CONTEXT D-04 — price override audit log
    priceOverrides: jsonb('price_overrides')
      .array()
      .notNull()
      .default(sql`'{}'::jsonb[]`),

    // CONTEXT (FSM Pitfall #6) — optimistic concurrency
    version: bigint('version', { mode: 'number' }).notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('leads_stage_idx').on(t.stage),
    index('leads_client_id_idx').on(t.clientId),
  ]
);

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
```

### `webhook_updates` table with `external_id` UNIQUE for idempotency

**File:** `apps/api/src/persistence/schema/webhook_updates.ts`

```typescript
import {
  bigserial,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { webhookSourceEnum } from './_enums.js';

export const webhookUpdates = pgTable(
  'webhook_updates',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    source: webhookSourceEnum('source').notNull(),
    externalId: text('external_id').notNull(), // Telegram update_id, voice call id, gps push id
    payload: jsonb('payload').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique('webhook_updates_source_ext_unq').on(t.source, t.externalId)]
);

export type WebhookUpdate = typeof webhookUpdates.$inferSelect;
```

Idempotent insert (used by webhook handler in Phase 3):

```typescript
import { db } from '../db.js';
import { webhookUpdates } from '../schema/index.js';

const inserted = await db
  .insert(webhookUpdates)
  .values({ source: 'telegram', externalId: String(update.update_id), payload: update })
  .onConflictDoNothing({
    target: [webhookUpdates.source, webhookUpdates.externalId],
  })
  .returning({ id: webhookUpdates.id });

// inserted.length === 0 → duplicate, ack-200 and exit
```

### `drizzle.config.ts`

**File:** `apps/api/drizzle.config.ts`

```typescript
import 'node:process';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/persistence/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Tell drizzle-kit that PostGIS owns these schemas/tables so it ignores them on diffs
  extensionsFilters: ['postgis'],
  schemaFilter: ['public'],
  strict: true,
  verbose: true,
});
```

### First (CREATE EXTENSION) migration via `--custom`

```bash
# In apps/api directory
pnpm drizzle-kit generate --custom --name=postgis_extension
```

Produces `drizzle/0000_postgis_extension.sql` (file is empty after generation). Edit it to contain exactly:

```sql
-- 0000_postgis_extension.sql
-- Pitfall #3 of PITFALLS.md: extension must be its own migration so the geography
-- type exists before any table that uses it.
CREATE EXTENSION IF NOT EXISTS postgis;
```

Then generate the rest:

```bash
pnpm drizzle-kit generate --name=init
# Produces 0001_init.sql with all ENUM types + tables + indexes
```

Apply (used by `pnpm db:migrate` and by CI):

```bash
pnpm drizzle-kit migrate
```

### Zod env validation (`config.ts`)

**File:** `apps/api/src/config.ts`

```typescript
import { z } from 'zod/v4';

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().url().or(z.string().startsWith('postgresql://')),
  REDIS_URL: z.string().url().or(z.string().startsWith('redis://')),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),

  // Phase 2+ — optional in Phase 1 so the schema doesn't reject .env.local
  ANTHROPIC_API_KEY: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),

  // Build info (passed at docker build time)
  VERSION: z.string().default('dev'),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

const parsed = ConfigSchema.safeParse(process.env);

if (!parsed.success) {
  // Use console.error here — pino isn't initialized yet
  console.error('Invalid environment configuration:');
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const config: AppConfig = parsed.data;
```

Bootstrap with `node --env-file=.env.local dist/index.js` (Node 22 native).

### Fastify v5 app bootstrap with swagger + zod + sensible

**File:** `apps/api/src/app.ts`

```typescript
import Fastify, { type FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { config } from './config.js';
import { dbPlugin } from './plugins/db.js';
import { redisPlugin } from './plugins/redis.js';
import healthRoutes from './routes/health.js';
import leadsRoutes from './routes/leads.js';
import ordersRoutes from './routes/orders.js';
import trucksRoutes from './routes/trucks.js';
import clientsRoutes from './routes/clients.js';
import analyticsRoutes from './routes/analytics.js';
import webhooksRoutes from './routes/webhooks.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      ...(config.NODE_ENV === 'development'
        ? {
            transport: {
              target: 'pino-pretty',
              options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
            },
          }
        : {}),
    },
    disableRequestLogging: false,
    requestIdHeader: 'x-request-id',
  }).withTypeProvider<ZodTypeProvider>();

  // Zod ↔ Fastify wiring
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Core
  await app.register(sensible);
  await app.register(dbPlugin);
  await app.register(redisPlugin);

  // OpenAPI
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'AI-Логист API',
        description: 'Logistics dispatching backend — Phase 1 skeleton',
        version: config.VERSION,
      },
      servers: [{ url: '/' }],
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/api/docs' });

  // Routes — only /api/health is implemented; rest are 501 stubs with full schemas
  await app.register(healthRoutes, { prefix: '/api' });
  await app.register(leadsRoutes, { prefix: '/api' });
  await app.register(ordersRoutes, { prefix: '/api' });
  await app.register(trucksRoutes, { prefix: '/api' });
  await app.register(clientsRoutes, { prefix: '/api' });
  await app.register(analyticsRoutes, { prefix: '/api' });
  await app.register(webhooksRoutes, { prefix: '/webhook' });

  return app;
}
```

**File:** `apps/api/src/index.ts`

```typescript
import { buildApp } from './app.js';
import { config } from './config.js';

const app = await buildApp();

try {
  await app.listen({ port: config.PORT, host: config.HOST });
} catch (err) {
  app.log.fatal(err, 'server failed to start');
  process.exit(1);
}

// Graceful shutdown
const close = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  process.exit(0);
};
process.on('SIGINT', () => void close('SIGINT'));
process.on('SIGTERM', () => void close('SIGTERM'));
```

### Drizzle DB plugin

**File:** `apps/api/src/plugins/db.ts`

```typescript
import fp from 'fastify-plugin';
import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../persistence/schema/index.js';
import { config } from '../config.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: NodePgDatabase<typeof schema>;
    pgPool: Pool;
  }
}

export const dbPlugin = fp(async (app) => {
  const pool = new Pool({
    connectionString: config.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
  });

  // Smoke-test the connection on boot — fail fast if DB is down
  await pool.query('SELECT 1');

  const db = drizzle(pool, { schema });

  app.decorate('db', db);
  app.decorate('pgPool', pool);

  app.addHook('onClose', async () => {
    await pool.end();
  });
}, { name: 'db' });
```

### Redis plugin

**File:** `apps/api/src/plugins/redis.ts`

```typescript
import fp from 'fastify-plugin';
import Redis from 'ioredis';
import { config } from '../config.js';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

export const redisPlugin = fp(async (app) => {
  const redis = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: null, // required for BullMQ in Phase 5
    enableReadyCheck: true,
    lazyConnect: false,
  });

  // Smoke-test
  await redis.ping();

  app.decorate('redis', redis);

  app.addHook('onClose', async () => {
    redis.disconnect();
  });
}, { name: 'redis' });
```

### `/api/health` route with PostGIS version

**File:** `apps/api/src/routes/health.ts`

```typescript
import { sql } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';
import { config } from '../config.js';

const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  version: z.string(),
  uptime_s: z.number(),
  checks: z.object({
    db: z.enum(['ok', 'fail']),
    postgis: z.string(),    // version string, or 'fail'
    redis: z.enum(['ok', 'fail']),
  }),
});

const startedAt = Date.now();

const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/health',
    {
      schema: {
        tags: ['system'],
        summary: 'Health check',
        response: { 200: HealthResponseSchema, 503: HealthResponseSchema },
      },
    },
    async (_req, reply) => {
      const checks = { db: 'fail' as 'ok' | 'fail', postgis: 'fail', redis: 'fail' as 'ok' | 'fail' };

      try {
        await app.db.execute(sql`SELECT 1`);
        checks.db = 'ok';
      } catch (err) {
        app.log.error(err, 'db health check failed');
      }

      try {
        const r = await app.db.execute<{ postgis_version: string }>(
          sql`SELECT PostGIS_Version() AS postgis_version`
        );
        checks.postgis = r.rows[0]?.postgis_version ?? 'fail';
      } catch (err) {
        app.log.error(err, 'postgis health check failed');
      }

      try {
        const pong = await app.redis.ping();
        if (pong === 'PONG') checks.redis = 'ok';
      } catch (err) {
        app.log.error(err, 'redis health check failed');
      }

      const allOk = checks.db === 'ok' && checks.postgis !== 'fail' && checks.redis === 'ok';
      const body = {
        status: allOk ? ('ok' as const) : ('degraded' as const),
        version: config.VERSION,
        uptime_s: Math.floor((Date.now() - startedAt) / 1000),
        checks,
      };

      return reply.status(allOk ? 200 : 503).send(body);
    }
  );
};

export default healthRoutes;
```

### 501-stub example (`/api/leads`)

**File:** `apps/api/src/routes/leads.ts`

```typescript
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';
// Phase 4 will swap the stub bodies for real logic; the schemas already live in shared-types
import {
  LeadSchema,
  LeadListQuerySchema,
  LeadPatchBodySchema,
} from '@ai-logist/shared-types/api/leads';

const leadsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/leads',
    {
      schema: {
        tags: ['leads'],
        summary: 'List leads (Phase 4)',
        querystring: LeadListQuerySchema,
        response: { 501: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }) },
      },
    },
    async (_req, reply) => {
      return reply.notImplemented('Phase 4 — admin web');
    }
  );

  app.patch(
    '/leads/:id',
    {
      schema: {
        tags: ['leads'],
        summary: 'Update lead stage (Phase 4)',
        params: z.object({ id: z.string().uuid() }),
        body: LeadPatchBodySchema,
        response: { 501: z.object({ statusCode: z.number(), error: z.string(), message: z.string() }) },
      },
    },
    async (_req, reply) => {
      return reply.notImplemented('Phase 4 — admin web');
    }
  );
};

export default leadsRoutes;
```

### Canonical KNN smoke query (printed at end of seed)

**File:** `apps/api/src/seed/smoke.ts`

```typescript
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../persistence/schema/index.js';

/**
 * Canonical KNN smoke query — closes success criterion #3 of Phase 1.
 *
 * Phase 2 will implement the proper CTE re-rank pattern (PITFALLS.md #2):
 *   1. Overfetch 20 by `<->` (GiST-accelerated sphere distance)
 *   2. Filter by capacity_t and body_type INSIDE the CTE
 *   3. Re-rank by ST_Distance(geog, geog, true) (spheroid, meters)
 *
 * For Phase 1 we use the same pattern with a fixed point (Kyiv) and no filters,
 * which is enough to verify (a) GiST index is used, (b) <-> works on geography,
 * (c) ST_Distance returns meters.
 */
export async function printNearestTrucksSmoke(
  db: NodePgDatabase<typeof schema>
): Promise<void> {
  // Kyiv center: 30.5234 E, 50.4501 N
  const lng = 30.5234;
  const lat = 50.4501;
  const pickup = sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;

  const result = await db.execute<{
    name: string;
    plate_number: string;
    capacity_t: number;
    body_type: string;
    meters: number;
  }>(sql`
    WITH knn AS (
      SELECT t.id
      FROM trucks t
      WHERE t.status = 'available'
      ORDER BY t.geom <-> ${pickup}
      LIMIT 20
    )
    SELECT
      t.name,
      t.plate_number,
      t.capacity_t,
      t.body_type::text AS body_type,
      ST_Distance(t.geom, ${pickup}, true)::int AS meters
    FROM knn JOIN trucks t USING (id)
    ORDER BY meters
    LIMIT 3
  `);

  console.log('\n📦 Canonical KNN smoke (pickup = Kyiv center)');
  console.log('─'.repeat(60));
  for (const row of result.rows) {
    const km = (Number(row.meters) / 1000).toFixed(1);
    console.log(
      `  ${row.name.padEnd(18)} ${row.plate_number.padEnd(12)} ${row.capacity_t}т ${row.body_type.padEnd(10)} ${km} км`
    );
  }
  console.log('─'.repeat(60));
  console.log('If you see 3 trucks above with ascending km values, PostGIS is wired correctly.\n');
}
```

### Idempotent seed with `.onConflictDoNothing()`

**File:** `apps/api/src/seed/run.ts` (excerpt)

```typescript
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../persistence/schema/index.js';
import citiesData from './data/cities.json' with { type: 'json' };
import trucksData from './data/trucks.json' with { type: 'json' };
import clientsData from './data/clients.json' with { type: 'json' };
import { sql } from 'drizzle-orm';
import { printNearestTrucksSmoke } from './smoke.js';
import { config } from '../config.js';

const pool = new Pool({ connectionString: config.DATABASE_URL });
const db = drizzle(pool, { schema });

console.log('🌱 Seeding cities…');
for (const city of citiesData) {
  await db
    .insert(schema.cities)
    .values({
      slug: city.slug,
      nameRu: city.name_ru,
      nameUa: city.name_ua,
      countryCode: city.country_code,
      geom: { lng: city.lng, lat: city.lat },
    })
    .onConflictDoNothing({ target: schema.cities.slug });
}

console.log('🚛 Seeding trucks…');
for (const truck of trucksData) {
  await db
    .insert(schema.trucks)
    .values({
      name: truck.name,
      plateNumber: truck.plate_number,
      driverName: truck.driver_name,
      driverPhone: truck.driver_phone,
      capacityT: truck.capacity_t,
      bodyType: truck.body_type,
      geom: { lng: truck.lng, lat: truck.lat },
      status: 'available',
    })
    .onConflictDoNothing({ target: schema.trucks.plateNumber });
}

console.log('👤 Seeding clients…');
for (const client of clientsData) {
  await db
    .insert(schema.clients)
    .values({
      name: client.name,
      phone: client.phone,
      telegramId: client.telegram_id ?? null,
      lang: client.lang,
      taxId: client.tax_id ?? null,
      taxIdCountry: client.tax_id_country ?? null,
    })
    .onConflictDoNothing({ target: schema.clients.phone });
}

// Pricing config: bigint kopecks
console.log('💰 Seeding pricing config…');
await db.execute(sql`
  INSERT INTO pricing_config (key, value)
  VALUES
    ('rate_per_km', '4200'::jsonb),
    ('dir_coef', '{"default": 1.0, "back_haul": 0.85}'::jsonb),
    ('season_coef', '1.1'::jsonb)
  ON CONFLICT (key) DO NOTHING
`);

await printNearestTrucksSmoke(db);

await pool.end();
console.log('✅ Seed complete');
```

### Root `package.json` scripts

**File:** `package.json`

```json
{
  "name": "ai-logist",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "dev": "pnpm --filter @ai-logist/api dev",
    "dev:web": "pnpm --filter @ai-logist/web dev",
    "build": "pnpm -r build",
    "lint": "pnpm exec biome check .",
    "lint:fix": "pnpm exec biome check --write .",
    "tsc": "pnpm -r exec tsc --noEmit",
    "test": "pnpm -r test",
    "db:generate": "pnpm --filter @ai-logist/api db:generate",
    "db:migrate": "pnpm --filter @ai-logist/api db:migrate",
    "seed": "pnpm --filter @ai-logist/api seed",
    "compose:up": "docker compose up -d postgres redis",
    "compose:down": "docker compose down",
    "compose:full": "docker compose up -d"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.4.16",
    "typescript": "^5.7.0",
    "tsx": "^4.22.0",
    "vitest": "^4.1.0"
  }
}
```

### `pnpm-workspace.yaml`

**File:** `pnpm-workspace.yaml`

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### `apps/api/package.json`

```json
{
  "name": "@ai-logist/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch --env-file=../../.env.local src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node --env-file=.env.local dist/index.js",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "node --env-file=../../.env.local --import tsx ./node_modules/.bin/drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "seed": "tsx --env-file=../../.env.local src/seed/run.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@ai-logist/shared-types": "workspace:*",
    "@fastify/sensible": "^6.0.4",
    "@fastify/swagger": "^9.7.0",
    "@fastify/swagger-ui": "^5.2.6",
    "drizzle-orm": "0.45.2",
    "fastify": "5.8.5",
    "fastify-plugin": "^5.0.1",
    "fastify-type-provider-zod": "^6.1.0",
    "ioredis": "^5.11.0",
    "nanoid": "^5.0.0",
    "pg": "^8.21.0",
    "pino": "^10.3.0",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/pg": "^8.11.0",
    "drizzle-kit": "^0.31.10",
    "pino-pretty": "^13.1.0",
    "tsx": "^4.22.0",
    "typescript": "^5.7.0",
    "vitest": "^4.1.0"
  }
}
```

### `docker-compose.yml`

**File:** `docker-compose.yml`

```yaml
services:
  postgres:
    image: postgis/postgis:17-3.5
    container_name: ailogist-postgres
    environment:
      POSTGRES_DB: ailogist
      POSTGRES_USER: ailogist
      POSTGRES_PASSWORD: ${DB_PASSWORD:-ailogist}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - '127.0.0.1:5432:5432'  # local-only; Caddy doesn't proxy DB
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ailogist -d ailogist']
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: ailogist-redis
    command: redis-server --appendonly yes
    volumes:
      - redisdata:/data
    ports:
      - '127.0.0.1:6379:6379'
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 3s
      retries: 10
    restart: unless-stopped

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    container_name: ailogist-api
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      NODE_ENV: ${NODE_ENV:-production}
      PORT: 3000
      HOST: 0.0.0.0
      DATABASE_URL: postgresql://ailogist:${DB_PASSWORD:-ailogist}@postgres:5432/ailogist?sslmode=disable
      REDIS_URL: redis://redis:6379
      LOG_LEVEL: ${LOG_LEVEL:-info}
      VERSION: ${VERSION:-dev}
    expose:
      - '3000'
    healthcheck:
      test: ['CMD', 'wget', '-qO-', 'http://localhost:3000/api/health']
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    container_name: ailogist-web
    depends_on:
      - api
    environment:
      NODE_ENV: ${NODE_ENV:-production}
      PORT: 3001
      NEXT_PUBLIC_API_URL: http://api:3000
    expose:
      - '3001'
    restart: unless-stopped

  caddy:
    image: caddy:2-alpine
    container_name: ailogist-caddy
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddydata:/data
      - caddyconfig:/config
    depends_on:
      - api
      - web
    restart: unless-stopped

volumes:
  pgdata:
  redisdata:
  caddydata:
  caddyconfig:
```

### `Caddyfile` — local dev (no TLS)

**File:** `Caddyfile`

```caddyfile
# Local development — listens on :80 only, no TLS
# For prod VPS, replace ':80' with your domain and Caddy auto-provisions Let's Encrypt.
:80 {
    encode gzip

    # API: /api/* — preserve prefix (Fastify routes are /api/health, /api/leads, …)
    handle /api/* {
        reverse_proxy api:3000
    }

    # Webhooks (Telegram, voice, gps)
    handle /webhook/* {
        reverse_proxy api:3000
    }

    # WebSocket (Phase 5: /ws/tracking, /ws/inbox)
    handle /ws/* {
        reverse_proxy api:3000
    }

    # Everything else → web (Next.js, including /track/[token] for Phase 5 public link)
    handle {
        reverse_proxy web:3001
    }

    log {
        output stdout
        format console
    }
}
```

### `Caddyfile` (prod overrides in `docker-compose.prod.yml`)

Replace `:80` with your domain (e.g. `ai-logist.example.com`) and Caddy auto-acquires a Let's Encrypt cert. No further config needed.

### `apps/api/Dockerfile`

**File:** `apps/api/Dockerfile`

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared-types/package.json packages/shared-types/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @ai-logist/shared-types build && \
    pnpm --filter @ai-logist/api build

FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=build /app/packages/shared-types/package.json ./packages/shared-types/package.json
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### `.env.example`

**File:** `.env.example`

```bash
# Phase 1 minimal env — Phase 2/3 will add LLM/Telegram keys

NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# Postgres (matches docker-compose service name + port mapping)
DB_PASSWORD=ailogist
DATABASE_URL=postgresql://ailogist:ailogist@localhost:5432/ailogist?sslmode=disable

# Redis
REDIS_URL=redis://localhost:6379

LOG_LEVEL=debug

# Phase 2 (LLM)
# ANTHROPIC_API_KEY=

# Phase 3 (Telegram)
# TELEGRAM_BOT_TOKEN=
# TELEGRAM_WEBHOOK_SECRET=
```

### `README.md` — 10-minute setup

```markdown
# AI-Логист

Bilingual (RU/UA) logistics dispatching demo: Telegram + LLM + PostGIS + admin web + live tracking.

## Prerequisites

- Node.js **22.x LTS** (`node --version`)
- pnpm **9.x** (`pnpm --version`) — install via `corepack enable && corepack prepare pnpm@9.15.0 --activate`
- Docker Desktop or Docker Engine with Compose v2

## Local setup (≤ 10 minutes)

```bash
# 1. Clone + env
git clone <repo>
cd ai-logist
cp .env.example .env.local

# 2. Boot infra (Postgres+PostGIS, Redis)
docker compose up -d postgres redis

# 3. Install
pnpm install

# 4. Apply migrations + seed
pnpm db:migrate
pnpm seed

# 5. Run
pnpm dev   # http://localhost:3000/api/health
```

Verify:
- `curl http://localhost:3000/api/health` → JSON with `status:'ok'` and `checks.postgis:'3.5.x'`
- `http://localhost:3000/api/docs` → Swagger UI with the full API contract

## Full stack (via Caddy)

```bash
docker compose up -d
open http://localhost
```

- `/api/*` → Fastify
- everything else → Next.js placeholder

## VPS (production)

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Edit Caddyfile and replace `:80` with your domain. Caddy auto-provisions TLS via Let's Encrypt.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `dotenv` package + `process.env` | Node 22 `--env-file=.env.local` flag | Node 20.6.0 (2023) | One less dep; CONTEXT D-13 codifies it |
| `eslint + prettier` | Biome (single binary, ~30× faster) | Biome 1.0 (2024); 2.x is stable | Single config (`biome.json`), CONTEXT D-12 |
| `ts-node` for dev | `tsx` (esbuild-based, ESM-native) | 2023 | `tsx watch src/index.ts`; no `ts-node-esm` workarounds |
| Hand-written OpenAPI YAML | Auto-generated from Zod via `fastify-type-provider-zod` | type-provider-zod 6.x (2026) | Zod is single source for runtime + types + OpenAPI |
| `axios` / `got` HTTP clients | Native `fetch` (or `undici` directly) in Node 22 | Node 18+ (stable in 22) | Reduces bundle size; STACK.md uses native fetch |
| Drizzle 0.x `^` ranges | Pinned exact (`0.45.2`) | 2025 (during 0.45 → 1.0-beta migration) | Avoid surprise breaking changes |
| `dotenv` + zod env validation in app code | `--env-file` + Zod `safeParse(process.env)` at boot | 2024 | Cleaner separation; fail-fast at boot |

**Deprecated/outdated (do NOT use):**

- **Prisma <7** for PostGIS — `$queryRaw` everywhere, no PostGIS column types in schema. Use Drizzle.
- **TypeORM** — decorator-heavy, weak PostGIS support, sluggish maintenance.
- **Sequelize** — outdated TS story, no PostGIS guide.
- **node-postgres without `pg-types` coercion for bigint** — by default `bigint` columns come back as strings. Drizzle's `bigint('col', { mode: 'number' })` handles this for values ≤ `Number.MAX_SAFE_INTEGER`; use `mode: 'bigint'` for unbounded values (kopecks: use `bigint` mode if any single value could exceed 9 quadrillion kopecks — for our use case `number` mode is safe up to ~90,000 trillion kopecks).
- **`@fastify/cors` for Phase 1** — Caddy handles CORS for cross-origin from Next.js dev server on a different port if needed. Add only if Phase 4 actually needs it.
- **Old-style Fastify `setSchemaCompiler`** (v4) — v5 uses `setValidatorCompiler` + `setSerializerCompiler`. The type provider README has the v5 names.

## Open Questions

1. **Should the seed fixtures be JSON files or hardcoded TS arrays?**
   - What we know: CONTEXT marks this as Claude's discretion. JSON is portable, language-neutral, easy to review in PRs. TS gives type safety on the seed array shape.
   - Recommendation: **JSON files in `seed/data/`** with a minimal Zod schema validating each on load. Best of both: easy to edit (no TS compile), and shape-checked.

2. **How should the `version` field of `/api/health` be populated?**
   - What we know: CONTEXT D-16 says "git short sha". In docker, no git binary available at runtime.
   - Recommendation: Pass at docker build time via `--build-arg VERSION=$(git rev-parse --short HEAD)` and inject into Dockerfile as ENV. Zod env schema already has `VERSION` with default `'dev'` for local runs.

3. **Should `db:migrate` happen inside the API container at startup, or only via `pnpm db:migrate` from the host?**
   - What we know: Spec is silent. Auto-migrate on boot is convenient but can mask migration failures and races between multiple instances.
   - Recommendation: **Host-run** (`pnpm db:migrate` step in README, separate docker-compose run for prod). Phase 6 can add a CI-driven migration step.

4. **`web` service in Phase 1 — full Next.js or static placeholder?**
   - What we know: CONTEXT D-22 says "Next.js placeholder, `next start` after `next build`". Phase 4 forks `next-shadcn-admin-dashboard` separately.
   - Recommendation: **Minimal `create-next-app` placeholder** with one page that says "AI-Логист — admin coming in Phase 4. API docs: /api/docs". Demonstrates that Caddy routing works end-to-end.

5. **What's in `cities.slug` exactly — `kyiv`, `kiev`, or both?**
   - What we know: Sourced spec says cities have `name_ru` and `name_ua`. Pitfall #7 (sticky language) mentions both spellings.
   - Recommendation: **`slug` is the ASCII Latin canonical form** of the UA spelling (`kyiv`, `lviv`, `odesa`). `name_ru` and `name_ua` capture the localized spellings (`Киев` / `Київ`, `Львов` / `Львів`). Unique on `slug`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 22 LTS | Fastify v5, Drizzle 0.45.2, native `--env-file` | Likely (verify in Wave 0) | TBD | Install via nvm/fnm — README has instruction |
| pnpm 9.x | Workspaces | Likely | TBD | `corepack enable && corepack prepare pnpm@9.15.0 --activate` |
| Docker Engine + Compose v2 | docker-compose.yml (postgres, redis, api, web, caddy) | Likely | TBD | Docker Desktop on macOS; native on Linux |
| git | Source clone + `VERSION` build arg | Yes | — | — |
| `wget` inside `node:22-alpine` | api healthcheck inside container | Yes (busybox provides it) | — | swap for `node -e "require('http').get(…)"` if missing |
| `postgis/postgis:17-3.5` Docker image | Postgres + PostGIS | Yes (Docker Hub) | 17-3.5 (released 2025-Q2) | — |
| `redis:7-alpine` Docker image | Redis | Yes | 7.x | — |
| `caddy:2-alpine` Docker image | Reverse proxy | Yes | 2.x | nginx as fallback (more config) |

**Missing dependencies with no fallback:** None expected — verify in Wave 0 (project init task).

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 |
| Config file | `apps/api/vitest.config.ts` (does not yet exist — Wave 0 creates it) |
| Quick run command | `pnpm --filter @ai-logist/api test` |
| Full suite command | `pnpm test` (runs across all workspaces — currently just api) |
| Phase gate | `pnpm tsc && pnpm lint && pnpm test` all green before `/gsd:verify-work` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DB-01 | Postgres+PostGIS boots, extension is loaded | smoke | `pnpm --filter @ai-logist/api test src/__tests__/postgis.test.ts` | ❌ Wave 0 |
| DB-02..09 | Drizzle schema generates correct migration | unit | `pnpm --filter @ai-logist/api test src/__tests__/schema.test.ts` (asserts generated SQL contains `geography(Point, 4326)`, `gist`, `CHECK ST_SRID`) | ❌ Wave 0 |
| DB-10 | Seed runs idempotently | integration | `pnpm seed && pnpm seed` (second run produces no errors, no duplicates) — manual smoke until automated | ❌ manual for Phase 1 |
| API-01 | `/api/health` returns 200 with PostGIS version | integration | `pnpm --filter @ai-logist/api test src/__tests__/health.test.ts` (uses `app.inject()`) | ❌ Wave 0 |
| API-02 | Drizzle repos compile and execute basic CRUD | unit | `pnpm --filter @ai-logist/api test src/persistence/repos/__tests__/*.test.ts` | ❌ Wave 0 |
| API-16 | Zod schema validation rejects malformed body | integration | Part of `health.test.ts` — send invalid query, expect 400 | ❌ Wave 0 |
| DEPLOY-01 | docker-compose boots all services | manual-only | `docker compose up -d && docker compose ps` — verify all healthy | manual |
| DEPLOY-02 | Node 22 `--env-file` loads `.env.local` | smoke | covered by config.ts Zod test; if missing var → process.exit(1) | ❌ Wave 0 |
| DEPLOY-03 | pnpm workspaces resolve `@ai-logist/shared-types` | smoke | `pnpm tsc` passes (proves cross-package types resolve) | already passes via TS check |
| DEPLOY-04 | README is followable on clean machine | manual-only | dry-run by a fresh developer at end of phase | manual |

### Sampling Rate

- **Per task commit:** `pnpm --filter @ai-logist/api test` (Vitest watch) — fast, no Docker dep
- **Per wave merge:** `pnpm tsc && pnpm lint && pnpm test` + manual `docker compose up -d && curl http://localhost:3000/api/health`
- **Phase gate:** Full suite green + README dry-run succeeds in ≤10 min on a clean machine before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/api/vitest.config.ts` — Vitest config; sets root, `globals: false`, includes `testcontainers` setup for postgis tests
- [ ] `apps/api/src/__tests__/postgis.test.ts` — covers DB-01: spin up Testcontainers `postgis/postgis:17-3.5`, run all migrations, assert `SELECT PostGIS_Version()` succeeds
- [ ] `apps/api/src/__tests__/schema.test.ts` — covers DB-02..09: snapshot the generated `drizzle/0001_init.sql` and assert it contains `geography(Point, 4326)`, `USING gist`, `CHECK (ST_SRID(geom) = 4326)`
- [ ] `apps/api/src/__tests__/health.test.ts` — covers API-01, API-16: uses Fastify `app.inject()` with a stub DB/redis, asserts schema validation
- [ ] `apps/api/src/__tests__/_helpers/test-db.ts` — shared Testcontainers helper that returns a `NodePgDatabase` for integration tests
- [ ] Framework install: `pnpm --filter @ai-logist/api add -D vitest testcontainers @testcontainers/postgresql`

## Sources

### Primary (HIGH confidence)

- [Drizzle ORM — PostGIS geometry point guide](https://orm.drizzle.team/docs/guides/postgis-geometry-point) — official `geometry()` column, GiST index, `<->` KNN. Confirms no `geography` helper.
- [Drizzle ORM — Custom migrations](https://orm.drizzle.team/docs/kit-custom-migrations) — `drizzle-kit generate --custom --name=…` for SQL-only migrations.
- [Drizzle ORM — PostgreSQL extensions](https://orm.drizzle.team/docs/extensions/pg) — `extensionsFilters` config.
- [Drizzle ORM — drizzle-kit generate](https://orm.drizzle.team/docs/drizzle-kit-generate)
- [Drizzle ORM — drizzle-kit migrate](https://orm.drizzle.team/docs/drizzle-kit-migrate)
- [Fastify v5 Migration Guide](https://fastify.dev/docs/latest/Guides/Migration-Guide-V5/) — `setValidatorCompiler`/`setSerializerCompiler` names.
- [fastify-type-provider-zod README](https://github.com/turkerdev/fastify-type-provider-zod) — verified setup snippet (validatorCompiler, jsonSchemaTransform).
- [@fastify/sensible — README](https://github.com/fastify/fastify-sensible) — confirms `reply.notImplemented()` (501) helper.
- [Caddy `handle` directive](https://caddyserver.com/docs/caddyfile/directives/handle) — preserves URL path.
- [Caddy `handle_path` directive](https://caddyserver.com/docs/caddyfile/directives/handle_path) — strips URL prefix (NOT what we want).
- [`postgis/postgis:17-3.5` Docker image](https://hub.docker.com/r/postgis/postgis/) — confirms image tag.
- [PostGIS 3.5 manual — geography type](https://postgis.net/docs/manual-3.5/postgis-en.html) — confirms `geography(Point, 4326)` syntax.
- [PostGIS — `<->` KNN operator](https://postgis.net/docs/geometry_distance_knn.html) — confirms sphere semantics on geography, GiST requirement.
- [Pitfall #2 — KNN sphere vs spheroid + Crunchy Data CTE re-rank pattern](../../research/PITFALLS.md) — source for the canonical smoke query.
- [Pitfall #3 — `CREATE EXTENSION postgis` first migration](../../research/PITFALLS.md)
- [STACK.md](../../research/STACK.md) — locked stack versions (Fastify 5.8.5, Drizzle 0.45.2, Postgres 17, PostGIS 3.5).

### Secondary (MEDIUM confidence)

- [Drizzle discussion #1618 — Custom types on the other side of the driver](https://github.com/drizzle-team/drizzle-orm/discussions/1618) — `customType` pattern adapted for `geography`.
- [Drizzle discussion #2383 — Geometric Types in PostgreSQL](https://github.com/drizzle-team/drizzle-orm/discussions/2383) — community confirms geography is not built-in.
- [Drizzle PR #3021 — Add implementation of geography type](https://github.com/drizzle-team/drizzle-orm/pull/3021) — confirms `geography` helper is still open as of research date (not in 0.45.2 release).
- [Gist by ItsWendell — Experimental geometry customType](https://gist.github.com/ItsWendell/65a107c0f8de00fdd6e4f3935789ce5a) — implementation reference for `toDriver`/`fromDriver`.
- [NestJS + Drizzle PostGIS Polygons (Mustkeem K)](https://mustkeemk.com/blogs/nestjs-tutorial/api-nestjs-postgis-polygons-postgresql-drizzle) — independent confirmation of customType pattern.

### Tertiary (LOW confidence — verify before committing)

- *None for this phase — every claim above traces to an official doc or pinned npm version.*

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** — every version verified via `npm view <pkg> version` 2026-06-08; STACK.md is locked.
- Drizzle `geography` customType: **MEDIUM-HIGH** — pattern documented in two Drizzle discussions; verified that `geography` helper is not in 0.45.2 (PR #3021 open). Recommend Wave 0 smoke test asserting generated SQL contains `geography(Point, 4326)` literal.
- Fastify v5 + Zod + Swagger: **HIGH** — verbatim from official README; `notImplemented()` confirmed in sensible docs.
- Drizzle Kit custom migration: **HIGH** — official docs confirm `--custom --name=…` flow.
- Caddy routing (`handle` vs `handle_path`): **HIGH** — official docs verified the distinction; Pitfall #3 (this research) documents the trap.
- docker-compose topology: **HIGH** — image tags verified, healthcheck syntax standard.
- Canonical KNN smoke query: **MEDIUM** — adapted from PITFALLS.md Pitfall #2 (Crunchy article does NOT actually contain this exact CTE form — Crunchy demonstrates `<->` without the re-rank; the re-rank step is justified separately by PostGIS ticket #3127). Phase 2 should verify with `EXPLAIN ANALYZE`.
- Common pitfalls: **HIGH** — three out of six pitfalls (geography missing, extension ordering, `handle_path`) confirmed by primary sources; the remaining three (Zod v4 imports, pino-pretty in prod, workspace symlinks) are well-known TypeScript ecosystem patterns.

**Research date:** 2026-06-08
**Valid until:** 2026-07-08 (30 days; stack is locked, but watch Drizzle 0.45.x → 1.0 GA in case `geography` helper lands)
