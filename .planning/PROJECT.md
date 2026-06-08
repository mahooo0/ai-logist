# AI-Логист

## What This Is

Бэкенд-оркестратор + веб-админка для логистической компании, который принимает обращения клиентов через Telegram-бот и голосовые звонки, автоматически распознаёт заявку, подбирает ближайшую свободную машину из собственного парка (или с биржи как fallback), рассчитывает цену, проводит лида по воронке продаж и создаёт заказ с живым GPS-трекингом до выгрузки. Менеджер видит всё в админке: диалоги, воронку Kanban, парк, заказы, живую карту перевозок, KPI.

## Core Value

**Диалог ведёт LLM, но решения по деньгам и подбору принимает детерминированный код** — цена и подбор машины должны быть предсказуемыми, тестируемыми, воспроизводимыми. Если этот принцип нарушен — система теряет доверие бизнеса.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward demo per §9 of spec. -->

**Бэкенд-каркас:**
- [ ] PostgreSQL + PostGIS схема (clients, cities, trucks, leads, orders, order_events, calls, messages, bourse_cache) — §2 спеки
- [ ] REST API эндпоинты (/api/leads, /api/orders, /api/trucks, /api/clients, /api/analytics/kpi) — §6 спеки
- [ ] WebSocket эндпоинты (/ws/tracking, /ws/inbox) — §6 спеки
- [ ] Webhook эндпоинты (/webhook/telegram, /webhook/voice, /webhook/gps) — §6 спеки
- [ ] Сидинг парка машин (исходные данные) — §9.1

**Бизнес-логика (детерминированные функции/tools):**
- [ ] extractRequest(text, lang) — LLM с function calling извлекает {from, to, tons, body_type, budget} — §4.1
- [ ] nearestTruck — PostGIS KNN-запрос по свободным машинам с фильтром по тоннажу/типу кузова — §4.2
- [ ] calcPrice — детерминированный расчёт: route_km × rate_per_km × dir_coef × season_coef, округление до 50 — §4.3
- [ ] createOrder — создание заказа из лида + назначение водителя — §4.5
- [ ] Воронка лидов (FSM): NEW → QUALIFIED → MATCHED → QUOTED → AGREED → ORDER_CREATED → IN_PROGRESS → DONE/LOST — §4.4
- [ ] Жизненный цикл заказа (FSM): CREATED → DRIVER_ASSIGNED → AT_LOADING → IN_TRANSIT → AT_BORDER → DELIVERED → CLOSED — §4.5
- [ ] Fallback на биржи ATI.SU / Lardi-Trans (для демо — стаб с мок-ответом, опционально) — §4.6
- [ ] Цикл трекинга: позиция машины → WebSocket → автоматические события заказа по гео-фенсу — §4.7

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
*Last updated: 2026-06-08 after initialization*
