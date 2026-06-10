// Phase 3 Plan 03-02 — TG-01 / API-13 secret_token verification.
// Telegram sends X-Telegram-Bot-Api-Secret-Token header iff secret_token was
// passed to setWebhook. Missing or mismatched header → 401.

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

describe.skipIf(!dockerAvailable)(
  'telegram webhook secret_token verification (TG-01, API-13)',
  () => {
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

    test('rejects request with missing secret_token header → 401', async () => {
      const { res } = await postTelegramWebhook(app, fixtures.textKyivLviv);
      expect(res.statusCode).toBe(401);
    });

    test('rejects request with mismatched secret_token → 401', async () => {
      const { res } = await postTelegramWebhook(app, fixtures.textKyivLviv, {
        secretToken: 'wrong-secret-value',
      });
      expect(res.statusCode).toBe(401);
    });

    test('accepts request with matching secret_token → 200', async () => {
      const { res } = await postTelegramWebhook(app, fixtures.textKyivLviv, {
        secretToken: SECRET,
      });
      expect(res.statusCode).toBe(200);
    });
  }
);
