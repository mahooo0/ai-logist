// Phase 3 D-12, D-13, D-19, TG-03, TG-04 — Telegram inline keyboards + quote card.
//
// Templated quote text — every number is read from the lead row (NOT the LLM).
// callback_data format: '<action>:<leadId>' per D-13.
// RU/UA labels per CONTEXT D-12.
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

/** Driver-confirmation keyboard (TG-05). Used by Wave 4 notifyDriver. */
export function driverKeyboard(orderId: string, lang: Lang): InlineKeyboard {
  const labels =
    lang === 'ua'
      ? { accept: 'Прийняти ✅', decline: 'Відмовитись' }
      : { accept: 'Принять ✅', decline: 'Отказаться' };
  return new InlineKeyboard()
    .text(labels.accept, `driver_accept:${orderId}`)
    .text(labels.decline, `driver_decline:${orderId}`);
}

/** Loading confirmation keyboard (D-08). callback_data = '<action>:<orderId>'. */
export function loadingKeyboard(orderId: string, lang: Lang): InlineKeyboard {
  const labels =
    lang === 'ua'
      ? { yes: '✅ Так, підтверджую', no: '⚠️ Ні, є проблема' }
      : { yes: '✅ Да, подтверждаю', no: '⚠️ Нет, есть проблема' };
  return new InlineKeyboard()
    .text(labels.yes, `confirm_loading:${orderId}`)
    .row()
    .text(labels.no, `decline_loading:${orderId}`);
}

/** Delivery confirmation keyboard (D-08). callback_data = '<action>:<orderId>'. */
export function deliveryKeyboard(orderId: string, lang: Lang): InlineKeyboard {
  const labels =
    lang === 'ua'
      ? { yes: '✅ Так, отримав', no: '⚠️ Ні, є проблема' }
      : { yes: '✅ Да, получил', no: '⚠️ Нет, есть проблема' };
  return new InlineKeyboard()
    .text(labels.yes, `confirm_delivery:${orderId}`)
    .row()
    .text(labels.no, `decline_delivery:${orderId}`);
}

/**
 * Templated quote text (TG-04). Pulls every value from DB — no LLM strings.
 * `fromCityName` / `toCityName` are optional; missing → em-dash placeholder.
 */
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
