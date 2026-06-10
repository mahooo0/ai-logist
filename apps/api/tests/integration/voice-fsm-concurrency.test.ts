// apps/api/tests/integration/voice-fsm-concurrency.test.ts
//
// Phase 3.1 Wave 2 — asserts per-conversation FSM-race protection (CONTEXT
// D-24/D-25):
//   1. 100x concurrent create-order on the SAME conversation_id (different
//      sequences so idempotency doesn't dedupe them) → exactly 1 order row.
//      Defended by Phase 2 createOrderHandler's version-CAS UPDATE on leads.
//   2. Replay same callback (same sequence) 10x → exactly 1 webhook_updates row.
//      Defended by webhook_updates UNIQUE(source, external_id) ON CONFLICT DO NOTHING.

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
const SECRET = 'test-secret-fsm-concurrency-006';

describe.skipIf(!dockerAvailable)('Phase 3.1 — per-conversation advisory lock', () => {
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

    await app.db.execute(sql`
      INSERT INTO pricing_config (key, value) VALUES
        ('rate_per_km', '4200'::jsonb),
        ('dir_coef', '{"default":1.0,"back_haul":0.85}'::jsonb),
        ('season_coef', '1.0'::jsonb)
      ON CONFLICT (key) DO NOTHING
    `);
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

  it('VOICE-11: 100x concurrent create-order on same conversation_id → exactly 1 order created', async () => {
    const conv = 'conv_conc_001';
    await injectVoiceWebhook(app, {
      endpoint: '/webhook/voice/call-start',
      body: { conversation_id: conv, caller_phone: '+79008881001' },
      secret: SECRET,
    });
    await injectVoiceWebhook(app, {
      endpoint: '/webhook/voice/tool/calc-price',
      body: {
        conversation_id: conv,
        sequence: 1,
        parameters: { route_km: 540, tons: 18, body_type: 'tent', direction: 'default' },
      },
      secret: SECRET,
    });

    // Fire 100 parallel create-order calls with DIFFERENT sequences so the
    // idempotency table doesn't dedupe them. The race is at the FSM level:
    // Phase 2's CAS UPDATE on leads.version permits exactly 1 transition.
    const calls = Array.from({ length: 100 }, (_, i) =>
      injectVoiceWebhook(app, {
        endpoint: '/webhook/voice/tool/create-order',
        body: {
          conversation_id: conv,
          sequence: 100 + i,
          parameters: { confirmed: true },
        },
        secret: SECRET,
      })
    );
    const results = await Promise.all(calls);
    // All wire statuses are 200 (envelope inside reports ok/error per Phase 2).
    expect(results.every((r) => r.res.statusCode === 200)).toBe(true);

    const okCount = results.filter((r) => {
      try {
        const o = JSON.parse(r.res.body) as { ok: boolean };
        return o.ok === true;
      } catch {
        return false;
      }
    }).length;
    // Phase 2 createOrderHandler's CAS-on-version ensures exactly 1 caller wins.
    expect(okCount).toBe(1);

    // Verify the orders table: exactly 1 row was inserted for this conversation.
    const orderCount = await app.db.execute(sql`
      SELECT COUNT(*)::int AS n FROM orders
      WHERE id IN (
        SELECT order_id FROM leads
        WHERE id IN (SELECT lead_id FROM calls WHERE elevenlabs_conversation_id = ${conv})
          AND order_id IS NOT NULL
      )
    `);
    expect(Number((orderCount.rows[0] as { n: number }).n)).toBe(1);
  }, 60_000);

  it('VOICE-11: replay same callback (same sequence) 10x → exactly 1 webhook_updates row', async () => {
    const conv = 'conv_idem_001';
    await injectVoiceWebhook(app, {
      endpoint: '/webhook/voice/call-start',
      body: { conversation_id: conv, caller_phone: '+79007770801' },
      secret: SECRET,
    });
    const body = {
      conversation_id: conv,
      sequence: 999,
      parameters: {
        from_city: 'Москва',
        to_city: 'Санкт-Петербург',
        tons: 18,
        body_type: 'tent',
        confidence: { from_city: 0.95, to_city: 0.95, tons: 0.95 },
      },
    };
    for (let i = 0; i < 10; i++) {
      await injectVoiceWebhook(app, {
        endpoint: '/webhook/voice/tool/extract-request',
        body,
        secret: SECRET,
      });
    }
    const row = await app.db.execute(sql`
      SELECT COUNT(*)::int AS n FROM webhook_updates
      WHERE source = 'elevenlabs'::webhook_source AND external_id = ${`${conv}:999`}
    `);
    expect(Number((row.rows[0] as { n: number }).n)).toBe(1);
  });
});
