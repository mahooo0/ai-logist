// Phase 3 D-15, D-27, D-28 — Telegram bot.command + bot.callbackQuery wiring.
// Phase 6 D-09, D-14 — Phase 6 loading/delivery callbacks + handleDecline.
//
// Client callbacks (confirm|reject|change) ship here (TG-03 path back into intake).
// Driver callbacks (driver_accept|driver_decline) ship in Wave 4 (Plan 03-04).
// Phase 6 callbacks (confirm_loading|decline_loading|confirm_delivery|decline_delivery)
//   use direct transitionOrder calls (not LLM intake).
//
// All client callbacks synthesize a text message ('да' / 'нет' / 'изменить') and
// dispatch via handleInboundMessage — the same intake entry point used by
// regular text messages. This keeps the LLM/FSM path single-rail; the keyboard
// is sugar over text for the demo.
import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Bot } from 'grammy';
import { createCheckoutSession } from '../stripe/checkout.js';
import { requireStripeConfig } from '../stripe/setup.js';
import { clientsRepo } from '../../persistence/repos/index.js';
import { handleInboundMessage } from '../../pipeline/intake.js';
import { transitionLead } from '../../pipeline/lifecycle/lead-fsm.js';
import { transitionOrder } from '../../pipeline/lifecycle/order-fsm.js';
import { AnthropicLlmClient, type LlmProvider } from '../../pipeline/llm-client.js';
import { OutboundRegistry } from '../../pipeline/outbound.js';
import { tryAdvanceOrderAfterCreation } from './adapter.js';
import { notifyPaymentLink } from './notifications.js';
import { createTelegramOutbound } from './outbound.js';
import { renderPhase6Template } from '../../lib/i18n.js';

// ============================================================================
// Phase 6 D-14 — handleDecline
// ============================================================================
//
// Core decline handler for loading/delivery declines from client Telegram
// callbacks. Transitions order to CANCELED, releases truck (busy → available),
// sets leads.manager_active = true, inserts loading_declined / delivery_declined
// audit row (since STATUS_TO_EVENT.CANCELED = null, the explicit audit row is
// required), and sends a best-effort Telegram reply.
//
// All side effects after transitionOrder happen inside the post-commit onSuccess
// hook (fire-and-forget per RESEARCH Pitfall #3 — never block the row lock on
// downstream Telegram calls). Integration tests MUST use vi.waitFor to drain.

export interface HandleDeclineArgs {
  orderId: string;
  action: 'decline_loading' | 'decline_delivery';
  app: FastifyInstance;
  bot: Bot;
}

export async function handleDecline(args: HandleDeclineArgs): Promise<void> {
  const { orderId, action, app, bot } = args;
  const eventPayload = { source: 'telegram_callback', action };

  await transitionOrder(app.db, {
    orderId,
    to: 'CANCELED',
    actor: 'system',
    payload: eventPayload,
    onSuccess: async () => {
      // Truck + lead side-effects post-commit (atomic transaction).
      await app.db.transaction(async (tx) => {
        const orderRow = await tx.execute(sql`
          SELECT truck_id::text AS truck_id,
                 lead_id::text AS lead_id,
                 client_id::text AS client_id
          FROM orders WHERE id = ${orderId}::uuid
        `);
        const o = orderRow.rows[0] as
          | { truck_id: string | null; lead_id: string | null; client_id: string }
          | undefined;
        if (!o) return;
        if (o.truck_id) {
          await tx.execute(sql`
            UPDATE trucks SET status='available', updated_at=NOW()
            WHERE id=${o.truck_id}::uuid AND status='busy'
          `);
        }
        if (o.lead_id) {
          await tx.execute(sql`
            UPDATE leads SET manager_active=true, updated_at=NOW(), version=version+1
            WHERE id=${o.lead_id}::uuid
          `);
        }
      });

      // Write the per-leg decline audit row (explicit — CANCELED maps to null
      // in STATUS_TO_EVENT so transitionOrder does not insert one).
      const eventType = action === 'decline_loading' ? 'loading_declined' : 'delivery_declined';
      await app.db.execute(sql`
        INSERT INTO order_events (order_id, type, actor, payload)
        VALUES (
          ${orderId}::uuid,
          ${eventType}::order_event_type,
          'system',
          ${JSON.stringify(eventPayload)}::jsonb
        )
        ON CONFLICT (order_id, type) DO NOTHING
      `);

      // Best-effort Telegram reply (fire-and-forget inside the onSuccess hook).
      try {
        const r = await app.db.execute(sql`
          SELECT c.telegram_id, c.lang::text AS lang
          FROM orders o
          LEFT JOIN clients c ON c.id = o.client_id
          WHERE o.id = ${orderId}::uuid
        `);
        const row = r.rows[0] as { telegram_id: string | null; lang: string | null } | undefined;
        if (row?.telegram_id) {
          const text =
            row.lang === 'ua'
              ? "Гаразд, передаю колезі — він зв'яжеться найближчим часом."
              : 'Хорошо, передаю коллеге, он свяжется в ближайшее время.';
          await bot.api.sendMessage(row.telegram_id, text);
        }
      } catch (err) {
        app.log.warn({ err, orderId }, 'handleDecline: reply send failed');
      }
    },
  });
}

// ============================================================================
// Phase 6 D-16/D-17/D-18 — sendPaymentLink
// ============================================================================
//
// Reads order from DB, calls requireStripeConfig (D-19 gate), creates a
// Stripe Checkout Session, writes payment_link_sent audit event, sends
// the payment URL to the client via Telegram.
//
// B2 / D-19 GATE: requireStripeConfig() MUST throw + log.fatal when Stripe
// keys are missing. NEVER silent-swallow this error. Fail-safe path:
//   1. FATAL log (D-19 gate signal for the executor/checker).
//   2. Send payment_unavailable template to client.
//   3. Flip leads.manager_active=true so dispatcher picks it up manually.
//   4. Return without calling createCheckoutSession or any FSM transition.

export async function sendPaymentLink(args: {
  orderId: string;
  app: FastifyInstance;
  bot: Bot;
}): Promise<void> {
  const { orderId, app, bot } = args;
  const orderRow = await app.db.execute(sql`
    SELECT number, public_token, lead_id::text AS lead_id, price::text AS price
    FROM orders WHERE id = ${orderId}::uuid
  `);
  const o = orderRow.rows[0] as
    | { number: string; public_token: string; lead_id: string | null; price: string }
    | undefined;
  if (!o) {
    app.log.warn({ orderId }, 'sendPaymentLink: order not found');
    return;
  }

  // B2 / D-19 GATE: requireStripeConfig() throws when Stripe keys are missing.
  // MUST NOT silently swallow — FATAL log + fail-safe Telegram message + manager escalation.
  let cfg: ReturnType<typeof requireStripeConfig>;
  try {
    cfg = requireStripeConfig();
  } catch (err) {
    app.log.fatal(
      { err, orderId, gate: 'D-19' },
      'phase6: D-19 GATE — stripe_keys_missing; payment cannot proceed. Executor must request STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET from the user before the live server starts.'
    );
    // 1. Send Telegram fail-safe (uses Plan 06-01 payment_unavailable template).
    try {
      const clientRow = await app.db.execute(sql`
        SELECT c.telegram_id, c.lang FROM orders o
        LEFT JOIN clients c ON c.id = o.client_id
        WHERE o.id = ${orderId}::uuid
      `);
      const row = clientRow.rows[0] as
        | { telegram_id: string | null; lang: string | null }
        | undefined;
      if (row?.telegram_id) {
        const lang = (row.lang === 'ua' ? 'ua' : 'ru') as 'ru' | 'ua';
        const text = renderPhase6Template('payment_unavailable', { number: o.number }, lang);
        await bot.api.sendMessage(row.telegram_id, text);
      }
    } catch (sendErr) {
      app.log.error({ err: sendErr, orderId }, 'sendPaymentLink: failed to send fail-safe message');
    }
    // 2. Flip lead to manager_active so dispatcher picks it up.
    if (o.lead_id) {
      try {
        await app.db.execute(sql`
          UPDATE leads SET manager_active = true, updated_at = NOW(), version = version + 1
          WHERE id = ${o.lead_id}::uuid
        `);
      } catch (leadErr) {
        app.log.error(
          { err: leadErr, orderId, leadId: o.lead_id },
          'sendPaymentLink: failed to flip manager_active'
        );
      }
    }
    // 3. Do NOT proceed — dispatcher resolves it manually.
    return;
  }

  let checkout: { url: string; sessionId: string };
  try {
    checkout = await createCheckoutSession({
      orderId,
      orderNumber: o.number,
      priceKopecks: BigInt(o.price),
      currency: cfg.priceCurrency,
      publicToken: o.public_token,
    });
  } catch (err) {
    // Stripe API call failed AFTER config validated (network, rate-limit, etc.).
    app.log.error({ err, orderId }, 'sendPaymentLink: createCheckoutSession failed');
    if (o.lead_id) {
      await app.db
        .execute(
          sql`UPDATE leads SET manager_active = true, updated_at = NOW(), version = version + 1
          WHERE id = ${o.lead_id}::uuid`
        )
        .catch(() => {});
    }
    return;
  }

  // Audit event — payment_link_sent (per-order unique, write before send so
  // a successful Stripe call without Telegram delivery is still traceable).
  await app.db.execute(sql`
    INSERT INTO order_events (order_id, type, actor, payload)
    VALUES (${orderId}::uuid, 'payment_link_sent'::order_event_type, 'system',
            ${JSON.stringify({ stripe_session_id: checkout.sessionId })}::jsonb)
    ON CONFLICT (order_id, type) DO NOTHING
  `);

  await notifyPaymentLink({ orderId, paymentUrl: checkout.url, db: app.db, bot, log: app.log });
}

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

  // Phase 6 D-09 — loading + delivery client-side callbacks.
  // This block is ADDED after the Phase 3 regexes; the Phase 3 regexes are not modified.
  bot.callbackQuery(
    /^(confirm_loading|decline_loading|confirm_delivery|decline_delivery):(.+)$/,
    async (ctx) => {
      const action = ctx.match[1] as
        | 'confirm_loading'
        | 'decline_loading'
        | 'confirm_delivery'
        | 'decline_delivery';
      const orderId = ctx.match[2];
      if (!orderId) return;

      await ctx.answerCallbackQuery().catch(() => {
        /* swallow — dismiss spinner */
      });
      await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch((err) => {
        app.log.warn({ err, action, orderId }, 'phase6 callback: editMessageReplyMarkup failed');
      });

      try {
        if (action === 'confirm_loading') {
          await transitionOrder(app.db, {
            orderId,
            to: 'IN_TRANSIT',
            actor: 'system',
            payload: { source: 'telegram_callback', action },
            onSuccess: async () => {
              // Write loading_confirmed audit row (in addition to the in_transit row
              // written by STATUS_TO_EVENT — this is the per-leg confirmation event).
              await app.db.execute(sql`
                INSERT INTO order_events (order_id, type, actor, payload)
                VALUES (
                  ${orderId}::uuid,
                  'loading_confirmed'::order_event_type,
                  'system',
                  '{}'::jsonb
                )
                ON CONFLICT (order_id, type) DO NOTHING
              `);
              // Reset progress so leg 2 begins at 0%.
              await app.db.execute(sql`
                UPDATE orders SET progress_percent=0, updated_at=NOW()
                WHERE id=${orderId}::uuid
              `);
            },
          });
        } else if (action === 'confirm_delivery') {
          await transitionOrder(app.db, {
            orderId,
            to: 'AWAITING_PAYMENT',
            actor: 'system',
            payload: { source: 'telegram_callback', action },
            onSuccess: async () => {
              await app.db.execute(sql`
                INSERT INTO order_events (order_id, type, actor, payload)
                VALUES (
                  ${orderId}::uuid,
                  'delivery_confirmed'::order_event_type,
                  'system',
                  '{}'::jsonb
                )
                ON CONFLICT (order_id, type) DO NOTHING
              `);
              // W7 — Wire sendPaymentLink (Plan 06-03). Creates Stripe
              // Checkout Session + sends payment URL via Telegram.
              await sendPaymentLink({ orderId, app, bot });
            },
          });
        } else {
          // decline_loading or decline_delivery
          await handleDecline({ orderId, action, app, bot });
        }
      } catch (err) {
        app.log.error({ err, orderId, action }, 'phase6 callback: transition failed');
      }
    }
  );
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
