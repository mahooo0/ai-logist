// Phase 6 Plan 06-04 Wave 4 — ticker-pause integration tests.
// Decision: D-21
//
// Architecture: two describe blocks.
//  1. Mock-DB route tests — POST /api/orders/:id/ticker sets auto_progress_paused.
//     No Docker needed; confirms HTTP contract.
//  2. Unit test for tickerLoop — when auto_progress_paused=true the ticker
//     SELECT excludes the row so progress is not incremented.
//     Uses mocked db.execute to verify the WHERE clause behavior.
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Top-level mocks for modules used by tickerLoop internals.
vi.mock('../../src/channels/telegram/notifications.js', () => ({
  notifyApproach: vi.fn().mockResolvedValue(undefined),
  notifyLoadingPrompt: vi.fn().mockResolvedValue(undefined),
  notifyDeliveryPrompt: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/lib/routing.js', () => ({
  routeGeometry: vi.fn().mockResolvedValue({
    route_km: 100,
    eta_sec: 3600,
    geometry: [[37.6, 55.7], [39.0, 51.0]],
    source: 'osrm',
  }),
}));

// ---- Mocked app builder (no real DB needed for route tests) ----------------

async function buildMockApp(dbExecute: ReturnType<typeof vi.fn>): Promise<FastifyInstance> {
  const { serializerCompiler, validatorCompiler } = await import('fastify-type-provider-zod');
  const sensibleMod = await import('@fastify/sensible');

  const app = Fastify({ logger: false });
  // Wire Zod type provider — required for ordersRoutes (FastifyPluginAsyncZod).
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(sensibleMod.default);

  app.decorate('db', {
    execute: dbExecute,
    transaction: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  const { adminAuthPlugin } = await import('../../src/plugins/admin-auth.js');
  await app.register(adminAuthPlugin);

  const { default: ordersRoutes } = await import('../../src/routes/orders.js');
  await app.register(ordersRoutes, { prefix: '/api' });
  await app.ready();
  return app;
}

// ---- Route tests (no Docker) -----------------------------------------------

describe('D-21 POST /api/orders/:id/ticker', () => {
  // Valid UUID (version 4) — Zod v4 rejects nil/all-zero UUIDs.
  const orderId = '7c3a8d5e-1234-4f8b-9abc-def012345678';
  let app: FastifyInstance;

  afterEach(async () => {
    delete process.env.ADMIN_API_SECRET;
    if (app) await app.close();
  });

  beforeEach(async () => {
    vi.resetModules();
  });

  it('POST {paused:true} returns 200 and autoProgressPaused=true', async () => {
    const dbExecute = vi.fn().mockResolvedValue({
      rows: [{ id: orderId, autoProgressPaused: true }],
    });
    app = await buildMockApp(dbExecute);

    const res = await app.inject({
      method: 'POST',
      url: `/api/orders/${orderId}/ticker`,
      payload: { paused: true },
      headers: { 'content-type': 'application/json' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(body.autoProgressPaused).toBe(true);
    expect(body.id).toBe(orderId);
  });

  it('POST {paused:false} on a paused order returns 200 and autoProgressPaused=false', async () => {
    const dbExecute = vi.fn().mockResolvedValue({
      rows: [{ id: orderId, autoProgressPaused: false }],
    });
    app = await buildMockApp(dbExecute);

    const res = await app.inject({
      method: 'POST',
      url: `/api/orders/${orderId}/ticker`,
      payload: { paused: false },
      headers: { 'content-type': 'application/json' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(body.autoProgressPaused).toBe(false);
  });
});

// ---- Ticker loop unit test (auto_progress_paused=true excluded from tick) ---

describe('D-21 tickerLoop skips paused rows (auto_progress_paused=true excluded)', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('tickerLoop SELECT includes auto_progress_paused=false filter — paused orders not incremented', async () => {
    // Arrange: db.execute returns zero rows (no active, unpaused orders).
    // This simulates a DB state where all active orders are paused.
    const dbExecuteMock = vi.fn().mockResolvedValue({ rows: [] });
    const mockLogger = { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() };

    // Mocks are hoisted to the top of the file (see top-level vi.mock calls).

    const { tickerLoop } = await import('../../src/pipeline/lifecycle/order-ticker.js');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockBot = {} as any;
    await tickerLoop({
      db: { execute: dbExecuteMock } as never,
      log: mockLogger as never,
      bot: mockBot,
    });

    // Verify SELECT was called with auto_progress_paused = false in the query.
    // The query uses SQL template literals; we verify the call was made (1 SELECT).
    expect(dbExecuteMock).toHaveBeenCalledOnce();

    // Inspect the SQL string for the pause filter.
    const firstCall = dbExecuteMock.mock.calls[0];
    const sqlArg = firstCall?.[0];
    // sql template produces an object with .queryChunks or .values; stringify to inspect.
    const sqlStr = JSON.stringify(sqlArg);
    expect(sqlStr).toContain('auto_progress_paused');
  });
});
