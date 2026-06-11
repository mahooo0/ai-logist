import { describe, expect, it } from 'vitest';

import { type BotReplyKey, renderBotReply } from '../../src/lib/i18n.js';

// I18N-01 (Plan 05-02 — Wave 2). Asserts that `renderBotReply` renders every
// BotReplyKey × {ru, ua} pair without throwing AND that the small set of
// parameterised templates substitute their values correctly. Spot-checks the
// D-09 declension-free arrow separator on the `quote-present` template (the
// declension grep guard in `declension-grep.test.ts` adds the negative-grep
// check on the file contents).

const PARAM_FREE_KEYS: readonly BotReplyKey[] = [
  'greeting',
  'clarify-route',
  'clarify-tons',
  'clarify-body-type',
  'confirm-ask',
  'escalate',
  'manager-takeover',
  'manager-handover',
  'budget-exceeded',
] as const;

describe('I18N-01: renderBotReply dictionary', () => {
  for (const key of PARAM_FREE_KEYS) {
    it(`renders RU '${key}' without throwing`, () => {
      const result = renderBotReply(key, {} as never, 'ru');
      expect(result.length).toBeGreaterThan(0);
      // RU output must contain at least one Cyrillic character.
      expect(result).toMatch(/[А-Яа-яЁё]/);
    });

    it(`renders UA '${key}' without throwing`, () => {
      const result = renderBotReply(key, {} as never, 'ua');
      expect(result.length).toBeGreaterThan(0);
      // UA output must contain at least one Cyrillic character (possibly with
      // UA-specific glyphs like і/ї/є/ґ).
      expect(result).toMatch(/[А-Яа-яЁёІіЇїЄєҐґ]/);
    });
  }

  it("renders RU 'quote-present' with parameters and arrow separator", () => {
    const out = renderBotReply(
      'quote-present',
      {
        from: 'Киев',
        to: 'Львов',
        tons: 18,
        bodyType: 'тент',
        price: '22 700',
        currency: 'RUB',
      },
      'ru'
    );
    expect(out).toBe('Маршрут: Киев → Львов, 18т, тент. Цена: 22 700 RUB.');
  });

  it("renders UA 'quote-present' with parameters and arrow separator", () => {
    const out = renderBotReply(
      'quote-present',
      {
        from: 'Київ',
        to: 'Львів',
        tons: 18,
        bodyType: 'тент',
        price: '22 700',
        currency: 'UAH',
      },
      'ua'
    );
    expect(out).toBe('Маршрут: Київ → Львів, 18т, тент. Ціна: 22 700 UAH.');
  });

  it("renders RU 'order-confirmed' with number", () => {
    const out = renderBotReply('order-confirmed', { number: 'KU-4471' }, 'ru');
    expect(out).toBe('Заказ KU-4471 оформлен. Ждите водителя.');
  });

  it("renders UA 'order-confirmed' with number", () => {
    const out = renderBotReply('order-confirmed', { number: 'KU-4471' }, 'ua');
    expect(out).toBe('Замовлення KU-4471 оформлено. Чекайте водія.');
  });
});
