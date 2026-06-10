// apps/api/tests/integration/voice-lang-detect.test.ts
//
// Phase 3.1 Wave 2 — asserts lang-detected sets calls.lang AND clients.lang
// ONCE (sticky semantics: subsequent calls cannot flip the client-level lang).
//
// CONTEXT D-16 (sticky NULL guard) + D-17 (existing client sticky lang).
// Implementation uses NOT EXISTS subquery on sibling calls to defend against
// the clients.lang NOT NULL DEFAULT 'ru' Phase 1 constraint — see
// call-lifecycle.ts header comment for the workaround rationale.

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
const SECRET = 'test-secret-lang-detect-003';

describe.skipIf(!dockerAvailable)('Phase 3.1 — sticky language detection via voice', () => {
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

  it('VOICE-06: lang-detected sets calls.lang AND clients.lang ONCE (sticky on first event)', async () => {
    const phone = '+79001234603';
    // Call 1 — caller phone is fresh; call-start creates client with default lang.
    await injectVoiceWebhook(app, {
      endpoint: '/webhook/voice/call-start',
      body: { conversation_id: 'conv_ld_001', caller_phone: phone },
      secret: SECRET,
    });
    // First lang-detected event → 'ua'. Both calls.lang AND clients.lang flip.
    await injectVoiceWebhook(app, {
      endpoint: '/webhook/voice/lang-detected',
      body: { conversation_id: 'conv_ld_001', lang: 'ua' },
      secret: SECRET,
    });

    const callRow = await app.db.execute(sql`
      SELECT lang::text AS lang
      FROM calls WHERE elevenlabs_conversation_id = ${'conv_ld_001'} LIMIT 1
    `);
    expect((callRow.rows[0] as { lang: string }).lang).toBe('ua');

    const clientRow = await app.db.execute(sql`
      SELECT lang::text AS lang FROM clients WHERE phone = ${phone} LIMIT 1
    `);
    expect((clientRow.rows[0] as { lang: string }).lang).toBe('ua');

    // Call 2 — same phone, new conversation_id. lang-detected tries 'ru' →
    // sticky guard prevents clients.lang change because a prior call with
    // non-null lang exists.
    await injectVoiceWebhook(app, {
      endpoint: '/webhook/voice/call-start',
      body: { conversation_id: 'conv_ld_002', caller_phone: phone },
      secret: SECRET,
    });
    await injectVoiceWebhook(app, {
      endpoint: '/webhook/voice/lang-detected',
      body: { conversation_id: 'conv_ld_002', lang: 'ru' },
      secret: SECRET,
    });

    const clientRowAfter = await app.db.execute(sql`
      SELECT lang::text AS lang FROM clients WHERE phone = ${phone} LIMIT 1
    `);
    // Sticky — D-16/D-17 closure. clients.lang stays 'ua'.
    expect((clientRowAfter.rows[0] as { lang: string }).lang).toBe('ua');

    // But calls.lang for THIS call still picks up the detected value (per-call
    // lang is the audio-detector's truth, even if client-sticky overrules).
    const call2Row = await app.db.execute(sql`
      SELECT lang::text AS lang
      FROM calls WHERE elevenlabs_conversation_id = ${'conv_ld_002'} LIMIT 1
    `);
    expect((call2Row.rows[0] as { lang: string }).lang).toBe('ru');
  });
});
