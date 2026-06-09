// DB-10 — integration test for `pnpm seed`.
//
// Boots a real postgis/postgis:17-3.5 container via testcontainers, applies
// migrations, runs the seed twice (idempotency check), and asserts row counts
// + canonical KNN smoke from Kyiv.
//
// REQUIRES Docker daemon. If Docker is unavailable on the runner, this test
// fails at beforeAll — documented posture (same as health.test.ts and
// swagger.test.ts).

import { exec as execCb } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { startPostgisContainer, stopPostgisContainer } from '../_helpers/test-db.js';

const exec = promisify(execCb);
const { Pool } = pg;

describe('Seed (integration)', () => {
  let dbUrl: string;
  let originalDbUrl: string | undefined;
  let originalRedisUrl: string | undefined;
  let pool: pg.Pool;

  beforeAll(async () => {
    dbUrl = await startPostgisContainer();
    originalDbUrl = process.env.DATABASE_URL;
    originalRedisUrl = process.env.REDIS_URL;
    process.env.DATABASE_URL = dbUrl;
    process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

    const cwd = path.resolve(import.meta.dirname, '..', '..');

    // Apply migrations
    await exec('pnpm exec drizzle-kit migrate', {
      cwd,
      env: { ...process.env, DATABASE_URL: dbUrl },
    });

    // Run seed twice to verify idempotency
    await exec('pnpm exec tsx src/seed/run.ts', {
      cwd,
      env: { ...process.env, DATABASE_URL: dbUrl },
    });
    await exec('pnpm exec tsx src/seed/run.ts', {
      cwd,
      env: { ...process.env, DATABASE_URL: dbUrl },
    });

    pool = new Pool({ connectionString: dbUrl });
  }, 180_000);

  afterAll(async () => {
    if (pool) await pool.end();
    await stopPostgisContainer();
    if (originalDbUrl !== undefined) process.env.DATABASE_URL = originalDbUrl;
    if (originalRedisUrl !== undefined) process.env.REDIS_URL = originalRedisUrl;
  });

  test('seed is idempotent — running twice produces stable row counts', async () => {
    const trucks = await pool.query<{ count: string }>('SELECT count(*) FROM trucks');
    expect(Number(trucks.rows[0]?.count)).toBe(12);

    const clients = await pool.query<{ count: string }>('SELECT count(*) FROM clients');
    expect(Number(clients.rows[0]?.count)).toBe(8);

    const cities = await pool.query<{ count: string }>('SELECT count(*) FROM cities');
    expect(Number(cities.rows[0]?.count)).toBeGreaterThanOrEqual(25);

    const pricing = await pool.query<{ count: string }>('SELECT count(*) FROM pricing_config');
    expect(Number(pricing.rows[0]?.count)).toBe(3);
  });

  test('seed populates 4 RU + 4 UA clients', async () => {
    const ruCount = await pool.query<{ count: string }>(
      "SELECT count(*) FROM clients WHERE lang='ru'"
    );
    const uaCount = await pool.query<{ count: string }>(
      "SELECT count(*) FROM clients WHERE lang='ua'"
    );
    expect(Number(ruCount.rows[0]?.count)).toBe(4);
    expect(Number(uaCount.rows[0]?.count)).toBe(4);
  });

  test('seed populates the expected body_type mix (tent x5, ref x3, iso x2, container x2)', async () => {
    const r = await pool.query<{ body_type: string; count: string }>(
      'SELECT body_type::text AS body_type, count(*) AS count FROM trucks GROUP BY body_type'
    );
    const counts: Record<string, number> = {};
    for (const row of r.rows) counts[row.body_type] = Number(row.count);
    expect(counts.tent).toBe(5);
    expect(counts.ref).toBe(3);
    expect(counts.iso).toBe(2);
    expect(counts.container).toBe(2);
  });

  test('canonical KNN from Kyiv returns 3 trucks with ascending meters', async () => {
    const r = await pool.query<{ name: string; meters: number }>(`
      WITH knn AS (
        SELECT t.id FROM trucks t
        WHERE t.status='available'
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(30.5234, 50.4501), 4326)::geography
        LIMIT 20
      )
      SELECT t.name, ST_Distance(t.geom, ST_SetSRID(ST_MakePoint(30.5234, 50.4501), 4326)::geography, true)::int AS meters
      FROM knn JOIN trucks t USING (id)
      ORDER BY meters
      LIMIT 3
    `);
    expect(r.rows).toHaveLength(3);
    const m = r.rows.map((row) => Number(row.meters));
    expect(m[0]).toBeLessThanOrEqual(m[1] ?? Number.MAX_SAFE_INTEGER);
    expect(m[1]).toBeLessThanOrEqual(m[2] ?? Number.MAX_SAFE_INTEGER);
  });

  test('cities have a border-* slug for >=5 crossings', async () => {
    const r = await pool.query<{ count: string }>(
      "SELECT count(*) FROM cities WHERE slug LIKE 'border-%'"
    );
    expect(Number(r.rows[0]?.count)).toBeGreaterThanOrEqual(5);
  });

  test('pricing_config has rate_per_km=4200 (kopecks) per D-19', async () => {
    const r = await pool.query<{ value: string }>(
      "SELECT value::text AS value FROM pricing_config WHERE key='rate_per_km'"
    );
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.value).toBe('4200');
  });
});
