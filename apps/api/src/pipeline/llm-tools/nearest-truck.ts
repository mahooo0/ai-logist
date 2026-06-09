// Phase 2 Plan 02-02 Task 2 — nearestTruck tool (MATCH-01).
//
// CONTEXT D-19..D-23. Source: 02-RESEARCH.md §4 (CTE re-rank SQL VERBATIM).
//
// CTE re-rank pattern (Pitfall #2):
//   1. CTE "candidates" selects 20 nearest trucks by `<->` on geography (sphere,
//      GiST-index-accelerated). Filters (status='available', capacity_t, body_type)
//      MUST live INSIDE the CTE — outer filters break index usage.
//   2. Outer query re-ranks the 20 candidates by spheroid ST_Distance(..., true)
//      and LIMITs to 3. Sphere ordering ≠ spheroid ordering (PostGIS ticket #3127);
//      overfetching 20 absorbs the reorder window.
//
// Bourse fallback (D-23, MATCH-02):
//   If the CTE returns 0 own-fleet rows, the handler queries `queryBourseStub` and
//   returns the rows tagged with source='bourse-stub'. The stub is JSON-fixture-backed
//   (apps/api/src/lib/bourse-stub.json) — real ATI.SU / Lardi-Trans integration is v2.

import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { sql } from 'drizzle-orm';
import { z } from 'zod/v4';
import type { Db } from '../../db.js';
import { queryBourseStub } from '../../lib/bourse-stub.js';
import type { ToolContext } from './index.js';

export const NearestTruckInputSchema = z.object({
  pickup_lon: z.number(),
  pickup_lat: z.number(),
  tons: z.number().positive(),
  body_type: z.enum(['tent', 'ref', 'iso', 'container']).nullable(),
});

export interface NearestTruckRow {
  id: string;
  driver_phone: string;
  plate_number: string;
  capacity_t: string; // numeric → string via pg
  body_type: 'tent' | 'ref' | 'iso' | 'container';
  meters: string; // double precision → string via pg
  source: 'own-fleet' | 'bourse-stub';
}

/**
 * Direct call surface for integration tests + Wave 3 intake plumbing.
 *
 * Steps:
 *   1. Build pickup WKT `SRID=4326;POINT(lon lat)`.
 *   2. Execute the CTE re-rank SQL. Filters inside CTE keep the GiST index
 *      (`trucks_geom_gist`) on the `<->` operator path.
 *   3. If rows > 0 → tag with source='own-fleet' and return.
 *   4. If rows === 0 → bourse fallback (D-23), tag with source='bourse-stub'.
 *
 * The SQL is hand-written via Drizzle's `sql\`...\`` template because PostGIS
 * functions and `<->` are not in Drizzle's relational DSL.
 */
export async function nearestTruck(
  db: Db,
  params: {
    pickupLon: number;
    pickupLat: number;
    tons: number;
    bodyType: 'tent' | 'ref' | 'iso' | 'container' | null;
  }
): Promise<NearestTruckRow[]> {
  const pickupWkt = `SRID=4326;POINT(${params.pickupLon} ${params.pickupLat})`;
  const result = await db.execute(sql`
    WITH candidates AS (
      SELECT
        t.id,
        t.geom,
        t.capacity_t,
        t.body_type,
        t.driver_phone,
        t.plate_number
      FROM trucks t
      WHERE t.status = 'available'
        AND t.capacity_t >= ${params.tons}
        AND (${params.bodyType}::body_type_t IS NULL
             OR t.body_type = ${params.bodyType}::body_type_t)
      ORDER BY t.geom <-> ST_GeogFromText(${pickupWkt})
      LIMIT 20
    )
    SELECT
      c.id,
      c.driver_phone,
      c.plate_number,
      c.capacity_t,
      c.body_type,
      ST_Distance(c.geom, ST_GeogFromText(${pickupWkt}), true) AS meters
    FROM candidates c
    ORDER BY meters
    LIMIT 3
  `);

  const rows = (result.rows as Omit<NearestTruckRow, 'source'>[]).map((r) => ({
    ...r,
    source: 'own-fleet' as const,
  }));
  if (rows.length > 0) return rows;

  // D-23 bourse fallback: own fleet exhausted, hit the stub.
  const stub = await queryBourseStub(db, {
    tons: params.tons,
    bodyType: params.bodyType,
  });
  return stub.map((s) => ({
    id: s.external_id,
    driver_phone: s.contact_phone,
    plate_number: s.external_id,
    capacity_t: String(s.capacity_t),
    body_type: s.body_type,
    meters: '0',
    source: 'bourse-stub' as const,
  }));
}

export function nearestTruckTool(ctx: ToolContext) {
  return betaZodTool({
    name: 'nearestTruck',
    description:
      'Find the 3 nearest available trucks to a pickup point that satisfy the capacity (tons) and optional body_type. Returns spheroid-distance-ranked rows; falls back to bourse-stub when own fleet is exhausted.',
    inputSchema: NearestTruckInputSchema,
    run: async (input) => {
      // Belt-and-suspenders re-validation per D-05.
      NearestTruckInputSchema.parse(input);
      const rows = await nearestTruck(ctx.db, {
        pickupLon: input.pickup_lon,
        pickupLat: input.pickup_lat,
        tons: input.tons,
        bodyType: input.body_type,
      });
      ctx.log.info(
        { tool: 'nearestTruck', leadId: ctx.leadId, rows: rows.length, source: rows[0]?.source },
        'tool.invoked'
      );
      return JSON.stringify({ ok: true, data: rows });
    },
  });
}
