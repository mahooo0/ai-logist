// Phase 6 Wave 1 — live tests for renderPhase6Template.
// Decision: D-06
// Plan: 06-01 Wave 1
import { describe, it, expect } from 'vitest';
import { renderPhase6Template, type Phase6Transition } from '../../src/lib/i18n.js';

const ALL_KEYS: Phase6Transition[] = [
  'truck_approaching_pickup',
  'confirm_loading',
  'truck_approaching_delivery',
  'confirm_delivery',
  'payment_link',
  'payment_received',
  'payment_unavailable',
];

describe('i18n-phase6', () => {
  it('D-06 renderPhase6Template returns non-empty string for all 14 combinations (7 keys × 2 langs)', () => {
    for (const key of ALL_KEYS) {
      for (const lang of ['ru', 'ua'] as const) {
        const result = renderPhase6Template(key, { number: 'KU-TEST' }, lang);
        expect(result, `key=${key} lang=${lang}`).toBeTruthy();
        expect(result, `key=${key} lang=${lang}`).not.toBeUndefined();
      }
    }
  });

  it('truck_approaching_pickup RU renders with order number', () => {
    const result = renderPhase6Template('truck_approaching_pickup', { number: 'KU-X' }, 'ru');
    expect(result).toBe('🚚 Машина подъезжает к точке загрузки. Заказ KU-X.');
  });

  it('confirm_loading UA renders with order number', () => {
    const result = renderPhase6Template('confirm_loading', { number: 'KU-X' }, 'ua');
    expect(result).toBe('🚚 Машина прибула на завантаження. Замовлення KU-X. Підтвердіть, що вантаж завантажено.');
  });

  it('payment_link RU contains the payment_url when provided', () => {
    const result = renderPhase6Template(
      'payment_link',
      { number: 'KU-X', payment_url: 'https://stripe.example' },
      'ru'
    );
    expect(result).toContain('https://stripe.example');
  });

  it('payment_link renders em-dash when payment_url is null', () => {
    const result = renderPhase6Template(
      'payment_link',
      { number: 'KU-X', payment_url: null },
      'ru'
    );
    expect(result).toContain('—');
  });

  it('payment_link renders em-dash when payment_url is undefined', () => {
    const result = renderPhase6Template(
      'payment_link',
      { number: 'KU-X' },
      'ua'
    );
    expect(result).toContain('—');
  });

  it('payment_unavailable UA renders fail-safe message (B2)', () => {
    const result = renderPhase6Template('payment_unavailable', { number: 'KU-X' }, 'ua');
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(10);
  });

  it('payment_unavailable RU renders fail-safe message (B2)', () => {
    const result = renderPhase6Template('payment_unavailable', { number: 'KU-X' }, 'ru');
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(10);
  });
});
