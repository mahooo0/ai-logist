import { exec as execCb } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { startPostgisContainer, stopPostgisContainer } from '../_helpers/test-db.js';

const exec = promisify(execCb);

/**
 * Integration test for Plan 01-08 surface:
 *  - Swagger / OpenAPI exposes every API-* and webhook endpoint
 *  - Zod validator rejects malformed query/body with 400 (API-16)
 *  - reply.notImplemented() returns the canonical 501 sensible shape
 *
 * Reuses the testcontainers PostGIS strategy from health.test.ts. Migrations
 * are applied via `pnpm exec drizzle-kit migrate` against the test DB so
 * buildApp() + dbPlugin's SELECT 1 smoke test succeeds at boot.
 *
 * REQUIRES Docker daemon. Same posture as health.test.ts on Claude's runner.
 */
describe('Swagger / OpenAPI surface + Zod 400 + 501 stubs (integration)', () => {
  let dbUrl: string;
  let originalDbUrl: string | undefined;
  let originalRedisUrl: string | undefined;
  let app: import('fastify').FastifyInstance;

  beforeAll(async () => {
    dbUrl = await startPostgisContainer();
    originalDbUrl = process.env.DATABASE_URL;
    originalRedisUrl = process.env.REDIS_URL;
    process.env.DATABASE_URL = dbUrl;
    process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

    await exec('pnpm exec drizzle-kit migrate', {
      cwd: path.resolve(import.meta.dirname, '..', '..'),
      env: { ...process.env, DATABASE_URL: dbUrl },
    });

    // Dynamic import AFTER env override so config.ts captures the test DB
    const mod = await import('../../src/app.js');
    app = await mod.buildApp();
  }, 90_000);

  afterAll(async () => {
    if (app) await app.close();
    await stopPostgisContainer();
    if (originalDbUrl !== undefined) process.env.DATABASE_URL = originalDbUrl;
    if (originalRedisUrl !== undefined) process.env.REDIS_URL = originalRedisUrl;
  });

  test('Swagger lists all key endpoints (leads, orders, trucks, clients, analytics, webhooks)', async () => {
    // @fastify/swagger-ui 5.x exposes OpenAPI JSON at routePrefix/json
    let res = await app.inject({ method: 'GET', url: '/api/docs/json' });
    if (res.statusCode === 404) {
      // Fallback for any version that uses /openapi.json
      res = await app.inject({ method: 'GET', url: '/api/docs/openapi.json' });
    }
    expect(res.statusCode).toBe(200);
    const paths = Object.keys(res.json().paths ?? {});
    expect(paths).toEqual(
      expect.arrayContaining([
        '/api/health',
        '/api/leads',
        '/api/orders',
        '/api/trucks',
        '/api/clients/{id}/messages',
        '/api/analytics/kpi',
        '/webhook/telegram',
        '/webhook/voice',
        '/webhook/gps',
      ])
    );
    // At least 14 routes (health + 4 leads + 4 orders + 3 trucks + 1 clients + 1 analytics + 3 webhooks = 17)
    // Count operations across all path entries to be robust to method variations.
    const opCount = Object.values(res.json().paths ?? {}).reduce<number>(
      (acc, pathObj) =>
        acc +
        Object.keys(pathObj as Record<string, unknown>).filter((k) =>
          ['get', 'post', 'patch', 'put', 'delete'].includes(k)
        ).length,
      0
    );
    expect(opCount).toBeGreaterThanOrEqual(14);
  });

  test('API-16: GET /api/leads with malformed query (limit=abc) returns 400 via Zod validator', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/leads?limit=abc',
    });
    expect(res.statusCode).toBe(400);
  });

  test('501 sensible response: GET /api/leads returns reply.notImplemented shape', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/leads' });
    expect(res.statusCode).toBe(501);
    const body = res.json();
    expect(body.statusCode).toBe(501);
    expect(body.error).toBe('Not Implemented');
    expect(typeof body.message).toBe('string');
  });

  test('501 sensible response: POST /webhook/gps with valid body still returns 501 stub', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhook/gps',
      payload: {
        truckId: '00000000-0000-4000-8000-000000000000',
        lng: 30.5234,
        lat: 50.4501,
        recordedAt: new Date().toISOString(),
      },
    });
    expect(res.statusCode).toBe(501);
  });

  test('Zod validator rejects POST /webhook/gps with missing required fields (400)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhook/gps',
      payload: { truckId: 'not-a-uuid' },
    });
    expect(res.statusCode).toBe(400);
  });
});
