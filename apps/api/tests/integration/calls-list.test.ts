// Phase 4 Plan 04-03 — GET /api/calls + GET /api/calls/:id integration
// coverage (NEW endpoint per ADMIN-NEW-08).

import { exec as execCb } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPostgisContainer, stopPostgisContainer } from '../_helpers/test-db.js';

const exec = promisify(execCb);
const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('Phase 4 NEW endpoint — GET /api/calls + /api/calls/:id', () => {
  let app: FastifyInstance;
  let originalDbUrl: string | undefined;
  let originalRedisUrl: string | undefined;
  let callRuCompletedId: string;
  let callRuEscalatedId: string;
  let callUaAbandonedId: string;
  let detailLeadId: string;
  let detailOrderId: string;
  let detailCallId: string;

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

    // Seed: 4 calls (2 completed/ru, 1 abandoned/ua, 1 escalated/ru) for list filters.
    const r1 = await app.db.execute(sql`
      INSERT INTO calls (direction, outcome, lang, duration_s, created_at)
      VALUES ('inbound', 'completed', 'ru', 60, NOW() - INTERVAL '3 minutes')
      RETURNING id::text AS id
    `);
    callRuCompletedId = (r1.rows[0] as { id: string }).id;
    await app.db.execute(sql`
      INSERT INTO calls (direction, outcome, lang, duration_s, created_at)
      VALUES ('inbound', 'completed', 'ru', 75, NOW() - INTERVAL '2 minutes')
    `);
    const r3 = await app.db.execute(sql`
      INSERT INTO calls (direction, outcome, lang, duration_s, created_at)
      VALUES ('inbound', 'abandoned', 'ua', 15, NOW() - INTERVAL '1 minute')
      RETURNING id::text AS id
    `);
    callUaAbandonedId = (r3.rows[0] as { id: string }).id;
    const r4 = await app.db.execute(sql`
      INSERT INTO calls (direction, outcome, lang, duration_s, created_at)
      VALUES ('inbound', 'escalated', 'ru', 45, NOW())
      RETURNING id::text AS id
    `);
    callRuEscalatedId = (r4.rows[0] as { id: string }).id;

    // Detail seed: 1 client + 1 lead + 1 order + 1 call linking the lead.
    const clientRows = await app.db.execute(sql`
      INSERT INTO clients (name, phone, lang)
      VALUES ('Call Detail Client', '+70000000060', 'ru')
      RETURNING id::text AS id
    `);
    const clientId = (clientRows.rows[0] as { id: string }).id;
    const leadRows = await app.db.execute(sql`
      INSERT INTO leads (client_id, channel, stage)
      VALUES (${clientId}, 'voice', 'ORDER_CREATED')
      RETURNING id::text AS id
    `);
    detailLeadId = (leadRows.rows[0] as { id: string }).id;
    const orderRows = await app.db.execute(sql`
      INSERT INTO orders (number, lead_id, client_id, price, currency, status, public_token)
      VALUES ('#KU-CD-001', ${detailLeadId}, ${clientId}, 425000, 'RUB', 'CREATED', 'tok-call-detail')
      RETURNING id::text AS id
    `);
    detailOrderId = (orderRows.rows[0] as { id: string }).id;
    // Link the lead back to the order so calls/:id can walk lead.order_id.
    await app.db.execute(sql`
      UPDATE leads SET order_id = ${detailOrderId} WHERE id = ${detailLeadId}
    `);
    const callDetailRows = await app.db.execute(sql`
      INSERT INTO calls (direction, outcome, lang, duration_s,
                         linked_lead_id, audio_url, quoted_price_at_confirmation,
                         transcript, created_at)
      VALUES ('inbound', 'completed', 'ru', 120,
              ${detailLeadId}, 'https://twilio.example/recording.mp3', 425000,
              '[{"speaker":"agent","text":"Здравствуйте","timestamp_ms":0}]'::jsonb,
              NOW())
      RETURNING id::text AS id
    `);
    detailCallId = (callDetailRows.rows[0] as { id: string }).id;
  }, 120_000);

  afterAll(async () => {
    if (app) await app.close();
    await stopPostgisContainer();
    if (originalDbUrl !== undefined) process.env.DATABASE_URL = originalDbUrl;
    if (originalRedisUrl !== undefined) process.env.REDIS_URL = originalRedisUrl;
  });

  it('GET /api/calls returns paginated list sorted by created_at DESC', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/calls?limit=10' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{ id: string; createdAt: string }>;
    expect(body.length).toBeGreaterThanOrEqual(5);
    // Newest first — assert ordering on consecutive pairs.
    for (let i = 1; i < body.length; i++) {
      const prev = new Date(body[i - 1]?.createdAt ?? '').getTime();
      const curr = new Date(body[i]?.createdAt ?? '').getTime();
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  it('GET /api/calls filters by outcome=completed', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/calls?outcome=completed' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{ id: string; outcome: string | null }>;
    expect(body.length).toBeGreaterThanOrEqual(2);
    expect(body.every((c) => c.outcome === 'completed')).toBe(true);
    expect(body.find((c) => c.id === callRuCompletedId)).toBeTruthy();
  });

  it('GET /api/calls filters by lang=ua', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/calls?lang=ua' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{ id: string; lang: string | null }>;
    expect(body.length).toBeGreaterThanOrEqual(1);
    expect(body.every((c) => c.lang === 'ua')).toBe(true);
    expect(body.find((c) => c.id === callUaAbandonedId)).toBeTruthy();
  });

  it('GET /api/calls filters by date range (from)', async () => {
    // Wide window — all 5 should come back; tight window keeps only the latest.
    const wide = await app.inject({
      method: 'GET',
      url: `/api/calls?from=${new Date(Date.now() - 24 * 3600 * 1000).toISOString()}`,
    });
    expect(wide.statusCode).toBe(200);
    expect((wide.json() as unknown[]).length).toBeGreaterThanOrEqual(5);
    // Bound that excludes everything except very-recent rows.
    const tight = await app.inject({
      method: 'GET',
      url: `/api/calls?from=${new Date(Date.now() - 30 * 1000).toISOString()}`,
    });
    expect(tight.statusCode).toBe(200);
    const tightBody = tight.json() as Array<{ id: string }>;
    expect(tightBody.find((c) => c.id === callRuEscalatedId)).toBeTruthy();
  });

  it('GET /api/calls/:id returns call + linkedLead + linkedOrder', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/calls/${detailCallId}` });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      call: { id: string; audioUrl: string | null; quotedPriceAtConfirmation: string | null };
      linkedLead: { id: string; channel: string } | null;
      linkedOrder: { id: string; number: string; price: string } | null;
    };
    expect(body.call.id).toBe(detailCallId);
    expect(body.call.audioUrl).toBe('https://twilio.example/recording.mp3');
    expect(body.call.quotedPriceAtConfirmation).toBe('425000');
    expect(body.linkedLead?.id).toBe(detailLeadId);
    expect(body.linkedLead?.channel).toBe('voice');
    expect(body.linkedOrder?.id).toBe(detailOrderId);
    expect(body.linkedOrder?.number).toBe('#KU-CD-001');
    expect(body.linkedOrder?.price).toBe('425000');
  });

  it('GET /api/calls/:id returns 404 for missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/calls/00000000-0000-0000-0000-000000000000',
    });
    expect(res.statusCode).toBe(404);
  });
});
