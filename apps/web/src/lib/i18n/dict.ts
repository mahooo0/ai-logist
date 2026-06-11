// apps/web/src/lib/i18n/dict.ts
// D-52 verbatim — RESEARCH Example 5. Phase 4 only translates strings we add.
// Zenith template's built-in EN/RU strings stay as-is (D-55).
export const dict = {
  ru: {
    'chat.intercept': 'Перехватить',
    'chat.release': 'Вернуть боту',
    'chat.managerMessagePlaceholder': 'Сообщение от менеджера',
    'calls.title': 'Звонки',
    'calls.filter.outcome': 'Исход',
    'calls.filter.outcome.completed': 'Завершён',
    'calls.filter.outcome.abandoned': 'Брошен',
    'calls.filter.outcome.escalated': 'Передан менеджеру',
    'calls.filter.outcome.error': 'Ошибка',
    'orders.title': 'Заказы',
    'orders.col.number': 'Номер',
    'orders.col.client': 'Клиент',
    'orders.col.route': 'Маршрут',
    'orders.col.status': 'Статус',
    'orders.col.price': 'Цена',
    'orders.col.channel': 'Канал',
    'kpi.tile.calls': 'Звонков',
    'kpi.tile.telegram': 'Telegram',
    'kpi.tile.conversion': 'Конверсия',
    'kpi.tile.avgCallDuration': 'Средняя длительность звонка',
    'kpi.tile.revenue': 'Выручка',
    'order.section.client': 'Клиент',
    'order.section.route': 'Маршрут',
    'order.section.truck': 'Машина',
    'order.section.cargo': 'Груз',
    'order.section.timeline': 'История',
    'order.breadcrumb.listenCall': 'Прослушать звонок',
    'order.breadcrumb.openChat': 'Открыть диалог',
  },
  ua: {
    'chat.intercept': 'Перехопити',
    'chat.release': 'Повернути боту',
    'chat.managerMessagePlaceholder': 'Повідомлення від менеджера',
    'calls.title': 'Дзвінки',
    'calls.filter.outcome': 'Результат',
    'calls.filter.outcome.completed': 'Завершено',
    'calls.filter.outcome.abandoned': 'Кинуто',
    'calls.filter.outcome.escalated': 'Передано менеджеру',
    'calls.filter.outcome.error': 'Помилка',
    'orders.title': 'Замовлення',
    'orders.col.number': 'Номер',
    'orders.col.client': 'Клієнт',
    'orders.col.route': 'Маршрут',
    'orders.col.status': 'Статус',
    'orders.col.price': 'Ціна',
    'orders.col.channel': 'Канал',
    'kpi.tile.calls': 'Дзвінків',
    'kpi.tile.telegram': 'Telegram',
    'kpi.tile.conversion': 'Конверсія',
    'kpi.tile.avgCallDuration': 'Середня тривалість дзвінка',
    'kpi.tile.revenue': 'Виторг',
    'order.section.client': 'Клієнт',
    'order.section.route': 'Маршрут',
    'order.section.truck': 'Машина',
    'order.section.cargo': 'Вантаж',
    'order.section.timeline': 'Історія',
    'order.breadcrumb.listenCall': 'Прослухати дзвінок',
    'order.breadcrumb.openChat': 'Відкрити діалог',
  },
} as const satisfies Record<'ru' | 'ua', Record<string, string>>;

export type DictKey = keyof typeof dict.ru;

// ============================================================================
// I18N-03 / Phase 5 Plan 05-02 — Wave 2: ICU plural templates
// ============================================================================
//
// Five admin-only pluralized templates × {ru, ua} verbatim per D-13. Use
// these via `formatPlural(pluralTemplates[lang][key], n, lang)` from the
// `./icu.ts` helper. The `other` clause is mandatory in ICU MessageFormat
// (the parser throws `MISSING_OTHER_CLAUSE` otherwise); per CLDR plural
// rules for RU + UA the `other` form coincides with the `many` form for
// integers (covers decimals and very-large numbers).
//
// CLDR locale mapping ('ua' → 'uk-UA') happens inside `formatPlural`; the
// templates here use raw `'ua'` keys so this dictionary stays consistent
// with the app's lang code.

export const pluralTemplates = {
  ru: {
    'fleet.foundTrucks':
      '{n, plural, one {# машина} few {# машины} many {# машин} other {# машин}}',
    'kpi.orders': '{n, plural, one {# заказ} few {# заказа} many {# заказов} other {# заказов}}',
    'kpi.calls': '{n, plural, one {# звонок} few {# звонка} many {# звонков} other {# звонков}}',
    'kpi.messages':
      '{n, plural, one {# сообщение} few {# сообщения} many {# сообщений} other {# сообщений}}',
    'quote.tons': '{n, plural, one {# тонна} few {# тонны} many {# тонн} other {# тонн}}',
  },
  ua: {
    'fleet.foundTrucks':
      '{n, plural, one {# машина} few {# машини} many {# машин} other {# машин}}',
    'kpi.orders':
      '{n, plural, one {# замовлення} few {# замовлення} many {# замовлень} other {# замовлень}}',
    'kpi.calls':
      '{n, plural, one {# дзвінок} few {# дзвінка} many {# дзвінків} other {# дзвінків}}',
    'kpi.messages':
      '{n, plural, one {# повідомлення} few {# повідомлення} many {# повідомлень} other {# повідомлень}}',
    'quote.tons': '{n, plural, one {# тонна} few {# тонни} many {# тонн} other {# тонн}}',
  },
} as const;

export type PluralKey = keyof typeof pluralTemplates.ru;
