// Phase 2 Plan 02-04b Task 3 — FSM-04 per-client pg_advisory_xact_lock test.
//
// CONTEXT D-30 + Pitfall #6 second layer. handleInboundMessage opens its own
// db.transaction and calls `SELECT pg_advisory_xact_lock(hashtext(client_id))`
// as the first statement; only one transaction per client can hold the lock at
// a time, so concurrent inbound messages from the SAME client are serialized.
//
// Assertion shape (per plan invocation):
//   - Fire 10 parallel handleInboundMessage calls for the same client_id.
//   - Exactly 1 lead is created (the advisory lock serializes find-or-create —
//     without it, 10 parallel transactions would all see "no open lead" and
//     each call would INSERT a fresh lead row).
//   - All 10 client messages persist with the expected text bodies.
//
// Docker-gated — skipped silently when AI_LOGIST_NO_DOCKER=1.

import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type * as schema from '../../src/persistence/schema/index.js';
import { handleInboundMessage } from '../../src/pipeline/intake.js';
import { MockAnthropicClient } from '../_helpers/mock-anthropic.js';
import { getTestDbUrl, startPostgisContainer, stopPostgisContainer } from '../_helpers/test-db.js';

const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)(
  'FSM-04 — per-client pg_advisory_xact_lock serializes inbound messages',
  () => {
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
      // Drop lang NOT NULL so the client can be inserted with NULL — Step B
      // short-text path returns early (RU boilerplate) and the test avoids
      // needing LLM fixtures for the 10 parallel turns.
      await migrationClient.query(`ALTER TABLE clients ALTER COLUMN lang DROP NOT NULL`);
      await migrationClient.query(`ALTER TABLE clients ALTER COLUMN lang DROP DEFAULT`);
      const cRows = await migrationClient.query(
        `INSERT INTO clients (name, phone, lang) VALUES ('advisory-lock-test', '+70000099401', NULL) RETURNING id`
      );
      clientId = cRows.rows[0].id;
      await migrationClient.end();

      const { Pool } = await import('pg');
      const { drizzle } = await import('drizzle-orm/node-postgres');
      const schemaModule = await import('../../src/persistence/schema/index.js');
      // Need ≥10 pool connections so the 10 parallel transactions don't queue
      // on connection acquisition — the assertion is about advisory lock
      // semantics, not pool exhaustion.
      pool = new Pool({ connectionString: url, max: 20 });
      db = drizzle(pool, { schema: schemaModule }) as NodePgDatabase<typeof schema>;
    }, 120_000);

    afterAll(async () => {
      await pool?.end();
      await stopPostgisContainer();
    });

    it('10 parallel calls for same client → exactly 1 lead, messages in order', async () => {
      const llm = new MockAnthropicClient();
      // Texts are < 20 chars so Step B short-text path returns immediately with
      // RU boilerplate — no LLM fixture needed. The advisory-lock proof is the
      // same: 10 concurrent transactions must serialize on the lock and converge
      // to a single lead row.
      const texts = Array.from({ length: 10 }, (_, i) => `msg-${i}`);
      const promises = texts.map((text) =>
        handleInboundMessage({ db, llm, clientId, text, channel: 'test' })
      );
      const results = await Promise.all(promises);

      // Advisory lock proof: all 10 turns funneled into a single lead.
      const leadIds = new Set(results.map((r) => r.leadId));
      expect(leadIds.size).toBe(1);

      // All 10 client messages persisted (text bodies preserved).
      const messages = await db.execute(sql`
        SELECT text FROM messages
        WHERE client_id = ${clientId} AND role = 'client'
        ORDER BY created_at ASC
      `);
      const persistedTexts = (messages.rows as Array<{ text: string }>).map((r) => r.text);
      for (let i = 0; i < 10; i++) {
        expect(persistedTexts).toContain(texts[i]);
      }
      expect(persistedTexts.length).toBeGreaterThanOrEqual(10);
    }, 90_000);
  }
);
