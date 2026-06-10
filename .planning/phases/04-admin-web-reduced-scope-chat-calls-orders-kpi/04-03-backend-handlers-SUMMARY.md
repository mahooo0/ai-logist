---
phase: 04-admin-web-reduced-scope-chat-calls-orders-kpi
plan: 03
subsystem: api
tags: [fastify, drizzle, postgis, zod, swr-backend, kpi, calls, telegram, voice]

requires:
  - phase: 01-database-backend-skeleton
    provides: schema, repos, 501-stubs, shared-types DTOs
  - phase: 02-llm-pipeline-deterministic-core-high-risk
    provides: stable REST tool boundary, leads/orders FSMs
  - phase: 03-telegram-channel
    provides: messages table fed by Telegram, manager intercept routes
  - phase: 03.1-voice-channel-elevenlabs-twilio
    provides: calls schema with transcript jsonb + audio_url + outcome + linked_lead_id

provides:
  - GET /api/leads (stage + channel + clientId filters) — API-03
  - GET /api/orders (joined OrderListItem with city + client + channel) — API-04
  - GET /api/orders/:id (full detail with events timeline + client + cities + truck + lead) — API-04
  - GET /api/trucks (read-only fleet list with status + bodyType filters) — API-05
  - GET /api/clients/:id/messages (UNION query: messages + virtual voice rows from calls.transcript) — API-06
  - GET /api/analytics/kpi (extended with avgCallDurationS + byChannel + conversionFunnel) — API-09
  - GET /api/calls + GET /api/calls/:id (NEW route file — Phase 4's implicit prerequisite for ADMIN-NEW-08)
  - shared-types extensions: api/calls.ts NEW + analytics.ts/orders.ts/clients.ts/leads.ts extended

affects: 04-04-chat-calls-pages, 04-05-orders-kpi-pages, 04-06-uat-gate

tech-stack:
  added: []  # all libs already in stack from Phase 1-3.1
  patterns:
    - "UNION CTE pattern: messages + LATERAL jsonb_array_elements WITH ORDINALITY over calls.transcript for multi-channel chat history (D-23)"
    - "Conditional aggregation: single-SQL KPI via FILTER (WHERE …) + jsonb_build_object for nested response shape (RESEARCH Pattern 5)"
    - "Denormalized list responses: LEFT JOIN city/client server-side to avoid admin N+1 (D-35)"
    - "Defensive coercion: voice-row timestamp_ms falls back to (idx-1)*1000 when transcript turn lacks the field"
    - "Channel value normalization: SQL 'call' rows coerce to 'voice' in API response so admin sees 2 stable values"

key-files:
  created:
    - apps/api/src/routes/calls.ts
    - packages/shared-types/src/api/calls.ts
  modified:
    - apps/api/src/routes/leads.ts
    - apps/api/src/routes/orders.ts
    - apps/api/src/routes/trucks.ts
    - apps/api/src/routes/clients.ts
    - apps/api/src/routes/analytics.ts
    - apps/api/src/app.ts
    - packages/shared-types/src/api/analytics.ts
    - packages/shared-types/src/api/orders.ts
    - packages/shared-types/src/api/clients.ts
    - packages/shared-types/src/api/leads.ts
    - packages/shared-types/src/index.ts
    - apps/api/tests/integration/leads-list.test.ts
    - apps/api/tests/integration/orders-list.test.ts
    - apps/api/tests/integration/orders-detail.test.ts
    - apps/api/tests/integration/trucks-list.test.ts
    - apps/api/tests/integration/clients-messages-union.test.ts
    - apps/api/tests/integration/analytics-kpi.test.ts
    - apps/api/tests/integration/calls-list.test.ts
    - apps/api/tests/unit/phase-4-stubs.test.ts
    - apps/api/tests/unit/phase-1-stubs.test.ts

key-decisions:
  - "phase-1-stubs.test.ts API-16 loop updated from reply.notImplemented assertion to shared-types schema import assertion — Phase 2 onward has flipped these stubs to real handlers, so the original assertion contradicts reality (Rule 3 — Blocking auto-fix)"
  - "leads channel filter coerces SQL 'call' → API 'voice' so frontend sees 2 stable values"
  - "Voice virtual messages use composite id '<call_uuid>:<turn_idx>' for stability across requests"
  - "OrderDetailExtendedSchema bundles client + fromCity + toCity + truck + lead in single response per D-39 (avoids N+1 in admin detail page)"
  - "KpiResponseSchema extended per D-44: avgCallDurationS + byChannel{voice,telegram} + conversionFunnel{calls,answered,leadsCreated,ordersConfirmed,delivered}. revenue.amount remains string for bigint precision"

patterns-established:
  - "Multi-channel UNION query: real table + LATERAL transcript turns as virtual messages — sets template for any future channel that ships per-message audit"
  - "Defensive transcript turn coercion: handler never trusts external transcript shape, always synthesizes ordering fallback"
  - "Server-side denormalization for admin lists: LEFT JOIN cities/clients in list endpoint, not per-row in UI"

requirements-completed: [API-03, API-04, API-05, API-06, API-09]

duration: ~76min
completed: 2026-06-11
---

# Phase 4 / Plan 04-03: Backend Handlers Summary

**6 Fastify route stubs flipped to real handlers + 1 NEW route file (apps/api/src/routes/calls.ts) + 7 integration test scaffolds flipped — closes 5 API requirements (API-03/04/05/06/09) and the implicit /api/calls prerequisite for ADMIN-NEW-08.**

## Performance

- **Duration:** ~76 min (across 3 task commits)
- **Started:** 2026-06-11 (Wave 3a entry)
- **Completed:** 2026-06-11
- **Tasks:** 3 (shared-types extensions → route handlers + new calls.ts → UNION + final stub flips)
- **Files modified:** 19 (1 created in shared-types + 1 created in routes + 11 modified routes/schemas + 6 test scaffolds + phase-4-stubs + phase-1-stubs)

## Accomplishments

- **GET /api/calls + GET /api/calls/:id** ship as new route file — implicit ADMIN-NEW-08 prerequisite, paginated list with outcome/lang/from/to filters + detail with linkedLead + linkedOrder
- **GET /api/clients/:id/messages** UNION query: real messages CTE + voice CTE (LATERAL jsonb_array_elements WITH ORDINALITY over calls.transcript) — UnifiedMessage[] sorted chronologically
- **GET /api/orders + /:id** join cities × 2 + clients + leads server-side; detail composes 5 SQL fetches into OrderDetailExtended
- **GET /api/analytics/kpi** extended to KPI v2: avgCallDurationS, byChannel split, full 5-stage conversion funnel
- **GET /api/leads + /api/trucks** flipped to real read handlers with documented filter sets; channel='voice' coerces SQL 'call' rows
- **shared-types extended**: new api/calls.ts (Call/CallDetail/CallListQuery schemas), analytics.ts extended for KPI v2, orders.ts adds OrderListItem + OrderDetailExtended, clients.ts adds UnifiedMessage schema, leads.ts adds channel filter type
- **7 integration scaffolds flipped** from test.todo to real it() blocks (all describe.skipIf(!dockerAvailable) gated for AI_LOGIST_NO_DOCKER=1 CI runners)
- **phase-4-stubs.test.ts marker count: 10 → 5** (only frontend reqs remain: ADMIN-03/05/NEW-02/03/08)

## Task Commits

1. **Task 1: shared-types extensions + new api/calls.ts** — `2eda512`
2. **Task 2: backend handler completions — API-03/04/05/09 + new /api/calls route + app.ts wiring** — `d82034d`
3. **Task 3: UNION query for /api/clients/:id/messages + 5 backend stub flips** — `615a829`
4. **Plan metadata** — `[this commit]` (docs(04-03): complete backend-handlers plan)

## Files Created/Modified

### Created
- `apps/api/src/routes/calls.ts` — Fastify plugin: GET /api/calls + GET /api/calls/:id
- `packages/shared-types/src/api/calls.ts` — CallSchema, CallDetailSchema, CallListQuerySchema

### Modified — routes
- `apps/api/src/routes/leads.ts` — GET / + PATCH /:id flipped; intercept POSTs preserved (Phase 3)
- `apps/api/src/routes/orders.ts` — GET / + GET /:id flipped; POST + price-override remain 501 (deferred to v2)
- `apps/api/src/routes/trucks.ts` — GET / flipped; POST/PATCH remain 501 (fleet CRUD v2)
- `apps/api/src/routes/clients.ts` — GET /:id/messages UNION query
- `apps/api/src/routes/analytics.ts` — GET /kpi extended per D-44
- `apps/api/src/app.ts` — registers callsRoutes at /api prefix

### Modified — shared-types
- `packages/shared-types/src/api/analytics.ts` — KpiResponseSchema v2
- `packages/shared-types/src/api/orders.ts` — OrderListItemSchema + OrderDetailExtendedSchema
- `packages/shared-types/src/api/clients.ts` — UnifiedMessageSchema
- `packages/shared-types/src/api/leads.ts` — channel filter type
- `packages/shared-types/src/index.ts` — re-export api/calls

### Modified — tests
- `apps/api/tests/integration/{leads,orders,orders-detail,trucks,clients-messages-union,analytics-kpi,calls}-list.test.ts` — 17 it() blocks total, Docker-gated
- `apps/api/tests/unit/phase-4-stubs.test.ts` — 5 it.todo → it() (API-03/04/05/06/09)
- `apps/api/tests/unit/phase-1-stubs.test.ts` — API-16 loop assertion updated (see Deviations)

## Decisions Made

- **leads channel normalization** — SQL row 'call' coerces to API 'voice' in the response so frontend sees 2 stable values (anti-fragmentation)
- **Voice virtual-row composite id** — `<call_uuid>:<turn_idx>` keeps idempotent reference across requests
- **OrderDetailExtended bundling** — single-shot response (5 SQL fetches composed) instead of forcing admin detail page to do N+1
- **Defensive transcript turn coercion** — handler synthesizes `timestamp_ms` fallback (idx-1)*1000 when transcript turn lacks it; never trusts external shape
- **revenue.amount stays bigint string** — JSON.parse precision constraint; preserved across schema extensions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] phase-1-stubs.test.ts API-16 loop**
- **Found during:** Task 2 (route handler completions)
- **Issue:** API-16 test asserted every route still contained `reply.notImplemented` — but Phase 2 onward has been flipping these stubs to real handlers. Test contradicted reality (false negatives from Phase 2/3 onward, but only surfaced now that 04-03 flips remaining routes).
- **Fix:** Updated assertion from `reply.notImplemented` presence to shared-types schema import presence (the structural DTO contract — the actual stable invariant).
- **Files modified:** apps/api/tests/unit/phase-1-stubs.test.ts
- **Verification:** apps/api unit suite 195 passed | 5 todo, no regressions on Phase 1 contract tests.
- **Committed in:** d82034d (Task 2 commit)

### Open Items (not deviations — deferred per Plan)

- **Distinct value scan for leads.channel** (Open Question #4) — Docker not available on this runner; defensive schema accepts all 3 values ('voice', 'telegram', 'call' legacy) and coerces 'call' → 'voice' in serializer. Verifier should run `SELECT DISTINCT channel FROM leads` on staging to confirm scope.

---

**Total deviations:** 1 auto-fixed (1 blocking — phase-1-stubs assertion drift)
**Impact on plan:** All planned work delivered. The phase-1-stubs fix is technical debt cleanup that should have happened in Phase 2 but was masked.

## Issues Encountered

- **Socket interruption mid-plan** — orchestrator agent connection dropped after Task 3 commit (615a829) but BEFORE writing SUMMARY/STATE/ROADMAP metadata. Inline finalization by orchestrator (this commit) replaces the missing metadata commit. All task work was successfully delivered before the interruption.

## Next Phase Readiness

**Wave 3b (Plans 04-04 + 04-05) can now proceed:**
- All Phase 4 page rewires (chat, calls, orders, orders/[id], default, analytics) have real backend endpoints to fetch.
- apiGet (from Plan 04-02) + Server Component fetch helpers can validate responses against the new shared-types schemas.
- New OrderListItem, OrderDetailExtended, UnifiedMessage, Call, CallDetail, KpiResponse v2 types are all exported from `@ai-logist/shared-types`.
- 5 remaining markers in phase-4-stubs.test.ts (ADMIN-03/05/NEW-02/03/08) — all frontend, all assigned to Plans 04-04 + 04-05.

**No blockers for Wave 3b parallelization** — Plans 04-04 and 04-05 modify disjoint apps/web/src/app/(main)/dashboard/{chat,calls} vs {orders,default,analytics} subtrees. Safe to run in parallel.

---
*Phase: 04-admin-web-reduced-scope-chat-calls-orders-kpi*
*Completed: 2026-06-11*
