# Project Research Summary

**Project:** AI-Логист
**Domain:** AI-driven logistics dispatching (Telegram + voice → LLM extract → PostGIS truck matching → deterministic pricing → live GPS tracking → admin web) for RU/UA freight market
**Researched:** 2026-06-08
**Confidence:** HIGH

> Read the four sibling docs ([STACK](./STACK.md), [FEATURES](./FEATURES.md), [ARCHITECTURE](./ARCHITECTURE.md), [PITFALLS](./PITFALLS.md)) for full evidence and sources. This summary is prescriptive, not encyclopedic.

---

## Executive Summary

AI-Логист is a **dispatcher-first TMS** (not a freight marketplace) that uses LLM as a language adapter while keeping money and matching decisions in deterministic code. The four researchers converged unambiguously: **Node.js 22 + TypeScript + Fastify 5 + Drizzle ORM + PostgreSQL 17 + PostGIS 3.5 + Redis 7.4 + grammY 1.43 + Anthropic SDK**, packaged as a **modular monolith** in a `pnpm` workspace, deployed via Docker Compose on a single VM with Caddy + Let's Encrypt. Frontend is already locked by spec §7.1 (Next.js 16 + React 19 + Tailwind v4 + shadcn/ui + Zenith Admin template). The single most consequential architecture decision is the **"LLM tool sandwich"**: every business action is a registered tool with a JSON Schema + Zod sandwich; the LLM cannot mutate state except through validated tools, and prices are rendered from `leads.quoted_price` via templated strings, never paraphrased by the model.

The spec's headline workflow is correct, but **the FEATURES research surfaced six demo-credibility gaps** the spec under-serves: public client-facing tracking link (`/track/[token]`), TTN/CMR PDF stub (legally expected in RU/UA), driver assignment confirmation loop, extended cargo fields (volume / dimensions / ADR / packaging), manager pricing override with audit log, and Proof of Delivery capture. A logistics buyer will spot these in the first 5 minutes. Adding them to v1 is cheap; missing them looks naive next to ATI.SU and Lardi-Trans.

The dominant risk cluster is **Phase 2 (LLM pipeline)** — five critical pitfalls converge there (LLM in money path, FSM races, prompt injection, token-cost runaway, ambiguous-input loops). Phase 5 (Tracking/Demo) carries the next-highest risk (WS reconnect/teleport, fake-looking GPS simulation, voice-pressure during demo). PostGIS has two subtle but lethal mechanics — KNN `<->` sphere distance ≠ `ST_Distance` spheroid, and geography-vs-geometry SRID confusion — that must be locked in Phase 1 with the CTE re-rank pattern. **Build order should front-load PostGIS correctness and the LLM tool registry**, treat Telegram webhook idempotency (by `update_id`) as a non-negotiable Phase 3 invariant, and reserve a dedicated demo-polish phase for WS resilience, GPS realism, and the voice-fallback video.

---

## Key Findings

### Recommended Stack

The Node.js path wins on four converging signals: shared Zod schemas between API and admin, Drizzle's official PostGIS guide (`geometry('point')` + GiST + `<->`), Anthropic SDK's `betaZodTool` + `toolRunner` helper that runs the function-calling loop for free, and grammY's TypeScript-native webhook ergonomics. Python (FastAPI + aiogram + SQLAlchemy + GeoAlchemy2) is the only credible alternative and is appropriate only if the team is Python-heavy. **Fastify over NestJS**: modular monolith with explicit folder boundaries doesn't need NestJS's DI container; Fastify's schema-validated routes match the strict-JSON LLM contract and ship with native WebSocket.

**Core technologies:**
- **Node.js 22 LTS + TypeScript 5.7 strict** — runtime + language; shared with frontend, LTS until Apr 2027
- **Fastify 5.8+** — HTTP framework; schema-validated routes; native `@fastify/websocket`
- **PostgreSQL 17 + PostGIS 3.5** (`postgis/postgis:17-3.5`) — single primary; mandatory for `<->` KNN
- **Drizzle ORM 0.45.2 (pinned)** — has the only first-class PostGIS guide of any TS ORM
- **Redis 7.4 + ioredis 5.11** — FSM scratch state, geocoding cache, BullMQ broker (BullMQ deferred to post-demo)
- **grammY 1.43** — Telegram, webhook-first, TS-native
- **@anthropic-ai/sdk 0.102 (Claude default)** — strict-mode function calling via `betaZodTool`
- **Next.js 16 / React 19 / Tailwind v4 / shadcn/ui** — locked by spec; Zenith Admin template covers 4/8 screens
- **Leaflet + react-leaflet + OSM tiles** — tracking map (free, spec-mandated)
- **pnpm workspaces** monorepo: `apps/api`, `apps/web`, `packages/shared-types`
- **OSRM + Nominatim** (public demo servers, then self-hosted) — zero-cost routing + geocoding for demo

**Defer for demo (must not gold-plate):** BullMQ webhook queue, multi-replica WS via Redis Pub/Sub, Wialon polling, real ATI.SU/Lardi-Trans, ElevenLabs voice, multi-tenancy.

### Expected Features

The spec correctly identifies the headline workflow. The credibility-deciding additions surfaced by competitor analysis (ATI.SU, Lardi-Trans, Project44, DispatchTrack) are listed under "missing from spec."

**Must have (in spec, table stakes):**
- Telegram intake + LLM extract → structured `{from, to, tons, body_type, budget}`
- PostGIS KNN nearest-truck match with capacity/body filter
- Deterministic price (route_km × rate × dir_coef × season_coef, rounded to 50)
- Lead funnel Kanban (NEW → … → DONE/LOST) + Order lifecycle FSM
- Live tracking map (Leaflet + WS, smooth interpolation)
- Fleet/Orders/KPI/Calendar admin pages, RU/UA toggle

**Must add to v1 (missing from spec, demo-credibility gaps — add to roadmap):**
- **Public tracking link** `/track/[order_token]` — no auth, shareable to client
- **TTN/CMR PDF stub** — RU legal + UA cross-border; even mocked, demo feels like a TMS instead of a chatbot
- **Driver assignment confirmation loop** — Telegram message to `driver_phone` with Принять/Отказаться buttons
- **Extended cargo fields** — volume m³, dimensions LxWxH, packaging type, ADR class, declared value (extend `leads` schema even if LLM extracts only some)
- **Manager pricing override + audit log** — `leads.price_overrides jsonb[]` with `{by, at, old, new, reason}`
- **Proof of Delivery section** — signature + photo + GPS placeholder on order detail
- **Global search** (shadcn command palette wired to orders/leads/clients)

**Should have (differentiators, pick 1-2):**
- Price breakdown chip on hover ("route_km=540 × rate=42 × season=1.1 × dir=0.95 = 23,810 → 23,800") — pricing transparency
- LLM transcript → editable summary card — makes "AI-логист" feel like a product, not a chat wrapper
- Smart re-match button (truck breaks down) — screams "built by dispatchers"
- Counterparty verification badge (mock for demo, real Opendatabot UA later)

**Defer (v2+):** real ElevenLabs+SIP voice, real ATI.SU/Lardi-Trans, real Wialon, e-CMR with signatures, multi-tenancy/RBAC, driver native app, full accounting, configurable rule engine.

### Architecture Approach

**Modular monolith** in `apps/api` with 11 internal modules; cross-talk only through public function exports (no reaching into internal files). Channels are dumb adapters normalizing to one `ChannelMessage` type; the pipeline never knows which channel triggered it. The LLM tool registry is the security boundary — `createOrder` only fires if the lead's FSM is in `AGREED`, the FSM is `SELECT … FOR UPDATE` inside a transaction, and `quoted_price` is re-read from DB inside that transaction (never from LLM args). A single in-memory `WsHub` (subscribe-by-topic-with-filter) fans out `/ws/tracking` and `/ws/inbox`; swap to Redis Pub/Sub later when scaling to multiple instances — public surface unchanged. Geofencing uses `ST_DWithin` (index-friendly) with idempotency from a `UNIQUE (order_id, type)` constraint on `order_events`.

**Major components (modules):**
1. `channels/{telegram,voice,gps}` — webhook parsers, outbound formatters, normalize to `ChannelMessage`
2. `pipeline/intake` + `pipeline/llm-tools` — language detect, client upsert, tool registry, dialog orchestration
3. `matching` — PostGIS KNN nearest-truck (CTE re-rank pattern), bourse stub fallback
4. `pricing` — `calcPrice` pure function with corridor (min/max)
5. `lifecycle/lead-fsm` + `lifecycle/order-fsm` — hand-rolled transition tables + audit log
6. `tracking` — geofence checks (`ST_DWithin`), position upserts, WS publish
7. `notification` — outbound message routing (Telegram now, SMS/email later)
8. `admin-api` REST + WS Hub — thin validate-and-delegate routes
9. `persistence/repos` — hand-written SQL through Drizzle for rich PostGIS queries
10. `admin-web` (Next.js 16) — SSR `page.tsx`, single client container `_components/<feature>-app.tsx` for interactivity
11. `lib/{routing,geocoding,i18n}` — OSRM/Mapbox adapter, geocoder + cache, server-side RU/UA dict

**Deployment topology (demo):** single 4 vCPU / 8GB VM, docker-compose with `api`, `web`, `postgres+postgis`, `redis`, `caddy` (HTTPS auto-ACME) — ~$20/mo Hetzner or DO. Single Caddy = one cert = no LB to debug at demo time.

### Critical Pitfalls

Top demo-killers from PITFALLS.md. Each maps to a phase.

1. **LLM in the money path (price hallucination/drift)** — Hard rule: `calcPrice` runs server-side, result stored in `leads.quoted_price` *before* any LLM response; LLM message is rendered from a string template citing `quoted_price` verbatim, NOT generated. Post-LLM regex guard rejects any number that ≠ `quoted_price`. Snapshot tests on `extractRequest` + `calcPrice` (20 canonical inputs) in CI. **Phase 2.**
2. **PostGIS KNN sphere ≠ ST_Distance spheroid + extension/SRID confusion** — Use Crunchy Data CTE re-rank pattern: overfetch 20 by `<->` (sphere, GiST-accelerated), then re-rank by `ST_Distance(..., true)` (spheroid). `CREATE EXTENSION postgis;` in its own migration before any table. Pin to `geography(Point, 4326)` everywhere; CHECK constraint on SRID; `/api/health` returns `PostGIS_Version()`. **Phase 1.**
3. **Telegram webhook duplicates + FSM races** — Two-stage handler: persist `{update_id, payload}` with `ON CONFLICT (update_id) DO NOTHING`, return 200 in <100ms, worker processes async. Per-client serialization via `pg_advisory_xact_lock(hashtext(client_id))`. FSM transitions wrapped in `SELECT … FOR UPDATE` transaction with version column. **Phase 2 (FSM) + Phase 3 (webhook).**
4. **Bilingual RU/UA detection on Surzhyk/short messages** — Detect ONCE per client on first ≥20-char message, then sticky in `clients.lang`. Two-detector vote (fastText + Cyrillic-script heuristic for є/і/ї/ґ). Pre-seed `cities` with `name_ru`/`name_ua` pairs (Киев↔Київ, Львов↔Львів); ILIKE both columns before geocoding. **Phase 2.**
5. **Next.js 16 + Tailwind v4 + shadcn integration traps** — `page.tsx` is server (SSR fetch), `_components/<feature>-app.tsx` is the sole client boundary; Leaflet via `next/dynamic ssr: false` inside it. Never `'use cache'` on `/tracking`, `/chat`, `/kanban`, `/orders` (grep guard in CI). Use `border-border` explicitly (Tailwind v4 changed default border color). **Phase 4.**
6. **Demo brittleness cluster — WS reconnect, GPS realism, voice pressure** — SSR-fetch initial state, WS for deltas only; exponential-backoff reconnect (1/2/4/8/30s) + 25s heartbeat ping + `visibilitychange` refetch. GPS simulator snaps to OSRM polyline with variable speed (50-80km/h highway, 20-30 city) + ±5m noise + 10-30s push cadence. Pre-recorded voice demo video as fallback; stub `/webhook/voice` end-to-end with "simulate inbound call" button. **Phase 5 + Demo polish.**

Other notable pitfalls covered in PITFALLS.md: prompt injection (tools-as-security-boundary), token-cost runaway (per-lead ledger + truncate-to-N-turns + summary), geocoding ambiguity (country bias + top-3 bounded confirmation), i18n pluralization (ICU MessageFormat with Slavic one/few/many rules + declension-free templates).

---

## Implications for Roadmap

Build order refines spec §9 by front-loading PostGIS correctness, treating the LLM tool layer as the security boundary, and reserving a dedicated demo-polish phase.

### Phase 1: Database + Backend Skeleton (Foundation)
**Rationale:** PostGIS correctness is the bedrock — Pitfall 2 (KNN sphere/spheroid) and Pitfall 3 (extension/SRID) are unrecoverable if discovered late. Every other phase depends on the schema being right.
**Delivers:** docker-compose with `postgis/postgis:17-3.5`, Fastify app skeleton, Drizzle schema + migrations for §2 model (extended with missing fields: cargo dimensions/ADR/packaging, `price_overrides jsonb[]`, POD blob, `tax_id`/`tax_id_country`), GiST index on `trucks.geom`, seed script (10-15 trucks, top 30 RU/UA cities + border crossings, 5-10 clients), repos, `/api/health` returning `PostGIS_Version()`.
**Avoids:** Pitfall 3 (extension/SRID lock), Pitfall 2 (CTE re-rank pattern documented and used in `matching/nearest-truck.ts` template).
**Exit:** `SELECT … ORDER BY geom <-> :pickup LIMIT 3` returns plausible trucks from psql.

### Phase 2: LLM Pipeline + Deterministic Core (Highest Risk)
**Rationale:** This is the system's brain and where most demo-killers live. Five critical pitfalls cluster here (1, 4, 6, 11, 12). Must be locked before Telegram channel can be wired safely.
**Delivers:** `matching.nearestTruck` (CTE re-rank), `pricing.calcPrice` (integer kopecks, corridor), LLM tool registry with strict JSON Schema + Zod sandwich, `extractRequest` tool with confidence fields and clarification budget, `lead-fsm` + `order-fsm` with `SELECT … FOR UPDATE` + version column + audit log, sticky RU/UA language detection per client, prompt-injection-proof tool validation (`createOrder` re-reads `quoted_price` from DB), per-lead token ledger.
**Avoids:** Pitfalls 1, 4, 6, 7, 11, 12.
**Exit:** Snapshot tests on 20 canonical inputs are stable across 10 runs; concurrent transition test (2 simultaneous events on same lead, exactly 1 succeeds); a script-driven dialog harness moves a lead end-to-end to `ORDER_CREATED`.

### Phase 3: Telegram Channel
**Rationale:** Now safe to expose the pipeline because tools enforce the security boundary and the FSM survives races.
**Delivers:** grammY webhook with `secret_token` verification, two-stage handler (persist `update_id` with `ON CONFLICT DO NOTHING`, return 200 <100ms, inline worker processes), inline keyboards (Подтвердить/Отказаться), driver-confirmation loop (Telegram to `driver_phone` if `telegram_id` set, else simulator stub), per-client `pg_advisory_xact_lock` serialization, manager intervention path.
**Avoids:** Pitfall 5 (idempotency on `update_id`, immediate 200 ack).
**Exit:** Replay same `update_id` → exactly 1 lead row. Real Telegram chat completes full pipeline; manager can take over from admin.

### Phase 4: Admin Web (Zenith Template + 3 New Pages)
**Rationale:** Backend has stable API surface; admin can be built in parallel from this point. Sets Next.js 16 / Tailwind v4 / shadcn conventions on the first new page (`/dashboard/fleet`) so the rest inherit.
**Delivers:** Forked `next-shadcn-admin-dashboard`, wire `/dashboard/chat` to `/api/clients/:id/messages` + `/ws/inbox`, wire `/dashboard/kanban` to `/api/leads` (DnD = PATCH stage, FSM rejects illegal moves), wire `/dashboard/default` + `/analytics` to `/api/analytics/kpi`. New pages: `/dashboard/fleet` (CRUD + phone-input + plate validation), `/dashboard/orders` + `/dashboard/orders/[id]` (timeline + POD section + TTN/CMR PDF preview button), `/dashboard/tracking` (Leaflet + WS, SSR initial). Price override modal with reason field → audit log. Global search (command palette). RU/UA dict wired to template's Customize panel.
**Avoids:** Pitfall 13 (SSR boundary, no `'use cache'` on live pages, Tailwind v4 border color, CI guards).
**Exit:** Kanban shows real leads; dragging updates FSM; `pnpm exec tsc --noEmit` clean; visual check in both light/dark + RU/UA.

### Phase 5: Tracking Loop + Live Map
**Rationale:** Depends on order FSM (Phase 2) and admin scaffolding (Phase 4). Visually most impressive; carries Pitfalls 9 and 10 (WS resilience + GPS realism).
**Delivers:** `tracking.ingestPosition`, `geofence.isInZone` via `ST_DWithin`, in-memory `WsHub` with topic+filter subscriptions, `/ws/tracking` + `/ws/inbox`, exponential-backoff reconnect + 25s heartbeat + visibilitychange refetch on client, GPS simulator CLI that snaps to OSRM polyline with variable speed + ±5m noise + 10-30s cadence + stops at loading/border geofences for 5-15min, auto FSM transitions on geofence entry, client notifications on transitions.
**Avoids:** Pitfalls 9 (WS reconnect/teleport), 10 (fake-looking GPS).
**Exit:** Run simulator → admin map updates live → order auto-transitions on geofence → client gets Telegram notification.

### Phase 6: Demo Polish + Bilingual Final Pass
**Rationale:** Pre-empts Pitfalls 14 (voice pressure) and 15 (i18n) plus the demo-specific risk register.
**Delivers:** ICU MessageFormat pluralization (one/few/many) in admin + Telegram replies, declension-free templates, date-fns locale per `clients.lang`, voice-fallback pre-recorded video + "simulate inbound call" button in admin that plays a canned transcript through the LLM pipeline, end-to-end demo script exercising both RU and UA, pre-flight checklist, two LLM providers configured (Anthropic + OpenAI failover), local-cached map tiles, fresh Telegram bot with QR code, snapshot tests + visual diff in CI.
**Avoids:** Pitfalls 14, 15.

### Phase Ordering Rationale

- **Linear chain Phase 1 → 2 → 3** mirrors the data-flow: schema must be right before pipeline, pipeline must be safe before exposing webhooks.
- **Phase 4 (admin) can start in parallel after Phase 2** completes the LLM-tool/FSM contracts and stable REST surface.
- **Phase 5 depends on Phase 2 (order FSM) and Phase 4 (admin scaffolding).**
- **Phase 6 is sequential after Phase 5** — polish/dress rehearsal cannot start until the full pipeline runs end-to-end.
- **Bilingual is split:** sticky language detection + server-side dict in Phase 2, pluralization/locale-aware dates + UI strings polish in Phase 6.
- **Voice channel deferred entirely from demo** per spec §5.2 — fallback video in Phase 6 absorbs the pitch question.

### Research Flags

**Phases likely needing deeper research during planning (`/gsd:research-phase`):**
- **Phase 2 (LLM Pipeline)** — Anthropic `betaZodTool` production patterns, prompt-injection adversarial test set design, conversation summarization for token-cost control.
- **Phase 5 (Tracking Loop)** — Leaflet smooth-marker-interpolation libraries, OSRM self-hosting footprint, WebSocket reconnect/heartbeat patterns for Next.js 16 + Fastify v5.

**Phases with standard patterns (skip dedicated research):**
- **Phase 1 (DB skeleton)** — Drizzle PostGIS guide is canonical; CTE re-rank pattern documented in PITFALLS.md.
- **Phase 3 (Telegram)** — grammY webhook docs + `update_id` idempotency pattern are well-trodden.
- **Phase 4 (Admin)** — Zenith Admin template's own `CLAUDE.md` documents the SSR + client-container convention.
- **Phase 6 (Demo polish)** — `i18next` ICU + `date-fns` locale patterns are standard.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Four converging signals (frontend lock, Drizzle PostGIS guide, Anthropic Zod helper, grammY TS-native); all versions verified via official docs |
| Features | MEDIUM-HIGH | Spec features verified; 6 demo-credibility gaps identified from ATI.SU / Lardi-Trans / Project44 / DispatchTrack analysis and RU/UA market norms (ТТН, CMR, EDRPOU, ADR) |
| Architecture | HIGH on module boundaries, FSM, PostGIS geofencing, Next.js SSR/WS boundary; MEDIUM on queueing/idempotency at demo scale |
| Pitfalls | HIGH on PostGIS / Telegram / Next.js 16 mechanics (verified against official docs and PostGIS tickets); MEDIUM on demo-staging risks |

**Overall confidence:** HIGH for build path; MEDIUM-HIGH for feature completeness.

### Gaps to Address in Requirements Phase

- TTN/CMR template fidelity (real RU legal form vs stylized demo PDF?)
- Driver delivery mechanism for demo (real Telegram for one demo-driver vs simulator-only?)
- Counterparty verification scope (mock badge only vs wire Opendatabot for UA EDRPOU?)
- POD capture flow (manager via admin vs driver via Telegram?)
- ADR demo lead (seed one hazmat lead to display the field?)
- Pricing config seed values (`rate_per_km`, `dir_coef`, `season_coef` realistic ranges for RU↔UA market?)
- Public tracking page UX (map+status only or "rate this delivery" CTA?)

---

## Sources

Full source lists are in the four sibling research docs. Highlights:

**Primary (HIGH confidence):**
Drizzle ORM PostGIS guide · PostGIS docs (ST_Distance, ST_DWithin, KNN `<->`) + ticket #3127 · Crunchy Data KNN deep dive · Fastify v5 migration guide · PostgreSQL 17 release notes · Anthropic SDK TypeScript helpers (`betaZodTool`, `toolRunner`) · OpenAI Structured outputs · grammY docs + comparison · Telegram webhooks reference · tdlib issue #837 · OWASP LLM01:2025 · Next.js 16 release notes · shadcn discussion #2996 · XState docs · "You don't need a library for state machines" (Khourshid).

**Secondary (MEDIUM confidence):**
2026 framework comparisons (Fastify vs NestJS vs Hono; Drizzle vs Prisma; BullMQ vs alternatives; Caddy vs Traefik) · Competitor analysis (ATI.SU, Lardi-Trans, Project44, Motive) · TMS feature standards (Cargoson, Dashdoc CMR, Trimble e-CMR) · POD & exception management writeups · RU/UA market (Opendatabot, Neolit Lardi-Trans) · Surzhyk corpus study · fasttext-langdetect.

**Project sources:**
`ai-logist-logic-spec.md` (single source of truth) · `.planning/PROJECT.md`.

---
*Research completed: 2026-06-08*
*Ready for roadmap: yes*
