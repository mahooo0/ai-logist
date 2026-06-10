# Phase 4 — Admin Web (REDUCED scope — chat + calls + orders + KPI) — Phase Summary

**Phase:** 4 of 6
**Status:** Complete (pending UAT-05 sign-off)
**Started:** 2026-06-10
**Completed:** 2026-06-10
**Risk profile:** MEDIUM (Pitfall #13 — Next.js 16 + Tailwind v4 + shadcn integration traps)

## Scope (what was promised)

Demo-supporting admin showing what voice + Telegram channels produced: multi-channel chat (Telegram threads + voice transcripts with inline audio), calls table with filters and audio/transcript drill-down, orders table + read-only detail page, KPI dashboards. Reduced from the original 8-page admin per the 2026-06-09 pivot — kanban/fleet/calendar/tracking deferred to v2 so the team could focus on the voice+telegram demo loop.

13 requirements (all closed this phase):

| Requirement | Description |
|-------------|-------------|
| API-03 | `GET /api/leads` (filter by stage + channel) |
| API-04 | `GET /api/orders` + `/:id` (joined: cities + client + truck + events) |
| API-05 | `GET /api/trucks` (read-only) |
| API-06 | `GET /api/clients/:id/messages` (UNION telegram + voice transcript turns) |
| API-09 | `GET /api/analytics/kpi` (extended schema: avgCallDurationS + byChannel + conversionFunnel) |
| ADMIN-01 | Fork Zenith template (`mahooo0/next-shadcn-admin-dashboard`) |
| ADMIN-02 | Auth via `/auth/v1/login` (env-set login/password, single-user) |
| ADMIN-03 | `/dashboard/chat` multi-channel (Telegram + Voice in one timeline) |
| ADMIN-05 | `/dashboard/default` + `/dashboard/analytics` KPI |
| ADMIN-NEW-02 | `/dashboard/orders` table with channel + status filters |
| ADMIN-NEW-03 | `/dashboard/orders/[id]` detail + timeline + channel breadcrumb |
| ADMIN-NEW-08 | `/dashboard/calls` table + detail modal with audio + transcript |
| I18N-02 | Customize-panel RU/UA toggle + dictionary |

## What shipped

| Plan | Wave | Highlights |
|------|------|-----------|
| 04-00 | 0 | Test infra: apps/web vitest + happy-dom + @testing-library/react + 7 integration scaffolds + 13 phase-4-stub markers + 5 LIVE static-rules grep guards |
| 04-01 | 1 | Zenith vendored: full src/ + public/ + components.json + tailwind/postcss/next/tsconfig copy. VENDOR.md records exact git SHA. pnpm workspace merge. Phase 1 placeholder removed. |
| 04-02 | 2 | Auth via `proxy.ts` (Next.js 16 native — Pitfall #4); bcryptjs + jose; login/logout routes; lib/api.ts (server/client auto-routing fetcher); lib/i18n/dict.ts + useT() hook; sidebar trimmed to 5 nav items (D-49). |
| 04-03 | 1 (parallel with 04-02) | Backend handlers: 6 routes flipped from 501-stub. NEW `apps/api/src/routes/calls.ts`. NEW `OrderListItemSchema` + `ExtendedOrderDetailSchema` + extended `KpiResponseSchema`. UNION query in `GET /api/clients/:id/messages`. |
| 04-04 | 3 | `/dashboard/chat` near-rewrite of Zenith mock-chat → real UNION + audio seek + manager intercept; `/dashboard/calls` new (table + filters + modal + audio seek). ADMIN-03 + ADMIN-NEW-08 flipped. |
| 04-05 | 3 (parallel with 04-04) | `/dashboard/orders` + `/orders/[id]` new pages; `/dashboard/default` + `/dashboard/analytics` rewired to KPI API; 5 recharts with `'use client'` boundary. ADMIN-NEW-02 + ADMIN-NEW-03 + ADMIN-05 flipped. |
| 04-06 | 4 | README updates + apps/web/README + HUMAN-UAT-05 + VALIDATION sign-off + REQUIREMENTS traceability flip + STATE entry + 04-PHASE-SUMMARY + checkpoint:human-verify. |

## Tests

- **Frontend (NEW for Phase 4):** `pnpm --filter @ai-logist/web test` — vitest 4 + happy-dom + @testing-library/react; 5 static-rules grep guards + pages-smoke (6 pages) + i18n (3) + auth (4 proxy + 5 login) + use-t (3). 28 passed | 0 todo.
- **Backend integration (Docker-gated):** `pnpm --filter @ai-logist/api test:integration` — 7 new files (leads-list / orders-list / orders-detail / trucks-list / clients-messages-union / analytics-kpi / calls-list). Skipped under AI_LOGIST_NO_DOCKER=1; verifier runs on Docker host.
- **Backend unit:** apps/api 200 passed | 0 todo.
- **Stub markers:** 13 → 12 → 10 → 5 → 3 → 0 (monotonically decreasing per wave per Plan 04-00 schedule).

## Pitfall #13 escape

All trip-wires defused (5 CI grep guards GREEN against final tree):

- No `'use cache'` on `/chat`, `/calls`, `/orders`, `/orders/[id]` (dynamic pages must stay fresh)
- `'use cache'` allowed on `/default` + `/analytics` (KPI aggregated — D-13)
- `border-border` explicit everywhere (Tailwind v4 default-color change)
- Server/client boundary correct: `page.tsx` is always server; `_components/*-app.tsx` is the SOLE client boundary
- Next.js 16 async `cookies()/headers()/params/searchParams` — no sync usage
- `proxy.ts` matcher gates `/dashboard/:path*` only, excludes `/api/*` and `/auth/*`

## Architecture (locked decisions — see CONTEXT for full 67 D-* list)

- **Vendor:** Zenith verbatim under `apps/web/src/`; `apps/web/VENDOR.md` records exact SHA + deps snapshot + re-vendoring procedure
- **Auth:** single-user env (`ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH` + `AUTH_COOKIE_SECRET`); bcryptjs cost-12 + jose HS256 12h cookie `al_session`; `proxy.ts` Next.js 16 native (not deprecated `middleware.ts`)
- **Data fetching:** Server Component initial fetch via `apiGet<Schema>(path, schema)` (auto-routes server → `API_INTERNAL_URL`, client → `/api/*`) + Client SWR with locked polling intervals (5/15/30/10/60s) + tab-visibility pause
- **No WebSocket in Phase 4** — deferred to Phase 5 polish (`/ws/inbox`, `/ws/tracking`)
- **Multi-channel chat (API-06):** UNION of `messages` rows + `calls.transcript` jsonb turns ordered by `created_at` ASC; voice turns carry `callId` + `timestampMs` + `audioUrl` so the UI can seek `<audio currentTime>` per turn click (D-26)
- **Recharts** wired as a single `'use client'` boundary in `analytics-app.tsx` (Pitfall #6 — recharts can't render server-side)
- **i18n** via Zustand `usePreferencesStore.language` + `lib/i18n/dict.ts` + `useT()` hook; ICU pluralization + date-fns/locale deferred to Phase 5 (I18N-03 + I18N-04)
- **Sidebar trimmed** to 5 v1 nav items (Default / Analytics / Chat / Calls / Orders); 10 non-Phase-4 entries commented out in `sidebar-items.ts` for v2 re-enabling (D-48 + D-49)

## Files created (highlights)

- 50+ source files in `apps/web/src/` (Zenith vendored + 6 new dashboard pages + their `_components/`)
- 1 new backend route: `apps/api/src/routes/calls.ts`
- 1 new shared-types module: `packages/shared-types/src/api/calls.ts`
- Extended: `packages/shared-types/src/api/{orders,analytics,leads}.ts`
- 7 backend integration test files + 12 frontend unit test files
- `apps/web/VENDOR.md` + `apps/web/README.md` + `apps/web/.env.example`
- `apps/web/src/proxy.ts` + `apps/web/src/lib/{api,auth,format}.ts` + `apps/web/src/lib/i18n/{dict.ts,use-t.ts}`
- `apps/web/scripts/gen-admin-password.ts` + `pnpm gen:admin-password` script
- `README.md` ## Admin Dashboard Dev Setup section
- `HUMAN-UAT-05.md` 8-step end-to-end protocol
- `04-PHASE-SUMMARY.md` (this file)

## Commits

Per-plan task commits + per-plan metadata commits (atomic via `/gsd:execute-phase`):

- Plan 04-00 — Test infra: `87af5bd` + `c4b5e1d`
- Plan 04-01 — Zenith vendor: `5332d1c` + `60a62fa`
- Plan 04-02 — Auth + lib primitives: `daa2aa8` + `e230384`
- Plan 04-03 — Backend handlers: (see plan SUMMARY)
- Plan 04-04 — Chat + calls pages: `565e31b` + `00db56c`
- Plan 04-05 — Orders + KPI pages: `0853ba7` + `a8a03b7`
- Plan 04-06 — UAT gate: `8db67dc` (Task 1 docs) + (final metadata commit)

## What's deferred (to v2 per 2026-06-09 pivot)

- **ADMIN_V2-KANBAN** — `/dashboard/kanban` with DnD funnel
- **ADMIN_V2-FLEET** — fleet CRUD + libphonenumber-js phone input
- **ADMIN_V2-CALENDAR** — loading/unloading schedule
- **ADMIN_V2-TRACKING** — Leaflet + `/ws/tracking` (also blocked by Phase 5 WS landing)
- **ADMIN_V2-SEARCH** — global ⌘K
- **ADMIN_V2-PRICE-OVERRIDE** — modal with audit reason → `price_overrides`
- **ADMIN_V2-TTN-PDF** — TTN/CMR PDF generator stub
- **ADMIN_V2-ORDER-CREATE** — POST /api/orders manual order creation

## What's deferred (to Phase 5 polish)

- WebSocket push (`/ws/inbox` + `/ws/tracking`) — Phase 4 uses SWR polling
- ICU pluralization (I18N-03)
- date-fns/locale formatted dates (I18N-04)
- POLISH-02 "Simulate call" button
- POLISH-03 Voice fallback video

## UAT-05 outcome

**PENDING** — see `HUMAN-UAT-05.md` for the 8-step protocol. Expected ~15 min on a clean docker stack. UAT-05 storyboard:

1. login → /dashboard/default with KPI tiles
2. navigate all 6 pages without console errors
3. real Telegram lead → admin reflects within 15s
4. real Twilio voice call → call row + audio + transcript seek
5. order detail → breadcrumb routes to chat (TG) or calls (Voice)
6. manager intercept end-to-end through Phase 3 endpoints
7. Customize panel RU↔UA toggle persists across refresh
8. Pitfall #13 grep guards + Phase 4 stub gate green

On PASS, run `/gsd:transition` to close Phase 4 and advance STATE.md to Phase 5.

---

*Phase 4 complete: 2026-06-10.*
*Next phase: 5 — Demo Polish + Notifications + Final i18n + WebSocket push + Live Tracking + Public Link.*
