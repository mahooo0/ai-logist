---
phase: 01-database-backend-skeleton
plan: 08
type: execute
wave: 8
depends_on: ["01-07"]
files_modified:
  - packages/shared-types/src/api/leads.ts
  - packages/shared-types/src/api/orders.ts
  - packages/shared-types/src/api/trucks.ts
  - packages/shared-types/src/api/clients.ts
  - packages/shared-types/src/api/analytics.ts
  - packages/shared-types/src/api/webhooks.ts
  - packages/shared-types/src/domain/enums.ts
  - packages/shared-types/src/index.ts
  - apps/api/src/routes/leads.ts
  - apps/api/src/routes/orders.ts
  - apps/api/src/routes/trucks.ts
  - apps/api/src/routes/clients.ts
  - apps/api/src/routes/analytics.ts
  - apps/api/src/routes/webhooks.ts
  - apps/api/src/app.ts
  - apps/api/tests/integration/swagger.test.ts
autonomous: true
requirements: ["API-16"]
must_haves:
  truths:
    - "Every API-* and webhook endpoint from spec §6 is declared in Fastify with its full Zod request/response schemas (per D-25, D-26)"
    - "All non-/api/health handlers return reply.notImplemented() (501) with the canonical sensible error shape"
    - "Swagger UI at /api/docs lists every endpoint with its schema"
    - "DTO schemas live in packages/shared-types/src/api/*.ts and are imported by Fastify routes (D-27)"
    - "Zod-validated routes reject malformed bodies with 400 (covered by integration test)"
  artifacts:
    - path: "packages/shared-types/src/api/leads.ts"
      provides: "LeadSchema, LeadListQuerySchema, LeadPatchBodySchema, LeadMatchResponseSchema, LeadQuoteResponseSchema"
      exports: ["LeadSchema", "LeadListQuerySchema", "LeadPatchBodySchema"]
    - path: "packages/shared-types/src/api/orders.ts"
      provides: "OrderSchema, OrderListQuerySchema, OrderDetailSchema (incl. order_events), CreateOrderBodySchema, PriceOverrideBodySchema"
      exports: ["OrderSchema", "OrderListQuerySchema", "OrderDetailSchema"]
    - path: "packages/shared-types/src/api/trucks.ts"
      provides: "TruckSchema, TruckListQuerySchema, CreateTruckBodySchema, PatchTruckBodySchema"
      exports: ["TruckSchema", "CreateTruckBodySchema"]
    - path: "packages/shared-types/src/api/clients.ts"
      provides: "MessageSchema, ListMessagesQuerySchema"
      exports: ["MessageSchema"]
    - path: "packages/shared-types/src/api/analytics.ts"
      provides: "KpiResponseSchema"
      exports: ["KpiResponseSchema"]
    - path: "packages/shared-types/src/api/webhooks.ts"
      provides: "TelegramUpdateBodySchema, GpsPushBodySchema, VoiceCallbackBodySchema"
      exports: ["TelegramUpdateBodySchema", "GpsPushBodySchema", "VoiceCallbackBodySchema"]
    - path: "packages/shared-types/src/domain/enums.ts"
      provides: "Zod enums mirroring DB pgEnums — leadStage, orderStatus, etc."
      exports: ["LeadStage", "OrderStatus", "BodyType", "TruckStatus", "ClientLang"]
    - path: "apps/api/src/routes/leads.ts"
      provides: "GET /api/leads, PATCH /api/leads/:id, POST /api/leads/:id/match, POST /api/leads/:id/quote — all 501 stubs with full Zod schemas"
      exports: ["default (leadsRoutes)"]
  key_links:
    - from: "apps/api/src/routes/leads.ts"
      to: "packages/shared-types/src/api/leads.ts"
      via: "import LeadSchema etc."
      pattern: "from '@ai-logist/shared-types/api/leads'"
    - from: "apps/api/src/app.ts"
      to: "apps/api/src/routes/{leads,orders,trucks,clients,analytics,webhooks}.ts"
      via: "app.register() with prefix"
      pattern: "app\\.register\\(.*Routes"
---

<objective>
Wave 8 fulfills CONTEXT D-25: every API-* and webhook endpoint from spec §6 lands as a Fastify route with its FULL Zod request/response schema, with the handler stubbed at `reply.notImplemented()` (per D-25 + RESEARCH.md Pattern 7). DTOs live in `packages/shared-types` (D-27) so Phase 4 admin can `import { LeadSchema } from '@ai-logist/shared-types/api/leads'` without any new schema definitions.

This is the LARGEST plan in Phase 1 by file count (16 files) but the SIMPLEST by complexity — every route is the same shape: import schema → declare in Fastify route definition → `reply.notImplemented()` body.

Purpose: Close API-16 fully. Establish the schema contracts that Phase 2/3/4/5 swap into.

Output: 7 shared-types files (6 API + 1 domain barrel) + 6 route files + updated app.ts + integration test asserting Swagger lists every endpoint + Zod 400 rejection.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/01-database-backend-skeleton/01-CONTEXT.md
@.planning/phases/01-database-backend-skeleton/01-RESEARCH.md
@CLAUDE.md
@apps/api/src/app.ts
@apps/api/src/routes/health.ts
@packages/shared-types/src/api/health.ts
@packages/shared-types/src/index.ts
@apps/api/src/persistence/schema/_enums.ts
@ai-logist-logic-spec.md
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: shared-types DTO schemas — leads, orders, trucks, clients, analytics, webhooks, domain/enums</name>
  <read_first>
    - packages/shared-types/src/api/health.ts (Wave 7 — pattern reference for Zod v4 import + export type alias)
    - packages/shared-types/src/index.ts (Wave 7 — barrel)
    - apps/api/src/persistence/schema/_enums.ts (Wave 3a — pgEnum values to mirror in Zod)
    - ai-logist-logic-spec.md §2 (data model — source of truth for DTO shapes)
    - ai-logist-logic-spec.md §6 (REST + WebSocket endpoints — list of routes that need schemas)
    - .planning/phases/01-database-backend-skeleton/01-CONTEXT.md — D-25, D-27
  </read_first>
  <files>
    - packages/shared-types/src/domain/enums.ts
    - packages/shared-types/src/api/leads.ts
    - packages/shared-types/src/api/orders.ts
    - packages/shared-types/src/api/trucks.ts
    - packages/shared-types/src/api/clients.ts
    - packages/shared-types/src/api/analytics.ts
    - packages/shared-types/src/api/webhooks.ts
    - packages/shared-types/src/index.ts
  </files>
  <action>
    Eight files. All Zod v4 (`zod/v4` import path per Pitfall #4).

    **`packages/shared-types/src/domain/enums.ts`** — mirror DB pgEnum values so admin clients have type-safe enums:

    ```typescript
    import { z } from 'zod/v4';

    // Mirror of apps/api/src/persistence/schema/_enums.ts
    // KEEP IN SYNC.

    export const LeadStage = z.enum([
      'NEW',
      'QUALIFIED',
      'MATCHED',
      'QUOTED',
      'AGREED',
      'ORDER_CREATED',
      'IN_PROGRESS',
      'DONE',
      'LOST',
    ]);
    export type LeadStage = z.infer<typeof LeadStage>;

    export const OrderStatus = z.enum([
      'CREATED',
      'DRIVER_ASSIGNED',
      'AT_LOADING',
      'IN_TRANSIT',
      'AT_BORDER',
      'DELIVERED',
      'CLOSED',
    ]);
    export type OrderStatus = z.infer<typeof OrderStatus>;

    export const OrderEventType = z.enum([
      'created',
      'driver_assigned',
      'at_loading',
      'in_transit',
      'at_border',
      'delivered',
    ]);
    export type OrderEventType = z.infer<typeof OrderEventType>;

    export const BodyType = z.enum(['tent', 'ref', 'iso', 'container']);
    export type BodyType = z.infer<typeof BodyType>;

    export const TruckStatus = z.enum(['available', 'busy', 'maintenance']);
    export type TruckStatus = z.infer<typeof TruckStatus>;

    export const ClientLang = z.enum(['ru', 'ua']);
    export type ClientLang = z.infer<typeof ClientLang>;

    export const WebhookSource = z.enum(['telegram', 'voice', 'gps']);
    export type WebhookSource = z.infer<typeof WebhookSource>;
    ```

    **`packages/shared-types/src/api/leads.ts`** (covers /api/leads GET+PATCH, /api/leads/:id/match POST, /api/leads/:id/quote POST):

    ```typescript
    import { z } from 'zod/v4';
    import { BodyType, LeadStage } from '../domain/enums.js';

    export const LeadSchema = z.object({
      id: z.string().uuid(),
      clientId: z.string().uuid(),
      channel: z.enum(['telegram', 'call']),
      stage: LeadStage,
      fromCityId: z.string().uuid().nullable(),
      toCityId: z.string().uuid().nullable(),
      tons: z.string().nullable(), // numeric → string from pg
      bodyType: BodyType.nullable(),
      budget: z.string().nullable(), // bigint → string from pg
      volumeM3: z.string().nullable(),
      dimensionsLxwxh: z.string().nullable(),
      packaging: z.string().nullable(),
      adrClass: z.string().nullable(),
      declaredValue: z.string().nullable(),
      matchedTruckId: z.string().uuid().nullable(),
      quotedPrice: z.string().nullable(),
      orderId: z.string().uuid().nullable(),
      priceOverrides: z.array(z.unknown()).default([]),
      version: z.number().default(0),
      createdAt: z.string().datetime(),
      updatedAt: z.string().datetime(),
    });
    export type Lead = z.infer<typeof LeadSchema>;

    export const LeadListQuerySchema = z.object({
      stage: LeadStage.optional(),
      clientId: z.string().uuid().optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    });

    export const LeadPatchBodySchema = z.object({
      stage: LeadStage.optional(),
      matchedTruckId: z.string().uuid().nullable().optional(),
      quotedPrice: z.string().nullable().optional(),
      version: z.number().int(), // optimistic concurrency check
    });

    export const LeadMatchResponseSchema = z.object({
      lead: LeadSchema,
      matches: z.array(
        z.object({
          truckId: z.string().uuid(),
          name: z.string(),
          plateNumber: z.string(),
          capacityT: z.number(),
          distanceMeters: z.number(),
        })
      ),
    });

    export const LeadQuoteResponseSchema = z.object({
      lead: LeadSchema,
      quote: z.object({
        min: z.string(), // kopecks as string
        default: z.string(),
        max: z.string(),
        routeKm: z.string(),
      }),
    });
    ```

    **`packages/shared-types/src/api/orders.ts`** (covers /api/orders GET list+POST create, /api/orders/:id GET detail+timeline, /api/orders/:id/price-override POST):

    ```typescript
    import { z } from 'zod/v4';
    import { OrderStatus, OrderEventType } from '../domain/enums.js';

    export const OrderSchema = z.object({
      id: z.string().uuid(),
      number: z.string(),
      leadId: z.string().uuid().nullable(),
      clientId: z.string().uuid(),
      truckId: z.string().uuid().nullable(),
      fromCityId: z.string().uuid().nullable(),
      toCityId: z.string().uuid().nullable(),
      distanceKm: z.string().nullable(),
      price: z.string(), // bigint kopecks as string
      currency: z.string(),
      status: OrderStatus,
      publicToken: z.string(),
      version: z.number().default(0),
      createdAt: z.string().datetime(),
      updatedAt: z.string().datetime(),
    });
    export type Order = z.infer<typeof OrderSchema>;

    export const OrderEventSchema = z.object({
      id: z.string().uuid(),
      orderId: z.string().uuid(),
      type: OrderEventType,
      actor: z.string(),
      payload: z.record(z.string(), z.unknown()),
      geom: z.object({ lng: z.number(), lat: z.number() }).nullable(),
      createdAt: z.string().datetime(),
    });

    export const OrderListQuerySchema = z.object({
      status: OrderStatus.optional(),
      clientId: z.string().uuid().optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    });

    export const OrderDetailSchema = z.object({
      order: OrderSchema,
      events: z.array(OrderEventSchema),
    });

    export const CreateOrderBodySchema = z.object({
      leadId: z.string().uuid().optional(),
      clientId: z.string().uuid(),
      truckId: z.string().uuid().nullable(),
      fromCityId: z.string().uuid(),
      toCityId: z.string().uuid(),
      price: z.string(), // kopecks
      currency: z.string().default('RUB'),
    });

    export const PriceOverrideBodySchema = z.object({
      newPrice: z.string(), // kopecks
      reason: z.string().min(3), // mandatory per ADMIN-NEW-06
      version: z.number().int(),
    });
    ```

    **`packages/shared-types/src/api/trucks.ts`**:

    ```typescript
    import { z } from 'zod/v4';
    import { BodyType, TruckStatus } from '../domain/enums.js';

    export const TruckSchema = z.object({
      id: z.string().uuid(),
      name: z.string(),
      plateNumber: z.string(),
      driverName: z.string(),
      driverPhone: z.string(),
      driverTelegramId: z.string().nullable(),
      capacityT: z.number(),
      bodyType: BodyType,
      status: TruckStatus,
      geom: z.object({ lng: z.number(), lat: z.number() }),
      updatedAt: z.string().datetime(),
      createdAt: z.string().datetime(),
    });
    export type Truck = z.infer<typeof TruckSchema>;

    export const TruckListQuerySchema = z.object({
      status: TruckStatus.optional(),
      bodyType: BodyType.optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
    });

    export const CreateTruckBodySchema = z.object({
      name: z.string().min(1),
      plateNumber: z.string().min(1),
      driverName: z.string().min(1),
      driverPhone: z.string().min(1),
      driverTelegramId: z.string().optional(),
      capacityT: z.number().int().positive(),
      bodyType: BodyType,
      geom: z.object({ lng: z.number(), lat: z.number() }),
      status: TruckStatus.default('available'),
    });

    export const PatchTruckBodySchema = CreateTruckBodySchema.partial();
    ```

    **`packages/shared-types/src/api/clients.ts`**:

    ```typescript
    import { z } from 'zod/v4';

    export const MessageSchema = z.object({
      id: z.string().uuid(),
      clientId: z.string().uuid(),
      leadId: z.string().uuid().nullable(),
      role: z.enum(['client', 'ai', 'manager']),
      text: z.string(),
      createdAt: z.string().datetime(),
    });
    export type Message = z.infer<typeof MessageSchema>;

    export const ListMessagesQuerySchema = z.object({
      limit: z.coerce.number().int().min(1).max(500).default(100),
      offset: z.coerce.number().int().min(0).default(0),
    });
    ```

    **`packages/shared-types/src/api/analytics.ts`**:

    ```typescript
    import { z } from 'zod/v4';

    export const KpiResponseSchema = z.object({
      window: z.enum(['day', 'week', 'month']).default('week'),
      calls: z.object({
        total: z.number(),
        answered: z.number(),
      }),
      leads: z.object({
        total: z.number(),
        byStage: z.record(z.string(), z.number()),
      }),
      orders: z.object({
        created: z.number(),
        delivered: z.number(),
      }),
      revenue: z.object({
        amount: z.string(), // kopecks
        currency: z.string(),
      }),
    });
    export type KpiResponse = z.infer<typeof KpiResponseSchema>;
    ```

    **`packages/shared-types/src/api/webhooks.ts`** (loose schemas — Telegram + voice + gps payloads validated coarsely; Phase 3/5 tighten):

    ```typescript
    import { z } from 'zod/v4';

    // Telegram Update — we accept any shape and key on update_id (DB-09 idempotency)
    export const TelegramUpdateBodySchema = z
      .object({
        update_id: z.number().int(),
      })
      .passthrough();

    export const GpsPushBodySchema = z.object({
      truckId: z.string().uuid(),
      lng: z.number(),
      lat: z.number(),
      recordedAt: z.string().datetime(),
    });

    export const VoiceCallbackBodySchema = z
      .object({
        call_id: z.string(),
        event: z.string(),
      })
      .passthrough();

    export const WebhookAckResponseSchema = z.object({
      ok: z.boolean(),
    });
    ```

    Update `packages/shared-types/src/index.ts`:

    ```typescript
    // @ai-logist/shared-types — Phase 1
    export const SHARED_TYPES_VERSION = '0.0.0';

    export * from './api/health.js';
    export * from './api/leads.js';
    export * from './api/orders.js';
    export * from './api/trucks.js';
    export * from './api/clients.js';
    export * from './api/analytics.js';
    export * from './api/webhooks.js';
    export * from './domain/enums.js';
    ```

    Rebuild: `pnpm --filter @ai-logist/shared-types build`. Verify `dist/api/leads.js` etc. all exist.

    Verify TS + Biome.
  </action>
  <verify>
    <automated>for f in domain/enums api/leads api/orders api/trucks api/clients api/analytics api/webhooks; do test -f "packages/shared-types/src/$f.ts" || { echo MISSING:$f; exit 1; }; done && pnpm --filter @ai-logist/shared-types build 2>&1 | tail -3 && for f in domain/enums api/leads api/orders api/trucks api/clients api/analytics api/webhooks; do test -f "packages/shared-types/dist/$f.js" || { echo MISSING_DIST:$f; exit 1; }; done && pnpm exec tsc --noEmit -p apps/api/tsconfig.json 2>&1 | tail -3 && pnpm exec biome check packages/shared-types/src 2>&1 | tail -3 && echo OK</automated>
  </verify>
  <done>
    7 new shared-types source files + dist artifacts; all use `zod/v4`; TS strict + Biome clean; barrel re-exports all modules.
  </done>
  <acceptance_criteria>
    - All 7 source files exist (domain/enums + 6 api/ files)
    - All 7 dist files exist after build
    - `grep -l "zod/v4" packages/shared-types/src/api/*.ts packages/shared-types/src/domain/*.ts | wc -l` is at least 7
    - `grep -q "LeadSchema\\|OrderSchema\\|TruckSchema\\|MessageSchema\\|KpiResponseSchema" packages/shared-types/src/index.ts` returns 0 — barrel re-exports
    - `grep -q "LeadStage\\|OrderStatus\\|BodyType\\|TruckStatus" packages/shared-types/src/domain/enums.ts` returns 0
    - `pnpm exec tsc --noEmit -p apps/api/tsconfig.json` exits 0
    - `pnpm exec biome check packages/shared-types/src` exits 0
    - `pnpm --filter @ai-logist/shared-types build` exits 0
  </acceptance_criteria>
</task>

<task type="auto" tdd="false">
  <name>Task 2: 6 Fastify 501-stub route files + register in app.ts + integration test for Swagger + Zod 400</name>
  <read_first>
    - apps/api/src/app.ts (Wave 7 — register pattern)
    - apps/api/src/routes/health.ts (Wave 7 — Fastify+Zod pattern reference)
    - packages/shared-types/src/api/* (Task 1 above — schemas to import)
    - .planning/phases/01-database-backend-skeleton/01-RESEARCH.md — section "501-stub example (`/api/leads`)" — Pattern 7
    - .planning/phases/01-database-backend-skeleton/01-CONTEXT.md — D-25
    - ai-logist-logic-spec.md §6 (full endpoint list)
  </read_first>
  <files>
    - apps/api/src/routes/leads.ts
    - apps/api/src/routes/orders.ts
    - apps/api/src/routes/trucks.ts
    - apps/api/src/routes/clients.ts
    - apps/api/src/routes/analytics.ts
    - apps/api/src/routes/webhooks.ts
    - apps/api/src/app.ts
    - apps/api/tests/integration/swagger.test.ts
  </files>
  <action>
    Six route files + app.ts update + one integration test.

    Shared shape for 501 stub (used everywhere):

    ```typescript
    const NotImplementedSchema = z.object({
      statusCode: z.number(),
      error: z.string(),
      message: z.string(),
    });
    ```

    **`apps/api/src/routes/leads.ts`** (per RESEARCH.md §"501-stub example" + spec §6):

    ```typescript
    import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
    import { z } from 'zod/v4';
    import {
      LeadListQuerySchema,
      LeadPatchBodySchema,
      LeadMatchResponseSchema,
      LeadQuoteResponseSchema,
    } from '@ai-logist/shared-types/api/leads';

    const NotImpl = z.object({
      statusCode: z.number(),
      error: z.string(),
      message: z.string(),
    });

    const leadsRoutes: FastifyPluginAsyncZod = async (app) => {
      app.get(
        '/leads',
        {
          schema: {
            tags: ['leads'],
            summary: 'List leads (Phase 4)',
            querystring: LeadListQuerySchema,
            response: { 501: NotImpl },
          },
        },
        async (_req, reply) => reply.notImplemented('Phase 4 — admin web')
      );

      app.patch(
        '/leads/:id',
        {
          schema: {
            tags: ['leads'],
            summary: 'Update lead stage (Phase 4)',
            params: z.object({ id: z.string().uuid() }),
            body: LeadPatchBodySchema,
            response: { 501: NotImpl },
          },
        },
        async (_req, reply) => reply.notImplemented('Phase 4 — admin web')
      );

      app.post(
        '/leads/:id/match',
        {
          schema: {
            tags: ['leads'],
            summary: 'Re-run truck matching (Phase 2)',
            params: z.object({ id: z.string().uuid() }),
            response: { 200: LeadMatchResponseSchema, 501: NotImpl },
          },
        },
        async (_req, reply) => reply.notImplemented('Phase 2 — nearestTruck')
      );

      app.post(
        '/leads/:id/quote',
        {
          schema: {
            tags: ['leads'],
            summary: 'Re-run price calculation (Phase 2)',
            params: z.object({ id: z.string().uuid() }),
            response: { 200: LeadQuoteResponseSchema, 501: NotImpl },
          },
        },
        async (_req, reply) => reply.notImplemented('Phase 2 — calcPrice')
      );
    };

    export default leadsRoutes;
    ```

    **`apps/api/src/routes/orders.ts`**:

    ```typescript
    import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
    import { z } from 'zod/v4';
    import {
      OrderListQuerySchema,
      OrderDetailSchema,
      CreateOrderBodySchema,
      OrderSchema,
      PriceOverrideBodySchema,
    } from '@ai-logist/shared-types/api/orders';

    const NotImpl = z.object({
      statusCode: z.number(),
      error: z.string(),
      message: z.string(),
    });

    const ordersRoutes: FastifyPluginAsyncZod = async (app) => {
      app.get(
        '/orders',
        {
          schema: {
            tags: ['orders'],
            summary: 'List orders (Phase 4)',
            querystring: OrderListQuerySchema,
            response: { 501: NotImpl },
          },
        },
        async (_req, reply) => reply.notImplemented('Phase 4 — admin web')
      );

      app.get(
        '/orders/:id',
        {
          schema: {
            tags: ['orders'],
            summary: 'Order detail + events timeline (Phase 4)',
            params: z.object({ id: z.string().uuid() }),
            response: { 200: OrderDetailSchema, 501: NotImpl },
          },
        },
        async (_req, reply) => reply.notImplemented('Phase 4 — admin web')
      );

      app.post(
        '/orders',
        {
          schema: {
            tags: ['orders'],
            summary: 'Manual order creation (Phase 4)',
            body: CreateOrderBodySchema,
            response: { 201: OrderSchema, 501: NotImpl },
          },
        },
        async (_req, reply) => reply.notImplemented('Phase 4 — admin web')
      );

      app.post(
        '/orders/:id/price-override',
        {
          schema: {
            tags: ['orders'],
            summary: 'Price override with audit (Phase 4 / ADMIN-NEW-06)',
            params: z.object({ id: z.string().uuid() }),
            body: PriceOverrideBodySchema,
            response: { 200: OrderSchema, 501: NotImpl },
          },
        },
        async (_req, reply) => reply.notImplemented('Phase 4 — ADMIN-NEW-06')
      );
    };

    export default ordersRoutes;
    ```

    **`apps/api/src/routes/trucks.ts`**:

    ```typescript
    import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
    import { z } from 'zod/v4';
    import {
      TruckSchema,
      TruckListQuerySchema,
      CreateTruckBodySchema,
      PatchTruckBodySchema,
    } from '@ai-logist/shared-types/api/trucks';

    const NotImpl = z.object({
      statusCode: z.number(),
      error: z.string(),
      message: z.string(),
    });

    const trucksRoutes: FastifyPluginAsyncZod = async (app) => {
      app.get(
        '/trucks',
        {
          schema: {
            tags: ['trucks'],
            summary: 'List fleet (Phase 4 ADMIN-NEW-01)',
            querystring: TruckListQuerySchema,
            response: { 501: NotImpl },
          },
        },
        async (_req, reply) => reply.notImplemented('Phase 4 — admin web')
      );

      app.post(
        '/trucks',
        {
          schema: {
            tags: ['trucks'],
            summary: 'Add truck (Phase 4)',
            body: CreateTruckBodySchema,
            response: { 201: TruckSchema, 501: NotImpl },
          },
        },
        async (_req, reply) => reply.notImplemented('Phase 4 — admin web')
      );

      app.patch(
        '/trucks/:id',
        {
          schema: {
            tags: ['trucks'],
            summary: 'Update truck (Phase 4)',
            params: z.object({ id: z.string().uuid() }),
            body: PatchTruckBodySchema,
            response: { 200: TruckSchema, 501: NotImpl },
          },
        },
        async (_req, reply) => reply.notImplemented('Phase 4 — admin web')
      );
    };

    export default trucksRoutes;
    ```

    **`apps/api/src/routes/clients.ts`**:

    ```typescript
    import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
    import { z } from 'zod/v4';
    import { MessageSchema, ListMessagesQuerySchema } from '@ai-logist/shared-types/api/clients';

    const NotImpl = z.object({
      statusCode: z.number(),
      error: z.string(),
      message: z.string(),
    });

    const clientsRoutes: FastifyPluginAsyncZod = async (app) => {
      app.get(
        '/clients/:id/messages',
        {
          schema: {
            tags: ['clients'],
            summary: 'Client message history (Phase 4 ADMIN-03)',
            params: z.object({ id: z.string().uuid() }),
            querystring: ListMessagesQuerySchema,
            response: { 200: z.array(MessageSchema), 501: NotImpl },
          },
        },
        async (_req, reply) => reply.notImplemented('Phase 4 — admin chat')
      );
    };

    export default clientsRoutes;
    ```

    **`apps/api/src/routes/analytics.ts`**:

    ```typescript
    import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
    import { z } from 'zod/v4';
    import { KpiResponseSchema } from '@ai-logist/shared-types/api/analytics';

    const NotImpl = z.object({
      statusCode: z.number(),
      error: z.string(),
      message: z.string(),
    });

    const analyticsRoutes: FastifyPluginAsyncZod = async (app) => {
      app.get(
        '/analytics/kpi',
        {
          schema: {
            tags: ['analytics'],
            summary: 'KPI for dashboards (Phase 4 ADMIN-05)',
            querystring: z.object({ window: z.enum(['day', 'week', 'month']).default('week') }),
            response: { 200: KpiResponseSchema, 501: NotImpl },
          },
        },
        async (_req, reply) => reply.notImplemented('Phase 4 — admin analytics')
      );
    };

    export default analyticsRoutes;
    ```

    **`apps/api/src/routes/webhooks.ts`** (mounted with prefix `/webhook` not `/api`):

    ```typescript
    import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
    import { z } from 'zod/v4';
    import {
      TelegramUpdateBodySchema,
      GpsPushBodySchema,
      VoiceCallbackBodySchema,
      WebhookAckResponseSchema,
    } from '@ai-logist/shared-types/api/webhooks';

    const NotImpl = z.object({
      statusCode: z.number(),
      error: z.string(),
      message: z.string(),
    });

    const webhooksRoutes: FastifyPluginAsyncZod = async (app) => {
      app.post(
        '/telegram',
        {
          schema: {
            tags: ['webhooks'],
            summary: 'Telegram webhook (Phase 3 TG-01/TG-02)',
            body: TelegramUpdateBodySchema,
            response: { 200: WebhookAckResponseSchema, 501: NotImpl },
          },
        },
        async (_req, reply) => reply.notImplemented('Phase 3 — Telegram')
      );

      app.post(
        '/voice',
        {
          schema: {
            tags: ['webhooks'],
            summary: 'Voice callback (Phase 3 API-15 stub returns 200)',
            body: VoiceCallbackBodySchema,
            response: { 200: WebhookAckResponseSchema, 501: NotImpl },
          },
        },
        async (_req, reply) => reply.notImplemented('Phase 3 — voice callback stub')
      );

      app.post(
        '/gps',
        {
          schema: {
            tags: ['webhooks'],
            summary: 'GPS position push (Phase 5 API-14)',
            body: GpsPushBodySchema,
            response: { 200: WebhookAckResponseSchema, 501: NotImpl },
          },
        },
        async (_req, reply) => reply.notImplemented('Phase 5 — GPS push')
      );
    };

    export default webhooksRoutes;
    ```

    Update `apps/api/src/app.ts` — add imports + register calls. Edit (do not rewrite — preserve everything from Wave 7):

    Add imports near other route imports:
    ```typescript
    import leadsRoutes from './routes/leads.js';
    import ordersRoutes from './routes/orders.js';
    import trucksRoutes from './routes/trucks.js';
    import clientsRoutes from './routes/clients.js';
    import analyticsRoutes from './routes/analytics.js';
    import webhooksRoutes from './routes/webhooks.js';
    ```

    Add registrations after `await app.register(healthRoutes, { prefix: '/api' });`:
    ```typescript
    await app.register(leadsRoutes, { prefix: '/api' });
    await app.register(ordersRoutes, { prefix: '/api' });
    await app.register(trucksRoutes, { prefix: '/api' });
    await app.register(clientsRoutes, { prefix: '/api' });
    await app.register(analyticsRoutes, { prefix: '/api' });
    await app.register(webhooksRoutes, { prefix: '/webhook' });
    ```

    **Integration test** — `apps/api/tests/integration/swagger.test.ts`:

    ```typescript
    import { afterAll, beforeAll, describe, expect, test } from 'vitest';
    import path from 'node:path';
    import { exec as execCb } from 'node:child_process';
    import { promisify } from 'node:util';
    import { startPostgisContainer, stopPostgisContainer } from '../_helpers/test-db.js';

    const exec = promisify(execCb);

    describe('Swagger / OpenAPI surface + Zod 400 (integration)', () => {
      let dbUrl: string;
      let app: import('fastify').FastifyInstance;

      beforeAll(async () => {
        dbUrl = await startPostgisContainer();
        process.env.DATABASE_URL = dbUrl;
        process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

        await exec(
          `node --import tsx ./node_modules/.bin/drizzle-kit migrate`,
          {
            cwd: path.resolve(import.meta.dirname, '..', '..'),
            env: { ...process.env, DATABASE_URL: dbUrl },
          }
        );

        const { buildApp } = await import('../../src/app.js');
        app = await buildApp();
      }, 90_000);

      afterAll(async () => {
        if (app) await app.close();
        await stopPostgisContainer();
      });

      test('Swagger lists all key endpoints (leads, orders, trucks, clients, analytics, webhooks)', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/docs/json' });
        // swagger-ui mounts JSON at /api/docs/json
        if (res.statusCode === 404) {
          // Some swagger-ui versions expose at /api/docs/openapi.json
          const alt = await app.inject({ method: 'GET', url: '/api/docs/openapi.json' });
          expect(alt.statusCode).toBe(200);
          const paths = Object.keys(alt.json().paths ?? {});
          expect(paths).toEqual(expect.arrayContaining(['/api/health', '/api/leads']));
          return;
        }
        expect(res.statusCode).toBe(200);
        const paths = Object.keys(res.json().paths ?? {});
        expect(paths).toEqual(
          expect.arrayContaining([
            '/api/health',
            '/api/leads',
            '/api/orders',
            '/api/trucks',
            '/api/clients/{id}/messages',
            '/api/analytics/kpi',
            '/webhook/telegram',
            '/webhook/voice',
            '/webhook/gps',
          ])
        );
      });

      test('API-16: GET /api/leads with malformed query (limit=abc) returns 400 via Zod validator', async () => {
        const res = await app.inject({
          method: 'GET',
          url: '/api/leads?limit=abc',
        });
        expect(res.statusCode).toBe(400);
      });

      test('501 stubs return reply.notImplemented for GET /api/leads', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/leads' });
        expect(res.statusCode).toBe(501);
        const body = res.json();
        expect(body.statusCode).toBe(501);
      });
    });
    ```

    Verify by running the integration test (requires Docker). If Docker isn't available, document that the test will execute when run in CI/dev with Docker up.

    NOTE on Swagger JSON path: `@fastify/swagger-ui` 5.x typically exposes the OpenAPI JSON at `/api/docs/json` when `routePrefix: '/api/docs'`. The test falls back to `/api/docs/openapi.json` if needed.
  </action>
  <verify>
    <automated>for f in leads orders trucks clients analytics webhooks; do test -f "apps/api/src/routes/$f.ts" || { echo MISSING:$f; exit 1; }; done && test -f apps/api/tests/integration/swagger.test.ts && grep -q "leadsRoutes\\|ordersRoutes\\|trucksRoutes\\|clientsRoutes\\|analyticsRoutes\\|webhooksRoutes" apps/api/src/app.ts && grep -c "register(.*Routes" apps/api/src/app.ts | xargs -I {} test {} -ge 7 && grep -rq "reply.notImplemented" apps/api/src/routes && pnpm exec tsc --noEmit -p apps/api/tsconfig.json 2>&1 | tail -3 && pnpm exec biome check apps/api/src/routes 2>&1 | tail -3 && pnpm db:migrate 2>&1 | tail -3 && pnpm --filter @ai-logist/api dev &>/tmp/api.log & DEV_PID=$!; sleep 5 && curl -s -o /tmp/leads.json -w "%{http_code}" "http://localhost:3000/api/leads?limit=abc" | grep -q 400; rc=$?; curl -s -o /tmp/leads2.json -w "%{http_code}" "http://localhost:3000/api/leads" | grep -q 501; rc2=$?; curl -s "http://localhost:3000/api/docs/json" -o /tmp/docs.json -w "%{http_code}" | grep -q 200 || curl -s "http://localhost:3000/api/docs/openapi.json" -o /tmp/docs.json -w "%{http_code}" | grep -q 200; rc3=$?; kill $DEV_PID 2>/dev/null; test $rc -eq 0 && test $rc2 -eq 0 && test $rc3 -eq 0 && echo OK</automated>
  </verify>
  <done>
    All 6 route files exist with reply.notImplemented bodies + full Zod schemas; app.ts registers all 7 route plugins; live API on localhost:3000 returns 400 for malformed Zod input and 501 for stubs; Swagger UI exposes OpenAPI JSON listing all endpoints.
  </done>
  <acceptance_criteria>
    - All 6 route files + integration test exist
    - `grep -rq "reply.notImplemented" apps/api/src/routes` returns 0
    - `grep -c "register(.*Routes" apps/api/src/app.ts` is at least 7 (health + 5 api routes + webhooks)
    - `grep -q "@ai-logist/shared-types/api/leads" apps/api/src/routes/leads.ts` returns 0 (cross-package import works)
    - `grep -q "@ai-logist/shared-types/api/orders" apps/api/src/routes/orders.ts` returns 0
    - `pnpm exec tsc --noEmit -p apps/api/tsconfig.json` exits 0
    - `pnpm exec biome check apps/api/src/routes` exits 0
    - Live smoke (with Docker up): `curl -s -w '%{http_code}' 'http://localhost:3000/api/leads?limit=abc'` returns 400 (Zod rejects)
    - Live smoke: `curl -s -w '%{http_code}' 'http://localhost:3000/api/leads'` returns 501 (sensible notImplemented)
    - Live smoke: `curl -s 'http://localhost:3000/api/docs/json'` OR `curl -s 'http://localhost:3000/api/docs/openapi.json'` returns OpenAPI JSON with /api/leads, /api/orders, /api/trucks, /api/clients/{id}/messages, /api/analytics/kpi, /webhook/telegram, /webhook/voice, /webhook/gps paths
  </acceptance_criteria>
</task>

</tasks>

<verification>
- `pnpm exec tsc --noEmit -p apps/api/tsconfig.json` passes
- `pnpm exec biome check .` passes
- `pnpm --filter @ai-logist/shared-types build` succeeds
- Live API: `curl http://localhost:3000/api/health` returns 200; `curl http://localhost:3000/api/leads?limit=abc` returns 400; `curl http://localhost:3000/api/leads` returns 501; `/api/docs` Swagger UI lists every endpoint
- `cd apps/api && pnpm exec vitest run` runs unit + integration; integration tests use testcontainers (need Docker)
</verification>

<success_criteria>
1. Every API-* endpoint from spec §6 is declared in Fastify with FULL Zod schema (per D-25, D-26).
2. Every stub returns `reply.notImplemented()` per RESEARCH.md Pattern 7.
3. DTO schemas in `packages/shared-types/src/api/*.ts` are usable from both `apps/api` (validation) AND `apps/web` (Phase 4 typed fetch) per D-27.
4. Swagger UI at `/api/docs` lists every endpoint with its Zod-derived OpenAPI schema.
5. Zod 400 rejection works (integration test asserts /api/leads?limit=abc → 400).
6. 501 sensible response shape is preserved per Pattern 7 (statusCode, error, message).
</success_criteria>

<output>
After completion, create `.planning/phases/01-database-backend-skeleton/01-08-SUMMARY.md` documenting:
- Number of routes registered (should be at least 13: 1 health + 4 leads + 4 orders + 3 trucks + 1 clients/messages + 1 analytics + 3 webhooks = 17 routes)
- Swagger JSON path that actually worked (`/api/docs/json` vs `/api/docs/openapi.json`)
- Live curl outputs (sample 400 and 501 responses)
- Integration test count (swagger.test.ts + health.test.ts)
- Confirmation that Phase 4 can import every DTO from `@ai-logist/shared-types/api/*` without further schema work
</output>
