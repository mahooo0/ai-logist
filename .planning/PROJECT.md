# AI-Логист

## What This Is

Бэкенд-оркестратор + веб-админка для логистической компании, который принимает обращения клиентов через Telegram-бот и голосовые звонки, автоматически распознаёт заявку, подбирает ближайшую свободную машину из собственного парка (или с биржи как fallback), рассчитывает цену, проводит лида по воронке продаж и создаёт заказ с живым GPS-трекингом до выгрузки. Менеджер видит всё в админке: диалоги, воронку Kanban, парк, заказы, живую карту перевозок, KPI.

## Core Value

**Диалог ведёт LLM, но решения по деньгам и подбору принимает детерминированный код** — цена и подбор машины должны быть предсказуемыми, тестируемыми, воспроизводимыми. Если этот принцип нарушен — система теряет доверие бизнеса.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

**Phase 1 — Database + Backend Skeleton (2026-06-09):**
- ✓ PostgreSQL 17 + PostGIS 3.5 схема (13 таблиц включая 7 расширений demo-credibility: extended cargo fields, price_overrides jsonb[], pod_artifacts, tax_id, webhook_updates, truck_positions, orders.public_token) — Phase 1
- ✓ REST API контракт через 16 эндпоинтов с Zod-схемами в `packages/shared-types` (501 stubs для Phase 2/3/4) — Phase 1
- ✓ Сидинг парка (30 RU/UA городов + 5 пограничных, 12 машин, 8 клиентов, pricing config) — Phase 1
- ✓ `docker compose up` топология (Postgres+PostGIS, Redis, Fastify api, Next.js web, Caddy) — Phase 1
- ✓ pnpm workspaces монорепо (apps/api, apps/web, packages/shared-types), Zod env, Vitest + testcontainers test infra — Phase 1
- ✓ /api/health с PostGIS_Version() — Phase 1
- ⏳ UAT-01: human verification 10-min walkthrough на чистой машине — отложено (Docker недоступен в runner-окружении агентов)

**Phase 2 — LLM Pipeline + Deterministic Core (2026-06-09):**
- ✓ Anthropic SDK + betaZodTool registry: 6 tools (extractRequest, detectLanguage, nearestTruck, calcPrice, createOrder, discount) — Phase 2
- ✓ Sticky RU/UA language detection (Cyrillic-script heuristic + ≥20-char gate) — Pitfall #7 closed — Phase 2
- ✓ PostGIS KNN с CTE re-rank (overfetch 20 + spheroid ST_Distance) — Pitfall #2 closed — Phase 2
- ✓ Детерминированный calcPrice + price-lock протокол (quoted_price пишется в БД ДО ответа LLM; regex guard) — Pitfall #1 closed — Phase 2
- ✓ Hand-rolled FSM (Lead 9 stages + Order 7 statuses) с SELECT FOR UPDATE + version CAS — Pitfall #6 closed (100× concurrency test зелёный) — Phase 2
- ✓ Anti-prompt-injection: ANTI_INJECTION_PREFIX + `<client_message>` wrapping + tools-as-security-boundary — Pitfall #11 closed — Phase 2
- ✓ Per-lead token ledger (tokens_in/out/llm_calls) + 30k budget → LOST — Pitfall #12 closed — Phase 2
- ✓ Pipeline intake.ts полный (advisory lock → sticky lang → token check → extract → clarify → match → price-lock → confirm → createOrder) — Phase 2
- ✓ Follow-up scheduler (setInterval с fake-timers test, Fastify lifecycle hook) — Phase 2
- ✓ POST /api/leads/:id/match + /:id/quote реальные handler'ы (был 501 stub в Phase 1) — Phase 2
- ✓ 148 unit tests passing / 0 todos; snapshot byte-stable across 10× runs — Phase 2
- ⏳ UAT-02: Docker-gated integration tests (12 файлов) — требует Docker daemon для testcontainers PostGIS

**Phase 3 — Telegram Channel (2026-06-10):**
- ✓ grammY 1.43 webhook через Fastify (`/webhook/telegram`) с two-stage handler — ack <100мс, async worker через setImmediate
- ✓ Idempotency через `webhook_updates` UNIQUE(source, external_id) + `ON CONFLICT DO NOTHING`
- ✓ Secret_token верификация (`X-Telegram-Bot-Api-Secret-Token` header)
- ✓ Адаптер `Telegram update → InboundArgs` → вызывает Phase 2 `handleInboundMessage` (intake.ts surgical edit 25 строк ≤30 бюджет)
- ✓ `OutboundChannel + OutboundRegistry` abstraction (готов к Phase 3.1 Voice)
- ✓ Inline-кнопки на стадии QUOTED (Подтвердить / Изменить / Отказаться) RU/UA-aware
- ✓ Callback query handler — синтетический «да/нет/изменить» → handleInboundMessage
- ✓ Driver confirmation loop: бот пишет водителю (если `truck.driver_telegram_id`), кнопки Принять/Отказаться. Driver decline → `order→CLOSED + lead→LOST(reason='driver_declined')`
- ✓ Manager intercept: `leads.manager_active` колонка + 3 endpoints (`POST /api/leads/:id/{intercept,manager-message,release}`)
- ✓ Client notifications: hook на order FSM transitions (DRIVER_ASSIGNED, IN_TRANSIT, DELIVERED) — i18n RU/UA, skip если нет telegram_id
- ✓ `/api/health.checks.telegram` с 60с TTL кэшем (rate-limit safe)
- ✓ Migration 0003 (только `leads.manager_active` — `trucks.driver_telegram_id` УЖЕ был TEXT из Phase 1)
- ✓ 157 unit tests passing / 0 todos; 8 integration scaffolds gated by Docker
- ⏳ UAT-03: реальный Telegram chat smoke через BotFather + ngrok (9-step protocol в HUMAN-UAT.md)

**Phase 3.1 — Voice Channel (ElevenLabs + Twilio) ⚠ HIGH RISK (2026-06-10):**
- ✓ Voice tool handlers ОБЁРТКИ над Phase 2 tools (extract-request, nearest-truck, calc-price, create-order, discount) — НЕ дублируем, Phase 2 byte-identical
- ✓ 5 voice tool callbacks + 3 lifecycle handlers (call-start, call-end, lang-detected) под `/webhook/voice/*` prefix
- ✓ Price-lock через voice: calc-price пишет `quoted_price` в БД ДО return; create-order вызывает Phase 2 createOrderHandler который re-reads из БД (Pitfall #1 inheritance)
- ✓ Anti-injection: ANTI_INJECTION_PREFIX скопирован VERBATIM из Phase 2 system-prompt.ts в elevenlabs-agent-config.md
- ✓ Advisory lock per `conversation_id` в каждом voice tool handler (Pitfall #6)
- ✓ Idempotency через `webhook_updates` UNIQUE(source, external_id) с source='elevenlabs'
- ✓ HMAC signature verification: `verifyElevenLabsSignature` + `validateTwilioRequest` через Fastify preHandler
- ✓ Migration 0004: добавляет 6 calls колонок + `call_outcome` enum + 2 UNIQUE индексы (elevenlabs_conversation_id, twilio_call_sid)
- ✓ 8 новых env vars (TWILIO_*, ELEVENLABS_*, VOICE_PUBLIC_URL) с `requireVoiceConfig()` boundary guard
- ✓ VoiceOutbound в OutboundRegistry — no-op для sendQuoteKeyboard (Agent сам произносит цену)
- ✓ `/api/health.checks.voice` с 60с TTL cache (rate-limit safe)
- ✓ Bootstrap script `pnpm voice:setup` — idempotent ElevenLabs Agent register + Twilio config check
- ✓ ElevenLabs Agent system prompt RU+UA в `elevenlabs-agent-config.md` (versioned doc)
- ✓ README "Voice Dev Setup" 7-step section
- ✓ VOICE-12 boundary test (Drizzle introspection) — `/dashboard/calls` UI отложено в Phase 4
- ✓ 187 unit tests passing / 0 todos
- ⏳ UAT-04: реальный звонок через Twilio + ElevenLabs (10-step protocol в HUMAN-UAT.md, ~$15 cost)

**Phase 4 — Admin Web (REDUCED scope — chat + calls + orders + KPI) (2026-06-11):**
- ✓ Zenith Admin template (`mahooo0/next-shadcn-admin-dashboard` @ SHA `4e667cc`) vendored в `apps/web/` — Phase 4 (ADMIN-01)
- ✓ Auth gate via Next.js 16 `proxy.ts` (Pitfall #4) + bcrypt (cost-12) + jose HS256 12h JWT + HTTP-only sameSite=lax secure cookie `al_session` — Phase 4 (ADMIN-02)
- ✓ `/dashboard/chat` мульти-канальный mixed-timeline view — Telegram bubbles + voice transcript turns с inline audio seek (`audio.currentTime = timestampMs/1000`); manager intercept controls на Telegram threads только (voice threads никогда — D-47) — Phase 4 (ADMIN-03)
- ✓ `/dashboard/calls` table — 6 columns (timestamp, phone-masked, lang, duration mm:ss, outcome color badge, linked_order) + URL-bookmarkable filters (outcome/lang/date) + shadcn Dialog modal с audio player + full transcript + Open lead/Open order — Phase 4 (ADMIN-NEW-08)
- ✓ `/dashboard/orders` table — 7 columns с joined city names + client + channel; row click → `/orders/[id]` full page (не modal) — Phase 4 (ADMIN-NEW-02)
- ✓ `/dashboard/orders/[id]` read-only детальная карточка — header (number + status + price), 4 cards (client/route/truck/cargo), vertical `order_events` timeline, source-channel breadcrumb ("Прослушать звонок" / "Открыть диалог") — Phase 4 (ADMIN-NEW-03)
- ✓ `/dashboard/default` + `/analytics` KPI dashboards — recharts (conversion funnel 5-stage, channel split donut, revenue trend line, calls per day bar, avg call duration sparkline); day/week/month window selector — Phase 4 (ADMIN-05)
- ✓ Backend: 5 routes flipped (GET /api/leads, /orders +:id, /trucks, /clients/:id/messages UNION, /analytics/kpi v2) + 1 NEW file (`apps/api/src/routes/calls.ts`) — Phase 4 (API-03, API-04, API-05, API-06, API-09)
- ✓ shared-types extensions: NEW `api/calls.ts` (Call/CallDetail/CallListQuery); extended `analytics.ts` (KpiResponse v2 с avgCallDurationS + byChannel + 5-stage conversionFunnel); `orders.ts` (OrderListItem + OrderDetailExtended); `clients.ts` (UnifiedMessage)
- ✓ RU/UA dictionary + `useT()` hook + Customize-panel toggle hooked to existing Zenith preferences Zustand store — Phase 4 (I18N-02)
- ✓ Sidebar trimmed to 5 shipped routes (Default/Analytics/Chat/Calls/Orders); другие пункты commented-out (не удалены — D-48/D-49 для v2 re-enable)
- ✓ Pitfall #13 защитные grep guards (5/5 GREEN): нет `'use cache'` на /chat/calls/orders; border-border explicit; page.tsx Server / `_components/*` client convention
- ✓ apps/api: 200 passed | 0 todo | phase-4-stubs marker count = 0 (все 13 reqs flipped); apps/web: 28 passed | 0 todo (первый запуск vitest+RTL+happy-dom на этом проекте)
- ⏳ UAT-05: 8-step human protocol в HUMAN-UAT-05.md (Telegram smoke → Voice smoke → login → 6 pages → manager intercept → RU↔UA toggle) — отложено (Docker недоступен + требует реальный Telegram/Twilio)
- ⏳ 319 pre-existing Zenith vendor Biome errors → deferred-items.md (out of scope per SCOPE BOUNDARY; v2 path: extend `biome.json` ignore list)

### Active

<!-- Current scope. Building toward demo per §9 of spec. -->

**Каналы (Phase 3 — следующая):**
- [ ] Telegram webhook + grammY bot (две-этапный handler с update_id идемпотентностью) — Phase 3
- [ ] Inline-кнопки + driver confirmation loop + manager intercept — Phase 3

**Веб-админка (Phase 4):**
- [ ] Форк next-shadcn-admin-dashboard, 4 existing pages подключены + 3 новых (fleet/orders/tracking) — Phase 4

**Трекинг (Phase 5):**
- [ ] WebSocket эндпоинты (/ws/tracking, /ws/inbox) — Phase 5
- [ ] GPS-симулятор по OSRM маршруту + Geofence auto-FSM транзитов — Phase 5
- [ ] Cycle трекинга: позиция → WebSocket → автоматические события заказа по гео-фенсу — §4.7 — Phase 5
- [ ] Fallback на биржи ATI.SU / Lardi-Trans (Phase 2 stub → реальные API в v2) — §4.6 → отложено к v2 EXT-01/02

**Demo polish (Phase 6):**
- [ ] ICU pluralization, voice fallback video, локали дат — Phase 6

**Telegram-канал:**
- [ ] Telegram-бот (aiogram или grammY) с webhook → пайплайн §3
- [ ] Inline-кнопки (подтвердить рейс, посмотреть статус)
- [ ] Карточки рейсов и ссылка на страницу трекинга
- [ ] Возможность менеджеру «перехватить» диалог из админки

**Веб-админка (на базе next-shadcn-admin-dashboard):**
- [ ] Клонировать шаблон mahooo0/next-shadcn-admin-dashboard, подключить к бэкенд API
- [ ] Страница /dashboard/chat — мульти-канальный чат, статусы Open/Pending/Resolved + WS /ws/inbox — §7.2
- [ ] Страница /dashboard/kanban — воронка лидов с DnD по стадиям §4.4, PATCH /api/leads/:id — §7.2
- [ ] Страница /dashboard/default + /analytics — KPI: звонки, конверсия, выручка из /api/analytics/kpi — §7.2
- [ ] **Новая** страница /dashboard/fleet — таблица парка машин + CRUD-формы (RHF+zod), phone-input для водителей — §7.2
- [ ] **Новая** страница /dashboard/orders + /dashboard/orders/[id] — таблица + детальная карточка с таймлайном order_events — §7.2
- [ ] **Новая** страница /dashboard/tracking — Leaflet + WS /ws/tracking, точки машин, маршруты, ETA — §7.2
- [ ] Страница /dashboard/calendar — события загрузок/выгрузок заказов — §7.2
- [ ] Аутентификация через /auth/v1/login или /auth/v2/login — §7.2

**Двуязычие RU/UA:**
- [ ] Словарь RU/UA, переключатель в Customize-панели шаблона — §7.2
- [ ] Автоопределение языка клиента из текста (ru/ua), сохранение в clients.lang — §2

**Интеграции (точки подключения, минимум для демо):**
- [ ] Telegram Bot API — реальный бот для текстового канала
- [ ] Geocoding API (Mapbox/HERE/OSM) — нормализация городов в cities, кэш в БД
- [ ] Routing API — расчёт route_km и ETA для трекинга
- [ ] Leaflet + OSM на фронте — карта трекинга
- [ ] LLM (Claude/GPT-4o) — function calling для extractRequest и ведения диалога

### Out of Scope (для демо)

- **Реальный голосовой канал через ElevenLabs Agents + SIP-trunk (Twilio/Telnyx)** — §5.2 спеки помечает голос как «опционально для демо». Логика tools общая с текстом, добавляется поверх. Откладываем до подтверждения базы.
- **Реальная интеграция с биржами ATI.SU и Lardi-Trans API v2** — для демо достаточно стаба `bourse_cache`. Реальные API подключаются после демо.
- **Wialon Open API для GPS-трекинга** — для демо машина двигается через симуляцию/приложение водителя. §9.5 явно: «для демо — приложение водителя/симуляция».
- **SMS-уведомления** — Telegram достаточно для демо. §5.3 помечает SMS как опц.
- **Многотенантность / роли** — однопользовательская админка под одного менеджера. Demo focus.
- **Полноценный CRM-функционал** (сегменты, рассылки, отчёты по клиентам) — оставляем стандартные виджеты шаблона без кастомной аналитики.
- **Производственная безопасность** (rate limiting, audit log, шифрование PII в БД) — добавляется после демо.
- **Мобильное приложение водителя как продукт** — для демо можно прокидывать координаты простым endpoint'ом, либо симулировать.

## Context

**Бизнес-домен:** Грузоперевозки (РФ/Украина и ближнее зарубежье). Клиенты — грузоотправители, заказчик системы — логистическая компания с собственным парком фур. Сценарий: клиент пишет в Telegram «Киев-Львов, 18 тонн, тент» — система должна за минуты подобрать машину, дать цену, оформить заказ.

**Уже существующие активы:**
- Полная техспека `ai-logist-logic-spec.md` (этот файл — единый источник правды).
- Связанные документы: `ai-logist-tech-vision.md` (стек), `ai-logist-arhitektura.md` (источники данных), `ai-logist-demo.html` (кликабельный прототип UI).
- Готовый шаблон админки **next-shadcn-admin-dashboard** (Zenith Admin) — Next.js 16 App Router + React 19 + Tailwind v4 + shadcn/ui + Zustand + RHF + zod. Из 8 экранов **4 уже готовы** в шаблоне (chat, kanban, dashboards, calendar, auth), **3 добавляем** (fleet, orders, tracking).

**Архитектурные принципы:**
- Бэкенд и фронт развязаны через REST + WebSocket — фронт может быть собран отдельно.
- Все «деньги» и «подбор» — детерминированный код (tools), которые LLM вызывает. LLM не свободен в решениях по цене.
- `page.tsx` в Next.js — серверный (SSR первичный fetch), интерактивность в одном клиентском контейнере `_components/<feature>-app.tsx` (конвенция репо шаблона).

## Constraints

- **Tech stack — бэкенд**: PostgreSQL 15+ с расширением PostGIS (KNN-запросы по точкам, GiST-индексы), Redis для кэша/состояния FSM (опц.). Язык/фреймворк бэкенда не зафиксирован спекой — будет выбран на этапе research (вероятно Node.js/TypeScript для единства со фронтом, либо Python для удобства LLM-интеграций).
- **Tech stack — фронт**: жёстко зафиксирован спекой §7.1 — Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Zustand, react-hook-form + zod, sonner, lucide-react, libphonenumber-js, date-fns, @dnd-kit, pnpm. Lint — Biome.
- **Шаблон админки**: mahooo0/next-shadcn-admin-dashboard, MIT-лицензия. Не ломаем существующие экраны, добавляем новые по конвенции из его CLAUDE.md (§7.3).
- **Двуязычие**: интерфейс админки + диалоги бота должны работать на RU и UA. Автоопределение языка клиента из текста.
- **Демо-срок**: реалистично собрать в 1-2 недели с упором на §9 спеки. Реальные интеграции (голос, биржи, Wialon) откладываются.
- **LLM**: используется Claude или GPT-4o с function calling. Промпт принуждает строгий JSON — нераспознанные поля = null.
- **Геоданные**: PostGIS обязателен для запроса «ближайшая свободная машина» (KNN `<->` оператор).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Tech stack фронта — фиксированный шаблон Zenith Admin | Шаблон покрывает 4 из 8 экранов готовыми кусками (chat, kanban, dashboards, calendar, auth), экономия времени на демо | — Pending |
| PostgreSQL + PostGIS как единая БД | KNN-запросы для подбора машин делаются одним SQL без отдельного гео-сервиса | — Pending |
| LLM решает только семантику, цена/подбор — детерминированный код через tools | Прозрачность и тестируемость, цена не «придумывается» моделью | — Pending |
| Демо без реального голосового канала | §5.2 явно помечен «опционально для демо», логика tools общая с текстом — добавляется поверх | — Pending |
| Демо без реальных бирж и Wialon | §9 даёт явный порядок сборки демо — биржи и GPS-провайдер заменяются стабом/симуляцией | — Pending |
| **Бэкенд = Node.js 22 LTS + TypeScript + Fastify 5** (не Python, не NestJS) | (1) Фронт уже на TS — общие Zod-схемы между LLM tools / REST / WS. (2) Drizzle ORM имеет официальный PostGIS-гайд (geometry + GiST + `<->` KNN). (3) Anthropic TS SDK даёт `betaZodTool` + `toolRunner` — function-calling цикл out-of-the-box. (4) NestJS — overkill для модульного монолита: его DI-контейнер не нужен, Fastify даёт schema-validated routes под «строгий JSON» LLM-контракт + native WebSocket. Python (FastAPI + aiogram) рассмотрен и отвергнут — выигрыша нет, потеря в общем коде с фронтом | ✓ Good |
| Telegram-библиотека: grammY 1.43 (TS-native, webhook-first) | Соответствует выбору Node + унифицированный стиль с фронтом | ✓ Good |
| Двуязычие RU/UA через i18n-словарь в Customize-панели шаблона | Шаблон уже имеет переключатель Language preference, нужно только подключить словарь | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-11 after Phase 4 completion*
