// Phase 2 Plan 02-02 Task 2 — integration test for bourse fallback (MATCH-02).
//
// Verifies D-23:
//   1. When the own-fleet CTE returns 0 rows (all trucks status='busy'),
//      `nearestTruck(db, {...})` falls back to the JSON-fixture bourse stub
//      and returns rows tagged with source='bourse-stub'.
//   2. The fallback path writes a row to `bourse_cache` with a sha256 query_hash
//      so an auditor can replay the query later.

import { exec as execCb } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { nearestTruck } from '../../src/pipeline/llm-tools/nearest-truck.js';
import { startPostgisContainer, stopPostgisContainer } from '../_helpers/test-db.js';

const exec = promisify(execCb);
const { Pool } = pg;

const RUN_INTEGRATION = process.env.AI_LOGIST_SKIP_INTEGRATION !== '1';
const describeIf = RUN_INTEGRATION ? describe : describe.skip;

describeIf('nearestTruck — bourse fallback (MATCH-02, D-23)', () => {
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

  beforeEach(async () => {
    // Force CTE to return empty by marking every truck busy.
    await db.execute(sql`UPDATE trucks SET status = 'busy'`);
    // Clean bourse_cache so each test starts with a known cache state.
    await db.execute(sql`DELETE FROM bourse_cache`);
  });

  it('returns rows with source=bourse-stub when own fleet is exhausted', async () => {
    const rows = await nearestTruck(db, {
      pickupLon: 30.5234,
      pickupLat: 50.4501,
      tons: 5,
      bodyType: 'tent',
    });
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.source).toBe('bourse-stub');
      expect(row.body_type).toBe('tent');
    }
  });

  it('writes a row to bourse_cache with sha256 query_hash after fallback', async () => {
    await nearestTruck(db, {
      pickupLon: 30.5234,
      pickupLat: 50.4501,
      tons: 5,
      bodyType: 'tent',
    });
    const cacheRows = await db.execute(sql`
      SELECT query_hash, source, payload FROM bourse_cache
    `);
    expect(cacheRows.rows.length).toBeGreaterThan(0);
    const row = cacheRows.rows[0] as { query_hash: string; source: string; payload: unknown };
    expect(row.source).toBe('stub');
    // sha256 hex is 64 chars.
    expect(row.query_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.payload).toBeDefined();
  });
});
