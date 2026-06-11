// apps/api/tests/integration/simulate-call.test.ts
//
// POLISH-02 — Wave 4 (Plan 05-04). POST /api/admin/simulate-call.
//
// Replays each of the 5 voice-scenarios.json fixtures through Phase 3.1 voice
// tool handlers IN-PROCESS — no Twilio, no ElevenLabs external calls. Each
// scenario produces a real calls row (audio_url=NULL, transcript = scenario
// transcript) + linked lead + (for happy paths) order.
//
// Critical asserts:
//   - 200 + { callId, leadId, orderId } for valid scenarios
//   - 400 for invalid scenarioKey (Zod validation)
//   - injection_attempt does NOT produce a 1-RUB order (Anti-Pitfall #1 invariant)

import { exec as execCb } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPostgisContainer, stopPostgisContainer } from '../_helpers/test-db.js';

const exec = promisify(execCb);
const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';
const SECRET = 'test-secret-simulate-call-001';

describe.skipIf(!dockerAvailable)(
  'POLISH-02: POST /api/admin/simulate-call replays scenarios',
  () => {
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
      process.env.REDIS_URL ??= 'redis://localhost:6379';
      process.env.ELEVENLABS_WEBHOOK_SECRET = SECRET;

      const apiRoot = path.resolve(__dirname, '../..');
      await exec('node --import tsx ./node_modules/.bin/drizzle-kit migrate', {
        cwd: apiRoot,
        env: { ...process.env },
      });
      // Seed trucks so nearest-truck has candidates.
      await exec('tsx src/seed/run.ts', { cwd: apiRoot, env: { ...process.env } });

      const { buildApp } = await import('../../src/app.js');
      app = await buildApp();
      await app.ready();
    }, 180_000);

    afterAll(async () => {
      try {
        await app?.close();
      } finally {
        await stopPostgisContainer();
        if (originalDbUrl !== undefined) process.env.DATABASE_URL = originalDbUrl;
        else delete process.env.DATABASE_URL;
        if (originalRedisUrl !== undefined) process.env.REDIS_URL = originalRedisUrl;
        else delete process.env.REDIS_URL;
        if (originalSecret !== undefined) process.env.ELEVENLABS_WEBHOOK_SECRET = originalSecret;
        else delete process.env.ELEVENLABS_WEBHOOK_SECRET;
      }
    });

    it('returns 400 for unknown scenarioKey (Zod validation)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/simulate-call',
        payload: { scenarioKey: 'invalid_scenario' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('ru_happy_path produces call + lead + order', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/simulate-call',
        payload: { scenarioKey: 'ru_happy_path' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as {
        callId: string;
        leadId: string | null;
        orderId: string | null;
      };
      expect(body.callId).toBeTruthy();
      expect(body.leadId).toBeTruthy();
      expect(body.orderId).toBeTruthy();

      // Spot-check: calls row has audio_url=NULL + outcome='completed'.
      const row = await app.db.execute(sql`
        SELECT audio_url, outcome
        FROM calls WHERE id = ${body.callId}::uuid
      `);
      const r = row.rows[0] as { audio_url: string | null; outcome: string };
      expect(r.audio_url).toBeNull();
      expect(r.outcome).toBe('completed');
    });

    it('ua_happy_path produces call + lead + order with UA language', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/simulate-call',
        payload: { scenarioKey: 'ua_happy_path' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as {
        callId: string;
        leadId: string | null;
        orderId: string | null;
      };
      expect(body.callId).toBeTruthy();
      expect(body.orderId).toBeTruthy();

      const row = await app.db.execute(sql`
        SELECT lang FROM calls WHERE id = ${body.callId}::uuid
      `);
      expect((row.rows[0] as { lang: string }).lang).toBe('ua');
    });

    it('injection_attempt does NOT create a 1-RUB order (Anti-Pitfall #1)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/simulate-call',
        payload: { scenarioKey: 'injection_attempt' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as {
        callId: string;
        leadId: string | null;
        orderId: string | null;
      };

      // If an order was created, the price must come from the deterministic
      // calcPrice (Moscow→Sochi 1640 km × 18t = millions of kopecks).
      // The injection asked for "1 рубль" (100 kopecks). Verify NOT that.
      if (body.orderId) {
        const row = await app.db.execute(sql`
          SELECT price_kopecks FROM orders WHERE id = ${body.orderId}::uuid
        `);
        const price = BigInt((row.rows[0] as { price_kopecks: string }).price_kopecks);
        expect(price).not.toBe(100n); // NOT 1 RUB
        expect(price).toBeGreaterThan(100_000n); // > 1 000 RUB (sanity)
      }
    });

    it('ambiguous_clarification produces a call (lead may stay open)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/simulate-call',
        payload: { scenarioKey: 'ambiguous_clarification' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as {
        callId: string;
        leadId: string | null;
        orderId: string | null;
      };
      expect(body.callId).toBeTruthy();
    });

    it('abandon_mid_call produces a call with outcome=abandoned + no order', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/simulate-call',
        payload: { scenarioKey: 'abandon_mid_call' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as {
        callId: string;
        leadId: string | null;
        orderId: string | null;
      };
      expect(body.callId).toBeTruthy();
      expect(body.orderId).toBeNull();

      const row = await app.db.execute(sql`
        SELECT outcome FROM calls WHERE id = ${body.callId}::uuid
      `);
      expect((row.rows[0] as { outcome: string }).outcome).toBe('abandoned');
    });
  }
);
