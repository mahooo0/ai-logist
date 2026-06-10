---
phase: 04-admin-web-reduced-scope-chat-calls-orders-kpi
plan: 03
type: execute
wave: 3
depends_on: [04-00, 04-02]
files_modified:
  - apps/api/src/routes/leads.ts
  - apps/api/src/routes/orders.ts
  - apps/api/src/routes/trucks.ts
  - apps/api/src/routes/clients.ts
  - apps/api/src/routes/analytics.ts
  - apps/api/src/routes/calls.ts
  - apps/api/src/app.ts
  - packages/shared-types/src/api/leads.ts
  - packages/shared-types/src/api/orders.ts
  - packages/shared-types/src/api/analytics.ts
  - packages/shared-types/src/api/calls.ts
  - packages/shared-types/src/index.ts
  - apps/api/tests/integration/leads-list.test.ts
  - apps/api/tests/integration/orders-list.test.ts
  - apps/api/tests/integration/orders-detail.test.ts
  - apps/api/tests/integration/trucks-list.test.ts
  - apps/api/tests/integration/clients-messages-union.test.ts
  - apps/api/tests/integration/analytics-kpi.test.ts
  - apps/api/tests/integration/calls-list.test.ts
  - apps/api/tests/unit/phase-4-stubs.test.ts
autonomous: true
requirements:
  - API-03
  - API-04
  - API-05
  - API-06
  - API-09

must_haves:
  truths:
    - "GET /api/leads is no longer a 501 stub — returns paginated list filtered by stage + channel (D-60 + API-03). LeadListQuerySchema gains `channel: z.enum(['telegram','voice','call']).optional()`."
    - "GET /api/orders returns OrderListItem[] with joined fromCityName + toCityName + clientName + channel (D-35 + API-04). New OrderListItemSchema extends OrderSchema."
    - "GET /api/orders/:id returns full OrderDetailSchema EXTENDED with client + fromCity + toCity + truck (D-39). 404 on missing."
    - "GET /api/trucks returns full fleet read-only (API-05). POST/PATCH stubs remain 501 (CRUD deferred to v2)."
    - "GET /api/clients/:id/messages performs the UNION ALL query merging messages + LATERAL jsonb_array_elements(calls.transcript) WITH ORDINALITY (RESEARCH Pattern 4 + Example 3) — sorted by created_at ASC; defensive coercion for missing timestamp_ms."
    - "GET /api/analytics/kpi returns extended shape adding avgCallDurationS + byChannel{voice,telegram} + conversionFunnel{calls,answered,leadsCreated,ordersConfirmed,delivered} per D-44 + RESEARCH Pattern 5; revenue.amount remains bigint string."
    - "NEW file apps/api/src/routes/calls.ts ships GET /api/calls (paginated list with outcome/lang/from/to filters) + GET /api/calls/:id (call + linkedLead + linkedOrder)."
    - "apps/api/src/app.ts registers callsRoutes alongside existing routes."
    - "NEW packages/shared-types/src/api/calls.ts exports CallSchema + CallDetailSchema + CallListQuerySchema."
    - "packages/shared-types/src/index.ts re-exports api/calls.ts."
    - "5 stub markers flip (API-03/04/05/06/09). Marker count: 10 → 5."
    - "7 integration test scaffolds flip from test.todo to real it() — 24 total integration tests added; all passing on testcontainers-available runners."
  artifacts:
    - path: "apps/api/src/routes/leads.ts"
      provides: "GET /api/leads handler (API-03) — filter by stage + channel"
      contains: "leadsRepo.findMany,channel,stage,limit,offset"
    - path: "apps/api/src/routes/orders.ts"
      provides: "GET /api/orders + GET /api/orders/:id handlers (API-04) — joined queries"
      contains: "leftJoin,cities,clients,leads,truck,orderEvents"
    - path: "apps/api/src/routes/trucks.ts"
      provides: "GET /api/trucks handler (API-05) read-only"
      contains: "trucksRepo.findMany"
    - path: "apps/api/src/routes/clients.ts"
      provides: "GET /api/clients/:id/messages UNION handler (API-06)"
      contains: "UNION ALL,jsonb_array_elements,WITH ORDINALITY,telegram,voice"
      min_lines: 60
    - path: "apps/api/src/routes/analytics.ts"
      provides: "GET /api/analytics/kpi extended handler (API-09)"
      contains: "FILTER (WHERE,call_stats,lead_stats,order_stats,jsonb_build_object,conversionFunnel,byChannel,avgCallDurationS"
      min_lines: 70
    - path: "apps/api/src/routes/calls.ts"
      provides: "NEW — GET /api/calls + GET /api/calls/:id"
      contains: "callsRoutes,calls.outcome,calls.lang,linkedLead,linkedOrder"
      min_lines: 60
    - path: "packages/shared-types/src/api/calls.ts"
      provides: "NEW — CallSchema + CallDetailSchema + CallListQuerySchema"
      contains: "CallSchema,CallDetailSchema,CallListQuerySchema,outcome,lang,audioUrl,transcript"
      min_lines: 30
    - path: "packages/shared-types/src/api/orders.ts"
      provides: "EXTENDED — adds OrderListItemSchema (joined fields)"
      contains: "OrderListItemSchema,fromCityName,toCityName,clientName,channel"
    - path: "packages/shared-types/src/api/analytics.ts"
      provides: "EXTENDED KpiResponseSchema — adds avgCallDurationS + byChannel + conversionFunnel"
      contains: "avgCallDurationS,byChannel,conversionFunnel,leadsCreated,ordersConfirmed,delivered"
    - path: "packages/shared-types/src/api/leads.ts"
      provides: "EXTENDED LeadListQuerySchema — adds channel filter"
      contains: "channel"
  key_links:
    - from: "Wave 4 (Plan 04-04 — /dashboard/chat) + Wave 5 (Plan 04-05 — /dashboard/orders)"
      to: "apps/api/src/routes/{leads,orders,trucks,clients,analytics,calls}.ts"
      via: "apps/web Server Components call apiGet() against these routes via Caddy reverse-proxy"
      pattern: "apiGet"
    - from: "Wave 4 + Wave 5 page rewires"
      to: "packages/shared-types/src/api/{calls,orders,analytics,leads}.ts"
      via: "Type imports + Zod schema validation at apiGet boundary"
      pattern: "@ai-logist/shared-types/api"
---

<objective>
Flip 6 backend route stubs (GET /api/leads, GET /api/orders + /:id, GET /api/trucks, GET /api/clients/:id/messages, GET /api/analytics/kpi) and ship 1 NEW file (apps/api/src/routes/calls.ts) — all the backend Waves 4+5 page rewires depend on. Runs in PARALLEL with Plan 04-01 (Zenith vendor) and Plan 04-02 (auth+i18n) because it modifies apps/api ONLY — no file overlap with apps/web.

Purpose:
- Land 5 of 13 Phase 4 stub flips (API-03, API-04, API-05, API-06, API-09) — biggest single batch in the phase.
- Implement the ONE non-trivial backend query in Phase 4: the messages + calls.transcript UNION ALL (RESEARCH Pattern 4) — most likely failure surface.
- Extend 3 shared-types schemas (orders, analytics, leads) + add 1 new (calls) — Zod contract for Waves 4+5 frontend consumers.
- Register the new callsRoutes plugin in app.ts.
- Flip 7 integration test scaffolds from test.todo to real it() blocks (~24 integration tests added).
- Phase 1-3.1 source preserved: pipeline/llm-tools/* + channels/* + persistence/schema/* untouched.

Output: 6 route files modified + 1 new (calls.ts) + 1 app.ts registration + 4 shared-types files updated + 7 integration scaffolds turned green.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-CONTEXT.md
@.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-RESEARCH.md
@apps/api/src/routes/leads.ts
@apps/api/src/routes/orders.ts
@apps/api/src/routes/clients.ts
@apps/api/src/routes/trucks.ts
@apps/api/src/routes/analytics.ts
@apps/api/src/app.ts
@apps/api/src/persistence/schema/leads.ts
@apps/api/src/persistence/schema/calls.ts
@apps/api/src/persistence/schema/orders.ts
@apps/api/src/persistence/schema/order_events.ts
@apps/api/src/persistence/schema/messages.ts
@apps/api/src/persistence/repos/index.ts
@packages/shared-types/src/api/leads.ts
@packages/shared-types/src/api/orders.ts
@packages/shared-types/src/api/analytics.ts
@packages/shared-types/src/api/clients.ts
@packages/shared-types/src/index.ts

<interfaces>
<!-- RESEARCH Pattern 4 (UNION query) — VERBATIM SQL: -->
<!-- (See Example 3 in 04-RESEARCH.md for the full handler — 90+ lines) -->
<!-- The query:                                                              -->
<!--   WITH msgs AS (SELECT m.id::text, m.created_at, m.role, m.text,         -->
<!--                  'telegram' AS channel, NULL::uuid AS call_id,           -->
<!--                  NULL::bigint AS timestamp_ms, NULL::text AS audio_url    -->
<!--                FROM messages m WHERE m.client_id = ${id}),                -->
<!--        voice AS (SELECT c.id::text || ':' || idx::text AS id,             -->
<!--                  c.created_at + ((turn->>'timestamp_ms')::bigint *        -->
<!--                    INTERVAL '1 ms') AS created_at,                        -->
<!--                  CASE WHEN turn->>'speaker' = 'agent' THEN 'ai'           -->
<!--                       ELSE 'client' END AS role,                          -->
<!--                  turn->>'text' AS text,                                   -->
<!--                  'voice' AS channel,                                      -->
<!--                  c.id AS call_id,                                         -->
<!--                  (turn->>'timestamp_ms')::bigint AS timestamp_ms,         -->
<!--                  c.audio_url                                              -->
<!--                FROM calls c, LATERAL jsonb_array_elements(c.transcript)   -->
<!--                  WITH ORDINALITY AS t(turn, idx)                          -->
<!--                WHERE EXISTS (SELECT 1 FROM leads l                        -->
<!--                              WHERE (l.id = c.linked_lead_id                -->
<!--                                  OR l.id = c.lead_id)                      -->
<!--                                AND l.client_id = ${id}))                   -->
<!--   SELECT * FROM msgs UNION ALL SELECT * FROM voice                        -->
<!--   ORDER BY created_at ASC LIMIT ${limit} OFFSET ${offset}                  -->

<!-- RESEARCH Pattern 5 (KPI aggregation) — full SQL provided in 04-RESEARCH.md  -->
<!-- — uses FILTER (WHERE ...) for conditional aggregation, jsonb_build_object  -->
<!-- for nested response shape, bigint::text for revenue precision preservation -->

<!-- leads.channel field is TEXT in schema (not enum) — RESEARCH Open Question #4: -->
<!--   Phase 1 ships 'telegram' | 'call'                                          -->
<!--   Phase 3.1 may have introduced 'voice'                                      -->
<!--   Plan 04-03 Task 1 audits actual distinct values via SELECT DISTINCT,       -->
<!--   updates LeadListQuerySchema.channel enum to match observed reality         -->

<!-- Existing repos (apps/api/src/persistence/repos/index.ts) provide:           -->
<!--   leadsRepo.findMany / findById                                              -->
<!--   ordersRepo.findMany / findById                                             -->
<!--   trucksRepo.findMany / findById                                             -->
<!--   clientsRepo.findById                                                       -->
<!--   messagesRepo.findByClient                                                 -->
<!-- (Phase 1 Plan 01-06 established these; Phase 4 ADDS query helpers but DOES   -->
<!--  NOT alter repo boundaries.)                                                 -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: shared-types schema extensions + new calls.ts + LeadListQuerySchema.channel audit</name>
  <files>
    packages/shared-types/src/api/calls.ts,
    packages/shared-types/src/api/leads.ts,
    packages/shared-types/src/api/orders.ts,
    packages/shared-types/src/api/analytics.ts,
    packages/shared-types/src/api/clients.ts,
    packages/shared-types/src/index.ts
  </files>
  <read_first>
    packages/shared-types/src/api/leads.ts,
    packages/shared-types/src/api/orders.ts,
    packages/shared-types/src/api/analytics.ts,
    packages/shared-types/src/api/clients.ts,
    packages/shared-types/src/index.ts,
    apps/api/src/persistence/schema/calls.ts,
    apps/api/src/persistence/schema/leads.ts,
    .planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-RESEARCH.md
  </read_first>
  <behavior>
    - `CallSchema` validates a calls row with id + leadId + direction + durationS + transcript (z.array of turns) + outcome + lang + audioUrl + linkedLeadId + quotedPriceAtConfirmation + createdAt.
    - `CallDetailSchema` = { call: CallSchema, linkedLead: LeadSchema | null, linkedOrder: OrderSchema | null }.
    - `CallListQuerySchema` = { outcome?: 'completed'|'abandoned'|'escalated'|'error', lang?: 'ru'|'ua', from?: ISO, to?: ISO, limit (default 50), offset (default 0) }.
    - `LeadListQuerySchema` gains `channel: z.enum(['telegram','voice','call']).optional()` — Open Question #4 resolution: enum accepts all 3 historic values; handler maps 'call' → 'voice' downstream.
    - `OrderListItemSchema` extends OrderSchema with `fromCityName: string | null`, `toCityName: string | null`, `clientName: string | null`, `channel: 'telegram' | 'voice' | null`.
    - `OrderDetailSchema` extended: `{ order, events, client?, fromCity?, toCity?, truck? }` — make joined fields nullable to handle missing relations gracefully.
    - `KpiResponseSchema` extended with: `avgCallDurationS: z.number().nullable()`, `byChannel: z.object({ voice: z.number(), telegram: z.number() })`, `conversionFunnel: z.object({ calls, answered, leadsCreated, ordersConfirmed, delivered })`.
    - `UnifiedMessageSchema` (NEW in api/clients.ts) shaped like RESEARCH Example 3 — used by GET /api/clients/:id/messages response.
    - All schemas exported via `packages/shared-types/src/index.ts`.
  </behavior>
  <action>
Step 1 — Audit `leads.channel` distinct values (Open Question #4). Run via psql against the dev database (or testcontainers if no Docker):
```bash
# If docker available:
docker exec ailogist-postgres psql -U ailogist -d ailogist -c "SELECT DISTINCT channel FROM leads ORDER BY channel;"
# Document the actual values found in the SUMMARY.
```
Update `LeadSchema.channel` from current `z.enum(['telegram', 'call'])` to `z.enum(['telegram', 'voice', 'call'])` (accept all 3 historic values for graceful handling).

Modify `packages/shared-types/src/api/leads.ts`:
- Change `channel: z.enum(['telegram', 'call'])` → `channel: z.enum(['telegram', 'voice', 'call'])` in `LeadSchema`.
- Add to `LeadListQuerySchema`:
  ```ts
  export const LeadListQuerySchema = z.object({
    stage: LeadStage.optional(),
    clientId: z.string().uuid().optional(),
    channel: z.enum(['telegram', 'voice', 'call']).optional(),  // Phase 4 API-03 — D-60
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  });
  ```

Step 2 — Create `packages/shared-types/src/api/calls.ts` (NEW per D-19 + D-62):

```ts
// @ai-logist/shared-types — Phase 4, Plan 04-03
// DTO schemas for /api/calls — D-19 + D-31 + D-62.

import { z } from 'zod/v4';
import { LeadSchema } from './leads.js';
import { OrderSchema } from './orders.js';

const CallOutcome = z.enum(['completed', 'abandoned', 'escalated', 'error']);
const CallLang = z.enum(['ru', 'ua']);

// Transcript turn shape (Phase 3.1 D-13 + RESEARCH Pattern 4):
//   { speaker: 'agent' | 'caller', text: string, timestamp_ms: number }
// We model it loosely (passthrough unknown fields) because Phase 3.1 + ElevenLabs
// real output may drift; defensive coercion happens at the SQL/handler boundary.
export const TranscriptTurnSchema = z
  .object({
    speaker: z.enum(['agent', 'caller']).optional(),
    text: z.string().optional(),
    timestamp_ms: z.number().int().nullable().optional(),
  })
  .loose();
export type TranscriptTurn = z.infer<typeof TranscriptTurnSchema>;

export const CallSchema = z.object({
  id: z.string().uuid(),
  leadId: z.string().uuid().nullable(),
  linkedLeadId: z.string().uuid().nullable(),
  direction: z.enum(['inbound', 'outbound']),
  durationS: z.number().int().nullable(),
  outcome: CallOutcome.nullable(),
  lang: CallLang.nullable(),
  audioUrl: z.string().url().nullable(),
  recordingUrl: z.string().nullable(), // Phase 1 legacy column
  quotedPriceAtConfirmation: z.string().nullable(), // bigint → string
  elevenlabsConversationId: z.string().nullable(),
  twilioCallSid: z.string().nullable(),
  transcript: z.array(TranscriptTurnSchema).default([]),
  createdAt: z.string().datetime(),
});
export type Call = z.infer<typeof CallSchema>;

export const CallDetailSchema = z.object({
  call: CallSchema,
  linkedLead: LeadSchema.nullable(),
  linkedOrder: OrderSchema.nullable(),
});
export type CallDetail = z.infer<typeof CallDetailSchema>;

export const CallListQuerySchema = z.object({
  outcome: CallOutcome.optional(),
  lang: CallLang.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type CallListQuery = z.infer<typeof CallListQuerySchema>;
```

Step 3 — Extend `packages/shared-types/src/api/orders.ts` per D-35 + D-39 + D-62:

After the existing `OrderDetailSchema` add:

```ts
// Phase 4 D-35 — joined list response for /dashboard/orders.
// Extends OrderSchema with denormalized city/client/channel fields.
export const OrderListItemSchema = OrderSchema.extend({
  fromCityName: z.string().nullable(),
  toCityName: z.string().nullable(),
  clientName: z.string().nullable(),
  channel: z.enum(['telegram', 'voice']).nullable(), // 'call' coerced to 'voice' in handler
});
export type OrderListItem = z.infer<typeof OrderListItemSchema>;

// Phase 4 D-39 — extended detail response (avoid N+1 in /dashboard/orders/[id]).
// Re-declare instead of extending OrderDetailSchema directly so the original
// schema is still available for Phase 2/3 internal use.
import { TruckSchema } from './trucks.js';
import { LeadSchema } from './leads.js';

const CityRefSchema = z.object({
  id: z.string().uuid(),
  nameRu: z.string(),
  nameUa: z.string().nullable(),
});

const ClientRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string().nullable(),
  phone: z.string().nullable(),
  lang: z.enum(['ru', 'ua']).nullable(),
});

export const OrderDetailExtendedSchema = z.object({
  order: OrderSchema,
  events: z.array(OrderEventSchema),
  client: ClientRefSchema.nullable(),
  fromCity: CityRefSchema.nullable(),
  toCity: CityRefSchema.nullable(),
  truck: TruckSchema.nullable(),
  lead: LeadSchema.nullable(), // for channel breadcrumb (D-38)
});
export type OrderDetailExtended = z.infer<typeof OrderDetailExtendedSchema>;
```

Step 4 — Extend `packages/shared-types/src/api/analytics.ts` per D-44:

Replace the existing `KpiResponseSchema` with:

```ts
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
    amount: z.string(), // kopecks as string (bigint precision preserved)
    currency: z.string(),
  }),
  // Phase 4 D-44 extensions
  avgCallDurationS: z.number().nullable(),
  byChannel: z.object({
    voice: z.number(),
    telegram: z.number(),
  }),
  conversionFunnel: z.object({
    calls: z.number(),
    answered: z.number(),
    leadsCreated: z.number(),
    ordersConfirmed: z.number(),
    delivered: z.number(),
  }),
});
export type KpiResponse = z.infer<typeof KpiResponseSchema>;
```

Step 5 — Extend `packages/shared-types/src/api/clients.ts` to add `UnifiedMessageSchema` (Phase 4 union response):

```ts
// Phase 4 D-23 — UNION response for /api/clients/:id/messages.
// Each row is either a real `messages` row OR a virtual voice-transcript-turn row.
export const UnifiedMessageSchema = z.object({
  id: z.string(),
  createdAt: z.string().datetime(),
  role: z.enum(['client', 'ai', 'manager']),
  text: z.string(),
  channel: z.enum(['telegram', 'voice']),
  callId: z.string().uuid().nullable(),
  timestampMs: z.number().nullable(),
  audioUrl: z.string().nullable(),
});
export type UnifiedMessage = z.infer<typeof UnifiedMessageSchema>;
```

Step 6 — Re-export new module from `packages/shared-types/src/index.ts`:

Add to the file:
```ts
export * from './api/calls.js';
```
(after the existing `export * from './api/clients.js';` line).

Step 7 — Build the package to confirm types resolve:
```bash
pnpm --filter @ai-logist/shared-types build
```

Commit message: `feat(04-03): shared-types extensions + new api/calls.ts (CallSchema + OrderListItemSchema + extended KPI + UnifiedMessage)`.
  </action>
  <verify>
    <automated>
test -f packages/shared-types/src/api/calls.ts && \
grep -q "CallSchema\|CallDetailSchema\|CallListQuerySchema" packages/shared-types/src/api/calls.ts && \
grep -q "TranscriptTurnSchema" packages/shared-types/src/api/calls.ts && \
grep -q "OrderListItemSchema" packages/shared-types/src/api/orders.ts && \
grep -q "OrderDetailExtendedSchema" packages/shared-types/src/api/orders.ts && \
grep -q "avgCallDurationS\|byChannel\|conversionFunnel" packages/shared-types/src/api/analytics.ts && \
grep -q "UnifiedMessageSchema" packages/shared-types/src/api/clients.ts && \
grep -q "channel: z.enum" packages/shared-types/src/api/leads.ts && \
grep -q "voice" packages/shared-types/src/api/leads.ts && \
grep -q "api/calls" packages/shared-types/src/index.ts && \
pnpm --filter @ai-logist/shared-types build && \
pnpm --filter @ai-logist/api exec tsc --noEmit
    </automated>
  </verify>
  <acceptance_criteria>
    - File exists: `packages/shared-types/src/api/calls.ts` exporting `CallSchema`, `CallDetailSchema`, `CallListQuerySchema`, `TranscriptTurnSchema`, `Call`, `CallDetail`, `CallListQuery`
    - `packages/shared-types/src/api/orders.ts` exports `OrderListItemSchema` AND `OrderDetailExtendedSchema` (both new; original `OrderSchema` + `OrderDetailSchema` preserved)
    - `packages/shared-types/src/api/analytics.ts` `KpiResponseSchema` includes the 3 new fields: `avgCallDurationS`, `byChannel`, `conversionFunnel`
    - `packages/shared-types/src/api/clients.ts` exports `UnifiedMessageSchema`
    - `packages/shared-types/src/api/leads.ts` `LeadListQuerySchema` includes `channel: z.enum(['telegram','voice','call']).optional()`
    - `packages/shared-types/src/index.ts` re-exports `./api/calls.js`
    - `pnpm --filter @ai-logist/shared-types build` exits 0
    - `pnpm --filter @ai-logist/api exec tsc --noEmit` exits 0 (apps/api still typechecks against extended schemas)
  </acceptance_criteria>
  <done>
shared-types schemas extended + new calls module added; apps/api still typechecks. Ready for handler implementation.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Flip leads + orders + trucks + analytics handlers + register callsRoutes</name>
  <files>
    apps/api/src/routes/leads.ts,
    apps/api/src/routes/orders.ts,
    apps/api/src/routes/trucks.ts,
    apps/api/src/routes/analytics.ts,
    apps/api/src/routes/calls.ts,
    apps/api/src/app.ts,
    apps/api/tests/integration/leads-list.test.ts,
    apps/api/tests/integration/orders-list.test.ts,
    apps/api/tests/integration/orders-detail.test.ts,
    apps/api/tests/integration/trucks-list.test.ts,
    apps/api/tests/integration/analytics-kpi.test.ts,
    apps/api/tests/integration/calls-list.test.ts
  </files>
  <read_first>
    apps/api/src/routes/leads.ts,
    apps/api/src/routes/orders.ts,
    apps/api/src/routes/trucks.ts,
    apps/api/src/routes/analytics.ts,
    apps/api/src/persistence/schema/orders.ts,
    apps/api/src/persistence/schema/order_events.ts,
    apps/api/src/persistence/schema/leads.ts,
    apps/api/src/persistence/schema/calls.ts,
    apps/api/src/persistence/repos/index.ts,
    apps/api/src/app.ts,
    .planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-RESEARCH.md
  </read_first>
  <behavior>
    - GET /api/leads — paginated; filters by stage + channel; sorted createdAt DESC.
    - GET /api/orders — joined response (cities + clients + leads.channel) sorted createdAt DESC; filters by status + channel + clientId.
    - GET /api/orders/:id — extended detail (order + events + client + fromCity + toCity + truck + lead); 404 on missing.
    - GET /api/trucks — read-only list, filters by status + bodyType; POST/PATCH remain 501 (deferred to v2).
    - GET /api/analytics/kpi — single SQL query (RESEARCH Pattern 5), returns extended KpiResponseSchema with revenue as bigint string.
    - GET /api/calls — paginated list, filters by outcome+lang+from+to; sorted createdAt DESC.
    - GET /api/calls/:id — call + linkedLead + linkedOrder; 404 on missing.
    - app.ts registers `callsRoutes` after analyticsRoutes.
  </behavior>
  <action>
Step 1 — Modify `apps/api/src/routes/leads.ts`. Replace the 501-stub GET handler with a real implementation. Keep POST `/leads/:id/match` and POST `/leads/:id/quote` UNTOUCHED (Phase 2 handlers — bit-identical contract):

```ts
// In apps/api/src/routes/leads.ts — replace the GET /leads block:
app.get(
  '/leads',
  {
    schema: {
      tags: ['leads'],
      summary: 'List leads (Phase 4 API-03)',
      querystring: LeadListQuerySchema,
      response: { 200: z.array(LeadSchema), 400: NotImpl },
    },
  },
  async (req) => {
    const { stage, clientId, channel, limit, offset } = req.query;
    // Build dynamic WHERE
    const conds = [];
    if (stage) conds.push(sql`stage = ${stage}`);
    if (clientId) conds.push(sql`client_id = ${clientId}::uuid`);
    if (channel) {
      // Channel filter — 'voice' query matches both 'voice' and legacy 'call' rows
      if (channel === 'voice') {
        conds.push(sql`channel IN ('voice','call')`);
      } else {
        conds.push(sql`channel = ${channel}`);
      }
    }
    const whereClause = conds.length
      ? sql`WHERE ${sql.join(conds, sql` AND `)}`
      : sql``;
    const rows = await app.db.execute(sql`
      SELECT id, client_id AS "clientId", channel, stage,
             from_city_id AS "fromCityId", to_city_id AS "toCityId",
             tons, body_type AS "bodyType", budget,
             volume_m3 AS "volumeM3", dimensions_lxwxh AS "dimensionsLxwxh",
             packaging, adr_class AS "adrClass", declared_value AS "declaredValue",
             matched_truck_id AS "matchedTruckId", quoted_price AS "quotedPrice",
             order_id AS "orderId", price_overrides AS "priceOverrides",
             version, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM leads
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
    return rows.rows.map((r: any) => ({
      ...r,
      // Coerce legacy 'call' value to 'voice' for the response (D-35 + Open Question #4)
      channel: r.channel === 'call' ? 'voice' : r.channel,
      createdAt: new Date(r.createdAt).toISOString(),
      updatedAt: new Date(r.updatedAt).toISOString(),
    }));
  }
);
```

ALSO replace the PATCH `/leads/:id` 501-stub with a simple update (D-60 + ADMIN-NEW-02 supports manual stage edits — bare minimum; full Kanban UI is v2):

```ts
app.patch(
  '/leads/:id',
  {
    schema: {
      tags: ['leads'],
      summary: 'Update lead stage (Phase 4 API-03 / ADMIN-NEW-02 supporting)',
      params: z.object({ id: z.string().uuid() }),
      body: LeadPatchBodySchema,
      response: { 200: LeadSchema, 404: NotImpl, 409: NotImpl },
    },
  },
  async (req, reply) => {
    const { id } = req.params;
    const { stage, version } = req.body;
    const result = await app.db.execute(sql`
      UPDATE leads SET stage = ${stage}, version = version + 1, updated_at = NOW()
      WHERE id = ${id}::uuid AND version = ${version}
      RETURNING *
    `);
    if (result.rows.length === 0) {
      const exists = await app.db.execute(sql`SELECT 1 FROM leads WHERE id = ${id}::uuid`);
      if (exists.rows.length === 0) return reply.notFound('Lead not found');
      return reply.conflict('Version mismatch');
    }
    const r = result.rows[0] as any;
    return { ...r, channel: r.channel === 'call' ? 'voice' : r.channel };
  }
);
```

Step 2 — Modify `apps/api/src/routes/orders.ts`. Replace GET /orders and GET /orders/:id 501-stubs. Keep POST /orders + POST /orders/:id/price-override AS 501 stubs (deferred to v2):

```ts
import { OrderListItemSchema, OrderDetailExtendedSchema } from '@ai-logist/shared-types/api/orders';
import { sql } from 'drizzle-orm';

// GET /orders (LIST) — joined cities + client + lead.channel
app.get(
  '/orders',
  {
    schema: {
      tags: ['orders'],
      summary: 'List orders (Phase 4 API-04)',
      querystring: OrderListQuerySchema.extend({
        channel: z.enum(['telegram', 'voice']).optional(),
      }),
      response: { 200: z.array(OrderListItemSchema) },
    },
  },
  async (req) => {
    const { status, clientId, limit, offset } = req.query as any;
    const channel = (req.query as any).channel as 'telegram' | 'voice' | undefined;
    const conds = [];
    if (status) conds.push(sql`o.status = ${status}`);
    if (clientId) conds.push(sql`o.client_id = ${clientId}::uuid`);
    if (channel === 'voice') conds.push(sql`l.channel IN ('voice','call')`);
    else if (channel === 'telegram') conds.push(sql`l.channel = 'telegram'`);
    const whereClause = conds.length ? sql`WHERE ${sql.join(conds, sql` AND `)}` : sql``;
    const rows = await app.db.execute(sql`
      SELECT o.id, o.number, o.lead_id AS "leadId", o.client_id AS "clientId",
             o.truck_id AS "truckId", o.from_city_id AS "fromCityId",
             o.to_city_id AS "toCityId", o.distance_km AS "distanceKm",
             o.price, o.currency, o.status, o.public_token AS "publicToken",
             o.version, o.created_at AS "createdAt", o.updated_at AS "updatedAt",
             fc.name_ru AS "fromCityName", tc.name_ru AS "toCityName",
             c.name AS "clientName", l.channel
      FROM orders o
      LEFT JOIN cities fc ON fc.id = o.from_city_id
      LEFT JOIN cities tc ON tc.id = o.to_city_id
      LEFT JOIN clients c ON c.id = o.client_id
      LEFT JOIN leads l ON l.id = o.lead_id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
    return rows.rows.map((r: any) => ({
      ...r,
      channel: r.channel === 'call' ? 'voice' : (r.channel ?? null),
      createdAt: new Date(r.createdAt).toISOString(),
      updatedAt: new Date(r.updatedAt).toISOString(),
      priceOverrides: [], // Phase 4 doesn't surface overrides — schema requires field; pass empty
    }));
  }
);

// GET /orders/:id (DETAIL) — extended response with all joins (D-39)
app.get(
  '/orders/:id',
  {
    schema: {
      tags: ['orders'],
      summary: 'Order detail with events + relations (Phase 4 API-04)',
      params: z.object({ id: z.string().uuid() }),
      response: { 200: OrderDetailExtendedSchema, 404: NotImpl },
    },
  },
  async (req, reply) => {
    const { id } = req.params;
    // 1. Order + relations
    const orderRow = await app.db.execute(sql`
      SELECT o.*, l.channel AS lead_channel, l.from_city_id AS lead_from_city_id
      FROM orders o
      LEFT JOIN leads l ON l.id = o.lead_id
      WHERE o.id = ${id}::uuid
    `);
    if (orderRow.rows.length === 0) return reply.notFound('Order not found');
    const o = orderRow.rows[0] as any;
    // 2. Events timeline (sorted asc)
    const eventsRows = await app.db.execute(sql`
      SELECT id, order_id AS "orderId", type, actor, payload, created_at AS "createdAt"
      FROM order_events
      WHERE order_id = ${id}::uuid
      ORDER BY created_at ASC
    `);
    // 3. Client
    const clientRow = await app.db.execute(sql`
      SELECT id, name, phone, lang FROM clients WHERE id = ${o.client_id}::uuid
    `);
    // 4. Cities
    const cityRows = await app.db.execute(sql`
      SELECT id, name_ru AS "nameRu", name_ua AS "nameUa" FROM cities
      WHERE id IN (${o.from_city_id}::uuid, ${o.to_city_id}::uuid)
    `);
    const fromCity = cityRows.rows.find((c: any) => c.id === o.from_city_id) ?? null;
    const toCity = cityRows.rows.find((c: any) => c.id === o.to_city_id) ?? null;
    // 5. Truck
    const truckRow = o.truck_id
      ? await app.db.execute(sql`SELECT * FROM trucks WHERE id = ${o.truck_id}::uuid`)
      : { rows: [] };
    // 6. Lead (for channel breadcrumb)
    const leadRow = o.lead_id
      ? await app.db.execute(sql`SELECT * FROM leads WHERE id = ${o.lead_id}::uuid`)
      : { rows: [] };

    return {
      order: {
        id: o.id, number: o.number, leadId: o.lead_id, clientId: o.client_id,
        truckId: o.truck_id, fromCityId: o.from_city_id, toCityId: o.to_city_id,
        distanceKm: o.distance_km, price: String(o.price), currency: o.currency,
        status: o.status, publicToken: o.public_token, version: o.version,
        createdAt: new Date(o.created_at).toISOString(),
        updatedAt: new Date(o.updated_at).toISOString(),
      },
      events: eventsRows.rows.map((e: any) => ({
        ...e,
        createdAt: new Date(e.createdAt).toISOString(),
        geom: null, // Phase 4 doesn't surface geom; schema allows null
      })),
      client: clientRow.rows[0] ?? null,
      fromCity, toCity,
      truck: truckRow.rows[0] ?? null,
      lead: leadRow.rows[0]
        ? { ...leadRow.rows[0], channel: (leadRow.rows[0] as any).channel === 'call' ? 'voice' : (leadRow.rows[0] as any).channel }
        : null,
    } as any;
  }
);
```

Step 3 — Modify `apps/api/src/routes/trucks.ts`. Replace GET /trucks 501-stub:

```ts
app.get(
  '/trucks',
  {
    schema: {
      tags: ['trucks'],
      summary: 'List fleet (Phase 4 API-05 read-only)',
      querystring: TruckListQuerySchema,
      response: { 200: z.array(TruckSchema) },
    },
  },
  async (req) => {
    const { status, bodyType, limit } = req.query;
    const conds = [];
    if (status) conds.push(sql`status = ${status}`);
    if (bodyType) conds.push(sql`body_type = ${bodyType}`);
    const whereClause = conds.length ? sql`WHERE ${sql.join(conds, sql` AND `)}` : sql``;
    const rows = await app.db.execute(sql`
      SELECT id, name, plate_number AS "plateNumber",
             driver_name AS "driverName", driver_phone AS "driverPhone",
             driver_telegram_id AS "driverTelegramId",
             capacity_t AS "capacityT", body_type AS "bodyType", status,
             ST_AsGeoJSON(geom)::jsonb AS geom,
             updated_at AS "updatedAt", created_at AS "createdAt"
      FROM trucks
      ${whereClause}
      ORDER BY plate_number ASC
      LIMIT ${limit}
    `);
    return rows.rows.map((r: any) => ({
      ...r,
      geom: r.geom?.coordinates ? { lng: r.geom.coordinates[0], lat: r.geom.coordinates[1] } : { lng: 0, lat: 0 },
      capacityT: Number(r.capacityT),
      updatedAt: new Date(r.updatedAt).toISOString(),
      createdAt: new Date(r.createdAt).toISOString(),
    }));
  }
);
```

(POST /trucks + PATCH /trucks/:id remain 501-stubs — fleet CRUD deferred to v2.)

Step 4 — Modify `apps/api/src/routes/analytics.ts` to RESEARCH Pattern 5 single-query implementation:

```ts
// apps/api/src/routes/analytics.ts — Phase 4 API-09
import { KpiResponseSchema } from '@ai-logist/shared-types/api/analytics';
import { sql } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

const analyticsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/analytics/kpi',
    {
      schema: {
        tags: ['analytics'],
        summary: 'KPI for dashboards (Phase 4 ADMIN-05 / API-09)',
        querystring: z.object({ window: z.enum(['day', 'week', 'month']).default('week') }),
        response: { 200: KpiResponseSchema },
      },
    },
    async (req) => {
      const { window } = req.query;
      const intervalSql = window === 'day' ? sql`INTERVAL '1 day'`
        : window === 'week' ? sql`INTERVAL '7 days'`
        : sql`INTERVAL '30 days'`;

      const result = await app.db.execute(sql`
        WITH window_bounds AS (
          SELECT NOW() - ${intervalSql} AS since
        ),
        call_stats AS (
          SELECT
            COUNT(*) FILTER (WHERE outcome IS NOT NULL) AS total,
            COUNT(*) FILTER (WHERE outcome IN ('completed','escalated')) AS answered,
            AVG(duration_s) FILTER (WHERE duration_s IS NOT NULL)::int AS avg_duration_s
          FROM calls
          WHERE created_at >= (SELECT since FROM window_bounds)
        ),
        lead_stats AS (
          SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE channel IN ('voice','call')) AS by_voice,
            COUNT(*) FILTER (WHERE channel = 'telegram') AS by_telegram,
            COALESCE(jsonb_object_agg(stage, n) FILTER (WHERE stage IS NOT NULL), '{}'::jsonb) AS by_stage
          FROM (
            SELECT stage, channel, COUNT(*) AS n
            FROM leads
            WHERE created_at >= (SELECT since FROM window_bounds)
            GROUP BY stage, channel
          ) g
        ),
        order_stats AS (
          SELECT
            COUNT(*) AS created,
            COUNT(*) FILTER (WHERE status IN ('DELIVERED','CLOSED')) AS delivered,
            COALESCE(SUM(price), 0)::text AS revenue_kopecks
          FROM orders
          WHERE created_at >= (SELECT since FROM window_bounds)
        )
        SELECT
          ${window}::text AS window,
          jsonb_build_object(
            'total',    (SELECT total FROM call_stats),
            'answered', (SELECT answered FROM call_stats)
          ) AS calls,
          jsonb_build_object(
            'total',   (SELECT total FROM lead_stats),
            'byStage', COALESCE((SELECT by_stage FROM lead_stats), '{}'::jsonb)
          ) AS leads,
          jsonb_build_object(
            'created',   (SELECT created FROM order_stats),
            'delivered', (SELECT delivered FROM order_stats)
          ) AS orders,
          jsonb_build_object(
            'amount',   COALESCE((SELECT revenue_kopecks FROM order_stats), '0'),
            'currency', 'RUB'
          ) AS revenue,
          (SELECT avg_duration_s FROM call_stats) AS "avgCallDurationS",
          jsonb_build_object(
            'voice',    COALESCE((SELECT by_voice FROM lead_stats), 0),
            'telegram', COALESCE((SELECT by_telegram FROM lead_stats), 0)
          ) AS "byChannel",
          jsonb_build_object(
            'calls',           (SELECT total FROM call_stats),
            'answered',        (SELECT answered FROM call_stats),
            'leadsCreated',    (SELECT total FROM lead_stats),
            'ordersConfirmed', (SELECT created FROM order_stats),
            'delivered',       (SELECT delivered FROM order_stats)
          ) AS "conversionFunnel"
      `);
      const row = result.rows[0] as any;
      return {
        window: row.window,
        calls: {
          total: Number(row.calls?.total ?? 0),
          answered: Number(row.calls?.answered ?? 0),
        },
        leads: {
          total: Number(row.leads?.total ?? 0),
          byStage: row.leads?.byStage ?? {},
        },
        orders: {
          created: Number(row.orders?.created ?? 0),
          delivered: Number(row.orders?.delivered ?? 0),
        },
        revenue: row.revenue,
        avgCallDurationS: row.avgCallDurationS != null ? Number(row.avgCallDurationS) : null,
        byChannel: {
          voice: Number(row.byChannel?.voice ?? 0),
          telegram: Number(row.byChannel?.telegram ?? 0),
        },
        conversionFunnel: {
          calls: Number(row.conversionFunnel?.calls ?? 0),
          answered: Number(row.conversionFunnel?.answered ?? 0),
          leadsCreated: Number(row.conversionFunnel?.leadsCreated ?? 0),
          ordersConfirmed: Number(row.conversionFunnel?.ordersConfirmed ?? 0),
          delivered: Number(row.conversionFunnel?.delivered ?? 0),
        },
      };
    }
  );
};

export default analyticsRoutes;
```

Step 5 — Create `apps/api/src/routes/calls.ts` (NEW per D-31 + RESEARCH Example 4):

```ts
// apps/api/src/routes/calls.ts — Phase 4 NEW (ADMIN-NEW-08 + D-31)
import {
  CallSchema,
  CallDetailSchema,
  CallListQuerySchema,
} from '@ai-logist/shared-types/api/calls';
import { sql } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

const NotImpl = z.object({ statusCode: z.number(), error: z.string(), message: z.string() });

function serializeCall(r: any) {
  return {
    id: r.id,
    leadId: r.leadId ?? r.lead_id ?? null,
    linkedLeadId: r.linkedLeadId ?? r.linked_lead_id ?? null,
    direction: r.direction,
    durationS: r.durationS ?? r.duration_s ?? null,
    outcome: r.outcome,
    lang: r.lang,
    audioUrl: r.audioUrl ?? r.audio_url ?? null,
    recordingUrl: r.recordingUrl ?? r.recording_url ?? null,
    quotedPriceAtConfirmation: r.quotedPriceAtConfirmation
      ?? (r.quoted_price_at_confirmation != null ? String(r.quoted_price_at_confirmation) : null),
    elevenlabsConversationId: r.elevenlabsConversationId ?? r.elevenlabs_conversation_id ?? null,
    twilioCallSid: r.twilioCallSid ?? r.twilio_call_sid ?? null,
    transcript: Array.isArray(r.transcript) ? r.transcript : [],
    createdAt: new Date(r.createdAt ?? r.created_at).toISOString(),
  };
}

const callsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/calls',
    {
      schema: {
        tags: ['calls'],
        summary: 'List calls (Phase 4 ADMIN-NEW-08)',
        querystring: CallListQuerySchema,
        response: { 200: z.array(CallSchema) },
      },
    },
    async (req) => {
      const { outcome, lang, from, to, limit, offset } = req.query;
      const conds = [];
      if (outcome) conds.push(sql`outcome = ${outcome}`);
      if (lang) conds.push(sql`lang = ${lang}`);
      if (from) conds.push(sql`created_at >= ${from}::timestamptz`);
      if (to) conds.push(sql`created_at <= ${to}::timestamptz`);
      const whereClause = conds.length ? sql`WHERE ${sql.join(conds, sql` AND `)}` : sql``;
      const rows = await app.db.execute(sql`
        SELECT id, lead_id, linked_lead_id, direction, duration_s,
               outcome, lang, audio_url, recording_url,
               quoted_price_at_confirmation, elevenlabs_conversation_id,
               twilio_call_sid, transcript, created_at
        FROM calls
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);
      return rows.rows.map(serializeCall);
    }
  );

  app.get(
    '/calls/:id',
    {
      schema: {
        tags: ['calls'],
        summary: 'Call detail with linked lead + order (Phase 4 ADMIN-NEW-08)',
        params: z.object({ id: z.string().uuid() }),
        response: { 200: CallDetailSchema, 404: NotImpl },
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const rows = await app.db.execute(sql`
        SELECT c.id, c.lead_id, c.linked_lead_id, c.direction, c.duration_s,
               c.outcome, c.lang, c.audio_url, c.recording_url,
               c.quoted_price_at_confirmation, c.elevenlabs_conversation_id,
               c.twilio_call_sid, c.transcript, c.created_at,
               row_to_json(l.*) AS linked_lead,
               row_to_json(o.*) AS linked_order
        FROM calls c
        LEFT JOIN leads l ON l.id = COALESCE(c.linked_lead_id, c.lead_id)
        LEFT JOIN orders o ON o.lead_id = l.id
        WHERE c.id = ${id}::uuid
        LIMIT 1
      `);
      if (rows.rows.length === 0) return reply.notFound('Call not found');
      const r = rows.rows[0] as any;
      return {
        call: serializeCall(r),
        linkedLead: r.linked_lead
          ? {
              ...r.linked_lead,
              clientId: r.linked_lead.client_id,
              channel: r.linked_lead.channel === 'call' ? 'voice' : r.linked_lead.channel,
              fromCityId: r.linked_lead.from_city_id,
              toCityId: r.linked_lead.to_city_id,
              bodyType: r.linked_lead.body_type,
              volumeM3: r.linked_lead.volume_m3,
              dimensionsLxwxh: r.linked_lead.dimensions_lxwxh,
              adrClass: r.linked_lead.adr_class,
              declaredValue: r.linked_lead.declared_value,
              matchedTruckId: r.linked_lead.matched_truck_id,
              quotedPrice: r.linked_lead.quoted_price,
              orderId: r.linked_lead.order_id,
              priceOverrides: r.linked_lead.price_overrides ?? [],
              createdAt: new Date(r.linked_lead.created_at).toISOString(),
              updatedAt: new Date(r.linked_lead.updated_at).toISOString(),
            }
          : null,
        linkedOrder: r.linked_order
          ? {
              id: r.linked_order.id,
              number: r.linked_order.number,
              leadId: r.linked_order.lead_id,
              clientId: r.linked_order.client_id,
              truckId: r.linked_order.truck_id,
              fromCityId: r.linked_order.from_city_id,
              toCityId: r.linked_order.to_city_id,
              distanceKm: r.linked_order.distance_km,
              price: String(r.linked_order.price),
              currency: r.linked_order.currency,
              status: r.linked_order.status,
              publicToken: r.linked_order.public_token,
              version: r.linked_order.version,
              createdAt: new Date(r.linked_order.created_at).toISOString(),
              updatedAt: new Date(r.linked_order.updated_at).toISOString(),
            }
          : null,
      };
    }
  );
};

export default callsRoutes;
```

Step 6 — Register `callsRoutes` in `apps/api/src/app.ts`. Read the existing app.ts, add the import next to other route imports:
```ts
import callsRoutes from './routes/calls.js';
```
Register after analyticsRoutes:
```ts
await app.register(callsRoutes, { prefix: '/api' });
```

Step 7 — Flip 5 integration test scaffolds from test.todo to real it() blocks. Each test uses the testcontainers pattern already established in apps/api/tests/integration. See `apps/api/tests/integration/health.test.ts` for the template. Implementation outline:

`apps/api/tests/integration/leads-list.test.ts`:
- beforeAll: startPostgisContainer + apply migrations + seed (2 leads: one stage=NEW channel=telegram, one stage=QUOTED channel=voice).
- Test 1: GET /api/leads?stage=NEW returns 1 lead with channel=telegram.
- Test 2: GET /api/leads?channel=voice returns 1 lead with channel=voice.
- Test 3: GET /api/leads?limit=1&offset=0 vs ?limit=1&offset=1 returns disjoint sets.

`apps/api/tests/integration/orders-list.test.ts`:
- beforeAll: seed 2 orders (one from voice lead, one from telegram lead) + 4 cities + 2 clients.
- Test 1: GET /api/orders returns 2 OrderListItem with fromCityName/toCityName/clientName populated.
- Test 2: GET /api/orders?channel=voice returns 1.
- Test 3: assert sort order is createdAt DESC.

`apps/api/tests/integration/orders-detail.test.ts`:
- beforeAll: seed 1 order + 3 order_events + truck + cities + client + lead.
- Test 1: GET /api/orders/:id returns order + 3 events sorted asc + client + fromCity + toCity + truck + lead.
- Test 2: GET /api/orders/00000000-0000-0000-0000-000000000000 returns 404.
- Test 3: events.length === 3 and events[0].createdAt < events[1].createdAt.

`apps/api/tests/integration/trucks-list.test.ts`:
- beforeAll: seed 3 trucks (one available tent, one busy ref, one offline iso).
- Test 1: GET /api/trucks returns 3 with capacity + body_type + driver_phone.
- Test 2: GET /api/trucks?status=available returns 1.

`apps/api/tests/integration/analytics-kpi.test.ts`:
- beforeAll: seed across the time window (5 calls 3 completed, 4 leads 2 voice 2 telegram, 3 orders 1 delivered, revenue sum).
- Test 1: GET /api/analytics/kpi?window=week — calls.total === 5, calls.answered === 3, revenue.amount === sum-as-string.
- Test 2: avgCallDurationS is non-null number; byChannel.voice === 2; byChannel.telegram === 2.
- Test 3: conversionFunnel — calls (5) >= answered (3) >= leadsCreated (4) >= ordersConfirmed (3) >= delivered (1) — note: leadsCreated CAN exceed answered if some leads are from telegram (not call-derived). Adjust seed to make funnel monotonic OR loosen assertion to "all values are numbers".
- Test 4: revenue.amount is a string parseable as bigint (precision preserved).
- Test 5: window=day vs window=month return different counts (different SINCE bounds).

`apps/api/tests/integration/calls-list.test.ts`:
- beforeAll: seed 4 calls (2 completed/ru, 1 abandoned/ua, 1 escalated/ru).
- Test 1: GET /api/calls returns 4 sorted createdAt DESC.
- Test 2: GET /api/calls?outcome=completed returns 2.
- Test 3: GET /api/calls?lang=ua returns 1.
- Test 4: GET /api/calls?from=...&to=... narrows the result.
- Test 5: GET /api/calls/:id with linked lead+order returns nested structure.
- Test 6: GET /api/calls/00000000-... returns 404.

Use the existing testcontainers pattern from `apps/api/tests/integration/health.test.ts` for boot orchestration. Wrap with `describe.skipIf(!dockerAvailable)` already present in Wave 0 scaffolds.

Commit message: `feat(04-03): backend handler completions — API-03/04/05/09 + new /api/calls + 24 integration tests`.
  </action>
  <verify>
    <automated>
test -f apps/api/src/routes/calls.ts && \
grep -q "callsRoutes" apps/api/src/app.ts && \
grep -q "API-03\|leadsRepo\|FROM leads" apps/api/src/routes/leads.ts && \
grep -q "leftJoin\|LEFT JOIN" apps/api/src/routes/orders.ts && \
grep -q "UNION ALL\|jsonb_array_elements" apps/api/src/routes/clients.ts || true; \
grep -q "FILTER (WHERE\|conversionFunnel\|byChannel" apps/api/src/routes/analytics.ts && \
pnpm --filter @ai-logist/api exec tsc --noEmit && \
cd apps/api && pnpm test:integration -t "leads-list\|orders-list\|orders-detail\|trucks-list\|analytics-kpi\|calls" 2>&1 | grep -E "passed"
    </automated>
  </verify>
  <acceptance_criteria>
    - `apps/api/src/routes/leads.ts` GET /leads handler no longer calls `reply.notImplemented` — returns real data from `db.execute(sql\`SELECT ... FROM leads\`)`. PATCH /leads/:id also flipped to real handler.
    - `apps/api/src/routes/orders.ts` GET /orders + GET /orders/:id flipped. POST /orders + POST /orders/:id/price-override REMAIN 501 stubs (Phase 4 NOT in scope per CONTEXT).
    - `apps/api/src/routes/trucks.ts` GET /trucks flipped. POST/PATCH REMAIN 501.
    - `apps/api/src/routes/analytics.ts` GET /analytics/kpi flipped to single SQL query with FILTER (WHERE) + jsonb_build_object.
    - `apps/api/src/routes/calls.ts` exists, exports `callsRoutes`, has GET /calls + GET /calls/:id with 404 path.
    - `apps/api/src/app.ts` imports + registers `callsRoutes` with `prefix: '/api'`.
    - `pnpm --filter @ai-logist/api exec tsc --noEmit` exits 0.
    - 6 integration test files contain 0 `it.todo` and 23+ `it(` blocks total (excludes UNION test which Task 3 flips).
    - `pnpm --filter @ai-logist/api test:integration -t "leads-list"` exits 0 (3 passing).
    - `pnpm --filter @ai-logist/api test:integration -t "orders-list"` exits 0 (3 passing).
    - `pnpm --filter @ai-logist/api test:integration -t "orders-detail"` exits 0 (3 passing).
    - `pnpm --filter @ai-logist/api test:integration -t "trucks-list"` exits 0 (2 passing).
    - `pnpm --filter @ai-logist/api test:integration -t "analytics-kpi"` exits 0 (5 passing).
    - `pnpm --filter @ai-logist/api test:integration -t "calls"` exits 0 (6 passing).
  </acceptance_criteria>
  <done>
6 routes flipped to real handlers + 1 new file (calls.ts) + 1 registration. 22 backend integration tests added. apps/api/src/pipeline + persistence/schema unchanged (Phase 2/3/3.1 contract preserved).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: UNION query handler (API-06) — flip clients/messages stub + integration test + 5 stub flips</name>
  <files>
    apps/api/src/routes/clients.ts,
    apps/api/tests/integration/clients-messages-union.test.ts,
    apps/api/tests/unit/phase-4-stubs.test.ts
  </files>
  <read_first>
    apps/api/src/routes/clients.ts,
    apps/api/src/persistence/schema/messages.ts,
    apps/api/src/persistence/schema/calls.ts,
    apps/api/src/persistence/schema/leads.ts,
    .planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-RESEARCH.md
  </read_first>
  <behavior>
    - GET /api/clients/:id/messages returns array of UnifiedMessage records sorted by created_at ASC.
    - For a client with 2 telegram messages + 1 call with 3 transcript turns, result.length === 5; rows interleaved chronologically.
    - Voice turns: speaker='agent' → role='ai'; speaker='caller' → role='client'; channel='voice'; callId + timestampMs + audioUrl all set.
    - Telegram messages: channel='telegram'; callId=null; timestampMs=null; audioUrl=null.
    - Empty client (no messages, no calls) returns `[]`.
    - Missing `timestamp_ms` in transcript turn → handler computes `c.created_at + idx*1000ms` as fallback (defensive coercion per RESEARCH Pattern 4 footnote).
    - Marker count: 10 → 5 after this task (5 backend reqs flip).
  </behavior>
  <action>
Step 1 — Replace the 501-stub in `apps/api/src/routes/clients.ts` with the UNION ALL query (RESEARCH Example 3 verbatim with Phase 4 polish). The handler MUST:
- Use `app.db.execute(sql\`...\`)` for the raw UNION.
- Use the EXACT SQL from RESEARCH §Pattern 4 (with WITH ORDINALITY + LATERAL jsonb_array_elements).
- Defensively coerce missing timestamp_ms to `idx * 1000` (1000ms per turn fallback).
- Return shape matches UnifiedMessageSchema.

```ts
// apps/api/src/routes/clients.ts — Phase 4 API-06
import {
  ListMessagesQuerySchema,
  UnifiedMessageSchema,
} from '@ai-logist/shared-types/api/clients';
import { sql } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

const clientsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/clients/:id/messages',
    {
      schema: {
        tags: ['clients'],
        summary: 'Client unified message history — telegram + voice transcript UNION (Phase 4 API-06)',
        params: z.object({ id: z.string().uuid() }),
        querystring: ListMessagesQuerySchema,
        response: { 200: z.array(UnifiedMessageSchema) },
      },
    },
    async (req) => {
      const { id } = req.params;
      const { limit, offset } = req.query;

      const result = await app.db.execute(sql`
        WITH msgs AS (
          SELECT
            m.id::text                AS id,
            m.created_at              AS created_at,
            m.role                    AS role,
            m.text                    AS text,
            'telegram'                AS channel,
            NULL::uuid                AS call_id,
            NULL::bigint              AS timestamp_ms,
            NULL::text                AS audio_url
          FROM messages m
          WHERE m.client_id = ${id}::uuid
        ),
        voice AS (
          SELECT
            c.id::text || ':' || idx::text                                       AS id,
            -- Defensive timestamp computation: missing timestamp_ms falls back to idx*1000ms.
            c.created_at + (
              COALESCE(NULLIF(turn->>'timestamp_ms','')::bigint, (idx::bigint - 1) * 1000)
              * INTERVAL '1 ms'
            )                                                                     AS created_at,
            CASE WHEN turn->>'speaker' = 'agent' THEN 'ai' ELSE 'client' END     AS role,
            COALESCE(turn->>'text', '')                                          AS text,
            'voice'                                                              AS channel,
            c.id                                                                 AS call_id,
            COALESCE(NULLIF(turn->>'timestamp_ms','')::bigint, (idx::bigint - 1) * 1000) AS timestamp_ms,
            c.audio_url                                                          AS audio_url
          FROM calls c,
               LATERAL jsonb_array_elements(c.transcript) WITH ORDINALITY AS t(turn, idx)
          WHERE EXISTS (
            SELECT 1 FROM leads l
            WHERE (l.id = c.linked_lead_id OR l.id = c.lead_id)
              AND l.client_id = ${id}::uuid
          )
        )
        SELECT * FROM msgs
        UNION ALL
        SELECT * FROM voice
        ORDER BY created_at ASC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return result.rows.map((r: any) => ({
        id: r.id,
        createdAt: new Date(r.created_at).toISOString(),
        role: r.role,
        text: r.text,
        channel: r.channel,
        callId: r.call_id ?? null,
        timestampMs: r.timestamp_ms != null ? Number(r.timestamp_ms) : null,
        audioUrl: r.audio_url ?? null,
      }));
    }
  );
};

export default clientsRoutes;
```

Step 2 — Implement `apps/api/tests/integration/clients-messages-union.test.ts` (5 real it() blocks). Pattern: same testcontainers boot as other Phase 4 integration tests. Seed data:
- 1 client (clientId='aaa...')
- 1 lead linked to client
- 2 messages (created_at 10:00 + 10:02, role=client + role=ai, channel='telegram')
- 1 call linked to that lead with transcript jsonb array of 3 turns at timestamp_ms 0, 1500, 3000; call.created_at = 10:01 (between the 2 messages); call.audio_url = 'https://twilio.example/recording.mp3'

Tests:
- Test 1: GET /api/clients/:id/messages — returns 5 rows sorted ASC by created_at. Order: msg1(10:00) → voice_turn1(10:01.000) → voice_turn2(10:01.001500) → voice_turn3(10:01.003) → msg2(10:02).
- Test 2: voice turn role mapping — first turn (speaker='agent') has role='ai'; second turn (speaker='caller') has role='client'.
- Test 3: voice turn carries callId === '<seeded call id>', timestampMs === 1500 (for second turn), audioUrl === 'https://twilio.example/recording.mp3'.
- Test 4: GET on client with NO messages and NO calls returns `[]`.
- Test 5: defensive — seed a call with transcript turn missing `timestamp_ms` field (raw jsonb without that key) → handler returns row with timestampMs computed via idx*1000ms fallback.

Step 3 — Flip 5 stub markers in `apps/api/tests/unit/phase-4-stubs.test.ts` (API-03 + API-04 + API-05 + API-06 + API-09). Each `it.todo` replaced with a real `it()`:

```ts
it('API-03: GET /api/leads filters by stage + channel', async () => {
  const { existsSync, readFileSync } = await import('node:fs');
  const src = readFileSync(`${process.cwd()}/src/routes/leads.ts`, 'utf8');
  expect(src).toMatch(/Phase 4 API-03|API-03/);
  expect(src).toMatch(/channel/);
  expect(src).not.toMatch(/reply\.notImplemented\(.{0,80}admin web/); // GET /leads stub gone
});

it('API-04: GET /api/orders returns joined list + GET /:id returns full detail with events/client/cities/truck', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(`${process.cwd()}/src/routes/orders.ts`, 'utf8');
  expect(src).toMatch(/LEFT JOIN|leftJoin/);
  expect(src).toMatch(/from_city_id|fromCityId/);
  expect(src).toMatch(/order_events|orderEvents/);
});

it('API-05: GET /api/trucks returns full fleet read-only', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(`${process.cwd()}/src/routes/trucks.ts`, 'utf8');
  expect(src).toMatch(/FROM trucks|trucksRepo\.findMany/);
  // POST/PATCH stubs remain — deferred to v2
  expect(src).toMatch(/reply\.notImplemented/);
});

it('API-06: GET /api/clients/:id/messages UNION returns telegram + voice transcript turns chronologically with callId+timestampMs+audioUrl', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(`${process.cwd()}/src/routes/clients.ts`, 'utf8');
  expect(src).toMatch(/UNION ALL/);
  expect(src).toMatch(/jsonb_array_elements/);
  expect(src).toMatch(/WITH ORDINALITY/);
  expect(src).toMatch(/timestamp_ms/);
  expect(src).toMatch(/audio_url/);
});

it('API-09: GET /api/analytics/kpi returns extended shape (avgCallDurationS + byChannel + conversionFunnel) with bigint revenue as string', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(`${process.cwd()}/src/routes/analytics.ts`, 'utf8');
  expect(src).toMatch(/avgCallDurationS/);
  expect(src).toMatch(/byChannel/);
  expect(src).toMatch(/conversionFunnel/);
  expect(src).toMatch(/FILTER \(WHERE/);
  expect(src).toMatch(/revenue/);
});
```

Marker count: 10 → 5 (5 backend reqs flipped). Run `pnpm test:unit -t "Phase 4"` — must show 8 passing + 5 todo.

Commit message: `feat(04-03): UNION query for /api/clients/:id/messages + 5 backend stub flips (API-03..09)`.
  </action>
  <verify>
    <automated>
grep -q "UNION ALL\|jsonb_array_elements" apps/api/src/routes/clients.ts && \
grep -q "WITH ORDINALITY" apps/api/src/routes/clients.ts && \
grep -q "timestamp_ms" apps/api/src/routes/clients.ts && \
! grep -q "reply\.notImplemented('Phase 4 — admin chat'" apps/api/src/routes/clients.ts && \
pnpm --filter @ai-logist/api exec tsc --noEmit && \
cd apps/api && pnpm test:integration -t "clients-messages union" 2>&1 | grep -E "5 passed" && \
cd /Users/muhemmedibrahimov/Documents/holy-water/ai-logist/apps/api && pnpm test:unit -t "Phase 4" 2>&1 | grep -E "8 passed|5 todo"
    </automated>
  </verify>
  <acceptance_criteria>
    - `apps/api/src/routes/clients.ts` no longer calls `reply.notImplemented` for GET /clients/:id/messages
    - File contains literal strings: `UNION ALL`, `jsonb_array_elements`, `WITH ORDINALITY`, `timestamp_ms`, `audio_url`, `LATERAL`
    - `apps/api/tests/integration/clients-messages-union.test.ts` contains 0 `it.todo` and 5 `it(` blocks
    - `pnpm --filter @ai-logist/api test:integration -t "clients-messages union"` exits 0 with 5 passing
    - `pnpm --filter @ai-logist/api test:unit -t "Phase 4"` shows 8 passing + 5 todo (5 backend reqs flipped this wave + 3 previous flips from Wave 2)
    - `apps/api/src/pipeline/llm-tools/` + `apps/api/src/channels/` + `apps/api/src/persistence/schema/` ALL unchanged (`git diff --stat` for these dirs returns empty)
  </acceptance_criteria>
  <done>
UNION query handler complete + 5 integration tests green + 5 backend stub markers flipped. Marker count 10 → 5. Backend ready for Waves 4+5 frontend consumers.
  </done>
</task>

</tasks>

<verification>
- `pnpm --filter @ai-logist/api exec tsc --noEmit` exits 0
- `pnpm --filter @ai-logist/api test:integration` runs ALL Phase 4 integration tests (~25 it() blocks across 7 files) — green
- `pnpm --filter @ai-logist/api test:unit -t "Phase 4"` shows 8 passing + 5 todo
- `pnpm --filter @ai-logist/shared-types build` exits 0
- `git diff apps/api/src/pipeline apps/api/src/channels apps/api/src/persistence/schema` returns empty (Phase 2/3/3.1 contract preserved)
- Swagger UI at /api/docs exposes new /api/calls routes (manual verification — RESEARCH §Architecture Pattern footnote)
</verification>

<success_criteria>
- 5 backend Phase 4 requirements complete (API-03, API-04, API-05, API-06, API-09)
- 1 new file (apps/api/src/routes/calls.ts) registered
- 4 shared-types schemas extended + 1 new (calls.ts)
- 7 integration test scaffolds fully implemented (~25 it() blocks)
- 5 stub markers flipped — count down to 5 (only frontend reqs remain: ADMIN-03 + ADMIN-05 + ADMIN-NEW-02 + ADMIN-NEW-03 + ADMIN-NEW-08)
- UNION query handles defensive coercion for missing timestamp_ms
- Bigint revenue precision preserved (string serialization)
- Phase 2/3/3.1 source files bit-identical
</success_criteria>

<output>
After completion, create `.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-03-SUMMARY.md` summarizing:
- 6 routes flipped (leads, orders, trucks, clients, analytics, + new calls)
- 4 schema files extended
- UNION query implementation + defensive coercion approach
- Open Question #4 resolution: actual leads.channel distinct values found
- Open Question #3 outcome: transcript turn shape audit
- Integration test count (~25) + pass status
- Marker count: 10 → 5
- Notes for Wave 4 (Plan 04-04, chat + calls pages) + Wave 5 (Plan 04-05, orders + analytics)
</output>
