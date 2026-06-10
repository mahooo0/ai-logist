import { describe, expect, it } from 'vitest';
import { dict, type DictKey } from '@/lib/i18n/dict';

describe('Phase 4 I18N-02 — dict structure', () => {
  it('RU + UA dictionaries have IDENTICAL key sets (no orphaned translations)', () => {
    const ruKeys = Object.keys(dict.ru).sort();
    const uaKeys = Object.keys(dict.ua).sort();
    expect(uaKeys).toEqual(ruKeys);
  });

  it("dict.ru['chat.intercept'] returns 'Перехватить'", () => {
    expect(dict.ru['chat.intercept']).toBe('Перехватить');
  });

  it("dict.ua['chat.intercept'] returns 'Перехопити'", () => {
    expect(dict.ua['chat.intercept']).toBe('Перехопити');
  });

  it('contains all 24+ keys from RESEARCH Example 5', () => {
    const required: DictKey[] = [
      'chat.intercept',
      'chat.release',
      'chat.managerMessagePlaceholder',
      'calls.title',
      'calls.filter.outcome',
      'orders.title',
      'orders.col.number',
      'orders.col.client',
      'orders.col.route',
      'orders.col.status',
      'orders.col.price',
      'orders.col.channel',
      'kpi.tile.calls',
      'kpi.tile.telegram',
      'kpi.tile.conversion',
      'kpi.tile.avgCallDuration',
      'kpi.tile.revenue',
      'order.section.client',
      'order.section.route',
      'order.section.truck',
      'order.section.cargo',
      'order.section.timeline',
      'order.breadcrumb.listenCall',
      'order.breadcrumb.openChat',
    ];
    for (const key of required) {
      expect(dict.ru[key]).toBeTypeOf('string');
      expect(dict.ua[key]).toBeTypeOf('string');
    }
  });
});
