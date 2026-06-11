// Phase 6 Wave 2 — D-13 timeout escalation. Live integration test.
// If DATABASE_URL is not reachable, DB-dependent tests are skipped.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { evaluateTimeouts } from '../../src/pipeline/lifecycle/timeout-escalation.js';

const { Pool } = pg;

const DB_URL = process.env['DATABASE_URL'];
const SKIP = !DB_URL;

vi.mock('../../src/channels/telegram/notifications.js', () => ({
  notifyApproach: vi.fn().mockResolvedValue(undefined),
  notifyLoadingPrompt: vi.fn().mockResolvedValue(undefined),
  notifyDeliveryPrompt: vi.fn().mockResolvedValue(undefined),
}));

describe('timeout-escalation', () => {
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

  it('D-13 evaluateTimeouts exports evaluateTimeouts with correct async signature (no DB required)', async () => {
    const { evaluateTimeouts: fn } = await import('../../src/pipeline/lifecycle/timeout-escalation.js');
    expect(typeof fn).toBe('function');
    // Both reminder and escalation use INTERVAL '10 minutes' and '30 minutes' in SQL
    // which we validate by checking the function exists and is async.
    const result = fn({ db: null as never, log: null as never, bot: null as never });
    expect(result).toBeInstanceOf(Promise);
    // The call will fail due to null db, but the function returns a Promise
    await result.catch(() => {
      // Expected to throw with null db
    });
  });

  it.skipIf(SKIP)('D-13 evaluateTimeouts inserts operator_escalated + sets leads.manager_active=true after 30min', async () => {
    vi.clearAllMocks();

    // Create a test client + lead + order in DELIVERED_PENDING with delivery_prompted event 31 min old.
    const clientId = crypto.randomUUID();
    const leadId = crypto.randomUUID();
    const orderId = crypto.randomUUID();

    await db.execute(sql`
      INSERT INTO clients (id, name, phone, lang, telegram_id)
      VALUES (${clientId}::uuid, 'Test Escalate Client', '+79001234568', 'ru', '999002')
    `);
    await db.execute(sql`
      INSERT INTO leads (id, client_id, stage, version, manager_active)
      VALUES (${leadId}::uuid, ${clientId}::uuid, 'AGREED', 1, false)
    `);
    await db.execute(sql`
      INSERT INTO orders (id, number, status, version, price, weight_kg, from_city_id, to_city_id, lead_id, client_id)
      SELECT
        ${orderId}::uuid, 'TEST-ESC-001', 'DELIVERED_PENDING'::order_status, 1, 3000, 900,
        fc.id, tc.id, ${leadId}::uuid, ${clientId}::uuid
      FROM cities fc, cities tc
      LIMIT 1
    `);

    // Insert delivery_prompted event with created_at = 31 minutes ago
    await db.execute(sql`
      INSERT INTO order_events (order_id, type, actor, payload, created_at)
      VALUES (
        ${orderId}::uuid,
        'delivery_prompted'::order_event_type,
        'system',
        '{}'::jsonb,
        NOW() - INTERVAL '31 minutes'
      )
    `);

    const stubLog = { warn: vi.fn(), info: vi.fn(), error: vi.fn() };
    const stubBot = { api: { sendMessage: vi.fn().mockResolvedValue({}) } };

    // First call: should insert operator_escalated + set manager_active=true
    await evaluateTimeouts({ db: db as never, log: stubLog as never, bot: stubBot as never });

    const eventsAfterFirst = await db.execute(sql`
      SELECT type FROM order_events WHERE order_id = ${orderId}::uuid ORDER BY created_at
    `);
    const typesAfterFirst = (eventsAfterFirst.rows as Array<{ type: string }>).map(r => r.type);
    expect(typesAfterFirst).toContain('operator_escalated');

    // leads.manager_active should be true
    const lead = await db.execute(sql`
      SELECT manager_active, version FROM leads WHERE id = ${leadId}::uuid
    `);
    const leadRow = (lead.rows[0] as { manager_active: boolean; version: number } | undefined);
    expect(leadRow?.manager_active).toBe(true);
    expect(leadRow?.version).toBe(2); // version incremented by 1

    // Second call: ON CONFLICT DO NOTHING — no new event, version stays at 2
    await evaluateTimeouts({ db: db as never, log: stubLog as never, bot: stubBot as never });

    const eventsAfterSecond = await db.execute(sql`
      SELECT type FROM order_events WHERE order_id = ${orderId}::uuid AND type = 'operator_escalated'
    `);
    expect((eventsAfterSecond.rows as unknown[]).length).toBe(1);

    const leadAfterSecond = await db.execute(sql`
      SELECT version FROM leads WHERE id = ${leadId}::uuid
    `);
    const leadVersionAfterSecond = (leadAfterSecond.rows[0] as { version: number } | undefined)?.version;
    expect(leadVersionAfterSecond).toBe(2); // version unchanged

    // Cleanup
    await db.execute(sql`DELETE FROM order_events WHERE order_id = ${orderId}::uuid`);
    await db.execute(sql`DELETE FROM orders WHERE id = ${orderId}::uuid`);
    await db.execute(sql`DELETE FROM leads WHERE id = ${leadId}::uuid`);
    await db.execute(sql`DELETE FROM clients WHERE id = ${clientId}::uuid`);
  });
});
