# Phase 3: Telegram Channel — Context

**Gathered:** 2026-06-09 (auto mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Канал ввода через Telegram-бот: клиент пишет в бот → сообщение проходит через `intake.ts` из Phase 2 → создаётся заказ. Что входит:
- grammY 1.43 Bot с webhook на `/webhook/telegram` (заглушка была 501 в Phase 1).
- Secret-token верификация webhook'а.
- Idempotency по `update_id` через существующую таблицу `webhook_updates` (UNIQUE(source, external_id)).
- Adapter Telegram update → ChannelMessage → `handleInboundMessage(ctx, args)` (intake.ts из Phase 2 принимает любой канал — ничего внутри не меняем).
- Inline keyboards для стадии QUOTED («Подтвердить рейс / Изменить / Отказаться»).
- Callback query handler (нажатия кнопок).
- Driver-confirmation bot message после createOrder (если у назначенного водителя есть `telegram_id`).
- Manager intercept: новая колонка `leads.manager_active`, endpoint `POST /api/leads/:id/intercept` для менеджера.
- Notifications сервис: автоматические Telegram-апдейты клиенту на каждый переход FSM заказа (TG-07 / NOTIF-01).
- Команды `/start`, `/help` с RU/UA приветствием.

Что НЕ входит:
- LLM-логика — реюзается из Phase 2 (intake.ts уже знает всё).
- FSM и tools — реюзаются из Phase 2.
- Голос — Phase 3.1.
- Веб-админка — Phase 4.
- BullMQ queue для webhook (inline достаточно для demo трафика; BullMQ — v2).
- SMS-канал — отложен в v2.
- Реальный голосовой channel для driver-confirmation (только Telegram-сообщение; голос — Phase 3.1 + v2 outbound).

</domain>

<decisions>
## Implementation Decisions

### Library & Setup
- **D-01:** **grammY 1.43** (locked в STACK.md). Импорты: `import { Bot, webhookCallback, InlineKeyboard } from 'grammy'`.
- **D-02:** Bot factory в `apps/api/src/channels/telegram/bot.ts`:
  ```ts
  export function createBot(config: Config): Bot<TelegramContext>
  ```
  Принимает TELEGRAM_BOT_TOKEN из env. Inject через Fastify plugin `apps/api/src/plugins/telegram.ts`, чтобы был доступен через `app.bot`.
- **D-03:** **Telegram bot username сохраняем в env** (`TELEGRAM_BOT_USERNAME`) для построения deeplink'ов и /start ссылок. Получаем из @BotFather после создания бота.

### Webhook Route
- **D-04:** Route `apps/api/src/routes/webhooks-telegram.ts` — Fastify handler для `POST /webhook/telegram`:
  ```ts
  app.post('/webhook/telegram', async (req, reply) => {
    // 1. Verify X-Telegram-Bot-Api-Secret-Token header
    // 2. Atomic INSERT into webhook_updates ON CONFLICT DO NOTHING
    // 3. If 0 rows inserted — duplicate, return 200 immediately
    // 4. Otherwise — fire-and-forget worker (не await), return 200
  });
  ```
  Цель: **<100мс ack** (success criterion #2 из ROADMAP).
- **D-05:** **Secret-token verification:** env `TELEGRAM_WEBHOOK_SECRET` (generate via `openssl rand -hex 32`); Telegram отправляет в header `X-Telegram-Bot-Api-Secret-Token`. Mismatch → 401.
- **D-06:** **webhook_updates persistence:**
  ```sql
  INSERT INTO webhook_updates (source, external_id, payload, received_at)
  VALUES ('telegram', $update_id, $payload, NOW())
  ON CONFLICT (source, external_id) DO NOTHING
  ```
  Если `result.rowCount === 0` → дубликат, тихо вернуть 200. **Phase 1 уже создала эту таблицу + UNIQUE.**
- **D-07:** **Async processing pattern:** после persist + ack, вызываем `processTelegramUpdate(payload).catch(logError)` без await. Это «inline-fire-and-forget» — для демо достаточно. BullMQ — v2 PROD-01.
- **D-08:** **Webhook setup при старте сервиса:** `apps/api/src/channels/telegram/setup.ts` экспортирует `setupWebhook(bot, publicUrl, secret)`. Вызывается из `app.ts` после listen, если `TELEGRAM_SET_WEBHOOK_ON_BOOT=true`. Иначе пользователь делает руками через скрипт `pnpm telegram:setup`.

### Adapter: Telegram → Pipeline
- **D-09:** `apps/api/src/channels/telegram/adapter.ts` экспортирует:
  ```ts
  export async function telegramUpdateToInbound(
    update: Update,
    db: Db
  ): Promise<InboundArgs | null>
  ```
  - Извлекает `client_phone` — для Telegram primary identity это **`telegram_id`** (because phone optional). Создаём synthetic phone `tg:${from.id}` если у клиента нет телефона. Если клиент шарит контакт через `request_contact` button — обновляем `clients.phone` на реальный E.164.
  - `text` — `update.message.text` или для callback'ов — синтетический «да»/«нет» в зависимости от `callback_data`.
  - `channel: 'telegram'`, `external_id` = `update.update_id.toString()`.
- **D-10:** **Client lookup/upsert** в адаптере:
  ```ts
  // Поиск по telegram_id; если нет — создаём с phone='tg:${from.id}'
  let client = await clientsRepo.findByTelegramId(db, from.id);
  if (!client) {
    client = await clientsRepo.create(db, {
      telegram_id: from.id.toString(),
      phone: `tg:${from.id}`,
      name: [from.first_name, from.last_name].filter(Boolean).join(' '),
      // lang не ставим — sticky detection из Phase 2 определит на первом ≥20-char сообщении
    });
  }
  ```
  Метод `clientsRepo.findByTelegramId` нужно добавить в `apps/api/src/persistence/repos/clients.ts`.
- **D-11:** **Manager intercept gate:** перед вызовом `handleInboundMessage` проверяем `lead.manager_active`. Если true — пропускаем LLM-обработку (только persist `messages` row с role='client'). Менеджер реагирует через админку (Phase 4).

### Inline Keyboards
- **D-12:** Inline keyboard для стадии QUOTED — посылается **после** `intake.ts` написал quoted_price. Файл `apps/api/src/channels/telegram/keyboards.ts`:
  ```ts
  export function quoteKeyboard(leadId: string, lang: ClientLang): InlineKeyboard {
    const labels = lang === 'ua'
      ? { confirm: 'Підтвердити рейс ✅', change: 'Змінити умови', reject: 'Відмова' }
      : { confirm: 'Подтвердить рейс ✅', change: 'Изменить условия', reject: 'Отказаться' };
    return new InlineKeyboard()
      .text(labels.confirm, `confirm:${leadId}`)
      .text(labels.reject, `reject:${leadId}`)
      .row()
      .text(labels.change, `change:${leadId}`);
  }
  ```
- **D-13:** **callback_data format:** `<action>:<leadId>` — action ∈ {`confirm`, `reject`, `change`, `driver_accept`, `driver_decline`}.
- **D-14:** **Hook в intake.ts** для отправки клавиатуры: после `transitionLead → QUOTED` + write `quoted_price`, intake.ts вызывает abstraction `ctx.outbound.sendQuoteKeyboard(client_id, lead_id, quoted_price, lang)`. Реализация для Telegram использует grammY `bot.api.sendMessage(chat_id, text, { reply_markup: quoteKeyboard(...) })`. Для голоса (Phase 3.1) — другая реализация. Channel-agnostic интерфейс.

### Callback Query Handler
- **D-15:** `apps/api/src/channels/telegram/handlers.ts` экспортирует:
  ```ts
  bot.callbackQuery(/^(confirm|reject|change):(.+)$/, async (ctx) => {
    const [_, action, leadId] = ctx.match;
    await ctx.answerCallbackQuery(); // 200ms requirement
    // Map to synthetic inbound message
    const text = action === 'confirm' ? 'да' : action === 'reject' ? 'нет' : 'изменить';
    await handleInboundMessage(pipelineCtx, {
      client_phone: clientPhone,
      text,
      channel: 'telegram',
      external_id: `cb:${ctx.callbackQuery.id}`,
    });
    // Remove buttons from original message
    await ctx.editMessageReplyMarkup({ reply_markup: undefined });
  });
  ```
- **D-16:** `change` callback → bot отвечает «Уточните, что изменить?» (RU) / «Уточніть, що змінити?» (UA) и lead остаётся в QUOTED. Дальнейшие сообщения intake.ts обработает через clarification budget из Phase 2.

### Driver Confirmation Loop (TG-05)
- **D-17:** После `transitionOrder → DRIVER_ASSIGNED`, hook в `order-fsm.ts` вызывает `notifyDriver(order_id, db, bot)` — отдельный сервис в `apps/api/src/channels/telegram/notifications.ts`.
- **D-18:** `notifyDriver` логика:
  ```ts
  export async function notifyDriver(orderId, db, bot) {
    const order = await ordersRepo.findById(db, orderId);
    const truck = await trucksRepo.findById(db, order.truck_id);
    if (!truck.driver_telegram_id) {
      log.warn({ truck_id: truck.id }, 'driver_telegram_id missing — sim stub');
      // Stub: mark order as auto-confirmed for demo, log warning
      await transitionOrder(db, { order_id, type: 'driver_assigned', actor: 'system', payload: { driver_response: 'simulated_auto_accept' } });
      return;
    }
    await bot.api.sendMessage(truck.driver_telegram_id, formatAssignment(order, truck.lang), {
      reply_markup: driverKeyboard(orderId, truck.lang),
    });
  }
  ```
- **D-19:** `driverKeyboard` — 2 кнопки «Принять / Отказаться» с callback `driver_accept:ORDER_ID` / `driver_decline:ORDER_ID`. При accept → `transitionOrder → DRIVER_ASSIGNED` (уже стоит — просто confirmation); при decline → возвращаем lead в MATCHED, чтобы intake re-matched.
- **D-20:** **Driver telegram_id source:** добавляем колонку `trucks.driver_telegram_id BIGINT NULL` через мини-миграцию `0003_phase3_telegram.sql`. Seed обновится — у 2 водителей будут реальные telegram_id, остальные null (для теста stub flow).

### Manager Intercept (TG-06)
- **D-21:** Миграция 0003 также добавляет `leads.manager_active BOOLEAN NOT NULL DEFAULT FALSE`. Когда менеджер в админке нажимает «перехватить диалог» — `POST /api/leads/:id/intercept` ставит флаг + посылает welcome через бота: «Здравствуйте, я Иван, менеджер. Чем могу помочь?» (RU/UA по `clients.lang`).
- **D-22:** **Manager messages flow:** менеджер пишет в админ-чате (Phase 4) → `POST /api/leads/:id/manager-message` с body `{text}` → endpoint:
  1. INSERT в `messages` с `role='manager'`
  2. `bot.api.sendMessage(chat_id, text)`
  Никакого LLM, никакого FSM transition.
- **D-23:** **Release intercept:** менеджер нажимает «вернуть боту» → `POST /api/leads/:id/release` → `manager_active=false` + bot пишет «Передаю обратно AI-ассистенту. Что-то ещё?». Дальнейшие client сообщения снова идут через intake.ts.

### Notifications (TG-07 / NOTIF-01)
- **D-24:** `apps/api/src/channels/telegram/notifications.ts` экспортирует `notifyClient(orderId, transition, db, bot, lang)`. Шаблоны в `apps/api/src/lib/i18n.ts` (создан как stub в Phase 2, расширяется здесь):
  - DRIVER_ASSIGNED: «Машина назначена! Номер: {plate}. Водитель: {driver_name}, {driver_phone}.»
  - IN_TRANSIT: «Груз в пути.»
  - DELIVERED: «Доставлено! Спасибо за заказ.»
- **D-25:** Hook в `order-fsm.ts → transitionOrder`: после успешного COMMIT, асинхронно вызвать `notifyClient` для соответствующих переходов. Не блокируем FSM транзакцию.
- **D-26:** Если у клиента `clients.telegram_id IS NULL` (звонил голосом, не писал в TG) — skip нотификацию, log info. Phase 3.1 добавит SMS fallback опционально (или просто не уведомим — для демо ОК).

### Bot Commands
- **D-27:** `/start` — приветствие на RU по дефолту (lang ещё не известен на первом сообщении). Текст: «Здравствуйте! Я AI-ассистент компании. Чтобы оформить заказ — напишите откуда, куда, сколько тонн и тип кузова. Например: "Киев-Львов, 18 тонн, тент".» Регистрируется через `bot.command('start', ...)`.
- **D-28:** `/help` — краткая справка с примерами на RU+UA. После определения lang клиента — следующие /help будут только на нём.
- **D-29:** **Inline help при невалидном вводе:** в intake.ts из Phase 2 уже есть clarification budget — если LLM не понял запрос, спросит уточнение. Дополнительно бот реагирует на стикеры/фото/голос (пока) фразой «Я понимаю только текстовые сообщения. Напишите детали груза».

### Configuration & Env
- **D-30:** Новые env vars в `apps/api/src/config.ts`:
  - `TELEGRAM_BOT_TOKEN` (required) — от @BotFather
  - `TELEGRAM_WEBHOOK_SECRET` (required) — `openssl rand -hex 32`
  - `TELEGRAM_BOT_USERNAME` (required) — без @ (например `ai_logist_demo_bot`)
  - `TELEGRAM_PUBLIC_URL` (optional, default `null`) — base URL для setWebhook (пример `https://ai-logist.yourdomain.com`)
  - `TELEGRAM_SET_WEBHOOK_ON_BOOT` (optional, default `false`)
- **D-31:** **Development setup:** README'у добавляем секцию «Telegram dev» с шагами:
  1. Создать бота у @BotFather → получить TOKEN
  2. `ngrok http 3000` → получить HTTPS URL
  3. `TELEGRAM_PUBLIC_URL=https://xxx.ngrok.io pnpm telegram:setup`
  4. Тестировать с реальным аккаунтом

### Health Endpoint Extension
- **D-32:** `/api/health` расширяется на `checks.telegram`:
  - `'ok'` если `bot.api.getMe()` отвечает успешно
  - `'not_configured'` если `TELEGRAM_BOT_TOKEN` пуст
  - `'error'` если getMe бросает
  Cache result на 60 секунд чтобы не дёргать Telegram API на каждый health probe.

### Claude's Discretion
- Точная структура error handling (например, что делать если grammY бросает в callback worker) — Claude.
- Pino log severity для разных событий — Claude.
- Конкретные тексты приветствий и сообщений системы (могут уточняться при тестировании) — Claude черновики, потом полировка.
- Структура файлов внутри `apps/api/src/channels/telegram/` (один файл vs несколько) — Claude.

### Folded Todos
*Нет — backlog пуст.*

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec & Project Docs
- `ai-logist-logic-spec.md` §5.1 — Telegram (текст) канал, описание flow
- `ai-logist-logic-spec.md` §6 — REST + WebSocket эндпоинты, в т.ч. `POST /webhook/telegram`
- `.planning/PROJECT.md` — Core Value: «LLM не принимает решения по деньгам»
- `.planning/REQUIREMENTS.md` — Phase 3 покрывает 9 reqs: API-13, API-15, TG-01..07

### Phase 1 & 2 Artifacts (foundation — must respect)
- `apps/api/src/persistence/schema/webhook_updates.ts` — уже создана с UNIQUE(source, external_id) для идемпотентности
- `apps/api/src/persistence/schema/clients.ts` — есть `telegram_id` колонка, нужно добавить `findByTelegramId` в repo
- `apps/api/src/persistence/schema/leads.ts` — добавляем `manager_active` колонку через миграцию 0003
- `apps/api/src/persistence/schema/trucks.ts` — добавляем `driver_telegram_id` через миграцию 0003
- `apps/api/src/persistence/schema/messages.ts` — `role` enum уже есть `'client' | 'ai' | 'manager'`
- `apps/api/src/pipeline/intake.ts` — `handleInboundMessage` принимает любой channel; **не модифицируем** core, только добавляем outbound abstraction (D-14)
- `apps/api/src/pipeline/lifecycle/order-fsm.ts` — `transitionOrder` нужно дополнить onSuccess hook для notifyClient
- `apps/api/src/config.ts` — Zod env, расширяем 5 новыми переменными (D-30)
- `apps/api/src/routes/leads.ts` — уже есть skeleton, добавляем `POST /api/leads/:id/intercept`, `release`, `manager-message`
- `apps/api/src/routes/webhooks.ts` — 501-stub /webhook/telegram заменяется на реальный handler

### Research
- `.planning/research/STACK.md` — grammY 1.43 (TS-native, webhook-first)
- `.planning/research/PITFALLS.md` Pitfall #5 — Telegram webhook duplicates + FSM races; защита уже в intake.ts (advisory lock из Phase 2) + UNIQUE(update_id) здесь

### External Library Docs
- grammY documentation — https://grammy.dev/guide/
- grammY webhook setup — https://grammy.dev/guide/deployment-types#webhooks
- grammY inline keyboards — https://grammy.dev/plugins/keyboard
- Telegram Bot API Update object — https://core.telegram.org/bots/api#update
- Telegram webhook secret_token — https://core.telegram.org/bots/api#setwebhook

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (from Phase 1 + 2)
- **`apps/api/src/pipeline/intake.ts`** — полный pipeline (advisory lock → sticky lang → token check → extract → clarify → city → match → price-lock → confirm → createOrder). Phase 3 НЕ модифицирует его — только адаптер канала вызывает `handleInboundMessage`.
- **`apps/api/src/pipeline/llm-tools/*`** — все 6 tools (extract, detect-lang, nearest-truck, calc-price, create-order, discount) уже готовы. Telegram канал не дёргает их напрямую — через intake.ts.
- **`apps/api/src/pipeline/lifecycle/{lead-fsm, order-fsm}.ts`** — transitionLead/transitionOrder используются как есть. **Расширяем order-fsm** на hook для notifyClient (D-25).
- **`apps/api/src/persistence/schema/webhook_updates.ts`** — UNIQUE(source, external_id) уже есть, готово для Telegram update_id.
- **`apps/api/src/persistence/repos/clients.ts`** — добавляем `findByTelegramId(db, telegramId)`.
- **`apps/api/src/lib/lang-detect.ts`** — sticky lang detect уже работает; для Telegram дополнительно проверяем `language_code` из `message.from` как hint.
- **`apps/api/src/lib/i18n.ts`** — словарь для system messages, расширяем для уведомлений.
- **`apps/api/tests/_helpers/dialog-harness.ts`** — `runScript` уже умеет гонять диалог через intake.ts. Для Telegram-специфичных тестов добавляем `tests/_helpers/telegram-harness.ts` который мокает grammY Bot.

### Established Patterns (must follow)
- **Tools-as-security-boundary** из Phase 2 — Telegram не получает прямой доступ к БД, только через intake → tools.
- **Bigint kopecks для денег** — quoted_price передаётся в keyboard text через `formatMoney(kopecks, lang)` helper.
- **Zod-валидация Telegram payload** — webhook handler парсит `Update` через `z.object` или прямо через grammY types.
- **per-client advisory lock** — `intake.ts` уже делает `pg_advisory_xact_lock(hashtext(client_id))` (Pitfall #5).
- **idempotency** через UNIQUE(source, external_id) — Phase 3 первый реальный пользователь webhook_updates.

### Integration Points
- `apps/api/src/channels/telegram/{bot, adapter, handlers, keyboards, notifications, setup}.ts` — новый module.
- `apps/api/src/routes/webhooks-telegram.ts` — Fastify route, заменяет stub из Phase 1.
- `apps/api/src/routes/leads.ts` — добавляются 3 новых endpoint'а для manager intercept (intercept, release, manager-message).
- `apps/api/src/routes/health.ts` — расширяется `checks.telegram`.
- `apps/api/src/app.ts` — регистрируется telegram plugin + webhook route.
- `apps/api/drizzle/0003_phase3_telegram.sql` — добавляет `leads.manager_active`, `trucks.driver_telegram_id`.
- `apps/api/src/lib/i18n.ts` — расширяется templates для notifications + keyboards.

</code_context>

<specifics>
## Specific Ideas

- **«Реальный Telegram chat completes pipeline»** (success criterion #1) — критично. Нужен RU/UA дефолт-сценарий который воспроизводим вручную: написать «Киев-Львов, 18 тонн, тент» → получить цену с кнопками → нажать Подтвердить → увидеть order в psql со stage=`ORDER_CREATED`. Это E2E проверка которая закроет UAT-03 для Phase 3.
- **`<100ms ack`** (success criterion #2) — измеряется в integration тесте через testcontainers: handler should return 200 within 100ms even if downstream work takes longer. Это означает persist + return ack происходит до того как мы начнём async processing.
- **Driver confirmation для демо:** один из seeded trucks получит реальный `driver_telegram_id` (тестовый юзер автора). Остальные останутся null — для них работает stub flow.
- **Telegram language_code как hint, не override** — `from.language_code` может быть 'ru' / 'uk' / 'en' / ..., но **sticky lang detection из Phase 2 имеет приоритет** (D-12 phase 2). hint используется только если у клиента ещё нет `lang` и сообщение короче 20 символов (для приветствия системой).
- **Idempotency проверка прямо в тесте:** integration test шлёт один и тот же update_id 10 раз → expect ровно 1 row в `messages` + 1 lead.

</specifics>

<deferred>
## Deferred Ideas

- **BullMQ queue для async processing** webhook'ов — для демо inline достаточно. → v2 PROD-01.
- **Real-time WS push о смене FSM-стадии** — `/dashboard/chat` UI обновляется через WS. → Phase 4.
- **Voice driver confirmation** (бот звонит водителю) — Phase 3.1 + v2 outbound voice.
- **SMS fallback** если у клиента нет Telegram — отложено в v2 PROD-04.
- **Файлы/документы через Telegram** (фото груза, паспорт водителя) — для демо текст достаточно. → v2.
- **Шифрование PII в messages.text** — Phase 6 polish / v2 PROD-03 (Audit + PII).
- **Manager Telegram bot для approvals** (менеджер тоже через бот) — слишком сложно для демо. v2.
- **Rate limiting per-client на webhook'и** — v2 PROD-05.

### Reviewed Todos (not folded)
*Нет — backlog пуст.*

</deferred>

---

*Phase: 03-telegram-channel*
*Context gathered: 2026-06-09 (auto mode, 32 locked decisions reflecting Phase 1+2 foundation)*
