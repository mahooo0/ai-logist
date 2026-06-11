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

// ============================================================================
// I18N-01 / Phase 5 Plan 05-02 — Wave 2: renderBotReply
// ============================================================================
//
// Added BELOW renderNotificationTemplate. Phase 3 notification renderer above
// is bit-identical (Plan 05-02 invariant — declension-grep.test.ts confirms).
//
// Eleven D-07 dictionary keys × RU/UA = 22 templates. Templates are
// declension-free per D-09 (no genitive-case preposition + city slot): the
// `quote-present` template uses the arrow separator "Маршрут: {from} → {to}".
// Cities are stored nominative-only in `cities.name_ru` / `name_ua`; runtime
// declension is deferred to v2. The `declension-grep.test.ts` unit asserts
// the forbidden grammatical patterns are absent from this file.
//
// Pricing safety (Phase 2 Pitfall #1 inheritance): the `{price}` parameter
// of `quote-present` is the caller's responsibility — `apps/api/src/pipeline/
// intake.ts` reads `leads.quoted_price` from the DB via `formatPriceKop`
// BEFORE invoking `renderBotReply`. The LLM never produces the numeric value;
// renderBotReply does pure string substitution.

export type BotReplyKey =
  | 'greeting'
  | 'clarify-route'
  | 'clarify-tons'
  | 'clarify-body-type'
  | 'quote-present'
  | 'confirm-ask'
  | 'order-confirmed'
  | 'escalate'
  | 'manager-takeover'
  | 'manager-handover'
  | 'budget-exceeded';

/**
 * Compile-time parameter signature for each BotReplyKey. `Record<string, never>`
 * = "this template takes no parameters; caller passes `{}`". Object-typed
 * entries enumerate the named substitutions used by the template literal.
 */
interface ReplyParams {
  greeting: Record<string, never>;
  'clarify-route': Record<string, never>;
  'clarify-tons': Record<string, never>;
  'clarify-body-type': Record<string, never>;
  'quote-present': {
    from: string;
    to: string;
    tons: number;
    bodyType: string;
    price: string;
    currency: string;
  };
  'confirm-ask': Record<string, never>;
  'order-confirmed': { number: string };
  escalate: Record<string, never>;
  'manager-takeover': Record<string, never>;
  'manager-handover': Record<string, never>;
  'budget-exceeded': Record<string, never>;
}

/**
 * D-07 verbatim dictionary. Eleven keys × {ru, ua}.
 *
 * Declension-free invariant (I18N-05 / D-09): every reference to a city
 * uses the arrow separator. The declension-grep unit test asserts this on
 * the file contents.
 */
const REPLIES: Record<'ru' | 'ua', Record<BotReplyKey, string>> = {
  ru: {
    greeting:
      'Здравствуйте! Меня зовут Артём, я с АИ-Логист, помогу с перевозкой. Что нужно перевезти — откуда, куда, сколько тонн?',
    'clarify-route': 'Подскажите, пожалуйста, откуда забираем и куда везём?',
    'clarify-tons': 'Сколько тонн груза?',
    'clarify-body-type': 'Какой кузов нужен — тент, рефрижератор, изотерм или контейнер?',
    'quote-present':
      'Подобрал машину под Ваш груз. Маршрут {from} → {to}, {tons} т, {bodyType}. Стоимость — {price} {currency}.',
    'confirm-ask': 'Оформляем заказ?',
    'order-confirmed':
      'Заказ {number} оформлен, машина выезжает на загрузку. Водитель свяжется с Вами по прибытии.',
    escalate: 'Минуту, передам коллеге — он перезвонит и уточнит детали.',
    'manager-takeover': 'Я подключился к диалогу, продолжу лично.',
    'manager-handover': 'Готов продолжить — расскажите, что нужно.',
    'budget-exceeded': 'Передаю Ваш запрос коллеге — он свяжется в ближайшее время.',
  },
  ua: {
    greeting:
      'Вітаю! Мене звати Артем, я з АІ-Логіст, допоможу з перевезенням. Що потрібно перевезти — звідки, куди, скільки тонн?',
    'clarify-route': 'Підкажіть, будь ласка, звідки забираємо і куди веземо?',
    'clarify-tons': 'Скільки тонн вантажу?',
    'clarify-body-type': 'Який кузов потрібен — тент, рефрижератор, ізотерм чи контейнер?',
    'quote-present':
      'Підібрав машину під Ваш вантаж. Маршрут {from} → {to}, {tons} т, {bodyType}. Вартість — {price} {currency}.',
    'confirm-ask': 'Оформлюємо замовлення?',
    'order-confirmed':
      'Замовлення {number} оформлено, машина виїжджає на завантаження. Водій зв’яжеться з Вами по прибуттю.',
    escalate: 'Хвилинку, передам колезі — він зателефонує та уточнить деталі.',
    'manager-takeover': 'Я підключився до діалогу, продовжу особисто.',
    'manager-handover': 'Готовий продовжити — розкажіть, що потрібно.',
    'budget-exceeded': 'Передаю Ваш запит колезі — він зв’яжеться найближчим часом.',
  },
};

/**
 * Render a bot reply by key + parameters + language.
 *
 * Pure string substitution — `{name}` placeholders are replaced with
 * `String(params.name)`. There is no ICU plural support here on purpose:
 * the eleven D-07 templates are short, fixed strings. ICU plurals live in
 * `apps/api/src/lib/icu.ts` (`formatIcu`) and `apps/web/src/lib/i18n/icu.ts`
 * (`formatPlural`) for the admin-only 5 plural templates per D-13.
 */
export function renderBotReply<K extends BotReplyKey>(
  key: K,
  params: ReplyParams[K],
  lang: 'ru' | 'ua'
): string {
  const template = REPLIES[lang][key];
  // `params` is typed as ReplyParams[K] — for param-free keys this is
  // `Record<string, never>` so `Object.keys` returns []. For the few
  // templates that take params, we iterate and substitute each `{name}`
  // placeholder. `replaceAll` is safe because placeholder tokens contain
  // braces, which do not collide with the substituted values.
  const paramsObj = params as unknown as Record<string, unknown>;
  let out = template;
  for (const name of Object.keys(paramsObj)) {
    out = out.replaceAll(`{${name}}`, String(paramsObj[name]));
  }
  return out;
}
