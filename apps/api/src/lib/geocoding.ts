// Phase 2 Plan 02-01 Task 2 — Nominatim geocoding adapter.
// LOGIC-03. CONTEXT D-16, D-17, D-18.
//
// Nominatim usage policy (https://operations.osmfoundation.org/policies/nominatim/):
//   - Max 1 req/sec.
//   - MANDATORY: User-Agent or Referer identifying the application
//     (stock User-Agents from libraries are explicitly forbidden).
//   - Email contact RECOMMENDED in User-Agent.
//
// Source: 02-RESEARCH.md §9 (verbatim).

import { config } from '../config.js';

const TIMEOUT_MS = 3000;

export interface GeocodeResult {
  /** WKT POINT(lon lat). Caller wraps in `SRID=4326;` before insert. */
  pointWkt: string;
  /** Display name from Nominatim — use to seed cities.name_ru / name_ua. */
  display_name: string;
  /** ISO 3166-1 alpha-2 country code (lowercased). */
  country_code: string;
}

/**
 * Geocode a free-form city/place name via Nominatim, biased to RU/UA by default.
 *
 * Returns null on no hit, HTTP error, or timeout. Errors logged via injected `log.warn`
 * to keep console out of the call path (Biome `noConsole` rule).
 */
export async function geocode(
  name: string,
  countryBias: string[] = ['ru', 'ua'],
  log?: { warn: (msg: string) => void }
): Promise<GeocodeResult | null> {
  const userAgent = `ai-logist/0.2 (demo; contact: ${config.NOMINATIM_CONTACT_EMAIL})`;
  const params = new URLSearchParams({
    q: name,
    format: 'json',
    limit: '1',
    countrycodes: countryBias.join(','),
    addressdetails: '0',
  });
  try {
    const resp = await fetch(`${config.NOMINATIM_URL}/search?${params.toString()}`, {
      headers: { 'User-Agent': userAgent, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!resp.ok) throw new Error(`Nominatim HTTP ${resp.status}`);
    const arr = (await resp.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;
    if (arr.length === 0) return null;
    const hit = arr[0];
    if (!hit) return null;
    return {
      pointWkt: `POINT(${hit.lon} ${hit.lat})`,
      display_name: hit.display_name,
      // Nominatim doesn't return country_code with addressdetails=0; caller can
      // re-query with addressdetails=1 when seed-caching a new city.
      country_code: countryBias[0] ?? 'ru',
    };
  } catch (err) {
    log?.warn(`geocode("${name}") failed: ${(err as Error).message}`);
    return null;
  }
}
