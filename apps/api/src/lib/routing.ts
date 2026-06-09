// Phase 2 Plan 02-01 Task 2 — OSRM routing adapter with haversine fallback.
// MATCH-04. CONTEXT D-20 (public OSRM) + D-21 (haversine × 1.3 on failure).
//
// Source: 02-RESEARCH.md §8 (verbatim).

import { config } from '../config.js';

const OSRM_TIMEOUT_MS = 2000;
const ROAD_FACTOR = 1.3;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// In-memory cache. Key: `${fromLon},${fromLat};${toLon},${toLat}`.
const cache = new Map<string, { route_km: number; eta_sec: number; expires_at: number }>();

export interface LonLat {
  lon: number;
  lat: number;
}

export interface RouteResult {
  route_km: number;
  eta_sec: number;
  source: 'osrm' | 'haversine_fallback';
}

/** Test helper — clears the in-memory cache between unit-test runs. */
export function clearRouteCache(): void {
  cache.clear();
}

/**
 * Resolve route distance + ETA between two lon/lat points via OSRM. On timeout
 * or non-Ok response, falls back to haversine × 1.3 road-factor estimate.
 */
export async function routeKm(
  from: LonLat,
  to: LonLat,
  log?: { warn: (msg: string) => void }
): Promise<RouteResult> {
  const key = `${from.lon},${from.lat};${to.lon},${to.lat}`;
  const cached = cache.get(key);
  if (cached && cached.expires_at > Date.now()) {
    return { route_km: cached.route_km, eta_sec: cached.eta_sec, source: 'osrm' };
  }

  // OSRM expects {lon},{lat};{lon},{lat} with NO spaces.
  const url =
    `${config.OSRM_URL}/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}` +
    `?overview=false&alternatives=false&steps=false`;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(OSRM_TIMEOUT_MS) });
    if (!resp.ok) throw new Error(`OSRM HTTP ${resp.status}`);
    const json = (await resp.json()) as {
      code: string;
      routes?: Array<{ distance: number; duration: number }>;
    };
    if (json.code !== 'Ok' || !json.routes?.[0]) {
      throw new Error(`OSRM code=${json.code} routes=${json.routes?.length ?? 0}`);
    }
    const route_km = json.routes[0].distance / 1000;
    const eta_sec = json.routes[0].duration;
    cache.set(key, { route_km, eta_sec, expires_at: Date.now() + CACHE_TTL_MS });
    return { route_km, eta_sec, source: 'osrm' };
  } catch (err) {
    log?.warn(`OSRM fallback to haversine: ${(err as Error).message}`);
    const km = haversineKm(from, to) * ROAD_FACTOR;
    return { route_km: km, eta_sec: (km / 60) * 3600, source: 'haversine_fallback' };
  }
}

/** Great-circle distance in km. R = 6371. */
export function haversineKm(a: LonLat, b: LonLat): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const aTerm = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * R * Math.asin(Math.sqrt(aTerm));
}
