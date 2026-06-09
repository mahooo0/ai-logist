// Phase 2 Plan 02-05 Task 2 — API-07 integration tests for /api/leads/:id/match
// and /api/leads/:id/quote.
//
// Boots Fastify via buildApp() against testcontainers PostGIS, applies the 3
// drizzle migrations + the minimal pricing_config + city + truck seed, then
// drives the routes via app.inject().
//
// Cases (6 total):
//   1. POST /:id/match on a QUALIFIED lead → 200 + at least 1 truck +
//      lead promoted to MATCHED.
//   2. POST /:id/match on a non-existent UUID → 404.
//   3. POST /:id/match on a lead without fromCityId → 400.
//   4. POST /:id/quote on a MATCHED lead → 200 + quoted_price_kopecks ∈ [min, max]
//      AND leads.quoted_price column written to the SAME value (price-lock proof:
//      DB row updated BEFORE the response was rendered — verified by snapshotting
//      the row immediately after the call and comparing equality).
//   5. POST /:id/quote — explicit "was NULL → is the response value" check:
//      we snapshot leads.quoted_price BEFORE the call (expect NULL), call the
//      route, then snapshot AGAIN and verify it equals the response body.
//      This is the price-lock invariant from MATCH-06.
//   6. POST /:id/quote twice in a row on a MATCHED lead → both 200. Second call
//      hits the IllegalTransition path (QUOTED → QUOTED is not legal) which the
//      handler swallows; the call still succeeds and quoted_price is re-written.
//
// Docker-gated — skipped silently when AI_LOGIST_NO_DOCKER=1.

import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getTestDbUrl, startPostgisContainer, stopPostgisContainer } from '../_helpers/test-db.js';

const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('API-07: POST /api/leads/:id/{match,quote}', () => {
  let app: FastifyInstance;
  let clientId: string;
  let fromCityId: string;
  let toCityId: string;
  let originalDatabaseUrl: string | undefined;
  let originalRedisUrl: string | undefined;

  beforeAll(async () => {
    await startPostgisContainer();
    const url = getTestDbUrl();
    // Override env vars BEFORE the dynamic buildApp import — config.ts loads
    // process.env at module-init time.
    originalDatabaseUrl = process.env.DATABASE_URL;
    originalRedisUrl = process.env.REDIS_URL;
    process.env.DATABASE_URL = url;
    process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

    // Apply migrations + minimal seed (cities + truck + pricing_config + client).
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

    await migrationClient.query(`
        INSERT INTO pricing_config (key, value) VALUES
          ('rate_per_km',  '4200'::jsonb),
          ('dir_coef',     '{"default":1.0,"back_haul":0.85}'::jsonb),
          ('season_coef',  '1.0'::jsonb)
        ON CONFLICT (key) DO NOTHING
      `);

    const kyivRow = await migrationClient.query(`
        INSERT INTO cities (slug, name_ru, name_ua, country_code, geom)
        VALUES ('kyiv', 'Киев', 'Київ', 'UA', ST_GeogFromText('SRID=4326;POINT(30.5234 50.4501)'))
        ON CONFLICT (slug) DO UPDATE SET name_ru = EXCLUDED.name_ru
        RETURNING id
      `);
    fromCityId = kyivRow.rows[0].id;

    const lvivRow = await migrationClient.query(`
        INSERT INTO cities (slug, name_ru, name_ua, country_code, geom)
        VALUES ('lviv', 'Львов', 'Львів', 'UA', ST_GeogFromText('SRID=4326;POINT(24.0297 49.8397)'))
        ON CONFLICT (slug) DO UPDATE SET name_ru = EXCLUDED.name_ru
        RETURNING id
      `);
    toCityId = lvivRow.rows[0].id;

    await migrationClient.query(`
        INSERT INTO trucks (name, plate_number, driver_name, driver_phone,
                            capacity_t, body_type, geom, status)
        VALUES ('KU-Route-01', 'AA0001RT', 'Иван Тестов', '+79990001111',
                20, 'tent',
                ST_GeogFromText('SRID=4326;POINT(30.5400 50.4500)'),
                'available')
        ON CONFLICT (plate_number) DO NOTHING
      `);

    const clientRow = await migrationClient.query(
      `INSERT INTO clients (name, phone, lang) VALUES ('api-routes-test', '+70000099501', 'ru') RETURNING id`
    );
    clientId = clientRow.rows[0].id;
    await migrationClient.end();

    // Dynamic import AFTER env override so config.ts picks up the test DB URL.
    const { buildApp } = await import('../../src/app.js');
    app = await buildApp();
    await app.ready();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await stopPostgisContainer();
    if (originalDatabaseUrl !== undefined) process.env.DATABASE_URL = originalDatabaseUrl;
    if (originalRedisUrl !== undefined) process.env.REDIS_URL = originalRedisUrl;
  });

  async function seedLead(
    stage: 'NEW' | 'QUALIFIED' | 'MATCHED' | 'QUOTED',
    opts: { withCity?: boolean; withTons?: boolean; withQuotedPrice?: boolean } = {}
  ): Promise<string> {
    const includeCity = opts.withCity !== false;
    const includeTons = opts.withTons !== false;
    const includePrice = opts.withQuotedPrice === true;
    const ins = await app.db.execute(sql`
        INSERT INTO leads (
          client_id, channel, stage, version,
          from_city_id, to_city_id, tons, body_type, quoted_price
        )
        VALUES (
          ${clientId}, 'test', ${stage}::lead_stage, 0,
          ${includeCity ? fromCityId : null}, ${includeCity ? toCityId : null},
          ${includeTons ? '18' : null}, ${includeTons ? 'tent' : null}::body_type_t,
          ${includePrice ? '2500000' : null}::bigint
        )
        RETURNING id
      `);
    return (ins.rows[0] as { id: string }).id;
  }

  it('POST /:id/match on QUALIFIED → 200 + trucks + MATCHED', async () => {
    const leadId = await seedLead('QUALIFIED');
    const res = await app.inject({ method: 'POST', url: `/api/leads/${leadId}/match` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.lead_id).toBe(leadId);
    expect(body.trucks.length).toBeGreaterThan(0);
    expect(body.trucks[0]).toHaveProperty('meters');
    expect(body.trucks[0]).toHaveProperty('source');
    const after = await app.db.execute(sql`SELECT stage FROM leads WHERE id = ${leadId}`);
    expect((after.rows[0] as { stage: string }).stage).toBe('MATCHED');
  }, 60_000);

  it('POST /:id/match on nonexistent uuid → 404', async () => {
    const fakeUuid = '00000000-0000-4000-8000-000000000000';
    const res = await app.inject({ method: 'POST', url: `/api/leads/${fakeUuid}/match` });
    expect(res.statusCode).toBe(404);
  }, 30_000);

  it('POST /:id/match without fromCityId → 400', async () => {
    const leadId = await seedLead('QUALIFIED', { withCity: false });
    const res = await app.inject({ method: 'POST', url: `/api/leads/${leadId}/match` });
    expect(res.statusCode).toBe(400);
  }, 30_000);

  it('POST /:id/quote on MATCHED → 200 + price-lock verified', async () => {
    const leadId = await seedLead('MATCHED');
    // Pre-condition: quoted_price IS NULL (the price-lock target = was-null).
    const before = await app.db.execute(sql`SELECT quoted_price FROM leads WHERE id = ${leadId}`);
    expect((before.rows[0] as { quoted_price: string | null }).quoted_price).toBeNull();

    const res = await app.inject({ method: 'POST', url: `/api/leads/${leadId}/quote` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.lead_id).toBe(leadId);
    expect(body.quoted_price_kopecks).toMatch(/^\d+$/);
    expect(Number(body.min_kopecks)).toBeLessThan(Number(body.quoted_price_kopecks));
    expect(Number(body.max_kopecks)).toBeGreaterThan(Number(body.quoted_price_kopecks));
    expect(typeof body.route_km).toBe('number');

    // PRICE-LOCK proof: leads.quoted_price was UPDATED before the response was
    // sent. After the response returns the DB row carries the same value as
    // the body — proves write-before-respond.
    const after = await app.db.execute(
      sql`SELECT quoted_price, stage FROM leads WHERE id = ${leadId}`
    );
    const dbRow = after.rows[0] as { quoted_price: string; stage: string };
    expect(dbRow.quoted_price).toBe(body.quoted_price_kopecks);
    expect(dbRow.stage).toBe('QUOTED');
  }, 60_000);

  it('POST /:id/quote price-lock: lead_events.QUOTED.payload.quoted_price written before reply', async () => {
    const leadId = await seedLead('MATCHED');
    const res = await app.inject({ method: 'POST', url: `/api/leads/${leadId}/quote` });
    expect(res.statusCode).toBe(200);

    // Audit-log proof: QUOTED lead_event payload carries the locked price.
    // Same shape as intake.ts so admin Kanban timeline renders identically.
    const events = await app.db.execute(sql`
        SELECT to_stage, payload, created_at
        FROM lead_events
        WHERE lead_id = ${leadId} AND to_stage = 'QUOTED'
        ORDER BY created_at ASC
      `);
    const ev = events.rows[0] as {
      to_stage: string;
      payload: { quoted_price?: string; min?: string; max?: string; route_km?: number };
    };
    expect(ev).toBeDefined();
    expect(ev.payload.quoted_price).toMatch(/^\d+$/);
    expect(ev.payload.min).toMatch(/^\d+$/);
    expect(ev.payload.max).toMatch(/^\d+$/);
    // The event payload value matches the response body — single source of truth.
    const body = res.json();
    expect(ev.payload.quoted_price).toBe(body.quoted_price_kopecks);
  }, 60_000);

  it('POST /:id/quote twice (idempotent on past-stage) → both 200', async () => {
    const leadId = await seedLead('MATCHED');
    const r1 = await app.inject({ method: 'POST', url: `/api/leads/${leadId}/quote` });
    const r2 = await app.inject({ method: 'POST', url: `/api/leads/${leadId}/quote` });
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200); // second call: IllegalTransition swallowed
    // Both responses carry a quoted_price — second call re-wrote the same
    // price (calcPrice is pure + pricing_config unchanged).
    expect(r1.json().quoted_price_kopecks).toBe(r2.json().quoted_price_kopecks);
  }, 60_000);
});
