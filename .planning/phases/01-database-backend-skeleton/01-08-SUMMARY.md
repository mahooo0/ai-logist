---
phase: 01-database-backend-skeleton
plan: 08
subsystem: api
tags: [fastify, fastify-v5, zod, type-provider-zod, swagger, openapi, sensible, 501-stubs, shared-types, dto-schemas, integration-test]

# Dependency graph
requires:
  - phase: 01-database-backend-skeleton
    provides: Fastify v5 buildApp() with sensible + db + redis + swagger plugins (Plan 01-07); HealthResponseSchema pattern in packages/shared-types (Plan 01-07); 7 pgEnums declared in apps/api/src/persistence/schema/_enums.ts (Plan 01-03)
provides:
  - packages/shared-types/src/domain/enums.ts — 7 Zod enums mirroring DB pgEnums (LeadStage, OrderStatus, OrderEventType, BodyType, TruckStatus, ClientLang, WebhookSource)
  - packages/shared-types/src/api/leads.ts — LeadSchema, LeadListQuerySchema, LeadPatchBodySchema, LeadMatchResponseSchema, LeadQuoteResponseSchema
  - packages/shared-types/src/api/orders.ts — OrderSchema, OrderEventSchema, OrderListQuerySchema, OrderDetailSchema, CreateOrderBodySchema, PriceOverrideBodySchema
  - packages/shared-types/src/api/trucks.ts — TruckSchema, TruckListQuerySchema, CreateTruckBodySchema, PatchTruckBodySchema
  - packages/shared-types/src/api/clients.ts — MessageSchema, ListMessagesQuerySchema
  - packages/shared-types/src/api/analytics.ts — KpiResponseSchema
  - packages/shared-types/src/api/webhooks.ts — TelegramUpdateBodySchema, GpsPushBodySchema, VoiceCallbackBodySchema, WebhookAckResponseSchema
  - apps/api/src/routes/leads.ts — 4 routes (GET /api/leads, PATCH /api/leads/:id, POST /api/leads/:id/match, POST /api/leads/:id/quote), all 501 stubs
  - apps/api/src/routes/orders.ts — 4 routes (GET /api/orders, GET /api/orders/:id, POST /api/orders, POST /api/orders/:id/price-override), all 501 stubs
  - apps/api/src/routes/trucks.ts — 3 routes (GET/POST/PATCH /api/trucks), all 501 stubs
  - apps/api/src/routes/clients.ts — 1 route (GET /api/clients/:id/messages), 501 stub
  - apps/api/src/routes/analytics.ts — 1 route (GET /api/analytics/kpi), 501 stub
  - apps/api/src/routes/webhooks.ts — 3 routes (POST /webhook/{telegram,voice,gps}), all 501 stubs
  - apps/api/src/app.ts — buildApp() registers all 7 route plugins (was 1; now 17 total routes)
  - apps/api/tests/integration/swagger.test.ts — 5 integration tests asserting Swagger surface + Zod 400 + sensible 501 shape
  - packages/shared-types/package.json — exports map gains ./domain/* subpath
  - API-16 (Schema-validated routes with Zod, shared-types DTOs) fully covered for Phase 1
affects:
  - 01-09 seed — seed runner can import enums from shared-types for type-safe seed payloads (e.g. `status: 'available' satisfies TruckStatus`)
  - 01-10 readme-smoke — README can document Swagger UI at /api/docs as the demo's API contract surface
  - Phase 2 (LLM tools, FSM, KNN) — swaps reply.notImplemented() in /leads/:id/match + /leads/:id/quote for real nearestTruck/calcPrice handlers; schemas unchanged
  - Phase 3 (Telegram + voice webhooks) — swaps reply.notImplemented() in /webhook/telegram + /webhook/voice for real grammY + voice callback handlers; TelegramUpdateBodySchema already permissive (`.passthrough()`) for any Telegram Bot API payload
  - Phase 4 (admin REST + UI) — apps/web typed fetch imports LeadSchema/OrderSchema/TruckSchema etc. from @ai-logist/shared-types directly; backend routes swap reply.notImplemented() for handlers that talk to repos
  - Phase 5 (WS + tracking) — swaps reply.notImplemented() in /webhook/gps for the GPS push handler; GpsPushBodySchema already validates {truckId, lng, lat, recordedAt}

# Tech tracking
tech-stack:
  added: []  # No new runtime dependencies — leveraging Plan 01-07's stack
  patterns:
    - "501-stub pattern (RESEARCH.md Pattern 7) — every API-* and webhook endpoint declares its FULL Zod schema (params/querystring/body/response) so Swagger UI shows the contract, but the handler calls reply.notImplemented() from @fastify/sensible. Phase 2/3/4/5 swap the body — schema stays."
    - "Per-domain DTO modules in shared-types — packages/shared-types/src/api/{leads,orders,trucks,clients,analytics,webhooks}.ts each export their schemas + inferred types; barrel re-exports via index.ts. Mirrors the apps/api/src/routes/ layout 1:1."
    - "Zod enums mirror DB pgEnums via shared-types/domain/enums.ts — single source of truth for {LeadStage,OrderStatus,BodyType,TruckStatus,ClientLang,...} consumed by both apps/api validation AND apps/web typed UI in Phase 4."
    - "Permissive webhook body schemas (.passthrough()) — Telegram + voice payloads are large/variable; we only need the key field (update_id / call_id) for idempotency (D-09). Tight validation lives in Phase 3."
    - "Multi-method route plugin — single FastifyPluginAsyncZod (e.g. leadsRoutes) registers 4 verb/path combinations sharing one prefix. Cleaner than per-route plugin files."
    - "Integration test via app.inject({method,url,payload?}) + testcontainers — same pattern as Plan 01-07's health.test.ts; Fastify's inject() runs full middleware → validator → handler → serializer pipeline. No port allocation, no real HTTP listener. Plan 01-08 extends to 5 cases (Swagger JSON, Zod 400 on querystring, Zod 400 on body, sensible 501 shape, sensible 501 after valid body)."

key-files:
  created:
    - packages/shared-types/src/domain/enums.ts
    - packages/shared-types/src/api/leads.ts
    - packages/shared-types/src/api/orders.ts
    - packages/shared-types/src/api/trucks.ts
    - packages/shared-types/src/api/clients.ts
    - packages/shared-types/src/api/analytics.ts
    - packages/shared-types/src/api/webhooks.ts
    - apps/api/src/routes/leads.ts
    - apps/api/src/routes/orders.ts
    - apps/api/src/routes/trucks.ts
    - apps/api/src/routes/clients.ts
    - apps/api/src/routes/analytics.ts
    - apps/api/src/routes/webhooks.ts
    - apps/api/tests/integration/swagger.test.ts
  modified:
    - packages/shared-types/src/index.ts — barrel re-exports 6 api/* + 1 domain/enums
    - packages/shared-types/package.json — exports map gains ./domain/* subpath for apps/api and apps/web direct subpath imports
    - apps/api/src/app.ts — registers 6 new route plugins (leads/orders/trucks/clients/analytics at /api, webhooks at /webhook)
    - apps/api/tests/unit/phase-1-stubs.test.ts — API-16 stub expanded with 3 new assertions covering Plan 01-08 DTO surface, PriceOverrideBodySchema reason-required rule, and route-registration grep

key-decisions:
  - "Coarse passthrough validation for Telegram + voice webhooks — TelegramUpdateBodySchema is `z.object({update_id: z.number().int()}).passthrough()` because the Bot API ships hundreds of optional fields that evolve; we only need update_id to dedupe via webhook_updates (D-09). Tight validation lives in Phase 3 alongside the grammY context object. Voice/gps similarly minimal — Phase 5 tightens when the real GPS source is wired."
  - "numeric + bigint columns serialised as string in DTOs — node-postgres returns NUMERIC and BIGINT as strings to preserve precision; the DTO Zod schemas match that by typing tons/price/budget/etc. as z.string().nullable() rather than z.number(). Avoids precision loss for kopecks (bigint) and tonnage (numeric with 2 decimals)."
  - "PriceOverrideBodySchema makes `reason` mandatory (`z.string().min(3)`) — ADMIN-NEW-06 requires every price override to carry an audit reason. Schema-level enforcement means the manager UI can never submit an override without a reason; Phase 4 form validation reuses the same Zod schema."
  - "All route stubs use a shared NotImpl shape (`{statusCode, error, message}`) — matches @fastify/sensible's reply.notImplemented() canonical output. Repeated in every route file (5 lines each) rather than centralised, so future Phase 2/3/4 edits don't need to touch a shared helper module."
  - "Integration test imports app.ts DYNAMICALLY inside beforeAll() — same pattern as health.test.ts. config.ts validates process.env at module load; static top-of-file import would capture original DATABASE_URL before testcontainers env override."
  - "Skipped live `pnpm dev` + `curl /api/leads?limit=abc` smoke — Docker daemon unreachable on Claude's runner (Plans 01-02..07 all logged this). The integration test in swagger.test.ts covers the same contract with stronger enforcement (real Postgres + real PostGIS + full app.inject pipeline) on Docker-equipped machines. Vitest can discover and list all 5 swagger.test.ts cases (`pnpm exec vitest list --project integration`) confirming the test file parses correctly."
  - "Expanded API-16 unit test (apps/api/tests/unit/phase-1-stubs.test.ts) — added 3 new assertions that don't require Docker: (a) all 6 new shared-types DTO modules export their schemas, (b) PriceOverrideBodySchema enforces ADMIN-NEW-06 reason-required rule, (c) all 6 stub route files import from shared-types + call reply.notImplemented + app.ts registers all 7 route plugins. Unit suite jumps from 12 passed / 5 todo to 15 passed / 5 todo without requiring Docker — gives offline contract enforcement for Plan 01-08."
  - "shared-types package.json exports map gains `./domain/*` subpath — Plan 01-07 added `./api/*` for HealthResponseSchema; Plan 01-08's enums.ts lives under `./domain/` and consumers (currently tests, future apps/web) need direct subpath imports. Symmetric with the existing api/* pattern."
  - "Multi-method route plugin per domain — e.g. apps/api/src/routes/leads.ts hosts 4 routes (GET /, PATCH /:id, POST /:id/match, POST /:id/quote). Single FastifyPluginAsyncZod with multiple app.{get,patch,post}() calls is cleaner than one file per verb. Matches the eventual Phase 4 handler shape where business logic for {match, quote} sits next to the list/patch handlers."

patterns-established:
  - "Pattern 1: 501-stub route file — `import schemas from @ai-logist/shared-types/api/<domain>` + declare const NotImpl Zod object + define FastifyPluginAsyncZod with app.{get,post,patch}('/path', {schema:{tags,summary,params,querystring,body,response:{200:..., 501:NotImpl}}}, async (_req, reply) => reply.notImplemented('<phase> — <feature>')) + default export. Replicated 6 times in Plan 01-08; Phase 2-5 swap reply.notImplemented for real handlers."
  - "Pattern 2: Per-domain DTO module in shared-types — packages/shared-types/src/api/<domain>.ts exports {<Entity>Schema, <Entity>ListQuerySchema, <Entity>CreateBodySchema, <Entity>PatchBodySchema} where applicable + inferred `export type X = z.infer<typeof XSchema>`. Establishes naming convention for every future DTO."
  - "Pattern 3: Zod enums = DB pgEnum mirror — packages/shared-types/src/domain/enums.ts declares one z.enum() per pgEnum in apps/api/src/persistence/schema/_enums.ts with identical value arrays. Comment block on the file documents the 'keep in sync' rule. Single source of truth consumed by both backend validation and frontend type-safe UI."
  - "Pattern 4: app.register() per domain at /api prefix (webhooks at /webhook) — buildApp() registers 7 route plugins in deterministic order: health, leads, orders, trucks, clients, analytics, webhooks. Webhooks gets `/webhook` prefix (spec §6); everything else gets `/api`."
  - "Pattern 5: Integration test surface assertion via Swagger JSON — `app.inject({method:'GET', url:'/api/docs/json'})` returns the full OpenAPI 3 document; test asserts expected.arrayContaining over Object.keys(body.paths). Plus operation-count check (sum of HTTP verb keys across all path objects) ≥ 14 to catch silent route drops. This is the contract test for D-25 (every API-* declared in Fastify)."

requirements-completed: [API-16]

# Metrics
duration: 6m 21s
completed: 2026-06-09
---

# Phase 01 Plan 08: REST Stubs Summary

**6 Fastify 501-stub route files (`/api/leads`, `/api/orders`, `/api/trucks`, `/api/clients/:id/messages`, `/api/analytics/kpi`, `/webhook/{telegram,voice,gps}`) wiring every API-* and webhook endpoint from spec §6 with FULL Zod request/response schemas published in `packages/shared-types/src/api/*` (per D-25 + D-27); 17 total routes registered in `buildApp()`; integration test exercises Swagger JSON surface + Zod 400 rejection + sensible 501 canonical shape end-to-end.**

## Performance

- **Duration:** 6m 21s
- **Started:** 2026-06-09T06:22:01Z
- **Completed:** 2026-06-09T06:28:22Z
- **Tasks:** 2 (auto, fully autonomous)
- **Files created:** 14
- **Files modified:** 4

## Accomplishments

- **7 shared-types DTO modules (D-27):** `packages/shared-types/src/{api/leads,api/orders,api/trucks,api/clients,api/analytics,api/webhooks,domain/enums}.ts` — every schema needed by Phase 2/3/4/5 endpoints + 7 Zod enums mirroring the DB pgEnums (LeadStage, OrderStatus, OrderEventType, BodyType, TruckStatus, ClientLang, WebhookSource). All use `zod/v4` per Pitfall #4. Barrel re-export at `packages/shared-types/src/index.ts`. `pnpm --filter @ai-logist/shared-types build` produces matching dist artefacts. Package exports map (`packages/shared-types/package.json`) now lists `./api/*` (from Plan 01-07) AND `./domain/*` for direct subpath imports.
- **6 Fastify 501-stub route files (D-25 + RESEARCH.md Pattern 7):** Every API-* endpoint declared by spec §6 ships as a Fastify route with its FULL Zod params/querystring/body/response schema. Handlers call `reply.notImplemented('<phase> — <feature>')` from @fastify/sensible. The full surface:
  - `/api/leads` GET (LeadListQuerySchema), PATCH /:id (LeadPatchBodySchema), POST /:id/match (200: LeadMatchResponseSchema), POST /:id/quote (200: LeadQuoteResponseSchema) — 4 routes
  - `/api/orders` GET (OrderListQuerySchema), GET /:id (200: OrderDetailSchema), POST (CreateOrderBodySchema → 201: OrderSchema), POST /:id/price-override (PriceOverrideBodySchema → 200: OrderSchema) — 4 routes
  - `/api/trucks` GET (TruckListQuerySchema), POST (CreateTruckBodySchema → 201: TruckSchema), PATCH /:id (PatchTruckBodySchema → 200: TruckSchema) — 3 routes
  - `/api/clients/:id/messages` GET (ListMessagesQuerySchema → 200: Message[]) — 1 route
  - `/api/analytics/kpi` GET (window query → 200: KpiResponseSchema) — 1 route
  - `/webhook/telegram` POST (TelegramUpdateBodySchema → 200: WebhookAckResponseSchema), `/webhook/voice` POST (VoiceCallbackBodySchema), `/webhook/gps` POST (GpsPushBodySchema) — 3 routes
  - **Total: 16 stub routes + 1 health route = 17 routes; spec §6 ≥ 14 satisfied**
- **buildApp() registers all 7 plugins (D-25):** `apps/api/src/app.ts` adds 6 new `await app.register(<domain>Routes, { prefix: '/api' })` lines + 1 webhook prefix `/webhook`. Existing health registration unchanged.
- **Integration test (`apps/api/tests/integration/swagger.test.ts`):** 5 cases via `app.inject()` + testcontainers PostGIS:
  1. **Swagger JSON surface:** `GET /api/docs/json` returns OpenAPI document; assertion checks `paths` contains all 9 expected endpoint paths + total operation count ≥ 14.
  2. **API-16 querystring 400:** `GET /api/leads?limit=abc` → 400 (Zod rejects non-coerceable number).
  3. **501 sensible shape:** `GET /api/leads` → 501 + body `{statusCode:501, error:'Not Implemented', message:string}`.
  4. **501 after valid body:** `POST /webhook/gps` with valid GpsPushBody → still 501 (body validates → handler reaches → reply.notImplemented).
  5. **Webhook body 400:** `POST /webhook/gps` with `{truckId:'not-a-uuid'}` → 400 (Zod rejects invalid UUID + missing fields).
  Test file parses via Vitest's `vitest list --project integration`; all 5 cases discoverable. Actual execution requires Docker daemon (consistent posture with Plans 01-02..07).
- **API-16 expanded in unit suite:** `apps/api/tests/unit/phase-1-stubs.test.ts` — 3 new assertions don't require Docker: (a) all 6 new shared-types DTO modules export their schemas + enums, (b) PriceOverrideBodySchema rejects body missing `reason` (ADMIN-NEW-06 audit), (c) all 6 stub route files contain `reply.notImplemented` + import from `@ai-logist/shared-types/api/`, and `app.ts` matches `app.register(*Routes` at least 7 times. **Unit suite: 15 passed / 5 todo (was 12 / 5).**
- **TypeScript + Biome clean:** `pnpm exec tsc --noEmit -p apps/api/tsconfig.json` exits 0; `pnpm exec biome check apps/api/src apps/api/tests packages/shared-types/src` exits 0 (50 files).

## Task Commits

1. **Task 1: shared-types DTO schemas + domain enums** — `e8823c2` (feat)
2. **Task 2: 6 Fastify 501-stub route files + register in app.ts + integration test** — `64c419e` (feat)
3. **Bonus: expand API-16 unit test coverage + add ./domain/* exports map** — `5116a90` (test)

**Plan metadata:** *(committed at end of execution)*

## Files Created/Modified

### Created (14)
- `packages/shared-types/src/domain/enums.ts` — 7 Zod enums mirroring DB pgEnums
- `packages/shared-types/src/api/leads.ts` — Lead DTOs + match/quote responses
- `packages/shared-types/src/api/orders.ts` — Order DTOs + detail + create + price-override
- `packages/shared-types/src/api/trucks.ts` — Truck DTOs + create/patch bodies
- `packages/shared-types/src/api/clients.ts` — Message DTOs + list query
- `packages/shared-types/src/api/analytics.ts` — KPI response
- `packages/shared-types/src/api/webhooks.ts` — Telegram/voice/gps body schemas + ack
- `apps/api/src/routes/leads.ts` — 4 routes, 501 stubs
- `apps/api/src/routes/orders.ts` — 4 routes, 501 stubs
- `apps/api/src/routes/trucks.ts` — 3 routes, 501 stubs
- `apps/api/src/routes/clients.ts` — 1 route, 501 stub
- `apps/api/src/routes/analytics.ts` — 1 route, 501 stub
- `apps/api/src/routes/webhooks.ts` — 3 routes, 501 stubs
- `apps/api/tests/integration/swagger.test.ts` — 5 integration test cases

### Modified (4)
- `packages/shared-types/src/index.ts` — barrel re-exports 6 api/* + 1 domain/enums (alphabetised per Biome import sorter)
- `packages/shared-types/package.json` — exports map gains `./domain/*` for direct subpath imports
- `apps/api/src/app.ts` — registers all 7 route plugins (was 1)
- `apps/api/tests/unit/phase-1-stubs.test.ts` — 3 new API-16 assertions (DTO surface, ADMIN-NEW-06 reason, app.ts register grep)

## Decisions Made

- **Coarse passthrough validation for Telegram + voice webhooks.** The Telegram Bot API ships hundreds of optional fields that evolve every release; we only need `update_id` to dedupe via the `webhook_updates` table (D-09 idempotency). `TelegramUpdateBodySchema = z.object({update_id: z.number().int()}).passthrough()` accepts anything else without choking. Phase 3 tightens with proper Telegram payload types from grammY's context.
- **numeric + bigint columns serialised as `string` in DTOs.** node-postgres returns NUMERIC and BIGINT as JS strings to preserve precision; the DTO Zod schemas match that by typing `tons`, `volumeM3`, `budget`, `price`, `quotedPrice`, `declaredValue`, `distanceKm`, etc. as `z.string().nullable()` (or non-null where appropriate). Avoids precision loss for kopecks (bigint) and tonnage (numeric(10,2)).
- **PriceOverrideBodySchema makes `reason` mandatory with min length 3.** ADMIN-NEW-06 requires every price override to carry an audit reason. Schema-level enforcement means even an automated client can never submit an override without justification; Phase 4's manager UI reuses the same Zod schema for form validation.
- **Shared `NotImpl` Zod object per route file rather than a central import.** Each of the 6 new route files declares `const NotImpl = z.object({statusCode, error, message})` at the top (5 lines). Slight duplication, but it keeps each file self-contained for Phase 2/3/4 swaps — when the handler changes from `reply.notImplemented` to a real implementation, the response definition stays local to the file under review. Centralising would have created a `_shared.ts` that's coupled to every route plugin.
- **Multi-method route plugin per domain.** `apps/api/src/routes/leads.ts` hosts 4 routes (GET, PATCH, POST .../match, POST .../quote). Single `FastifyPluginAsyncZod` with multiple `app.{get,patch,post}()` calls is cleaner than one file per verb. Matches the eventual Phase 4 handler shape where business logic for `match` + `quote` sits next to the list/patch handlers.
- **Integration test imports `app.ts` DYNAMICALLY inside `beforeAll()`.** Same pattern as `health.test.ts`. `config.ts` validates `process.env` at module load; a static top-of-file import would capture the original DATABASE_URL before the testcontainers env override could take effect.
- **Skipped live `pnpm dev` + curl smoke.** Docker daemon unreachable on Claude's runner (consistent with Plans 01-02..07; same posture). The integration test in `swagger.test.ts` covers the same contract with stronger enforcement (real Postgres + real PostGIS + full `app.inject` pipeline) on Docker-equipped machines. Vitest can discover all 5 cases (`vitest list --project integration` shows them), confirming the test file parses correctly.
- **Expanded API-16 unit test instead of relying solely on Docker-dependent integration.** Added 3 new assertions to `apps/api/tests/unit/phase-1-stubs.test.ts`: all 6 new shared-types DTO modules export their schemas; PriceOverrideBodySchema enforces ADMIN-NEW-06 reason rule; all 6 route files import from shared-types + call `reply.notImplemented` + app.ts registers 7 route plugins. Unit suite jumps from 12 → 15 passing without requiring Docker, giving offline contract enforcement.
- **`./domain/*` added to shared-types package.json exports map.** Plan 01-07 added `./api/*` for HealthResponseSchema; Plan 01-08's `enums.ts` lives under `./domain/` and consumers (currently tests, future apps/web Phase 4) need direct subpath imports. Symmetric with the existing api/* pattern.

## Deviations from Plan

None — plan executed exactly as written.

(One environmental gap was anticipated: the plan's `<verify>` block includes a live `pnpm dev` + `curl` smoke that requires Docker; per Plans 01-02..07's documented posture, Docker is unreachable on Claude's runner. The integration test covers the same contract on Docker-equipped machines. Plan author explicitly noted "If Docker isn't available, document that the test will execute when run in CI/dev with Docker up.")

## Issues Encountered

**1. Biome import sorter regression after barrel re-export append.** Biome's import sorter requires alphabetical ordering; my first version of `packages/shared-types/src/index.ts` appended new exports in the order I created them (analytics last because of source-write order). Biome flagged `useSortedExports` violation. Fixed by alphabetising: `analytics, clients, health, leads, orders, trucks, webhooks` + `domain/enums` at end. No deviation — just a one-line resort during Task 1 verification.

**2. shared-types package.json exports map missing `./domain/*`.** Plan 01-07 added `./api/*` only. Plan 01-08's new tests import from `@ai-logist/shared-types/domain/enums` which would 404 at resolution time. Added the symmetric `./domain/*` entry to package.json. Not a deviation from the plan because the plan's success criterion focused on `./api/*` consumption by routes (which works through the barrel); the domain subpath import surfaced only when I added the bonus unit test.

## User Setup Required

**None for this plan.** All source ships in the repo. Once a Docker-equipped machine is available (Plans 01-09 or 01-10 will surface this gate):

```bash
docker compose up -d postgres redis
pnpm --filter @ai-logist/api db:migrate
pnpm --filter @ai-logist/api dev &

# Verify 501 stub + sensible error shape
curl -s -w "\n%{http_code}\n" http://localhost:3000/api/leads
# Expect: 501 body {statusCode:501, error:"Not Implemented", message:"Phase 4 — admin web"}

# Verify Zod 400 rejection
curl -s -w "\n%{http_code}\n" "http://localhost:3000/api/leads?limit=abc"
# Expect: 400 with Zod error details

# Verify Swagger UI lists every endpoint
open http://localhost:3000/api/docs
# Expect: Tags for system, leads, orders, trucks, clients, analytics, webhooks
# 17 routes total

# Verify OpenAPI JSON
curl -s http://localhost:3000/api/docs/json | jq '.paths | keys'
# Expect: ["/api/analytics/kpi","/api/clients/{id}/messages","/api/health",
#          "/api/leads","/api/leads/{id}","/api/leads/{id}/match",
#          "/api/leads/{id}/quote","/api/orders","/api/orders/{id}",
#          "/api/orders/{id}/price-override","/api/trucks","/api/trucks/{id}",
#          "/webhook/gps","/webhook/telegram","/webhook/voice"]

# Verify integration test
cd apps/api && pnpm exec vitest run --project integration
# Expect: 7 passing (health.test.ts: 2; swagger.test.ts: 5)
```

## Next Phase Readiness

**Plan 01-09 (seed) is unblocked.**
- `pnpm seed` (the next plan's deliverable) will use the repos shipped in Plan 01-06 directly — no API surface dependency.
- However, Plan 01-09's seed script can now `import type { TruckStatus, BodyType } from '@ai-logist/shared-types/domain/enums'` for type-safe seed payloads — bonus side effect.

**Plan 01-10 (readme-smoke) is unblocked.**
- README can document the full `/api/docs` Swagger surface as the demo's API contract — a concrete visual artefact for stakeholder review even before Phase 2 ships business logic.

**Phase 2/3/4/5 contract surface complete (per success criteria #1-6):**
- Every spec §6 endpoint has its Zod schema declared (D-25 fully covered).
- Every schema lives in `@ai-logist/shared-types` (D-27 fully covered for REST DTOs; WS schemas Phase 5).
- Swagger UI surfaces the contract for downstream developer onboarding.
- Phase 2 just swaps `reply.notImplemented('Phase 2 — nearestTruck')` for the real `nearestTruck()` call in `/leads/:id/match`; schema unchanged.
- Phase 3 just swaps `reply.notImplemented('Phase 3 — Telegram')` for the grammY handler in `/webhook/telegram`; schema is permissive `.passthrough()` so any Bot API payload validates.
- Phase 4 admin web `import { LeadSchema, OrderSchema, TruckSchema } from '@ai-logist/shared-types'` and gets fully typed fetch responses without writing any new schemas.

**Carry-over concerns:**
- Live `pnpm dev` + `curl` smoke still pending Docker daemon availability — Plans 01-02..08 have all logged this. Plan 01-10 (readme-smoke) is the natural end-of-phase verification gate where a verifier machine runs the full sequence.
- Integration test contract (`apps/api/tests/integration/swagger.test.ts`) is shipped and discoverable by Vitest; it'll pass on Docker-equipped machines alongside `health.test.ts`.
- Unit suite now 15 passed / 5 todo (was 12 / 5). Remaining todos: DB-10 (seed → Plan 01-09), DEPLOY-01..04 (README + smoke → Plan 01-10).

## Swagger JSON Path

`@fastify/swagger-ui@5.2.6` exposes the OpenAPI document at `routePrefix + '/json'` — i.e. **`/api/docs/json`** (since `routePrefix: '/api/docs'` in `buildApp()`). Verified by reading `apps/api/node_modules/@fastify/swagger-ui/lib/routes.js:149` (`url: '/json'`). The integration test's fallback to `/api/docs/openapi.json` is harmless (404 → second inject try), kept for forward-compatibility with hypothetical version bumps.

## Route Count Inventory

| File | Verbs/Paths | Count |
|------|------------|-------|
| `routes/health.ts` (from Plan 01-07) | GET /api/health | 1 |
| `routes/leads.ts` | GET /api/leads; PATCH /api/leads/:id; POST /api/leads/:id/match; POST /api/leads/:id/quote | 4 |
| `routes/orders.ts` | GET /api/orders; GET /api/orders/:id; POST /api/orders; POST /api/orders/:id/price-override | 4 |
| `routes/trucks.ts` | GET /api/trucks; POST /api/trucks; PATCH /api/trucks/:id | 3 |
| `routes/clients.ts` | GET /api/clients/:id/messages | 1 |
| `routes/analytics.ts` | GET /api/analytics/kpi | 1 |
| `routes/webhooks.ts` | POST /webhook/telegram; POST /webhook/voice; POST /webhook/gps | 3 |
| **Total** | | **17** |

## Self-Check: PASSED

**Files verified (created — 14):**
- FOUND: packages/shared-types/src/domain/enums.ts
- FOUND: packages/shared-types/src/api/leads.ts
- FOUND: packages/shared-types/src/api/orders.ts
- FOUND: packages/shared-types/src/api/trucks.ts
- FOUND: packages/shared-types/src/api/clients.ts
- FOUND: packages/shared-types/src/api/analytics.ts
- FOUND: packages/shared-types/src/api/webhooks.ts
- FOUND: apps/api/src/routes/leads.ts
- FOUND: apps/api/src/routes/orders.ts
- FOUND: apps/api/src/routes/trucks.ts
- FOUND: apps/api/src/routes/clients.ts
- FOUND: apps/api/src/routes/analytics.ts
- FOUND: apps/api/src/routes/webhooks.ts
- FOUND: apps/api/tests/integration/swagger.test.ts

**Files verified (modified — 4):**
- FOUND: packages/shared-types/src/index.ts (barrel updated, alphabetised)
- FOUND: packages/shared-types/package.json (./domain/* exports map added)
- FOUND: apps/api/src/app.ts (7 register lines confirmed)
- FOUND: apps/api/tests/unit/phase-1-stubs.test.ts (3 new API-16 assertions)

**Commits verified:**
- FOUND: e8823c2 (Task 1 — feat: shared-types DTO schemas + domain enums)
- FOUND: 64c419e (Task 2 — feat: 501-stub routes + register + integration test)
- FOUND: 5116a90 (test: expand API-16 stub tests + ./domain/* exports map)

**Invariant counts verified:**
- `grep -rq "reply.notImplemented" apps/api/src/routes` → exit 0 (found in every route file)
- `grep -c "register(.*Routes" apps/api/src/app.ts` → 7 (matches success criterion ≥ 7)
- `grep -q "@ai-logist/shared-types/api/leads" apps/api/src/routes/leads.ts` → exit 0
- `grep -q "@ai-logist/shared-types/api/orders" apps/api/src/routes/orders.ts` → exit 0
- `pnpm exec tsc --noEmit -p apps/api/tsconfig.json` → exit 0
- `pnpm exec biome check apps/api/src apps/api/tests packages/shared-types/src` → exit 0 (50 files)
- `pnpm --filter @ai-logist/shared-types build` → exit 0
- All 7 new dist artefacts exist: `packages/shared-types/dist/{api/{leads,orders,trucks,clients,analytics,webhooks},domain/enums}.js`
- Vitest unit suite: 15 passed / 5 todo (was 12 / 5 in Plan 01-07)
- Vitest can list all 5 integration cases in swagger.test.ts via `vitest list --project integration`

## Known Stubs

**All 16 new routes are 501 stubs by design.** Per D-25 + RESEARCH.md Pattern 7, this plan ships the API surface (route declarations + Zod schemas + Swagger contract) but defers implementation:
- `/api/leads` × 4 → Phase 4 (admin web) + Phase 2 (match/quote)
- `/api/orders` × 4 → Phase 4 (admin web) + Phase 4 ADMIN-NEW-06 (price override)
- `/api/trucks` × 3 → Phase 4 ADMIN-NEW-01 (fleet)
- `/api/clients/:id/messages` → Phase 4 ADMIN-03 (chat)
- `/api/analytics/kpi` → Phase 4 ADMIN-05 (KPI)
- `/webhook/telegram` → Phase 3 TG-01/TG-02
- `/webhook/voice` → Phase 3 (stub, return 200 per API-15)
- `/webhook/gps` → Phase 5 API-14

These stubs are tracked in the requirements doc (API-03..15 still unchecked) — they are explicitly scoped to later phases and the plan's success criterion was *"ship the schema contract, not the handler bodies."* Not stubs in the deferred/forgotten sense; stubs in the "Phase 1 = skeleton; Phase 2-5 = flesh" sense.

---
*Phase: 01-database-backend-skeleton*
*Completed: 2026-06-09*
