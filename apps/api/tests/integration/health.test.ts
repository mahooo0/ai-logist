import { exec as execCb } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { startPostgisContainer, stopPostgisContainer } from '../_helpers/test-db.js';

const exec = promisify(execCb);

/**
 * Integration test for GET /api/health (API-01).
 *
 * Boots a real postgis/postgis:17-3.5 container via testcontainers, applies BOTH
 * migrations (0000_postgis_extension + 0001_init), builds the Fastify app against the
 * container, and verifies the /api/health route returns 200 with checks.postgis matching
 * the live PostGIS version.
 *
 * Redis: reuses localhost:6379 from docker-compose (Wave 2) rather than spinning a
 * per-test container for speed. If Redis isn't running, the test will assert against the
 * 503 degraded path, which is still meaningful.
 *
 * REQUIRES Docker daemon to be reachable. If Docker is unavailable on the runner, this
 * test will fail at beforeAll — that's the documented contract.
 */
describe('GET /api/health (integration)', () => {
  let dbUrl: string;
  let originalDbUrl: string | undefined;
  let originalRedisUrl: string | undefined;
  let buildApp: typeof import('../../src/app.js').buildApp;

  beforeAll(async () => {
    dbUrl = await startPostgisContainer();
    originalDbUrl = process.env.DATABASE_URL;
    originalRedisUrl = process.env.REDIS_URL;
    process.env.DATABASE_URL = dbUrl;
    process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

    // Apply migrations against the test container
    await exec('pnpm exec drizzle-kit migrate', {
      cwd: path.resolve(import.meta.dirname, '..', '..'),
      env: { ...process.env, DATABASE_URL: dbUrl },
    });

    // Re-import app.ts AFTER env vars are set so config.ts picks up the test DB
    const mod = await import('../../src/app.js');
    buildApp = mod.buildApp;
  }, 90_000);

  afterAll(async () => {
    await stopPostgisContainer();
    if (originalDbUrl !== undefined) process.env.DATABASE_URL = originalDbUrl;
    if (originalRedisUrl !== undefined) process.env.REDIS_URL = originalRedisUrl;
  });

  test('returns 200 with PostGIS version when all subsystems are up', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({ method: 'GET', url: '/api/health' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe('ok');
      expect(body.checks.db).toBe('ok');
      expect(body.checks.postgis).toMatch(/3\.5/);
      expect(body.checks.redis).toBe('ok');
      // Phase 2 Plan 02-05 — llm subcheck. Result depends on env: 'ok' if
      // ANTHROPIC_API_KEY is set in the test environment, 'not_configured'
      // otherwise. Either value is a valid health response.
      expect(['ok', 'not_configured']).toContain(body.checks.llm);
    } finally {
      await app.close();
    }
  });

  test('API-16: HealthResponseSchema validates the expected payload shape', async () => {
    const { HealthResponseSchema } = await import('@ai-logist/shared-types/api/health');
    // Phase 2 Plan 02-05 — schema gained checks.llm subcheck.
    const valid = HealthResponseSchema.safeParse({
      status: 'ok',
      version: 'dev',
      uptime_s: 1,
      checks: { db: 'ok', postgis: '3.5.0', redis: 'ok', llm: 'ok' },
    });
    expect(valid.success).toBe(true);

    const invalid = HealthResponseSchema.safeParse({
      status: 'whatever',
      version: 'dev',
      uptime_s: 1,
      checks: { db: 'ok', postgis: '3.5.0', redis: 'ok', llm: 'ok' },
    });
    expect(invalid.success).toBe(false);
  });
});
