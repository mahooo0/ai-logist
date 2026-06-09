// Phase 2 Plan 02-04a Task 1 — token-budget integration test (CONTEXT D-36, Pitfall #12).
//
// Asserts that a lead whose tokens_in + tokens_out already exceed
// LLM_TOKEN_BUDGET_PER_LEAD (default 30000) transitions → LOST on the next
// inbound message, with `lead_events.payload.reason === 'token_budget_exhausted'`.
//
// Docker-gated — skipped silently when AI_LOGIST_NO_DOCKER=1 (same pattern as
// fsm-concurrency.test.ts + fsm-events-audit.test.ts).

import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type * as schema from '../../src/persistence/schema/index.js';
import { runScript } from '../_helpers/dialog-harness.js';
import { MockAnthropicClient } from '../_helpers/mock-anthropic.js';
import { getTestDbUrl, startPostgisContainer, stopPostgisContainer } from '../_helpers/test-db.js';

const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('Token budget — lead over budget → LOST', () => {
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
      `INSERT INTO clients (name, phone, lang) VALUES ('token-budget-test', '+70000099301', 'ru') RETURNING id`
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

  it('lead with tokens_in+out > 30000 → LOST on next message with payload.reason', async () => {
    // Pre-seed a QUOTED lead with token ledger over the 30000 default budget.
    const ins = await db.execute(sql`
      INSERT INTO leads (client_id, channel, stage, version, tokens_in, tokens_out)
      VALUES (${clientId}, 'test', 'QUOTED', 0, 20000, 15000)
      RETURNING id
    `);
    const leadId = (ins.rows[0] as { id: string }).id;

    const llm = new MockAnthropicClient();

    // Any next message — even short — triggers Step C (token-budget check) and
    // → LOST. We do NOT need a fixture because Step C aborts BEFORE the LLM call.
    await runScript(db, llm, clientId, [{ from: 'client', text: 'Любое следующее сообщение' }]);

    const leadRows = await db.execute(sql`SELECT stage FROM leads WHERE id = ${leadId}`);
    expect((leadRows.rows[0] as { stage: string }).stage).toBe('LOST');

    const eventRows = await db.execute(sql`
      SELECT payload
      FROM lead_events
      WHERE lead_id = ${leadId}
      ORDER BY created_at DESC
      LIMIT 1
    `);
    const payload = (eventRows.rows[0] as { payload: { reason: string } }).payload;
    expect(payload.reason).toBe('token_budget_exhausted');
  }, 60_000);
});
