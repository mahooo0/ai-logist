// Phase 3 D-17, D-18, D-24, D-25, D-26 — Telegram notification senders.
// Phase 6 D-06 — 5 additional Phase 6 lifecycle senders appended at bottom.
//
// `notifyDriver` — invoked from the order-fsm onSuccess hook after a transition
//   to DRIVER_ASSIGNED. Sends a single Telegram message with driverKeyboard to
//   the assigned truck's `driver_telegram_id`. When the column is NULL the
//   function logs a warning and returns (D-18 "simulated auto-accept" — keep
//   the order in DRIVER_ASSIGNED; Phase 5 tracking advances it forward).
//
// `notifyClient` — invoked from any post-commit onSuccess for transitions
//   listed in `OrderNotificationTransition`. Renders the i18n template by
//   `clients.lang` and sends via Telegram. Skips silently when telegram_id
//   is NULL (D-26).
//
// Both MUST be called AFTER `db.transaction(...)` commits (RESEARCH Pitfall #3).
// Errors are logged and swallowed — they MUST NOT roll back the FSM transition.
import { sql } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import type { Bot } from 'grammy';
import type { Db } from '../../db.js';
import {
  type OrderNotificationTransition,
  renderNotificationTemplate,
  type Phase6Transition,
  renderPhase6Template,
} from '../../lib/i18n.js';
import { driverKeyboard, loadingKeyboard, deliveryKeyboard } from './keyboards.js';

export interface NotifyDriverArgs {
  orderId: string;
  db: Db;
  bot: Bot;
  log: FastifyBaseLogger;
}

export interface NotifyClientArgs {
  orderId: string;
  transition: OrderNotificationTransition;
  db: Db;
  bot: Bot;
  log: FastifyBaseLogger;
}

interface DriverRow {
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
}

interface ClientRow {
  number: string;
  plate_number: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  telegram_id: string | null;
  lang: string | null;
}

/**
 * Send the driver-confirmation Telegram message for an order in DRIVER_ASSIGNED.
 *
 * Single JOIN reads order + truck + client + cities so the function does not
 * leak repo hits into the post-commit hot path. The `lang` for the keyboard
 * is hard-defaulted to 'ru' — driver-side locale handling is deferred (D-18).
 */
export async function notifyDriver(args: NotifyDriverArgs): Promise<void> {
  const { orderId, db, bot, log } = args;
  const result = await db.execute(sql`
    SELECT o.id::text AS order_id,
           o.number AS order_number,
           o.price::text AS price,
           t.id::text AS truck_id,
           t.plate_number,
           t.driver_name,
           t.driver_telegram_id,
           c.name AS client_name,
           cf.name_ru AS from_name,
           ct.name_ru AS to_name
    FROM orders o
    LEFT JOIN trucks t ON t.id = o.truck_id
    LEFT JOIN clients c ON c.id = o.client_id
    LEFT JOIN cities cf ON cf.id = o.from_city_id
    LEFT JOIN cities ct ON ct.id = o.to_city_id
    WHERE o.id = ${orderId}
  `);
  const row = result.rows[0] as DriverRow | undefined;
  if (!row) {
    log.warn({ orderId }, 'notifyDriver: order not found');
    return;
  }

  // D-18 stub flow — no driver_telegram_id → log + return. The order stays in
  // DRIVER_ASSIGNED; Phase 5 simulated GPS will advance it through AT_LOADING
  // / IN_TRANSIT. No FSM transition fires here.
  if (!row.driver_telegram_id) {
    log.warn(
      { truckId: row.truck_id, orderId },
      'notifyDriver: driver_telegram_id missing — simulated auto-accept'
    );
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

  try {
    await bot.api.sendMessage(row.driver_telegram_id, text, {
      parse_mode: 'HTML',
      reply_markup: driverKeyboard(orderId, 'ru'),
    });
  } catch (err) {
    log.error({ err, orderId }, 'notifyDriver: send failed');
  }
}

/**
 * Send a client-facing Telegram message for a given FSM transition.
 *
 * Skips silently when `clients.telegram_id` is NULL (D-26 — voice-only
 * clients). Send failures are logged + swallowed.
 */
export async function notifyClient(args: NotifyClientArgs): Promise<void> {
  const { orderId, transition, db, bot, log } = args;
  const result = await db.execute(sql`
    SELECT o.number,
           t.plate_number,
           t.driver_name,
           t.driver_phone,
           c.telegram_id,
           c.lang::text AS lang
    FROM orders o
    LEFT JOIN trucks t ON t.id = o.truck_id
    LEFT JOIN clients c ON c.id = o.client_id
    WHERE o.id = ${orderId}
  `);
  const row = result.rows[0] as ClientRow | undefined;
  if (!row) {
    log.warn({ orderId }, 'notifyClient: order not found');
    return;
  }
  if (!row.telegram_id) {
    log.info({ orderId }, 'notifyClient: client has no telegram_id — skip');
    return;
  }

  const lang = (row.lang === 'ua' ? 'ua' : 'ru') as 'ru' | 'ua';
  const text = renderNotificationTemplate(transition, row, lang);
  try {
    await bot.api.sendMessage(row.telegram_id, text, { parse_mode: 'HTML' });
  } catch (err) {
    log.error({ err, orderId, transition }, 'notifyClient: send failed');
  }
}

// ============================================================================
// Phase 6 D-06 senders — Order lifecycle automation notifications.
// ============================================================================
//
// Each helper reads order.number + client.telegram_id + client.lang via a
// single JOIN, renders the Phase 6 template, and sends via Telegram.
// Mirrors the notifyClient SQL-JOIN pattern.
//
// IMPORTANT: notifyLoadingPrompt and notifyDeliveryPrompt MUST NOT insert
// loading_prompted / delivery_prompted event rows — transitionOrder handles
// that natively via STATUS_TO_EVENT (B5 Path A).
//
// All helpers are safe to call post-commit (fire-and-forget per Pitfall #3).

interface Phase6ClientRow {
  number: string;
  telegram_id: string | null;
  lang: string | null;
}

async function loadPhase6Row(db: Db, orderId: string): Promise<Phase6ClientRow | null> {
  const result = await db.execute(sql`
    SELECT o.number, c.telegram_id, c.lang::text AS lang
    FROM orders o
    LEFT JOIN clients c ON c.id = o.client_id
    WHERE o.id = ${orderId}::uuid
  `);
  return (result.rows[0] as Phase6ClientRow | undefined) ?? null;
}

async function sendPhase6(args: {
  orderId: string;
  transition: Phase6Transition;
  keyboard?: 'loading' | 'delivery';
  extraRow?: Partial<{ payment_url: string | null }>;
  db: Db;
  bot: Bot;
  log: FastifyBaseLogger;
}): Promise<void> {
  const { orderId, transition, keyboard, extraRow, db, bot, log } = args;
  const row = await loadPhase6Row(db, orderId);
  if (!row || !row.telegram_id) {
    log.warn({ orderId, transition }, 'phase6 notify: missing telegram_id');
    return;
  }
  const lang = (row.lang === 'ua' ? 'ua' : 'ru') as 'ru' | 'ua';
  const text = renderPhase6Template(transition, { number: row.number, ...extraRow }, lang);
  const reply_markup =
    keyboard === 'loading'
      ? loadingKeyboard(orderId, lang)
      : keyboard === 'delivery'
        ? deliveryKeyboard(orderId, lang)
        : undefined;
  try {
    await bot.api.sendMessage(
      row.telegram_id,
      text,
      reply_markup ? { reply_markup } : {}
    );
  } catch (err) {
    log.error({ err, orderId, transition }, 'phase6 notify: send failed');
  }
}

/**
 * Notify client that truck is approaching pickup (leg 1) or delivery (leg 2).
 * Called by Wave 2 ticker when progress_percent reaches 90%.
 */
export async function notifyApproach(args: {
  orderId: string;
  leg: 'DRIVER_ASSIGNED' | 'IN_TRANSIT';
  db: Db;
  bot: Bot;
  log: FastifyBaseLogger;
}): Promise<void> {
  const transition: Phase6Transition =
    args.leg === 'DRIVER_ASSIGNED' ? 'truck_approaching_pickup' : 'truck_approaching_delivery';
  await sendPhase6({
    orderId: args.orderId,
    transition,
    db: args.db,
    bot: args.bot,
    log: args.log,
  });
}

/**
 * Send loading confirmation prompt with loadingKeyboard inline buttons.
 * NOTE: does NOT insert loading_prompted event — transitionOrder does that.
 */
export async function notifyLoadingPrompt(args: {
  orderId: string;
  db: Db;
  bot: Bot;
  log: FastifyBaseLogger;
}): Promise<void> {
  await sendPhase6({
    orderId: args.orderId,
    transition: 'confirm_loading',
    keyboard: 'loading',
    db: args.db,
    bot: args.bot,
    log: args.log,
  });
}

/**
 * Send delivery confirmation prompt with deliveryKeyboard inline buttons.
 * NOTE: does NOT insert delivery_prompted event — transitionOrder does that.
 */
export async function notifyDeliveryPrompt(args: {
  orderId: string;
  db: Db;
  bot: Bot;
  log: FastifyBaseLogger;
}): Promise<void> {
  await sendPhase6({
    orderId: args.orderId,
    transition: 'confirm_delivery',
    keyboard: 'delivery',
    db: args.db,
    bot: args.bot,
    log: args.log,
  });
}

/**
 * Send payment link message to client after delivery confirmation.
 * Called by Wave 3 Stripe checkout handler.
 */
export async function notifyPaymentLink(args: {
  orderId: string;
  paymentUrl: string;
  db: Db;
  bot: Bot;
  log: FastifyBaseLogger;
}): Promise<void> {
  await sendPhase6({
    orderId: args.orderId,
    transition: 'payment_link',
    extraRow: { payment_url: args.paymentUrl },
    db: args.db,
    bot: args.bot,
    log: args.log,
  });
}

/**
 * Notify client that payment was received and order is closed.
 * Called by Wave 3 Stripe webhook on checkout.session.completed.
 */
export async function notifyPaymentReceived(args: {
  orderId: string;
  db: Db;
  bot: Bot;
  log: FastifyBaseLogger;
}): Promise<void> {
  await sendPhase6({
    orderId: args.orderId,
    transition: 'payment_received',
    db: args.db,
    bot: args.bot,
    log: args.log,
  });
}
