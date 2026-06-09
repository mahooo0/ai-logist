// Phase 2 Plan 02-04a Task 1 — sticky language detection integration test.
//
// CONTEXT D-12..D-15, LOGIC-02 closure of Pitfall #7 (Surzhyk + short-message
// mis-classification).
//
// THREE ASSERTIONS (per checker additional fix — RU-after-UA stickiness):
//   1. "ок" (<20 chars)            → clients.lang stays NULL, AI reply = RU boilerplate.
//   2. "Київ-Львів 18 тонн тент"   → clients.lang = 'ua', AI reply contains UA text.
//   3. "Сколько стоит, объясните?" → clients.lang STAYS 'ua' (sticky); AI reply STAYS UA.
//
// Docker-gated — skipped silently when AI_LOGIST_NO_DOCKER=1.

import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type * as schema from '../../src/persistence/schema/index.js';
import { runScript } from '../_helpers/dialog-harness.js';
import { MockAnthropicClient } from '../_helpers/mock-anthropic.js';
import { getTestDbUrl, startPostgisContainer, stopPostgisContainer } from '../_helpers/test-db.js';

const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

/** UA-shape detector: tokens that only the UA copy in intake.ts emits. */
const UA_REPLY_PATTERN =
  /Обробка|Ціна|підтвер|Перевищили|Зв'яжіться|Обчислюю|місто|Уточніть|Не знайшов|Не вдалося/iu;

describe.skipIf(!dockerAvailable)(
  'Sticky language — short msg → no save; UA detected → saved; subsequent RU msg keeps UA',
  () => {
    let db: NodePgDatabase<typeof schema>;
    let pool: import('pg').Pool;

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
      // Drop the NOT NULL on clients.lang so the test can insert fresh clients
      // with lang=NULL — sticky detection requires the column to start NULL.
      await migrationClient.query(`ALTER TABLE clients ALTER COLUMN lang DROP NOT NULL`);
      await migrationClient.query(`ALTER TABLE clients ALTER COLUMN lang DROP DEFAULT`);
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

    it('sticky lang: ок → no save; UA-marker → saved; subsequent RU msg keeps UA reply', async () => {
      // Fresh client with NULL lang.
      const fresh = await db.execute(sql`
        INSERT INTO clients (name, phone, lang)
        VALUES ('sticky-lang-test', '+380501111111', NULL)
        RETURNING id
      `);
      const cid = (fresh.rows[0] as { id: string }).id;
      const llm = new MockAnthropicClient();

      // -------- Assertion 1: "ок" (<20 chars) — RU boilerplate, lang NOT saved.
      await runScript(db, llm, cid, [{ from: 'client', text: 'ок' }]);
      const after1 = await db.execute(sql`SELECT lang FROM clients WHERE id = ${cid}`);
      expect((after1.rows[0] as { lang: string | null }).lang).toBeNull();

      // -------- Assertion 2: "Київ-Львів 18 тонн тент" — UA markers (і, ї) → lang='ua'.
      await runScript(db, llm, cid, [{ from: 'client', text: 'Київ-Львів 18 тонн тент' }]);
      const after2 = await db.execute(sql`SELECT lang FROM clients WHERE id = ${cid}`);
      expect((after2.rows[0] as { lang: string }).lang).toBe('ua');

      // AI must have replied at least once with UA-shape text.
      const aiTextsRows2 = await db.execute(sql`
        SELECT text FROM messages
        WHERE client_id = ${cid} AND role = 'ai'
        ORDER BY created_at ASC
      `);
      const aiTexts2 = (aiTextsRows2.rows as Array<{ text: string }>).map((r) => r.text);
      expect(aiTexts2.some((t) => UA_REPLY_PATTERN.test(t))).toBe(true);

      // -------- Assertion 3 (CRITICAL — sticky test per CONTEXT D-12):
      //          client sends a clearly RU message AFTER UA was detected.
      //          Expectation: AI reply STAYS UA. clients.lang stays 'ua'.
      await runScript(db, llm, cid, [
        { from: 'client', text: 'Сколько стоит, объясните пожалуйста?' },
      ]);

      const after3 = await db.execute(sql`SELECT lang FROM clients WHERE id = ${cid}`);
      expect((after3.rows[0] as { lang: string }).lang).toBe('ua');

      const latestAiRows = await db.execute(sql`
        SELECT text FROM messages
        WHERE client_id = ${cid} AND role = 'ai'
        ORDER BY created_at DESC
        LIMIT 1
      `);
      const latestAi = (latestAiRows.rows[0] as { text: string }).text;
      // Latest AI reply must STILL be UA-shape text — sticky verified.
      expect(UA_REPLY_PATTERN.test(latestAi)).toBe(true);
    }, 90_000);
  }
);
