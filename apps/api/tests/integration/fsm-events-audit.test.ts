// Phase 2 Plan 02-03 Task 3 — FSM audit log integration test (FSM-05).
//
// Asserts that every successful transitionLead writes a lead_events row with the
// correct from_stage / to_stage / actor / payload, and that leadEventsRepo.listByLead
// returns them in chronological order.
//
// Source: 02-PLAN.md Task 3, 02-CONTEXT.md FSM-05, 02-RESEARCH.md §6 (audit INSERT).
//
// Docker-gated. Skipped silently when AI_LOGIST_NO_DOCKER=1.

import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { leadEventsRepo } from '../../src/persistence/repos/index.js';
import type * as schema from '../../src/persistence/schema/index.js';
import { transitionLead } from '../../src/pipeline/lifecycle/lead-fsm.js';
import { getTestDbUrl, startPostgisContainer, stopPostgisContainer } from '../_helpers/test-db.js';

const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('FSM-05 — audit log of every lead transition', () => {
  let db: NodePgDatabase<typeof schema>;
  let pool: import('pg').Pool;
  let clientId: string;

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
    const { rows: cRows } = await migrationClient.query(
      `INSERT INTO clients (name, phone, lang) VALUES ('fsm-audit-test', '+70000099201', 'ru') RETURNING id`
    );
    clientId = cRows[0].id;
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

  it('transitionLead inserts lead_events row with from_stage, to_stage, actor, payload', async () => {
    const ins = await db.execute(sql`
      INSERT INTO leads (client_id, channel, stage, version)
      VALUES (${clientId}, 'test', 'NEW', 0) RETURNING id
    `);
    const leadId = (ins.rows[0] as { id: string }).id;

    // Two successive legal transitions: NEW → QUALIFIED (ai), QUALIFIED → MATCHED (system).
    const r1 = await transitionLead(db, {
      leadId,
      to: 'QUALIFIED',
      actor: 'ai',
      payload: { extracted: true, confidence: 0.92 },
    });
    expect(r1.from).toBe('NEW');
    expect(r1.to).toBe('QUALIFIED');

    const r2 = await transitionLead(db, {
      leadId,
      to: 'MATCHED',
      actor: 'system',
      payload: { trucks_found: 3 },
    });
    expect(r2.from).toBe('QUALIFIED');
    expect(r2.to).toBe('MATCHED');

    const events = await leadEventsRepo.listByLead(db, leadId);
    expect(events).toHaveLength(2);

    expect(events[0]?.fromStage).toBe('NEW');
    expect(events[0]?.toStage).toBe('QUALIFIED');
    expect(events[0]?.actor).toBe('ai');
    expect(events[0]?.payload).toMatchObject({ extracted: true, confidence: 0.92 });

    expect(events[1]?.fromStage).toBe('QUALIFIED');
    expect(events[1]?.toStage).toBe('MATCHED');
    expect(events[1]?.actor).toBe('system');
    expect(events[1]?.payload).toMatchObject({ trucks_found: 3 });
  }, 30_000);

  it('lead.version increments on every transition', async () => {
    const ins = await db.execute(sql`
      INSERT INTO leads (client_id, channel, stage, version)
      VALUES (${clientId}, 'test', 'NEW', 0) RETURNING id
    `);
    const leadId = (ins.rows[0] as { id: string }).id;

    const r1 = await transitionLead(db, { leadId, to: 'QUALIFIED', actor: 'ai' });
    expect(r1.version).toBe(1);
    const r2 = await transitionLead(db, { leadId, to: 'MATCHED', actor: 'ai' });
    expect(r2.version).toBe(2);
    const r3 = await transitionLead(db, { leadId, to: 'QUOTED', actor: 'ai' });
    expect(r3.version).toBe(3);
  }, 30_000);

  it('payload defaults to {} when omitted (FSM-05 invariant: row always written)', async () => {
    const ins = await db.execute(sql`
      INSERT INTO leads (client_id, channel, stage, version)
      VALUES (${clientId}, 'test', 'NEW', 0) RETURNING id
    `);
    const leadId = (ins.rows[0] as { id: string }).id;

    await transitionLead(db, { leadId, to: 'QUALIFIED', actor: 'ai' });
    const events = await leadEventsRepo.listByLead(db, leadId);
    expect(events).toHaveLength(1);
    expect(events[0]?.payload).toEqual({});
  }, 30_000);
});
