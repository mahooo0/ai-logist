// Phase 4 Plan 04-03 — GET /api/orders/:id integration coverage (API-04 detail).

import { exec as execCb } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPostgisContainer, stopPostgisContainer } from '../_helpers/test-db.js';

const exec = promisify(execCb);
const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('Phase 4 API-04 — GET /api/orders/:id (detail)', () => {
  let app: FastifyInstance;
  let originalDbUrl: string | undefined;
  let originalRedisUrl: string | undefined;
  let orderId: string;

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

    // Seed: 2 cities + 1 client + 1 truck + 1 lead + 1 order + 3 order_events.
    const cityRows = await app.db.execute(sql`
      INSERT INTO cities (slug, name_ru, name_ua, country_code, geom)
      VALUES
        ('msk-d', 'Москва-Д', 'Москва-Д', 'RU', ST_GeogFromText('SRID=4326;POINT(37.6 55.7)')),
        ('spb-d', 'Санкт-Петербург-Д', 'Санкт-Петербург-Д', 'RU', ST_GeogFromText('SRID=4326;POINT(30.3 59.9)'))
      RETURNING id::text AS id, slug
    `);
    const cityBySlug = new Map(
      (cityRows.rows as Array<{ id: string; slug: string }>).map((r) => [r.slug, r.id])
    );
    const fromCityId = cityBySlug.get('msk-d');
    const toCityId = cityBySlug.get('spb-d');
    if (!fromCityId || !toCityId) throw new Error('seed cities missing');

    const clientRows = await app.db.execute(sql`
      INSERT INTO clients (name, phone, lang)
      VALUES ('Detail Client', '+70000000020', 'ru')
      RETURNING id::text AS id
    `);
    const clientId = (clientRows.rows[0] as { id: string }).id;

    const truckRows = await app.db.execute(sql`
      INSERT INTO trucks (name, plate_number, driver_name, driver_phone,
                          capacity_t, body_type, status, geom)
      VALUES ('Truck-D', 'D001AA', 'Driver D', '+70000000099',
              20, 'tent', 'available',
              ST_GeogFromText('SRID=4326;POINT(37.7 55.8)'))
      RETURNING id::text AS id
    `);
    const truckId = (truckRows.rows[0] as { id: string }).id;

    const leadRows = await app.db.execute(sql`
      INSERT INTO leads (client_id, channel, stage,
                         from_city_id, to_city_id, tons, body_type)
      VALUES (${clientId}, 'voice', 'ORDER_CREATED',
              ${fromCityId}, ${toCityId}, 10, 'tent')
      RETURNING id::text AS id
    `);
    const leadId = (leadRows.rows[0] as { id: string }).id;

    const orderRows = await app.db.execute(sql`
      INSERT INTO orders (number, lead_id, client_id, truck_id,
                          from_city_id, to_city_id, distance_km,
                          price, currency, status, public_token)
      VALUES ('#KU-D-001', ${leadId}, ${clientId}, ${truckId},
              ${fromCityId}, ${toCityId}, 700,
              350000, 'RUB', 'CREATED', 'tok-detail-001')
      RETURNING id::text AS id
    `);
    orderId = (orderRows.rows[0] as { id: string }).id;

    // 3 order events at distinct timestamps so chronological order is testable.
    await app.db.execute(sql`
      INSERT INTO order_events (order_id, type, actor, created_at)
      VALUES (${orderId}, 'created', 'ai', NOW() - INTERVAL '10 minutes')
    `);
    await app.db.execute(sql`
      INSERT INTO order_events (order_id, type, actor, created_at)
      VALUES (${orderId}, 'driver_assigned', 'ai', NOW() - INTERVAL '5 minutes')
    `);
    await app.db.execute(sql`
      INSERT INTO order_events (order_id, type, actor, created_at)
      VALUES (${orderId}, 'at_loading', 'system', NOW() - INTERVAL '1 minute')
    `);
  }, 120_000);

  afterAll(async () => {
    if (app) await app.close();
    await stopPostgisContainer();
    if (originalDbUrl !== undefined) process.env.DATABASE_URL = originalDbUrl;
    if (originalRedisUrl !== undefined) process.env.REDIS_URL = originalRedisUrl;
  });

  it('returns order + 3 events + client + fromCity + toCity + truck + lead in ONE response', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/orders/${orderId}` });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      order: { id: string; number: string };
      events: Array<{ type: string }>;
      client: { name: string | null } | null;
      fromCity: { nameRu: string } | null;
      toCity: { nameRu: string } | null;
      truck: { plateNumber: string } | null;
      lead: { channel: string } | null;
    };
    expect(body.order.id).toBe(orderId);
    expect(body.order.number).toBe('#KU-D-001');
    expect(body.events.length).toBe(3);
    expect(body.client?.name).toBe('Detail Client');
    expect(body.fromCity?.nameRu).toBe('Москва-Д');
    expect(body.toCity?.nameRu).toBe('Санкт-Петербург-Д');
    expect(body.truck?.plateNumber).toBe('D001AA');
    expect(body.lead?.channel).toBe('voice');
  });

  it('returns 404 for missing order', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/orders/00000000-0000-0000-0000-000000000000',
    });
    expect(res.statusCode).toBe(404);
  });

  it('events sorted chronologically (oldest first)', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/orders/${orderId}` });
    const body = res.json() as { events: Array<{ type: string; createdAt: string }> };
    expect(body.events.length).toBe(3);
    expect(body.events[0]?.type).toBe('created');
    expect(body.events[1]?.type).toBe('driver_assigned');
    expect(body.events[2]?.type).toBe('at_loading');
    const t0 = new Date(body.events[0]?.createdAt ?? '').getTime();
    const t2 = new Date(body.events[2]?.createdAt ?? '').getTime();
    expect(t0).toBeLessThan(t2);
  });
});
