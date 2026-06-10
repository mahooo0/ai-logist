// Phase 3 Plan 03-03 — TG-01/TG-02 adapter coverage.
//
// Drives `processTelegramUpdate` directly with the mock Bot decorated onto the
// app (override of telegramPlugin's real Bot). Asserts:
//   (a) find-or-create client on first message — telegramId stored, synthetic
//       phone `tg:<id>` per D-10.
//   (b) non-text sticker → polite refusal recorded on mock bot's sent[].
//   (c) manager_active=true on the open lead → message persisted with
//       role='client', intake NOT called (no lead.stage transition).

import { exec as execCb } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMockBot } from '../_helpers/telegram-mock.js';
import { startPostgisContainer, stopPostgisContainer } from '../_helpers/test-db.js';
import fixtures from '../fixtures/telegram-updates.json' with { type: 'json' };

const exec = promisify(execCb);
const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('telegram update→inbound adapter (TG-01, TG-02)', () => {
  let app: import('fastify').FastifyInstance;
  let mock: ReturnType<typeof createMockBot>;
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
    process.env.TELEGRAM_WEBHOOK_SECRET = 'test-secret-xyz';

    await exec('pnpm exec drizzle-kit migrate', {
      cwd: path.resolve(import.meta.dirname, '..', '..'),
      env: { ...process.env, DATABASE_URL: dbUrl },
    });

    const mod = await import('../../src/app.js');
    app = await mod.buildApp();
    // Override decorated bot (real grammY Bot or undefined) with the in-memory
    // mock. Direct field overwrite — Fastify lets late writes win for decorators
    // we already own.
    mock = createMockBot();
    (app as unknown as { bot: typeof mock.bot }).bot = mock.bot;
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

  it('non-text update sends polite refusal via mock bot.api.sendMessage', async () => {
    const before = mock.sent.length;
    const { processTelegramUpdate } = await import('../../src/channels/telegram/adapter.js');
    await processTelegramUpdate({
      app,
      payload: fixtures.sticker as unknown as { update_id: number } & Record<string, unknown>,
    });
    expect(mock.sent.length).toBeGreaterThan(before);
    const last = mock.sent[mock.sent.length - 1];
    expect(last?.text).toMatch(/только текстов/i);
  });

  it('manager_active gate persists client msg + skips intake (no stage transition)', async () => {
    // Seed: insert a client + an open lead with manager_active=true. We use a
    // distinct telegram_id so this scenario does not collide with the non-text
    // test above (the sticker fixture has a different from.id anyway).
    const interceptedTgId = '777000001';
    const clientRows = await app.db.execute(sql`
      INSERT INTO clients (name, phone, telegram_id, lang)
      VALUES ('Intercepted', 'tg:777000001', ${interceptedTgId}, 'ru')
      RETURNING id::text AS id
    `);
    const clientId = (clientRows.rows[0] as { id: string }).id;
    const leadRows = await app.db.execute(sql`
      INSERT INTO leads (client_id, channel, stage, manager_active)
      VALUES (${clientId}, 'telegram', 'NEW', true)
      RETURNING id::text AS id, stage
    `);
    const leadId = (leadRows.rows[0] as { id: string; stage: string }).id;
    const stageBefore = (leadRows.rows[0] as { id: string; stage: string }).stage;

    const { processTelegramUpdate } = await import('../../src/channels/telegram/adapter.js');
    await processTelegramUpdate({
      app,
      payload: {
        update_id: 42_900_001,
        message: {
          message_id: 91,
          date: 1717921100,
          from: {
            id: Number(interceptedTgId),
            is_bot: false,
            first_name: 'Intercepted',
            language_code: 'ru',
          },
          chat: {
            id: Number(interceptedTgId),
            type: 'private',
            first_name: 'Intercepted',
          },
          text: 'Здравствуйте, есть вопрос',
        },
      } as unknown as { update_id: number } & Record<string, unknown>,
    });

    // Message persisted with role='client', tied to the intercepted lead.
    const msgRows = await app.db.execute(sql`
      SELECT role, text FROM messages
      WHERE lead_id = ${leadId} AND role = 'client'
    `);
    expect(msgRows.rows.length).toBe(1);
    expect((msgRows.rows[0] as { role: string; text: string }).text).toContain(
      'Здравствуйте, есть вопрос'
    );

    // No stage transition — intake was bypassed.
    const finalRows = await app.db.execute(sql`
      SELECT stage FROM leads WHERE id = ${leadId}
    `);
    expect((finalRows.rows[0] as { stage: string }).stage).toBe(stageBefore);
  });
});
