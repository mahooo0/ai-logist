// Phase 4 Plan 04-03 — GET /api/orders integration coverage (API-04 list).

import { exec as execCb } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPostgisContainer, stopPostgisContainer } from '../_helpers/test-db.js';

const exec = promisify(execCb);
const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('Phase 4 API-04 — GET /api/orders (joined list)', () => {
  let app: FastifyInstance;
  let originalDbUrl: string | undefined;
  let originalRedisUrl: string | undefined;
  let voiceOrderId: string;
  let telegramOrderId: string;
  let clientAId: string;
  let clientBId: string;

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

    // Seed: 4 cities + 2 clients + 2 leads (1 voice / 1 telegram) + 2 orders.
    const cityRows = await app.db.execute(sql`
      INSERT INTO cities (slug, name_ru, name_ua, country_code, geom)
      VALUES
        ('msk-list', 'Москва-Л', 'Москва-Л', 'RU', ST_GeogFromText('SRID=4326;POINT(37.6 55.7)')),
        ('spb-list', 'Санкт-Петербург-Л', 'Санкт-Петербург-Л', 'RU', ST_GeogFromText('SRID=4326;POINT(30.3 59.9)')),
        ('kyiv-list', 'Київ-Л', 'Київ-Л', 'UA', ST_GeogFromText('SRID=4326;POINT(30.5 50.5)')),
        ('lviv-list', 'Львів-Л', 'Львів-Л', 'UA', ST_GeogFromText('SRID=4326;POINT(24.0 49.8)'))
      RETURNING id::text AS id, slug
    `);
    const cityBySlug = new Map(
      (cityRows.rows as Array<{ id: string; slug: string }>).map((r) => [r.slug, r.id])
    );
    const msk = cityBySlug.get('msk-list');
    const spb = cityBySlug.get('spb-list');
    const kyiv = cityBySlug.get('kyiv-list');
    const lviv = cityBySlug.get('lviv-list');
    if (!msk || !spb || !kyiv || !lviv) throw new Error('seed cities missing');

    const cAB = await app.db.execute(sql`
      INSERT INTO clients (name, phone, lang)
      VALUES ('Voice Client', '+70000000010', 'ru'),
             ('Telegram Client', '+70000000011', 'ua')
      RETURNING id::text AS id
    `);
    clientAId = (cAB.rows[0] as { id: string }).id;
    clientBId = (cAB.rows[1] as { id: string }).id;

    const lRows = await app.db.execute(sql`
      INSERT INTO leads (client_id, channel, stage)
      VALUES (${clientAId}, 'voice', 'ORDER_CREATED'),
             (${clientBId}, 'telegram', 'ORDER_CREATED')
      RETURNING id::text AS id
    `);
    const voiceLeadId = (lRows.rows[0] as { id: string }).id;
    const telegramLeadId = (lRows.rows[1] as { id: string }).id;

    const voiceOrderRow = await app.db.execute(sql`
      INSERT INTO orders (number, lead_id, client_id, from_city_id, to_city_id,
                          price, currency, status, public_token)
      VALUES ('#KU-L-001', ${voiceLeadId}, ${clientAId}, ${msk}, ${spb},
              100000, 'RUB', 'CREATED', 'tok-list-voice')
      RETURNING id::text AS id
    `);
    voiceOrderId = (voiceOrderRow.rows[0] as { id: string }).id;
    await new Promise((r) => setTimeout(r, 15));
    const tgOrderRow = await app.db.execute(sql`
      INSERT INTO orders (number, lead_id, client_id, from_city_id, to_city_id,
                          price, currency, status, public_token)
      VALUES ('#KU-L-002', ${telegramLeadId}, ${clientBId}, ${kyiv}, ${lviv},
              200000, 'UAH', 'CREATED', 'tok-list-telegram')
      RETURNING id::text AS id
    `);
    telegramOrderId = (tgOrderRow.rows[0] as { id: string }).id;
  }, 120_000);

  afterAll(async () => {
    if (app) await app.close();
    await stopPostgisContainer();
    if (originalDbUrl !== undefined) process.env.DATABASE_URL = originalDbUrl;
    if (originalRedisUrl !== undefined) process.env.REDIS_URL = originalRedisUrl;
  });

  it('returns OrderListItem[] with fromCityName + toCityName + clientName + channel joined', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/orders' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{
      id: string;
      fromCityName: string | null;
      toCityName: string | null;
      clientName: string | null;
      channel: string | null;
    }>;
    const v = body.find((o) => o.id === voiceOrderId);
    const t = body.find((o) => o.id === telegramOrderId);
    expect(v).toBeTruthy();
    expect(t).toBeTruthy();
    expect(v?.fromCityName).toBe('Москва-Л');
    expect(v?.toCityName).toBe('Санкт-Петербург-Л');
    expect(v?.clientName).toBe('Voice Client');
    expect(v?.channel).toBe('voice');
    expect(t?.fromCityName).toBe('Київ-Л');
    expect(t?.clientName).toBe('Telegram Client');
    expect(t?.channel).toBe('telegram');
  });

  it('filters by channel=voice — returns only the voice-derived order', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/orders?channel=voice&clientId=${clientAId}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{ id: string; channel: string | null }>;
    expect(body.length).toBe(1);
    expect(body[0]?.id).toBe(voiceOrderId);
  });

  it('sorts by createdAt DESC', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/orders' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{ id: string; createdAt: string }>;
    // The two known orders, comparing newest-first.
    const idx = body.map((o) => o.id);
    expect(idx.indexOf(telegramOrderId)).toBeLessThan(idx.indexOf(voiceOrderId));
    expect(clientBId).toBeTruthy(); // silence noUnusedLocals
  });
});
