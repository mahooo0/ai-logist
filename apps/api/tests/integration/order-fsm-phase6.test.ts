// Phase 6 Wave 2 — D-11 order FSM phase 6 edges. Live integration test.
// Tests each of the 8 new ORDER_TRANSITIONS edges using a real DB (testcontainer).
// If DATABASE_URL is not reachable, tests are skipped with a clear message.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { transitionOrder, ORDER_TRANSITIONS } from '../../src/pipeline/lifecycle/order-fsm.js';

const { Pool } = pg;

const DB_URL = process.env['DATABASE_URL'];
const SKIP = !DB_URL;

describe('order-fsm-phase6', () => {
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

  it.skipIf(SKIP)('D-11 ORDER_TRANSITIONS contains DRIVER_ASSIGNED → AT_LOADING edge', () => {
    expect(ORDER_TRANSITIONS['DRIVER_ASSIGNED']).toContain('AT_LOADING');
  });

  it.skipIf(SKIP)('D-11 ORDER_TRANSITIONS contains AT_LOADING → IN_TRANSIT edge', () => {
    expect(ORDER_TRANSITIONS['AT_LOADING']).toContain('IN_TRANSIT');
  });

  it.skipIf(SKIP)('D-11 ORDER_TRANSITIONS contains AT_LOADING → CANCELED edge', () => {
    expect(ORDER_TRANSITIONS['AT_LOADING']).toContain('CANCELED');
  });

  it.skipIf(SKIP)('D-11 ORDER_TRANSITIONS contains IN_TRANSIT → DELIVERED_PENDING edge', () => {
    expect(ORDER_TRANSITIONS['IN_TRANSIT']).toContain('DELIVERED_PENDING');
  });

  it.skipIf(SKIP)('D-11 ORDER_TRANSITIONS contains DELIVERED_PENDING → AWAITING_PAYMENT edge', () => {
    expect(ORDER_TRANSITIONS['DELIVERED_PENDING']).toContain('AWAITING_PAYMENT');
  });

  it.skipIf(SKIP)('D-11 ORDER_TRANSITIONS contains DELIVERED_PENDING → CANCELED edge', () => {
    expect(ORDER_TRANSITIONS['DELIVERED_PENDING']).toContain('CANCELED');
  });

  it.skipIf(SKIP)('D-11 ORDER_TRANSITIONS contains AWAITING_PAYMENT → CLOSED edge', () => {
    expect(ORDER_TRANSITIONS['AWAITING_PAYMENT']).toContain('CLOSED');
  });

  it.skipIf(SKIP)('D-11 ORDER_TRANSITIONS contains CREATED → DRIVER_ASSIGNED edge', () => {
    expect(ORDER_TRANSITIONS['CREATED']).toContain('DRIVER_ASSIGNED');
  });

  it('D-11 all 8 new ORDER_TRANSITIONS edges declared in FSM (unit check — no DB required)', () => {
    // Pure unit check — validates ORDER_TRANSITIONS table without DB.
    expect(ORDER_TRANSITIONS['DRIVER_ASSIGNED']).toContain('AT_LOADING');
    expect(ORDER_TRANSITIONS['AT_LOADING']).toContain('IN_TRANSIT');
    expect(ORDER_TRANSITIONS['AT_LOADING']).toContain('CANCELED');
    expect(ORDER_TRANSITIONS['IN_TRANSIT']).toContain('DELIVERED_PENDING');
    expect(ORDER_TRANSITIONS['DELIVERED_PENDING']).toContain('AWAITING_PAYMENT');
    expect(ORDER_TRANSITIONS['DELIVERED_PENDING']).toContain('CANCELED');
    expect(ORDER_TRANSITIONS['AWAITING_PAYMENT']).toContain('CLOSED');
    expect(ORDER_TRANSITIONS['CREATED']).toContain('DRIVER_ASSIGNED');
  });

  it.skipIf(SKIP)('D-11 transitionOrder DRIVER_ASSIGNED → AT_LOADING writes loading_prompted event', async () => {
    // Insert a minimal order row in DRIVER_ASSIGNED status.
    const orderId = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO orders (id, number, status, version, price, weight_kg, from_city_id, to_city_id)
      SELECT
        ${orderId}::uuid,
        'TEST-FSM-001',
        'DRIVER_ASSIGNED'::order_status,
        1,
        1000,
        500,
        fc.id,
        tc.id
      FROM cities fc, cities tc
      LIMIT 1
    `);

    const result = await transitionOrder(db as never, {
      orderId,
      to: 'AT_LOADING',
      actor: 'system',
      payload: { reason: 'ticker_completed_leg' },
    });

    expect(result.from).toBe('DRIVER_ASSIGNED');
    expect(result.to).toBe('AT_LOADING');
    expect(result.version).toBe(2);

    // Verify event was written
    const events = await db.execute(sql`
      SELECT type FROM order_events WHERE order_id = ${orderId}::uuid
    `);
    const types = (events.rows as Array<{ type: string }>).map(r => r.type);
    expect(types).toContain('loading_prompted');

    // Cleanup
    await db.execute(sql`DELETE FROM order_events WHERE order_id = ${orderId}::uuid`);
    await db.execute(sql`DELETE FROM orders WHERE id = ${orderId}::uuid`);
  });
});
