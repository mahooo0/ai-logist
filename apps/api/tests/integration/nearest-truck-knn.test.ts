// Phase 2 Plan 02-02 Task 2 — integration test for nearestTruck (MATCH-01).
//
// Two assertions:
//   1. EXPLAIN ANALYZE on the production CTE re-rank SQL uses the GiST index
//      (`trucks_geom_gist`) — NOT a sequential scan — and filters are applied
//      INSIDE the CTE candidates step (closes Pitfall #2 + D-22).
//   2. The handler `nearestTruck(db, {...})` returns up to 3 rows from the seed
//      fleet, ordered by ascending meters (spheroid re-rank), each with the
//      expected shape.
//
// Source: 02-RESEARCH.md §12 (verbatim EXPLAIN ANALYZE block).
//
// Index name note: the live migration creates the GiST index as `trucks_geom_gist`
// (see drizzle/0001_init.sql line 39), NOT the `..._idx` suffix the plan example
// referenced. We assert against the actual index name.
//
// Setup mirrors tests/integration/seed.test.ts (Phase 1 DB-10): boot testcontainers
// PostGIS, exec drizzle-kit migrate, exec the seed runner. Drizzle and the
// production nearestTruck() helper both use the same connection string.

import { exec as execCb } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { nearestTruck } from '../../src/pipeline/llm-tools/nearest-truck.js';
import { startPostgisContainer, stopPostgisContainer } from '../_helpers/test-db.js';

const exec = promisify(execCb);
const { Pool } = pg;

const RUN_INTEGRATION = process.env.AI_LOGIST_SKIP_INTEGRATION !== '1';
const describeIf = RUN_INTEGRATION ? describe : describe.skip;

describeIf('nearestTruck — EXPLAIN ANALYZE uses GiST index (MATCH-01, D-22)', () => {
  // biome-ignore lint/suspicious/noExplicitAny: Drizzle's Db type collides with the production schema-decorated one; tests don't need full type narrowing.
  let db: NodePgDatabase<any>;
  let pool: pg.Pool;
  let originalDbUrl: string | undefined;

  beforeAll(async () => {
    const dbUrl = await startPostgisContainer();
    originalDbUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = dbUrl;
    process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

    const cwd = path.resolve(import.meta.dirname, '..', '..');
    await exec('pnpm exec drizzle-kit migrate', {
      cwd,
      env: { ...process.env, DATABASE_URL: dbUrl },
    });
    await exec('pnpm exec tsx src/seed/run.ts', {
      cwd,
      env: { ...process.env, DATABASE_URL: dbUrl },
    });

    pool = new Pool({ connectionString: dbUrl });
    db = drizzle(pool);
  }, 180_000);

  afterAll(async () => {
    if (pool) await pool.end();
    await stopPostgisContainer();
    if (originalDbUrl !== undefined) process.env.DATABASE_URL = originalDbUrl;
  });

  it('uses Index Scan with trucks_geom_gist and applies filters INSIDE CTE', async () => {
    const planRows = await db.execute(sql`
      EXPLAIN (ANALYZE, FORMAT TEXT)
      WITH candidates AS (
        SELECT id, geom, capacity_t, body_type, driver_phone, plate_number
        FROM trucks
        WHERE status = 'available'
          AND capacity_t >= 18
          AND (NULL::body_type_t IS NULL OR body_type = NULL::body_type_t)
        ORDER BY geom <-> ST_GeogFromText('SRID=4326;POINT(30.5234 50.4501)')
        LIMIT 20
      )
      SELECT id, ST_Distance(geom, ST_GeogFromText('SRID=4326;POINT(30.5234 50.4501)'), true) AS meters
      FROM candidates
      ORDER BY meters
      LIMIT 3;
    `);
    const planText = (planRows.rows as Array<{ 'QUERY PLAN': string }>)
      .map((r) => r['QUERY PLAN'])
      .join('\n');

    // Hard assertions per success criterion #3.
    // Index name is `trucks_geom_gist` per drizzle/0001_init.sql.
    expect(planText).toMatch(/Index Scan using trucks_geom_gist/);
    expect(planText).not.toMatch(/Seq Scan on trucks/);
    // Filter on capacity_t must appear inside the CTE candidates step.
    expect(planText).toMatch(/capacity_t >= '18'/);
  });

  it('returns 3 rows ordered by ascending meters from the seed fleet', async () => {
    const rows = await nearestTruck(db, {
      pickupLon: 30.5234,
      pickupLat: 50.4501,
      tons: 5, // low cutoff to maximise candidate pool from seed
      bodyType: null,
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(3);
    for (const row of rows) {
      expect(row.source).toBe('own-fleet');
      expect(typeof row.id).toBe('string');
      expect(typeof row.driver_phone).toBe('string');
      expect(typeof row.plate_number).toBe('string');
      expect(typeof row.meters).toBe('string');
      expect(Number(row.meters)).toBeGreaterThanOrEqual(0);
    }
    // Ascending order on meters (spheroid re-rank).
    const metersAsc = rows.map((r) => Number(r.meters));
    for (let i = 1; i < metersAsc.length; i++) {
      const curr = metersAsc[i];
      const prev = metersAsc[i - 1];
      if (curr === undefined || prev === undefined) continue;
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });
});
