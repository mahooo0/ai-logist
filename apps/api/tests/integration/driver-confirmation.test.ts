// Phase 3 Plan 03-04 — TG-05 driver Telegram notification coverage.
//
// Validates `notifyDriver` against a real Postgres + mock Bot:
//   (a) truck has driver_telegram_id → bot.api.sendMessage called once with
//       driverKeyboard reply_markup + HTML parse_mode.
//   (b) truck has driver_telegram_id=null → no sendMessage; only the logged
//       "simulated auto-accept" warn is emitted (RESEARCH D-18 stub flow).
//
// Docker-gated. Skipped silently when AI_LOGIST_NO_DOCKER=1.

import { exec as execCb } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Bot } from 'grammy';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type * as schema from '../../src/persistence/schema/index.js';
import { createMockBot } from '../_helpers/telegram-mock.js';
import { getTestDbUrl, startPostgisContainer, stopPostgisContainer } from '../_helpers/test-db.js';

const exec = promisify(execCb);
const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('driver Telegram notification (TG-05)', () => {
  let db: NodePgDatabase<typeof schema>;
  let pool: import('pg').Pool;

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
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await stopPostgisContainer();
  });

  it('driver_telegram_id present → bot.api.sendMessage with driverKeyboard', async () => {
    // Seed: city + client + truck (with driver_telegram_id) + order in CREATED.
    const cityRows = await db.execute(sql`
      INSERT INTO cities (slug, name_ru, name_ua, country_code, geom)
      VALUES ('tg-05-a', 'Киев', 'Київ', 'UA',
              ST_GeogFromText('SRID=4326;POINT(30.52 50.45)'))
      RETURNING id::text AS id
    `);
    const cityId = (cityRows.rows[0] as { id: string }).id;

    const clientRows = await db.execute(sql`
      INSERT INTO clients (name, phone, telegram_id, lang)
      VALUES ('TG-05 Client', '+70000099501', '999500001', 'ru')
      RETURNING id::text AS id
    `);
    const clientId = (clientRows.rows[0] as { id: string }).id;

    const truckRows = await db.execute(sql`
      INSERT INTO trucks (name, plate_number, driver_name, driver_phone, driver_telegram_id,
                          capacity_t, body_type, geom)
      VALUES ('Truck-A1', 'AA1234', 'Иван Петров', '+70000099001', '888500001',
              20, 'tent', ST_GeogFromText('SRID=4326;POINT(30.52 50.45)'))
      RETURNING id::text AS id
    `);
    const truckId = (truckRows.rows[0] as { id: string }).id;

    const orderRows = await db.execute(sql`
      INSERT INTO orders (number, client_id, truck_id, from_city_id, to_city_id,
                          price, currency, status, public_token)
      VALUES ('KU-T0501', ${clientId}, ${truckId}, ${cityId}, ${cityId},
              5000000, 'RUB', 'CREATED', 'tok-t0501')
      RETURNING id::text AS id
    `);
    const orderId = (orderRows.rows[0] as { id: string }).id;

    const handle = createMockBot();
    const { notifyDriver } = await import('../../src/channels/telegram/notifications.js');
    const before = handle.sent.length;
    await notifyDriver({
      orderId,
      db,
      bot: handle.bot as unknown as Bot,
      log: makeSilentLog(),
    });

    expect(handle.sent.length).toBe(before + 1);
    const last = handle.sent[handle.sent.length - 1];
    expect(last?.chatId).toBe('888500001');
    expect(typeof last?.text).toBe('string');
    expect(last?.text).toMatch(/Новый рейс/);
    expect(last?.text).toContain('KU-T0501');
    expect(last?.text).toContain('AA1234');
    expect(last?.parseMode).toBe('HTML');
    // reply_markup is grammY's InlineKeyboard instance — has `inline_keyboard`
    // field with 1 row of 2 buttons.
    const replyMarkup = last?.replyMarkup as { inline_keyboard: unknown[][] } | undefined;
    expect(Array.isArray(replyMarkup?.inline_keyboard)).toBe(true);
    expect(replyMarkup?.inline_keyboard?.[0]?.length).toBe(2);
  });

  it('driver_telegram_id null → log warn, no sendMessage emitted', async () => {
    const cityRows = await db.execute(sql`
      INSERT INTO cities (slug, name_ru, name_ua, country_code, geom)
      VALUES ('tg-05-b', 'Львов', 'Львів', 'UA',
              ST_GeogFromText('SRID=4326;POINT(24.03 49.84)'))
      RETURNING id::text AS id
    `);
    const cityId = (cityRows.rows[0] as { id: string }).id;

    const clientRows = await db.execute(sql`
      INSERT INTO clients (name, phone, telegram_id, lang)
      VALUES ('TG-05 Stub Client', '+70000099502', '999500002', 'ru')
      RETURNING id::text AS id
    `);
    const clientId = (clientRows.rows[0] as { id: string }).id;

    const truckRows = await db.execute(sql`
      INSERT INTO trucks (name, plate_number, driver_name, driver_phone, driver_telegram_id,
                          capacity_t, body_type, geom)
      VALUES ('Truck-B2', 'BB5678', 'Олег Сидоров', '+70000099002', NULL,
              22, 'ref', ST_GeogFromText('SRID=4326;POINT(24.03 49.84)'))
      RETURNING id::text AS id
    `);
    const truckId = (truckRows.rows[0] as { id: string }).id;

    const orderRows = await db.execute(sql`
      INSERT INTO orders (number, client_id, truck_id, from_city_id, to_city_id,
                          price, currency, status, public_token)
      VALUES ('KU-T0502', ${clientId}, ${truckId}, ${cityId}, ${cityId},
              6000000, 'RUB', 'CREATED', 'tok-t0502')
      RETURNING id::text AS id
    `);
    const orderId = (orderRows.rows[0] as { id: string }).id;

    const handle = createMockBot();
    const warns: Array<{ obj: unknown; msg: string }> = [];
    const log = makeSilentLog({
      warn: (obj: unknown, msg: string) => {
        warns.push({ obj, msg });
      },
    });
    const { notifyDriver } = await import('../../src/channels/telegram/notifications.js');
    const before = handle.sent.length;
    await notifyDriver({ orderId, db, bot: handle.bot as unknown as Bot, log });

    expect(handle.sent.length).toBe(before);
    expect(warns.some((w) => /simulated auto-accept/.test(w.msg))).toBe(true);
  });
});

/**
 * Minimal FastifyBaseLogger duck-type. Tests can override warn/info/error.
 */
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
