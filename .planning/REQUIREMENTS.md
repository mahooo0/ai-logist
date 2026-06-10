# Requirements: AI-Логист

**Defined:** 2026-06-08
**Core Value:** Диалог ведёт LLM, но решения по деньгам и подбору принимает детерминированный код — цена и подбор должны быть предсказуемыми и тестируемыми.

> Источник истины: `ai-logist-logic-spec.md` (§§2-9). Требования ниже = спека §9 (порядок сборки демо) + 6 пробелов, найденных research (FEATURES.md).

## v1 Requirements

### Database & Schema (DB)

- [x] **DB-01**: Postgres 17 + PostGIS 3.5 запущены через docker-compose, `CREATE EXTENSION postgis` в первой миграции
- [x] **DB-02**: Схема `clients` создана с полями `lang ('ru'|'ua')`, `tax_id`, `tax_id_country` (EDRPOU/ИНН)
- [x] **DB-03**: Схема `cities` со столбцами `name_ru`/`name_ua` + `geom geography(Point,4326)` для нормализации городов
- [x] **DB-04**: Схема `trucks` с `geom geography(Point,4326)`, `capacity_t`, `body_type`, `status`, GiST-индекс на `geom`
- [x] **DB-05**: Схема `leads` с расширенными полями груза (`volume_m3`, `dimensions_lxwxh`, `packaging`, `adr_class`, `declared_value`) и `price_overrides jsonb[]` для audit log
- [x] **DB-06**: Схема `orders` + `order_events` с `UNIQUE (order_id, type)` для идемпотентности и таймлайна
- [x] **DB-07**: Схема `calls`, `messages`, `bourse_cache` для каналов и кэша
- [x] **DB-08**: Схема `pod_artifacts` для Proof of Delivery (signature_url, photo_url, gps, captured_at)
- [x] **DB-09**: Схема `webhook_updates` для идемпотентности Telegram по `update_id` (`ON CONFLICT DO NOTHING`)
- [x] **DB-10**: Сидинг данных: 10-15 машин, ~30 RU/UA городов + пограничные переходы, 5-10 клиентов, конфиг цен (`rate_per_km`, `dir_coef`, `season_coef`)

### Backend API & Infrastructure (API)

- [x] **API-01**: Fastify v5 + TypeScript 5.7 strict app с health-эндпоинтом `/api/health` (возвращает `PostGIS_Version()`)
- [x] **API-02**: Drizzle ORM миграции и репозитории для всех таблиц §2
- [ ] **API-03**: REST `/api/leads` (GET с фильтром по stage, PATCH для смены стадии вручную)
- [ ] **API-04**: REST `/api/orders` (GET с фильтром по status), `/api/orders/:id` (заказ + order_events)
- [ ] **API-05**: REST `/api/trucks` (GET/POST/PATCH — CRUD парка)
- [ ] **API-06**: REST `/api/clients/:id/messages` для чата админки
- [x] **API-07**: REST `/api/leads/:id/match` (пересчёт подбора) и `/api/leads/:id/quote` (пересчёт цены)
- [ ] **API-08**: REST `/api/orders` POST (ручное создание заказа менеджером)
- [ ] **API-09**: REST `/api/analytics/kpi` — звонки, конверсия, выручка для дашбордов
- [ ] **API-10**: REST `/api/orders/:id/price-override` — изменение цены менеджером, пишет в `price_overrides`
- [ ] **API-11**: WebSocket `/ws/tracking` — live-координаты машин
- [ ] **API-12**: WebSocket `/ws/inbox` — live-сообщения/звонки в чат
- [x] **API-13**: Webhook `/webhook/telegram` с проверкой `secret_token`
- [ ] **API-14**: Webhook `/webhook/gps` для приёма позиций (демо: симулятор)
- [x] **API-15**: Webhook `/webhook/voice` (stub-эндпоинт для демо, возвращает 200)
- [x] **API-16**: Schema-validated routes с Zod, общая `packages/shared-types` для DTOs

### Business Logic — LLM Pipeline (LOGIC)

- [x] **LOGIC-01**: `extractRequest(text, lang)` — Anthropic SDK `betaZodTool` извлекает `{from_city, to_city, tons, body_type?, budget?, deadline?}` со строгим JSON-Schema
- [ ] **LOGIC-02**: Sticky-определение языка клиента (RU/UA) — fastText + Cyrillic-script-эвристика, сохраняется в `clients.lang` на первом сообщении ≥20 символов
- [x] **LOGIC-03**: Нормализация городов через `cities` (ILIKE на оба `name_ru`/`name_ua`) + геокодинг Nominatim для новых, кэш в БД
- [x] **LOGIC-04**: LLM задаёт уточняющий вопрос при отсутствии ключевых полей (clarification budget — максимум 2 круга)
- [x] **LOGIC-05**: Промпт принуждает строгий JSON, нераспознанные поля = null

### Business Logic — Matching & Pricing (MATCH)

- [x] **MATCH-01**: `nearestTruck(pickup_geom, tons, body_type?)` — PostGIS KNN-запрос с CTE re-rank (overfetch 20 по `<->`, затем re-rank по `ST_Distance(geog, true)`)
- [ ] **MATCH-02**: Fallback на стаб биржи (mock-ответ `bourse_cache`) если своих машин нет
- [x] **MATCH-03**: `calcPrice(from, to, tons, body, date)` — детерминированный расчёт `route_km × rate_per_km × dir_coef × season_coef`, округление до 50, integer kopecks
- [ ] **MATCH-04**: Корректное расстояние через OSRM (`route_km`), кэш в БД
- [x] **MATCH-05**: `calcPrice` возвращает корридор `{min, max, default}` для переговоров — LLM может дать скидку только до min
- [x] **MATCH-06**: Цена сохраняется в `leads.quoted_price` ДО ответа LLM; ответ собирается шаблоном с подстановкой числа из БД (LLM не «выдумывает» цифру); regex-guard режет любое число ≠ `quoted_price` в ответе

### Business Logic — FSM (FSM)

- [x] **FSM-01**: Lead funnel: `NEW → QUALIFIED → MATCHED → QUOTED → AGREED → ORDER_CREATED → IN_PROGRESS → DONE/LOST` с таблицей разрешённых переходов
- [x] **FSM-02**: Order lifecycle: `CREATED → DRIVER_ASSIGNED → AT_LOADING → IN_TRANSIT → AT_BORDER → DELIVERED → CLOSED` с таблицей переходов
- [x] **FSM-03**: Переходы FSM в транзакции `SELECT … FOR UPDATE` + колонка `version` — защита от гонок при параллельных событиях (Telegram + менеджер)
- [x] **FSM-04**: Per-client сериализация через `pg_advisory_xact_lock(hashtext(client_id))` — порядок сообщений сохраняется
- [x] **FSM-05**: Каждый переход пишется в audit log (`lead_events` / `order_events`) с `actor` (ai/manager/system) и payload
- [x] **FSM-06**: Auto-follow-up при таймауте без ответа: N часов → автонотификация или → LOST

### Telegram Channel (TG)

- [x] **TG-01**: grammY 1.43 webhook, проверка `secret_token` Telegram'а
- [x] **TG-02**: Two-stage handler — webhook персистит `update_id` в `webhook_updates` с `ON CONFLICT DO NOTHING`, возвращает 200 за <100мс
- [x] **TG-03**: Inline-кнопки «Подтвердить рейс» / «Посмотреть статус» / «Отказаться»
- [x] **TG-04**: Карточки рейсов (краткое инфо + ссылка на трекинг) при предложении машины
- [x] **TG-05**: Driver-confirmation loop: бот пишет водителю (по `driver_phone` / `telegram_id`) с кнопками «Принять/Отказаться», статус летит обратно
- [x] **TG-06**: Менеджер может «перехватить» диалог из админки → бот замолкает, сообщения от менеджера летят клиенту
- [x] **TG-07**: Auto-уведомления клиенту о смене статуса заказа (через notification-сервис)

### Admin Web — СОКРАЩЁННАЯ (ADMIN) — pivot 2026-06-09: focus on voice+telegram channels, deferred ops UI

**Оставлено в v1:**
- [ ] **ADMIN-01**: Форк шаблона `next-shadcn-admin-dashboard`, `pnpm install`, `pnpm dev` стартует на :3000
- [ ] **ADMIN-02**: Auth: подключена `/auth/v1/login` (для демо — login/password из конфига)
- [ ] **ADMIN-03**: `/dashboard/chat` мульти-канальный — Telegram + Voice звонки в одном UI (`GET /api/clients/:id/messages` + `WS /ws/inbox`), audio-player для голосовых сегментов, transcript inline, кнопка «перехватить диалог» (только для Telegram — голос завершается естественно)
- [ ] **ADMIN-05**: `/dashboard/default` + `/dashboard/analytics` — KPI (звонки vs telegram, конверсия, выручка, средняя длительность звонка)
- [ ] **ADMIN-NEW-02**: Новая страница `/dashboard/orders` — таблица заказов с фильтрами по статусу и каналу (voice/telegram)
- [ ] **ADMIN-NEW-03**: Новая страница `/dashboard/orders/[id]` — детальная карточка: таймлайн `order_events`, ссылка на звонок (если есть), price-display (без override modal в v1)
- [ ] **ADMIN-NEW-08**: Новая страница `/dashboard/calls` — таблица всех звонков с фильтрами (outcome, lang, duration), клик → audio + transcript

**Перенесено в v2 (Out of Scope для демо):**
- ~~ADMIN-04~~ → v2 ADMIN-KANBAN: Kanban воронка лидов с DnD
- ~~ADMIN-06~~ → v2 ADMIN-CALENDAR: календарь загрузок/выгрузок
- ~~ADMIN-NEW-01~~ → v2 ADMIN-FLEET: страница fleet CRUD (для демо trucks сидятся, новые через psql)
- ~~ADMIN-NEW-04~~ → v2 (вместе с tracking)
- ~~ADMIN-NEW-05~~ → v2 ADMIN-SEARCH: глобальный поиск (⌘K)
- ~~ADMIN-NEW-06~~ → v2 ADMIN-PRICE-OVERRIDE
- ~~ADMIN-NEW-07~~ → v2 ADMIN-TTN-PDF

### Bilingual RU/UA (I18N)

- [ ] **I18N-01**: Серверный словарь RU/UA (`lib/i18n.ts`) для всех Telegram-ответов и системных сообщений
- [ ] **I18N-02**: Клиентский i18n-словарь (RU/UA) для UI админки, переключатель в Customize-панели шаблона
- [ ] **I18N-03**: Декларация ICU MessageFormat для славянских множественных форм (one/few/many) в админке
- [ ] **I18N-04**: Локаль-aware форматирование дат через `date-fns/locale` (ru, uk)
- [ ] **I18N-05**: Шаблоны сообщений без склонений («Маршрут: {from} → {to}» вместо «Из {from} в {to}»)

### Tracking & Live Map (TRACK) — **DEFERRED to v2 on 2026-06-09 per user pivot**

Все TRACK-01..07 и PUBLIC-01/02 перенесены в v2. Для голос+Telegram демо tracking не критичен.
См. секцию v2 ниже (TRACK_V2-*, PUBLIC_V2-*).

### Notifications & Communication (NOTIF)

- [ ] **NOTIF-01**: Сервис уведомлений шлёт Telegram-апдейты клиенту на каждый переход FSM заказа (DRIVER_ASSIGNED, IN_TRANSIT, DELIVERED — упрощённый набор без geofence-stages)
- [ ] **NOTIF-02**: Шаблоны уведомлений на RU/UA (без ссылки на /track/[token] — tracking page deferred to v2)

### Deployment & Demo (DEPLOY)

- [x] **DEPLOY-01**: docker-compose.yml с сервисами: `api` (Fastify), `web` (Next.js), `postgres+postgis`, `redis`, `caddy` (HTTPS auto-ACME)
- [x] **DEPLOY-02**: ENV-конфиг через `.env` + Node 22 `--env-file`, secrets отдельно
- [x] **DEPLOY-03**: `pnpm` workspaces монорепо: `apps/api`, `apps/web`, `packages/shared-types`
- [x] **DEPLOY-04**: README с инструкцией запуска демо локально и на VPS

### Voice Channel (VOICE) — **promoted to v1 on 2026-06-09 per user pivot to voice focus**

- [x] **VOICE-01**: ElevenLabs Conversational AI Agent (Turbo tier, $0.10/мин) с RU+UA голосами, подключёный к Twilio SIP-trunk
- [x] **VOICE-02**: Twilio account + один номер (RU или UA, ~$3/мес), webhook → Fastify `/webhook/voice`
- [x] **VOICE-03**: ElevenLabs Agent tools = тот же registry что и Phase 2 (extractRequest, nearestTruck, calcPrice, createOrder, discount) — общая бизнес-логика
- [x] **VOICE-04**: Conversation FSM: `GREETING → COLLECT_REQUEST → MATCH → QUOTE → NEGOTIATE → CONFIRM → CREATE_ORDER → GOODBYE` (§5.2 спеки)
- [x] **VOICE-05**: Только входящие звонки в v1 (клиент звонит → AI отвечает). Исходящие (driver confirmation by call) → v2
- [x] **VOICE-06**: Автоопределение языка в первой фразе клиента (RU/UA), переключение голоса агента
- [x] **VOICE-07**: Запись звонка (audio URL) + расшифровка (transcript JSON) → `calls` таблица (уже есть из Phase 1)
- [x] **VOICE-08**: `calls.outcome` enum (`completed | abandoned | escalated | error`) + linking to `leads.id` если заказ создан
- [x] **VOICE-09**: Same price-lock протокол что и в Phase 2 — quoted_price пишется в БД ДО озвучивания, regex-guard на TTS-input
- [x] **VOICE-10**: Same anti-injection защита что и в Phase 2 — system prompt с ANTI_INJECTION_PREFIX, tools-as-security-boundary
- [x] **VOICE-11**: Same FSM-race защита что и в Phase 2 — SELECT FOR UPDATE + version + advisory lock per client_phone
- [ ] **VOICE-12**: `/dashboard/chat` админки (Phase 4) показывает звонки как отдельный канал с audio-player и transcript

### Demo Polish (POLISH)

- [ ] **POLISH-01**: Snapshot-тесты `extractRequest` и `calcPrice` (20 канонических входов) в CI
- [ ] **POLISH-02**: «Simulate inbound call» кнопка в админке — проигрывает заранее заготовленный транскрипт через LLM-пайплайн (резерв на случай если real-call упадёт)
- [ ] **POLISH-03**: Pre-recorded видео реального звонка ElevenLabs для показа возможностей голоса (резерв если venue WiFi или Twilio лёг)
- [ ] **POLISH-04**: Локально кэшированные тайлы карты на случай плохого WiFi на демо-площадке
- [ ] **POLISH-05**: Pre-flight чек-лист (бот жив, БД сидится, симулятор стартует, обе ссылки `/track/*` работают, **тестовый звонок проходит**)
- [ ] **POLISH-06**: Опционально — failover на OpenAI SDK если Anthropic API лежит

## v2 Requirements

### Real External Integrations

- **EXT-01**: ATI.SU API v2 — реальный fallback на биржу
- **EXT-02**: Lardi-Trans API v2 — реальный fallback на биржу
- **EXT-03**: Wialon Open API для GPS вместо симулятора
- **EXT-04**: Opendatabot UA для верификации EDRPOU контрагентов
- **EXT-05**: Mapbox/HERE Directions API как платная альтернатива OSRM

### Production Hardening

- **PROD-01**: BullMQ очередь для webhook-обработки вместо inline
- **PROD-02**: Redis Pub/Sub для WS fan-out при горизонтальном масштабировании
- **PROD-03**: Audit log + role-based access control
- **PROD-04**: SMS-уведомления (через Twilio) как дублирующий канал
- **PROD-05**: Rate limiting на webhook'и
- **PROD-06**: Observability (OpenTelemetry, structured logs, метрики)
- **PROD-07**: Multi-tenancy — несколько логистических компаний в одной системе

### Tracking & Maps (deferred from v1 demo on 2026-06-09)

- **TRACK_V2-01..07**: GPS tracking loop, симулятор, geofence FSM, smooth marker, WS resilience
- **PUBLIC_V2-01,02**: Публичная страница `/track/[token]` + ссылки в уведомлениях
- **ADMIN_V2-TRACKING**: `/dashboard/tracking` страница Leaflet + WS

### Admin operational pages (deferred from v1 demo)

- **ADMIN_V2-KANBAN**: Kanban воронка лидов с DnD по стадиям FSM
- **ADMIN_V2-CALENDAR**: Календарь загрузок/выгрузок
- **ADMIN_V2-FLEET**: Страница fleet CRUD (для демо trucks сидятся, новые через psql)
- **ADMIN_V2-SEARCH**: Глобальный поиск (⌘K)
- **ADMIN_V2-PRICE-OVERRIDE**: Модал price-override с reason → audit log
- **ADMIN_V2-TTN-PDF**: Стабовый PDF-генератор ТТН/CMR

### Future Features

- **FUT-01**: e-CMR с цифровой подписью
- **FUT-02**: Native водительское приложение (iOS/Android)
- **FUT-03**: Конфигурируемый rule engine для скидок и наценок без кода
- **FUT-04**: Полноценная финансовая аналитика и интеграция с 1С

## Out of Scope

| Feature | Reason |
|---------|--------|
| Реальный голосовой канал (ElevenLabs+SIP) | §5.2 спеки — «опционально для демо». Логика tools общая с текстом, добавляется поверх. POLISH-02 даёт «simulate call» стаб для демо |
| Реальные API бирж (ATI.SU, Lardi-Trans) | §9 порядок сборки демо — `bourse_cache` со стабом достаточно. Реальные ключи и квоты тормозят демо |
| Wialon Open API для GPS | §9.5 — для демо машина двигается через симулятор/приложение водителя |
| SMS-уведомления | Telegram достаточно для демо (§5.3 помечает SMS как опц.) |
| Многотенантность / RBAC | Однопользовательская админка под одного менеджера — demo focus |
| Native мобильное приложение водителя | Web/Telegram достаточно для демо |
| Полноценная финансовая аналитика | Стандартные виджеты шаблона без кастомных отчётов |
| Production-grade безопасность (rate limit, audit, PII шифрование) | Добавляется после демо |
| Real-time WS на каждом экране | Только трекинг и чат — остальное SSR/poll |
| Email-канал | Telegram + (опционально) звонок |
| BullMQ queue для webhook | Inline-обработка достаточна для demo-трафика; BullMQ — v2 |
| No-code rule engine для цен | Параметры в конфиге, меняются разработчиком |
| Полный e-CMR с цифровой подписью | TTN/CMR PDF-стаб (ADMIN-NEW-07) достаточно для демо |

## Traceability

Заполнено gsd-roadmapper'ом при создании ROADMAP.md.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DB-01 | Phase 1 | Complete |
| DB-02 | Phase 1 | Complete |
| DB-03 | Phase 1 | Complete |
| DB-04 | Phase 1 | Complete |
| DB-05 | Phase 1 | Complete |
| DB-06 | Phase 1 | Complete |
| DB-07 | Phase 1 | Complete |
| DB-08 | Phase 1 | Complete |
| DB-09 | Phase 1 | Complete |
| DB-10 | Phase 1 | Complete |
| API-01 | Phase 1 | Complete |
| API-02 | Phase 1 | Complete |
| API-03 | Phase 4 | Pending |
| API-04 | Phase 4 | Pending |
| API-05 | Phase 4 | Pending |
| API-06 | Phase 4 | Pending |
| API-07 | Phase 2 | Complete |
| API-08 | Phase 4 | Pending |
| API-09 | Phase 4 | Pending |
| API-10 | Phase 4 | Pending |
| API-11 | Phase 5 | Pending |
| API-12 | Phase 5 | Pending |
| API-13 | Phase 3 | Complete |
| API-14 | Phase 5 | Pending |
| API-15 | Phase 3 | Complete |
| API-16 | Phase 1 | Complete |
| LOGIC-01 | Phase 2 | Complete |
| LOGIC-02 | Phase 2 | Pending |
| LOGIC-03 | Phase 2 | Complete |
| LOGIC-04 | Phase 2 | Complete |
| LOGIC-05 | Phase 2 | Complete |
| MATCH-01 | Phase 2 | Complete |
| MATCH-02 | Phase 2 | Pending |
| MATCH-03 | Phase 2 | Complete |
| MATCH-04 | Phase 2 | Pending |
| MATCH-05 | Phase 2 | Complete |
| MATCH-06 | Phase 2 | Complete |
| FSM-01 | Phase 2 | Complete |
| FSM-02 | Phase 2 | Complete |
| FSM-03 | Phase 2 | Complete |
| FSM-04 | Phase 2 | Complete |
| FSM-05 | Phase 2 | Complete |
| FSM-06 | Phase 2 | Complete |
| TG-01 | Phase 3 | Complete |
| TG-02 | Phase 3 | Complete |
| TG-03 | Phase 3 | Complete |
| TG-04 | Phase 3 | Complete |
| TG-05 | Phase 3 | Complete |
| TG-06 | Phase 3 | Complete |
| TG-07 | Phase 3 | Complete |
| ADMIN-01 | Phase 4 | Pending |
| ADMIN-02 | Phase 4 | Pending |
| ADMIN-03 | Phase 4 | Pending |
| ADMIN-04 | Phase 4 | Pending |
| ADMIN-05 | Phase 4 | Pending |
| ADMIN-06 | Phase 4 | Pending |
| ADMIN-NEW-01 | Phase 4 | Pending |
| ADMIN-NEW-02 | Phase 4 | Pending |
| ADMIN-NEW-03 | Phase 4 | Pending |
| ADMIN-NEW-04 | Phase 4 | Pending |
| ADMIN-NEW-05 | Phase 4 | Pending |
| ADMIN-NEW-06 | Phase 4 | Pending |
| ADMIN-NEW-07 | Phase 4 | Pending |
| TRACK-01 | Phase 5 | Pending |
| TRACK-02 | Phase 5 | Pending |
| TRACK-03 | Phase 5 | Pending |
| TRACK-04 | Phase 5 | Pending |
| TRACK-05 | Phase 5 | Pending |
| TRACK-06 | Phase 5 | Pending |
| TRACK-07 | Phase 5 | Pending |
| PUBLIC-01 | Phase 5 | Pending |
| PUBLIC-02 | Phase 5 | Pending |
| I18N-01 | Phase 6 | Pending |
| I18N-02 | Phase 4 | Pending |
| I18N-03 | Phase 6 | Pending |
| I18N-04 | Phase 6 | Pending |
| I18N-05 | Phase 6 | Pending |
| NOTIF-01 | Phase 6 | Pending |
| NOTIF-02 | Phase 6 | Pending |
| DEPLOY-01 | Phase 1 | Complete |
| DEPLOY-02 | Phase 1 | Complete |
| DEPLOY-03 | Phase 1 | Complete |
| DEPLOY-04 | Phase 1 | Complete |
| POLISH-01 | Phase 6 | Pending |
| POLISH-02 | Phase 6 | Pending |
| POLISH-03 | Phase 6 | Pending |
| POLISH-04 | Phase 6 | Pending |
| POLISH-05 | Phase 6 | Pending |
| POLISH-06 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: **89 total** (10 DB + 16 API + 5 LOGIC + 6 MATCH + 6 FSM + 7 TG + 6 ADMIN + 7 ADMIN-NEW + 7 TRACK + 2 PUBLIC + 5 I18N + 2 NOTIF + 4 DEPLOY + 6 POLISH = 89; the earlier "97 total" was an arithmetic typo)
- Mapped to phases: **89 / 89** (100%)
- Unmapped: **0**

**Per-phase distribution:**
- Phase 1 (DB + Backend Skeleton): 17 — DB-01..10, API-01, API-02, API-16, DEPLOY-01..04
- Phase 2 (LLM Pipeline + Core): 18 — API-07, LOGIC-01..05, MATCH-01..06, FSM-01..06
- Phase 3 (Telegram Channel): 9 — API-13, API-15, TG-01..07
- Phase 4 (Admin Web): 21 — API-03, API-04, API-05, API-06, API-08, API-09, API-10, ADMIN-01..06, ADMIN-NEW-01..07, I18N-02
- Phase 5 (Tracking + Public): 12 — API-11, API-12, API-14, TRACK-01..07, PUBLIC-01, PUBLIC-02
- Phase 6 (Polish + Notif + i18n): 12 — I18N-01, I18N-03, I18N-04, I18N-05, NOTIF-01, NOTIF-02, POLISH-01..06

---
*Requirements defined: 2026-06-08*
*Last updated: 2026-06-08 after roadmap creation (traceability filled, coverage corrected from 97 to 89)*
