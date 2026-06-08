# Requirements: AI-Логист

**Defined:** 2026-06-08
**Core Value:** Диалог ведёт LLM, но решения по деньгам и подбору принимает детерминированный код — цена и подбор должны быть предсказуемыми и тестируемыми.

> Источник истины: `ai-logist-logic-spec.md` (§§2-9). Требования ниже = спека §9 (порядок сборки демо) + 6 пробелов, найденных research (FEATURES.md).

## v1 Requirements

### Database & Schema (DB)

- [ ] **DB-01**: Postgres 17 + PostGIS 3.5 запущены через docker-compose, `CREATE EXTENSION postgis` в первой миграции
- [ ] **DB-02**: Схема `clients` создана с полями `lang ('ru'|'ua')`, `tax_id`, `tax_id_country` (EDRPOU/ИНН)
- [ ] **DB-03**: Схема `cities` со столбцами `name_ru`/`name_ua` + `geom geography(Point,4326)` для нормализации городов
- [ ] **DB-04**: Схема `trucks` с `geom geography(Point,4326)`, `capacity_t`, `body_type`, `status`, GiST-индекс на `geom`
- [ ] **DB-05**: Схема `leads` с расширенными полями груза (`volume_m3`, `dimensions_lxwxh`, `packaging`, `adr_class`, `declared_value`) и `price_overrides jsonb[]` для audit log
- [ ] **DB-06**: Схема `orders` + `order_events` с `UNIQUE (order_id, type)` для идемпотентности и таймлайна
- [ ] **DB-07**: Схема `calls`, `messages`, `bourse_cache` для каналов и кэша
- [ ] **DB-08**: Схема `pod_artifacts` для Proof of Delivery (signature_url, photo_url, gps, captured_at)
- [ ] **DB-09**: Схема `webhook_updates` для идемпотентности Telegram по `update_id` (`ON CONFLICT DO NOTHING`)
- [ ] **DB-10**: Сидинг данных: 10-15 машин, ~30 RU/UA городов + пограничные переходы, 5-10 клиентов, конфиг цен (`rate_per_km`, `dir_coef`, `season_coef`)

### Backend API & Infrastructure (API)

- [ ] **API-01**: Fastify v5 + TypeScript 5.7 strict app с health-эндпоинтом `/api/health` (возвращает `PostGIS_Version()`)
- [ ] **API-02**: Drizzle ORM миграции и репозитории для всех таблиц §2
- [ ] **API-03**: REST `/api/leads` (GET с фильтром по stage, PATCH для смены стадии вручную)
- [ ] **API-04**: REST `/api/orders` (GET с фильтром по status), `/api/orders/:id` (заказ + order_events)
- [ ] **API-05**: REST `/api/trucks` (GET/POST/PATCH — CRUD парка)
- [ ] **API-06**: REST `/api/clients/:id/messages` для чата админки
- [ ] **API-07**: REST `/api/leads/:id/match` (пересчёт подбора) и `/api/leads/:id/quote` (пересчёт цены)
- [ ] **API-08**: REST `/api/orders` POST (ручное создание заказа менеджером)
- [ ] **API-09**: REST `/api/analytics/kpi` — звонки, конверсия, выручка для дашбордов
- [ ] **API-10**: REST `/api/orders/:id/price-override` — изменение цены менеджером, пишет в `price_overrides`
- [ ] **API-11**: WebSocket `/ws/tracking` — live-координаты машин
- [ ] **API-12**: WebSocket `/ws/inbox` — live-сообщения/звонки в чат
- [ ] **API-13**: Webhook `/webhook/telegram` с проверкой `secret_token`
- [ ] **API-14**: Webhook `/webhook/gps` для приёма позиций (демо: симулятор)
- [ ] **API-15**: Webhook `/webhook/voice` (stub-эндпоинт для демо, возвращает 200)
- [ ] **API-16**: Schema-validated routes с Zod, общая `packages/shared-types` для DTOs

### Business Logic — LLM Pipeline (LOGIC)

- [ ] **LOGIC-01**: `extractRequest(text, lang)` — Anthropic SDK `betaZodTool` извлекает `{from_city, to_city, tons, body_type?, budget?, deadline?}` со строгим JSON-Schema
- [ ] **LOGIC-02**: Sticky-определение языка клиента (RU/UA) — fastText + Cyrillic-script-эвристика, сохраняется в `clients.lang` на первом сообщении ≥20 символов
- [ ] **LOGIC-03**: Нормализация городов через `cities` (ILIKE на оба `name_ru`/`name_ua`) + геокодинг Nominatim для новых, кэш в БД
- [ ] **LOGIC-04**: LLM задаёт уточняющий вопрос при отсутствии ключевых полей (clarification budget — максимум 2 круга)
- [ ] **LOGIC-05**: Промпт принуждает строгий JSON, нераспознанные поля = null

### Business Logic — Matching & Pricing (MATCH)

- [ ] **MATCH-01**: `nearestTruck(pickup_geom, tons, body_type?)` — PostGIS KNN-запрос с CTE re-rank (overfetch 20 по `<->`, затем re-rank по `ST_Distance(geog, true)`)
- [ ] **MATCH-02**: Fallback на стаб биржи (mock-ответ `bourse_cache`) если своих машин нет
- [ ] **MATCH-03**: `calcPrice(from, to, tons, body, date)` — детерминированный расчёт `route_km × rate_per_km × dir_coef × season_coef`, округление до 50, integer kopecks
- [ ] **MATCH-04**: Корректное расстояние через OSRM (`route_km`), кэш в БД
- [ ] **MATCH-05**: `calcPrice` возвращает корридор `{min, max, default}` для переговоров — LLM может дать скидку только до min
- [ ] **MATCH-06**: Цена сохраняется в `leads.quoted_price` ДО ответа LLM; ответ собирается шаблоном с подстановкой числа из БД (LLM не «выдумывает» цифру); regex-guard режет любое число ≠ `quoted_price` в ответе

### Business Logic — FSM (FSM)

- [ ] **FSM-01**: Lead funnel: `NEW → QUALIFIED → MATCHED → QUOTED → AGREED → ORDER_CREATED → IN_PROGRESS → DONE/LOST` с таблицей разрешённых переходов
- [ ] **FSM-02**: Order lifecycle: `CREATED → DRIVER_ASSIGNED → AT_LOADING → IN_TRANSIT → AT_BORDER → DELIVERED → CLOSED` с таблицей переходов
- [ ] **FSM-03**: Переходы FSM в транзакции `SELECT … FOR UPDATE` + колонка `version` — защита от гонок при параллельных событиях (Telegram + менеджер)
- [ ] **FSM-04**: Per-client сериализация через `pg_advisory_xact_lock(hashtext(client_id))` — порядок сообщений сохраняется
- [ ] **FSM-05**: Каждый переход пишется в audit log (`lead_events` / `order_events`) с `actor` (ai/manager/system) и payload
- [ ] **FSM-06**: Auto-follow-up при таймауте без ответа: N часов → автонотификация или → LOST

### Telegram Channel (TG)

- [ ] **TG-01**: grammY 1.43 webhook, проверка `secret_token` Telegram'а
- [ ] **TG-02**: Two-stage handler — webhook персистит `update_id` в `webhook_updates` с `ON CONFLICT DO NOTHING`, возвращает 200 за <100мс
- [ ] **TG-03**: Inline-кнопки «Подтвердить рейс» / «Посмотреть статус» / «Отказаться»
- [ ] **TG-04**: Карточки рейсов (краткое инфо + ссылка на трекинг) при предложении машины
- [ ] **TG-05**: Driver-confirmation loop: бот пишет водителю (по `driver_phone` / `telegram_id`) с кнопками «Принять/Отказаться», статус летит обратно
- [ ] **TG-06**: Менеджер может «перехватить» диалог из админки → бот замолкает, сообщения от менеджера летят клиенту
- [ ] **TG-07**: Auto-уведомления клиенту о смене статуса заказа (через notification-сервис)

### Admin Web — Existing Pages (Wired) (ADMIN)

- [ ] **ADMIN-01**: Форк шаблона `next-shadcn-admin-dashboard`, `pnpm install`, `pnpm dev` стартует на :3000
- [ ] **ADMIN-02**: Auth: подключена `/auth/v1/login` (для демо — login/password из конфига)
- [ ] **ADMIN-03**: `/dashboard/chat` подключён к `GET /api/clients/:id/messages` + `WS /ws/inbox`, кнопка «перехватить диалог»
- [ ] **ADMIN-04**: `/dashboard/kanban` подключён к `/api/leads` — колонки = стадии §4.4, DnD → `PATCH /api/leads/:id` с проверкой FSM
- [ ] **ADMIN-05**: `/dashboard/default` и `/dashboard/analytics` тянут `/api/analytics/kpi` (звонки, конверсия, выручка)
- [ ] **ADMIN-06**: `/dashboard/calendar` показывает события загрузок/выгрузок из `order_events`

### Admin Web — New Pages (ADMIN-NEW)

- [ ] **ADMIN-NEW-01**: Новая страница `/dashboard/fleet` — таблица парка машин из `/api/trucks`, форма создания/редактирования (RHF+zod), валидация телефона водителя через `phone-input` (libphonenumber-js), валидация госномера
- [ ] **ADMIN-NEW-02**: Новая страница `/dashboard/orders` — таблица заказов из `/api/orders` с фильтрами по статусу
- [ ] **ADMIN-NEW-03**: Новая страница `/dashboard/orders/[id]` — детальная карточка заказа: таймлайн `order_events`, секция POD, кнопка «TTN/CMR PDF», карта маршрута, кнопка price-override
- [ ] **ADMIN-NEW-04**: Новая страница `/dashboard/tracking` — Leaflet + OSM-тайлы + WS `/ws/tracking`, точки машин на карте с маршрутами и ETA
- [ ] **ADMIN-NEW-05**: Глобальный поиск (shadcn command palette ⌘K) — индексирует orders, leads, clients
- [ ] **ADMIN-NEW-06**: Модал price-override на странице заказа с обязательным полем «Причина» → пишет в `price_overrides`, отображается аудит
- [ ] **ADMIN-NEW-07**: Стабовый PDF-генератор ТТН (RU) / CMR (UA) — кнопка на странице заказа открывает превью с данными заказа

### Tracking & Live Map (TRACK)

- [ ] **TRACK-01**: Цикл трекинга — фон-задача каждые N минут опрашивает позиции (для демо — симулятор), пишет в `truck_positions`
- [ ] **TRACK-02**: GPS-симулятор CLI: машина движется по polyline OSRM-маршрута, переменная скорость (50-80 км/ч трасса, 20-30 город) + ±5м шум, пуш каждые 10-30с
- [ ] **TRACK-03**: Симулятор останавливается на гео-фенсах (загрузка / граница / выгрузка) на 5-15 мин
- [ ] **TRACK-04**: Geofence-проверка через `ST_DWithin` (радиус, GiST-индекс), при пересечении → `order_events.insert(type)`, идемпотентность через `UNIQUE (order_id, type)`
- [ ] **TRACK-05**: Smooth-marker-интерполяция точек на карте Leaflet (не «прыгают»)
- [ ] **TRACK-06**: WS-клиент с exponential-backoff reconnect (1/2/4/8/30с) + heartbeat ping 25с + `visibilitychange` refetch
- [ ] **TRACK-07**: SSR-fetch начального состояния трекинга, WS только для дельт

### Public Tracking (PUBLIC)

- [ ] **PUBLIC-01**: Публичная страница `/track/[order_token]` (без авторизации) с картой Leaflet + текущий статус + ETA, токен генерируется при создании заказа
- [ ] **PUBLIC-02**: Шифрованная ссылка на трекинг отправляется клиенту в Telegram при создании заказа

### Bilingual RU/UA (I18N)

- [ ] **I18N-01**: Серверный словарь RU/UA (`lib/i18n.ts`) для всех Telegram-ответов и системных сообщений
- [ ] **I18N-02**: Клиентский i18n-словарь (RU/UA) для UI админки, переключатель в Customize-панели шаблона
- [ ] **I18N-03**: Декларация ICU MessageFormat для славянских множественных форм (one/few/many) в админке
- [ ] **I18N-04**: Локаль-aware форматирование дат через `date-fns/locale` (ru, uk)
- [ ] **I18N-05**: Шаблоны сообщений без склонений («Маршрут: {from} → {to}» вместо «Из {from} в {to}»)

### Notifications & Communication (NOTIF)

- [ ] **NOTIF-01**: Сервис уведомлений шлёт Telegram-апдейты клиенту на каждый переход FSM заказа (DRIVER_ASSIGNED, AT_LOADING, IN_TRANSIT, AT_BORDER, DELIVERED)
- [ ] **NOTIF-02**: Шаблоны уведомлений на RU/UA с подстановкой деталей заказа и ссылки на `/track/[token]`

### Deployment & Demo (DEPLOY)

- [ ] **DEPLOY-01**: docker-compose.yml с сервисами: `api` (Fastify), `web` (Next.js), `postgres+postgis`, `redis`, `caddy` (HTTPS auto-ACME)
- [ ] **DEPLOY-02**: ENV-конфиг через `.env` + Node 22 `--env-file`, secrets отдельно
- [ ] **DEPLOY-03**: `pnpm` workspaces монорепо: `apps/api`, `apps/web`, `packages/shared-types`
- [ ] **DEPLOY-04**: README с инструкцией запуска демо локально и на VPS

### Demo Polish (POLISH)

- [ ] **POLISH-01**: Snapshot-тесты `extractRequest` и `calcPrice` (20 канонических входов) в CI
- [ ] **POLISH-02**: «Simulate inbound call» кнопка в админке — проигрывает заранее заготовленный транскрипт через LLM-пайплайн (замена реального голосового канала)
- [ ] **POLISH-03**: Pre-recorded видео реального звонка ElevenLabs для показа возможностей голоса
- [ ] **POLISH-04**: Локально кэшированные тайлы карты на случай плохого WiFi на демо-площадке
- [ ] **POLISH-05**: Pre-flight чек-лист (бот жив, БД сидится, симулятор стартует, обе ссылки `/track/*` работают)
- [ ] **POLISH-06**: Опционально — failover на OpenAI SDK если Anthropic API лежит

## v2 Requirements

### Voice Channel (Real)

- **VOICE-01**: Подключение ElevenLabs Agents через SIP-trunk (Twilio/Telnyx)
- **VOICE-02**: Реальный FSM разговора (GREETING → COLLECT_REQUEST → MATCH → QUOTE → NEGOTIATE → CONFIRM → CREATE_ORDER → GOODBYE)
- **VOICE-03**: Запись и расшифровка звонков в `calls`

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

Заполняется gsd-roadmapper'ом при создании ROADMAP.md.

| Requirement | Phase | Status |
|-------------|-------|--------|
| (заполняется roadmapper'ом) | | Pending |

**Coverage:**
- v1 requirements: **97 total** (10 DB + 16 API + 5 LOGIC + 6 MATCH + 6 FSM + 7 TG + 6 ADMIN + 7 ADMIN-NEW + 7 TRACK + 2 PUBLIC + 5 I18N + 2 NOTIF + 4 DEPLOY + 6 POLISH)
- Mapped to phases: TBD
- Unmapped: TBD

---
*Requirements defined: 2026-06-08*
*Last updated: 2026-06-08 after initial definition*
