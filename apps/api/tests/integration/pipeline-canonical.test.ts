// Phase 2 Plan 02-04b Task 2 — canonical scenario E2E (ROADMAP success criterion #1).
//
// Drives the full pipeline through dialog-harness.runScript with two scripted
// messages:
//   1. 'Киев-Львов 18 тонн тент, нужно завтра' → expect leads.stage='QUOTED' with
//      leads.quoted_price written (price-lock proof at the row level).
//   2. 'да'                                    → expect leads.stage='ORDER_CREATED'
//      and orders.status='CREATED' with orders.price = leads.quoted_price.
//
// Price-lock audit-log proof (ROADMAP success criterion #1):
//   The QUOTED-stage lead_events row carries payload.quoted_price as a digit string.
//   The QUOTED event is inserted BEFORE the assistant reply row in `messages` (both
//   live inside the same db.transaction) — `created_at` ordering proves the write
//   happened first. We assert both.
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

describe.skipIf(!dockerAvailable)(
  "Pipeline canonical: 'Киев-Львов 18 тонн тент' + 'да' → ORDER_CREATED",
  () => {
    let db: NodePgDatabase<typeof schema>;
    let pool: import('pg').Pool;
    let clientId: string;
    let truckId: string;
    let kyivId: string;
    let lvivId: string;

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

      // Pricing config — calcPrice + readPricingConfig depend on these 3 rows.
      await migrationClient.query(`
        INSERT INTO pricing_config (key, value) VALUES
          ('rate_per_km',  '4200'::jsonb),
          ('dir_coef',     '{"default":1.0,"back_haul":0.85}'::jsonb),
          ('season_coef',  '1.0'::jsonb)
        ON CONFLICT (key) DO NOTHING
      `);

      // Two cities — Kyiv + Lviv. ILIKE on name_ru OR name_ua matches both
      // 'Киев'/'Львов' (RU) and 'Київ'/'Львів' (UA) variants.
      const kyivRow = await migrationClient.query(`
        INSERT INTO cities (slug, name_ru, name_ua, country_code, geom)
        VALUES ('kyiv', 'Киев', 'Київ', 'UA', ST_GeogFromText('SRID=4326;POINT(30.5234 50.4501)'))
        ON CONFLICT (slug) DO UPDATE SET name_ru = EXCLUDED.name_ru
        RETURNING id
      `);
      kyivId = kyivRow.rows[0].id;
      const lvivRow = await migrationClient.query(`
        INSERT INTO cities (slug, name_ru, name_ua, country_code, geom)
        VALUES ('lviv', 'Львов', 'Львів', 'UA', ST_GeogFromText('SRID=4326;POINT(24.0297 49.8397)'))
        ON CONFLICT (slug) DO UPDATE SET name_ru = EXCLUDED.name_ru
        RETURNING id
      `);
      lvivId = lvivRow.rows[0].id;

      // One available truck within KNN range, capacity ≥ 18t, tent body type.
      const truckRow = await migrationClient.query(`
        INSERT INTO trucks (name, plate_number, driver_name, driver_phone,
                            capacity_t, body_type, geom, status)
        VALUES ('KU-Canon-01', 'AA0001CN', 'Иван Тестов', '+79990001111',
                20, 'tent',
                ST_GeogFromText('SRID=4326;POINT(30.5400 50.4500)'),
                'available')
        RETURNING id
      `);
      truckId = truckRow.rows[0].id;

      // Client. lang='ru' so Step B is skipped (sticky).
      const clientRow = await migrationClient.query(
        `INSERT INTO clients (name, phone, lang) VALUES ('canonical-test', '+70000099101', 'ru') RETURNING id`
      );
      clientId = clientRow.rows[0].id;
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

    it("'Киев-Львов 18 тонн тент' → QUOTED with quoted_price written BEFORE reply", async () => {
      const llm = new MockAnthropicClient();

      // Message 1 — full extraction triggers Steps D..I.
      const result1 = await runScript(db, llm, clientId, [
        { from: 'client', text: 'Киев-Львов 18 тонн тент, нужно завтра' },
      ]);

      expect(result1.finalLead.stage).toBe('QUOTED');
      expect(result1.finalLead.quotedPrice).toBeTruthy();

      // Cities populated.
      const leadCities = await db.execute(sql`
        SELECT from_city_id, to_city_id, matched_truck_id FROM leads
        WHERE id = ${result1.finalLead.id}
      `);
      const leadCityRow = leadCities.rows[0] as {
        from_city_id: string;
        to_city_id: string;
        matched_truck_id: string | null;
      };
      expect(leadCityRow.from_city_id).toBe(kyivId);
      expect(leadCityRow.to_city_id).toBe(lvivId);
      expect(leadCityRow.matched_truck_id).toBe(truckId);

      // Audit-log price-lock proof: QUOTED event carries payload.quoted_price.
      const events = await db.execute(sql`
        SELECT to_stage, payload, created_at
        FROM lead_events
        WHERE lead_id = ${result1.finalLead.id}
        ORDER BY created_at ASC
      `);
      const eventRows = events.rows as Array<{
        to_stage: string;
        payload: { quoted_price?: string; min?: string; max?: string; route_km?: number };
        created_at: string;
      }>;
      const quotedEvent = eventRows.find((e) => e.to_stage === 'QUOTED');
      expect(quotedEvent).toBeDefined();
      expect(quotedEvent?.payload.quoted_price).toMatch(/^\d+$/);
      expect(quotedEvent?.payload.min).toMatch(/^\d+$/);
      expect(quotedEvent?.payload.max).toMatch(/^\d+$/);

      // Critical ordering proof (ROADMAP success criterion #1):
      //   QUOTED event MUST be created at or BEFORE the assistant reply that quotes
      //   the price. The leadsRepo.update({quotedPrice}) call inside intake.ts runs
      //   immediately before transitionLead(→QUOTED), and the assistant text
      //   message is the last write in Step I. ts millis are coarse, so we accept ≤.
      const aiMsgs = await db.execute(sql`
        SELECT created_at FROM messages
        WHERE lead_id = ${result1.finalLead.id} AND role = 'ai'
        ORDER BY created_at ASC
      `);
      const lastAiCreatedAt = (aiMsgs.rows as Array<{ created_at: string }>).at(-1)?.created_at;
      expect(lastAiCreatedAt).toBeTruthy();
      const quotedEventMs = new Date(quotedEvent?.created_at ?? 0).getTime();
      const lastAiMs = new Date(lastAiCreatedAt ?? 0).getTime();
      expect(quotedEventMs).toBeLessThanOrEqual(lastAiMs);

      // The last assistant message must be a templated price reply containing the
      // quoted_price value (or its formatted form). Sanity: at minimum the reply
      // must NOT be the city-not-found / clarify / placeholder text.
      const lastAiRows = await db.execute(sql`
        SELECT text FROM messages
        WHERE lead_id = ${result1.finalLead.id} AND role = 'ai'
        ORDER BY created_at DESC
        LIMIT 1
      `);
      const lastAiText = (lastAiRows.rows[0] as { text: string }).text;
      expect(lastAiText).toMatch(/Цена за рейс/);
      expect(lastAiText).toMatch(/Подтверждаете/);
    }, 90_000);

    it("'да' on QUOTED lead → ORDER_CREATED, orders.price === leads.quoted_price", async () => {
      // Find the lead from the previous assertion (or any open QUOTED lead).
      const openLead = await db.execute(sql`
        SELECT id, quoted_price FROM leads
        WHERE client_id = ${clientId} AND stage = 'QUOTED'
        ORDER BY updated_at DESC
        LIMIT 1
      `);
      const lead = openLead.rows[0] as { id: string; quoted_price: string } | undefined;
      expect(lead).toBeDefined();
      const lockedPrice = lead?.quoted_price;
      expect(lockedPrice).toMatch(/^\d+$/);

      const llm = new MockAnthropicClient();
      const result2 = await runScript(db, llm, clientId, [{ from: 'client', text: 'да' }]);

      expect(result2.finalLead.stage).toBe('ORDER_CREATED');
      expect(result2.finalOrder?.status).toBe('CREATED');
      expect(result2.finalOrder?.price).toBeTruthy();

      // Pitfall #1 closure: orders.price MUST equal leads.quoted_price (snapshot
      // before the confirm) — proves price flowed via DB, not LLM in-memory state.
      const orderRow = await db.execute(sql`
        SELECT price::text AS price, number, public_token, status FROM orders
        WHERE lead_id = ${result2.finalLead.id}
      `);
      const order = orderRow.rows[0] as {
        price: string;
        number: string;
        public_token: string;
        status: string;
      };
      expect(order.price).toBe(lockedPrice);
      expect(order.number).toMatch(/^#KU-[A-Z0-9]{8}$/);
      expect(order.public_token).toMatch(/^[A-Za-z0-9_-]{12}$/);
      expect(order.status).toBe('CREATED');

      // Full FSM chain logged.
      const chain = await db.execute(sql`
        SELECT to_stage FROM lead_events
        WHERE lead_id = ${result2.finalLead.id}
        ORDER BY created_at ASC
      `);
      const stages = (chain.rows as Array<{ to_stage: string }>).map((r) => r.to_stage);
      expect(stages).toContain('QUALIFIED');
      expect(stages).toContain('MATCHED');
      expect(stages).toContain('QUOTED');
      expect(stages).toContain('AGREED');
      expect(stages).toContain('ORDER_CREATED');
    }, 90_000);
  }
);
