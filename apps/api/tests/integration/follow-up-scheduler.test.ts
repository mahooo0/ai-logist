// Phase 2 Plan 02-04b Task 3 — FSM-06 auto-follow-up scheduler test (FAKE TIMERS).
//
// CRITICAL (per CHECKER WARNING #5): this test drives the scheduler via
//   vi.useFakeTimers({ shouldAdvanceTime: true, now: FROZEN_NOW })
//   + vi.setSystemTime(...)
//   + vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
//
// NOT real wall-clock, NOT a `NOW() - 25h` SQL-side trick. The fake-timer
// approach exercises the FULL setInterval lifecycle deterministically:
//   1. Insert a lead with updated_at = frozen time.
//   2. Register the scheduler via registerFollowUpScheduler(app) in 'production'
//      NODE_ENV (decorated on the Fastify instance).
//   3. setSystemTime to 25h after the lead.updated_at — lead is now stale.
//   4. advanceTimersByTimeAsync(POLL_INTERVAL_MS) → setInterval callback fires
//      → followUpTick runs → transitionLead → LOST.
//   5. Assert lead.stage === 'LOST' + payload.reason === 'no_reply_24h'.
//   6. await app.close() → onClose hook clears the interval.
//   7. Insert a SECOND stale lead, advance time → assert second lead STAYS
//      QUOTED (no further ticks after close — proves clearInterval).
//
// Also drives followUpTick directly with a 5h-stale lead to verify the quiet
// path is non-mutating.
//
// Docker-gated — skipped silently when AI_LOGIST_NO_DOCKER=1.

import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import Fastify from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as schema from '../../src/persistence/schema/index.js';
import {
  followUpTick,
  POLL_INTERVAL_MS,
  registerFollowUpScheduler,
} from '../../src/pipeline/follow-up-scheduler.js';
import { getTestDbUrl, startPostgisContainer, stopPostgisContainer } from '../_helpers/test-db.js';

const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('FSM-06 — auto-follow-up scheduler (fake-timer driven)', () => {
  let db: NodePgDatabase<typeof schema>;
  let pool: import('pg').Pool;
  let clientId: string;
  // biome-ignore lint/suspicious/noExplicitAny: Fastify app + db decorator typed via cast
  let app: any;

  const FROZEN_NOW = new Date('2026-06-09T12:00:00Z');

  beforeAll(async () => {
    await startPostgisContainer();
    const url = getTestDbUrl();

    const { Client } = await import('pg');
    const migrationClient = new Client({ connectionString: url });
    await migrationClient.connect();
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const drizzleDir = path.resolve(__dirname, '../../drizzle');
    for (const file of [
      '0000_postgis_extension.sql',
      '0001_init.sql',
      '0002_phase2_lead_events_tokens.sql',
    ]) {
      const ddl = await fs.readFile(path.join(drizzleDir, file), 'utf8');
      for (const stmt of ddl
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter(Boolean)) {
        await migrationClient.query(stmt);
      }
    }
    const cRows = await migrationClient.query(
      `INSERT INTO clients (name, phone, lang) VALUES ('scheduler-test', '+70000099501', 'ru') RETURNING id`
    );
    clientId = cRows.rows[0].id;
    await migrationClient.end();

    const { Pool } = await import('pg');
    const { drizzle } = await import('drizzle-orm/node-postgres');
    const schemaModule = await import('../../src/persistence/schema/index.js');
    pool = new Pool({ connectionString: url });
    db = drizzle(pool, { schema: schemaModule }) as NodePgDatabase<typeof schema>;
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await stopPostgisContainer();
  });

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: FROZEN_NOW });
  });

  afterEach(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
    vi.useRealTimers();
  });

  it('FULL lifecycle: 25h-stale lead → tick fires → → LOST → clearInterval on close', async () => {
    // 1. Insert a lead with updated_at frozen at FROZEN_NOW.
    const ins = await db.execute(sql`
      INSERT INTO leads (client_id, channel, stage, version, updated_at)
      VALUES (${clientId}, 'test', 'QUOTED', 0, ${FROZEN_NOW.toISOString()}::timestamptz)
      RETURNING id
    `);
    const leadId = (ins.rows[0] as { id: string }).id;

    // 2. Boot a Fastify-shaped app and decorate db + config. Register scheduler
    //    in production mode so the setInterval path runs.
    app = Fastify({ logger: false });
    app.decorate('db', db);
    app.decorate('config', { NODE_ENV: 'production' });
    registerFollowUpScheduler(app);

    // 3. Advance the system clock to 25h after FROZEN_NOW.
    vi.setSystemTime(new Date(FROZEN_NOW.getTime() + 25 * 60 * 60 * 1000));

    // 4. Drive one setInterval tick — fires followUpTick synchronously inside
    //    the timer callback; advanceTimersByTimeAsync awaits the kicked-off
    //    async work in the same flush.
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    // 5. Assert lead.stage === 'LOST' + audit payload.
    const after = await db.execute(sql`SELECT stage FROM leads WHERE id = ${leadId}`);
    expect((after.rows[0] as { stage: string }).stage).toBe('LOST');

    const events = await db.execute(sql`
      SELECT payload FROM lead_events
      WHERE lead_id = ${leadId}
      ORDER BY created_at DESC
      LIMIT 1
    `);
    expect((events.rows[0] as { payload: { reason: string } }).payload.reason).toBe('no_reply_24h');

    // 6. Close the app — clearInterval is invoked by the onClose hook.
    await app.close();
    app = undefined;

    // 7. Insert a SECOND stale lead and advance time again. Because the
    //    interval was cleared, no further tick fires — the new lead must
    //    remain in QUOTED.
    const ins2 = await db.execute(sql`
      INSERT INTO leads (client_id, channel, stage, version, updated_at)
      VALUES (${clientId}, 'test', 'QUOTED', 0, ${FROZEN_NOW.toISOString()}::timestamptz)
      RETURNING id
    `);
    const leadId2 = (ins2.rows[0] as { id: string }).id;

    vi.setSystemTime(new Date(FROZEN_NOW.getTime() + 50 * 60 * 60 * 1000));
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    const after2 = await db.execute(sql`SELECT stage FROM leads WHERE id = ${leadId2}`);
    expect((after2.rows[0] as { stage: string }).stage).toBe('QUOTED');
  }, 90_000);

  it('followUpTick direct: 5h-stale lead (< 24h) → quiet log, stage unchanged', async () => {
    const ins = await db.execute(sql`
      INSERT INTO leads (client_id, channel, stage, version, updated_at)
      VALUES (${clientId}, 'test', 'QUOTED', 0, ${FROZEN_NOW.toISOString()}::timestamptz)
      RETURNING id
    `);
    const leadId = (ins.rows[0] as { id: string }).id;

    const fakeLog = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      trace: () => {},
      fatal: () => {},
      level: 'silent' as const,
      silent: () => {},
      child: () => fakeLog,
      bindings: () => ({}),
      // biome-ignore lint/suspicious/noExplicitAny: minimal logger shim for tick caller
    } as any;

    vi.setSystemTime(new Date(FROZEN_NOW.getTime() + 5 * 60 * 60 * 1000));
    await followUpTick({ db, log: fakeLog, config: { NODE_ENV: 'production' } });

    const after = await db.execute(sql`SELECT stage FROM leads WHERE id = ${leadId}`);
    expect((after.rows[0] as { stage: string }).stage).toBe('QUOTED');
  }, 30_000);
});
