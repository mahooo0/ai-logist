// Phase 2 Plan 02-01 Task 2 — OSRM routing + haversine fallback.
// MATCH-04. Mocks globalThis.fetch.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRouteCache, haversineKm, routeKm } from '../../src/lib/routing.js';

const KYIV = { lon: 30.5234, lat: 50.4501 };
const LVIV = { lon: 24.0297, lat: 49.8397 };

describe('haversineKm', () => {
  it('Kyiv → Lviv ≈ 469 km within ±5 km', () => {
    const km = haversineKm(KYIV, LVIV);
    expect(km).toBeGreaterThan(464);
    expect(km).toBeLessThan(474);
  });

  it('same point → 0 km', () => {
    expect(haversineKm(KYIV, KYIV)).toBe(0);
  });
});

describe('routeKm', () => {
  beforeEach(() => {
    clearRouteCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns osrm source when OSRM responds with Ok', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 'Ok', routes: [{ distance: 540_000, duration: 25_000 }] }),
    });
    vi.stubGlobal('fetch', fakeFetch);

    const r = await routeKm(KYIV, LVIV);
    expect(r.source).toBe('osrm');
    expect(r.route_km).toBe(540);
    expect(r.eta_sec).toBe(25_000);
    expect(fakeFetch).toHaveBeenCalledOnce();
  });

  it('falls back to haversine × 1.3 on AbortError (timeout)', async () => {
    const fakeFetch = vi.fn().mockImplementation(() => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    });
    vi.stubGlobal('fetch', fakeFetch);

    const log = { warn: vi.fn() };
    const r = await routeKm(KYIV, LVIV, log);
    expect(r.source).toBe('haversine_fallback');
    const expected = haversineKm(KYIV, LVIV) * 1.3;
    expect(r.route_km).toBeCloseTo(expected, 5);
    expect(log.warn).toHaveBeenCalledOnce();
  });

  it('falls back on non-Ok OSRM response', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 'NoRoute', routes: [] }),
    });
    vi.stubGlobal('fetch', fakeFetch);

    const log = { warn: vi.fn() };
    const r = await routeKm(KYIV, LVIV, log);
    expect(r.source).toBe('haversine_fallback');
    expect(log.warn).toHaveBeenCalledOnce();
  });

  it('caches OSRM result within TTL', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 'Ok', routes: [{ distance: 540_000, duration: 25_000 }] }),
    });
    vi.stubGlobal('fetch', fakeFetch);

    await routeKm(KYIV, LVIV);
    await routeKm(KYIV, LVIV);
    expect(fakeFetch).toHaveBeenCalledOnce();
  });
});
