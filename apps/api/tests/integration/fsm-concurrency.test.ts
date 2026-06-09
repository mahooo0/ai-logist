// Phase 2 Plan 02-03 Task 3 — FSM concurrency test (FSM-03, Pitfall #6).
//
// Validates determinism of transitionLead across 100 iterations of
// Promise.all([transitionLead(A), transitionLead(B)]) on the same lead.
// Every iteration MUST produce exactly 1 fulfilled + 1 rejected; the rejected
// reason MUST be VersionMismatch OR IllegalTransition.
//
// Source: 02-PLAN.md Task 3, 02-RESEARCH.md §13, 02-VALIDATION.md sign-off #4.
//
// Docker-gated. Skipped silently when AI_LOGIST_NO_DOCKER=1 or no Docker daemon.

import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type * as schema from '../../src/persistence/schema/index.js';
import { IllegalTransition, VersionMismatch } from '../../src/pipeline/lifecycle/errors.js';
import { transitionLead } from '../../src/pipeline/lifecycle/lead-fsm.js';
import { getTestDbUrl, startPostgisContainer, stopPostgisContainer } from '../_helpers/test-db.js';

const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)(
  'FSM concurrency — 100 iterations of Promise.all transitions',
  () => {
    let db: NodePgDatabase<typeof schema>;
    let pool: import('pg').Pool;
    let clientId: string;

    beforeAll(async () => {
      await startPostgisContainer();
      const url = getTestDbUrl();

      // Apply migrations 0000 + 0001 + 0002 (same pattern as migration-0002.test.ts).
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
      // Insert a client for FK referencing.
      const { rows: cRows } = await migrationClient.query(
        `INSERT INTO clients (name, phone, lang) VALUES ('fsm-concurrency-test', '+70000099101', 'ru')
         RETURNING id`
      );
      clientId = cRows[0].id;
      await migrationClient.end();

      // Now build the Drizzle Db used by transitionLead.
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

    it('Promise.all on same lead — 100 iterations all deterministic', async () => {
      const iterations = 100;
      const stats = {
        fulfilled: 0,
        rejected: 0,
        illegal: 0,
        versionMismatch: 0,
      };

      for (let i = 0; i < iterations; i++) {
        // Fresh lead in QUOTED, version=0, for each iteration.
        const insert = await db.execute(sql`
          INSERT INTO leads (client_id, channel, stage, version, quoted_price)
          VALUES (${clientId}, 'test', 'QUOTED', 0, 2500000)
          RETURNING id
        `);
        const leadId = (insert.rows[0] as { id: string }).id;

        const results = await Promise.allSettled([
          transitionLead(db, {
            leadId,
            to: 'AGREED',
            actor: 'ai',
            payload: { src: 'A', iter: i },
          }),
          transitionLead(db, {
            leadId,
            to: 'AGREED',
            actor: 'manager',
            payload: { src: 'B', iter: i },
          }),
        ]);

        const ful = results.filter((r) => r.status === 'fulfilled').length;
        const rej = results.filter((r) => r.status === 'rejected').length;
        expect(ful).toBe(1);
        expect(rej).toBe(1);

        const rejected = results.find((r) => r.status === 'rejected') as
          | PromiseRejectedResult
          | undefined;
        if (!rejected) throw new Error('rejected result missing');
        const rejReason = rejected.reason;
        const isExpectedError =
          rejReason instanceof VersionMismatch || rejReason instanceof IllegalTransition;
        expect(isExpectedError).toBe(true);

        stats.fulfilled += ful;
        stats.rejected += rej;
        if (rejReason instanceof VersionMismatch) stats.versionMismatch++;
        if (rejReason instanceof IllegalTransition) stats.illegal++;
      }

      expect(stats.fulfilled).toBe(iterations);
      expect(stats.rejected).toBe(iterations);
      expect(stats.illegal + stats.versionMismatch).toBe(iterations);
    }, 90_000);
  }
);
