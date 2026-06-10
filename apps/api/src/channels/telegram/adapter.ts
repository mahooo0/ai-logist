// Phase 3 D-09, D-10, D-11 — real Telegram → pipeline adapter.
//
// Replaces Wave 2 stub. Triages every update kind, find-or-creates the client
// by telegram_id (synthetic phone `tg:<id>` per D-10), applies the manager
// intercept gate (D-11), builds the OutboundRegistry with the Telegram impl
// (D-14), calls handleInboundMessage, then renders assistant exchanges back
// to Telegram (RESEARCH Open Question §4).
//
// Triage order (RESEARCH Pattern 5):
//   1. callback_query    → app.bot.handleUpdate(update) — handlers.ts dispatches.
//   2. no message        → log+skip.
//   3. no from           → log+skip (Telegram channel posts have no `from`).
//   4. text starts with '/' → command → app.bot.handleUpdate(update).
//   5. non-text (sticker / photo / voice / document) → polite refusal per D-29.
//   6. else              → find-or-create client → manager_active gate → intake.
import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Update } from 'grammy/types';
import type { Db } from '../../db.js';
import { clientsRepo, messagesRepo } from '../../persistence/repos/index.js';
import { handleInboundMessage } from '../../pipeline/intake.js';
import { AnthropicLlmClient, type LlmProvider } from '../../pipeline/llm-client.js';
import { OutboundRegistry } from '../../pipeline/outbound.js';
import { createTelegramOutbound } from './outbound.js';

export interface ProcessTelegramUpdateArgs {
  app: FastifyInstance;
  payload: { update_id: number } & Record<string, unknown>;
}

/**
 * D-29 — polite refusal when the user sends a non-text message (sticker,
 * photo, voice, document). RU by default — language hint is not yet known on
 * the first turn (sticky lang detect runs inside intake on ≥20-char text).
 */
const NON_TEXT_REFUSAL_RU = 'Я понимаю только текстовые сообщения. Напишите детали груза.';

export async function processTelegramUpdate(args: ProcessTelegramUpdateArgs): Promise<void> {
  const { app, payload } = args;
  const update = payload as unknown as Update;

  // 1. Callback queries → grammY's bot.handleUpdate dispatches to handlers.ts.
  if (update.callback_query) {
    const bot = getBot(app);
    if (!bot) {
      app.log.warn({ update_id: update.update_id }, 'telegram: callback_query but bot disabled');
      return;
    }
    await bot.handleUpdate(update);
    return;
  }

  if (!update.message) {
    app.log.info({ update_id: update.update_id }, 'telegram: update without message — skipped');
    return;
  }
  const msg = update.message;
  if (!msg.from) {
    app.log.warn({ update_id: update.update_id }, 'telegram: message without from — skipped');
    return;
  }

  // Commands → grammY dispatches /start /help via bot.command in handlers.ts.
  if (msg.text?.startsWith('/')) {
    const bot = getBot(app);
    if (!bot) return;
    await bot.handleUpdate(update);
    return;
  }

  // Non-text (sticker, photo, voice, document) — polite refusal per D-29.
  if (!msg.text) {
    const bot = getBot(app);
    if (bot) {
      await bot.api.sendMessage(msg.chat.id, NON_TEXT_REFUSAL_RU).catch((err) => {
        app.log.error({ err, chat_id: msg.chat.id }, 'telegram: non-text refusal send failed');
      });
    }
    return;
  }

  // Find-or-create client (D-10). String coercion at the boundary — telegram_id
  // is text in DB; from.id is JS number which exceeds 2^53 for some accounts.
  const telegramId = String(msg.from.id);
  let client = await clientsRepo.findByTelegramId(app.db, telegramId);
  if (!client) {
    const name =
      [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ').trim() || 'Гость';
    client = await clientsRepo.create(app.db, {
      name,
      phone: `tg:${telegramId}`,
      telegramId,
      // lang: omitted → DB default 'ru'. Sticky detect in intake.ts will override
      // on the first ≥20-char message.
    });
  }

  // Manager intercept gate (D-11). When manager_active=true on the open lead,
  // persist the client msg with role='client' but DO NOT run intake. The
  // manager replies via Phase 4 admin.
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
      'telegram: bot silent (manager_active=true) — client msg persisted'
    );
    return;
  }

  // Build outbound registry — Telegram impl pushes the quote keyboard after
  // intake commits (D-14). When bot is disabled the registry has no entry and
  // intake's outbound.get('telegram') returns null → outbound is a no-op.
  const outbound = new OutboundRegistry();
  const bot = getBot(app);
  if (bot) {
    outbound.register('telegram', createTelegramOutbound({ db: app.db, bot }));
  }

  // Resolve LLM provider. Tests inject via app.llm decorator; production
  // constructs Anthropic client lazily.
  const llm = resolveLlm(app);

  const result = await handleInboundMessage({
    db: app.db,
    llm,
    log: app.log,
    clientId: client.id,
    text: msg.text,
    channel: 'telegram',
    outbound,
  });

  // Render assistant exchanges back to Telegram (RESEARCH Open Question §4).
  // intake.ts already persisted these to messages; here we ALSO push via
  // bot.api so the user sees them as Telegram messages. The quote keyboard for
  // QUOTED stage is sent separately by outbound.sendQuoteKeyboard (post-commit,
  // intake-driven).
  if (bot) {
    for (const ex of result.exchanges) {
      if (ex.role === 'assistant' && typeof ex.content === 'string') {
        await bot.api.sendMessage(msg.chat.id, ex.content).catch((err) => {
          app.log.error({ err, leadId: result.leadId }, 'telegram: render assistant failed');
        });
      }
    }
  }
}

/** Most recent open lead where manager_active=true. */
async function findInterceptedLead(db: Db, clientId: string): Promise<{ id: string } | null> {
  const result = await db.execute(sql`
    SELECT id::text AS id FROM leads
    WHERE client_id = ${clientId}
      AND manager_active = true
      AND stage NOT IN ('DONE', 'LOST', 'ORDER_CREATED', 'IN_PROGRESS')
    ORDER BY updated_at DESC LIMIT 1
  `);
  const row = result.rows[0] as { id: string } | undefined;
  return row ?? null;
}

/**
 * Resolve the grammY Bot from the Fastify instance. The telegram plugin only
 * decorates `app.bot` when TELEGRAM_BOT_TOKEN is configured; in test envs
 * without a token the field is undefined.
 */
function getBot(app: FastifyInstance): FastifyInstance['bot'] | undefined {
  const maybe = (app as FastifyInstance & { bot?: FastifyInstance['bot'] }).bot;
  return maybe;
}

/**
 * Resolve an LlmProvider. Tests inject via `app.llm` decorator; production
 * lazily constructs the Anthropic client (which itself fails fast if the API
 * key is missing). The lazy path lets the bot boot without ANTHROPIC_API_KEY
 * (Telegram-only health checks pass) but errors loudly at first dispatch.
 */
function resolveLlm(app: FastifyInstance): LlmProvider {
  const injected = (app as FastifyInstance & { llm?: LlmProvider }).llm;
  if (injected) return injected;
  return new AnthropicLlmClient();
}
