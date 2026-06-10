// Phase 4 Plan 04-03 — GET /api/analytics/kpi integration coverage (API-09).

import { exec as execCb } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPostgisContainer, stopPostgisContainer } from '../_helpers/test-db.js';

const exec = promisify(execCb);
const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('Phase 4 API-09 — GET /api/analytics/kpi (extended)', () => {
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

    // Seed:
    //  - 1 client + 4 leads (2 voice + 2 telegram) inside window.
    //  - 5 calls inside window (3 completed/escalated → 'answered', 2 abandoned).
    //  - 3 orders (1 DELIVERED, 2 CREATED) inside window. Revenue sum = 6_500_000 kop.
    const clientRows = await app.db.execute(sql`
      INSERT INTO clients (name, phone, lang)
      VALUES ('KPI Client', '+70000000050', 'ru')
      RETURNING id::text AS id
    `);
    const clientId = (clientRows.rows[0] as { id: string }).id;

    // Leads — by_voice=2, by_telegram=2; byStage = {NEW:2, QUOTED:2}.
    await app.db.execute(sql`
      INSERT INTO leads (client_id, channel, stage) VALUES
        (${clientId}, 'voice', 'NEW'),
        (${clientId}, 'voice', 'QUOTED'),
        (${clientId}, 'telegram', 'NEW'),
        (${clientId}, 'telegram', 'QUOTED')
    `);

    // Calls — 5 with outcome set: 2 completed (60s, 90s), 1 escalated (45s),
    // 2 abandoned (15s, 20s). avg = (60+90+45+15+20)/5 = 46.
    await app.db.execute(sql`
      INSERT INTO calls (direction, outcome, duration_s) VALUES
        ('inbound', 'completed', 60),
        ('inbound', 'completed', 90),
        ('inbound', 'escalated', 45),
        ('inbound', 'abandoned', 15),
        ('inbound', 'abandoned', 20)
    `);

    // Orders — 3 inside window; revenue total = 1_000_000 + 2_500_000 + 3_000_000 = 6_500_000.
    await app.db.execute(sql`
      INSERT INTO orders (number, client_id, price, currency, status, public_token) VALUES
        ('#KPI-001', ${clientId}, 1000000, 'RUB', 'DELIVERED', 'kpi-tok-1'),
        ('#KPI-002', ${clientId}, 2500000, 'RUB', 'CREATED', 'kpi-tok-2'),
        ('#KPI-003', ${clientId}, 3000000, 'RUB', 'CREATED', 'kpi-tok-3')
    `);
  }, 120_000);

  afterAll(async () => {
    if (app) await app.close();
    await stopPostgisContainer();
    if (originalDbUrl !== undefined) process.env.DATABASE_URL = originalDbUrl;
    if (originalRedisUrl !== undefined) process.env.REDIS_URL = originalRedisUrl;
  });

  it('returns calls.total + calls.answered for window=week', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/analytics/kpi?window=week' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      window: string;
      calls: { total: number; answered: number };
    };
    expect(body.window).toBe('week');
    expect(body.calls.total).toBe(5);
    // 'completed' (2) + 'escalated' (1) = 3 answered.
    expect(body.calls.answered).toBe(3);
  });

  it('returns extended fields: avgCallDurationS + byChannel + conversionFunnel', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/analytics/kpi?window=week' });
    const body = res.json() as {
      avgCallDurationS: number | null;
      byChannel: { voice: number; telegram: number };
      conversionFunnel: {
        calls: number;
        answered: number;
        leadsCreated: number;
        ordersConfirmed: number;
        delivered: number;
      };
    };
    expect(body.avgCallDurationS).toBe(46);
    expect(body.byChannel.voice).toBe(2);
    expect(body.byChannel.telegram).toBe(2);
    expect(body.conversionFunnel.calls).toBe(5);
    expect(body.conversionFunnel.answered).toBe(3);
    expect(body.conversionFunnel.leadsCreated).toBe(4);
    expect(body.conversionFunnel.ordersConfirmed).toBe(3);
    expect(body.conversionFunnel.delivered).toBe(1);
  });

  it('conversionFunnel values are all numbers (loose monotonicity — see plan note)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/analytics/kpi?window=week' });
    const body = res.json() as {
      conversionFunnel: {
        calls: number;
        answered: number;
        leadsCreated: number;
        ordersConfirmed: number;
        delivered: number;
      };
    };
    for (const v of Object.values(body.conversionFunnel)) {
      expect(typeof v).toBe('number');
    }
    // calls >= answered always (subset filter); delivered <= ordersConfirmed always.
    expect(body.conversionFunnel.calls).toBeGreaterThanOrEqual(body.conversionFunnel.answered);
    expect(body.conversionFunnel.ordersConfirmed).toBeGreaterThanOrEqual(
      body.conversionFunnel.delivered
    );
  });

  it('revenue.amount is bigint serialized as string (precision preserved)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/analytics/kpi?window=week' });
    const body = res.json() as { revenue: { amount: string; currency: string } };
    expect(typeof body.revenue.amount).toBe('string');
    expect(body.revenue.amount).toBe('6500000');
    expect(body.revenue.currency).toBe('RUB');
  });

  it('window=day vs window=month produce valid responses', async () => {
    const day = await app.inject({ method: 'GET', url: '/api/analytics/kpi?window=day' });
    const month = await app.inject({ method: 'GET', url: '/api/analytics/kpi?window=month' });
    expect(day.statusCode).toBe(200);
    expect(month.statusCode).toBe(200);
    expect((day.json() as { window: string }).window).toBe('day');
    expect((month.json() as { window: string }).window).toBe('month');
  });
});
