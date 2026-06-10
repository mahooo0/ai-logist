// Phase 3 Plan 03-02 — TG-02 idempotency assertion.
// Post the same telegram update_id 10× and assert webhook_updates contains
// exactly 1 row. Backed by INSERT … ON CONFLICT (source, external_id) DO NOTHING
// in apps/api/src/routes/webhooks-telegram.ts.

import { exec as execCb } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { startPostgisContainer, stopPostgisContainer } from '../_helpers/test-db.js';
import { postTelegramWebhook } from '../_helpers/webhook-driver.js';
import fixtures from '../fixtures/telegram-updates.json' with { type: 'json' };

const exec = promisify(execCb);
const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';
const SECRET = 'test-secret-xyz';

describe.skipIf(!dockerAvailable)('telegram webhook idempotency (TG-02)', () => {
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

    // Apply migrations BEFORE dynamic import — config.ts validates env on load.
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

  test('10× same update_id → exactly 1 webhook_updates row (ON CONFLICT DO NOTHING)', async () => {
    const payload = fixtures.textKyivLviv;

    for (let i = 0; i < 10; i++) {
      const { res } = await postTelegramWebhook(app, payload, { secretToken: SECRET });
      expect(res.statusCode).toBe(200);
    }

    // Allow async setImmediate workers (Wave 2 stub) to drain.
    await new Promise((r) => setTimeout(r, 200));

    const rows = await app.db.execute(sql`
      SELECT count(*)::int AS c
      FROM webhook_updates
      WHERE source = 'telegram' AND external_id = ${String(payload.update_id)}
    `);
    expect((rows.rows[0] as { c: number }).c).toBe(1);
  });
});
