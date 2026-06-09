# Roadmap: AI-Логист

**Created:** 2026-06-08
**Granularity:** standard
**Coverage:** 89/89 v1 requirements mapped (REQUIREMENTS.md totals line reads "97" — arithmetic typo; enumerated requirements sum to 89; see Coverage Note below)
**Goal:** Demo-ready AI-driven logistics dispatcher (Telegram + LLM + PostGIS + admin web + live tracking) for RU/UA freight market

> Source of truth: `ai-logist-logic-spec.md` §9 build order, refined by `.planning/research/SUMMARY.md`. Phase order front-loads PostGIS correctness and the LLM tool boundary; Telegram channel exposed only after deterministic core is safe; admin runs in parallel after Phase 2; tracking + public surface follow; demo polish closes.

## Phases

- [ ] **Phase 1: Database + Backend Skeleton** — Postgres 17 + PostGIS 3.5, Drizzle schema, Fastify caркas, docker-compose, fleet seed
- [ ] **Phase 2: LLM Pipeline + Deterministic Core** ⚠️ HIGH RISK — extractRequest, nearestTruck (KNN re-rank), calcPrice (corridor + price-lock), FSMs, sticky language detect
- [ ] **Phase 3: Telegram Channel** — grammY webhook with `secret_token`, two-stage idempotency, inline buttons, driver-confirmation loop, manager intervention
- [ ] **Phase 4: Admin Web (Zenith Template + 3 New Pages)** 🎨 UI — wire existing 4 pages, add fleet/orders/tracking, price-override audit, global search, RU/UA toggle
- [ ] **Phase 5: Tracking Loop + Live Map + Public Tracking** ⚠️ HIGH RISK — GPS simulator, geofence FSM auto-transitions, WS resilience (reconnect + heartbeat), `/track/[token]`
- [ ] **Phase 6: Demo Polish + Notifications + Final i18n** — ICU pluralization, locale-aware dates, FSM-driven client notifications, snapshot tests, voice fallback video, pre-flight checklist

## Phase Details

### Phase 1: Database + Backend Skeleton
**Goal**: Foundation is bulletproof — PostGIS correctness is locked, schema covers every demo-credibility field (cargo dimensions, POD, audit log), and the project ships as one `docker compose up`.
**Depends on**: Nothing (first phase)
**Requirements** (17): DB-01, DB-02, DB-03, DB-04, DB-05, DB-06, DB-07, DB-08, DB-09, DB-10, API-01, API-02, API-16, DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04
**Success Criteria** (what must be TRUE):
  1. `docker compose up` boots the full stack (Fastify api, Next.js web placeholder, postgres+postgis 17-3.5, redis, caddy) on a clean machine; `GET /api/health` returns `PostGIS_Version()` confirming the extension is loaded.
  2. Schema migrations create every table from spec §2 plus the six demo-credibility extensions (extended cargo fields, `price_overrides jsonb[]`, `pod_artifacts`, `tax_id`/`tax_id_country`, `webhook_updates`, `bourse_cache`), with `geography(Point, 4326)` on all geo columns and a GiST index on `trucks.geom`.
  3. Seed script populates 10-15 trucks across realistic RU/UA cities, ~30 cities (Київ↔Киев, Львів↔Львов pairs) plus 5+ border crossings, 5-10 clients, pricing config (`rate_per_km`, `dir_coef`, `season_coef`); a canonical `SELECT … ORDER BY geom <-> :pickup LIMIT 3` returns plausible trucks from psql.
  4. Monorepo layout is `apps/api` + `apps/web` + `packages/shared-types` with pnpm workspaces, Zod-validated env via Node 22 `--env-file`, and README that lets a fresh developer run the demo in ≤10 minutes.
**Plans**: 11 plans
  - [x] 01-00-test-infra-PLAN.md — Wave 0: vitest + testcontainers + stub tests for every Phase 1 requirement ✅ (2026-06-09)
  - [x] 01-01-monorepo-skeleton-PLAN.md — pnpm workspaces, root package.json, tsconfig.base, biome, .env.example, packages/shared-types stub
  - [x] 01-02-infrastructure-PLAN.md — docker-compose.yml (postgis 17-3.5, redis 7, api, web, caddy), Caddyfile (handle /api/*), Dockerfiles, apps/web Next.js placeholder
  - [x] 01-03-drizzle-setup-PLAN.md — drizzle-orm 0.45.2 + drizzle-kit, customType geographyPoint, 7 pgEnums, drizzle.config.ts, 0000 postgis extension migration
  - [ ] 01-04-schema-geo-PLAN.md — clients, cities, trucks, truck_positions tables (geography(Point,4326) + GiST + CHECK SRID)
  - [ ] 01-05-schema-domain-PLAN.md — orders (public_token), leads (extended cargo + price_overrides jsonb[] + version), order_events (UNIQUE order_id+type), pod_artifacts (gps geography)
  - [ ] 01-06-schema-channels-repos-PLAN.md — messages, calls, bourse_cache, webhook_updates (UNIQUE source+external_id), pricing_config + 6 thin per-aggregate repos
  - [ ] 01-07-fastify-skeleton-PLAN.md — Fastify v5 buildApp, db+redis plugins, /api/health with PostGIS_Version, HealthResponseSchema in shared-types, drizzle-kit generate 0001_init.sql + apply
  - [ ] 01-08-rest-stubs-PLAN.md — Zod DTO schemas for leads/orders/trucks/clients/analytics/webhooks in shared-types + 501-stub routes in Fastify + Swagger UI integration test
  - [ ] 01-09-seed-PLAN.md — JSON fixtures (~30 cities incl. 5+ borders, 12 trucks, 8 clients, pricing rate_per_km=4200 kopecks), idempotent seed run.ts, canonical KNN smoke print from Kyiv
  - [ ] 01-10-readme-smoke-PLAN.md — README 10-min setup + VPS deploy + Phase 1 status table + full-stack smoke test + checkpoint:human-verify

---

### Phase 2: LLM Pipeline + Deterministic Core ⚠️ HIGH RISK
**Goal**: The system's brain is safe — every business action goes through a validated tool, prices are computed deterministically and rendered (not generated), FSMs survive concurrent transitions, and bilingual sticky detection prevents mid-conversation language flips.
**Depends on**: Phase 1 (schema, repos, health endpoint)
**Requirements** (18): API-07, LOGIC-01, LOGIC-02, LOGIC-03, LOGIC-04, LOGIC-05, MATCH-01, MATCH-02, MATCH-03, MATCH-04, MATCH-05, MATCH-06, FSM-01, FSM-02, FSM-03, FSM-04, FSM-05, FSM-06
**Risk Notes** (per PITFALLS.md): Five critical pitfalls cluster here — LLM in money path (#1), KNN sphere vs spheroid (#2), bilingual on Surzhyk (#7), FSM races (#6), prompt injection (#11), token-cost runaway (#12). Tools-as-security-boundary is the structural defense; CTE re-rank pattern is the PostGIS defense; `SELECT … FOR UPDATE` + version column is the FSM defense; per-lead token ledger is the cost defense. Snapshot tests on 20 canonical inputs (`extractRequest` + `calcPrice`) gate every PR.
**Success Criteria** (what must be TRUE):
  1. A test harness drives a script-only dialog from "Киев-Львов, 18 тонн, тент" to `ORDER_CREATED` end-to-end without exposing any webhook — extraction → KNN match → priced quote → agreed → order; `quoted_price` is written to `leads` BEFORE the templated reply is rendered.
  2. `calcPrice` and `extractRequest` snapshot tests (20 canonical inputs covering "Кыев-Львов 18т", "Kyiv-Lviv 18t", "20т Киев-Львов", ambiguous "около 18 тонн") produce stable, byte-identical outputs across 10 consecutive runs in CI.
  3. PostGIS KNN returns correct top-3 trucks via CTE re-rank pattern (overfetch 20 by `<->`, re-rank by spheroid `ST_Distance`); EXPLAIN ANALYZE shows GiST `Index Scan`; filters by `capacity_t` and `body_type` are applied INSIDE the CTE.
  4. Concurrency test fires two simultaneous transitions on the same lead — exactly one succeeds, the other reports illegal-transition via version mismatch; FSM audit log records actor (ai/manager/system) and payload.
  5. Sticky language detect: a client sending "ок" followed by "Київ-Львів 18т" lands in `clients.lang='ua'` once (≥20-char rule), and all subsequent replies stay UA even if the client later sends RU text.
**Plans**: TBD

---

### Phase 3: Telegram Channel
**Goal**: The pipeline is safely exposed — Telegram webhook is idempotent on `update_id`, ack-fast under 100ms, drivers can confirm assignments, managers can take over conversations, and per-client serialization prevents out-of-order corruption.
**Depends on**: Phase 2 (deterministic tools + FSM)
**Requirements** (9): API-13, API-15, TG-01, TG-02, TG-03, TG-04, TG-05, TG-06, TG-07
**Success Criteria** (what must be TRUE):
  1. A real Telegram chat completes the full pipeline: client writes "Киев-Львов, 18 тонн, тент" → bot extracts → offers price with inline buttons "Подтвердить рейс / Изменить / Отказаться" → client taps confirm → order is created and visible in psql with stage=`ORDER_CREATED`.
  2. Replaying the same `update_id` ten times produces exactly one lead row (`webhook_updates` UNIQUE + `ON CONFLICT DO NOTHING`); webhook handler returns 200 in <100ms while inline worker processes async.
  3. Driver receives a Telegram message (or simulator stub if `telegram_id` unset) on assignment with "Принять / Отказаться" buttons; tapping "Принять" advances order FSM to `DRIVER_ASSIGNED`.
  4. Manager clicks "перехватить диалог" in admin → bot goes silent for that client → manager-typed messages flow to client via Telegram → `messages.role` records `manager` vs `ai` correctly.
  5. Webhook is authenticated via `secret_token` header verification; `/webhook/voice` stub returns 200 (placeholder for later voice channel).
**Plans**: TBD

---

### Phase 4: Admin Web (Zenith Template + 3 New Pages)
**Goal**: Manager-facing surface is complete — existing 4 template pages are wired to live API, 3 new pages (fleet, orders, tracking-scaffold) ship under template conventions, price-override audit and global search work, RU/UA toggle is hooked to the dictionary.
**Depends on**: Phase 2 (stable REST surface). Can run in PARALLEL with Phase 3 once Phase 2 API contracts are stable.
**Requirements** (21): API-03, API-04, API-05, API-06, API-08, API-09, API-10, ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06, ADMIN-NEW-01, ADMIN-NEW-02, ADMIN-NEW-03, ADMIN-NEW-04, ADMIN-NEW-05, ADMIN-NEW-06, ADMIN-NEW-07, I18N-02
**Risk Notes** (per PITFALLS.md #13): Next.js 16 + Tailwind v4 + shadcn integration traps. Convention: `page.tsx` is server (SSR fetch), `_components/<feature>-app.tsx` is the SOLE client boundary; Leaflet via `next/dynamic ssr: false`; NEVER `'use cache'` on `/tracking`, `/chat`, `/kanban`, `/orders` (grep guard in CI); use `border-border` explicitly (Tailwind v4 changed default).
**Success Criteria** (what must be TRUE):
  1. Forked `next-shadcn-admin-dashboard` boots with `pnpm dev` on :3000, auth via `/auth/v1/login` (env-set login/password); existing pages `/dashboard/chat`, `/dashboard/kanban`, `/dashboard/default`, `/dashboard/analytics`, `/dashboard/calendar` all show real data from `/api/*` endpoints — no mocks.
  2. Dragging a lead card across Kanban columns issues `PATCH /api/leads/:id` with FSM validation — illegal moves (e.g., `QUOTED → NEW`) are rejected at the API and revert the card visually.
  3. New `/dashboard/fleet` lets the manager CRUD a truck with `phone-input` for driver phone (RU `+7` and UA `+380` formats) and plate validation; `/dashboard/orders/[id]` shows order timeline from `order_events`, POD section placeholder, "TTN/CMR PDF" preview button, route map, and price-override modal (with mandatory "Reason" field writing to `price_overrides` audit log).
  4. Global search (shadcn command palette `⌘K`) returns matching orders/leads/clients; Customize-panel Language toggle flips the entire admin between RU and UA via `I18N-02` dictionary.
  5. `pnpm exec tsc --noEmit` passes; Biome check passes; visual smoke test of every page in both light/dark themes shows no broken borders or layout shifts.
**Plans**: TBD
**UI hint**: yes

---

### Phase 5: Tracking Loop + Live Map + Public Tracking ⚠️ HIGH RISK
**Goal**: The visually-decisive moment of the demo works — trucks move smoothly along realistic OSRM polylines, geofence entries auto-transition the order FSM, WS survives idle/tab-switch/reload, and a public `/track/[token]` link lets the client see live status without admin login.
**Depends on**: Phase 2 (order FSM) AND Phase 4 (admin scaffolding for `/dashboard/tracking` to land).
**Requirements** (12): API-11, API-12, API-14, TRACK-01, TRACK-02, TRACK-03, TRACK-04, TRACK-05, TRACK-06, TRACK-07, PUBLIC-01, PUBLIC-02
**Risk Notes** (per PITFALLS.md #9, #10): The WS reconnect/teleport cluster + fake-looking GPS are the next-highest demo-killers after Phase 2. Defense: SSR-fetch initial state, WS for deltas only; exponential-backoff reconnect (1/2/4/8/30s) + 25s heartbeat + `visibilitychange` refetch; GPS sim snaps to OSRM polyline, variable speed (50-80 km/h highway / 20-30 km/h city) + ±5m noise + 10-30s push cadence + 5-15 min stops at loading/border geofences; smooth-marker interpolation on Leaflet.
**Success Criteria** (what must be TRUE):
  1. Running `pnpm sim:demo` (the GPS simulator CLI) moves a truck along an OSRM-derived polyline at realistic speeds with random ±5m noise; positions push every 10-30s; the truck stops at loading geofence for 5-15 min, then at border, then at unload.
  2. `/dashboard/tracking` loads in <1s with SSR-rendered truck positions (no spinner-driven blank state on refresh), then receives live deltas via WS `/ws/tracking` with smooth marker interpolation — no teleporting, no jumps.
  3. As the simulated truck enters loading/border/unload geofences (`ST_DWithin` with GiST index), order FSM auto-transitions `AT_LOADING → IN_TRANSIT → AT_BORDER → DELIVERED`, idempotently (UNIQUE `(order_id, type)` on `order_events`); the admin chat WS publishes the event.
  4. The WS client survives a 5-minute tab-switch (heartbeat keeps connection alive) and a network drop (exponential backoff reconnects + refetches snapshot via `visibilitychange`) without losing state.
  5. The public page `/track/[order_token]` (no auth) shows live truck position + status + ETA; the encrypted link is sent to the client via Telegram automatically on order creation.
**Plans**: TBD

---

### Phase 6: Demo Polish + Notifications + Final i18n
**Goal**: Final dress rehearsal pass — every client-visible transition fires a Telegram notification, Slavic pluralization works, dates render in locale, snapshot tests are green, voice-channel question is pre-empted by a fallback video + "simulate call" button, and the pre-flight checklist closes every demo-day risk.
**Depends on**: Phase 5 (full pipeline runs end-to-end)
**Requirements** (12): I18N-01, I18N-03, I18N-04, I18N-05, NOTIF-01, NOTIF-02, POLISH-01, POLISH-02, POLISH-03, POLISH-04, POLISH-05, POLISH-06
**Success Criteria** (what must be TRUE):
  1. Every order FSM transition (`DRIVER_ASSIGNED`, `AT_LOADING`, `IN_TRANSIT`, `AT_BORDER`, `DELIVERED`) sends the client a Telegram notification using the `I18N-01` RU/UA dictionary with a fresh `/track/[token]` link; the message contains exactly one number that equals the stored field — no LLM paraphrase.
  2. Pluralization tests pass for `0`, `1`, `2`, `5`, `21`, `25` ("Найдено 1 машина / 2 машины / 5 машин"); declension-free templates ("Маршрут: {from} → {to}") render correctly; dates show `8 июн, ср` (RU) and `8 чер, ср` (UA) via `date-fns/locale`.
  3. CI snapshot tests on 20 canonical `extractRequest` + `calcPrice` inputs are green; "simulate inbound call" button in admin plays a canned transcript through the live LLM pipeline, producing a complete lead-to-order flow visually identical to the real Telegram path.
  4. Voice fallback video (pre-recorded ElevenLabs demo) is bundled and accessible from the admin; local-cached map tiles work without internet for the demo route; `LLM_PROVIDER` env can swap Anthropic ↔ OpenAI failover in <30 seconds.
  5. Pre-flight checklist script (`pnpm preflight`) confirms: bot is alive, DB is seeded, simulator starts, both `/track/[token]` URLs respond, `/api/health` returns PostGIS version, RU and UA paths both complete end-to-end in a smoke run.
**Plans**: TBD

---

## Phase Dependencies

```
Phase 1 ──> Phase 2 ──> Phase 3
                │
                ├──> Phase 4 (parallelizable with Phase 3 once API contracts stable)
                │       │
                │       ▼
                └──> Phase 5 (depends on FSM from P2 + admin scaffold from P4)
                        │
                        ▼
                     Phase 6
```

- **Critical path:** 1 → 2 → 5 → 6 (visual + dress rehearsal)
- **Parallel branch:** Phase 4 can start as soon as Phase 2 has stable REST contracts (~mid-P2); admin work runs concurrently with Phase 3 webhook work.
- **Phase 6 is sequential** after Phase 5 — polish/dress rehearsal cannot begin until the full pipeline runs end-to-end.

## Coverage

✓ All 89 enumerated v1 requirements mapped to exactly one phase
✓ No orphans

### Coverage Note

`REQUIREMENTS.md` Coverage section reads "**97 total**" with breakdown `10 + 16 + 5 + 6 + 6 + 7 + 6 + 7 + 7 + 2 + 5 + 2 + 4 + 6`. The arithmetic of that breakdown sums to **89**, not 97. The enumerated requirements (DB-01..10, API-01..16, LOGIC-01..05, MATCH-01..06, FSM-01..06, TG-01..07, ADMIN-01..06, ADMIN-NEW-01..07, TRACK-01..07, PUBLIC-01..02, I18N-01..05, NOTIF-01..02, DEPLOY-01..04, POLISH-01..06) also sum to 89. The "97" appears to be an arithmetic typo; this roadmap is built on the 89 enumerated requirements and updates REQUIREMENTS.md accordingly.

### Coverage by Phase

| Phase | Count | Requirements |
|-------|-------|--------------|
| 1 — DB + Backend Skeleton | 17 | DB-01..10, API-01, API-02, API-16, DEPLOY-01..04 |
| 2 — LLM Pipeline + Core | 18 | API-07, LOGIC-01..05, MATCH-01..06, FSM-01..06 |
| 3 — Telegram Channel | 9 | API-13, API-15, TG-01..07 |
| 4 — Admin Web | 21 | API-03, API-04, API-05, API-06, API-08, API-09, API-10, ADMIN-01..06, ADMIN-NEW-01..07, I18N-02 |
| 5 — Tracking + Public | 12 | API-11, API-12, API-14, TRACK-01..07, PUBLIC-01, PUBLIC-02 |
| 6 — Polish + Notif + i18n | 12 | I18N-01, I18N-03, I18N-04, I18N-05, NOTIF-01, NOTIF-02, POLISH-01..06 |
| **Total** | **89** | |

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Database + Backend Skeleton | 1/11 | Executing | - |
| 2. LLM Pipeline + Deterministic Core | 0/0 | Not started | - |
| 3. Telegram Channel | 0/0 | Not started | - |
| 4. Admin Web | 0/0 | Not started | - |
| 5. Tracking Loop + Live Map + Public | 0/0 | Not started | - |
| 6. Demo Polish + Notifications + Final i18n | 0/0 | Not started | - |

---
*Roadmap created: 2026-06-08 by gsd-roadmapper*
