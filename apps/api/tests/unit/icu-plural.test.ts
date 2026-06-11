import IntlMessageFormat from 'intl-messageformat';
import { describe, expect, it } from 'vitest';

// I18N-03 (Plan 05-02 — Wave 2). Asserts CLDR plural rules for RU + UA Slavic
// languages render correctly through `intl-messageformat`. The suite lives
// under apps/api/tests/unit/ but tests the underlying library directly —
// both the server-side `apps/api/src/lib/icu.ts` and the client-side
// `apps/web/src/lib/i18n/icu.ts` are thin wrappers over `IntlMessageFormat`
// + the CLDR locale mapping `'ua' → 'uk-UA'` (Pitfall §1 in 05-RESEARCH.md).
// Running the assertions on the library directly gives us one source of
// plural truth that both wrappers inherit.
//
// Coverage matrix:
//   5 templates × 6 n-values (0, 1, 2, 5, 21, 25) × 2 langs = 60 assertions
//   + spot-checks on canonical (n, plural-form) pairs from the CLDR data
//   + UA CLDR-locale boundary check (intl-messageformat constructor sees
//     'uk-UA', not the app-level 'ua' string).

function formatPlural(template: string, n: number, lang: 'ru' | 'ua'): string {
  const cldrLocale = lang === 'ua' ? 'uk-UA' : 'ru-RU';
  const imf = new IntlMessageFormat(template, cldrLocale);
  const result = imf.format({ n });
  return Array.isArray(result) ? result.join('') : String(result);
}

const RU_TEMPLATES = {
  'fleet.foundTrucks': '{n, plural, one {# машина} few {# машины} many {# машин} other {# машин}}',
  'kpi.orders': '{n, plural, one {# заказ} few {# заказа} many {# заказов} other {# заказов}}',
  'kpi.calls': '{n, plural, one {# звонок} few {# звонка} many {# звонков} other {# звонков}}',
  'kpi.messages':
    '{n, plural, one {# сообщение} few {# сообщения} many {# сообщений} other {# сообщений}}',
  'quote.tons': '{n, plural, one {# тонна} few {# тонны} many {# тонн} other {# тонн}}',
} as const;

const UA_TEMPLATES = {
  'fleet.foundTrucks': '{n, plural, one {# машина} few {# машини} many {# машин} other {# машин}}',
  'kpi.orders':
    '{n, plural, one {# замовлення} few {# замовлення} many {# замовлень} other {# замовлень}}',
  'kpi.calls': '{n, plural, one {# дзвінок} few {# дзвінка} many {# дзвінків} other {# дзвінків}}',
  'kpi.messages':
    '{n, plural, one {# повідомлення} few {# повідомлення} many {# повідомлень} other {# повідомлень}}',
  'quote.tons': '{n, plural, one {# тонна} few {# тонни} many {# тонн} other {# тонн}}',
} as const;

const N_VALUES = [0, 1, 2, 5, 21, 25] as const;

describe('I18N-03: ICU MessageFormat plural rules for RU/UA', () => {
  // Spot-check assertions — verify the CLDR rule cases that matter most for
  // the demo (one / few / many on canonical small numbers + the n=21 case
  // that catches naive (n === 1) implementations).
  it('RU foundTrucks: 1 → "1 машина" (one)', () => {
    expect(formatPlural(RU_TEMPLATES['fleet.foundTrucks'], 1, 'ru')).toBe('1 машина');
  });
  it('RU foundTrucks: 2 → "2 машины" (few)', () => {
    expect(formatPlural(RU_TEMPLATES['fleet.foundTrucks'], 2, 'ru')).toBe('2 машины');
  });
  it('RU foundTrucks: 5 → "5 машин" (many)', () => {
    expect(formatPlural(RU_TEMPLATES['fleet.foundTrucks'], 5, 'ru')).toBe('5 машин');
  });
  it('RU foundTrucks: 21 → "21 машина" (one, per CLDR rule for tens+1)', () => {
    expect(formatPlural(RU_TEMPLATES['fleet.foundTrucks'], 21, 'ru')).toBe('21 машина');
  });
  it('RU foundTrucks: 25 → "25 машин" (many)', () => {
    expect(formatPlural(RU_TEMPLATES['fleet.foundTrucks'], 25, 'ru')).toBe('25 машин');
  });

  it('UA foundTrucks: 1 → "1 машина" (one)', () => {
    expect(formatPlural(UA_TEMPLATES['fleet.foundTrucks'], 1, 'ua')).toBe('1 машина');
  });
  it('UA foundTrucks: 2 → "2 машини" (few)', () => {
    expect(formatPlural(UA_TEMPLATES['fleet.foundTrucks'], 2, 'ua')).toBe('2 машини');
  });
  it('UA foundTrucks: 21 → "21 машина" (one, via "uk-UA" CLDR locale — boundary mapping check)', () => {
    expect(formatPlural(UA_TEMPLATES['fleet.foundTrucks'], 21, 'ua')).toBe('21 машина');
  });

  // RU kpi.orders / kpi.messages / quote.tons spot-checks
  it('RU kpi.orders: 1 → "1 заказ"', () => {
    expect(formatPlural(RU_TEMPLATES['kpi.orders'], 1, 'ru')).toBe('1 заказ');
  });
  it('RU kpi.orders: 5 → "5 заказов"', () => {
    expect(formatPlural(RU_TEMPLATES['kpi.orders'], 5, 'ru')).toBe('5 заказов');
  });
  it('RU kpi.messages: 1 → "1 сообщение"', () => {
    expect(formatPlural(RU_TEMPLATES['kpi.messages'], 1, 'ru')).toBe('1 сообщение');
  });
  it('RU kpi.messages: 5 → "5 сообщений"', () => {
    expect(formatPlural(RU_TEMPLATES['kpi.messages'], 5, 'ru')).toBe('5 сообщений');
  });
  it('RU quote.tons: 21 → "21 тонна" (one form for tens+1)', () => {
    expect(formatPlural(RU_TEMPLATES['quote.tons'], 21, 'ru')).toBe('21 тонна');
  });

  // UA spot-checks
  it('UA kpi.calls: 1 → "1 дзвінок"', () => {
    expect(formatPlural(UA_TEMPLATES['kpi.calls'], 1, 'ua')).toBe('1 дзвінок');
  });
  it('UA kpi.calls: 5 → "5 дзвінків"', () => {
    expect(formatPlural(UA_TEMPLATES['kpi.calls'], 5, 'ua')).toBe('5 дзвінків');
  });
  it('UA kpi.orders: 1 → "1 замовлення" (UA has uniform "замовлення" for one + few)', () => {
    expect(formatPlural(UA_TEMPLATES['kpi.orders'], 1, 'ua')).toBe('1 замовлення');
  });

  // Coverage: every (template, n, lang) combo must render without throwing
  // AND must shape to `<n> <Cyrillic-word>`.
  for (const [tplKey, tpl] of Object.entries(RU_TEMPLATES)) {
    for (const n of N_VALUES) {
      it(`RU ${tplKey} n=${n} formats without throwing`, () => {
        const out = formatPlural(tpl, n, 'ru');
        expect(out).toMatch(new RegExp(`^${n}\\s+[А-Яа-яЁё]+$`));
      });
    }
  }
  for (const [tplKey, tpl] of Object.entries(UA_TEMPLATES)) {
    for (const n of N_VALUES) {
      it(`UA ${tplKey} n=${n} formats without throwing`, () => {
        const out = formatPlural(tpl, n, 'ua');
        expect(out).toMatch(new RegExp(`^${n}\\s+[А-Яа-яІіЇїЄєҐґ]+$`));
      });
    }
  }
});
