// Phase 3 D-15, D-27, D-28 — Telegram bot.command + bot.callbackQuery wiring.
//
// Client callbacks (confirm|reject|change) ship here (TG-03 path back into intake).
// Driver callbacks (driver_accept|driver_decline) ship in Wave 4 (Plan 03-04).
//
// All client callbacks synthesize a text message ('да' / 'нет' / 'изменить') and
// dispatch via handleInboundMessage — the same intake entry point used by
// regular text messages. This keeps the LLM/FSM path single-rail; the keyboard
// is sugar over text for the demo.
import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Bot } from 'grammy';
import { clientsRepo } from '../../persistence/repos/index.js';
import { handleInboundMessage } from '../../pipeline/intake.js';
import { transitionLead } from '../../pipeline/lifecycle/lead-fsm.js';
import { transitionOrder } from '../../pipeline/lifecycle/order-fsm.js';
import { AnthropicLlmClient, type LlmProvider } from '../../pipeline/llm-client.js';
import { OutboundRegistry } from '../../pipeline/outbound.js';
import { tryAdvanceOrderAfterCreation } from './adapter.js';
import { createTelegramOutbound } from './outbound.js';

const GREETING_RU =
  'Здравствуйте! Я AI-ассистент компании. Чтобы оформить заказ — напишите откуда, куда, сколько тонн и тип кузова. Например: "Киев-Львов, 18 тонн, тент".';
const HELP_RU =
  'Я помогаю оформить грузоперевозку. Просто напишите маршрут и груз — я найду машину и посчитаю цену.\n\nПример: «Москва-Минск 22 тонны рефрижератор»';
const HELP_UA =
  'Я допомагаю оформити вантажоперевезення. Просто напишіть маршрут і вантаж — я знайду машину і розрахую ціну.\n\nПриклад: «Київ-Львів 18 тонн тент»';

export function registerTelegramHandlers(bot: Bot, app: FastifyInstance): void {
  bot.command('start', async (ctx) => {
    await ctx.reply(GREETING_RU);
  });

  bot.command('help', async (ctx) => {
    const tgId = ctx.from?.id;
    if (tgId) {
      const client = await clientsRepo.findByTelegramId(app.db, String(tgId));
      if (client?.lang === 'ua') {
        await ctx.reply(HELP_UA);
        return;
      }
      if (client?.lang === 'ru') {
        await ctx.reply(HELP_RU);
        return;
      }
    }
    // Unknown client / unknown lang — send both languages joined.
    await ctx.reply(`${HELP_RU}\n\n— — —\n\n${HELP_UA}`);
  });

  // Client callbacks: confirm | reject | change. D-15 + D-16.
  bot.callbackQuery(/^(confirm|reject|change):(.+)$/, async (ctx) => {
    const action = ctx.match[1] as 'confirm' | 'reject' | 'change';
    // const leadId = ctx.match[2];  // captured but intake re-resolves via open lead.

    // <15s answer deadline — acknowledge immediately (grammY clears the loading
    // spinner on the client). Network failures here are non-fatal; the next
    // action still flows.
    await ctx.answerCallbackQuery().catch(() => {
      /* swallow — message rendering below is the user-visible side effect */
    });
    await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch((err) => {
      app.log.warn({ err }, 'telegram: editMessageReplyMarkup failed (msg too old?)');
    });

    if (!ctx.from) return;
    const client = await clientsRepo.findByTelegramId(app.db, String(ctx.from.id));
    if (!client) return;

    // Synthetic text — intake's STEP D-pre confirmation regex matches 'да' so
    // the QUOTED → AGREED → ORDER_CREATED shortcut fires for confirm. 'нет' /
    // 'изменить' fall through to the normal LLM clarification path.
    const synthText = action === 'confirm' ? 'да' : action === 'reject' ? 'нет' : 'изменить';

    const outbound = new OutboundRegistry();
    outbound.register('telegram', createTelegramOutbound({ db: app.db, bot }));

    const llm = resolveLlm(app);

    const result = await handleInboundMessage({
      db: app.db,
      llm,
      log: app.log,
      clientId: client.id,
      text: synthText,
      channel: 'telegram',
      outbound,
    });

    const chatId = ctx.callbackQuery.message?.chat.id;
    if (chatId !== undefined) {
      for (const ex of result.exchanges) {
        if (ex.role === 'assistant' && typeof ex.content === 'string') {
          await bot.api.sendMessage(chatId, ex.content).catch((err) => {
            app.log.error(
              { err, leadId: result.leadId },
              'telegram: render callback assistant failed'
            );
          });
        }
      }
    }

    // Phase 3 D-17 — if intake created an order via STEP D-pre on this callback
    // (confirm → AGREED → ORDER_CREATED), advance order → DRIVER_ASSIGNED and
    // fire notifyDriver + notifyClient. Runs post-tx, non-blocking from the
    // user's perspective.
    await tryAdvanceOrderAfterCreation(app, result.exchanges);
  });

  // Driver-side callbacks (TG-05). driver_accept / driver_decline.
  // Accept = confirmation log (order already in DRIVER_ASSIGNED).
  // Decline = order → CLOSED + lead → LOST per RESEARCH Pitfall #5 / D-19.
  bot.callbackQuery(/^(driver_accept|driver_decline):(.+)$/, async (ctx) => {
    const action = ctx.match[1] as 'driver_accept' | 'driver_decline';
    const orderId = ctx.match[2];
    if (!orderId) return;

    await ctx.answerCallbackQuery().catch(() => {
      /* swallow — the reply below is the user-visible side effect */
    });
    await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {
      /* msg may be too old to edit — non-fatal */
    });

    if (action === 'driver_accept') {
      app.log.info({ orderId, driverTgId: ctx.from?.id }, 'telegram: driver accepted');
      await ctx.reply('✅ Принято. Удачной поездки!');
      return;
    }

    // driver_decline path. Two transitions in sequence:
    //   1. order → CLOSED with payload { driver_declined: true, driver_tg_id }
    //   2. lead → LOST with payload { reason: 'driver_declined', order_id }
    // The lead lookup uses leads.order_id (the FK lives on leads, NOT orders).
    try {
      await transitionOrder(app.db, {
        orderId,
        to: 'CLOSED',
        actor: 'system',
        payload: { driver_declined: true, driver_tg_id: ctx.from?.id ?? null },
      });

      const leadRows = await app.db.execute(sql`
        SELECT id::text AS id FROM leads WHERE order_id = ${orderId}
      `);
      const leadRow = leadRows.rows[0] as { id: string } | undefined;
      if (leadRow?.id) {
        await transitionLead(app.db, {
          leadId: leadRow.id,
          to: 'LOST',
          actor: 'system',
          payload: { reason: 'driver_declined', order_id: orderId },
        });
      }
    } catch (err) {
      app.log.error({ err, orderId }, 'telegram: decline transition failed');
    }
    await ctx.reply('Отказ зарегистрирован. Спасибо за обратную связь.');
  });
}

/**
 * Resolve an LlmProvider. Mirrors adapter.ts logic: tests inject via app.llm
 * decorator; production lazily constructs the Anthropic client.
 */
function resolveLlm(app: FastifyInstance): LlmProvider {
  const injected = (app as FastifyInstance & { llm?: LlmProvider }).llm;
  if (injected) return injected;
  return new AnthropicLlmClient();
}
