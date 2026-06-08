# Phase 1: Database + Backend Skeleton — Context

**Gathered:** 2026-06-08 (auto mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Фундамент проекта: монорепо `pnpm` workspaces, Fastify-каркас API, Postgres 17 + PostGIS 3.5 в docker-compose, полная схема БД из спеки §2 расширенная под demo-credibility (cargo dimensions, POD, audit log, webhook idempotency), сидинг реалистичных данных RU/UA, `/api/health` с PostGIS-проверкой, README на 10-минутный старт. **Только фундамент** — никакой бизнес-логики, никакого LLM, никакой Telegram-интеграции. После Phase 1 любой разработчик с `docker compose up` получает рабочий API-каркас, в который Phase 2 принесёт LLM-пайплайн и матчинг.

</domain>

<decisions>
## Implementation Decisions

### Migrations & Schema Management
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
- **D-06:** Enum'ы лида и заказа определены в БД как PostgreSQL ENUM-типы (`lead_stage`, `order_status`, `order_event_type`, `body_type_t`, `truck_status`, `client_lang`) — соответствуют спеке §4.4 и §4.5.

### Repository / Data Access Pattern
- **D-07:** Тонкие репозитории по агрегатам (`apps/api/src/persistence/repos/{trucks,leads,orders,clients,cities,messages,calls}.ts`). Каждый репо — это коллекция функций `findById`, `create`, `update`, `list` с типизированными аргументами через Drizzle.
- **D-08:** Для PostGIS-тяжёлых запросов (KNN, ST_DWithin, ST_Distance с CTE re-rank) — **hand-written SQL через `db.execute(sql\`…\`)`**. Drizzle query-builder покрывает 80%, оставшиеся 20% — сырой SQL с биндингами. Не пытаться обернуть `<->` в DSL.
- **D-09:** Транзакции вызываются явно через `db.transaction(async (tx) => …)`. Никаких декораторов или AOP — Fastify-handler начинает транзакцию там, где нужно (FSM, webhook ingestion).

### Monorepo & Tooling
- **D-10:** Чистые **pnpm workspaces**. Никакого Turborepo / Nx — для 3 пакетов это лишний слой.
  - `apps/api` — Fastify backend
  - `apps/web` — Next.js admin (плейсхолдер в Phase 1, реальная работа в Phase 4)
  - `packages/shared-types` — Zod-схемы для DTO/событий, общие для api и web
- **D-11:** TypeScript 5.7, `strict: true`, ESM везде (`"type": "module"`), `tsconfig` через extends из корня. Цель — `pnpm exec tsc --noEmit` без ошибок.
- **D-12:** Biome для линта и форматирования (выбор шаблона `next-shadcn-admin-dashboard`). Используем тот же `biome.json` через extends.
- **D-13:** Node.js 22 LTS. ENV через нативный `--env-file=.env.local` (не `dotenv`). `.env.example` коммитим, `.env.local` — в gitignore.

### Env Validation & Config
- **D-14:** Конфиг приложения валидируется Zod-схемой при старте Fastify. При невалидных переменных — лог + `process.exit(1)`. Никаких runtime-`process.env.X`-обращений за пределами `apps/api/src/config.ts`.
- **D-15:** Минимальный набор env для Phase 1: `NODE_ENV`, `PORT`, `DATABASE_URL`, `REDIS_URL`, `LOG_LEVEL`. LLM-ключи и Telegram-токен добавятся в Phase 2 и Phase 3, но в Zod-схеме их можно сделать `optional()`.

### Health & Observability
- **D-16:** `GET /api/health` возвращает JSON:
  ```json
  {
    "status": "ok",
    "version": "<git short sha>",
    "uptime_s": 123,
    "checks": {
      "db": "ok",
      "postgis": "3.5.x",
      "redis": "ok"
    }
  }
  ```
  Если что-то не отвечает — 503 со списком сломанного. Это уже сейчас даёт демо-площадке pre-flight чек.
- **D-17:** Структурированные логи через Fastify's pino (по умолчанию). `LOG_LEVEL=info` в проде/демо, `debug` локально. Никаких console.log.

### Seed Data
- **D-18:** Сидинг — **TypeScript-скрипт** `apps/api/src/seed/run.ts`, запускается через `pnpm seed`. Использует те же репозитории, что и боевой код, — type-safe.
- **D-19:** Объём seed:
  - **Cities (~30):** Москва, Санкт-Петербург, Воронеж, Ростов-на-Дону, Краснодар, Сочи, Казань, Нижний Новгород, Самара, Екатеринбург, Новосибирск, Калининград + Київ/Киев, Львів/Львов, Одеса/Одесса, Харків/Харьков, Дніпро/Днепр, Запоріжжя/Запорожье, Чернігів, Полтава, Вінниця, Луцьк, Ужгород, Ивано-Франковск + 5+ пограничных переходов (Гоптівка, Шегині, Краковец, Ягодин, Брест).
  - **Trucks (12):** разные типы кузова (tent×5, ref×3, iso×2, container×2), разный тоннаж (5/10/18/20/22т), разные позиции на карте (стартуют в крупных городах), все `status='available'`. У каждой машины — фейковый госномер и телефон водителя в E.164.
  - **Clients (8):** 4 RU + 4 UA, у каждого валидный `phone` и `lang`, у двух — `telegram_id` для Phase 3.
  - **Pricing config:** `rate_per_km=42 ₽/км` (хранится в копейках), `dir_coef` JSON по направлениям (по умолчанию 1.0, для обратки — 0.85), `season_coef=1.1` (июнь = высокий сезон).
- **D-20:** Сидинг идемпотентен — `INSERT … ON CONFLICT DO NOTHING` через unique-ключи (госномер машины, телефон клиента, slug города).
- **D-21:** В seed-выводе печатается **canonical KNN query** для smoke-теста: «возьми точку Киева и покажи 3 ближайшие свободные машины» — это закрывает success criterion #3.

### Docker Compose Topology
- **D-22:** Сервисы в `docker-compose.yml`:
  - `postgres` — `postgis/postgis:17-3.5`, volume для данных, port `5432` пробрасывается только локально
  - `redis` — `redis:7-alpine`, persistent volume, port `6379` пробрасывается локально
  - `api` — Fastify, build из `apps/api`, expose `:3000`
  - `web` — Next.js плейсхолдер (`next start` после `next build`), expose `:3001`
  - `caddy` — `caddy:2-alpine`, маппит 80/443 на `api` (`/api/*`, `/webhook/*`, `/ws/*`) и `web` (всё остальное). Caddyfile в репо.
- **D-23:** `.env.example` лежит в корне, инструкция в README:
  1. `cp .env.example .env.local`
  2. `docker compose up -d postgres redis`
  3. `pnpm install && pnpm db:migrate && pnpm seed`
  4. `pnpm dev`
- **D-24:** Caddy конфигурируется на `:80` локально (без TLS) и `:443` с auto-ACME на проде. Для demo VPS — одна команда `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`.

### REST Skeleton (Phase 1 scope only)
- **D-25:** В Phase 1 реализуется только `GET /api/health`. Остальные эндпоинты из API-* списка — заглушки `501 Not Implemented` с правильными zod-схемами в OpenAPI. Так Phase 2/3/4 знают контракт заранее.
- **D-26:** OpenAPI / Swagger UI через `@fastify/swagger` + `@fastify/swagger-ui` на `/api/docs` — для review менеджером и для onboarding следующих разработчиков.
- **D-27:** Zod-схемы DTO живут в `packages/shared-types` и импортируются в `apps/api` (validation) и в `apps/web` (typed fetch). Это main payoff TypeScript-стека.

### Claude's Discretion
- Конкретная структура Drizzle-моделей (одна большая `schema.ts` или разбивка по доменам) — Claude решает на этапе планирования.
- Имя и формат seed-файлов SQL (например, выделять городов в JSON-фикстуру vs хардкодить в TS) — Claude решает.
- Структура Fastify-плагинов (autoload или явная регистрация) — Claude решает.
- Конкретный pino-формат логов (json vs pretty в dev) — Claude решает.

### Folded Todos
*Нет — backlog пуст на этой фазе.*

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec & Project Docs (single source of truth)
- `ai-logist-logic-spec.md` §2 — модель данных (clients, cities, trucks, leads, orders, order_events, calls, messages, bourse_cache)
- `ai-logist-logic-spec.md` §4.2 — PostGIS KNN запрос (база для Phase 2, но индексы и колонки готовятся в Phase 1)
- `ai-logist-logic-spec.md` §6 — REST + WebSocket эндпоинты (полный контракт, в Phase 1 — стабы 501)
- `ai-logist-logic-spec.md` §9.1 — порядок сборки: "Postgres+PostGIS, модели §2, REST-эндпоинты §6, сидинг парка"
- `.planning/PROJECT.md` — выбор стека (Node 22 + Fastify + Drizzle + Postgres 17/PostGIS 3.5 + Redis + grammY + Anthropic SDK)
- `.planning/REQUIREMENTS.md` — Phase 1 покрывает DB-01..10, API-01, API-02, API-16, DEPLOY-01..04

### Research
- `.planning/research/STACK.md` — версии библиотек: Fastify 5.8, Drizzle 0.45.2, Postgres 17, PostGIS 3.5 (`postgis/postgis:17-3.5`), Node 22 LTS, pnpm workspaces, Caddy
- `.planning/research/ARCHITECTURE.md` — 11 модулей, public-surface boundaries, deployment topology
- `.planning/research/PITFALLS.md` Pitfall #2 — KNN sphere ≠ ST_Distance spheroid, CTE re-rank pattern (база заложена индексом в Phase 1)
- `.planning/research/PITFALLS.md` Pitfall #3 — `CREATE EXTENSION postgis` отдельной миграцией, SRID-CHECK constraint, `/api/health` возвращает `PostGIS_Version()`

### External Library Docs (для researcher и planner)
- Drizzle ORM PostGIS guide — https://orm.drizzle.team/docs/guides/postgis-geometry-point
- Fastify v5 migration guide — https://fastify.dev/docs/latest/Guides/Migration-Guide-V5/
- PostGIS 3.5 manual — https://postgis.net/docs/manual-3.5/postgis-en.html
- postgis/postgis:17-3.5 Docker image — https://hub.docker.com/r/postgis/postgis/

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- *Нет существующего кода в репо* (greenfield). Единственный артефакт — спека `ai-logist-logic-spec.md`. Phase 1 закладывает всё с нуля.
- Frontend-шаблон `mahooo0/next-shadcn-admin-dashboard` будет клонирован отдельно в Phase 4, не сейчас. В Phase 1 `apps/web` — это пустой `create-next-app`-плейсхолдер с одной заглушечной страницей.

### Established Patterns (to be set by this phase)
- Этот phase **устанавливает паттерны** для всего проекта: миграции через Drizzle Kit, ENUM в БД, repo-pattern, Zod env, hand-SQL для PostGIS.
- Phase 2/3/4 будут копировать структуру из `apps/api` и `packages/shared-types` — поэтому конвенции должны быть аккуратными.

### Integration Points
- `apps/api/src/index.ts` — Fastify entry, регистрирует плагины (db, redis, swagger, health route)
- `apps/api/src/db.ts` — Drizzle client + connection pool
- `apps/api/src/config.ts` — Zod-валидированный конфиг
- `packages/shared-types/src/*.ts` — Zod-схемы для DTO, экспорт типов
- `docker-compose.yml` + `Caddyfile` — deployment surface

</code_context>

<specifics>
## Specific Ideas

- **«10-минутный старт»** — success criterion #4 надо понимать буквально: README должен быть проверен на свежей машине, с `pnpm install + docker compose up + pnpm db:migrate + pnpm seed + pnpm dev` укладывающимся в 10 мин. Это влияет на размер docker-образов и на скрипты в package.json.
- **Canonical smoke-query** для seed — это маленькое демо для самой команды, что фундамент стоит. Печатать в консоли при `pnpm seed`: «KNN от Киева → [Машина A 42км, Машина B 88км, Машина C 137км]».
- **`postgis/postgis:17-3.5`** — точное имя образа, не `postgis/postgis:latest`. Зафиксировать тег.
- В `Caddyfile` пути `/api/*`, `/webhook/*`, `/ws/*` идут на api-сервис; всё остальное (включая `/track/*` из Phase 5) — на web-сервис.

</specifics>

<deferred>
## Deferred Ideas

- **Real auth в `/api/health`** — сейчас public, в будущем закрыть через basic-auth или allowlist IP. **→ Phase 6 (POLISH-05 pre-flight checklist)**.
- **CI pipeline** (GitHub Actions для migrate + tests) — не нужно для Phase 1 demo, но запланировать. **→ Phase 6.**
- **Observability** (OpenTelemetry, метрики, трейсы) — out-of-scope для демо. **→ v2 PROD-06.**
- **Backup стратегия для Postgres-volume** — out-of-scope. **→ v2.**
- **Database seed для разных «сценариев демо»** (пустой парк → fallback на биржу; перегруженный парк → busy матчинг) — интересная идея для Phase 6 polish. **→ Phase 6.**
- **Helm-чарт для Kubernetes** — не нужно, демо живёт на одном VPS. **→ v2 PROD.**

### Reviewed Todos (not folded)
*Нет — backlog пуст.*

</deferred>

---

*Phase: 01-database-backend-skeleton*
*Context gathered: 2026-06-08 (auto mode)*
