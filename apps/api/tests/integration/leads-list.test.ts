// Phase 4 Plan 04-03 — GET /api/leads integration coverage (API-03).
//
// Boots Fastify against a testcontainers PostGIS instance, seeds 2 leads
// (one stage=NEW channel=telegram, one stage=QUOTED channel=voice), drives:
//   GET /api/leads?stage=NEW
//   GET /api/leads?channel=voice
//   GET /api/leads?limit=1 + ?limit=1&offset=1
// via app.inject().
//
// Docker-gated. Skipped silently when AI_LOGIST_NO_DOCKER=1.

import { exec as execCb } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPostgisContainer, stopPostgisContainer } from '../_helpers/test-db.js';

const exec = promisify(execCb);
const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('Phase 4 API-03 — GET /api/leads', () => {
  let app: FastifyInstance;
  let originalDbUrl: string | undefined;
  let originalRedisUrl: string | undefined;
  let clientId: string;

  beforeAll(async () => {
    const dbUrl = await startPostgisContainer();
    originalDbUrl = process.env.DATABASE_URL;
    originalRedisUrl = process.env.REDIS_URL;
    process.env.DATABASE_URL = dbUrl;
    process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

    await exec('pnpm exec drizzle-kit migrate', {
      cwd: path.resolve(import.meta.dirname, '..', '..'),
      env: { ...process.env, DATABASE_URL: dbUrl },
    });

    const mod = await import('../../src/app.js');
    app = await mod.buildApp();
    await app.ready();

    // Seed: 1 client + 2 leads (NEW/telegram + QUOTED/voice).
    const cRows = await app.db.execute(sql`
      INSERT INTO clients (name, phone, lang)
      VALUES ('Leads List Test', '+70000000001', 'ru')
      RETURNING id::text AS id
    `);
    clientId = (cRows.rows[0] as { id: string }).id;
    await app.db.execute(sql`
      INSERT INTO leads (client_id, channel, stage)
      VALUES (${clientId}, 'telegram', 'NEW')
    `);
    // Small sleep so created_at order is deterministic for pagination test.
    await new Promise((r) => setTimeout(r, 10));
    await app.db.execute(sql`
      INSERT INTO leads (client_id, channel, stage)
      VALUES (${clientId}, 'voice', 'QUOTED')
    `);
  }, 120_000);

  afterAll(async () => {
    if (app) await app.close();
    await stopPostgisContainer();
    if (originalDbUrl !== undefined) process.env.DATABASE_URL = originalDbUrl;
    if (originalRedisUrl !== undefined) process.env.REDIS_URL = originalRedisUrl;
  });

  it('filters by stage=NEW — returns only the NEW/telegram lead', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/leads?stage=NEW' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{ stage: string; channel: string; clientId: string }>;
    const ours = body.filter((l) => l.clientId === clientId);
    expect(ours.length).toBe(1);
    expect(ours[0]?.stage).toBe('NEW');
    expect(ours[0]?.channel).toBe('telegram');
  });

  it('filters by channel=voice — returns the QUOTED/voice lead (coerced from `call` if legacy)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/leads?channel=voice' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{ stage: string; channel: string; clientId: string }>;
    const ours = body.filter((l) => l.clientId === clientId);
    expect(ours.length).toBe(1);
    expect(ours[0]?.channel).toBe('voice');
  });

  it('paginates with limit=1 + offset=1 (sorted createdAt DESC)', async () => {
    const r1 = await app.inject({ method: 'GET', url: `/api/leads?clientId=${clientId}&limit=1` });
    const r2 = await app.inject({
      method: 'GET',
      url: `/api/leads?clientId=${clientId}&limit=1&offset=1`,
    });
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
    const p1 = r1.json() as Array<{ id: string; stage: string }>;
    const p2 = r2.json() as Array<{ id: string; stage: string }>;
    expect(p1.length).toBe(1);
    expect(p2.length).toBe(1);
    expect(p1[0]?.id).not.toBe(p2[0]?.id);
    // DESC: most-recently-inserted (QUOTED/voice) comes first.
    expect(p1[0]?.stage).toBe('QUOTED');
    expect(p2[0]?.stage).toBe('NEW');
  });
});
