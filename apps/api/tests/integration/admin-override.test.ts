// Phase 6 Plan 06-04 Wave 4 — admin-override integration tests.
// Decisions: D-15, D-20
//
// Architecture: two describe blocks.
//  1. Auth-matrix block (mock DB) — no Docker needed, covers all 4 auth scenarios (a/b/c/d).
//  2. Business-logic block (real DB via testcontainer, skipIf !dockerAvailable) —
//     covers FSM bypass + admin_override event written with reason.
//
// B1 — env hygiene: afterEach cleans ADMIN_API_SECRET to prevent test contamination.
import { exec as execCb } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { sql } from 'drizzle-orm';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const exec = promisify(execCb);
const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

// ---- Mocked app builder (no real DB needed for auth tests) -----------------

async function buildMockApp(dbTransaction: ReturnType<typeof vi.fn>): Promise<FastifyInstance> {
  const { serializerCompiler, validatorCompiler } = await import('fastify-type-provider-zod');
  const sensibleMod = await import('@fastify/sensible');

  const app = Fastify({ logger: false });
  // Wire Zod type provider so Fastify handles Zod schemas correctly in tests.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(sensibleMod.default);

  app.decorate('db', {
    execute: vi.fn(),
    transaction: dbTransaction,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  // Must register adminAuthPlugin after decorating db so config is read at request time.
  const { adminAuthPlugin } = await import('../../src/plugins/admin-auth.js');
  await app.register(adminAuthPlugin);

  // Register ordersRoutes under /api prefix (same as production app).
  const { default: ordersRoutes } = await import('../../src/routes/orders.js');
  await app.register(ordersRoutes, { prefix: '/api' });
  await app.ready();
  return app;
}

// ---- B1 Auth-matrix tests (no Docker needed) --------------------------------

describe('PATCH /api/orders/:id/status (B1 admin-override auth matrix)', () => {
  let app: FastifyInstance;
  // Valid UUIDs (version 4) — Zod v4 rejects nil/all-zero UUIDs.
  const orderId = 'be20a98e-7782-4f6c-8880-e35279f219d8';

  // B1 — env hygiene: MANDATORY afterEach cleanup.
  afterEach(() => {
    delete process.env.ADMIN_API_SECRET;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('with ADMIN_API_SECRET set', () => {
    beforeEach(async () => {
      process.env.ADMIN_API_SECRET = 'test_secret';
      vi.resetModules();

      const txMock = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const fakeTx = {
          execute: vi.fn().mockResolvedValue({
            rows: [
              {
                id: orderId,
                number: 'ORD-001',
                leadId: null,
                clientId: '9e4f561b-2430-4dd4-92bb-5418912ac5ba',
                truckId: null,
                fromCityId: null,
                toCityId: null,
                distanceKm: null,
                price: '100000',
                currency: 'RUB',
                status: 'CLOSED',
                publicToken: 'tok',
                version: 2,
                progressPercent: 0,
                autoProgressPaused: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
          }),
        };
        return fn(fakeTx);
      });
      app = await buildMockApp(txMock);
    });

    it('(a) returns 401 when X-Admin-Secret header is missing', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/orders/${orderId}/status`,
        payload: { status: 'CLOSED', reason: 'test' },
        headers: { 'content-type': 'application/json' },
      });
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body)).toMatchObject({ error: 'unauthorized' });
    });

    it('(b) returns 401 when X-Admin-Secret header is wrong', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/orders/${orderId}/status`,
        payload: { status: 'CLOSED', reason: 'test' },
        headers: { 'content-type': 'application/json', 'x-admin-secret': 'wrong_secret' },
      });
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body)).toMatchObject({ error: 'unauthorized' });
    });

    it('(c) returns 200 when X-Admin-Secret header matches', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/orders/${orderId}/status`,
        payload: { status: 'CLOSED', reason: 'demo override' },
        headers: { 'content-type': 'application/json', 'x-admin-secret': 'test_secret' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as Record<string, unknown>;
      expect(body.status).toBe('CLOSED');
    });
  });

  describe('with ADMIN_API_SECRET unset', () => {
    beforeEach(async () => {
      // Explicitly ensure ADMIN_API_SECRET is not set.
      delete process.env.ADMIN_API_SECRET;
      vi.resetModules();

      const txMock = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const fakeTx = {
          execute: vi.fn().mockResolvedValue({
            rows: [
              {
                id: orderId,
                number: 'ORD-001',
                leadId: null,
                clientId: '9e4f561b-2430-4dd4-92bb-5418912ac5ba',
                truckId: null,
                fromCityId: null,
                toCityId: null,
                distanceKm: null,
                price: '100000',
                currency: 'RUB',
                status: 'CLOSED',
                publicToken: 'tok',
                version: 2,
                progressPercent: 0,
                autoProgressPaused: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
          }),
        };
        return fn(fakeTx);
      });
      app = await buildMockApp(txMock);
    });

    it('(d) returns 200 regardless of header when ADMIN_API_SECRET is unset', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/orders/${orderId}/status`,
        payload: { status: 'CLOSED', reason: 'demo override' },
        headers: {
          'content-type': 'application/json',
          // No X-Admin-Secret header — should be allowed when env is unset.
        },
      });
      expect(res.statusCode).toBe(200);
    });
  });
});

// ---- Business logic tests (real DB via testcontainer) -----------------------

describe.skipIf(!dockerAvailable)(
  'D-15+D-20 PATCH /api/orders/:id/status — FSM bypass + audit event (real DB)',
  () => {
    let app: FastifyInstance;
    let orderId: string;
    let originalDbUrl: string | undefined;
    let originalRedisUrl: string | undefined;

    afterEach(() => {
      delete process.env.ADMIN_API_SECRET;
    });

    beforeAll(async () => {
      const { startPostgisContainer } = await import('../_helpers/test-db.js');
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

      // Seed: two cities + client + order with status=CREATED.
      const cityRows = await app.db.execute(sql`
        INSERT INTO cities (slug, name_ru, name_ua, country_code, geom)
        VALUES
          ('aov-from', 'Город-А', 'Місто-А', 'RU', ST_GeogFromText('SRID=4326;POINT(37.6 55.7)')),
          ('aov-to',   'Город-Б', 'Місто-Б', 'RU', ST_GeogFromText('SRID=4326;POINT(30.3 59.9)'))
        RETURNING id::text AS id
      `);
      const [fromCityId, toCityId] = (cityRows.rows as Array<{ id: string }>).map((r) => r.id);

      const clientRows = await app.db.execute(sql`
        INSERT INTO clients (name, phone, lang)
        VALUES ('Override Client', '+70000000099', 'ru')
        RETURNING id::text AS id
      `);
      const clientId = (clientRows.rows[0] as { id: string }).id;

      const orderRows = await app.db.execute(sql`
        INSERT INTO orders (number, status, version, price, currency, client_id, from_city_id, to_city_id)
        VALUES ('AOV-001', 'CREATED'::order_status, 1, 1000000, 'RUB', ${clientId}::uuid,
                ${fromCityId}::uuid, ${toCityId}::uuid)
        RETURNING id::text AS id
      `);
      orderId = (orderRows.rows[0] as { id: string }).id;
    });

    afterAll(async () => {
      if (app) await app.close();
      if (originalDbUrl !== undefined) process.env.DATABASE_URL = originalDbUrl;
      if (originalRedisUrl !== undefined) process.env.REDIS_URL = originalRedisUrl;
      const { stopPostgisContainer } = await import('../_helpers/test-db.js');
      await stopPostgisContainer();
    });

    it('PATCH /api/orders/:id/status bypasses FSM (CREATED→CANCELED) + writes admin_override event', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/orders/${orderId}/status`,
        payload: { status: 'CANCELED', reason: 'demo override' },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as Record<string, unknown>;
      expect(body.status).toBe('CANCELED');

      // Assert admin_override event row with correct actor + reason.
      const events = await app.db.execute(sql`
        SELECT type, actor, payload
        FROM order_events
        WHERE order_id = ${orderId}::uuid AND type = 'admin_override'
      `);
      const rows = events.rows as Array<{ type: string; actor: string; payload: Record<string, unknown> }>;
      expect(rows).toHaveLength(1);
      expect(rows[0]?.actor).toBe('manager');
      expect((rows[0]?.payload as Record<string, unknown>)?.reason).toBe('demo override');
    });

    it('PATCH with invalid status enum value → 400', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/orders/${orderId}/status`,
        payload: { status: 'INVALID_STATUS', reason: 'test' },
        headers: { 'content-type': 'application/json' },
      });
      expect(res.statusCode).toBe(400);
    });
  }
);
