// Phase 3 D-24 — Telegram notification templates for FSM transitions.
//
// Extends the Phase 2 stub (no prior file existed; this is the first concrete
// i18n surface). `renderNotificationTemplate` produces RU + UA strings for
// three order-status transitions that fire client notifications via Telegram:
//   - DRIVER_ASSIGNED → truck + driver details
//   - IN_TRANSIT      → "cargo en route"
//   - DELIVERED       → "delivered, thanks"
//
// CONTEXT D-24/D-26. Used by `notifyClient` in `channels/telegram/notifications.ts`.

export type OrderNotificationTransition = 'DRIVER_ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED';

export interface NotificationRow {
  number: string;
  plate_number: string | null;
  driver_name: string | null;
  driver_phone: string | null;
}

/**
 * Render a Telegram notification string for a given FSM order transition.
 *
 * Values are dropped from DB row (never LLM-paraphrased); missing values render
 * as `—` em-dash to keep the template stable.
 *
 * Lang fallback: callers should pre-resolve to 'ru' or 'ua'; this fn does NOT
 * accept 'en' or other locales (Phase 3 supports RU + UA only).
 */
export function renderNotificationTemplate(
  transition: OrderNotificationTransition,
  row: NotificationRow,
  lang: 'ru' | 'ua'
): string {
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
