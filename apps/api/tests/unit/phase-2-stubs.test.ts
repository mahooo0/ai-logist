import { readFile } from 'node:fs/promises';
import { describe, expect, it, test } from 'vitest';
import { filterBourseStub } from '../../src/lib/bourse-stub.js';
import { cyrillicHeuristic, detectLang } from '../../src/lib/lang-detect.js';
import { priceGuard } from '../../src/lib/price-guard.js';
import { clearRouteCache, routeKm } from '../../src/lib/routing.js';
import { leadEventsRepo } from '../../src/persistence/repos/index.js';
import { VersionMismatch } from '../../src/pipeline/lifecycle/errors.js';
import { LEAD_TRANSITIONS } from '../../src/pipeline/lifecycle/lead-fsm.js';
import { ORDER_TRANSITIONS } from '../../src/pipeline/lifecycle/order-fsm.js';
import { calcPrice } from '../../src/pipeline/llm-tools/calc-price.js';
import { ExtractRequestSchema } from '../../src/pipeline/llm-tools/extract-request.js';

/**
 * Phase 2 acceptance criteria stubs.
 *
 * Initial set: 18 placeholder markers (one per Phase 2 requirement ID covered by
 * 02-VALIDATION.md: API-07, LOGIC-01..05, MATCH-01..06, FSM-01..06).
 *
 * Flip-down schedule:
 *   Plan 02-01 (Wave 1):  LOGIC-02, MATCH-02, MATCH-04, MATCH-06           — 4 flipped, 14 remain.
 *   Plan 02-03b (Wave 2): LOGIC-01, LOGIC-05, MATCH-01, MATCH-03, MATCH-05,
 *                         FSM-01, FSM-02, FSM-03, FSM-05                   — 9 flipped, 5 remain.
 *   Plan 02-04a (Wave 3): LOGIC-03, LOGIC-04                                — 2 flipped, 3 remain.
 *   Plan 02-04b (Wave 3): FSM-04, FSM-06                                    — 2 flipped, 1 remains.
 *   Plan 02-05  (Wave 4): API-07                                            — 1 flipped, 0 remain.
 *
 * Counting protocol: the verifier greps for `test` + `.` + `todo` literal call-sites;
 * this file MUST contain exactly 5 such call-sites after Plan 02-03b, 3 after Plan 02-04a,
 * and 1 after Plan 02-04b (only API-07 remains for Plan 02-05).
 * 02-VALIDATION.md "Per-Task Verification Map" depends on this exact count.
 */
describe('Phase 2 acceptance criteria', () => {
  // LOGIC-01 — extractRequest via Anthropic betaZodTool (FLIPPED in Plan 02-03b)
  it('LOGIC-01: extractRequest parses canonical inputs into ExtractRequestOutput', () => {
    const valid = {
      from_city: 'Киев',
      to_city: 'Львов',
      tons: 18,
      body_type: 'tent' as const,
      budget_kopecks: null,
      deadline_iso: null,
      confidence: { from_city: 1, to_city: 1, tons: 1 },
      clarifying_question_ru: null,
      clarifying_question_ua: null,
    };
    const parsed = ExtractRequestSchema.parse(valid);
    expect(parsed.from_city).toBe('Киев');
    expect(parsed.confidence.tons).toBe(1);
  });
  // LOGIC-02 — sticky lang detection (FLIPPED in Plan 02-01)
  it('LOGIC-02: Cyrillic UA-markers → "ua"; default → "ru"; <20 chars → no detect', async () => {
    // UA marker → ua via cheap heuristic, no LLM call.
    const uaHit = cyrillicHeuristic('Київ-Львів 18т');
    expect(uaHit?.lang).toBe('ua');
    expect(uaHit?.confidence).toBe(1.0);

    // No UA marker → heuristic returns null.
    expect(cyrillicHeuristic('Киев-Львов 18т')).toBeNull();

    // <20 chars → default ru, no LLM call attempted.
    const llmDetect = async () => ({ lang: 'ua' as const, confidence: 1.0 });
    const short = await detectLang('ок', llmDetect);
    expect(short.lang).toBe('ru');
    expect(short.source).toBe('default');

    // Long Cyrillic with UA marker → heuristic wins.
    const long = await detectLang('Поїхали Київ-Львів 18 тонн груз', llmDetect);
    expect(long.lang).toBe('ua');
    expect(long.source).toBe('cyrillic_heuristic');
  });
  // LOGIC-03 — city normalization (FLIPPED in Plan 02-04a)
  it('LOGIC-03: cities ILIKE + Nominatim fallback + citiesRepo.upsert wired in intake.ts', async () => {
    const src = await readFile('src/pipeline/intake.ts', 'utf8');
    expect(src).toMatch(/name_ru ILIKE.*name_ua ILIKE|name_ru ILIKE[\s\S]*name_ua ILIKE/);
    expect(src).toMatch(/geocode\(/);
    expect(src).toMatch(/citiesRepo\.upsert/);
    // Full coverage: tests/integration/pipeline-sticky-lang.test.ts exercises the
    // local-hit path end-to-end via Київ-Львів resolution.
  });
  // LOGIC-04 — clarification budget = 2 (FLIPPED in Plan 02-04a)
  it('LOGIC-04: clarification budget enforced via countClarificationRounds', async () => {
    const src = await readFile('src/pipeline/intake.ts', 'utf8');
    expect(src).toMatch(/countClarificationRounds/);
    expect(src).toMatch(/clarifyCount >= 2/);
    expect(src).toMatch(/clarifying_question_(ru|ua)/);
  });
  // LOGIC-05 — strict JSON, unknown fields rejected (FLIPPED in Plan 02-03b)
  it('LOGIC-05: malformed LLM output → strict schema rejects unknown fields', () => {
    const withExtra = {
      from_city: 'Киев',
      to_city: 'Львов',
      tons: 18,
      body_type: 'tent' as const,
      budget_kopecks: null,
      deadline_iso: null,
      confidence: { from_city: 1, to_city: 1, tons: 1 },
      clarifying_question_ru: null,
      clarifying_question_ua: null,
      manager_override: true, // injection attempt — must be rejected by .strict()
    };
    expect(() => ExtractRequestSchema.strict().parse(withExtra)).toThrow();
  });
  // MATCH-01 — KNN CTE re-rank (FLIPPED in Plan 02-03b — sanity source grep; full EXPLAIN in tests/integration/nearest-truck-knn.test.ts)
  it('MATCH-01: nearestTruck source contains CTE re-rank pattern (geom <-> + spheroid)', async () => {
    const src = await readFile('src/pipeline/llm-tools/nearest-truck.ts', 'utf8');
    expect(src).toMatch(/ORDER BY[\s\S]*geom[\s\S]*<->/);
    expect(src).toMatch(/ST_Distance[\s\S]*true/);
    expect(src).toMatch(/status = 'available'/);
    // EXPLAIN ANALYZE assertion lives in tests/integration/nearest-truck-knn.test.ts
  });
  // MATCH-02 — bourse stub fallback (FLIPPED in Plan 02-01 — filter-logic-only; DB write covered in Wave 2 integration)
  it('MATCH-02: bourse-stub.json filters by tons + body_type', () => {
    // tons=18, body=tent → only trucks with capacity_t ≥ 18 AND body_type='tent'.
    const tents = filterBourseStub({ tons: 18, bodyType: 'tent' });
    expect(tents.length).toBeGreaterThan(0);
    for (const t of tents) {
      expect(t.body_type).toBe('tent');
      expect(t.capacity_t).toBeGreaterThanOrEqual(18);
    }

    // tons=22, bodyType=null → any body_type, capacity ≥ 22.
    const heavy = filterBourseStub({ tons: 22, bodyType: null });
    for (const t of heavy) {
      expect(t.capacity_t).toBeGreaterThanOrEqual(22);
    }

    // tons=100 → no candidate fits → empty array.
    expect(filterBourseStub({ tons: 100, bodyType: null })).toEqual([]);

    // Returns at most 3.
    expect(filterBourseStub({ tons: 1, bodyType: null }).length).toBeLessThanOrEqual(3);
  });
  // MATCH-03 — deterministic calcPrice (FLIPPED in Plan 02-03b)
  it('MATCH-03: calcPrice deterministic kopecks output', () => {
    const cfg = {
      rate_per_km_kopecks: 4200n,
      dir_coef: { default: 1.0, back_haul: 0.85 },
      season_coef: () => 1.0,
    };
    const a = calcPrice(
      {
        route_km: 540,
        tons: 18,
        bodyType: 'tent',
        date: new Date('2026-06-09'),
        direction: 'default',
      },
      cfg
    );
    const b = calcPrice(
      {
        route_km: 540,
        tons: 18,
        bodyType: 'tent',
        date: new Date('2026-06-09'),
        direction: 'default',
      },
      cfg
    );
    expect(a.default).toBe(b.default);
    expect(a.default > 0n).toBe(true);
  });
  // MATCH-04 — OSRM + haversine fallback (FLIPPED in Plan 02-01)
  it('MATCH-04: routeKm uses OSRM; on timeout falls back to haversine × 1.3', async () => {
    const { vi } = await import('vitest');
    clearRouteCache();
    // OSRM Ok response — distance 540_000m → 540 km.
    const okFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 'Ok', routes: [{ distance: 540_000, duration: 25_000 }] }),
    });
    vi.stubGlobal('fetch', okFetch);
    const ok = await routeKm({ lon: 30.5234, lat: 50.4501 }, { lon: 24.0297, lat: 49.8397 });
    expect(ok.source).toBe('osrm');
    expect(ok.route_km).toBe(540);
    vi.unstubAllGlobals();
    clearRouteCache();

    // Timeout → haversine fallback. AbortError name triggers the catch.
    const errFetch = vi.fn().mockImplementation(() => {
      const e = new Error('aborted');
      e.name = 'AbortError';
      throw e;
    });
    vi.stubGlobal('fetch', errFetch);
    const fallback = await routeKm(
      { lon: 30.5234, lat: 50.4501 },
      { lon: 24.0297, lat: 49.8397 },
      { warn: () => {} }
    );
    expect(fallback.source).toBe('haversine_fallback');
    vi.unstubAllGlobals();
  });
  // MATCH-05 — corridor min/max (FLIPPED in Plan 02-03b)
  it('MATCH-05: calcPrice returns {min, default, max} with × 0.85 / × 1.15', () => {
    const cfg = {
      rate_per_km_kopecks: 4200n,
      dir_coef: { default: 1.0, back_haul: 0.85 },
      season_coef: () => 1.0,
    };
    const out = calcPrice(
      {
        route_km: 540,
        tons: 18,
        bodyType: 'tent',
        date: new Date('2026-06-09'),
        direction: 'default',
      },
      cfg
    );
    expect(out.min).toBeLessThan(out.default);
    expect(out.max).toBeGreaterThan(out.default);
    // Corridor ratio sanity — min/default ≈ 0.85; max/default ≈ 1.15 (allow ±0.01 for roundTo50 noise)
    const ratioMin = Number(out.min) / Number(out.default);
    const ratioMax = Number(out.max) / Number(out.default);
    expect(ratioMin).toBeGreaterThanOrEqual(0.84);
    expect(ratioMin).toBeLessThanOrEqual(0.86);
    expect(ratioMax).toBeGreaterThanOrEqual(1.14);
    expect(ratioMax).toBeLessThanOrEqual(1.16);
  });
  // MATCH-06 — price-lock (FLIPPED in Plan 02-01 — guard regex only; DB-write coverage in Wave 3)
  it('MATCH-06: priceGuard rejects rogue numbers and accepts corridor values', () => {
    // Exact quoted price OK.
    const exact = priceGuard({
      llmText: 'Цена 23 800 руб. Подтверждаете?',
      quotedPriceKop: 2_380_000n,
      minKop: 2_023_000n,
      maxKop: 2_737_000n,
    });
    expect(exact.ok).toBe(true);

    // Rogue 4-digit price → flagged (PRICE_PATTERN captures 4-7 raw digits).
    const rogue = priceGuard({
      llmText: 'Особая цена 9999 руб',
      quotedPriceKop: 2_380_000n,
      minKop: 2_023_000n,
      maxKop: 2_737_000n,
    });
    expect(rogue.ok).toBe(false);
    expect(rogue.badNumbers).toContain(9999);

    // In-corridor value accepted (25 000 within [20 000..30 000]).
    const corridor = priceGuard({
      llmText: 'Цена 25 000 ₽',
      quotedPriceKop: 2_380_000n,
      minKop: 2_000_000n,
      maxKop: 3_000_000n,
    });
    expect(corridor.ok).toBe(true);
  });
  // FSM-01 — lead funnel transitions (FLIPPED in Plan 02-03b)
  it('FSM-01: LEAD_TRANSITIONS has exactly 9 stages and table-driven', () => {
    expect(Object.keys(LEAD_TRANSITIONS)).toHaveLength(9);
    expect(LEAD_TRANSITIONS.NEW).toEqual(['QUALIFIED', 'LOST']);
    expect(LEAD_TRANSITIONS.DONE).toEqual([]);
    expect(LEAD_TRANSITIONS.LOST).toEqual([]);
  });
  // FSM-02 — order lifecycle transitions (FLIPPED in Plan 02-03b)
  it('FSM-02: ORDER_TRANSITIONS has exactly 7 statuses and table-driven', () => {
    expect(Object.keys(ORDER_TRANSITIONS)).toHaveLength(7);
    expect(ORDER_TRANSITIONS.CREATED).toEqual(['DRIVER_ASSIGNED']);
    expect(ORDER_TRANSITIONS.CLOSED).toEqual([]);
  });
  // FSM-03 — concurrency (FLIPPED in Plan 02-03b — sanity reference; real 100× proof in tests/integration/fsm-concurrency.test.ts)
  it('FSM-03: VersionMismatch class exported (concurrency proof in integration test)', () => {
    const v = new VersionMismatch('test');
    expect(v.code).toBe('version_mismatch');
    expect(LEAD_TRANSITIONS.QUOTED).toEqual(['AGREED', 'LOST']);
    // Integration coverage: tests/integration/fsm-concurrency.test.ts asserts 100/100 deterministic outcomes.
  });
  // FSM-04 — pg_advisory_xact_lock (FLIPPED in Plan 02-04b)
  it('FSM-04: pg_advisory_xact_lock(hashtext(client_id)) wired in intake.ts', async () => {
    const src = await readFile('src/pipeline/intake.ts', 'utf8');
    expect(src).toMatch(/pg_advisory_xact_lock[\s\S]*hashtext[\s\S]*clientId/);
    // Full coverage: tests/integration/advisory-lock.test.ts proves 10 parallel
    // calls converge to a single lead via the lock.
  });
  // FSM-05 — audit log (FLIPPED in Plan 02-03b — sanity reference; real proof in tests/integration/fsm-events-audit.test.ts)
  it('FSM-05: leadEventsRepo exports appendEvent + listByLead (audit proof in integration test)', () => {
    expect(typeof leadEventsRepo.appendEvent).toBe('function');
    expect(typeof leadEventsRepo.listByLead).toBe('function');
    // Integration coverage: tests/integration/fsm-events-audit.test.ts asserts every transitionLead writes a row.
  });
  // FSM-06 — auto-follow-up scheduler (FLIPPED in Plan 02-04b)
  it('FSM-06: follow-up scheduler exports tick + register with constants', async () => {
    const mod = await import('../../src/pipeline/follow-up-scheduler.js');
    expect(typeof mod.followUpTick).toBe('function');
    expect(typeof mod.registerFollowUpScheduler).toBe('function');
    expect(mod.POLL_INTERVAL_MS).toBe(60_000);
    expect(mod.STALE_THRESHOLD_MS).toBe(24 * 60 * 60 * 1000);
    expect(mod.QUIET_THRESHOLD_MS).toBe(4 * 60 * 60 * 1000);
    // Full coverage: tests/integration/follow-up-scheduler.test.ts uses
    // vi.useFakeTimers + setSystemTime + advanceTimersByTime to drive the
    // setInterval lifecycle and verify clearInterval on app.close().
  });
  // API-07 — leads routes
  test.todo('API-07: POST /api/leads/:id/match and /quote return 200 (not 501)');
});
