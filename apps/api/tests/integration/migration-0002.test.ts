// Phase 2 Plan 02-01 Task 1 — Migration 0002 integration test.
// CONTEXT D-37 — verifies the mini-migration applies cleanly on top of 0001
// and that the schema shape matches the expected DDL.
//
// Gated on Docker (testcontainers). Skipped silently on runners without Docker.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getTestDbUrl, startPostgisContainer, stopPostgisContainer } from '../_helpers/test-db.js';

const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('migration 0002 — lead_events + token ledger', () => {
  let client: import('pg').Client;

  beforeAll(async () => {
    await startPostgisContainer();
    const url = getTestDbUrl();
    const { Client } = await import('pg');
    client = new Client({ connectionString: url });
    await client.connect();

    // Apply migrations 0000 + 0001 + 0002 in order.
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const drizzleDir = path.resolve(__dirname, '../../drizzle');
    for (const file of [
      '0000_postgis_extension.sql',
      '0001_init.sql',
      '0002_phase2_lead_events_tokens.sql',
    ]) {
      const sql = await fs.readFile(path.join(drizzleDir, file), 'utf8');
      // Drizzle uses --> statement-breakpoint as separator
      const statements = sql
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const stmt of statements) {
        await client.query(stmt);
      }
    }
  }, 120_000);

  afterAll(async () => {
    await client?.end();
    await stopPostgisContainer();
  });

  it('lead_events table exists with all 7 columns', async () => {
    const { rows } = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'lead_events'
      ORDER BY ordinal_position
    `);
    const names = rows.map((r) => r.column_name);
    expect(names).toEqual([
      'id',
      'lead_id',
      'from_stage',
      'to_stage',
      'actor',
      'payload',
      'created_at',
    ]);
  });

  it('lead_event_actor enum has exactly 3 values', async () => {
    const { rows } = await client.query(
      `SELECT unnest(enum_range(NULL::lead_event_actor))::text AS v`
    );
    const values = rows.map((r) => r.v).sort();
    expect(values).toEqual(['ai', 'manager', 'system']);
  });

  it('leads tokens columns exist with correct types and defaults', async () => {
    const { rows } = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'leads' AND column_name IN ('tokens_in', 'tokens_out', 'llm_calls')
      ORDER BY column_name
    `);
    expect(rows).toHaveLength(3);
    const byName = new Map<string, { data_type: string; column_default: string }>(
      rows.map((r) => [r.column_name as string, r as { data_type: string; column_default: string }])
    );
    const tokensIn = byName.get('tokens_in');
    const tokensOut = byName.get('tokens_out');
    const llmCalls = byName.get('llm_calls');
    if (!tokensIn || !tokensOut || !llmCalls) throw new Error('missing column row');
    expect(tokensIn.data_type).toBe('bigint');
    expect(tokensOut.data_type).toBe('bigint');
    expect(llmCalls.data_type).toBe('integer');
    expect(tokensIn.column_default).toBe('0');
  });

  it('leads.version was NOT re-added by 0002 (Pitfall #4)', async () => {
    const { rows } = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'leads' AND column_name = 'version'
    `);
    expect(rows).toHaveLength(1);
  });

  it('lead_events FK CASCADE deletes child rows when lead is removed', async () => {
    // Insert a client + lead + lead_event, then delete the lead and verify cascade.
    const { rows: clientRows } = await client.query(`
      INSERT INTO clients (name, phone, lang) VALUES ('test-client', '+70000000001', 'ru')
      RETURNING id
    `);
    const clientId = clientRows[0].id;
    const { rows: leadRows } = await client.query(
      `INSERT INTO leads (client_id, channel, stage) VALUES ($1, 'test', 'NEW') RETURNING id`,
      [clientId]
    );
    const leadId = leadRows[0].id;
    await client.query(
      `INSERT INTO lead_events (lead_id, from_stage, to_stage, actor) VALUES ($1, 'NEW', 'QUALIFIED', 'ai')`,
      [leadId]
    );
    const before = await client.query(
      `SELECT COUNT(*)::int AS c FROM lead_events WHERE lead_id = $1`,
      [leadId]
    );
    expect(before.rows[0].c).toBe(1);
    await client.query(`DELETE FROM leads WHERE id = $1`, [leadId]);
    const after = await client.query(
      `SELECT COUNT(*)::int AS c FROM lead_events WHERE lead_id = $1`,
      [leadId]
    );
    expect(after.rows[0].c).toBe(0);
  });
});
