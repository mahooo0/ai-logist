// Phase 2 Plan 02-01 Task 2 — money helpers.
// CONTEXT D-27 — round bigint kopecks to nearest 50 RUB (5000 kopecks), half-up.
// Source: 02-RESEARCH.md §5 (verbatim).
//
// All prices are stored as bigint kopecks to avoid float precision drift.
// Boundary semantics: roundTo50Rubles(2499n) === 0n  (2499 < 2500 half-step → floor).
//                     roundTo50Rubles(2500n) === 5000n (>= half-step → ceil up).

/**
 * Round non-negative bigint kopecks to the nearest 50 RUB (5000 kopecks), half-up.
 *
 * @example
 *   roundTo50Rubles(0n)     // 0n
 *   roundTo50Rubles(2499n)  // 0n     — below half-step
 *   roundTo50Rubles(2500n)  // 5000n  — exactly half-step, rounds up
 *   roundTo50Rubles(4999n)  // 5000n
 *   roundTo50Rubles(5001n)  // 5000n  — below next half-step (7500)
 *   roundTo50Rubles(7500n)  // 10000n
 */
export function roundTo50Rubles(kopecks: bigint): bigint {
  const step = 5000n;
  const half = step / 2n; // 2500n
  // Half-up for non-negative kopecks only (prices are never negative).
  return ((kopecks + half) / step) * step;
}

/**
 * Format bigint kopecks → localized integer-ruble string.
 *
 * Locale-aware separators:
 *   - 'ru' → ru-RU formatting (NBSP thousand separator, e.g. "23 800")
 *   - 'ua' → uk-UA formatting (NBSP thousand separator, e.g. "23 800")
 */
export function formatPriceKop(kopecks: bigint, lang: 'ru' | 'ua'): string {
  // Integer rubles — kopecks dropped intentionally for display (prices already rounded to 50 RUB).
  const rubles = Number(kopecks / 100n);
  return new Intl.NumberFormat(lang === 'ua' ? 'uk-UA' : 'ru-RU').format(rubles);
}
