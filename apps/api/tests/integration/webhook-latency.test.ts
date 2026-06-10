// Phase 3 Plan 03-02 — TG-02 latency budget (<100ms ack).
// ROADMAP success criterion #2: webhook handler must return 200 well before
// Telegram's 5s retry cliff. We target 100ms median via the webhook-driver's
// process.hrtime.bigint() elapsedMs measurement.

import { exec as execCb } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { startPostgisContainer, stopPostgisContainer } from '../_helpers/test-db.js';
import { postTelegramWebhook } from '../_helpers/webhook-driver.js';
import fixtures from '../fixtures/telegram-updates.json' with { type: 'json' };

const exec = promisify(execCb);
const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';
const SECRET = 'test-secret-xyz';

describe.skipIf(!dockerAvailable)('telegram webhook latency (TG-02)', () => {
  let app: import('fastify').FastifyInstance;
  let originalDbUrl: string | undefined;
  let originalRedisUrl: string | undefined;
  let originalSecret: string | undefined;

  beforeAll(async () => {
    const dbUrl = await startPostgisContainer();
    originalDbUrl = process.env.DATABASE_URL;
    originalRedisUrl = process.env.REDIS_URL;
    originalSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    process.env.DATABASE_URL = dbUrl;
    process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
    process.env.TELEGRAM_WEBHOOK_SECRET = SECRET;

    await exec('pnpm exec drizzle-kit migrate', {
      cwd: path.resolve(import.meta.dirname, '..', '..'),
      env: { ...process.env, DATABASE_URL: dbUrl },
    });

    const mod = await import('../../src/app.js');
    app = await mod.buildApp();
  }, 90_000);

  afterAll(async () => {
    if (app) await app.close();
    await stopPostgisContainer();
    if (originalDbUrl !== undefined) process.env.DATABASE_URL = originalDbUrl;
    if (originalRedisUrl !== undefined) process.env.REDIS_URL = originalRedisUrl;
    if (originalSecret !== undefined) {
      process.env.TELEGRAM_WEBHOOK_SECRET = originalSecret;
    } else {
      delete process.env.TELEGRAM_WEBHOOK_SECRET;
    }
  });

  test('acks within 100ms via postTelegramWebhook elapsedMs (success criterion #2)', async () => {
    // Warm-up call — first roundtrip carries cold connection-pool cost; we
    // measure the steady-state on the second call to match Telegram's typical
    // request flow (always many updates per minute in production).
    await postTelegramWebhook(app, fixtures.textKyivLviv, { secretToken: SECRET });

    // Use a different update_id so warm-up doesn't collide with measurement.
    const measured = await postTelegramWebhook(
      app,
      { ...fixtures.textKyivLviv, update_id: 42_999_001 },
      { secretToken: SECRET }
    );

    expect(measured.res.statusCode).toBe(200);
    expect(measured.elapsedMs).toBeLessThan(100);
  });
});
