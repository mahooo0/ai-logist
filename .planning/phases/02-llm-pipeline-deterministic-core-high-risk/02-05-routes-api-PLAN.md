---
phase: 02-llm-pipeline-deterministic-core-high-risk
plan: 05
type: execute
wave: 6
depends_on:
  - "02-04b"
files_modified:
  - apps/api/src/routes/leads.ts
  - apps/api/src/routes/health.ts
  - apps/api/tests/integration/api-leads-routes.test.ts
  - apps/api/tests/unit/phase-2-stubs.test.ts
  - packages/shared-types/src/api/leads.ts
autonomous: true
requirements:
  - API-07

must_haves:
  truths:
    - "POST /api/leads/:id/match runs the same nearestTruck logic as the pipeline; returns 200 with truck candidates (no more reply.notImplemented)."
    - "POST /api/leads/:id/quote runs the same calcPrice + price-lock as the pipeline; returns 200 with quoted_price + corridor (no more reply.notImplemented)."
    - "Both routes invoke transitionLead through the FSM; illegal source stage returns 409 IllegalTransition."
    - "Route schemas remain the LeadMatchResponseSchema + LeadQuoteResponseSchema from Phase 1 packages/shared-types — only handler bodies change."
    - "/api/health subcheck returns llm:'ok' when ANTHROPIC_API_KEY set, llm:'not_configured' otherwise."
    - "Final phase-2-stubs.test.ts has 0 todos remaining and ≥18 passing assertions."
  artifacts:
    - path: "apps/api/src/routes/leads.ts"
      provides: "Real handlers for POST /api/leads/:id/match and /quote"
      contains: "transitionLead"
  key_links:
    - from: "src/routes/leads.ts"
      to: "src/pipeline/llm-tools/nearest-truck.ts"
      via: "Import nearestTruck function"
      pattern: "nearestTruck|llm-tools/nearest-truck"
    - from: "src/routes/leads.ts"
      to: "src/pipeline/llm-tools/calc-price.ts"
      via: "Import calcPrice + readPricingConfig"
      pattern: "calcPrice|readPricingConfig"
    - from: "src/routes/leads.ts"
      to: "src/pipeline/lifecycle/lead-fsm.ts"
      via: "transitionLead for stage transitions"
      pattern: "transitionLead"
---

<objective>
Wave 5 — replace Phase 1 501-stubs in `apps/api/src/routes/leads.ts` with real handlers for POST /:id/match + POST /:id/quote (API-07).

Purpose:
- These endpoints are the admin/integration-test surface for re-running the matching and pricing logic on an existing lead (Phase 4 admin UI calls them from Kanban "re-match" / "re-quote" buttons).
- They MUST use the SAME functions as the pipeline (nearestTruck, calcPrice, transitionLead) — single source of truth for matching/pricing.
- Update /api/health to report llm subcheck.
- Flip final API-07 todo. Verify all 18 Phase 2 requirements have green assertions.

Output: 2 real route handlers; final integration API E2E test that calls these endpoints via `app.inject()`; `phase-2-stubs.test.ts` has 0 todos and ≥18 passing assertions; Phase 2 complete.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-CONTEXT.md
@.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-RESEARCH.md
@.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-VALIDATION.md
@.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-02-SUMMARY.md
@.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-03-SUMMARY.md
@.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-04a-SUMMARY.md
@.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-04b-SUMMARY.md
@apps/api/src/routes/leads.ts
@apps/api/src/routes/health.ts
@apps/api/src/app.ts
@apps/api/src/pipeline/llm-tools/nearest-truck.ts
@apps/api/src/pipeline/llm-tools/calc-price.ts
@apps/api/src/pipeline/lifecycle/lead-fsm.ts
@apps/api/src/persistence/repos/leads.ts
@apps/api/src/persistence/repos/cities.ts
@apps/api/src/persistence/schema/leads.ts
@packages/shared-types/src/api/leads.ts

<interfaces>
<!-- Phase 1 shared-types response schemas (DO NOT CHANGE — only handler bodies update). -->

LeadMatchResponseSchema (from packages/shared-types/src/api/leads.ts):
```typescript
export const LeadMatchResponseSchema = z.object({
  lead_id: z.string().uuid(),
  trucks: z.array(z.object({
    id: z.string(),
    driver_phone: z.string(),
    plate_number: z.string(),
    capacity_t: z.string(),
    body_type: z.enum(['tent','ref','iso','container']),
    meters: z.string(),
    source: z.enum(['own-fleet','bourse-stub']),
  })),
});
```
(If Phase 1 schema differs — READ FIRST and adapt the handler to match. The schema is the contract; do not modify it without updating Swagger docs.)

LeadQuoteResponseSchema:
```typescript
export const LeadQuoteResponseSchema = z.object({
  lead_id: z.string().uuid(),
  quoted_price_kopecks: z.string(),  // bigint serialized
  min_kopecks: z.string(),
  max_kopecks: z.string(),
  route_km: z.number(),
  stage: z.string(),
});
```

Wave 2a/2b imports for the handlers:
```typescript
import { nearestTruck } from '../pipeline/llm-tools/nearest-truck.js';
import { calcPrice, readPricingConfig } from '../pipeline/llm-tools/calc-price.js';
import { transitionLead } from '../pipeline/lifecycle/lead-fsm.js';
import { IllegalTransition, VersionMismatch } from '../pipeline/lifecycle/errors.js';
import { routeKm } from '../lib/routing.js';
```

Phase 1 sensible reply helpers (already installed):
- reply.badRequest(message), reply.notFound(), reply.conflict(), reply.internalServerError().
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Un-stub POST /api/leads/:id/match + /quote handlers + extend health subcheck</name>
  <files>apps/api/src/routes/leads.ts, apps/api/src/routes/health.ts, packages/shared-types/src/api/leads.ts</files>
  <behavior>
    - POST /api/leads/:id/match:
      1. Load lead via leadsRepo.findById(app.db, params.id). 404 if not found.
      2. Read from_city + to_city from cities table to get pickup lon/lat.
      3. If lead.fromCityId is null → 400 "lead has no pickup city".
      4. Call nearestTruck(app.db, {pickupLon, pickupLat, tons: Number(lead.tons), bodyType: lead.bodyType}).
      5. If trucks.length > 0 and lead.stage is QUALIFIED → transitionLead(app.db, {leadId, to:'MATCHED', actor:'manager', payload:{re_match:true, count:trucks.length}}).
      6. Catch IllegalTransition → reply.conflict (lead is past MATCHED, that's fine — return trucks anyway, do NOT bump version).
      7. Return 200 { lead_id, trucks }.
    - POST /api/leads/:id/quote:
      1. Load lead. 404 if not found.
      2. If lead.fromCityId or toCityId is null OR lead.tons is null → 400.
      3. Read both cities, compute routeKm.
      4. cfg = readPricingConfig(app.db); priceOut = calcPrice(...).
      5. PRICE-LOCK: leadsRepo.update(app.db, leadId, {quotedPrice: priceOut.default}).
      6. transitionLead(app.db, {leadId, to:'QUOTED', actor:'manager', payload:{quoted_price: priceOut.default.toString(), re_quote:true}}). Catch IllegalTransition → conflict.
      7. Return 200 { lead_id, quoted_price_kopecks: priceOut.default.toString(), min_kopecks: priceOut.min.toString(), max_kopecks: priceOut.max.toString(), route_km, stage: 'QUOTED' }.
    - /api/health: extend the response.checks object with `llm: 'ok' | 'not_configured'` based on whether config.ANTHROPIC_API_KEY is set (no actual ping in Phase 2 — that's Phase 6 POLISH-06 territory).
  </behavior>
  <read_first>
    - apps/api/src/routes/leads.ts (current 501 stub structure — DO NOT change route registration shape)
    - packages/shared-types/src/api/leads.ts (existing schemas — confirm shape, update only if needed)
    - apps/api/src/routes/health.ts (Phase 1 health response shape — add subcheck without breaking)
    - apps/api/src/pipeline/llm-tools/nearest-truck.ts (Wave 2a — function signature)
    - apps/api/src/pipeline/llm-tools/calc-price.ts (Wave 2a — calcPrice + readPricingConfig)
    - apps/api/src/pipeline/lifecycle/lead-fsm.ts (Wave 2b — transitionLead)
    - apps/api/src/persistence/repos/leads.ts (findById + update)
    - apps/api/src/persistence/repos/cities.ts (no findById exported — may need a quick `findById` helper or use raw sql)
  </read_first>
  <action>
    **(a) Verify/update packages/shared-types/src/api/leads.ts** — read the file; if `LeadMatchResponseSchema` already matches the shape in `<interfaces>` above, leave it alone. If different (e.g. uses different field names), update either the schema or the handler to align — but PRESERVE Phase 1's Swagger contract (don't break existing routes). If updating: bump packages/shared-types build via the existing tsconfig.

    **(b) apps/api/src/routes/leads.ts** — replace the two 501-stub handler bodies:
    ```ts
    import {
      LeadListQuerySchema,
      LeadMatchResponseSchema,
      LeadPatchBodySchema,
      LeadQuoteResponseSchema,
    } from '@ai-logist/shared-types/api/leads';
    import { sql } from 'drizzle-orm';
    import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
    import { z } from 'zod/v4';
    import { leadsRepo } from '../persistence/repos/index.js';
    import { nearestTruck } from '../pipeline/llm-tools/nearest-truck.js';
    import { calcPrice, readPricingConfig } from '../pipeline/llm-tools/calc-price.js';
    import { transitionLead } from '../pipeline/lifecycle/lead-fsm.js';
    import { IllegalTransition, VersionMismatch } from '../pipeline/lifecycle/errors.js';
    import { routeKm } from '../lib/routing.js';

    const NotImpl = z.object({ statusCode: z.number(), error: z.string(), message: z.string() });

    const leadsRoutes: FastifyPluginAsyncZod = async (app) => {
      // GET /leads + PATCH /leads/:id — still 501 (Phase 4)
      app.get('/leads', { schema: { tags: ['leads'], querystring: LeadListQuerySchema, response: { 501: NotImpl }}}, async (_req, reply) => reply.notImplemented('Phase 4 — admin web'));
      app.patch('/leads/:id', { schema: { tags: ['leads'], params: z.object({ id: z.string().uuid() }), body: LeadPatchBodySchema, response: { 501: NotImpl }}}, async (_req, reply) => reply.notImplemented('Phase 4 — admin web'));

      // POST /leads/:id/match — Phase 2 API-07
      app.post('/leads/:id/match', {
        schema: {
          tags: ['leads'], summary: 'Re-run truck matching',
          params: z.object({ id: z.string().uuid() }),
          response: { 200: LeadMatchResponseSchema, 400: NotImpl, 404: NotImpl, 409: NotImpl },
        },
      }, async (req, reply) => {
        const lead = await leadsRepo.findById(app.db, req.params.id);
        if (!lead) return reply.notFound(`lead ${req.params.id} not found`);
        if (!lead.fromCityId) return reply.badRequest('lead has no pickup city');

        const cityRow = await app.db.execute(sql`SELECT ST_X(geom::geometry) AS lon, ST_Y(geom::geometry) AS lat FROM cities WHERE id = ${lead.fromCityId}`);
        const city = cityRow.rows[0] as { lon: number; lat: number } | undefined;
        if (!city) return reply.badRequest('pickup city geom missing');

        const tons = Number(lead.tons ?? 0);
        if (!Number.isFinite(tons) || tons <= 0) return reply.badRequest('lead has no tonnage');

        const trucks = await nearestTruck(app.db, { pickupLon: city.lon, pickupLat: city.lat, tons, bodyType: lead.bodyType });

        if (trucks.length > 0 && lead.stage === 'QUALIFIED') {
          try {
            await transitionLead(app.db, { leadId: lead.id, to: 'MATCHED', actor: 'manager', payload: { re_match: true, count: trucks.length } });
          } catch (err) {
            if (err instanceof IllegalTransition || err instanceof VersionMismatch) {
              app.log.warn({ err, leadId: lead.id }, 'match: transition skipped');
              // Do not 409 here — re-match is idempotent; return trucks anyway.
            } else { throw err; }
          }
        }

        return reply.code(200).send({
          lead_id: lead.id,
          trucks: trucks.map((t) => ({
            id: t.id, driver_phone: t.driver_phone, plate_number: t.plate_number,
            capacity_t: t.capacity_t, body_type: t.body_type, meters: t.meters, source: t.source,
          })),
        });
      });

      // POST /leads/:id/quote — Phase 2 API-07 (price-lock protocol applies)
      app.post('/leads/:id/quote', {
        schema: {
          tags: ['leads'], summary: 'Re-run price calculation',
          params: z.object({ id: z.string().uuid() }),
          response: { 200: LeadQuoteResponseSchema, 400: NotImpl, 404: NotImpl, 409: NotImpl },
        },
      }, async (req, reply) => {
        const lead = await leadsRepo.findById(app.db, req.params.id);
        if (!lead) return reply.notFound(`lead ${req.params.id} not found`);
        if (!lead.fromCityId || !lead.toCityId) return reply.badRequest('lead missing from_city or to_city');
        const tons = Number(lead.tons ?? 0);
        if (!Number.isFinite(tons) || tons <= 0) return reply.badRequest('lead has no tonnage');

        const cityRows = await app.db.execute(sql`
          SELECT id, ST_X(geom::geometry) AS lon, ST_Y(geom::geometry) AS lat
          FROM cities WHERE id IN (${lead.fromCityId}, ${lead.toCityId})
        `);
        const cityMap = new Map<string, { lon: number; lat: number }>();
        for (const r of cityRows.rows as Array<{ id: string; lon: number; lat: number }>) cityMap.set(r.id, { lon: r.lon, lat: r.lat });
        const from = cityMap.get(lead.fromCityId);
        const to = cityMap.get(lead.toCityId);
        if (!from || !to) return reply.badRequest('city geom missing');

        const { route_km } = await routeKm(from, to, app.log);
        const cfg = await readPricingConfig(app.db);
        const out = calcPrice({ route_km, tons, bodyType: lead.bodyType ?? 'tent', date: new Date(), direction: 'default' }, cfg);

        // PRICE-LOCK: write to DB BEFORE responding.
        await leadsRepo.update(app.db, lead.id, { quotedPrice: out.default });

        let stage: string = lead.stage;
        try {
          await transitionLead(app.db, { leadId: lead.id, to: 'QUOTED', actor: 'manager', payload: { quoted_price: out.default.toString(), re_quote: true } });
          stage = 'QUOTED';
        } catch (err) {
          if (err instanceof IllegalTransition) {
            app.log.warn({ err, leadId: lead.id }, 'quote: illegal transition (stage already past QUOTED?)');
            // Don't fail the call — quoted_price is already updated; the caller may be re-quoting an AGREED lead.
          } else if (err instanceof VersionMismatch) {
            return reply.conflict(`concurrent update on lead ${lead.id} — retry`);
          } else { throw err; }
        }

        return reply.code(200).send({
          lead_id: lead.id,
          quoted_price_kopecks: out.default.toString(),
          min_kopecks: out.min.toString(),
          max_kopecks: out.max.toString(),
          route_km,
          stage,
        });
      });
    };

    export default leadsRoutes;
    ```

    **(c) apps/api/src/routes/health.ts** — add `llm` subcheck:
    - Read current response schema (Phase 1 added postgis + redis checks). Add `llm: z.enum(['ok','not_configured'])` to the checks object.
    - Handler: `llm: config.ANTHROPIC_API_KEY ? 'ok' : 'not_configured'`.
    - Update packages/shared-types/src/api/health.ts HealthResponseSchema similarly.

    Constraints:
    - DO NOT change route paths or Swagger tags (Phase 4 admin will rely on them).
    - DO NOT make handler bodies async-heavy outside the transaction boundaries.
    - 409 only on VersionMismatch (true concurrent update). IllegalTransition during re-run is "already past this stage" — log + continue, return current trucks/price.
  </action>
  <verify>
    <automated>cd apps/api && ! grep -q "reply.notImplemented.*Phase 2 — nearestTruck" src/routes/leads.ts && ! grep -q "reply.notImplemented.*Phase 2 — calcPrice" src/routes/leads.ts && grep -q "nearestTruck(app.db" src/routes/leads.ts && grep -q "calcPrice(" src/routes/leads.ts && grep -q "leadsRepo.update.*quotedPrice" src/routes/leads.ts && grep -q "transitionLead" src/routes/leads.ts && grep -q "VersionMismatch" src/routes/leads.ts && grep -q "llm" src/routes/health.ts && pnpm --filter @ai-logist/api typecheck 2>&1 | tail -10 && pnpm exec biome check apps/api/src/routes 2>&1 | tail -5</automated>
  </verify>
  <done>
    Both routes return 200 instead of 501; price-lock applied (leadsRepo.update before transitionLead); /api/health reports llm subcheck; tsc + biome pass; shared-types schema in sync.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: API integration test via app.inject() + flip final API-07 todo + verify phase-2-stubs.test.ts is fully green (≥18 passing, 0 todos)</name>
  <files>apps/api/tests/integration/api-leads-routes.test.ts, apps/api/tests/unit/phase-2-stubs.test.ts</files>
  <behavior>
    - api-leads-routes.test.ts boots Fastify via buildApp() against testcontainers Postgres, applies migrations, runs seed.
    - Test 1: POST /api/leads/:id/match on a lead in QUALIFIED stage → 200 + at least 1 truck in response + lead now in MATCHED.
    - Test 2: POST /api/leads/:id/match on non-existent uuid → 404.
    - Test 3: POST /api/leads/:id/match on lead without fromCityId → 400.
    - Test 4: POST /api/leads/:id/quote on a lead in MATCHED stage → 200 + quoted_price_kopecks numeric string + lead now in QUOTED + leads.quoted_price set to same value.
    - Test 5: POST /api/leads/:id/quote — verify PRICE-LOCK: read leads.quoted_price IMMEDIATELY before sending the API call; assert quoted_price WAS NULL before; assert response body.quoted_price_kopecks matches the DB value after (proving write-before-respond).
    - Test 6: Idempotency: POST /:id/quote twice in a row on QUOTED lead → second call returns 200 (logs illegal transition, doesn't 409) with updated quoted_price (since calcPrice may differ if pricing_config changed; in test, identical).
    - phase-2-stubs.test.ts: final state 0 todos + 18 real assertions.
  </behavior>
  <read_first>
    - apps/api/src/app.ts (buildApp + plugin order)
    - apps/api/src/routes/leads.ts (Task 1 — handler implementation)
    - apps/api/tests/_helpers/test-db.ts (testcontainers)
    - apps/api/tests/integration/pipeline-canonical.test.ts (Wave 3 — pattern for seeding a lead)
    - apps/api/tests/unit/phase-2-stubs.test.ts (current state — 1 todo expected before this task)
  </read_first>
  <action>
    **(a) apps/api/tests/integration/api-leads-routes.test.ts**:
    ```ts
    import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
    import { sql } from 'drizzle-orm';
    import { startPostgisContainer, stopPostgisContainer } from '../_helpers/test-db.js';

    describe('API-07: POST /api/leads/:id/{match,quote}', () => {
      let app: any;
      let testDbUrl: string;
      let clientId: string;
      let fromCityId: string;
      let toCityId: string;

      beforeAll(async () => {
        testDbUrl = await startPostgisContainer();
        process.env.DATABASE_URL = testDbUrl;
        // Dynamic import AFTER env override (config.ts validates at module load).
        const { buildApp } = await import('../../src/app.js');
        app = await buildApp();
        await app.ready();
        await import('../../src/seed/run.js').then((m) => m.seed(app.db));
        const c = await app.db.execute(sql`SELECT id FROM clients LIMIT 1`);
        clientId = (c.rows[0] as { id: string }).id;
        const cities = await app.db.execute(sql`SELECT id, slug FROM cities WHERE slug IN ('kyiv','lviv') ORDER BY slug`);
        const cityRows = cities.rows as Array<{ id: string; slug: string }>;
        fromCityId = cityRows.find((r) => r.slug === 'kyiv')!.id;
        toCityId = cityRows.find((r) => r.slug === 'lviv')!.id;
      }, 90_000);

      afterAll(async () => {
        await app.close();
        await stopPostgisContainer();
      });

      async function seedLead(stage: string, opts: { withCity?: boolean; withTons?: boolean; withQuotedPrice?: boolean } = {}): Promise<string> {
        const includeCity = opts.withCity !== false;
        const includeTons = opts.withTons !== false;
        const includePrice = opts.withQuotedPrice === true;
        const ins = await app.db.execute(sql`
          INSERT INTO leads (client_id, channel, stage, version, from_city_id, to_city_id, tons, body_type, quoted_price)
          VALUES (${clientId}, 'test', ${stage}::lead_stage, 0,
                  ${includeCity ? fromCityId : null}, ${includeCity ? toCityId : null},
                  ${includeTons ? '18' : null}, ${includeTons ? 'tent' : null}::body_type_t,
                  ${includePrice ? '2500000' : null}::bigint)
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
        // Verify quoted_price is null BEFORE the call (price-lock target = was-null).
        const before = await app.db.execute(sql`SELECT quoted_price FROM leads WHERE id = ${leadId}`);
        expect((before.rows[0] as { quoted_price: string | null }).quoted_price).toBeNull();
        const res = await app.inject({ method: 'POST', url: `/api/leads/${leadId}/quote` });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.lead_id).toBe(leadId);
        expect(body.quoted_price_kopecks).toMatch(/^\d+$/);
        expect(Number(body.min_kopecks)).toBeLessThan(Number(body.quoted_price_kopecks));
        expect(Number(body.max_kopecks)).toBeGreaterThan(Number(body.quoted_price_kopecks));
        // Verify quoted_price in DB matches response (write-before-respond).
        const after = await app.db.execute(sql`SELECT quoted_price, stage FROM leads WHERE id = ${leadId}`);
        const dbRow = after.rows[0] as { quoted_price: string; stage: string };
        expect(dbRow.quoted_price).toBe(body.quoted_price_kopecks);
        expect(dbRow.stage).toBe('QUOTED');
      }, 60_000);

      it('POST /:id/quote twice (idempotent on past-stage) → both 200', async () => {
        const leadId = await seedLead('MATCHED');
        const r1 = await app.inject({ method: 'POST', url: `/api/leads/${leadId}/quote` });
        const r2 = await app.inject({ method: 'POST', url: `/api/leads/${leadId}/quote` });
        expect(r1.statusCode).toBe(200);
        expect(r2.statusCode).toBe(200);  // second call: IllegalTransition swallowed, price re-written
      }, 60_000);
    });
    ```

    **(b) Flip the final API-07 todo in phase-2-stubs.test.ts**:
    ```ts
    it('API-07: POST /api/leads/:id/match and /quote return 200 (not 501) — see tests/integration/api-leads-routes.test.ts', async () => {
      const leadsRoute = await import('../../src/routes/leads.js');
      expect(leadsRoute.default).toBeDefined();
      // Sanity: routes module imports nearestTruck + calcPrice + transitionLead.
      const src = await import('node:fs/promises').then((fs) => fs.readFile('src/routes/leads.ts', 'utf8'));
      expect(src).toMatch(/nearestTruck/);
      expect(src).toMatch(/calcPrice/);
      expect(src).toMatch(/transitionLead/);
      expect(src).not.toMatch(/notImplemented\('Phase 2/);
    });
    ```

    Verify the final stub file:
    ```bash
    grep -c "test.todo" tests/unit/phase-2-stubs.test.ts  # MUST be 0
    pnpm --filter @ai-logist/api test:unit -- phase-2-stubs  # MUST show 18 passing, 0 todo
    ```

    Constraints:
    - app.inject() pattern matches Phase 1 Plan 01-07 integration tests; reuse the dynamic-import-AFTER-env-override pattern.
    - api-leads-routes.test.ts gates on Docker (testcontainers) — skip gracefully if Docker unavailable.
    - Final todo flip is a sanity-check style assertion; the heavy lifting is in api-leads-routes.test.ts.
  </action>
  <verify>
    <automated>cd apps/api && test -f tests/integration/api-leads-routes.test.ts && grep -q "app.inject" tests/integration/api-leads-routes.test.ts && grep -q "POST.*/api/leads.*match" tests/integration/api-leads-routes.test.ts && grep -q "quoted_price_kopecks" tests/integration/api-leads-routes.test.ts && grep -q "price-lock" tests/integration/api-leads-routes.test.ts && test "$(grep -c "test.todo" tests/unit/phase-2-stubs.test.ts)" = "0" && pnpm --filter @ai-logist/api typecheck 2>&1 | tail -10 && pnpm --filter @ai-logist/api test:unit -- phase-2-stubs 2>&1 | tail -10</automated>
  </verify>
  <done>
    api-leads-routes.test.ts shipped (6 cases); phase-2-stubs.test.ts has 0 todos and 18 passing assertions; tsc passes; full Phase 2 requirement coverage proven.
  </done>
</task>

</tasks>

<verification>
Wave 5 + Phase 2 final gates:
1. `pnpm --filter @ai-logist/api typecheck` — passes
2. `pnpm exec biome check apps/api/src apps/api/tests packages/shared-types/src` — passes
3. `pnpm --filter @ai-logist/api test:unit` — all unit tests green, 0 todos
4. `pnpm --filter @ai-logist/api test:integration` — full integration suite green (Docker-equipped only)
5. `pnpm --filter @ai-logist/api exec vitest run --project unit --repeat=10 -t snapshot` — snapshot 10× byte-stable (success criterion #2)
6. `grep -c "test.todo" apps/api/tests/unit/phase-2-stubs.test.ts` = 0
7. `grep -c "reply.notImplemented" apps/api/src/routes/leads.ts` ≤ 2 (only GET + PATCH remain as 501, Phase 4 work)
</verification>

<success_criteria>
- POST /api/leads/:id/match returns 200 with truck candidates (not 501) — invokes nearestTruck + transitionLead.
- POST /api/leads/:id/quote returns 200 with price corridor (not 501) — applies price-lock (DB write before response).
- Both routes handle 404 (lead not found), 400 (lead missing pre-conditions), 409 (true version mismatch).
- /api/health reports llm subcheck.
- 6 API integration test cases pass (including explicit price-lock verification).
- phase-2-stubs.test.ts has 0 todos and 18 passing assertions covering all Phase 2 requirements.
- Phase 2 is complete: ROADMAP success criteria #1–#5 all backed by automated tests.
</success_criteria>

<output>
After completion, create `.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-05-SUMMARY.md` documenting:
- 2 routes un-stubbed (match + quote) using SAME functions as pipeline (single source of truth)
- /api/health gained llm subcheck (Phase 6 POLISH-06 will extend to real ping)
- API integration test verifies price-lock at the HTTP boundary (DB row updated before response sent)
- phase-2-stubs.test.ts: 0 todos, 18 passing — Phase 2 requirements all green
- Phase 2 status: COMPLETE / ready for /gsd:verify-work
- Remaining 501 stubs in routes/: GET /api/leads + PATCH /api/leads/:id (Phase 4); /api/orders, /api/trucks, /api/clients, /api/analytics, webhooks (Phase 3, 4, 5).
- Cumulative pitfall closures: #1 LLM in money path (createOrder DB re-read), #2 KNN sphere/spheroid (CTE re-rank), #6 FSM races (FOR UPDATE + version + advisory lock), #7 sticky lang, #11 prompt injection (tools security boundary), #12 token-cost runaway (per-lead ledger).
</output>
