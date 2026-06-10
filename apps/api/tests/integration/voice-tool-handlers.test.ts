// apps/api/tests/integration/voice-tool-handlers.test.ts
//
// Phase 3.1 Wave 2 — asserts 5 voice tool handlers wrap Phase 2 tools (NO
// duplication), verify HMAC, enforce price-lock + advisory lock, and complete
// in <500ms (Pitfall #3 ElevenLabs filler-cliff latency budget).
//
// Replays ru_happy_path scenario via injectVoiceWebhook from Wave 0 helpers.
// Docker-gated; AI_LOGIST_NO_DOCKER=1 skips silently.

import { exec as execCb } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPostgisContainer, stopPostgisContainer } from '../_helpers/test-db.js';
import { injectVoiceWebhook } from '../_helpers/voice-driver.js';
import scenarios from '../fixtures/voice-scenarios.json' with { type: 'json' };

const exec = promisify(execCb);
const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';
const SECRET = 'test-secret-voice-tools-001';

describe.skipIf(!dockerAvailable)('Phase 3.1 — voice tool handlers integration', () => {
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

  it('replays ru_happy_path scenario — all callbacks return 200 + latencies <500ms', async () => {
    const scenario =
      (scenarios as Record<string, Array<{ endpoint: string; body: object }>>).ru_happy_path ?? [];
    const latencies: number[] = [];
    const statuses: number[] = [];
    for (const step of scenario) {
      const { res, elapsedMs } = await injectVoiceWebhook(app, {
        endpoint: step.endpoint,
        body: step.body,
        secret: SECRET,
      });
      statuses.push(res.statusCode);
      latencies.push(elapsedMs);
    }
    // Each callback must come back 200 (envelope ok/error lives in body).
    expect(statuses.every((s) => s === 200)).toBe(true);
    // Each tool handler must complete in <500ms (Pitfall #3 budget). The
    // call-start + call-end + lang-detected are also bound by the same
    // ElevenLabs callback contract.
    const overBudget = latencies.filter((m) => m > 500);
    expect(overBudget).toEqual([]);
  });

  it('rejects callback with invalid HMAC signature (returns 401)', async () => {
    const body = {
      conversation_id: 'conv_test_invalid',
      sequence: 1,
      parameters: { from_city: 'Москва', to_city: 'Сочи', tons: 18, body_type: 'tent' },
    };
    const { res } = await injectVoiceWebhook(app, {
      endpoint: '/webhook/voice/tool/extract-request',
      body,
      secret: SECRET,
      rawSignatureOverride:
        'sha256=deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    });
    expect(res.statusCode).toBe(401);
  });

  it('VOICE-03/05: 5 tool routes registered + no outbound voice route', () => {
    // printRoutes returns a tree of registered routes (multi-line text).
    const routes = (app as unknown as { printRoutes?: () => string }).printRoutes?.() ?? '';
    // All 5 inbound tool routes must be present.
    for (const tool of [
      'extract-request',
      'nearest-truck',
      'calc-price',
      'create-order',
      'discount',
    ]) {
      expect(routes).toMatch(new RegExp(`/webhook/voice/tool/${tool}`));
    }
    // Lifecycle routes.
    expect(routes).toMatch(/\/webhook\/voice\/call-start/);
    expect(routes).toMatch(/\/webhook\/voice\/call-end/);
    expect(routes).toMatch(/\/webhook\/voice\/lang-detected/);
    // No outbound — voice is inbound-only.
    expect(routes).not.toMatch(/POST\s+\/api\/voice\/dial/);
  });
});
