// Phase 2 Plan 02-01 Task 2 — money helpers.
// CONTEXT D-27 — roundTo50Rubles half-up boundary cases.

import { describe, expect, it } from 'vitest';
import { formatPriceKop, roundTo50Rubles } from '../../src/lib/money.js';

describe('roundTo50Rubles', () => {
  it.each<[bigint, bigint]>([
    [0n, 0n],
    [2499n, 0n], // half-up boundary: below half-step floors
    [2500n, 5000n], // exactly half-step rounds up
    [4999n, 5000n],
    [5000n, 5000n], // exact multiple
    [5001n, 5000n], // below next half-step (7500)
    [7499n, 5000n],
    [7500n, 10000n],
    [12500n, 15000n],
    [2380000n, 2380000n], // 23 800 RUB already a multiple of 50
    [2383499n, 2385000n], // 23 834.99 RUB → 23 850 RUB
  ])('roundTo50Rubles(%s) === %s', (input, expected) => {
    expect(roundTo50Rubles(input)).toBe(expected);
  });
});

describe('formatPriceKop', () => {
  it('formats 23,800 RUB (2380000 kopecks) in ru-RU with NBSP separator', () => {
    const out = formatPriceKop(2380000n, 'ru');
    // Strip any spacing chars (NBSP, narrow NBSP, regular) before matching digits.
    const digitsOnly = out.replace(/\s| | /g, '');
    expect(digitsOnly).toBe('23800');
  });

  it('formats 23,800 RUB in uk-UA with NBSP separator', () => {
    const out = formatPriceKop(2380000n, 'ua');
    const digitsOnly = out.replace(/\s| | /g, '');
    expect(digitsOnly).toBe('23800');
  });

  it('formats 100 RUB (10000 kopecks)', () => {
    const out = formatPriceKop(10000n, 'ru');
    expect(out.replace(/\s| | /g, '')).toBe('100');
  });

  it('handles large amounts (1,000,000 RUB)', () => {
    const out = formatPriceKop(100_000_000n, 'ru');
    expect(out.replace(/\s| | /g, '')).toBe('1000000');
  });
});
