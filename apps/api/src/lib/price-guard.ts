// Phase 2 Plan 02-01 Task 2 — price-guard regex check (D-25 protocol step 4).
// MATCH-06. Catches any RU/UA-formatted number in the LLM-generated reply and
// verifies it equals quoted_price (or falls within [min, max] corridor).
//
// Source: 02-RESEARCH.md §15 (verbatim).

// Matches:
//   "23 800" (NBSP or space), "23,800", "23.800", "23800"
//   With optional currency suffix: руб, ₽, грн, ₴, UAH, RUB.
//   Informal "тыс / тыс." multiplier.
// The character class includes both NBSP (U+00A0) and regular space.
const PRICE_PATTERN =
  /\b(\d{1,3}(?:[  .,]\d{3})+|\d{4,7})(?:[  ]?(?:руб|₽|грн|₴|UAH|RUB))?(?:[  ]?тыс\.?)?\b/giu;

export interface PriceGuardArgs {
  llmText: string;
  quotedPriceKop: bigint;
  minKop: bigint;
  maxKop: bigint;
}

export interface PriceGuardResult {
  ok: boolean;
  /** Numbers (in rubles) found in the LLM text that did not equal quoted_price and were outside [min, max]. */
  badNumbers: number[];
  /** All numbers extracted (for logging). */
  found: number[];
}

/**
 * Verify LLM-generated text contains no rogue price numbers.
 *
 * A number is "bad" if it is NOT equal to expected rubles AND not inside [minRub, maxRub].
 * Numbers below 100 are ignored (filters out tonnages, km, dates).
 */
export function priceGuard({
  llmText,
  quotedPriceKop,
  minKop,
  maxKop,
}: PriceGuardArgs): PriceGuardResult {
  const expectedRub = Number(quotedPriceKop / 100n);
  const minRub = Number(minKop / 100n);
  const maxRub = Number(maxKop / 100n);

  const found: number[] = [];
  const badNumbers: number[] = [];

  for (const match of llmText.matchAll(PRICE_PATTERN)) {
    const captured = match[1];
    if (captured === undefined) continue;
    // Strip NBSP, regular space, dot, comma → raw digits.
    const raw = captured.replace(/[  .,]/g, '');
    let n = Number(raw);
    if (/тыс/i.test(match[0])) n *= 1000;
    if (!Number.isFinite(n) || n < 100) continue; // ignore tonnage, km, dates
    found.push(n);
    if (n !== expectedRub && (n < minRub || n > maxRub)) {
      badNumbers.push(n);
    }
  }
  return { ok: badNumbers.length === 0, badNumbers, found };
}
