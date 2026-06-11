// NOTIF-01 — Wave 1 (Plan 05-01) flip.
//
// Asserts that for each of the 3 client-facing ORDER_TRANSITIONS
// (DRIVER_ASSIGNED, IN_TRANSIT, DELIVERED), invoking transitionOrder with an
// onSuccess hook that calls notifyClient(transition) yields exactly one mock
// bot sendMessage with the i18n template output for that transition × lang.
//
// Wave 1 audit (05-01-NOTIF-AUDIT.md) confirmed:
//   - DRIVER_ASSIGNED has a production caller in adapter.ts
//     tryAdvanceOrderAfterCreation (already covered by client-notifications.test.ts)
//   - IN_TRANSIT + DELIVERED have NO v1 production caller — geofence-driven
//     transitions deferred to v2 TRACK_V2-*
//
// This test exercises notifyClient via direct transitionOrder invocation for
// ALL 3 transitions to lock the wiring contract end-to-end. When v2 lands the
// geofence handler, it inherits a tested wire (D-02). The contract proved:
//   1. transitionOrder commits the FSM state change
//   2. onSuccess fires post-commit
//   3. notifyClient renders renderNotificationTemplate(transition, row, 'ru')
//   4. mock bot receives exactly one sendMessage with that string
//
// Idempotency guarantee — Phase 1's UNIQUE(order_id, type) on order_events
// ensures exactly one audit row per transition. notifyClient itself has no
// idempotency layer (its caller is responsible) — the FSM gate is the
// dedup boundary.
//
// Docker-gated. Skipped silently under AI_LOGIST_NO_DOCKER=1 (matches Phase 3
// integration pattern from client-notifications.test.ts).

import { exec as execCb } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Bot } from 'grammy';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type * as schema from '../../src/persistence/schema/index.js';
import { renderNotificationTemplate } from '../../src/lib/i18n.js';
import { createMockBot } from '../_helpers/telegram-mock.js';
import { getTestDbUrl, startPostgisContainer, stopPostgisContainer } from '../_helpers/test-db.js';

const exec = promisify(execCb);
const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

interface SeedContext {
  cityId: string;
  clientId: string;
  truckId: string;
  telegramId: string;
}

describe.skipIf(!dockerAvailable)(
  'NOTIF-01: ORDER_TRANSITIONS fire notifyClient post-commit',
  () => {
    let db: NodePgDatabase<typeof schema>;
    let pool: import('pg').Pool;
    let seed: SeedContext;

    beforeAll(async () => {
      const url = await startPostgisContainer();
      await exec('pnpm exec drizzle-kit migrate', {
        cwd: path.resolve(import.meta.dirname, '..', '..'),
        env: { ...process.env, DATABASE_URL: url },
      });

      const { Pool } = await import('pg');
      const { drizzle } = await import('drizzle-orm/node-postgres');
      const schemaModule = await import('../../src/persistence/schema/index.js');
      pool = new Pool({ connectionString: getTestDbUrl() });
      db = drizzle(pool, { schema: schemaModule }) as NodePgDatabase<typeof schema>;

      // Single set of fixtures reused across all 3 transitions (different
      // orders per transition to avoid status conflicts).
      const cityRows = await db.execute(sql`
        INSERT INTO cities (slug, name_ru, name_ua, country_code, geom)
        VALUES ('notif-01-fsm', 'Москва', 'Москва', 'RU',
                ST_GeogFromText('SRID=4326;POINT(37.62 55.75)'))
        RETURNING id::text AS id
      `);
      const cityId = (cityRows.rows[0] as { id: string }).id;

      const telegramId = '999050101';
      const clientRows = await db.execute(sql`
        INSERT INTO clients (name, phone, telegram_id, lang)
        VALUES ('NOTIF-01 Client', '+70000050101', ${telegramId}, 'ru')
        RETURNING id::text AS id
      `);
      const clientId = (clientRows.rows[0] as { id: string }).id;

      const truckRows = await db.execute(sql`
        INSERT INTO trucks (name, plate_number, driver_name, driver_phone, driver_telegram_id,
                            capacity_t, body_type, geom)
        VALUES ('Truck-N01', 'NN0101', 'Иван Логистов', '+70000050101', NULL,
                20, 'tent', ST_GeogFromText('SRID=4326;POINT(37.62 55.75)'))
        RETURNING id::text AS id
      `);
      const truckId = (truckRows.rows[0] as { id: string }).id;

      seed = { cityId, clientId, truckId, telegramId };
    }, 120_000);

    afterAll(async () => {
      await pool?.end();
      await stopPostgisContainer();
    });

    /**
     * Test helper: create an order in a specific starting status (raw UPDATE
     * to bypass the FSM since CREATED→AT_LOADING + AT_LOADING→IN_TRANSIT are
     * not direct edges) then transition it to `to` with the notifyClient
     * onSuccess hook and assert the rendered template was sent.
     */
    async function seedOrderAndAssertNotification(opts: {
      orderNumber: string;
      startingStatus: 'CREATED' | 'AT_LOADING' | 'IN_TRANSIT';
      transition: 'DRIVER_ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED';
    }): Promise<void> {
      const orderRows = await db.execute(sql`
        INSERT INTO orders (number, client_id, truck_id, from_city_id, to_city_id,
                            price, currency, status, public_token, version)
        VALUES (${opts.orderNumber}, ${seed.clientId}, ${seed.truckId},
                ${seed.cityId}, ${seed.cityId},
                5500000, 'RUB',
                ${opts.startingStatus}::order_status,
                ${`tok-${opts.orderNumber}`}, 0)
        RETURNING id::text AS id
      `);
      const orderId = (orderRows.rows[0] as { id: string }).id;

      const handle = createMockBot();
      const log = makeSilentLog();

      const { transitionOrder } = await import('../../src/pipeline/lifecycle/order-fsm.js');
      const { notifyClient } = await import('../../src/channels/telegram/notifications.js');

      // Promise resolver so the test can await the fire-and-forget onSuccess.
      let resolveDone: () => void = () => {
        /* */
      };
      const done = new Promise<void>((r) => {
        resolveDone = r;
      });

      const before = handle.sent.length;
      await transitionOrder(db, {
        orderId,
        to: opts.transition,
        actor: 'system',
        payload: { test: 'notif-01', transition: opts.transition },
        onSuccess: async () => {
          try {
            await notifyClient({
              orderId,
              transition: opts.transition,
              db,
              bot: handle.bot as unknown as Bot,
              log,
            });
          } finally {
            resolveDone();
          }
        },
      });

      await done;

      // Exactly one sendMessage per transition.
      expect(handle.sent.length).toBe(before + 1);
      const last = handle.sent[handle.sent.length - 1];
      expect(last?.chatId).toBe(seed.telegramId);

      // Asserted text matches renderNotificationTemplate(transition, row, 'ru')
      // where row mirrors the SELECT inside notifyClient.
      const expected = renderNotificationTemplate(
        opts.transition,
        {
          number: opts.orderNumber,
          plate_number: 'NN0101',
          driver_name: 'Иван Логистов',
          driver_phone: '+70000050101',
        },
        'ru'
      );
      expect(last?.text).toBe(expected);

      // FSM post-state confirmation.
      const statusRows = await db.execute(sql`
        SELECT status::text AS status FROM orders WHERE id = ${orderId}
      `);
      expect((statusRows.rows[0] as { status: string }).status).toBe(opts.transition);
    }

    it('DRIVER_ASSIGNED transition invokes notifyClient with rendered template', async () => {
      await seedOrderAndAssertNotification({
        orderNumber: 'KU-N0101',
        startingStatus: 'CREATED',
        transition: 'DRIVER_ASSIGNED',
      });
    });

    it('IN_TRANSIT transition invokes notifyClient with rendered template', async () => {
      await seedOrderAndAssertNotification({
        orderNumber: 'KU-N0102',
        startingStatus: 'AT_LOADING',
        transition: 'IN_TRANSIT',
      });
    });

    it('DELIVERED transition invokes notifyClient with rendered template', async () => {
      await seedOrderAndAssertNotification({
        orderNumber: 'KU-N0103',
        startingStatus: 'IN_TRANSIT',
        transition: 'DELIVERED',
      });
    });
  }
);

function makeSilentLog(
  overrides: Partial<Record<string, unknown>> = {}
): import('fastify').FastifyBaseLogger {
  const noop = () => {
    /* no-op */
  };
  const base = {
    level: 'silent',
    fatal: noop,
    error: noop,
    warn: noop,
    info: noop,
    debug: noop,
    trace: noop,
    silent: noop,
    child: () => base,
    bindings: () => ({}),
    flush: noop,
    isLevelEnabled: () => false,
    levels: {
      values: { fatal: 60, error: 50, warn: 40, info: 30, debug: 20, trace: 10, silent: Infinity },
      labels: { 60: 'fatal', 50: 'error', 40: 'warn', 30: 'info', 20: 'debug', 10: 'trace' },
    },
    levelVal: 60,
    ...overrides,
  } as unknown as import('fastify').FastifyBaseLogger;
  return base;
}
