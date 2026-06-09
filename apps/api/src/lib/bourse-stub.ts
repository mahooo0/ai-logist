// Phase 2 Plan 02-01 Task 2 — MATCH-02 bourse stub fallback.
// CONTEXT D-23 — when own-fleet CTE returns 0 rows, fall back to a JSON fixture
// of 5 fake external trucks. Each query is cached in bourse_cache for audit.
//
// Real ATI.SU / Lardi-Trans HTTP integration deferred to v2 EXT-01/02.

import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { Db } from '../db.js';
import stubData from './bourse-stub.json' with { type: 'json' };

export interface BourseStubTruck {
  source: 'ati.su' | 'lardi';
  external_id: string;
  geom_wkt: string;
  capacity_t: number;
  body_type: 'tent' | 'ref' | 'iso' | 'container';
  contact_phone: string;
  rate_per_km_kopecks: number;
}

export interface BourseQuery {
  tons: number;
  bodyType: 'tent' | 'ref' | 'iso' | 'container' | null;
}

/** Synchronous filter, exposed so unit tests verify filter logic without a DB. */
export function filterBourseStub(q: BourseQuery): BourseStubTruck[] {
  return (stubData as BourseStubTruck[])
    .filter((r) => r.capacity_t >= q.tons && (q.bodyType === null || r.body_type === q.bodyType))
    .slice(0, 3);
}

/**
 * Query the bourse stub and cache the result in bourse_cache (audit trail).
 * Uses sha256 of the canonical query JSON as the query_hash key.
 */
export async function queryBourseStub(db: Db, q: BourseQuery): Promise<BourseStubTruck[]> {
  const candidates = filterBourseStub(q);
  const queryHash = createHash('sha256').update(JSON.stringify(q)).digest('hex');
  // bourse_cache.query_hash is UNIQUE (Phase 1 uniqueIndex). ON CONFLICT refreshes payload + fetched_at.
  await db.execute(sql`
    INSERT INTO bourse_cache (query_hash, source, payload, fetched_at)
    VALUES (${queryHash}, 'stub', ${JSON.stringify(candidates)}::jsonb, NOW())
    ON CONFLICT (query_hash) DO UPDATE SET payload = EXCLUDED.payload, fetched_at = NOW()
  `);
  return candidates;
}
