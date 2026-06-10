// apps/api/tests/integration/voice-call-lifecycle.test.ts
//
// Phase 3.1 Wave 2 — asserts call-start INSERTs calls row + creates lead
// skeleton + seeds Redis state; call-end UPDATE persists audio_url + transcript
// + outcome (idempotent on replay).
//
// CONTEXT D-14 (call-start), D-15 (call-end), D-17 (sticky lang on existing client).

import { exec as execCb } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPostgisContainer, stopPostgisContainer } from '../_helpers/test-db.js';
import { injectVoiceWebhook } from '../_helpers/voice-driver.js';

const exec = promisify(execCb);
const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';
const SECRET = 'test-secret-lifecycle-002';

describe.skipIf(!dockerAvailable)('Phase 3.1 — call-start/call-end/lang-detected lifecycle', () => {
  let app: FastifyInstance;
  let originalDbUrl: string | undefined;
  let originalRedisUrl: string | undefined;
  let originalSecret: string | undefined;

  beforeAll(async () => {
    const dbUrl = await startPostgisContainer();
    originalDbUrl = process.env.DATABASE_URL;
    originalRedisUrl = process.env.REDIS_URL;
    originalSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
    process.env.DATABASE_URL = dbUrl;
    process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
    process.env.ELEVENLABS_WEBHOOK_SECRET = SECRET;

    await exec('pnpm exec drizzle-kit migrate', {
      cwd: path.resolve(import.meta.dirname, '..', '..'),
      env: { ...process.env, DATABASE_URL: dbUrl },
    });

    const mod = await import('../../src/app.js');
    app = await mod.buildApp();
    await app.ready();
  }, 120_000);

  afterAll(async () => {
    if (app) await app.close();
    await stopPostgisContainer();
    if (originalDbUrl !== undefined) process.env.DATABASE_URL = originalDbUrl;
    if (originalRedisUrl !== undefined) process.env.REDIS_URL = originalRedisUrl;
    if (originalSecret !== undefined) {
      process.env.ELEVENLABS_WEBHOOK_SECRET = originalSecret;
    } else {
      delete process.env.ELEVENLABS_WEBHOOK_SECRET;
    }
  });

  it('VOICE-07: call-start INSERTs calls row + creates lead skeleton + seeds Redis state', async () => {
    const body = {
      conversation_id: 'conv_lc_001',
      twilio_call_sid: 'CA_lc_001',
      caller_phone: '+79001234501',
    };
    const { res } = await injectVoiceWebhook(app, {
      endpoint: '/webhook/voice/call-start',
      body,
      secret: SECRET,
    });
    expect(res.statusCode).toBe(200);

    const row = await app.db.execute(sql`
      SELECT id::text AS id, lead_id::text AS lead_id, twilio_call_sid
      FROM calls WHERE elevenlabs_conversation_id = ${'conv_lc_001'} LIMIT 1
    `);
    expect(row.rows.length).toBe(1);
    const r = row.rows[0] as { id: string; lead_id: string | null; twilio_call_sid: string | null };
    expect(r.lead_id).not.toBeNull();
    expect(r.twilio_call_sid).toBe('CA_lc_001');

    const stateRaw = await app.redis.get('voice:state:conv_lc_001');
    expect(stateRaw).not.toBeNull();
  });

  it('VOICE-07/08: call-end UPDATE persists audio_url + transcript + outcome (idempotent on replay)', async () => {
    await injectVoiceWebhook(app, {
      endpoint: '/webhook/voice/call-start',
      body: { conversation_id: 'conv_lc_002', caller_phone: '+79001234502' },
      secret: SECRET,
    });
    const endBody = {
      conversation_id: 'conv_lc_002',
      audio_url: 'https://api.twilio.com/Recordings/RE_lc_002.mp3',
      transcript: [
        { role: 'agent' as const, text: 'Здравствуйте!', timestamp_ms: 0 },
        { role: 'caller' as const, text: 'Киев-Львов 18 тонн', timestamp_ms: 2500 },
      ],
      outcome: 'completed' as const,
      duration_s: 95,
      lang: 'ru' as const,
    };
    const r1 = await injectVoiceWebhook(app, {
      endpoint: '/webhook/voice/call-end',
      body: endBody,
      secret: SECRET,
    });
    expect(r1.res.statusCode).toBe(200);
    // Replay — must remain 200 + downstream effect equivalent.
    const r2 = await injectVoiceWebhook(app, {
      endpoint: '/webhook/voice/call-end',
      body: endBody,
      secret: SECRET,
    });
    expect(r2.res.statusCode).toBe(200);

    const row = await app.db.execute(sql`
      SELECT audio_url, transcript, outcome, duration_s, lang::text AS lang
      FROM calls WHERE elevenlabs_conversation_id = ${'conv_lc_002'} LIMIT 1
    `);
    const r = row.rows[0] as {
      audio_url: string;
      transcript: unknown[];
      outcome: string;
      duration_s: number;
      lang: string;
    };
    expect(r.audio_url).toBe(endBody.audio_url);
    expect(r.outcome).toBe('completed');
    expect(r.duration_s).toBe(95);
    expect(r.lang).toBe('ru');
    expect(r.transcript.length).toBe(2);
  });
});
