// Phase 2 Plan 02-02 Task 2 — calcPrice unit tests (MATCH-03, MATCH-05).
//
// Pure-function tests — no DB, no LLM. Determinism is verified through:
//   1. Fixed PricingConfig (rate=4200 kopecks, dir.default=1.0, dir.back_haul=0.85,
//      season=1.0). Mirrors seed data in apps/api/src/seed/data/pricing.json
//      with season=1.0 instead of 1.1 to keep the snapshot byte-stable independent
//      of the live seed value (which a future plan may tune).
//   2. Snapshot of 6 outputs.
//   3. Direct corridor assertions: min = roundTo50(default × 0.85),
//      max = roundTo50(default × 1.15).
//
// Repeated via `pnpm test:snapshot` (10× bash loop; vitest 4 dropped --repeat=N).

import { describe, expect, it } from 'vitest';
import { roundTo50Rubles } from '../../src/lib/money.js';
import {
  type CalcPriceInput,
  calcPrice,
  type PricingConfig,
} from '../../src/pipeline/llm-tools/calc-price.js';
import { FIXED_NOW } from '../_helpers/fake-timers.js';

const FIXED_CONFIG: PricingConfig = {
  rate_per_km_kopecks: 4200n,
  dir_coef: { default: 1.0, back_haul: 0.85 },
  season_coef: () => 1.0,
};

const CASE_01: { id: string; input: CalcPriceInput } = {
  id: 'case-01-540km-18t-tent-default',
  input: { route_km: 540, tons: 18, bodyType: 'tent', date: FIXED_NOW, direction: 'default' },
};
const CASE_02: { id: string; input: CalcPriceInput } = {
  id: 'case-02-540km-18t-ref-backhaul',
  input: { route_km: 540, tons: 18, bodyType: 'ref', date: FIXED_NOW, direction: 'back_haul' },
};
const CASE_03: { id: string; input: CalcPriceInput } = {
  id: 'case-03-1200km-20t-container-default',
  input: { route_km: 1200, tons: 20, bodyType: 'container', date: FIXED_NOW, direction: 'default' },
};
const CASE_04: { id: string; input: CalcPriceInput } = {
  id: 'case-04-100km-5t-iso-default',
  input: { route_km: 100, tons: 5, bodyType: 'iso', date: FIXED_NOW, direction: 'default' },
};
const CASE_05: { id: string; input: CalcPriceInput } = {
  id: 'case-05-0p5km-1t-tent-default',
  input: { route_km: 0.5, tons: 1, bodyType: 'tent', date: FIXED_NOW, direction: 'default' },
};
const CASE_06: { id: string; input: CalcPriceInput } = {
  id: 'case-06-2000km-25t-tent-default',
  input: { route_km: 2000, tons: 25, bodyType: 'tent', date: FIXED_NOW, direction: 'default' },
};
const CASES = [CASE_01, CASE_02, CASE_03, CASE_04, CASE_05, CASE_06];

describe('calcPrice — pure deterministic price (MATCH-03)', () => {
  it('case-01: 540 km × 18t × tent × default → 2 270 000 kopecks (22 700 RUB, round-50)', () => {
    const out = calcPrice(CASE_01.input, FIXED_CONFIG);
    // 540 × 4200 = 2_268_000 kopecks; default coef 1.0; season 1.0 → 2_268_000.
    // roundTo50Rubles(2_268_000) → 2_270_000 (nearest multiple of 5_000).
    expect(out.default).toBe(2_270_000n);
  });

  it('case-02: 540 km × 18t × ref × back_haul → discount of 15% off base', () => {
    const out = calcPrice(CASE_02.input, FIXED_CONFIG);
    // 540 × 4200 = 2_268_000; back_haul 0.85; season 1.0 → 1_927_800 → round50 → 1_930_000.
    expect(out.default).toBe(1_930_000n);
  });

  it('case-04: tiny route 100 km × 5t → 420_000 kopecks', () => {
    const out = calcPrice(CASE_04.input, FIXED_CONFIG);
    // 100 × 4200 = 420_000; default coef 1.0; season 1.0 → 420_000 (already multiple of 5_000).
    expect(out.default).toBe(420_000n);
  });

  it('case-05: edge case 0.5 km → rounds to nearest 50 RUB (5000 kop)', () => {
    const out = calcPrice(CASE_05.input, FIXED_CONFIG);
    // 0.5 × 4200 = 2100; roundTo50Rubles(2100) → 0 (below half-step 2500).
    expect(out.default).toBe(0n);
  });
});

describe('calcPrice — corridor invariants (MATCH-05)', () => {
  it('min = roundTo50(default × 0.85) for case-01', () => {
    const out = calcPrice(CASE_01.input, FIXED_CONFIG);
    // 2_268_000 × 0.85 = 1_927_800 → round50 → 1_930_000
    const expectedMin = roundTo50Rubles(BigInt(Math.round(Number(2_268_000n) * 0.85)));
    expect(out.min).toBe(expectedMin);
  });

  it('max = roundTo50(default × 1.15) for case-01', () => {
    const out = calcPrice(CASE_01.input, FIXED_CONFIG);
    const expectedMax = roundTo50Rubles(BigInt(Math.round(Number(2_268_000n) * 1.15)));
    expect(out.max).toBe(expectedMax);
  });

  it('min < default < max for every non-degenerate case', () => {
    for (const c of CASES.filter((c) => c.input.route_km >= 10)) {
      const out = calcPrice(c.input, FIXED_CONFIG);
      expect(out.min).toBeLessThanOrEqual(out.default);
      expect(out.default).toBeLessThanOrEqual(out.max);
    }
  });
});

describe('calcPrice — determinism (10× repeat-safe via test:snapshot)', () => {
  it('snapshot: 6 calcPrice outputs byte-stable', () => {
    const results: Record<string, unknown> = {};
    for (const c of CASES) {
      const out = calcPrice(c.input, FIXED_CONFIG);
      // bigint → string for snapshot serialisation determinism.
      results[c.id] = {
        default: out.default.toString(),
        min: out.min.toString(),
        max: out.max.toString(),
        breakdown: {
          base_kopecks: out.breakdown.base_kopecks.toString(),
          dir_factor: out.breakdown.dir_factor,
          season_factor: out.breakdown.season_factor,
        },
      };
    }
    expect(results).toMatchSnapshot();
  });

  it('two calls with the same input produce equal outputs', () => {
    const a = calcPrice(CASE_01.input, FIXED_CONFIG);
    const b = calcPrice(CASE_01.input, FIXED_CONFIG);
    expect(a.default).toBe(b.default);
    expect(a.min).toBe(b.min);
    expect(a.max).toBe(b.max);
  });
});
