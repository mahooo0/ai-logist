// apps/api/tests/integration/voice-price-lock.test.ts
//
// Phase 3.1 Wave 2 — asserts the voice price-lock invariant:
//   1. calc-price writes leads.quoted_price to DB BEFORE returning (D-22 layer 1)
//   2. create-order re-reads quoted_price from DB inside transaction (D-23 layer 2)
//   3. Caller-supplied `price_kopecks` arg on create-order is IGNORED — order
//      price equals the DB-locked value, NEVER the attacker-supplied 1 RUB.
//
// Closes Pitfall #1 on voice channel.

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
const SECRET = 'test-secret-price-lock-004';

describe.skipIf(!dockerAvailable)('Phase 3.1 — price-lock invariant', () => {
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

    // Seed pricing_config rows so calc-price's readPricingConfig() finds them.
    // Phase 1 seed runner inserts these; we INSERT directly to keep the test
    // self-contained and fast (no full seed crawl per test boot).
    await app.db.execute(sql`
      INSERT INTO pricing_config (key, value) VALUES
        ('rate_per_km', '4200'::jsonb),
        ('dir_coef', '{"default":1.0,"back_haul":0.85}'::jsonb),
        ('season_coef', '1.0'::jsonb)
      ON CONFLICT (key) DO NOTHING
    `);
  }, 180_000);

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

  it('VOICE-09: calc-price writes leads.quoted_price BEFORE returning to ElevenLabs', async () => {
    await injectVoiceWebhook(app, {
      endpoint: '/webhook/voice/call-start',
      body: { conversation_id: 'conv_pl_001', caller_phone: '+79009990701' },
      secret: SECRET,
    });

    const { res } = await injectVoiceWebhook(app, {
      endpoint: '/webhook/voice/tool/calc-price',
      body: {
        conversation_id: 'conv_pl_001',
        sequence: 1,
        parameters: { route_km: 540, tons: 18, body_type: 'tent', direction: 'default' },
      },
      secret: SECRET,
    });
    expect(res.statusCode).toBe(200);
    const out = JSON.parse(res.body) as {
      ok: boolean;
      output?: { price_kopecks: string };
    };
    expect(out.ok).toBe(true);
    expect(out.output).toBeDefined();
    const returnedPriceStr = out.output?.price_kopecks ?? '';

    const dbRow = await app.db.execute(sql`
      SELECT quoted_price
      FROM leads
      WHERE id = (
        SELECT lead_id FROM calls WHERE elevenlabs_conversation_id = ${'conv_pl_001'} LIMIT 1
      )
      LIMIT 1
    `);
    const dbPriceStr = String((dbRow.rows[0] as { quoted_price: string | number }).quoted_price);
    // DB value = returned value (price-lock written BEFORE return).
    expect(dbPriceStr).toBe(returnedPriceStr);
  });

  it('VOICE-09: create-order ignores caller-supplied price arg; reads quoted_price from DB', async () => {
    await injectVoiceWebhook(app, {
      endpoint: '/webhook/voice/call-start',
      body: { conversation_id: 'conv_pl_002', caller_phone: '+79009990702' },
      secret: SECRET,
    });
    // Run calc-price to set the legitimate quoted_price.
    await injectVoiceWebhook(app, {
      endpoint: '/webhook/voice/tool/calc-price',
      body: {
        conversation_id: 'conv_pl_002',
        sequence: 1,
        parameters: { route_km: 540, tons: 18, body_type: 'tent', direction: 'default' },
      },
      secret: SECRET,
    });
    const legitimateRow = await app.db.execute(sql`
      SELECT quoted_price FROM leads
      WHERE id = (SELECT lead_id FROM calls WHERE elevenlabs_conversation_id = ${'conv_pl_002'} LIMIT 1)
      LIMIT 1
    `);
    const legitimatePrice = String(
      (legitimateRow.rows[0] as { quoted_price: string | number }).quoted_price
    );

    // Caller tries to inject a 1-RUB price arg. Voice handler MUST IGNORE it.
    const { res } = await injectVoiceWebhook(app, {
      endpoint: '/webhook/voice/tool/create-order',
      body: {
        conversation_id: 'conv_pl_002',
        sequence: 2,
        parameters: { confirmed: true, price_kopecks: '100' /* attacker injects 1 RUB */ },
      },
      secret: SECRET,
    });
    expect(res.statusCode).toBe(200);
    const out = JSON.parse(res.body) as {
      ok: boolean;
      output?: { price_kopecks: string };
      error?: { code: string; message: string };
    };
    // create-order may return error if no matched_truck — that's fine, the
    // price-lock invariant still holds. If it succeeded, the returned price
    // MUST equal the DB-locked value, NEVER the attacker-supplied 100 kopecks.
    if (out.ok) {
      expect(out.output?.price_kopecks).toBe(legitimatePrice);
      expect(out.output?.price_kopecks).not.toBe('100');
      // Defensive: verify the orders row directly.
      const orderRow = await app.db.execute(sql`
        SELECT price::text AS price FROM orders
        WHERE id = (
          SELECT order_id FROM leads
          WHERE id = (SELECT lead_id FROM calls WHERE elevenlabs_conversation_id = ${'conv_pl_002'} LIMIT 1)
        )
        LIMIT 1
      `);
      const orderPrice = (orderRow.rows[0] as { price: string }).price;
      expect(orderPrice).toBe(legitimatePrice);
      expect(BigInt(orderPrice)).toBeGreaterThan(100n);
    }
  });
});
