// Phase 6 Wave 1 — integration test for decline-path (D-14).
// Plan: 06-01 Wave 1
//
// B3 race-condition handling: transitionOrder.onSuccess is fire-and-forget.
// Truck update, lead update, event insert, and bot reply all happen inside the
// post-commit hook which is NOT awaited before transitionOrder returns.
// Tests use vi.waitFor({ timeout: 2000 }) to drain the async side effects.
import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startPostgisContainer, stopPostgisContainer } from '../_helpers/test-db.js';
import { handleDecline } from '../../src/channels/telegram/handlers.js';
import type { FastifyInstance } from 'fastify';
import type { Bot } from 'grammy';
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const exec = promisify(execCb);
const { Pool } = pg;

const RUN_INTEGRATION = process.env.AI_LOGIST_SKIP_INTEGRATION !== '1';
const describeIf = RUN_INTEGRATION ? describe : describe.skip;

// biome-ignore lint/suspicious/noExplicitAny: Drizzle Db type does not need full schema narrowing in tests.
describeIf('decline-path', () => {
  // biome-ignore lint/suspicious/noExplicitAny: see above
  let db: NodePgDatabase<any>;
  let pool: pg.Pool;

  beforeAll(async () => {
    const dbUrl = await startPostgisContainer();
    process.env.DATABASE_URL = dbUrl;
    process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

    const cwd = path.resolve(import.meta.dirname, '..', '..');
    await exec('pnpm exec drizzle-kit migrate', {
      cwd,
      env: { ...process.env, DATABASE_URL: dbUrl },
    });
    // Seed cities table so INSERT INTO orders can find city IDs.
    await exec('pnpm exec tsx src/seed/run.ts', {
      cwd,
      env: { ...process.env, DATABASE_URL: dbUrl },
    }).catch(() => {
      /* seed errors are non-fatal if cities already exist */
    });

    pool = new Pool({ connectionString: dbUrl });
    db = drizzle(pool);
  }, 180_000);

  afterAll(async () => {
    if (pool) await pool.end();
    await stopPostgisContainer();
  });

  it('D-14 decline_loading → CANCELED + truck.status=available + leads.manager_active=true + loading_declined event', async () => {
    const truckId = crypto.randomUUID();
    const clientId = crypto.randomUUID();
    const leadId = crypto.randomUUID();
    const orderId = crypto.randomUUID();

    const mockSendMessage = vi.fn().mockResolvedValue({});
    const mockBot = { api: { sendMessage: mockSendMessage } } as unknown as Bot;

    const mockLog = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    const app = {
      db: db as unknown as FastifyInstance['db'],
      log: mockLog,
    } as unknown as FastifyInstance;

    // Insert truck with status=busy
    await db.execute(sql`
      INSERT INTO trucks (id, plate_number, driver_name, status, body_type, capacity_tons, location)
      VALUES (
        ${truckId}::uuid,
        'TST-' || LEFT(${truckId}, 6),
        'Test Driver',
        'busy',
        'tent',
        20,
        ST_GeogFromText('SRID=4326;POINT(30.5 50.4)')
      )
    `);

    // Insert client with telegram_id so reply fires
    await db.execute(sql`
      INSERT INTO clients (id, telegram_id, lang, name)
      VALUES (${clientId}::uuid, '999000111', 'ru', 'Test Client Decline')
      ON CONFLICT (telegram_id) DO UPDATE SET name = 'Test Client Decline'
    `);

    // Insert lead with manager_active=false
    await db.execute(sql`
      INSERT INTO leads (id, client_id, status, manager_active)
      VALUES (${leadId}::uuid, ${clientId}::uuid, 'ORDER_CREATED', false)
    `);

    // Insert order in AT_LOADING status
    await db.execute(sql`
      INSERT INTO orders (id, number, client_id, lead_id, truck_id, status, price, from_city_id, to_city_id)
      SELECT
        ${orderId}::uuid,
        'KU-TEST-' || LEFT(${orderId}, 6),
        ${clientId}::uuid,
        ${leadId}::uuid,
        ${truckId}::uuid,
        'AT_LOADING',
        1000000,
        (SELECT id FROM cities LIMIT 1),
        (SELECT id FROM cities OFFSET 1 LIMIT 1)
    `);

    await handleDecline({
      orderId,
      action: 'decline_loading',
      app,
      bot: mockBot,
    });

    // 1. Status flips immediately inside transitionOrder's transaction — safe to assert without waitFor.
    const oRow = await db.execute(sql`SELECT status FROM orders WHERE id=${orderId}::uuid`);
    expect((oRow.rows[0] as { status: string }).status).toBe('CANCELED');

    // 2. Truck + lead + event row land inside the post-commit onSuccess hook —
    //    fire-and-forget per order-fsm.ts. Use vi.waitFor to drain.
    await vi.waitFor(
      async () => {
        const evt = await db.execute(sql`
          SELECT type FROM order_events
          WHERE order_id=${orderId}::uuid
            AND type IN ('loading_declined', 'delivery_declined')
        `);
        expect(evt.rows.length).toBeGreaterThan(0);
      },
      { timeout: 2000 }
    );

    await vi.waitFor(
      async () => {
        const t = await db.execute(sql`SELECT status FROM trucks WHERE id=${truckId}::uuid`);
        expect((t.rows[0] as { status: string }).status).toBe('available');
      },
      { timeout: 2000 }
    );

    await vi.waitFor(
      async () => {
        const l = await db.execute(
          sql`SELECT manager_active FROM leads WHERE id=${leadId}::uuid`
        );
        expect((l.rows[0] as { manager_active: boolean }).manager_active).toBe(true);
      },
      { timeout: 2000 }
    );

    // 3. Bot reply also fires inside onSuccess.
    await vi.waitFor(
      () => {
        expect(mockSendMessage).toHaveBeenCalledWith(
          expect.anything(),
          expect.stringContaining('Хорошо, передаю коллеге')
        );
      },
      { timeout: 2000 }
    );

    // Cleanup
    await db.execute(sql`DELETE FROM order_events WHERE order_id=${orderId}::uuid`).catch(() => {});
    await db.execute(sql`DELETE FROM orders WHERE id=${orderId}::uuid`).catch(() => {});
    await db.execute(sql`DELETE FROM leads WHERE id=${leadId}::uuid`).catch(() => {});
    await db.execute(sql`DELETE FROM trucks WHERE id=${truckId}::uuid`).catch(() => {});
    await db.execute(sql`DELETE FROM clients WHERE id=${clientId}::uuid`).catch(() => {});
  });
});
