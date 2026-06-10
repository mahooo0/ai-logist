// Phase 4 Plan 04-03 — GET /api/trucks integration coverage (API-05 read-only).

import { exec as execCb } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPostgisContainer, stopPostgisContainer } from '../_helpers/test-db.js';

const exec = promisify(execCb);
const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('Phase 4 API-05 — GET /api/trucks', () => {
  let app: FastifyInstance;
  let originalDbUrl: string | undefined;
  let originalRedisUrl: string | undefined;

  beforeAll(async () => {
    const dbUrl = await startPostgisContainer();
    originalDbUrl = process.env.DATABASE_URL;
    originalRedisUrl = process.env.REDIS_URL;
    process.env.DATABASE_URL = dbUrl;
    process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

    await exec('pnpm exec drizzle-kit migrate', {
      cwd: path.resolve(import.meta.dirname, '..', '..'),
      env: { ...process.env, DATABASE_URL: dbUrl },
    });

    const mod = await import('../../src/app.js');
    app = await mod.buildApp();
    await app.ready();

    // Seed: 3 trucks (available/tent, busy/ref, maintenance/iso).
    await app.db.execute(sql`
      INSERT INTO trucks (name, plate_number, driver_name, driver_phone,
                          capacity_t, body_type, status, geom)
      VALUES
        ('T-Avail', 'A001AA', 'Driver A', '+71111111111',
         20, 'tent', 'available',
         ST_GeogFromText('SRID=4326;POINT(37.6 55.7)')),
        ('T-Busy', 'B002BB', 'Driver B', '+72222222222',
         18, 'ref', 'busy',
         ST_GeogFromText('SRID=4326;POINT(30.3 59.9)')),
        ('T-Maint', 'M003MM', 'Driver M', '+73333333333',
         15, 'iso', 'maintenance',
         ST_GeogFromText('SRID=4326;POINT(24.0 49.8)'))
    `);
  }, 120_000);

  afterAll(async () => {
    if (app) await app.close();
    await stopPostgisContainer();
    if (originalDbUrl !== undefined) process.env.DATABASE_URL = originalDbUrl;
    if (originalRedisUrl !== undefined) process.env.REDIS_URL = originalRedisUrl;
  });

  it('returns full fleet (read-only) with capacity + body_type + driver_phone', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/trucks' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{
      plateNumber: string;
      capacityT: number;
      bodyType: string;
      driverPhone: string;
    }>;
    expect(body.length).toBeGreaterThanOrEqual(3);
    const a = body.find((t) => t.plateNumber === 'A001AA');
    expect(a).toBeTruthy();
    expect(a?.capacityT).toBe(20);
    expect(a?.bodyType).toBe('tent');
    expect(a?.driverPhone).toBe('+71111111111');
  });

  it('filters by status=available', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/trucks?status=available' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{ plateNumber: string; status: string }>;
    expect(body.every((t) => t.status === 'available')).toBe(true);
    expect(body.find((t) => t.plateNumber === 'A001AA')).toBeTruthy();
  });
});
