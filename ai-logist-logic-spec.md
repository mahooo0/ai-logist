# AI-Логист — техническая спецификация логики и веб-части

Полное описание бизнес-логики системы (модели данных, алгоритмы, конечные автоматы, API, интеграции) и веб-админки для контроля и отображения данных на базе шаблона **next-shadcn-admin-dashboard** (`mahooo0/next-shadcn-admin-dashboard`, «Zenith Admin»).

Связанные документы: `ai-logist-tech-vision.md` (стек и сервисы), `ai-logist-arhitektura.md` (источники данных), `ai-logist-demo.html` (кликабельный прототип).

---

## 1. Общая картина

Система — это бэкенд-оркестратор + веб-админка.

Бэкенд принимает обращения из двух каналов (Telegram-текст и телефонный звонок), прогоняет их через единый пайплайн (распознать заявку → подобрать машину → посчитать цену → провести по воронке → создать заказ → вести трекинг) и пишет всё в БД. Веб-админка (Next.js на базе шаблона) читает эту БД через API и даёт менеджеру контроль: видеть диалоги, воронку, заказы, парк, живую карту перевозок и аналитику.

Ключевой принцип: **диалог ведёт LLM, но решения по деньгам и подбору принимает детерминированный код** (функции/tools, которые LLM вызывает). Так цена и логика предсказуемы и тестируемы.

---

## 2. Модель данных (PostgreSQL + PostGIS)

```
clients
  id (uuid, pk)
  name, phone, telegram_id
  lang            -- 'ru' | 'ua'  (определяется автоматически)
  created_at

cities                         -- справочник точек (геокодинг кэшируется сюда)
  id, name_ru, name_ua
  geom (geography(Point))      -- координаты для гео-запросов

trucks                         -- ВАШ ПАРК (исходные данные)
  id (uuid, pk)
  name, driver_name, driver_phone
  capacity_t (numeric)         -- тоннаж
  body_type                    -- 'tent' | 'ref' | 'iso' ...
  geom (geography(Point))      -- текущая позиция (из GPS)
  status                       -- 'available' | 'busy' | 'maintenance'
  updated_at

leads                          -- ВОРОНКА: каждое обращение
  id (uuid, pk)
  client_id (fk)
  channel                      -- 'telegram' | 'call'
  stage                        -- enum воронки (см. §4.4)
  from_city_id, to_city_id (fk)
  tons (numeric), body_type, budget
  matched_truck_id (fk, nullable)
  quoted_price (numeric, nullable)
  order_id (fk, nullable)
  created_at, updated_at

orders                         -- созданные заказы
  id (uuid, pk)
  number                       -- '#KU-4471'
  lead_id, client_id, truck_id (fk)
  from_city_id, to_city_id (fk)
  distance_km, price, currency
  status                       -- enum жизненного цикла (см. §4.5)
  created_at

order_events                   -- лента статусов заказа
  id, order_id (fk)
  type                         -- 'created'|'driver_assigned'|'at_loading'|'in_transit'|'at_border'|'delivered'
  payload (jsonb), geom, created_at

calls                          -- журнал звонков
  id, lead_id (fk)
  direction                    -- 'inbound' | 'outbound'
  duration_s, transcript (jsonb), recording_url, outcome
  created_at

messages                       -- журнал переписки (Telegram)
  id, client_id (fk), lead_id (fk)
  role                         -- 'client' | 'ai' | 'manager'
  text, created_at

bourse_cache                   -- кэш ответов бирж (ATI.SU / Lardi-Trans)
  id, query_hash, source, payload (jsonb), fetched_at
```

Гео-запрос «ближайшая свободная машина» делается в PostGIS одним запросом (см. §4.2).

---

## 3. Пайплайн обработки обращения (высокоуровнево)

```
Обращение (Telegram / звонок)
   ↓
1. Определить язык (ru/ua) и клиента (создать/найти)
   ↓
2. Распознать заявку (LLM extract → from, to, tons, body, budget)   §4.1
   ↓
3. Создать lead, stage = QUALIFIED
   ↓
4. Подобрать ближайшую свободную машину (PostGIS)                    §4.2
      └─ нет своей → fallback на биржи                               §4.6
   ↓
5. Посчитать цену (distance × rate × коэффициенты)                   §4.3
   ↓
6. Озвучить/отправить предложение, stage = QUOTED
   ↓
7. Получить согласие → stage = AGREED
   ↓
8. Создать заказ, назначить водителя, stage = ORDER_CREATED          §4.5
   ↓
9. Запустить трекинг, слать статусы                                  §4.7
```

---

## 4. Бизнес-логика (алгоритмы)

### 4.1 Распознавание заявки (intent + entities)

LLM с function calling извлекает структуру из свободного текста/расшифровки речи:

```
extractRequest(text, lang) -> {
  from_city, to_city, tons, body_type?, budget?, deadline?
}
```

- Промпт принуждает вернуть строгий JSON; нераспознанные поля = null.
- Города нормализуются по справочнику `cities` (+ геокодинг через Maps API, результат кэшируется).
- Если ключевых полей нет (нет маршрута/тоннажа) — LLM задаёт уточняющий вопрос, lead остаётся в stage = NEW.

### 4.2 Подбор ближайшей свободной машины (PostGIS)

```sql
SELECT t.*,
  ST_Distance(t.geom, :pickup_geom) AS meters
FROM trucks t
WHERE t.status = 'available'
  AND t.capacity_t >= :tons
  AND (:body_type IS NULL OR t.body_type = :body_type)
ORDER BY t.geom <-> :pickup_geom   -- KNN, индекс GiST
LIMIT 3;
```

- Расстояние подачи (километры дороги) уточняется через Routing API (HERE/Mapbox) по топ-кандидатам.
- Если результат пуст → §4.6 (биржи).

### 4.3 Расчёт цены (детерминированный)

```
price = round( route_km * rate_per_km * dir_coef * season_coef , 50 )
route_km = roadDistance(from, to)            // Routing API или haversine × road_factor
rate_per_km                                  // базовая ставка, настраивается
dir_coef                                     // коэффициент по направлению (обратка/дефицит)
season_coef                                  // сезонность/срочность
```

- Параметры (`rate_per_km`, коэффициенты) лежат в конфиге/БД, меняются без кода.
- Для переговоров: задаётся «коридор» (min/max). LLM может дать скидку до min; ниже — эскалация менеджеру.

### 4.4 Воронка продаж (конечный автомат)

```
NEW → QUALIFIED → MATCHED → QUOTED → AGREED → ORDER_CREATED → IN_PROGRESS → DONE
                                  ↘ LOST (отказ/нет ответа на любом шаге)
```

- Каждый переход пишется в `leads.stage` + лог. Это источник данных для Kanban-воронки в админке (§7).
- Таймауты: нет ответа N часов → авто-follow-up (Telegram/звонок) или → LOST.

### 4.5 Жизненный цикл заказа

```
CREATED → DRIVER_ASSIGNED → AT_LOADING → IN_TRANSIT → AT_BORDER → DELIVERED → CLOSED
```

Каждое событие → запись в `order_events` (+ координата) → авто-уведомление клиенту.

### 4.6 Fallback на биржи

Если своей машины нет: запрос к ATI.SU API и Lardi-Trans API параллельно → нормализация в единый формат `{from,to,tons,body,price,eta,source}` → ранжирование по совпадению → предложение клиенту. Ответы кэшируются в `bourse_cache` (TTL).

### 4.7 Цикл трекинга

```
каждые N минут:
  pos = WialonAPI.getPosition(truck.gps_id)   // или из приложения водителя
  truck.geom = pos; push WebSocket → карта
  progress, eta = RoutingAPI.eta(pos, to)
  если пересечён гео-фенс этапа (загрузка/граница/выгрузка):
      order_events.insert(type)
      notify(client, статус + ссылка на карту)
```

---

## 5. Логика каналов

### 5.1 Telegram (текст)

Бот (aiogram/grammY) → webhook на бэкенд. Входящее сообщение → пайплайн §3. Ответы: текст + inline-кнопки (подтвердить рейс, посмотреть статус), карточки рейсов, ссылка на страницу трекинга. Менеджер может «перехватить» диалог из админки (см. §7, чат).

### 5.2 Голосовой звонок (конечный автомат разговора)

ElevenLabs Agent (SIP) ведёт звонок; на каждом шаге дёргает наши tools:

```
GREETING → COLLECT_REQUEST (tool: extractRequest)
        → MATCH (tool: nearestTruck)
        → QUOTE (tool: calcPrice) → озвучивает цену
        → NEGOTIATE (в пределах коридора)
        → CONFIRM → CREATE_ORDER (tool: createOrder)
        → GOODBYE (отправляет детали в Telegram)
```

Расшифровка и итог пишутся в `calls`. Тот же набор tools, что и у текстового канала — логика едина, отличается только интерфейс ввода/вывода.

### 5.3 Уведомления

Сервис уведомлений шлёт клиенту апдейты статусов в Telegram (и опц. SMS). Триггеры — события из `order_events`.

---

## 6. API бэкенда (REST + WebSocket)

Админка и боты общаются с бэкендом через эти эндпоинты:

```
POST /webhook/telegram            // входящие сообщения
POST /webhook/voice               // коллбэки голосового агента/телефонии
POST /webhook/gps                 // push позиций (или поллинг Wialon)

GET  /api/leads        ?stage=     // воронка (для Kanban)
PATCH/api/leads/:id               // смена стадии вручную менеджером
GET  /api/orders       ?status=
GET  /api/orders/:id              // заказ + order_events (таймлайн)
GET  /api/trucks                  // парк (таблица + позиции на карте)
POST /api/trucks  PATCH /api/trucks/:id   // CRUD парка (исходные данные)
GET  /api/clients/:id/messages    // переписка для чата
POST /api/leads/:id/match         // пересчитать подбор
POST /api/leads/:id/quote         // пересчитать цену
POST /api/orders                  // ручное создание заказа
GET  /api/analytics/kpi           // звонки, конверсия, выручка

WS   /ws/tracking                 // live-координаты машин → карта
WS   /ws/inbox                    // live-сообщения/звонки в чат
```

---

## 7. Веб-админка на базе next-shadcn-admin-dashboard

### 7.1 Что это за шаблон

«Zenith Admin» — современный admin-шаблон: **Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4, shadcn/ui**. Дополнительно: **Zustand** (стор настроек), **react-hook-form + zod** (формы), **sonner** (тосты), **lucide-react** + **simple-icons**, **libphonenumber-js** (валидация телефонов), **date-fns**, **@dnd-kit** (drag&drop), **Biome** (линт), менеджер пакетов **pnpm**. Лицензия MIT. Демо: next-shadcn-admin-dashboard-two.vercel.app.

В шаблоне уже есть готовые куски, которые почти 1-в-1 ложатся на наши задачи: мульти-канальный CRM-чат, Kanban, календарь, дашборды (default/analytics/crm/finance), панель кастомизации с переключателем **языка (RU/UA)** и тем, авторизация (login/register), нотификации.

### 7.2 Маппинг наших функций на страницы шаблона

| Наша функция | Страница/механизм шаблона | Что делаем |
|---|---|---|
| Входящие диалоги ИИ (Telegram + звонки), перехват менеджером | `/dashboard/chat` (мульти-канальный CRM-чат: Telegram, WhatsApp, SMS…) | подключаем к `/api/clients/:id/messages` и `WS /ws/inbox`; статусы Open/Pending/Resolved = состояние диалога; «internal notes», quick replies уже есть |
| Воронка продаж (лиды по стадиям) | `/dashboard/kanban` (DnD-доска) | колонки = стадии §4.4; карточки = `leads`; drag = ручная смена стадии (`PATCH /api/leads/:id`) |
| KPI: звонки, конверсия, выручка | `/dashboard/default` + `/dashboard/analytics` | виджеты тянут `/api/analytics/kpi` |
| Парк машин (исходные данные) | **новая** страница `/dashboard/fleet` | таблица shadcn + формы RHF+zod; телефон водителя через готовый `phone-input` (libphonenumber-js) |
| Заказы + таймлайн статусов | **новая** `/dashboard/orders` и `/dashboard/orders/[id]` | таблица + детальная карточка с `order_events` |
| Живая карта перевозок (трекинг) | **новая** `/dashboard/tracking` | Mapbox/Leaflet + `WS /ws/tracking`; точки машин, маршруты, ETA |
| График загрузок/подач | `/dashboard/calendar` | события = загрузки/выгрузки заказов |
| Двуязычие RU/UA | Customize-панель (Language preference, уже в шаблоне) | подключаем i18n-словарь к интерфейсу |
| Вход в админку | `/auth/v1/login` или `/auth/v2/login` | подключаем нашу аутентификацию |

Итог: из 8 экранов **4 уже готовы** в шаблоне (чат, kanban, дашборды, календарь, авторизация), **3 добавляем** (fleet, orders, tracking).

### 7.3 Как добавлять новую страницу (по конвенциям репо)

Шаблон документирует чёткий поток (см. его `README` и `CLAUDE.md`):

1. Пункт меню — `src/navigation/sidebar/sidebar-items.ts`
2. Данные/типы — `src/data/<feature>.ts` (на демо — моки; в проде — fetch к нашему API)
3. Компоненты — `src/app/(main)/dashboard/<feature>/_components/*.tsx` (клиентские помечать `"use client"`)
4. Страница — `src/app/(main)/dashboard/<feature>/page.tsx` (серверный компонент, экспортит `metadata`)

Правило репо: **`page.tsx` — серверный**, вся интерактивность — в одном клиентском контейнере `_components/<feature>-app.tsx`. Импорты через алиас `@/`. Типы строгие (`pnpm exec tsc --noEmit` должен проходить). Тема/пресеты меняют **только цвета** (`--primary`, `--ring`, `--chart-1` и т.п.), не ломая лейаут.

### 7.4 Поток данных админки

```
Browser (Next.js, shadcn) ──REST──> Бэкенд API ──> PostgreSQL/PostGIS
        │  ▲                                  
        └──WS── /ws/tracking, /ws/inbox  <── события (GPS, новые сообщения/звонки)
```

Серверные компоненты Next.js (`page.tsx`) делают первичный fetch (SSR), клиентские контейнеры — live-обновления через WebSocket. Для карты — Mapbox GL / Leaflet в клиентском компоненте.

### 7.5 Запуск шаблона

```
git clone https://github.com/mahooo0/next-shadcn-admin-dashboard.git
cd next-shadcn-admin-dashboard
pnpm install
pnpm dev            # http://localhost:3000  → /dashboard/default
```

Прочее: `pnpm build`, `pnpm start`, `pnpm exec tsc --noEmit` (типы), `pnpm exec biome check src/` (линт). Репо несёт `CLAUDE.md` — конвенции автоматически подхватываются при разработке в Claude Code.

---

## 8. Интеграции (точки подключения)

| Подсистема | Сервис | Как подключается |
|---|---|---|
| Текст-канал | Telegram Bot API | webhook → `/webhook/telegram` |
| Голос | ElevenLabs Agents (SIP) | агент дёргает наши tools; коллбэки → `/webhook/voice` |
| Телефония | Twilio / Telnyx (SIP-trunk) | номер привязан к ElevenLabs |
| Мозг | LLM (Claude/GPT-4o) | function calling из бэкенда |
| Подбор/биржи | ATI.SU API, Lardi-Trans API v2 | fallback-поиск, кэш `bourse_cache` |
| GPS-трекинг | Wialon (Gurtam) Open API / приложение водителя | поллинг/`/webhook/gps` |
| Карты/маршруты | Mapbox / HERE / Leaflet+OSM | фронт-карта + Routing API для ETA |
| Геокодинг | Maps Geocoding API | нормализация городов, кэш в `cities` |
| БД | PostgreSQL + PostGIS, Redis | хранение + гео-запросы + кэш/состояние |

---

## 9. Порядок сборки демо

1. **Бэкенд-каркас:** Postgres+PostGIS, модели §2, REST-эндпоинты §6, сидинг парка (исходные данные).
2. **Логика:** extractRequest (§4.1), nearestTruck (§4.2), calcPrice (§4.3), createOrder, воронка (§4.4).
3. **Telegram-бот:** канал §5.1 на готовом пайплайне.
4. **Админка:** клонируем шаблон, подключаем `chat`, `kanban`, дашборды к API; добавляем `fleet`, `orders`, `tracking` (§7.2–7.3).
5. **Карта/трекинг:** Leaflet+OSM + `WS /ws/tracking`, точка едет по маршруту (для демо — приложение водителя/симуляция).
6. **Голос (опционально для демо):** один сценарий звонка через ElevenLabs Agents §5.2.
7. **Двуязычие:** словарь RU/UA, переключатель в Customize-панели.

---

## Источники

- [next-shadcn-admin-dashboard (репозиторий, README)](https://github.com/mahooo0/next-shadcn-admin-dashboard) · [живое демо](https://next-shadcn-admin-dashboard-two.vercel.app)
- [ElevenLabs Agents](https://elevenlabs.io/agents) · [SIP trunking](https://elevenlabs.io/docs/eleven-agents/phone-numbers/sip-trunking)
- [Wialon (Gurtam) Open API](https://wialon.com/) · [ATI.SU API](https://ati.su/landings/api-ati/) · [Lardi-Trans API v2](https://api.lardi-trans.com/v2/docs/index.html)
- [Mapbox Fleet](https://www.mapbox.com/fleet) · [PostGIS](https://postgis.net/)
