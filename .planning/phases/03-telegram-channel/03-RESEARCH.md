# Phase 3: Telegram Channel — Research

**Researched:** 2026-06-09
**Domain:** Telegram Bot webhook adapter on top of an already-complete intake pipeline
**Confidence:** HIGH (grammY 1.43 + Fastify v5 patterns verified against official docs; Pitfall #5 closed by Phase 2 advisory lock + Phase 1 UNIQUE(source, external_id))

## Summary

Phase 3 is **purely a channel adapter**, not a logic phase. `apps/api/src/pipeline/intake.ts` (Phase 2) already contains the full `handleInboundMessage(args)` pipeline — advisory lock, sticky lang, extract, clarify, match, price-lock, confirm shortcut, create-order. Phase 3's job is to: (1) accept Telegram updates over HTTP, (2) deduplicate them via `webhook_updates`, (3) translate Telegram's update shape into `InboundMessageArgs`, (4) call `handleInboundMessage`, (5) render the resulting `exchanges[]` back as Telegram messages with inline keyboards, and (6) hook FSM transitions to notification sends. **Nine requirements** (API-13, API-15, TG-01..07).

The standard pattern is grammY 1.43.0 `Bot` instance constructed in a Fastify plugin (`apps/api/src/plugins/telegram.ts`), webhook route in `apps/api/src/routes/webhooks-telegram.ts` that does the two-stage handler (persist + 200 in <100ms; async worker fires `processTelegramUpdate` with `.catch(logError)`). All inline keyboards are sent via `bot.api.sendMessage(chat_id, text, { reply_markup })` from a channel-agnostic `OutboundChannel` interface so intake.ts remains channel-blind.

**Primary recommendation:** Treat `intake.ts` as fixed law — every Phase 3 file is either (a) an adapter into intake or (b) a side-effect rendering of intake's outputs. The five danger zones are: webhook secret-token timing, ack-latency under 100ms, Telegram update dedup race, FSM hook deadlock (notify must NOT run inside the order-fsm transaction), and the `tg:${from.id}` synthetic phone collision check.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Library & Setup**
- **D-01:** grammY 1.43 (locked в STACK.md). Imports: `import { Bot, webhookCallback, InlineKeyboard } from 'grammy'`.
- **D-02:** Bot factory `apps/api/src/channels/telegram/bot.ts` exporting `createBot(config: Config): Bot<TelegramContext>`. Injected via Fastify plugin `apps/api/src/plugins/telegram.ts` so it is reachable through `app.bot`.
- **D-03:** Telegram bot username saved in env (`TELEGRAM_BOT_USERNAME`) for deeplinks / /start links.

**Webhook Route**
- **D-04:** Route `apps/api/src/routes/webhooks-telegram.ts` Fastify handler for `POST /webhook/telegram` — verify secret, ON CONFLICT DO NOTHING, fire-and-forget worker, return 200 in <100ms.
- **D-05:** Secret-token via env `TELEGRAM_WEBHOOK_SECRET` (generate via `openssl rand -hex 32`); Telegram sends in header `X-Telegram-Bot-Api-Secret-Token`. Mismatch → 401.
- **D-06:** `webhook_updates` persistence: `INSERT … ON CONFLICT (source, external_id) DO NOTHING`. If `rowCount === 0` → duplicate, return 200 silently.
- **D-07:** Async processing: after persist + ack, `processTelegramUpdate(payload).catch(logError)` without await. BullMQ deferred to v2.
- **D-08:** Webhook setup at boot via `apps/api/src/channels/telegram/setup.ts` (`setupWebhook(bot, publicUrl, secret)`), called from `app.ts` if `TELEGRAM_SET_WEBHOOK_ON_BOOT=true`, else manual via `pnpm telegram:setup`.

**Adapter**
- **D-09:** `apps/api/src/channels/telegram/adapter.ts` exports `telegramUpdateToInbound(update, db): Promise<InboundArgs | null>`.
- **D-10:** Client lookup/upsert: `clientsRepo.findByTelegramId(db, from.id)` (already exists per Plan 02 STATE); if absent create with `phone='tg:${from.id}'`, `telegramId=from.id.toString()`, `name=[from.first_name, from.last_name].filter(Boolean).join(' ')`. `lang` left null — sticky detection from Phase 2 fills it on first ≥20-char message.
- **D-11:** Manager intercept gate: before calling `handleInboundMessage`, check `lead.manager_active`. If true → skip LLM, only persist `messages` row with `role='client'`.

**Inline Keyboards**
- **D-12:** quoteKeyboard sent AFTER intake.ts wrote quoted_price. File `apps/api/src/channels/telegram/keyboards.ts`. RU/UA labels per `clients.lang`.
- **D-13:** callback_data format `<action>:<leadId>`, actions ∈ {`confirm`, `reject`, `change`, `driver_accept`, `driver_decline`}.
- **D-14:** Hook in intake via `ctx.outbound.sendQuoteKeyboard(...)` abstraction. Telegram impl uses grammY `bot.api.sendMessage`. Voice impl (Phase 3.1) — different. Channel-agnostic.

**Callback Query Handler**
- **D-15:** `apps/api/src/channels/telegram/handlers.ts` with regex `^(confirm|reject|change):(.+)$`; 200ms `answerCallbackQuery`; map to synthetic 'да'/'нет'/'изменить' text; call `handleInboundMessage`; `editMessageReplyMarkup({ reply_markup: undefined })` strips buttons.
- **D-16:** `change` callback → bot answers «Уточните, что изменить?» (RU) / «Уточніть, що змінити?» (UA); lead remains QUOTED; further messages absorbed by clarification budget.

**Driver Confirmation Loop**
- **D-17:** After `transitionOrder → DRIVER_ASSIGNED`, hook in `order-fsm.ts` calls `notifyDriver(order_id, db, bot)`.
- **D-18:** notifyDriver: if `truck.driver_telegram_id` is null → log warn + simulated auto-accept transition. Else `bot.api.sendMessage(truck.driver_telegram_id, formatAssignment(...), { reply_markup: driverKeyboard(...) })`.
- **D-19:** driverKeyboard — 2 buttons «Принять / Отказаться» with `driver_accept:ORDER_ID` / `driver_decline:ORDER_ID`. Accept → already DRIVER_ASSIGNED (confirmation); decline → return lead to MATCHED.
- **D-20:** Migration 0003 adds `trucks.driver_telegram_id BIGINT NULL`. **⚠ See OVERRIDE in "Runtime State Inventory" below — the column already exists as TEXT in the current schema; migration 0003 must align column type with how grammY's `from.id` is provided.**

**Manager Intercept**
- **D-21:** Migration 0003 adds `leads.manager_active BOOLEAN NOT NULL DEFAULT FALSE`. Manager click in admin → `POST /api/leads/:id/intercept` sets flag + sends RU/UA welcome.
- **D-22:** Manager messages: `POST /api/leads/:id/manager-message {text}` → INSERT `messages` role='manager' + `bot.api.sendMessage(chat_id, text)`. No LLM, no FSM.
- **D-23:** Release intercept: `POST /api/leads/:id/release` → `manager_active=false` + handover message.

**Notifications**
- **D-24:** `apps/api/src/channels/telegram/notifications.ts` exports `notifyClient(orderId, transition, db, bot, lang)`. Templates in `apps/api/src/lib/i18n.ts` (stub from Phase 2 extended here).
- **D-25:** Hook in `order-fsm.ts → transitionOrder`: AFTER successful COMMIT, async `notifyClient`. Do NOT block FSM tx.
- **D-26:** If `clients.telegram_id IS NULL` → skip notif, log info. SMS fallback deferred to v2.

**Bot Commands**
- **D-27:** `/start` defaults to RU greeting via `bot.command('start', ...)`.
- **D-28:** `/help` brief RU+UA reference; after lang known — only that lang.
- **D-29:** Stickers/photo/voice → polite «Я понимаю только текстовые сообщения. Напишите детали груза».

**Configuration & Env**
- **D-30:** New env vars in `apps/api/src/config.ts`: `TELEGRAM_BOT_TOKEN` (required), `TELEGRAM_WEBHOOK_SECRET` (required), `TELEGRAM_BOT_USERNAME` (required), `TELEGRAM_PUBLIC_URL` (optional, default null), `TELEGRAM_SET_WEBHOOK_ON_BOOT` (optional, default false). **⚠ TELEGRAM_BOT_TOKEN + TELEGRAM_WEBHOOK_SECRET already exist as optional in config.ts (Phase 2 placeholder) — make them required and add the other three.**
- **D-31:** Dev setup README section: BotFather → ngrok → `pnpm telegram:setup` → test.

**Health Endpoint Extension**
- **D-32:** `/api/health` adds `checks.telegram`: 'ok' / 'not_configured' / 'error' from `bot.api.getMe()`, cached 60s.

### Claude's Discretion
- Exact error handling structure if grammY throws inside callback worker — Claude.
- Pino log severity for various events — Claude.
- Exact wording of greetings/system messages (drafts now, polish later) — Claude.
- Internal file structure inside `apps/api/src/channels/telegram/` (one file vs several) — Claude.

### Deferred Ideas (OUT OF SCOPE)
- BullMQ queue for async webhook processing → v2 PROD-01.
- Real-time WS push on FSM stage change → Phase 4.
- Voice driver confirmation (bot calls driver) → Phase 3.1 + v2 outbound voice.
- SMS fallback if client has no Telegram → v2 PROD-04.
- Files/documents through Telegram (cargo photos, driver passport) → v2.
- PII encryption in messages.text → Phase 6 polish / v2 PROD-03.
- Manager Telegram bot for approvals → v2.
- Rate limiting per-client on webhooks → v2 PROD-05.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| API-13 | Webhook `/webhook/telegram` with `secret_token` verification | §"Two-Stage Webhook Handler" + §"Secret Token Verification" |
| API-15 | Webhook `/webhook/voice` (stub returns 200) | Already a 501 stub in Phase 1; Phase 3 leaves it as 200-ack stub (no logic added; just flip 501 → 200 to satisfy spec; voice logic is Phase 3.1) |
| TG-01 | grammY 1.43 webhook, secret_token check | §"grammY 1.43 + Fastify Plugin Pattern" + §"Secret Token Verification" |
| TG-02 | Two-stage handler, persist update_id, return 200 <100ms | §"Two-Stage Webhook Handler" — code block 2 |
| TG-03 | Inline buttons «Подтвердить / Изменить / Отказаться» | §"Inline Keyboard Renderers" — code block 4 |
| TG-04 | Cards with trip info + tracking link on truck offer | §"formatQuoteMessage helper" — same code block 4 |
| TG-05 | Driver-confirmation loop with «Принять/Отказаться» | §"Driver Notification Flow" — code block 7 |
| TG-06 | Manager «перехватить» from admin → bot silent for that client | §"Manager Intercept Endpoints" — code block 10 |
| TG-07 | Auto-notifications on FSM transition (NOTIF-01) | §"Client Notifications" + §"FSM Hook" — code blocks 8 + 9 |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `grammy` | **1.43.0** (verified 2026-05-16 via `npm view grammy version`) | Telegram bot framework | Locked in STACK.md. TS-native, webhook-first, has built-in Fastify adapter via `webhookCallback(bot, 'fastify')`. |
| `fastify` | 5.x (already in repo) | HTTP framework | grammY's webhookCallback fastify adapter wraps a Fastify handler verbatim. |
| `@anthropic-ai/sdk` | 0.102 (already in repo) | LLM client | Used by intake.ts. Phase 3 does not call LLM directly. |
| Drizzle ORM | 0.45.2 (already in repo) | Postgres ORM | Used for `webhook_updates` upsert + `clients.telegram_id` lookup. |
| `zod/v4` | (already in repo) | Telegram payload validation | The existing `TelegramUpdateBodySchema` uses `.passthrough()`; Phase 3 keeps that loose envelope and validates the narrow `update_id` field strictly. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pino` | (already in repo) | Structured logging | Webhook errors, driver-id-missing warnings, dedup logs. |
| `nanoid` | 5.x (already in repo) | Token / id generation | Order public_token already generated by createOrder. Phase 3 reuses. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| grammY `webhookCallback(bot, 'fastify')` | Raw `app.post('/webhook/telegram', …)` with manual `bot.handleUpdate(payload)` | grammY's adapter signs us up for grammY's internal validation + adapter logic; the raw approach gives us tighter timing control (we want <100ms ack BEFORE grammY runs middlewares). **Use the raw approach** — see §"Two-Stage Webhook Handler" — because the two-stage architecture explicitly does NOT want grammY's middleware chain to block the ack. grammY's `Bot` is still used for `bot.api.sendMessage(...)` + `bot.handleUpdate(payload)` invoked inside the worker. |
| BullMQ for async processing | `setImmediate` / promise-fire-and-forget | BullMQ adds retries + persistence; for demo inline is fine and CONTEXT.md D-07 locks this. |
| `@grammyjs/router` | Plain `bot.callbackQuery(regex, ...)` | Router is heavyweight for 5 callback patterns. CONTEXT D-15 locks plain `callbackQuery`. |

**Installation:**

```bash
pnpm --filter @ai-logist/api add grammy
```

**Version verification (verified 2026-06-09):**
- `npm view grammy version` → `1.43.0` (published 2026-05-16)
- `npm view grammy peerDependencies` → no required peers
- Already locked in `.planning/research/STACK.md` and project CLAUDE.md.

## Architecture Patterns

### Recommended Project Structure

```
apps/api/src/
├── channels/
│   └── telegram/
│       ├── bot.ts              # createBot factory (D-02)
│       ├── adapter.ts          # telegramUpdateToInbound (D-09)
│       ├── handlers.ts         # bot.command + bot.callbackQuery wiring (D-15)
│       ├── keyboards.ts        # quoteKeyboard / driverKeyboard (D-12, D-19)
│       ├── notifications.ts    # notifyClient / notifyDriver (D-17, D-24)
│       ├── outbound.ts         # TelegramOutbound impl of OutboundChannel
│       ├── setup.ts            # setupWebhook (D-08)
│       └── i18n.ts             # Telegram-specific strings (extends lib/i18n.ts)
├── pipeline/
│   ├── intake.ts               # UNCHANGED — already accepts any channel
│   ├── lifecycle/
│   │   └── order-fsm.ts        # MODIFIED — add onSuccess hook for notifications (D-25)
│   └── outbound.ts             # NEW: OutboundChannel interface + registry
├── plugins/
│   └── telegram.ts             # NEW: Fastify plugin decorating app.bot
├── routes/
│   ├── webhooks-telegram.ts    # NEW: replaces stub in webhooks.ts (D-04)
│   ├── webhooks.ts             # MODIFIED: remove /telegram, leave /voice + /gps
│   └── leads.ts                # MODIFIED: add /intercept, /release, /manager-message (D-21..D-23)
├── persistence/
│   ├── schema/
│   │   ├── leads.ts            # MODIFIED: add managerActive column (D-21)
│   │   └── trucks.ts           # MODIFIED: driverTelegramId already exists as text — see Runtime State Inventory
│   └── repos/
│       └── clients.ts          # findByTelegramId ALREADY EXISTS (verified)
└── drizzle/
    └── 0003_phase3_telegram.sql  # NEW: ALTER TABLE migrations
```

### Pattern 1: grammY 1.43 + Fastify Plugin Pattern

**What:** Construct one `Bot` instance per Fastify app, expose via `app.bot` decorator. The Bot is used for outbound sends (`bot.api.sendMessage`) and to dispatch decoded updates (`bot.handleUpdate(payload)`) inside the async worker.

**When to use:** Once per app boot. Plugin is registered after redis but before routes, so routes can do `app.bot.api.sendMessage(...)`.

**Example (paste-ready):**

```typescript
// apps/api/src/plugins/telegram.ts
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { Bot } from 'grammy';
import { config } from '../config.js';
import { createBot } from '../channels/telegram/bot.js';
import { registerTelegramHandlers } from '../channels/telegram/handlers.js';

declare module 'fastify' {
  interface FastifyInstance {
    bot: Bot;
  }
}

export const telegramPlugin = fp(
  async (app: FastifyInstance) => {
    if (!config.TELEGRAM_BOT_TOKEN) {
      app.log.warn('telegram: TELEGRAM_BOT_TOKEN missing — bot disabled');
      // Decorate with a stub so app.bot always exists; routes guard at call-site.
      // In production prefer throwing — see "Open Questions" §1.
      return;
    }
    const bot = createBot(config);
    // Register inbound handlers (commands, callback queries) ONCE.
    registerTelegramHandlers(bot, app);
    // grammY needs init() before processing updates outside of bot.start().
    // init() fetches bot info (id, username) and validates the token.
    await bot.init();
    app.log.info({ username: bot.botInfo.username }, 'telegram: bot initialized');
    app.decorate('bot', bot);

    // Cleanup on shutdown — stop in-flight long polls (we use webhooks but
    // grammY's internal queues should still drain).
    app.addHook('onClose', async () => {
      await bot.stop();
    });
  },
  { name: 'telegram', dependencies: ['db', 'redis'] }
);
```

```typescript
// apps/api/src/channels/telegram/bot.ts
import { Bot, type Context } from 'grammy';
import type { AppConfig } from '../../config.js';

// Phase 3 uses the default Context — no flavors yet. Future plugins
// (sessions, conversations) would extend this.
export type TelegramContext = Context;

export function createBot(cfg: AppConfig): Bot<TelegramContext> {
  if (!cfg.TELEGRAM_BOT_TOKEN) {
    throw new Error('createBot: TELEGRAM_BOT_TOKEN is required');
  }
  // grammY 1.43 — default Bot constructor takes the token + optional config.
  // We do NOT pass a custom Api client; the default HTTPS client is fine.
  const bot = new Bot<TelegramContext>(cfg.TELEGRAM_BOT_TOKEN, {
    // Disable the built-in update queue — we manage queuing via webhook_updates.
    botInfo: undefined, // forces init() to fetch
  });
  return bot;
}
```

Wire into `app.ts`:
```typescript
// apps/api/src/app.ts — after redisPlugin, before routes:
await app.register(telegramPlugin);
// ... existing route registrations
await app.register(webhooksTelegramRoutes, { prefix: '/webhook' });
```

### Pattern 2: Two-Stage Webhook Handler (<100ms Ack)

**What:** The webhook handler does **only** secret-check + DB insert + 200 ack. The actual processing (`bot.handleUpdate(payload)`) is fired-and-forgotten via a `setImmediate` callback that catches and logs all errors.

**When to use:** Every inbound Telegram update.

**Example (paste-ready):**

```typescript
// apps/api/src/routes/webhooks-telegram.ts
import { WebhookAckResponseSchema, TelegramUpdateBodySchema } from '@ai-logist/shared-types/api/webhooks';
import { sql } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';
import { config } from '../config.js';
import { processTelegramUpdate } from '../channels/telegram/adapter.js';

const NotImpl = z.object({
  statusCode: z.number(),
  error: z.string(),
  message: z.string(),
});

const webhooksTelegramRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/telegram',
    {
      schema: {
        tags: ['webhooks'],
        summary: 'Telegram webhook (TG-01/TG-02)',
        body: TelegramUpdateBodySchema,
        response: { 200: WebhookAckResponseSchema, 401: NotImpl },
      },
    },
    async (req, reply) => {
      // (1) Secret-token verification (TG-01, D-05).
      // Telegram sends X-Telegram-Bot-Api-Secret-Token header iff secret_token
      // was passed to setWebhook. Mismatch = forged request → 401.
      const provided = req.headers['x-telegram-bot-api-secret-token'];
      if (
        !config.TELEGRAM_WEBHOOK_SECRET ||
        provided !== config.TELEGRAM_WEBHOOK_SECRET
      ) {
        app.log.warn({ ip: req.ip }, 'telegram: bad secret_token');
        return reply.code(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'invalid secret_token',
        });
      }

      // (2) Idempotency persist (TG-02, D-06).
      // Phase 1 created webhook_updates with UNIQUE(source, external_id).
      // ON CONFLICT DO NOTHING → if rowCount = 0, this is a Telegram retry
      // (or a malicious replay) and we ack-200 without re-running.
      const updateId = req.body.update_id;
      const inserted = await app.db.execute(sql`
        INSERT INTO webhook_updates (source, external_id, payload)
        VALUES ('telegram', ${String(updateId)}, ${JSON.stringify(req.body)}::jsonb)
        ON CONFLICT (source, external_id) DO NOTHING
        RETURNING id
      `);

      // (3) Acknowledge IMMEDIATELY. Telegram retries on >5s timeouts; we beat
      // that comfortably by deferring all real work. Target: <100ms (TG-02).
      reply.code(200).send({ ok: true });

      // (4) Fire-and-forget async worker (D-07). setImmediate guarantees the
      // reply flushes before processing starts. .catch keeps unhandled
      // rejections from killing the process.
      if (inserted.rows.length > 0) {
        setImmediate(() => {
          processTelegramUpdate({
            app,
            payload: req.body,
          }).catch((err) => {
            app.log.error(
              { err, updateId },
              'telegram: processTelegramUpdate failed'
            );
          });
        });
      } else {
        app.log.info({ updateId }, 'telegram: duplicate update ignored');
      }
    }
  );
};

export default webhooksTelegramRoutes;
```

### Pattern 3: Channel-Agnostic Outbound Abstraction

**What:** intake.ts MUST stay channel-blind. Phase 2 already takes `channel` as an argument and returns `exchanges[]`. Phase 3 adds an `OutboundChannel` interface that the Telegram adapter implements; intake calls it for proactive sends (quote keyboard); the webhook adapter renders the returned `exchanges[]` as Telegram replies.

**When to use:** Any time intake.ts needs to push something to the client AFTER returning (e.g. quote keyboard). For Phase 3 the only proactive send is the quote keyboard — everything else is rendered from `exchanges[]` returned by `handleInboundMessage`.

**Example (paste-ready):**

```typescript
// apps/api/src/pipeline/outbound.ts
// Channel-agnostic outbound surface. intake.ts and order-fsm hooks call this.

import type { Db } from '../db.js';

export interface OutboundChannel {
  /** Send the QUOTED-stage inline keyboard (TG-03 / TG-04). */
  sendQuoteKeyboard(args: {
    clientId: string;
    leadId: string;
    quotedPriceKop: bigint;
    lang: 'ru' | 'ua';
  }): Promise<void>;

  /** Send a plain text message (manager intercept, follow-up, etc.). */
  sendText(args: { clientId: string; text: string }): Promise<void>;
}

/**
 * Per-channel registry. Phase 3 wires the 'telegram' entry; Phase 3.1 voice
 * adds 'voice' (which is a stub for proactive sends — voice initiates outbound calls).
 */
export class OutboundRegistry {
  private impls = new Map<string, OutboundChannel>();

  register(channel: string, impl: OutboundChannel): void {
    this.impls.set(channel, impl);
  }

  /**
   * Resolve which outbound to call. Order of precedence:
   *   1. Explicit `channel` arg (the channel that received the inbound msg)
   *   2. `clients.primary_channel` (future Phase 5 column — not in Phase 3)
   *   3. Throw — no fallback means the FSM must skip the send.
   */
  get(channel: string): OutboundChannel | null {
    return this.impls.get(channel) ?? null;
  }
}
```

```typescript
// apps/api/src/channels/telegram/outbound.ts
import type { Bot } from 'grammy';
import type { OutboundChannel } from '../../pipeline/outbound.js';
import type { Db } from '../../db.js';
import { clientsRepo } from '../../persistence/repos/index.js';
import { quoteKeyboard, formatQuoteMessage } from './keyboards.js';
import { leadsRepo } from '../../persistence/repos/index.js';

export function createTelegramOutbound(deps: { db: Db; bot: Bot }): OutboundChannel {
  return {
    async sendQuoteKeyboard({ clientId, leadId, quotedPriceKop, lang }) {
      const client = await clientsRepo.findById(deps.db, clientId);
      if (!client?.telegramId) {
        // Client has no Telegram (might be voice-only). Skip — log info.
        return;
      }
      const lead = await leadsRepo.findById(deps.db, leadId);
      if (!lead) return;
      const text = formatQuoteMessage({ lead, quotedPriceKop, lang });
      await deps.bot.api.sendMessage(client.telegramId, text, {
        reply_markup: quoteKeyboard(leadId, lang),
        parse_mode: 'HTML',
      });
    },
    async sendText({ clientId, text }) {
      const client = await clientsRepo.findById(deps.db, clientId);
      if (!client?.telegramId) return;
      await deps.bot.api.sendMessage(client.telegramId, text);
    },
  };
}
```

**How intake.ts decides which outbound to call:**

intake.ts already takes `channel: string` as an arg (`args.channel`). For Phase 3 we add a single, minimal call site inside Step I (after the price-lock UPDATE and templated reply):

```typescript
// intake.ts Step I — at the END, after pushing the templated reply into exchanges[]:
if (args.outbound) {
  // Try the inbound channel first; that is where the conversation lives.
  const outbound = args.outbound.get(args.channel);
  if (outbound) {
    await outbound.sendQuoteKeyboard({
      clientId: args.clientId,
      leadId: lead.id,
      quotedPriceKop,
      lang,
    });
  }
}
```

The `args.outbound?: OutboundRegistry` is optional in `InboundMessageArgs` so existing snapshot tests pass `undefined` and continue to work — the templated reply lands in `exchanges[]` either way, the keyboard is just a Telegram extra.

### Pattern 4: Inline Keyboard Renderers

```typescript
// apps/api/src/channels/telegram/keyboards.ts
import { InlineKeyboard } from 'grammy';
import { formatPriceKop } from '../../lib/money.js';

type Lang = 'ru' | 'ua';

/** Quote-stage keyboard (TG-03). callback_data = '<action>:<leadId>' (D-13). */
export function quoteKeyboard(leadId: string, lang: Lang): InlineKeyboard {
  const labels =
    lang === 'ua'
      ? { confirm: 'Підтвердити рейс ✅', change: 'Змінити умови', reject: 'Відмова' }
      : { confirm: 'Подтвердить рейс ✅', change: 'Изменить условия', reject: 'Отказаться' };
  return new InlineKeyboard()
    .text(labels.confirm, `confirm:${leadId}`)
    .text(labels.reject, `reject:${leadId}`)
    .row()
    .text(labels.change, `change:${leadId}`);
}

/** Driver-confirmation keyboard (TG-05). */
export function driverKeyboard(orderId: string, lang: Lang): InlineKeyboard {
  const labels =
    lang === 'ua'
      ? { accept: 'Прийняти ✅', decline: 'Відмовитись' }
      : { accept: 'Принять ✅', decline: 'Отказаться' };
  return new InlineKeyboard()
    .text(labels.accept, `driver_accept:${orderId}`)
    .text(labels.decline, `driver_decline:${orderId}`);
}

/** Templated quote text (TG-04). Pulls everything from DB — no LLM strings. */
export function formatQuoteMessage(args: {
  lead: { fromCityId: string | null; toCityId: string | null; tons: string | null };
  quotedPriceKop: bigint;
  lang: Lang;
  fromCityName?: string;
  toCityName?: string;
}): string {
  const price = formatPriceKop(args.quotedPriceKop, args.lang);
  if (args.lang === 'ua') {
    return [
      `<b>Пропозиція рейсу</b>`,
      `Маршрут: ${args.fromCityName ?? '—'} → ${args.toCityName ?? '—'}`,
      `Вантаж: ${args.lead.tons ?? '—'} т`,
      `Ціна: <b>${price} ₽</b>`,
      ``,
      `Підтвердіть або змініть умови нижче ⬇️`,
    ].join('\n');
  }
  return [
    `<b>Предложение рейса</b>`,
    `Маршрут: ${args.fromCityName ?? '—'} → ${args.toCityName ?? '—'}`,
    `Груз: ${args.lead.tons ?? '—'} т`,
    `Цена: <b>${price} ₽</b>`,
    ``,
    `Подтвердите или измените условия ниже ⬇️`,
  ].join('\n');
}
```

### Pattern 5: Telegram Update → InboundArgs Adapter

```typescript
// apps/api/src/channels/telegram/adapter.ts
import type { Update, Message, CallbackQuery } from 'grammy/types';
import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { handleInboundMessage } from '../../pipeline/intake.js';
import { clientsRepo, messagesRepo } from '../../persistence/repos/index.js';
import type { Db } from '../../db.js';
import { OutboundRegistry } from '../../pipeline/outbound.js';
import { createTelegramOutbound } from './outbound.js';

/** Public entry called by webhook route (D-09, D-10, D-11). */
export async function processTelegramUpdate(args: {
  app: FastifyInstance;
  payload: { update_id: number } & Partial<Update>;
}): Promise<void> {
  const { app, payload } = args;
  const update = payload as Update;

  // Triage: message OR callback_query — others (inline_query, chat_member, …)
  // are ignored for the demo (D-29). Stickers/photos handled below as inbound text.
  if (update.callback_query) {
    // grammY processes callback_query routing via bot.handleUpdate, which dispatches
    // to the bot.callbackQuery() handler registered in handlers.ts.
    await app.bot.handleUpdate(update);
    return;
  }
  if (!update.message) {
    app.log.info({ update_id: update.update_id }, 'telegram: update has no message — skipped');
    return;
  }

  const msg = update.message;
  if (!msg.from) {
    app.log.warn({ update_id: update.update_id }, 'telegram: message without from — skipped');
    return;
  }

  // /start, /help, etc. → let grammY dispatch via bot.handleUpdate so our
  // bot.command() registrations fire. After commands, control returns and we
  // do NOT pipeline-dispatch — commands are pure presentation.
  if (msg.text?.startsWith('/')) {
    await app.bot.handleUpdate(update);
    return;
  }

  // Non-text content (sticker, photo, voice, document) — polite refusal.
  if (!msg.text) {
    await app.bot.api.sendMessage(
      msg.chat.id,
      'Я понимаю только текстовые сообщения. Напишите детали груза.'
    );
    return;
  }

  // Find-or-create client by telegram_id (D-10). Synthetic phone tg:${from.id}.
  let client = await clientsRepo.findByTelegramId(app.db, String(msg.from.id));
  if (!client) {
    const name = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ').trim() || 'Гость';
    client = await clientsRepo.create(app.db, {
      name,
      phone: `tg:${msg.from.id}`,
      telegramId: String(msg.from.id),
      // lang omitted — sticky detection from Phase 2 fills it on first ≥20-char msg.
    });
  }

  // Manager intercept gate (D-11). If lead.manager_active=true, persist client
  // message but DO NOT run pipeline. Manager will answer via admin (Phase 4) →
  // POST /api/leads/:id/manager-message.
  const interceptedLead = await findInterceptedLead(app.db, client.id);
  if (interceptedLead) {
    await messagesRepo.create(app.db, {
      clientId: client.id,
      leadId: interceptedLead.id,
      role: 'client',
      text: msg.text,
    });
    app.log.info(
      { clientId: client.id, leadId: interceptedLead.id },
      'telegram: bot silent (manager_active=true) — message persisted'
    );
    return;
  }

  // Build OutboundRegistry once per update so intake's Step I can push
  // the quote keyboard via Telegram.
  const outbound = new OutboundRegistry();
  outbound.register('telegram', createTelegramOutbound({ db: app.db, bot: app.bot }));

  await handleInboundMessage({
    db: app.db,
    llm: app.llm, // wired by Phase 2 plugin
    log: app.log,
    clientId: client.id,
    text: msg.text,
    channel: 'telegram',
    outbound, // NEW field — see Pattern 3
  });
}

async function findInterceptedLead(
  db: Db,
  clientId: string
): Promise<{ id: string } | null> {
  // Find the most recent open lead where manager_active=true.
  const result = await db.execute(sql`
    SELECT id FROM leads
    WHERE client_id = ${clientId}
      AND manager_active = true
      AND stage NOT IN ('DONE', 'LOST')
    ORDER BY updated_at DESC LIMIT 1
  `);
  const row = result.rows[0] as { id: string } | undefined;
  return row ?? null;
}
```

### Anti-Patterns to Avoid

- **Calling `await bot.handleUpdate(payload)` synchronously in the webhook handler.** This re-introduces the >5s timeout cliff that Pitfall #5 warns about. The two-stage handler is non-negotiable.
- **Sending the quote keyboard from inside `intake.ts`'s `db.transaction(...)` block.** Telegram's API may take 500ms; a slow `bot.api.sendMessage` would extend the FSM lock and starve concurrent clients. The outbound call MUST be AFTER the transaction commits — i.e. at the very end of intake's main handler, OR fire-and-forget like notifications. See "Open Questions §2".
- **Sending notifications from inside `transitionOrder`'s tx.** Same reason. notifyClient is invoked AFTER the FSM commit returns successfully.
- **Trusting `from.language_code` for sticky lang.** CONTEXT specifics: "Telegram language_code as HINT, not override". Cyrillic heuristic from Phase 2 still wins. We do NOT pass language_code anywhere into intake.
- **Using `bot.start()` (long polling).** This conflicts with webhook mode and double-delivers updates. Phase 3 is webhook-only.
- **Editing the original message after manager intercept** to keep the keyboard. We strip the keyboard on callback press (D-15) — once the conversation goes silent, NO buttons should remain.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTPS to Telegram Bot API | Raw `fetch('https://api.telegram.org/...')` | `bot.api.sendMessage / answerCallbackQuery / setWebhook` | grammY handles retries, file uploads, multipart, type-safe payload validation. |
| Inline keyboard JSON | Manual `{ inline_keyboard: [[{...}]] }` JSON arrays | `new InlineKeyboard().text(...).row()` | grammY's builder enforces row semantics + escapes. |
| Update validation | Hand-written `if (update.message?.text)` plus inferred types | grammY's `Update` / `Message` / `CallbackQuery` types from `grammy/types` | Type-safe; mirrors Telegram API exactly. |
| Webhook secret comparison | Constant-time compare with `crypto.timingSafeEqual` | A plain `===` comparison (D-05) | The secret is fixed-length env-supplied; Telegram's API spec accepts only `[A-Za-z0-9_-]{1,256}` chars; a `===` is acceptable for demo. For production v2 wrap in `timingSafeEqual`. |
| Order-number / public_token generation | Custom random + uniqueness check | `nanoid` (already used by createOrder) | Phase 2's createOrder owns this. Phase 3 never generates IDs. |
| Per-client serialization | New advisory lock just for Telegram | Phase 2 `pg_advisory_xact_lock(hashtext(client_id))` in intake.ts | intake.ts already holds the lock from STEP 0; the webhook adapter just calls handleInboundMessage, the lock fires inside. |
| Webhook idempotency | Redis SET NX with TTL | `webhook_updates` UNIQUE(source, external_id) | Phase 1 already created the table + index. Same source of truth used for voice + GPS webhooks later. |
| Async job runner | BullMQ for this phase | `setImmediate(() => fn().catch(log))` | CONTEXT D-07 locks inline for demo. BullMQ would force a worker process. |
| Bot username detection | Reading from env | `bot.botInfo.username` (populated by `bot.init()`) | TELEGRAM_BOT_USERNAME env (D-03) is for deeplinks; `bot.botInfo` is for runtime self-reference. |

**Key insight:** Phase 3 is almost entirely glue. **EVERY new line of business logic is suspicious** — if it doesn't exist in intake.ts already, ask whether it belongs in Phase 2 instead.

## Runtime State Inventory

> Phase 3 introduces a real Telegram bot — runtime state DOES exist outside the repo. Audit:

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| **Stored data** | (1) `webhook_updates` rows with `source='telegram'` accumulate forever — Phase 1 created the table; no retention policy. (2) `clients` rows with `phone='tg:${from.id}'` and `telegram_id=<id>` for every new Telegram user. (3) `messages` rows for every chat turn (already exists). (4) New rows in `leads` with `manager_active` column added by 0003. | (1) None for Phase 3 — accept growth; v2 PROD adds retention. (2) Code edit only — clientsRepo.findByTelegramId + create with synthetic phone. (3) Already wired in intake.ts. (4) Migration 0003 adds `manager_active`; new leads default to FALSE so existing rows are unaffected. |
| **Live service config** | (1) **Telegram BotFather**: each bot's webhook URL + secret_token + max_connections is stored at Telegram's side (NOT in git). Must be set via `bot.api.setWebhook(...)` at boot or by `pnpm telegram:setup`. (2) **Telegram bot username + display name + description + privacy mode** are set in BotFather UI — not in code. README must document the BotFather steps so a fresh developer can reproduce. | (1) `setupWebhook()` in `apps/api/src/channels/telegram/setup.ts`; idempotent — running it twice is fine. README documents `pnpm telegram:setup`. (2) Manual step in README — out of scope for code, but documented. |
| **OS-registered state** | None — Phase 3 runs inside the Fastify process; no Windows Task Scheduler / launchd / systemd registrations. The follow-up scheduler from Phase 2 (`setInterval`) is started by `registerFollowUpScheduler(app)` in `app.ts` and shut down via `onClose`. Phase 3 adds NO new OS-level state. | None. |
| **Secrets/env vars** | NEW env vars per D-30: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_PUBLIC_URL` (optional), `TELEGRAM_SET_WEBHOOK_ON_BOOT` (optional). Two of them (TOKEN + SECRET) already exist as **optional** in `config.ts` placeholders — need to be either kept optional (with runtime guards) or promoted to required. | Update `config.ts` Zod schema — see code block 0 in §"Code Examples". Update `.env.example`. README documents how to generate secret via `openssl rand -hex 32`. |
| **Build artifacts / installed packages** | grammy 1.43.0 package added to apps/api/node_modules. No global installs. No platform-specific compiled bindings. | `pnpm --filter @ai-logist/api add grammy` and commit lockfile. |

**Canonical question — answered explicitly:** *After every file in the repo is updated, what runtime systems still have the old (no-Telegram) state cached?* (a) Telegram's setWebhook registration — if the URL or secret changes, must re-call setWebhook; (b) BotFather-side metadata (name/avatar/commands menu) — not touched by code, manual. Both documented in README.

### ⚠ CRITICAL OVERRIDE on Decisions D-20, D-21, D-30

**D-20** says "ALTER TABLE trucks ADD COLUMN driver_telegram_id BIGINT NULL". **But the column ALREADY EXISTS as `text` in `apps/api/src/persistence/schema/trucks.ts`** (line 24: `driverTelegramId: text('driver_telegram_id')`). This was added in Phase 1 (CONTEXT D-04 for Phase 1).

**Resolution options:**
1. **Keep TEXT** (recommended): `from.id` in Telegram is technically a 64-bit integer but storing as TEXT is what we already do for `clients.telegram_id` (line 11). Consistency wins. Migration 0003 only adds `leads.manager_active`. Driver onboarding writes `String(driver_telegram_id_int)` to the text column.
2. **Migrate to BIGINT**: would require dropping + recreating the column; brittle. Reject.

**Planner action:** Skip ALTER TABLE trucks in migration 0003. Update D-20 to read "use existing text column". Seed update (D-20 second part) still applies — set 2 trucks' `driver_telegram_id` to the demo user's id.

**D-21** says "ALTER TABLE leads ADD COLUMN manager_active". Verified: not in schema — needs migration 0003.

**D-30** says TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET are "required" in env. They already exist in `config.ts` as `.optional()`. **Planner must promote them to required (no `.optional()`)** OR keep them optional and have `createBot()` throw at instantiation. Recommendation: keep `.optional()` in Zod schema (lets unit tests boot without env) but add a `requireTelegramConfig()` assertion called by `plugins/telegram.ts` and `setupWebhook()`. This matches the `ANTHROPIC_API_KEY` precedent from Phase 2.

## Common Pitfalls

### Pitfall 1: Webhook handler exceeds 100ms ack target

**What goes wrong:** `app.db.execute(INSERT)` blocks behind a slow connection pool, or the body parser is slow, and reply.code(200).send fires past 5s. Telegram disables the webhook after a few of these.

**Why it happens:** Synchronous DB latency under load. Plus heavy LLM call before ack if someone refactors the handler.

**How to avoid:** Profile the handler in an integration test with testcontainers; assert `(Date.now() - start) < 100`. The async worker fires via `setImmediate` so ANY downstream slowness is invisible to Telegram.

**Warning signs:** Telegram `getWebhookInfo` shows `last_error_message` non-null or `pending_update_count > 50`.

### Pitfall 2: Duplicate update_id race

**What goes wrong:** Two webhook calls with the same `update_id` arrive concurrently. Both INSERTs see no conflict in their snapshot and both inserted rows exist — but UNIQUE then rejects one. We must catch the rejection cleanly OR rely on `ON CONFLICT DO NOTHING` (which is what we do).

**Why it happens:** Telegram retries within the same TCP connection sometimes; replay attacks via curl.

**How to avoid:** **`ON CONFLICT (source, external_id) DO NOTHING RETURNING id`** with rowCount check — if 0 rows, the row was already there; we silently ack-200. This is the recommended pattern per PITFALLS Pitfall #5. Phase 1 created the constraint.

**Warning signs:** Integration test fires 10× same payload, expects exactly 1 lead row created.

### Pitfall 3: FSM-hook notification deadlock

**What goes wrong:** `notifyClient` is wired into `transitionOrder` AND runs BEFORE the tx commits → bot.api.sendMessage hits a slow Telegram day, FSM tx holds row lock for 2s, manager admin call to PATCH order blocks → cascading deadlock visible only in demo.

**Why it happens:** Naive `await notifyClient(...)` inside the `db.transaction(...)` callback.

**How to avoid:** **Schedule notification only AFTER `db.transaction(...)` returns.** Either pass back a `notifications: NotifyJob[]` array from transitionOrder and let the caller fire them after commit, OR call `notifyClient(...).catch(log)` (no await) from a `setImmediate` inside transitionOrder after the COMMIT line. CONTEXT D-25 says exactly "AFTER successful COMMIT, async notifyClient. Do NOT block FSM transaction." — code block 9 shows the post-commit pattern.

**Warning signs:** Test: trigger 5 simultaneous transitions with notification enabled, verify no `pg_advisory_xact_lock` is held for > 100ms in `SELECT * FROM pg_locks`.

### Pitfall 4: Synthetic phone collision

**What goes wrong:** A real client's E.164 phone is genuinely `+tg:12345` (impossible but humour the example). Synthetic `tg:${from.id}` collides with a real value.

**Why it happens:** E.164 starts with `+`; `tg:` is a different prefix space. **In practice, no collision possible** because E.164 phones never contain `:`.

**How to avoid:** Add a CHECK constraint in 0003 migration: `CHECK (phone LIKE '+%' OR phone LIKE 'tg:%')`. Optional — for the demo we trust the prefix uniqueness.

**Warning signs:** Unit test inserts a real client with `phone='+12015550100'` and a Telegram-only client with `phone='tg:12345'` — both succeed, findByPhone resolves each unambiguously.

### Pitfall 5: Driver decline → lead returns to MATCHED but matched_truck still stale

**What goes wrong:** Driver decline callback handler does `transitionOrder → ???` but the order FSM has no "decline" transition from `DRIVER_ASSIGNED`. The lead is already past MATCHED stage and a re-match needs special handling.

**Why it happens:** CONTEXT D-19 says "decline → return lead to MATCHED, so intake re-matches". But the lead FSM allows `MATCHED → QUOTED → AGREED → ORDER_CREATED`; going BACK to MATCHED is illegal per Phase 2's transition table.

**How to avoid:** **For the demo, treat decline as cancellation**: `transitionOrder → CLOSED` with payload `{ driver_declined: true }` + `transitionLead → LOST` with payload `{ reason: 'driver_declined' }`. Then post a polite "Извините, водитель отказался. Менеджер свяжется." message to the client. This is the simplest demo-safe path; full re-match flow is v2. (The orchestrator must approve this deviation from D-19 — the simpler path is documented as "Open Question §3" below.)

**Warning signs:** Integration test: simulate decline → assert order in CLOSED, lead in LOST, client got message, no errors.

### Pitfall 6: Telegram .id is JS number — bigint precision

**What goes wrong:** `from.id` is a 64-bit integer. JSON.parse delivers it as a JS number (max safe 2^53). User IDs are well under that today, but `chat_id` for channels can be in the `-100xxxxxxxxxx` range.

**How to avoid:** **String everywhere.** Store `clients.telegram_id` as text (already does). Convert via `String(msg.from.id)` everywhere we touch it. grammY's TS types are correct (`number`) but we coerce immediately at the boundary.

### Pitfall 7: Spec gap — `messages.role` does not include 'manager'

**What goes wrong:** Phase 2 documented `role: 'client'|'ai'|'manager'` but `messages.role` is plain TEXT — no constraint. Manager intercept will write rows with `role='manager'` and they'll succeed but admin (Phase 4) needs to know this value exists.

**How to avoid:** None — already correct. But add a comment in `manager-message` route handler and Phase 3 README that says "role='manager' is now a live value". Phase 4 admin must handle it.

### Pitfall 8: zod/v4 Telegram payload schema is intentionally loose

**What goes wrong:** Phase 1 used `.passthrough()` on TelegramUpdateBodySchema — only `update_id: number` is strict. We should not tighten this in Phase 3 because Telegram Bot API evolves; loose envelope + grammY's internal type-safe routing is sufficient.

**How to avoid:** **Leave TelegramUpdateBodySchema alone.** Decode the typed update inside the adapter using grammY's `Update` type from `grammy/types` — that file is what tracks Telegram API changes.

## Code Examples

> Verified patterns. Source: grammY 1.43 docs (verified via WebFetch), Telegram Bot API docs, existing repo conventions (intake.ts, leads.ts route, webhook_updates schema).

### Code Block 0 — `apps/api/src/config.ts` extension

```typescript
// Add to ConfigSchema in apps/api/src/config.ts:
TELEGRAM_BOT_TOKEN: z.string().optional(), // already present — keep optional for tests
TELEGRAM_WEBHOOK_SECRET: z.string().min(1).optional(), // already present — keep optional
TELEGRAM_BOT_USERNAME: z.string().optional(), // NEW
TELEGRAM_PUBLIC_URL: z.string().url().optional(), // NEW
TELEGRAM_SET_WEBHOOK_ON_BOOT: z.coerce.boolean().default(false), // NEW

// Helper at the bottom of config.ts:
export function requireTelegramConfig(): void {
  if (!config.TELEGRAM_BOT_TOKEN || !config.TELEGRAM_WEBHOOK_SECRET || !config.TELEGRAM_BOT_USERNAME) {
    throw new Error(
      'Telegram channel requires TELEGRAM_BOT_TOKEN + TELEGRAM_WEBHOOK_SECRET + TELEGRAM_BOT_USERNAME'
    );
  }
}
```

### Code Block 1 — Migration 0003

```sql
-- apps/api/drizzle/0003_phase3_telegram.sql
-- Phase 3 — Telegram channel: leads.manager_active for manager intercept.
-- NOTE: trucks.driver_telegram_id ALREADY EXISTS as text (Phase 1) — no change here.

ALTER TABLE leads
  ADD COLUMN manager_active BOOLEAN NOT NULL DEFAULT FALSE;

-- Existing rows default to FALSE — no data migration needed.
-- Index optional — manager_active=true is rare; admin UI will filter by it via leads_client_id_idx + WHERE clause.

-- Phase 3 also widens the index family on trucks for the driver-confirmation lookup:
CREATE INDEX IF NOT EXISTS trucks_driver_tg_idx ON trucks (driver_telegram_id) WHERE driver_telegram_id IS NOT NULL;
```

Drizzle schema patch in `apps/api/src/persistence/schema/leads.ts` — add inside `pgTable('leads', { ... })`:
```typescript
managerActive: boolean('manager_active').notNull().default(false),
```
Add to imports: `boolean` from `drizzle-orm/pg-core`.

### Code Block 2 — Two-stage webhook handler (full file)

See **Pattern 2** above for the full file (`apps/api/src/routes/webhooks-telegram.ts`).

### Code Block 3 — Telegram → InboundArgs adapter

See **Pattern 5** above for the full file (`apps/api/src/channels/telegram/adapter.ts`).

### Code Block 4 — Inline keyboard renderer

See **Pattern 4** above for the full file (`apps/api/src/channels/telegram/keyboards.ts`).

### Code Block 5 — Outbound abstraction

See **Pattern 3** above for both files (`apps/api/src/pipeline/outbound.ts` + `apps/api/src/channels/telegram/outbound.ts`).

### Code Block 6 — Callback query handlers + commands

```typescript
// apps/api/src/channels/telegram/handlers.ts
import type { Bot, Context } from 'grammy';
import type { FastifyInstance } from 'fastify';
import { handleInboundMessage } from '../../pipeline/intake.js';
import { clientsRepo, leadsRepo } from '../../persistence/repos/index.js';
import { OutboundRegistry } from '../../pipeline/outbound.js';
import { createTelegramOutbound } from './outbound.js';
import { transitionOrder } from '../lifecycle/order-fsm.js';
import { transitionLead } from '../lifecycle/lead-fsm.js';
import type { Lang } from '../../lib/lang-detect.js';

const GREETING_RU =
  'Здравствуйте! Я AI-ассистент компании. Чтобы оформить заказ — напишите откуда, куда, сколько тонн и тип кузова. Например: "Киев-Львов, 18 тонн, тент".';
const HELP_RU =
  'Я помогаю оформить грузоперевозку. Просто напишите маршрут и груз — я найду машину и посчитаю цену.\n\nПример: «Москва-Минск 22 тонны рефрижератор»';
const HELP_UA =
  'Я допомагаю оформити вантажоперевезення. Просто напишіть маршрут і вантаж — я знайду машину і розрахую ціну.\n\nПриклад: «Київ-Львів 18 тонн тент»';

export function registerTelegramHandlers(bot: Bot, app: FastifyInstance): void {
  // /start command — RU greeting (D-27). After lang is known, future
  // /start commands could localize; for the demo we keep RU.
  bot.command('start', async (ctx) => {
    await ctx.reply(GREETING_RU);
  });

  // /help command (D-28). If we know the client's lang, render that; else both.
  bot.command('help', async (ctx) => {
    const tgId = ctx.from?.id;
    if (tgId) {
      const client = await clientsRepo.findByTelegramId(app.db, String(tgId));
      if (client?.lang === 'ua') {
        return ctx.reply(HELP_UA);
      }
      if (client?.lang === 'ru') {
        return ctx.reply(HELP_RU);
      }
    }
    await ctx.reply(`${HELP_RU}\n\n— — —\n\n${HELP_UA}`);
  });

  // Client-side callbacks (D-15). Regex captures action + leadId.
  bot.callbackQuery(/^(confirm|reject|change):(.+)$/, async (ctx) => {
    const action = ctx.match[1] as 'confirm' | 'reject' | 'change';
    const leadId = ctx.match[2];

    // 1. answerCallbackQuery FIRST — Telegram requires this within ~15s, target 200ms
    //    (CONTEXT D-15). Without it, the button stays in "loading" state forever.
    await ctx.answerCallbackQuery();

    // 2. Strip buttons from original message so client can't double-press.
    await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch((err) => {
      app.log.warn({ err, leadId }, 'telegram: editMessageReplyMarkup failed (msg too old?)');
    });

    if (!ctx.from) return;
    const client = await clientsRepo.findByTelegramId(app.db, String(ctx.from.id));
    if (!client) return;

    // 3. Map action → synthetic text and dispatch to pipeline.
    const synthText = action === 'confirm' ? 'да' : action === 'reject' ? 'нет' : 'изменить';
    const outbound = new OutboundRegistry();
    outbound.register('telegram', createTelegramOutbound({ db: app.db, bot }));

    await handleInboundMessage({
      db: app.db,
      llm: app.llm,
      log: app.log,
      clientId: client.id,
      text: synthText,
      channel: 'telegram',
      outbound,
    });

    // 4. The pipeline's exchanges[] returned by intake already includes the
    //    confirmation reply (createOrder shortcut sends "Заказ #KU-XXX создан…")
    //    Rendering happens inside intake → outbound? No — intake writes the
    //    text to `messages` and pushes it to exchanges[]. The webhook adapter
    //    must SEND the assistant exchanges back via bot.api.sendMessage.
    //    See Open Question §4 for the exact contract.
  });

  // Driver-side callbacks (TG-05). driver_accept / driver_decline.
  bot.callbackQuery(/^(driver_accept|driver_decline):(.+)$/, async (ctx) => {
    const action = ctx.match[1] as 'driver_accept' | 'driver_decline';
    const orderId = ctx.match[2];

    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {});

    if (action === 'driver_accept') {
      // Order is already DRIVER_ASSIGNED — this is a confirmation. Log it.
      app.log.info({ orderId, driverTgId: ctx.from?.id }, 'telegram: driver accepted');
      await ctx.reply('✅ Принято. Удачной поездки!');
    } else {
      // Decline — Pitfall #5 path: order → CLOSED, lead → LOST.
      try {
        await transitionOrder(app.db, {
          orderId,
          to: 'CLOSED',
          actor: 'system',
          payload: { driver_declined: true, driver_tg_id: ctx.from?.id ?? null },
        });
        // Lookup lead via order, transition LOST, message client.
        // (See Open Question §3 — exact lead handling.)
      } catch (err) {
        app.log.error({ err, orderId }, 'telegram: decline transition failed');
      }
      await ctx.reply('Отказ зарегистрирован. Спасибо за обратную связь.');
    }
  });
}
```

### Code Block 7 — Driver notification flow

```typescript
// apps/api/src/channels/telegram/notifications.ts
import type { Bot } from 'grammy';
import { sql } from 'drizzle-orm';
import type { Db } from '../../db.js';
import { driverKeyboard } from './keyboards.js';
import { transitionOrder } from '../../pipeline/lifecycle/order-fsm.js';
import type { FastifyBaseLogger } from 'fastify';

export async function notifyDriver(args: {
  orderId: string;
  db: Db;
  bot: Bot;
  log: FastifyBaseLogger;
}): Promise<void> {
  const { orderId, db, bot, log } = args;
  // Single query, joined for atomicity.
  const result = await db.execute(sql`
    SELECT o.id AS order_id, o.number AS order_number, o.price,
           t.id AS truck_id, t.plate_number, t.driver_name, t.driver_telegram_id,
           c.name AS client_name,
           cf.name_ru AS from_name, ct.name_ru AS to_name
    FROM orders o
    LEFT JOIN trucks t ON t.id = o.truck_id
    LEFT JOIN clients c ON c.id = o.client_id
    LEFT JOIN cities cf ON cf.id = o.from_city_id
    LEFT JOIN cities ct ON ct.id = o.to_city_id
    WHERE o.id = ${orderId}
  `);
  const row = result.rows[0] as {
    order_id: string;
    order_number: string;
    price: string;
    truck_id: string | null;
    plate_number: string | null;
    driver_name: string | null;
    driver_telegram_id: string | null;
    client_name: string | null;
    from_name: string | null;
    to_name: string | null;
  } | undefined;

  if (!row) {
    log.warn({ orderId }, 'notifyDriver: order not found');
    return;
  }

  // D-18 stub flow — no driver_telegram_id → log + auto-accept simulation.
  if (!row.driver_telegram_id) {
    log.warn(
      { truckId: row.truck_id, orderId },
      'notifyDriver: driver_telegram_id missing — simulated auto-accept'
    );
    // The order is already in DRIVER_ASSIGNED — no further transition needed.
    // Phase 5 tracking will simulate the driver's movement.
    return;
  }

  const text = [
    `🚚 <b>Новый рейс: ${row.order_number}</b>`,
    `Клиент: ${row.client_name ?? '—'}`,
    `Маршрут: ${row.from_name ?? '—'} → ${row.to_name ?? '—'}`,
    `Машина: ${row.plate_number ?? '—'}`,
    ``,
    `Принимаете рейс?`,
  ].join('\n');

  await bot.api.sendMessage(row.driver_telegram_id, text, {
    parse_mode: 'HTML',
    reply_markup: driverKeyboard(orderId, 'ru'), // driver lang default RU for demo
  });
}
```

### Code Block 8 — Client notifications (TG-07 / NOTIF-01)

```typescript
// apps/api/src/channels/telegram/notifications.ts (continued)
import { formatPriceKop } from '../../lib/money.js';

export async function notifyClient(args: {
  orderId: string;
  transition: 'DRIVER_ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED';
  db: Db;
  bot: Bot;
  log: FastifyBaseLogger;
}): Promise<void> {
  const { orderId, transition, db, bot, log } = args;

  const result = await db.execute(sql`
    SELECT o.number, t.plate_number, t.driver_name, t.driver_phone,
           c.telegram_id, c.lang
    FROM orders o
    LEFT JOIN trucks t ON t.id = o.truck_id
    LEFT JOIN clients c ON c.id = o.client_id
    WHERE o.id = ${orderId}
  `);
  const row = result.rows[0] as
    | {
        number: string;
        plate_number: string | null;
        driver_name: string | null;
        driver_phone: string | null;
        telegram_id: string | null;
        lang: string | null;
      }
    | undefined;

  if (!row) {
    log.warn({ orderId }, 'notifyClient: order not found');
    return;
  }
  if (!row.telegram_id) {
    // D-26 — client has no Telegram (voice-only). Skip silently.
    log.info({ orderId }, 'notifyClient: client has no telegram_id — skip');
    return;
  }

  const lang = (row.lang ?? 'ru') as 'ru' | 'ua';
  const text = renderNotification(transition, row, lang);
  try {
    await bot.api.sendMessage(row.telegram_id, text, { parse_mode: 'HTML' });
  } catch (err) {
    log.error({ err, orderId, transition }, 'notifyClient: send failed');
  }
}

function renderNotification(
  transition: 'DRIVER_ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED',
  row: { number: string; plate_number: string | null; driver_name: string | null; driver_phone: string | null },
  lang: 'ru' | 'ua'
): string {
  // D-24 templates. Extend lib/i18n.ts with these strings in production.
  const templates = {
    ru: {
      DRIVER_ASSIGNED: `🚚 Машина назначена! Заказ ${row.number}.\nНомер: ${row.plate_number ?? '—'}.\nВодитель: ${row.driver_name ?? '—'}, ${row.driver_phone ?? '—'}.`,
      IN_TRANSIT: `📦 Груз в пути. Заказ ${row.number}.`,
      DELIVERED: `✅ Доставлено! Заказ ${row.number}. Спасибо за заказ.`,
    },
    ua: {
      DRIVER_ASSIGNED: `🚚 Машину призначено! Замовлення ${row.number}.\nНомер: ${row.plate_number ?? '—'}.\nВодій: ${row.driver_name ?? '—'}, ${row.driver_phone ?? '—'}.`,
      IN_TRANSIT: `📦 Вантаж у дорозі. Замовлення ${row.number}.`,
      DELIVERED: `✅ Доставлено! Замовлення ${row.number}. Дякуємо за замовлення.`,
    },
  } as const;
  return templates[lang][transition];
}
```

### Code Block 9 — order-fsm hook (D-25)

**File to modify:** `apps/api/src/pipeline/lifecycle/order-fsm.ts`. Add a parameter for an optional post-commit hook and invoke it OUTSIDE the transaction.

```typescript
// apps/api/src/pipeline/lifecycle/order-fsm.ts — modification

export interface TransitionOrderArgs {
  orderId: string;
  to: OrderStatus;
  actor: OrderActor;
  payload?: Record<string, unknown>;
  geomWkt?: string;
  /**
   * Phase 3 D-25: optional callback fired AFTER db.transaction commits.
   * Used by Telegram to notify clients on DRIVER_ASSIGNED / IN_TRANSIT / DELIVERED.
   * Errors are caught and logged — they MUST NOT roll back the FSM transition.
   */
  onSuccess?: (result: TransitionOrderResult) => Promise<void> | void;
}

// Inside transitionOrder, REPLACE the final return statement with:
//
//   const result = { from: row.status, to: args.to, version: newVersion, audit_row_inserted: auditRowInserted };
//   return result;
// });   // <- end of db.transaction callback
//
// // After tx commit:
// if (args.onSuccess) {
//   // Fire-and-forget — failures must NOT roll back the already-committed transition.
//   Promise.resolve(args.onSuccess(result)).catch((err) => {
//     // Caller is expected to pass log; if not, this surfaces via the global Fastify error log.
//     // eslint-disable-next-line no-console
//     console.error('transitionOrder.onSuccess failed', err);
//   });
// }
// return result;
```

**How telegram notifications.ts wires in (called from Phase 5 or Phase 4 admin where transitions happen):**

```typescript
import { notifyClient, notifyDriver } from './channels/telegram/notifications.js';

await transitionOrder(app.db, {
  orderId,
  to: 'DRIVER_ASSIGNED',
  actor: 'system',
  payload: { /* … */ },
  onSuccess: async (result) => {
    // Tell client AND driver — sequentially, but both are async post-commit.
    await Promise.allSettled([
      notifyClient({ orderId, transition: 'DRIVER_ASSIGNED', db: app.db, bot: app.bot, log: app.log }),
      notifyDriver({ orderId, db: app.db, bot: app.bot, log: app.log }),
    ]);
  },
});
```

Note: the intake.ts createOrder shortcut (Step D-pre) currently calls createOrderHandler then transitionLead → ORDER_CREATED. **It does NOT call transitionOrder → DRIVER_ASSIGNED.** Phase 3 must decide where DRIVER_ASSIGNED transition happens. Options:
- A) **Inside createOrderHandler** (Phase 2 tool, would need modification) — couples order creation with driver assignment.
- B) **Inside intake.ts immediately after createOrderHandler** — keeps tool unchanged.
- C) **Separate manager-driven flow** — manager presses "assign driver" in admin Phase 4.

For the demo, option **(B)** is simplest: intake.ts already created the order with `truck_id = matched_truck_id`; we synthesize a `transitionOrder(orderId, 'DRIVER_ASSIGNED', actor: 'ai', payload: { auto: true }, onSuccess: notifyDriver+notifyClient)` immediately after. See "Open Question §5" for orchestrator confirmation.

### Code Block 10 — Manager intercept endpoints (TG-06)

```typescript
// In apps/api/src/routes/leads.ts — add three handlers AT THE END of leadsRoutes.

app.post(
  '/leads/:id/intercept',
  {
    schema: {
      tags: ['leads'],
      summary: 'Manager takes over conversation (TG-06)',
      params: z.object({ id: z.string().uuid() }),
      response: { 200: z.object({ lead_id: z.string().uuid(), manager_active: z.literal(true) }), 404: NotImpl },
    },
  },
  async (req, reply) => {
    const lead = await leadsRepo.findById(app.db, req.params.id);
    if (!lead) return reply.notFound(`lead ${req.params.id} not found`);

    // 1. Flip manager_active.
    await app.db.execute(sql`
      UPDATE leads SET manager_active = true, updated_at = NOW()
      WHERE id = ${lead.id}
    `);

    // 2. Send welcome via bot — best-effort, don't fail the endpoint if bot fails.
    const client = await clientsRepo.findById(app.db, lead.clientId);
    if (client?.telegramId && app.bot) {
      const lang = (client.lang ?? 'ru') as 'ru' | 'ua';
      const welcome =
        lang === 'ua'
          ? 'Доброго дня, я Іван, менеджер. Чим можу допомогти?'
          : 'Здравствуйте, я Иван, менеджер. Чем могу помочь?';
      await app.bot.api.sendMessage(client.telegramId, welcome).catch((err) => {
        app.log.warn({ err, leadId: lead.id }, 'intercept: welcome send failed');
      });
      // Persist the welcome as a manager-role message so admin chat shows it.
      await messagesRepo.create(app.db, {
        clientId: client.id,
        leadId: lead.id,
        role: 'manager',
        text: welcome,
      });
    }
    return reply.code(200).send({ lead_id: lead.id, manager_active: true as const });
  }
);

app.post(
  '/leads/:id/manager-message',
  {
    schema: {
      tags: ['leads'],
      summary: 'Manager sends a message to the client via bot (TG-06)',
      params: z.object({ id: z.string().uuid() }),
      body: z.object({ text: z.string().min(1).max(4000) }),
      response: { 200: z.object({ lead_id: z.string().uuid() }), 400: NotImpl, 404: NotImpl },
    },
  },
  async (req, reply) => {
    const lead = await leadsRepo.findById(app.db, req.params.id);
    if (!lead) return reply.notFound(`lead ${req.params.id} not found`);
    const client = await clientsRepo.findById(app.db, lead.clientId);
    if (!client) return reply.notFound('client not found');
    if (!client.telegramId) return reply.badRequest('client has no telegram_id');

    // 1. INSERT messages row first — admin should see it even if Telegram fails.
    await messagesRepo.create(app.db, {
      clientId: client.id,
      leadId: lead.id,
      role: 'manager',
      text: req.body.text,
    });

    // 2. Send via bot.
    if (app.bot) {
      await app.bot.api.sendMessage(client.telegramId, req.body.text).catch((err) => {
        app.log.error({ err, leadId: lead.id }, 'manager-message: send failed');
      });
    }
    return reply.code(200).send({ lead_id: lead.id });
  }
);

app.post(
  '/leads/:id/release',
  {
    schema: {
      tags: ['leads'],
      summary: 'Manager hands conversation back to the bot (TG-06)',
      params: z.object({ id: z.string().uuid() }),
      response: { 200: z.object({ lead_id: z.string().uuid(), manager_active: z.literal(false) }), 404: NotImpl },
    },
  },
  async (req, reply) => {
    const lead = await leadsRepo.findById(app.db, req.params.id);
    if (!lead) return reply.notFound(`lead ${req.params.id} not found`);
    await app.db.execute(sql`
      UPDATE leads SET manager_active = false, updated_at = NOW()
      WHERE id = ${lead.id}
    `);
    const client = await clientsRepo.findById(app.db, lead.clientId);
    if (client?.telegramId && app.bot) {
      const lang = (client.lang ?? 'ru') as 'ru' | 'ua';
      const handover =
        lang === 'ua'
          ? 'Передаю назад AI-асистенту. Чим іще можу допомогти?'
          : 'Передаю обратно AI-ассистенту. Что-то ещё?';
      await app.bot.api.sendMessage(client.telegramId, handover).catch(() => {});
      await messagesRepo.create(app.db, {
        clientId: client.id,
        leadId: lead.id,
        role: 'manager',
        text: handover,
      });
    }
    return reply.code(200).send({ lead_id: lead.id, manager_active: false as const });
  }
);
```

**Update shared-types:** Add request/response Zod schemas in `packages/shared-types/src/api/leads.ts`:
```typescript
export const LeadInterceptResponseSchema = z.object({
  lead_id: z.string().uuid(),
  manager_active: z.literal(true),
});
export const LeadReleaseResponseSchema = z.object({
  lead_id: z.string().uuid(),
  manager_active: z.literal(false),
});
export const ManagerMessageBodySchema = z.object({
  text: z.string().min(1).max(4000),
});
```

### Code Block 11 — Seed update

In `apps/api/src/seed/data/trucks.json` — pick the first 2 truck entries and add `"driver_telegram_id"`:

```json
[
  {
    "name": "Volvo FH 540 #1",
    "plate_number": "А123ВС777",
    "driver_name": "Иван Петров",
    "driver_phone": "+79001234501",
    "driver_telegram_id": "REPLACE_WITH_DEMO_USER_ID",
    "capacity_t": 20,
    "body_type": "tent",
    "lng": 37.6173,
    "lat": 55.7558
  },
  {
    "name": "Scania R 500 #2",
    "plate_number": "А234ВС777",
    "driver_name": "Алексей Смирнов",
    "driver_phone": "+79001234502",
    "driver_telegram_id": "REPLACE_WITH_DEMO_USER_ID_2",
    "capacity_t": 22,
    "body_type": "tent",
    "lng": 39.1843,
    "lat": 51.672
  }
  // … remaining 10 trucks unchanged
]
```

Update `apps/api/src/seed/run.ts` to pass the field through (it likely already iterates all keys of the fixture; verify and add if missing).

Also update `seed.test.ts` integration test to assert: count of trucks with `driver_telegram_id IS NOT NULL` = 2.

### Code Block 12 — Health endpoint extension (D-32)

```typescript
// apps/api/src/routes/health.ts — replace the existing checks construction.
// Note: cache scope is module-level so per-request hits the in-memory result.

let telegramCache: { result: 'ok' | 'not_configured' | 'error'; expiresAt: number } = {
  result: 'not_configured',
  expiresAt: 0,
};

async function checkTelegram(app: FastifyInstance): Promise<'ok' | 'not_configured' | 'error'> {
  const now = Date.now();
  if (telegramCache.expiresAt > now) return telegramCache.result;
  if (!config.TELEGRAM_BOT_TOKEN || !app.bot) {
    telegramCache = { result: 'not_configured', expiresAt: now + 60_000 };
    return 'not_configured';
  }
  try {
    await app.bot.api.getMe();
    telegramCache = { result: 'ok', expiresAt: now + 60_000 };
    return 'ok';
  } catch (err) {
    app.log.warn({ err }, 'telegram health check failed');
    telegramCache = { result: 'error', expiresAt: now + 60_000 };
    return 'error';
  }
}

// In the route handler, add to checks object:
//   telegram: await checkTelegram(app),
//
// Update HealthResponseSchema in shared-types to include
//   telegram: z.enum(['ok', 'not_configured', 'error']).optional()
```

### Code Block 13 — Test patterns

**Mock grammY Bot (`apps/api/tests/_helpers/telegram-mock.ts`):**

```typescript
// In-memory bot mock for unit tests. Records sends; never hits the network.
export interface SentMessage {
  chatId: string | number;
  text: string;
  replyMarkup?: unknown;
  parseMode?: string;
}

export function createMockBot() {
  const sent: SentMessage[] = [];
  const bot = {
    api: {
      async sendMessage(chatId: string | number, text: string, opts?: { reply_markup?: unknown; parse_mode?: string }) {
        sent.push({ chatId, text, replyMarkup: opts?.reply_markup, parseMode: opts?.parse_mode });
        return { message_id: sent.length, chat: { id: chatId }, text, date: Math.floor(Date.now() / 1000) };
      },
      async getMe() {
        return { id: 999, is_bot: true, first_name: 'TestBot', username: 'test_bot' };
      },
      async setWebhook() { return true; },
      async answerCallbackQuery() { return true; },
      async editMessageReplyMarkup() { return true; },
    },
    botInfo: { id: 999, is_bot: true, first_name: 'TestBot', username: 'test_bot' },
    init: async () => {},
    handleUpdate: async (_update: unknown) => {},
    stop: async () => {},
  };
  return { bot, sent };
}
```

**Webhook ack-latency test:**

```typescript
// apps/api/tests/integration/telegram-webhook-latency.test.ts
it('acks within 100ms (TG-02)', async () => {
  const start = process.hrtime.bigint();
  const res = await app.inject({
    method: 'POST',
    url: '/webhook/telegram',
    headers: { 'x-telegram-bot-api-secret-token': config.TELEGRAM_WEBHOOK_SECRET! },
    payload: { update_id: 42_001, message: { /* ... */ } },
  });
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
  expect(res.statusCode).toBe(200);
  expect(elapsedMs).toBeLessThan(100);
});
```

**Idempotency test:**

```typescript
it('replaying same update_id 10× creates exactly 1 lead', async () => {
  const payload = { update_id: 42_002, message: { /* Kyiv-Lviv 18т */ } };
  for (let i = 0; i < 10; i++) {
    await app.inject({
      method: 'POST', url: '/webhook/telegram',
      headers: { 'x-telegram-bot-api-secret-token': config.TELEGRAM_WEBHOOK_SECRET! },
      payload,
    });
  }
  // Let the async workers settle.
  await new Promise((r) => setTimeout(r, 500));
  const result = await app.db.execute(sql`SELECT count(*)::int AS c FROM leads`);
  expect(result.rows[0].c).toBe(1);
});
```

**Callback query test:**

```typescript
it('confirm callback → synthetic "да" → order created', async () => {
  // Pre-seed a lead in QUOTED. Then dispatch a callback_query update.
  // Assert order_id appears on lead row.
});
```

**Manager intercept test:**

```typescript
it('intercept flag flips → next inbound message skips LLM', async () => {
  await app.inject({ method: 'POST', url: `/api/leads/${leadId}/intercept` });
  // Fire a Telegram update for same client.
  // Assert messages.count went up by 1, leads.stage UNCHANGED, no LLM calls recorded.
});
```

### Code Block 14 — setupWebhook

```typescript
// apps/api/src/channels/telegram/setup.ts
import type { Bot } from 'grammy';

export async function setupWebhook(args: {
  bot: Bot;
  publicUrl: string; // e.g. 'https://ai-logist.example.com'
  secretToken: string;
}): Promise<void> {
  const url = `${args.publicUrl.replace(/\/$/, '')}/webhook/telegram`;
  await args.bot.api.setWebhook(url, {
    secret_token: args.secretToken,
    allowed_updates: ['message', 'callback_query'], // narrow surface
    drop_pending_updates: true, // start clean
    max_connections: 40,
  });
}

// Optional: pnpm telegram:setup script — apps/api/scripts/telegram-setup.ts
// import { buildApp } from '../src/app.js';
// import { setupWebhook } from '../src/channels/telegram/setup.js';
// import { config } from '../src/config.js';
//
// const app = await buildApp();
// await setupWebhook({
//   bot: app.bot,
//   publicUrl: config.TELEGRAM_PUBLIC_URL!,
//   secretToken: config.TELEGRAM_WEBHOOK_SECRET!,
// });
// console.log('webhook set');
// await app.close();
```

### Code Block 15 — README section

````markdown
## Telegram Dev Setup

Phase 3 enables a real Telegram chat. To run the bot locally:

1. **Create a bot:** message [@BotFather](https://t.me/BotFather) on Telegram → `/newbot` → choose a name and username. Save the TOKEN it returns.
2. **Generate a webhook secret:**
   ```bash
   openssl rand -hex 32
   ```
3. **Expose your local server via ngrok:**
   ```bash
   ngrok http 3000
   ```
   Save the HTTPS URL (e.g. `https://abc123.ngrok.io`).
4. **Set env vars** in `apps/api/.env`:
   ```
   TELEGRAM_BOT_TOKEN=<token from BotFather>
   TELEGRAM_WEBHOOK_SECRET=<openssl rand output>
   TELEGRAM_BOT_USERNAME=<the bot's @username without @>
   TELEGRAM_PUBLIC_URL=https://abc123.ngrok.io
   ```
5. **Register the webhook with Telegram:**
   ```bash
   pnpm --filter @ai-logist/api telegram:setup
   ```
   You should see `{ ok: true }`. Verify with:
   ```bash
   curl https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo
   ```
6. **Test:** find your bot in Telegram (search `@your_bot_username`), hit `/start`, then send `Киев-Львов, 18 тонн, тент`. You should get a quote with inline buttons.

### Tear-down
```bash
curl https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/deleteWebhook
```
````

## Runtime State Inventory

> Already covered in detail above under §"Runtime State Inventory" — see that section. Summary: Telegram's setWebhook config + BotFather metadata are runtime state outside the repo; everything else is in our DB and migrates cleanly.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 22 LTS | Whole API | ✓ (Phase 1) | 22.x | — |
| PostgreSQL 17 + PostGIS 3.5 | webhook_updates, leads, trucks | ✓ (Phase 1) | 17-3.5 | — |
| Redis 7 | Bot doesn't directly need it; intake.ts uses it via plugin | ✓ (Phase 1) | 7.x | — |
| Telegram Bot API | All bot.api.* calls | ✓ (public Internet) | always-on | None — bot won't work offline. POLISH-02 simulate-call button is the demo fallback for voice. For Telegram there is no fallback. |
| BotFather access | Token issuance | ✓ (manual) | — | — |
| ngrok (dev only) | Local webhook exposure | ⚠ developer must install | latest | Use Cloudflare Tunnel as alternative — same shape. |
| grammy npm package | Bot framework | ⚠ NEEDS INSTALL | 1.43.0 | — |

**Missing dependencies with no fallback:** None blocking — Telegram Bot API is reachable from anywhere.

**Missing dependencies with fallback:**
- ngrok: developer-machine tool only; alternatives include Cloudflare Tunnel, localtunnel, or Tailscale Funnel.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 (already locked) |
| Config file | `apps/api/vitest.config.ts` (already exists with 3 projects: unit, integration, smoke) |
| Quick run command | `pnpm --filter @ai-logist/api test:unit` |
| Full suite command | `pnpm --filter @ai-logist/api test` |
| Phase gate | `pnpm --filter @ai-logist/api test` + `pnpm --filter @ai-logist/api typecheck` + `pnpm exec biome check` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| API-13 | POST /webhook/telegram exists, validates secret_token | integration | `pnpm vitest run tests/integration/telegram-webhook-auth.test.ts` | ❌ Wave 0 |
| API-15 | POST /webhook/voice returns 200 (was 501) | integration | `pnpm vitest run tests/integration/webhook-voice-stub.test.ts` | ❌ Wave 0 |
| TG-01 | grammY 1.43 bot.api.getMe succeeds + secret_token rejected on mismatch | integration | `pnpm vitest run tests/integration/telegram-webhook-auth.test.ts` | ❌ Wave 0 |
| TG-02 | <100ms ack + 10× same update_id → 1 lead | integration | `pnpm vitest run tests/integration/telegram-idempotency.test.ts` | ❌ Wave 0 |
| TG-03 | quoteKeyboard renders 3 buttons; callback regex matches | unit | `pnpm vitest run tests/unit/telegram-keyboards.test.ts` | ❌ Wave 0 |
| TG-04 | formatQuoteMessage substitutes price from DB | unit | `pnpm vitest run tests/unit/telegram-quote-message.test.ts` | ❌ Wave 0 |
| TG-05 | driver_telegram_id missing → auto-accept; present → sendMessage called | integration | `pnpm vitest run tests/integration/telegram-driver-notify.test.ts` | ❌ Wave 0 |
| TG-06 | intercept flips flag, /manager-message routes via bot, /release restores | integration | `pnpm vitest run tests/integration/telegram-intercept.test.ts` | ❌ Wave 0 |
| TG-07 | order DRIVER_ASSIGNED triggers notifyClient | integration | `pnpm vitest run tests/integration/telegram-notify-client.test.ts` | ❌ Wave 0 |
| (E2E success criterion #1) | Real dialog `Киев-Львов 18т → keyboard → confirm → ORDER_CREATED` via simulated webhook | integration | `pnpm vitest run tests/integration/telegram-e2e-pipeline.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @ai-logist/api test:unit` (≤ 5s; includes new unit tests for keyboards + adapter helpers)
- **Per wave merge:** `pnpm --filter @ai-logist/api test` (full suite incl. testcontainers integration tests, ~60s with Docker)
- **Phase gate:** Full suite green + `pnpm exec biome check` + `pnpm --filter @ai-logist/api typecheck` before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/api/tests/_helpers/telegram-mock.ts` — mock Bot impl with `sent[]` recorder (code block 13)
- [ ] `apps/api/tests/integration/telegram-webhook-auth.test.ts` — secret_token validation (TG-01, API-13)
- [ ] `apps/api/tests/integration/telegram-idempotency.test.ts` — 10× update_id → 1 lead (TG-02)
- [ ] `apps/api/tests/integration/telegram-webhook-latency.test.ts` — <100ms ack assertion (TG-02)
- [ ] `apps/api/tests/integration/webhook-voice-stub.test.ts` — POST /webhook/voice returns 200 (API-15)
- [ ] `apps/api/tests/unit/telegram-keyboards.test.ts` — quoteKeyboard / driverKeyboard / formatQuoteMessage (TG-03, TG-04)
- [ ] `apps/api/tests/unit/telegram-adapter.test.ts` — telegramUpdateToInbound mapping cases (sticker, callback, command, no-from)
- [ ] `apps/api/tests/integration/telegram-driver-notify.test.ts` — notifyDriver with + without driver_telegram_id (TG-05)
- [ ] `apps/api/tests/integration/telegram-intercept.test.ts` — three endpoints + bot silence (TG-06)
- [ ] `apps/api/tests/integration/telegram-notify-client.test.ts` — order FSM hook fires notifyClient (TG-07)
- [ ] `apps/api/tests/integration/telegram-e2e-pipeline.test.ts` — full simulated webhook → ORDER_CREATED (success criterion #1)
- [ ] `apps/api/tests/_helpers/telegram-fixtures.ts` — canonical Telegram Update payloads (message-text, callback_query-confirm, callback_query-driver_accept, sticker, command)
- [ ] Update `apps/api/tests/unit/phase-3-stubs.test.ts` — 9 `test.todo()` markers (one per req). Same pattern as Phase 2's `phase-2-stubs.test.ts`.

*(Existing test infrastructure — Vitest 4 + testcontainers + dialog-harness + MockAnthropicClient — covers everything else. No framework install needed.)*

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| node-telegram-bot-api | grammY 1.43 | 2024 onwards | Phase 3 uses grammY; node-telegram-bot-api is explicitly banned in STACK.md |
| Telegraf | grammY 1.43 | 2023-2024 | grammY is the modern TS-native default |
| Polling (`bot.start()`) | webhook (`webhookCallback`) | always preferred in production | We never call bot.start; webhook only |
| Express + `body-parser` | Fastify v5 + native zod | Fastify 4+ | We do not use Express; webhook handler is Fastify |
| Sync webhook handler | Two-stage handler (persist → ack → async worker) | post-2020 best practice for webhooks | Our handler is the canonical two-stage pattern |
| Custom inline_keyboard JSON | `new InlineKeyboard().text().row()` builder | grammY 1.x | Builder pattern only |

**Deprecated/outdated:**
- `bot.start()` long polling: incompatible with webhook mode; if both are configured, double-delivery + race.
- node-telegram-bot-api: per STACK.md, "fails horribly at scalability beyond 50 LOC" (grammY comparison). Banned.
- Telegram Bot API `getUpdates` polling for production: rate-limited and unreliable; never used in our code path.

## Open Questions

These are NOT blockers — they're decision points the planner / orchestrator may want to confirm. Default recommendations included.

1. **What happens when TELEGRAM_BOT_TOKEN is unset in production?**
   - What we know: D-30 says token is "required" but config.ts has it as `.optional()` (a Phase 2 placeholder).
   - What's unclear: should the API refuse to boot, or should it boot with the bot disabled (current draft behavior — telegramPlugin logs a warning and skips)?
   - **Recommendation:** Boot with bot disabled — `app.bot` is undefined; webhook route guards check `if (!app.bot) reply.code(503)`. This lets the Phase 4 admin still come up against staging DBs without Telegram. Production deploy script checks env presence at startup.

2. **Should the quote keyboard be sent from inside intake.ts's tx, or after?**
   - What we know: Pitfall #3 above warns against in-tx Telegram calls.
   - What's unclear: how exactly to pass outbound through without coupling intake to the transaction lifecycle.
   - **Recommendation:** Send AFTER the `db.transaction(...)` returns. intake.ts returns `{leadId, exchanges, postCommit?: () => Promise<void>}` or — simpler — the outbound call lives at the very END of the handleInboundMessage function, after the `return` from the tx callback. Code block in §Pattern 3 puts it inside the tx for brevity; planner should move it outside in the actual implementation.

3. **Driver decline path — order to CLOSED or order back to "pending re-assign"?**
   - What we know: D-19 says "decline → return lead to MATCHED so intake re-matches". But MATCHED is past in the FSM and there's no backward transition.
   - What's unclear: full re-match flow needs a new lead row, which is complex.
   - **Recommendation:** Demo path — `order → CLOSED + lead → LOST` with payload reason='driver_declined'. Manager picks it up in admin (Phase 4) and manually creates a fresh lead. Document this as a deliberate simplification in 03-PLAN.

4. **How does the webhook adapter render assistant messages back to Telegram?**
   - What we know: intake returns `exchanges[]` with `{role: 'assistant', content: string}` items. These are ALREADY persisted in `messages` table by intake; the Telegram adapter needs to ALSO send each assistant message via `bot.api.sendMessage`.
   - What's unclear: does intake's storage path duplicate work if the adapter then sends — i.e. who owns "actually send to Telegram"?
   - **Recommendation:** The adapter loops over `exchanges.filter(e => e.role === 'assistant')` and calls `bot.api.sendMessage(chat_id, content)` for each. intake.ts only persists; it never directly sends to Telegram. The keyboard for the QUOTED step is the ONE exception (sent via outbound abstraction) because it carries `reply_markup` which is Telegram-specific.

5. **Where does `transitionOrder → DRIVER_ASSIGNED` happen?**
   - What we know: Phase 2's createOrderHandler creates the order in `CREATED` status. Phase 3 needs DRIVER_ASSIGNED to trigger driver notification.
   - What's unclear: should intake.ts auto-advance the order after createOrder, or should it be a separate step?
   - **Recommendation:** Add an immediate `transitionOrder(orderId, 'DRIVER_ASSIGNED', actor:'ai', onSuccess: notifyDriver+notifyClient)` call inside intake.ts after the createOrderHandler returns and before exiting Step D-pre. This keeps the flow visible in one file.

6. **Should we tighten TelegramUpdateBodySchema?**
   - What we know: it's `.passthrough()` from Phase 1.
   - **Recommendation:** Leave it as-is. grammY's `Update` type in `grammy/types` is the structural validator; Zod is only used to confirm `update_id` exists.

## Sources

### Primary (HIGH confidence)
- [grammY 1.43 docs — Deployment Types](https://grammy.dev/guide/deployment-types) — webhookCallback Fastify adapter
- [grammY 1.43 docs — Keyboard plugin](https://grammy.dev/plugins/keyboard) — InlineKeyboard builder, callbackQuery handlers, editMessageReplyMarkup
- [grammY 1.43 docs — webhookCallback reference](https://grammy.dev/ref/core/webhookcallback) — exact signature + secretToken option
- [Telegram Bot API — Update object](https://core.telegram.org/bots/api#update) — message vs callback_query shapes; at most one optional field
- [Telegram Bot API — setWebhook](https://core.telegram.org/bots/api#setwebhook) — secret_token parameter, X-Telegram-Bot-Api-Secret-Token header
- `/Users/muhemmedibrahimov/Documents/holy-water/ai-logist/apps/api/src/pipeline/intake.ts` — handleInboundMessage contract (verified by reading source)
- `/Users/muhemmedibrahimov/Documents/holy-water/ai-logist/apps/api/src/persistence/schema/webhook_updates.ts` — UNIQUE constraint verified
- `/Users/muhemmedibrahimov/Documents/holy-water/ai-logist/apps/api/src/persistence/schema/trucks.ts` — driver_telegram_id ALREADY EXISTS as text
- `/Users/muhemmedibrahimov/Documents/holy-water/ai-logist/apps/api/src/persistence/schema/leads.ts` — manager_active confirmed NOT in schema
- `/Users/muhemmedibrahimov/Documents/holy-water/ai-logist/apps/api/src/persistence/repos/clients.ts` — findByTelegramId ALREADY EXISTS
- `/Users/muhemmedibrahimov/Documents/holy-water/ai-logist/apps/api/src/config.ts` — TOKEN+SECRET already optional placeholders
- `npm view grammy version` → 1.43.0 (verified 2026-06-09)

### Secondary (MEDIUM confidence)
- [PAS7 STUDIO blog — Deploy Telegram Bot Webhook with grammY + Node.js](https://pas7.com.ua/blog/en/telegram-bot-webhook-nodejs-typescript-grammy) — corroborates pattern
- [Secret Token in Telegram API: Secure Webhook Verification](https://nguyenthanhluan.com/en/glossary/secret_token-for-setwebhook-en/) — secret_token behavior
- [Code for checking out the timeout of answerCallbackQuery (gist)](https://gist.github.com/d-Rickyy-b/f789c75228bf00f572eec4450ed0d7c9) — empirical ~15s deadline for answerCallbackQuery (we target 200ms per CONTEXT D-15, well under)
- `.planning/research/PITFALLS.md` Pitfall #5 — Telegram duplicate handling
- `ai-logist-logic-spec.md` §5.1 — Telegram channel definition

### Tertiary (LOW confidence — needs verification during implementation)
- Exact behavior of grammY's `bot.handleUpdate` when called from a non-grammY context (we suspect it works fine; verify in integration test)
- Whether `setImmediate` reliably defers past Fastify's reply flush in Node 22 + Fastify 5 (verify with timing test)

## Project Constraints (from CLAUDE.md)

CLAUDE.md is project-level (lives at `/Users/muhemmedibrahimov/Documents/holy-water/ai-logist/CLAUDE.md`) and contains no Telegram-specific directives. It locks general stack (Node 22 + Fastify v5 + Drizzle + grammY 1.43 + Anthropic SDK + Next.js 16 / shadcn admin template). All directives are already honored by this research:
- grammY 1.43: locked ✓
- TypeScript strict: all code blocks use strict types ✓
- Zod schemas: TelegramUpdateBodySchema reused, new schemas added ✓
- Drizzle migrations: 0003 file documented ✓
- Pino logging via `app.log`: all logging examples use it ✓
- GSD workflow: this RESEARCH.md is the start of `/gsd:plan-phase` ✓
- No ESLint/Prettier (use Biome): not relevant to Phase 3 code blocks ✓

The user's private global instruction (Spokenly dictation for questions) does not apply — we have no clarifying questions to ask.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — grammY 1.43.0 verified live via npm; Fastify adapter pattern confirmed by official docs.
- Architecture: HIGH — pattern follows Phase 1+2 conventions exactly (plugin → routes → repos → adapter).
- Pitfalls: HIGH — closure for Pitfall #5 verified via existing webhook_updates UNIQUE; new pitfalls 1-8 identified from code review of intake.ts + order-fsm.ts.
- Schema changes: HIGH — verified by direct file reads (trucks.driver_telegram_id IS text, leads.manager_active IS missing, clients.findByTelegramId IS implemented).
- Test plan: HIGH — Vitest 4 + testcontainers + dialog-harness all already in place.

**Research date:** 2026-06-09
**Valid until:** 2026-07-09 (30 days — grammY 1.43 is stable; Telegram Bot API rarely breaks backwards-compat)
