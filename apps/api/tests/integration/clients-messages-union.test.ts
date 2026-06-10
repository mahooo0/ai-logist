// Phase 4 Plan 04-03 — UNION query coverage (API-06).
//
// Seeds:
//   - 1 client (the one we query against)
//   - 1 lead linked to the client
//   - 2 messages (telegram) at 10:00 + 10:02 created_at offsets
//   - 1 call at 10:01 with transcript 3 turns at timestamp_ms 0, 1500, 3000
//   - 1 OTHER client (the lonely one) for the empty-array case
//   - 1 call attached to OUR client with a transcript turn missing
//     timestamp_ms — proves the (idx-1)*1000ms fallback.
//
// Docker-gated. Skipped silently when AI_LOGIST_NO_DOCKER=1.

import { exec as execCb } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPostgisContainer, stopPostgisContainer } from '../_helpers/test-db.js';

const exec = promisify(execCb);
const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('Phase 4 API-06 — clients/:id/messages UNION', () => {
  let app: FastifyInstance;
  let originalDbUrl: string | undefined;
  let originalRedisUrl: string | undefined;
  let mainClientId: string;
  let loneClientId: string;
  let mainCallId: string;
  let defensiveCallId: string;
  let defensiveClientId: string;

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

    // Main client + lead + 2 messages + 1 call with 3 transcript turns.
    const mc = await app.db.execute(sql`
      INSERT INTO clients (name, phone, lang)
      VALUES ('Union Main', '+70000000070', 'ru')
      RETURNING id::text AS id
    `);
    mainClientId = (mc.rows[0] as { id: string }).id;
    const ml = await app.db.execute(sql`
      INSERT INTO leads (client_id, channel, stage)
      VALUES (${mainClientId}, 'voice', 'NEW')
      RETURNING id::text AS id
    `);
    const mainLeadId = (ml.rows[0] as { id: string }).id;

    // 2 telegram messages at distinct times — anchored relative to NOW.
    await app.db.execute(sql`
      INSERT INTO messages (client_id, lead_id, role, text, created_at)
      VALUES (${mainClientId}, ${mainLeadId}, 'client', 'Доброе утро',
              NOW() - INTERVAL '120 seconds')
    `);
    await app.db.execute(sql`
      INSERT INTO messages (client_id, lead_id, role, text, created_at)
      VALUES (${mainClientId}, ${mainLeadId}, 'ai', 'Здравствуйте, чем помочь?',
              NOW() - INTERVAL '0 seconds')
    `);

    // Call at -60s (between the two messages) with 3 turns @ 0, 1500, 3000 ms.
    const mainCall = await app.db.execute(sql`
      INSERT INTO calls (direction, lang, linked_lead_id, audio_url,
                         transcript, created_at)
      VALUES ('inbound', 'ru', ${mainLeadId},
              'https://twilio.example/recording.mp3',
              '[
                 {"speaker":"agent","text":"Здравствуйте","timestamp_ms":0},
                 {"speaker":"caller","text":"Нужна машина","timestamp_ms":1500},
                 {"speaker":"agent","text":"Сейчас подберу","timestamp_ms":3000}
               ]'::jsonb,
              NOW() - INTERVAL '60 seconds')
      RETURNING id::text AS id
    `);
    mainCallId = (mainCall.rows[0] as { id: string }).id;

    // Lonely client (no messages, no calls) — empty case.
    const lc = await app.db.execute(sql`
      INSERT INTO clients (name, phone, lang)
      VALUES ('Union Lonely', '+70000000071', 'ru')
      RETURNING id::text AS id
    `);
    loneClientId = (lc.rows[0] as { id: string }).id;

    // Defensive: separate client whose lead has 1 call with a transcript turn
    // MISSING timestamp_ms — handler must fall back to idx-based ms.
    const dc = await app.db.execute(sql`
      INSERT INTO clients (name, phone, lang)
      VALUES ('Union Defensive', '+70000000072', 'ru')
      RETURNING id::text AS id
    `);
    defensiveClientId = (dc.rows[0] as { id: string }).id;
    const dl = await app.db.execute(sql`
      INSERT INTO leads (client_id, channel, stage)
      VALUES (${defensiveClientId}, 'voice', 'NEW')
      RETURNING id::text AS id
    `);
    const defensiveLeadId = (dl.rows[0] as { id: string }).id;
    const dCall = await app.db.execute(sql`
      INSERT INTO calls (direction, lang, linked_lead_id, audio_url, transcript)
      VALUES ('inbound', 'ru', ${defensiveLeadId},
              'https://twilio.example/defensive.mp3',
              '[
                 {"speaker":"agent","text":"Привет"},
                 {"speaker":"caller","text":"Ок"}
               ]'::jsonb)
      RETURNING id::text AS id
    `);
    defensiveCallId = (dCall.rows[0] as { id: string }).id;
  }, 120_000);

  afterAll(async () => {
    if (app) await app.close();
    await stopPostgisContainer();
    if (originalDbUrl !== undefined) process.env.DATABASE_URL = originalDbUrl;
    if (originalRedisUrl !== undefined) process.env.REDIS_URL = originalRedisUrl;
  });

  it('UNION returns telegram messages + voice transcript turns chronologically', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/clients/${mainClientId}/messages`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{
      id: string;
      channel: string;
      role: string;
      createdAt: string;
    }>;
    // 2 telegram + 3 voice = 5 rows.
    expect(body.length).toBe(5);
    // First row is the oldest telegram message (created at -120s).
    expect(body[0]?.channel).toBe('telegram');
    expect(body[0]?.role).toBe('client');
    // Last row is the newest telegram message (created at 0s).
    expect(body[body.length - 1]?.channel).toBe('telegram');
    // ASC ordering across pairs.
    for (let i = 1; i < body.length; i++) {
      const prev = new Date(body[i - 1]?.createdAt ?? '').getTime();
      const curr = new Date(body[i]?.createdAt ?? '').getTime();
      expect(prev).toBeLessThanOrEqual(curr);
    }
  });

  it('voice turn role mapping: speaker=agent → role=ai, speaker=caller → role=client', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/clients/${mainClientId}/messages`,
    });
    const body = res.json() as Array<{
      role: string;
      channel: string;
      text: string;
    }>;
    const voiceRows = body.filter((r) => r.channel === 'voice');
    expect(voiceRows.length).toBe(3);
    expect(voiceRows[0]?.role).toBe('ai');
    expect(voiceRows[0]?.text).toBe('Здравствуйте');
    expect(voiceRows[1]?.role).toBe('client');
    expect(voiceRows[1]?.text).toBe('Нужна машина');
    expect(voiceRows[2]?.role).toBe('ai');
  });

  it('voice turn carries callId + timestampMs + audioUrl', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/clients/${mainClientId}/messages`,
    });
    const body = res.json() as Array<{
      channel: string;
      callId: string | null;
      timestampMs: number | null;
      audioUrl: string | null;
    }>;
    const voiceRows = body.filter((r) => r.channel === 'voice');
    // Each voice row carries the call id, the (turn->>'timestamp_ms')::bigint
    // value, and the call's audio_url. Second turn was seeded at 1500 ms.
    expect(voiceRows[0]?.callId).toBe(mainCallId);
    expect(voiceRows[1]?.timestampMs).toBe(1500);
    expect(voiceRows[1]?.audioUrl).toBe('https://twilio.example/recording.mp3');
    // Telegram rows have null voice fields.
    const tgRow = body.find((r) => r.channel === 'telegram');
    expect(tgRow?.callId).toBeNull();
    expect(tgRow?.timestampMs).toBeNull();
    expect(tgRow?.audioUrl).toBeNull();
  });

  it('returns empty array for client with no msgs and no calls', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/clients/${loneClientId}/messages`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as unknown[];
    expect(body).toEqual([]);
  });

  it('defensive: missing timestamp_ms falls back to (idx-1)*1000 ms', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/clients/${defensiveClientId}/messages`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{
      callId: string | null;
      timestampMs: number | null;
      channel: string;
      role: string;
    }>;
    expect(body.length).toBe(2);
    expect(body[0]?.callId).toBe(defensiveCallId);
    expect(body[0]?.timestampMs).toBe(0); // idx=1 → (1-1)*1000 = 0
    expect(body[1]?.timestampMs).toBe(1000); // idx=2 → (2-1)*1000 = 1000
    expect(body[0]?.channel).toBe('voice');
  });
});
