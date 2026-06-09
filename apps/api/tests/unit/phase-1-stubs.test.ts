import { describe, expect, test } from 'vitest';

/**
 * Phase 1 acceptance criteria assertions.
 * Each test below maps to a requirement ID (DB-*, API-*, DEPLOY-*) and is filled in by the
 * task that ships the producing artifact. Zero todos remain at Phase 1 close — see SUMMARY.
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

  test('DB-10: seed fixtures shape — 12 trucks, ~30 cities, 8 clients, rate_per_km=4200', async () => {
    const cities = (await import('../../src/seed/data/cities.json', { with: { type: 'json' } }))
      .default as Array<{ slug: string; country_code: string }>;
    const trucks = (await import('../../src/seed/data/trucks.json', { with: { type: 'json' } }))
      .default as Array<{ body_type: string }>;
    const clients = (await import('../../src/seed/data/clients.json', { with: { type: 'json' } }))
      .default as Array<{ lang: string }>;
    const pricing = (await import('../../src/seed/data/pricing.json', { with: { type: 'json' } }))
      .default as { rate_per_km: number };

    expect(cities.length).toBeGreaterThanOrEqual(25);
    expect(cities.filter((c) => c.country_code === 'border').length).toBeGreaterThanOrEqual(5);
    expect(cities.some((c) => c.slug === 'kyiv')).toBe(true);
    expect(trucks).toHaveLength(12);
    expect(trucks.filter((t) => t.body_type === 'tent')).toHaveLength(5);
    expect(trucks.filter((t) => t.body_type === 'ref')).toHaveLength(3);
    expect(trucks.filter((t) => t.body_type === 'iso')).toHaveLength(2);
    expect(trucks.filter((t) => t.body_type === 'container')).toHaveLength(2);
    expect(clients).toHaveLength(8);
    expect(clients.filter((c) => c.lang === 'ru')).toHaveLength(4);
    expect(clients.filter((c) => c.lang === 'ua')).toHaveLength(4);
    expect(pricing.rate_per_km).toBe(4200);

    // Verify seed/run.ts uses onConflictDoNothing for idempotency (D-20)
    const fs = await import('node:fs/promises');
    const runSrc = await fs.readFile('src/seed/run.ts', 'utf-8');
    expect(runSrc.match(/onConflictDoNothing/g)?.length ?? 0).toBeGreaterThanOrEqual(3);

    // Verify smoke.ts uses canonical KNN pattern (D-21 + PITFALLS #2)
    const smokeSrc = await fs.readFile('src/seed/smoke.ts', 'utf-8');
    expect(smokeSrc).toMatch(/ORDER BY t\.geom <->/);
    expect(smokeSrc).toMatch(/ST_Distance.*true/);
  });
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

  test('API-16: All Plan 01-08 DTO schemas exported from @ai-logist/shared-types', async () => {
    const leads = await import('@ai-logist/shared-types/api/leads');
    const orders = await import('@ai-logist/shared-types/api/orders');
    const trucks = await import('@ai-logist/shared-types/api/trucks');
    const clients = await import('@ai-logist/shared-types/api/clients');
    const analytics = await import('@ai-logist/shared-types/api/analytics');
    const webhooks = await import('@ai-logist/shared-types/api/webhooks');
    const enums = await import('@ai-logist/shared-types/domain/enums');

    expect(leads.LeadSchema).toBeDefined();
    expect(leads.LeadListQuerySchema).toBeDefined();
    expect(leads.LeadPatchBodySchema).toBeDefined();
    expect(orders.OrderSchema).toBeDefined();
    expect(orders.OrderDetailSchema).toBeDefined();
    expect(orders.PriceOverrideBodySchema).toBeDefined();
    expect(trucks.TruckSchema).toBeDefined();
    expect(trucks.CreateTruckBodySchema).toBeDefined();
    expect(clients.MessageSchema).toBeDefined();
    expect(analytics.KpiResponseSchema).toBeDefined();
    expect(webhooks.TelegramUpdateBodySchema).toBeDefined();
    expect(webhooks.GpsPushBodySchema).toBeDefined();
    expect(enums.LeadStage).toBeDefined();
    expect(enums.OrderStatus).toBeDefined();
    expect(enums.BodyType).toBeDefined();
  });

  test('API-16: PriceOverrideBodySchema rejects body missing reason (ADMIN-NEW-06)', async () => {
    const { PriceOverrideBodySchema } = await import('@ai-logist/shared-types/api/orders');
    const invalid = PriceOverrideBodySchema.safeParse({ newPrice: '100000', version: 1 });
    expect(invalid.success).toBe(false);
    const valid = PriceOverrideBodySchema.safeParse({
      newPrice: '100000',
      reason: 'driver requested fuel cost coverage',
      version: 1,
    });
    expect(valid.success).toBe(true);
  });

  test('API-16: 6 stub route files exist + register in app.ts', async () => {
    const fs = await import('node:fs/promises');
    for (const f of ['leads', 'orders', 'trucks', 'clients', 'analytics', 'webhooks']) {
      const src = await fs.readFile(`src/routes/${f}.ts`, 'utf-8');
      expect(src).toMatch(/reply\.notImplemented/);
      expect(src).toMatch(/@ai-logist\/shared-types\/api\//);
    }
    const appSrc = await fs.readFile('src/app.ts', 'utf-8');
    // Match all 7 register lines: health + 5 api stubs + webhooks
    const matches = appSrc.match(/app\.register\([a-zA-Z]+Routes/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(7);
  });
});

describe('Phase 1: Deployment & Demo (DEPLOY-*)', () => {
  test('DEPLOY-01: docker-compose.yml declares all 5 services with pinned image tags', async () => {
    const fs = await import('node:fs/promises');
    const compose = await fs.readFile('../../docker-compose.yml', 'utf-8');
    expect(compose).toMatch(/postgis\/postgis:17-3\.5/);
    expect(compose).toMatch(/redis:7-alpine/);
    expect(compose).toMatch(/caddy:2-alpine/);
    // 5 services declared
    const serviceLines = compose.split('\n').filter((l) => /^ {2}[a-z]+:$/.test(l));
    expect(serviceLines.length).toBeGreaterThanOrEqual(5);
  });

  test('DEPLOY-02: .env.example contains DATABASE_URL + REDIS_URL + LOG_LEVEL; Zod env validates', async () => {
    const fs = await import('node:fs/promises');
    const env = await fs.readFile('../../.env.example', 'utf-8');
    expect(env).toMatch(/DATABASE_URL=postgresql:\/\//);
    expect(env).toMatch(/REDIS_URL=redis:\/\//);
    expect(env).toMatch(/LOG_LEVEL=/);

    const cfgSrc = await fs.readFile('src/config.ts', 'utf-8');
    expect(cfgSrc).toMatch(/ConfigSchema/);
    expect(cfgSrc).toMatch(/process\.exit\(1\)/);
  });

  test('DEPLOY-03: pnpm workspaces resolves @ai-logist/shared-types from apps/api', async () => {
    const fs = await import('node:fs/promises');
    const wks = await fs.readFile('../../pnpm-workspace.yaml', 'utf-8');
    expect(wks).toMatch(/apps\/\*/);
    expect(wks).toMatch(/packages\/\*/);

    const pkg = JSON.parse(await fs.readFile('package.json', 'utf-8')) as {
      dependencies?: Record<string, string>;
    };
    expect(pkg.dependencies?.['@ai-logist/shared-types']).toMatch(/workspace:\*/);
  });

  test('DEPLOY-04: README documents the 10-minute setup steps', async () => {
    const fs = await import('node:fs/promises');
    const readme = await fs.readFile('../../README.md', 'utf-8');
    expect(readme).toMatch(/10[\s-]*min/i);
    expect(readme).toMatch(/docker compose up -d postgres redis/);
    expect(readme).toMatch(/pnpm install/);
    expect(readme).toMatch(/pnpm db:migrate/);
    expect(readme).toMatch(/pnpm seed/);
    expect(readme).toMatch(/pnpm dev/);
    expect(readme).toMatch(/curl http:\/\/localhost:3000\/api\/health/);
  });
});
