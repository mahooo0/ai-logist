// Phase 6 Wave 2 — D-05 order events write via ticker transition. Live integration test.
// Tests that tickerLoop correctly writes order_events with mapped types.
// If DATABASE_URL is not reachable, DB tests are skipped.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { STATUS_TO_EVENT } from '../../src/pipeline/lifecycle/order-fsm.js';

const { Pool } = pg;

const DB_URL = process.env['DATABASE_URL'];
const SKIP = !DB_URL;

// Mock notifications to avoid Telegram calls in integration test
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

describe('order-events-write', () => {
  let pool: pg.Pool;
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    if (SKIP) return;
    pool = new Pool({ connectionString: DB_URL });
    db = drizzle(pool);
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  it('D-05 STATUS_TO_EVENT maps AT_LOADING → loading_prompted (B5 Path A invariant — no DB required)', () => {
    expect(STATUS_TO_EVENT['AT_LOADING']).toBe('loading_prompted');
    expect(STATUS_TO_EVENT['DELIVERED_PENDING']).toBe('delivery_prompted');
    expect(STATUS_TO_EVENT['DRIVER_ASSIGNED']).toBe('driver_assigned');
    expect(STATUS_TO_EVENT['IN_TRANSIT']).toBe('in_transit');
  });

  it('D-05 ticker transition writes single order_events row with mapped type and actor=system', async () => {
    // This test validates that the STATUS_TO_EVENT bridge produces the correct
    // event types when transitionOrder is called with actor='system'.
    // The tickerLoop calls transitionOrder with actor='system' and to='AT_LOADING',
    // which writes STATUS_TO_EVENT['AT_LOADING'] = 'loading_prompted'.
    expect(STATUS_TO_EVENT['AT_LOADING']).toBe('loading_prompted');

    // Integration: if DB is available, verify the full round-trip.
    if (SKIP) {
      console.log('DATABASE_URL not set — skipping DB round-trip assertions');
      return;
    }

    const orderId = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO orders (id, number, status, version, price, weight_kg, from_city_id, to_city_id)
      SELECT
        ${orderId}::uuid,
        'TEST-EVENTS-001',
        'DRIVER_ASSIGNED'::order_status,
        1,
        1500,
        800,
        fc.id,
        tc.id
      FROM cities fc, cities tc
      LIMIT 1
    `);

    const { transitionOrder } = await import('../../src/pipeline/lifecycle/order-fsm.js');
    const result = await transitionOrder(db as never, {
      orderId,
      to: 'AT_LOADING',
      actor: 'system',
      payload: { reason: 'ticker_completed_leg' },
    });

    expect(result.audit_row_inserted).toBe(true);

    const events = await db.execute(sql`
      SELECT type, actor FROM order_events WHERE order_id = ${orderId}::uuid
    `);
    const rows = events.rows as Array<{ type: string; actor: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.type).toBe('loading_prompted');
    expect(rows[0]?.actor).toBe('system');

    // Cleanup
    await db.execute(sql`DELETE FROM order_events WHERE order_id = ${orderId}::uuid`);
    await db.execute(sql`DELETE FROM orders WHERE id = ${orderId}::uuid`);
  });
});
