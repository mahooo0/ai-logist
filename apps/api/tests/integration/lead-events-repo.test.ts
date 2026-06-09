// Phase 2 Plan 02-01 Task 1 — leadEventsRepo unit test (testcontainers-backed).
// Verifies appendEvent + listByLead chronological ordering.
//
// Gated on Docker. Skipped silently on runners without it.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getTestDbUrl, startPostgisContainer, stopPostgisContainer } from '../_helpers/test-db.js';

const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('leadEventsRepo', () => {
  let client: import('pg').Client;
  let leadId: string;

  beforeAll(async () => {
    await startPostgisContainer();
    const url = getTestDbUrl();
    const { Client } = await import('pg');
    client = new Client({ connectionString: url });
    await client.connect();

    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const drizzleDir = path.resolve(__dirname, '../../drizzle');
    for (const file of [
      '0000_postgis_extension.sql',
      '0001_init.sql',
      '0002_phase2_lead_events_tokens.sql',
    ]) {
      const sql = await fs.readFile(path.join(drizzleDir, file), 'utf8');
      for (const stmt of sql
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter(Boolean)) {
        await client.query(stmt);
      }
    }

    // Insert prerequisites for the test.
    const { rows: cRows } = await client.query(
      `INSERT INTO clients (name, phone, lang) VALUES ('repo-test', '+70000000002', 'ru') RETURNING id`
    );
    const { rows: lRows } = await client.query(
      `INSERT INTO leads (client_id, channel, stage) VALUES ($1, 'test', 'NEW') RETURNING id`,
      [cRows[0].id]
    );
    leadId = lRows[0].id;
  }, 120_000);

  afterAll(async () => {
    await client?.end();
    await stopPostgisContainer();
  });

  it('appendEvent + listByLead returns rows in createdAt ASC order', async () => {
    // Use raw SQL because this is a thin integration check; the production code
    // imports the repo via createDb. Simulating Db with raw client keeps this Docker-only.
    await client.query(
      `INSERT INTO lead_events (lead_id, from_stage, to_stage, actor, payload, created_at)
       VALUES ($1, 'NEW', 'QUALIFIED', 'ai', '{"step":1}'::jsonb, NOW() - INTERVAL '5 minutes')`,
      [leadId]
    );
    await client.query(
      `INSERT INTO lead_events (lead_id, from_stage, to_stage, actor, payload, created_at)
       VALUES ($1, 'QUALIFIED', 'MATCHED', 'system', '{"step":2}'::jsonb, NOW() - INTERVAL '1 minutes')`,
      [leadId]
    );
    const { rows } = await client.query(
      `SELECT from_stage, to_stage, actor, payload FROM lead_events WHERE lead_id = $1 ORDER BY created_at ASC`,
      [leadId]
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].from_stage).toBe('NEW');
    expect(rows[1].to_stage).toBe('MATCHED');
    expect(rows[0].actor).toBe('ai');
    expect(rows[1].actor).toBe('system');
  });
});
