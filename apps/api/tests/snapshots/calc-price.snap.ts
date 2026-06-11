// Phase 5 Plan 05-03 — POLISH-01 calcPrice byte-stable snapshots.
//
// 10 deterministic combos sampled across (route_km × tons × bodyType × direction)
// per CONTEXT D-20. Pure-function snapshot — no DB or LLM dependencies.
//
// FIXED_NOW (from tests/_helpers/fake-timers.ts) replaces wall-clock so season_coef
// receives a frozen date. FIXED_CONFIG mirrors the seed values in
// apps/api/src/seed/data/pricing.json (rate=4200 kop/km, dir.default=1.0,
// dir.back_haul=0.85) with season=1.0 to keep snapshots independent of any future
// pricing tweaks (Pitfall §3 — strip all non-determinism).
//
// BigInt → toString() per Pitfall §3 to keep snapshot output JSON-serialisable.
// Run 10× via `pnpm --filter @ai-logist/api test:snapshot`.

import { describe, expect, it } from 'vitest';
import {
  calcPrice,
  type CalcPriceInput,
  type PricingConfig,
} from '../../src/pipeline/llm-tools/calc-price.js';
import { FIXED_NOW } from '../_helpers/fake-timers.js';

const FIXED_CONFIG: PricingConfig = {
  rate_per_km_kopecks: 4200n,
  dir_coef: { default: 1.0, back_haul: 0.85 },
  season_coef: () => 1.0,
};

interface Case {
  id: string;
  input: CalcPriceInput;
}

// 10 cases per CONTEXT D-20 — sampled across route × tons × body × direction.
const CASES: Case[] = [
  {
    id: '540km-18t-tent-default',
    input: { route_km: 540, tons: 18, bodyType: 'tent', date: FIXED_NOW, direction: 'default' },
  },
  {
    id: '540km-18t-ref-backhaul',
    input: { route_km: 540, tons: 18, bodyType: 'ref', date: FIXED_NOW, direction: 'back_haul' },
  },
  {
    id: '1200km-20t-container-default',
    input: {
      route_km: 1200,
      tons: 20,
      bodyType: 'container',
      date: FIXED_NOW,
      direction: 'default',
    },
  },
  {
    id: '100km-5t-iso-default',
    input: { route_km: 100, tons: 5, bodyType: 'iso', date: FIXED_NOW, direction: 'default' },
  },
  {
    id: '0.5km-1t-tent-default',
    input: { route_km: 0.5, tons: 1, bodyType: 'tent', date: FIXED_NOW, direction: 'default' },
  },
  {
    id: '2000km-25t-tent-default',
    input: { route_km: 2000, tons: 25, bodyType: 'tent', date: FIXED_NOW, direction: 'default' },
  },
  {
    id: '300km-10t-tent-default',
    input: { route_km: 300, tons: 10, bodyType: 'tent', date: FIXED_NOW, direction: 'default' },
  },
  {
    id: '800km-15t-ref-default',
    input: { route_km: 800, tons: 15, bodyType: 'ref', date: FIXED_NOW, direction: 'default' },
  },
  {
    id: '450km-12t-iso-backhaul',
    input: { route_km: 450, tons: 12, bodyType: 'iso', date: FIXED_NOW, direction: 'back_haul' },
  },
  {
    id: '1500km-22t-container-default',
    input: {
      route_km: 1500,
      tons: 22,
      bodyType: 'container',
      date: FIXED_NOW,
      direction: 'default',
    },
  },
];

describe('snapshot: calcPrice — POLISH-01 byte stability', () => {
  for (const c of CASES) {
    it(`case ${c.id}`, () => {
      const out = calcPrice(c.input, FIXED_CONFIG);
      // BigInt → string per Pitfall §3 (JSON-serializable, byte-stable).
      // Snapshot only deterministic fields (no Date.now(), no UUIDs).
      expect({
        id: c.id,
        default: out.default.toString(),
        min: out.min.toString(),
        max: out.max.toString(),
        breakdown: {
          base_kopecks: out.breakdown.base_kopecks.toString(),
          dir_factor: out.breakdown.dir_factor,
          season_factor: out.breakdown.season_factor,
        },
      }).toMatchSnapshot();
    });
  }
});
