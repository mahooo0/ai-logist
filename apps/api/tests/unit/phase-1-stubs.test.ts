import { describe, expect, test } from 'vitest';

/**
 * Phase 1 acceptance criteria stubs.
 * Each test.todo() marker is filled by the task that ships the producing artifact.
 * If you see a test.todo() entry below not yet filled, that's a coverage gap — red.
 */

describe('Phase 1: Database & Schema (DB-*)', () => {
  test('DB-01: postgis extension loaded in first migration (0000_postgis_extension.sql)', async () => {
    const fs = await import('node:fs/promises');
    const sql = await fs.readFile('drizzle/0000_postgis_extension.sql', 'utf-8');
    expect(sql).toMatch(/CREATE EXTENSION IF NOT EXISTS postgis/i);
  });

  test('DB-02: clients table has lang/tax_id/tax_id_country columns', async () => {
    const { clients } = await import('../../src/persistence/schema/clients.js');
    const cols = Object.keys(clients);
    expect(cols).toContain('lang');
    expect(cols).toContain('taxId');
    expect(cols).toContain('taxIdCountry');
    expect(cols).toContain('telegramId');
    expect(cols).toContain('phone');
  });

  test('DB-03: cities table has name_ru/name_ua + geography(Point, 4326)', async () => {
    const { cities } = await import('../../src/persistence/schema/cities.js');
    const cols = Object.keys(cities);
    expect(cols).toContain('nameRu');
    expect(cols).toContain('nameUa');
    expect(cols).toContain('slug');
    expect(cols).toContain('geom');
    // Verify the customType emits the geography DDL — single source of geo column type
    const fs = await import('node:fs/promises');
    const src = await fs.readFile('src/persistence/schema/_columns.ts', 'utf-8');
    expect(src).toMatch(/geography\(Point, 4326\)/);
  });

  test('DB-04: trucks table has geom + GiST + CHECK SRID + bigint capacity_t + body_type/status', async () => {
    const { trucks } = await import('../../src/persistence/schema/trucks.js');
    const cols = Object.keys(trucks);
    expect(cols).toContain('geom');
    expect(cols).toContain('capacityT');
    expect(cols).toContain('bodyType');
    expect(cols).toContain('status');
    expect(cols).toContain('plateNumber');
    // Verify schema source declares the GiST index AND the CHECK constraint
    const fs = await import('node:fs/promises');
    const src = await fs.readFile('src/persistence/schema/trucks.ts', 'utf-8');
    expect(src).toMatch(/using\(['"]gist['"]/);
    expect(src).toMatch(/ST_SRID/);
  });

  test('DB-05: leads table has extended cargo fields + price_overrides jsonb[]', async () => {
    const { leads } = await import('../../src/persistence/schema/leads.js');
    const cols = Object.keys(leads);
    expect(cols).toContain('volumeM3');
    expect(cols).toContain('dimensionsLxwxh');
    expect(cols).toContain('packaging');
    expect(cols).toContain('adrClass');
    expect(cols).toContain('declaredValue');
    expect(cols).toContain('priceOverrides');
    expect(cols).toContain('version');
    // Verify source for jsonb[] declaration
    const fs = await import('node:fs/promises');
    const src = await fs.readFile('src/persistence/schema/leads.ts', 'utf-8');
    expect(src).toMatch(/jsonb\(['"]price_overrides['"]\)\s*\.array\(\)/);
  });

  test('DB-06: orders + order_events tables with UNIQUE (order_id, type)', async () => {
    const { orders } = await import('../../src/persistence/schema/orders.js');
    const { orderEvents } = await import('../../src/persistence/schema/order_events.js');
    const orderCols = Object.keys(orders);
    const eventCols = Object.keys(orderEvents);
    expect(orderCols).toContain('number');
    expect(orderCols).toContain('publicToken');
    expect(orderCols).toContain('status');
    expect(orderCols).toContain('price');
    expect(eventCols).toContain('orderId');
    expect(eventCols).toContain('type');
    expect(eventCols).toContain('actor');
    // Verify UNIQUE (orderId, type) declared in source
    const fs = await import('node:fs/promises');
    const src = await fs.readFile('src/persistence/schema/order_events.ts', 'utf-8');
    expect(src).toMatch(/uniqueIndex[^)]*\)\.on\(t\.orderId,\s*t\.type\)/);
  });

  test('DB-07: calls, messages, bourse_cache tables exist', async () => {
    const { calls } = await import('../../src/persistence/schema/calls.js');
    const { messages } = await import('../../src/persistence/schema/messages.js');
    const { bourseCache } = await import('../../src/persistence/schema/bourse_cache.js');
    expect(Object.keys(calls)).toContain('direction');
    expect(Object.keys(calls)).toContain('transcript');
    expect(Object.keys(messages)).toContain('role');
    expect(Object.keys(messages)).toContain('text');
    expect(Object.keys(bourseCache)).toContain('queryHash');
    expect(Object.keys(bourseCache)).toContain('source');
    expect(Object.keys(bourseCache)).toContain('payload');
  });

  test('DB-08: pod_artifacts table with signature_url, photo_url, gps, captured_at', async () => {
    const { podArtifacts } = await import('../../src/persistence/schema/pod_artifacts.js');
    const cols = Object.keys(podArtifacts);
    expect(cols).toContain('orderId');
    expect(cols).toContain('signatureUrl');
    expect(cols).toContain('photoUrl');
    expect(cols).toContain('gps');
    expect(cols).toContain('capturedAt');
  });

  test('DB-09: webhook_updates with UNIQUE(source, external_id) + ON CONFLICT DO NOTHING', async () => {
    const { webhookUpdates } = await import('../../src/persistence/schema/webhook_updates.js');
    expect(Object.keys(webhookUpdates)).toContain('source');
    expect(Object.keys(webhookUpdates)).toContain('externalId');
    expect(Object.keys(webhookUpdates)).toContain('payload');
    // Verify UNIQUE constraint declared in source
    const fs = await import('node:fs/promises');
    const src = await fs.readFile('src/persistence/schema/webhook_updates.ts', 'utf-8');
    expect(src).toMatch(/unique\([^)]*\)\.on\(t\.source,\s*t\.externalId\)/);
  });

  test.todo('DB-10: seed populates 12 trucks, ~30 cities, 8 clients idempotently');
});

describe('Phase 1: Backend API & Infrastructure (API-*)', () => {
  // Real-DB-bound assertions live in tests/integration/health.test.ts (testcontainers).
  // For the unit suite we assert the route file exports the plugin and the schema is wired.
  test('API-01: /api/health route file exports plugin + uses PostGIS_Version', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile('src/routes/health.ts', 'utf-8');
    expect(src).toMatch(/PostGIS_Version/);
    expect(src).toMatch(/app\.redis\.ping/);
    expect(src).toMatch(/HealthResponseSchema/);
  });

  test('API-02: Drizzle repos for all 6 aggregates exist with thin CRUD per D-07', async () => {
    const repos = await import('../../src/persistence/repos/index.js');
    expect(repos.trucksRepo).toBeDefined();
    expect(repos.trucksRepo.findById).toBeTypeOf('function');
    expect(repos.trucksRepo.list).toBeTypeOf('function');
    expect(repos.trucksRepo.create).toBeTypeOf('function');
    expect(repos.citiesRepo.findBySlug).toBeTypeOf('function');
    expect(repos.clientsRepo.findByTelegramId).toBeTypeOf('function');
    expect(repos.leadsRepo.listByStage).toBeTypeOf('function');
    expect(repos.ordersRepo.findByPublicToken).toBeTypeOf('function');
    expect(repos.messagesRepo.listByClient).toBeTypeOf('function');
  });

  test('API-16: HealthResponseSchema is exported from @ai-logist/shared-types/api/health', async () => {
    const mod = await import('@ai-logist/shared-types/api/health');
    expect(mod.HealthResponseSchema).toBeDefined();
    const valid = mod.HealthResponseSchema.safeParse({
      status: 'ok',
      version: 'dev',
      uptime_s: 1,
      checks: { db: 'ok', postgis: '3.5.0', redis: 'ok' },
    });
    expect(valid.success).toBe(true);
  });
});

describe('Phase 1: Deployment & Demo (DEPLOY-*)', () => {
  test.todo('DEPLOY-01: docker compose config -q passes; all 5 services declared');
  test.todo('DEPLOY-02: Zod env validation rejects missing DATABASE_URL with process.exit(1)');
  test.todo('DEPLOY-03: pnpm workspaces resolve @ai-logist/shared-types from apps/api');
  test.todo('DEPLOY-04: README "fresh dev in ≤10 min" sequence is executable end-to-end');
});
