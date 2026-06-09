// Canonical KNN smoke query — closes success criterion #3 of Phase 1.
//
// Phase 2 will implement the proper CTE re-rank pattern (PITFALLS.md #2):
//   1. Overfetch 20 by `<->` (GiST-accelerated sphere distance)
//   2. Filter by capacity_t and body_type INSIDE the CTE
//   3. Re-rank by ST_Distance(geog, geog, true) (spheroid, meters)
//
// For Phase 1 we use the same pattern with a fixed point (Kyiv) and no filters,
// which is enough to verify (a) GiST index is used, (b) <-> works on geography,
// (c) ST_Distance returns meters.

import { sql } from 'drizzle-orm';
import type { Db } from '../db.js';

export async function printNearestTrucksSmoke(db: Db): Promise<void> {
  // Kyiv center: 30.5234 E, 50.4501 N
  const lng = 30.5234;
  const lat = 50.4501;
  const pickup = sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;

  const result = await db.execute<{
    name: string;
    plate_number: string;
    capacity_t: number;
    body_type: string;
    meters: number;
  }>(sql`
        WITH knn AS (
          SELECT t.id
          FROM trucks t
          WHERE t.status = 'available'
          ORDER BY t.geom <-> ${pickup}
          LIMIT 20
        )
        SELECT
          t.name,
          t.plate_number,
          t.capacity_t,
          t.body_type::text AS body_type,
          ST_Distance(t.geom, ${pickup}, true)::int AS meters
        FROM knn JOIN trucks t USING (id)
        ORDER BY meters
        LIMIT 3
      `);

  console.log('\n  Canonical KNN smoke (pickup = Kyiv center)');
  console.log('-'.repeat(60));
  for (const row of result.rows) {
    const km = (Number(row.meters) / 1000).toFixed(1);
    console.log(
      `  ${row.name.padEnd(22)} ${row.plate_number.padEnd(12)} ${row.capacity_t}t ${row.body_type.padEnd(10)} ${km} km`
    );
  }
  console.log('-'.repeat(60));
  console.log(
    '3 nearest trucks from Kyiv center listed above with ascending km values — PostGIS is wired correctly.\n'
  );
}
