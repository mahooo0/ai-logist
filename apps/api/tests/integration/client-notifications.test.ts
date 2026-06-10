// Phase 3 Plan 03-04 — TG-07 client Telegram notification coverage.
//
// Validates `notifyClient` + the order-fsm onSuccess hook flow:
//   (a) seed order in CREATED + client with telegram_id + lang='ru' →
//       transitionOrder→DRIVER_ASSIGNED with onSuccess: notifyClient(...) →
//       mock.bot.api.sendMessage called once with i18n RU template containing
//       order number + truck plate.
//   (b) client with telegram_id=NULL → notifyClient called directly → no
//       sendMessage emitted (D-26 silent skip).
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

describe.skipIf(!dockerAvailable)('client status notifications (TG-07)', () => {
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

  it('transitionOrder DRIVER_ASSIGNED → notifyClient sends RU i18n template', async () => {
    // Seed: city + client (lang=ru, telegram_id) + truck + order in CREATED.
    const cityRows = await db.execute(sql`
      INSERT INTO cities (slug, name_ru, name_ua, country_code, geom)
      VALUES ('tg-07-a', 'Москва', 'Москва', 'RU',
              ST_GeogFromText('SRID=4326;POINT(37.62 55.75)'))
      RETURNING id::text AS id
    `);
    const cityId = (cityRows.rows[0] as { id: string }).id;

    const clientRows = await db.execute(sql`
      INSERT INTO clients (name, phone, telegram_id, lang)
      VALUES ('TG-07 Client', '+70000099701', '999700001', 'ru')
      RETURNING id::text AS id
    `);
    const clientId = (clientRows.rows[0] as { id: string }).id;

    const truckRows = await db.execute(sql`
      INSERT INTO trucks (name, plate_number, driver_name, driver_phone, driver_telegram_id,
                          capacity_t, body_type, geom)
      VALUES ('Truck-X1', 'XX0701', 'Игорь Кузнецов', '+70000099701', NULL,
              20, 'tent', ST_GeogFromText('SRID=4326;POINT(37.62 55.75)'))
      RETURNING id::text AS id
    `);
    const truckId = (truckRows.rows[0] as { id: string }).id;

    const orderRows = await db.execute(sql`
      INSERT INTO orders (number, client_id, truck_id, from_city_id, to_city_id,
                          price, currency, status, public_token, version)
      VALUES ('KU-T0701', ${clientId}, ${truckId}, ${cityId}, ${cityId},
              5500000, 'RUB', 'CREATED', 'tok-t0701', 0)
      RETURNING id::text AS id
    `);
    const orderId = (orderRows.rows[0] as { id: string }).id;

    const handle = createMockBot();
    const log = makeSilentLog();

    const { transitionOrder } = await import('../../src/pipeline/lifecycle/order-fsm.js');
    const { notifyClient } = await import('../../src/channels/telegram/notifications.js');

    // Promise we can resolve from inside the onSuccess hook so the test can
    // await the fire-and-forget notification path.
    let resolveDone: () => void = () => {
      /* */
    };
    const done = new Promise<void>((r) => {
      resolveDone = r;
    });

    const before = handle.sent.length;
    await transitionOrder(db, {
      orderId,
      to: 'DRIVER_ASSIGNED',
      actor: 'ai',
      payload: { auto: true },
      onSuccess: async (result) => {
        try {
          await notifyClient({
            orderId,
            transition: 'DRIVER_ASSIGNED',
            db,
            bot: handle.bot as unknown as Bot,
            log,
          });
          expect(result.to).toBe('DRIVER_ASSIGNED');
        } finally {
          resolveDone();
        }
      },
    });

    await done;
    expect(handle.sent.length).toBe(before + 1);
    const last = handle.sent[handle.sent.length - 1];
    expect(last?.chatId).toBe('999700001');
    expect(last?.text).toMatch(/Машина назначена/);
    expect(last?.text).toContain('KU-T0701');
    expect(last?.text).toContain('XX0701');
  });

  it('client without telegram_id → notifyClient skips silently', async () => {
    const cityRows = await db.execute(sql`
      INSERT INTO cities (slug, name_ru, name_ua, country_code, geom)
      VALUES ('tg-07-b', 'Минск', 'Мінськ', 'BY',
              ST_GeogFromText('SRID=4326;POINT(27.55 53.90)'))
      RETURNING id::text AS id
    `);
    const cityId = (cityRows.rows[0] as { id: string }).id;

    const clientRows = await db.execute(sql`
      INSERT INTO clients (name, phone, telegram_id, lang)
      VALUES ('TG-07 Voice Client', '+70000099702', NULL, 'ru')
      RETURNING id::text AS id
    `);
    const clientId = (clientRows.rows[0] as { id: string }).id;

    const truckRows = await db.execute(sql`
      INSERT INTO trucks (name, plate_number, driver_name, driver_phone, driver_telegram_id,
                          capacity_t, body_type, geom)
      VALUES ('Truck-Y2', 'YY0702', 'Петр Орлов', '+70000099702', NULL,
              22, 'ref', ST_GeogFromText('SRID=4326;POINT(27.55 53.90)'))
      RETURNING id::text AS id
    `);
    const truckId = (truckRows.rows[0] as { id: string }).id;

    const orderRows = await db.execute(sql`
      INSERT INTO orders (number, client_id, truck_id, from_city_id, to_city_id,
                          price, currency, status, public_token, version)
      VALUES ('KU-T0702', ${clientId}, ${truckId}, ${cityId}, ${cityId},
              7000000, 'RUB', 'CREATED', 'tok-t0702', 0)
      RETURNING id::text AS id
    `);
    const orderId = (orderRows.rows[0] as { id: string }).id;

    const handle = createMockBot();
    const infos: string[] = [];
    const log = makeSilentLog({
      info: (_obj: unknown, msg: string) => {
        infos.push(msg);
      },
    });

    const { notifyClient } = await import('../../src/channels/telegram/notifications.js');
    const before = handle.sent.length;
    await notifyClient({
      orderId,
      transition: 'DRIVER_ASSIGNED',
      db,
      bot: handle.bot as unknown as Bot,
      log,
    });

    expect(handle.sent.length).toBe(before);
    expect(infos.some((m) => /no telegram_id/.test(m))).toBe(true);
  });
});

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
