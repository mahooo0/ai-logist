// Phase 3 Plan 03-03 — TG-03 + TG-04 keyboard + quote-card coverage.
//
// Pure unit-style assertion of `quoteKeyboard` shape + `formatQuoteMessage`
// invariants. The "keyboard is actually sent after intake reaches QUOTED" claim
// is covered end-to-end by Plan 03-05's final flow. Splitting unit-style
// assertion here keeps Wave 3 fast and isolates the price-from-DB invariant
// without the testcontainers PG cold-start cost.

import { describe, expect, it } from 'vitest';
import {
  driverKeyboard,
  formatQuoteMessage,
  quoteKeyboard,
} from '../../src/channels/telegram/keyboards.js';

describe('telegram inline keyboards (TG-03, TG-04)', () => {
  it('quoteKeyboard renders 3 RU buttons with callback_data "<action>:<leadId>"', () => {
    const kbd = quoteKeyboard('lead-001', 'ru');
    // grammY InlineKeyboard wraps an `inline_keyboard` field — flat array of
    // rows; each row is an array of button objects with `text` + `callback_data`.
    const rows = (
      kbd as unknown as { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> }
    ).inline_keyboard;
    expect(rows.length).toBe(2); // [confirm, reject] then [change]
    expect(rows[0]?.length).toBe(2);
    expect(rows[1]?.length).toBe(1);

    expect(rows[0]?.[0]?.text).toContain('Подтвердить рейс');
    expect(rows[0]?.[0]?.callback_data).toBe('confirm:lead-001');
    expect(rows[0]?.[1]?.text).toContain('Отказаться');
    expect(rows[0]?.[1]?.callback_data).toBe('reject:lead-001');
    expect(rows[1]?.[0]?.text).toContain('Изменить условия');
    expect(rows[1]?.[0]?.callback_data).toBe('change:lead-001');
  });

  it('quoteKeyboard renders UA labels when lang=ua', () => {
    const kbd = quoteKeyboard('lead-ua', 'ua');
    const rows = (
      kbd as unknown as { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> }
    ).inline_keyboard;
    expect(rows[0]?.[0]?.text).toContain('Підтвердити');
    expect(rows[0]?.[1]?.text).toContain('Відмова');
    expect(rows[1]?.[0]?.text).toContain('Змінити');
    // Callback data NEVER translates — action tokens stay English.
    expect(rows[0]?.[0]?.callback_data).toBe('confirm:lead-ua');
  });

  it('driverKeyboard renders accept/decline with driver_ prefix (Wave 4 ready)', () => {
    const kbd = driverKeyboard('order-001', 'ru');
    const rows = (
      kbd as unknown as { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> }
    ).inline_keyboard;
    expect(rows[0]?.[0]?.callback_data).toBe('driver_accept:order-001');
    expect(rows[0]?.[1]?.callback_data).toBe('driver_decline:order-001');
  });

  it('formatQuoteMessage substitutes price from DB (not LLM) — RU', () => {
    const text = formatQuoteMessage({
      lead: { fromCityId: null, toCityId: null, tons: '18' },
      quotedPriceKop: 4_200_000n, // 42000 RUB
      lang: 'ru',
      fromCityName: 'Киев',
      toCityName: 'Львов',
    });
    expect(text).toContain('Предложение рейса');
    expect(text).toContain('Киев');
    expect(text).toContain('Львов');
    expect(text).toContain('18 т');
    // ru-RU formatter produces NBSP between digit groups — the exact number is
    // produced by Intl.NumberFormat. Assert presence of "42" and the ₽ symbol.
    expect(text).toMatch(/42[\s ]?000/);
    expect(text).toContain('₽');
  });

  it('formatQuoteMessage uses UA labels and template when lang=ua', () => {
    const text = formatQuoteMessage({
      lead: { fromCityId: null, toCityId: null, tons: '22' },
      quotedPriceKop: 6_500_000n,
      lang: 'ua',
      fromCityName: 'Київ',
      toCityName: 'Львів',
    });
    expect(text).toContain('Пропозиція рейсу');
    expect(text).toContain('Маршрут: Київ → Львів');
    expect(text).toContain('22 т');
    expect(text).toContain('₽');
  });

  it('formatQuoteMessage falls back to em-dash when city names absent', () => {
    const text = formatQuoteMessage({
      lead: { fromCityId: null, toCityId: null, tons: null },
      quotedPriceKop: 1_000_000n,
      lang: 'ru',
    });
    expect(text).toContain('Маршрут: — → —');
    expect(text).toContain('Груз: — т');
  });
});
