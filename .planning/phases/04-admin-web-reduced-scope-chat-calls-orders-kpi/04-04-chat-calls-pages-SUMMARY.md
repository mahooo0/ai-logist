---
phase: 04-admin-web-reduced-scope-chat-calls-orders-kpi
plan: 04
subsystem: web
tags: [next-app-router, react-19, swr, tanstack-table, server-components, zod, audio-playback, manager-intercept]

requires:
  - phase: 04-admin-web-reduced-scope-chat-calls-orders-kpi
    plan: 02
    provides: apiGet helper + formatDate/formatDuration + useT i18n hook + auth proxy
  - phase: 04-admin-web-reduced-scope-chat-calls-orders-kpi
    plan: 03
    provides: /api/clients/:id/messages UNION + /api/calls list + detail + /api/leads channel filter
  - phase: 03-telegram-channel
    provides: POST intercept + manager-message + release endpoints (TG-06)

provides:
  - /dashboard/chat Server Component + UNION messages timeline + audio seek + manager intercept (TG-only per D-47) — ADMIN-03
  - /dashboard/calls Server Component + filtered table + detail modal with audio + transcript seek — ADMIN-NEW-08
  - LeadSchema.managerActive field exposed end-to-end (Rule 2 deviation)
  - useT vi.mock for component smoke tests (geist-font import gap workaround)

affects: 04-06-uat-gate (Wave 5 UAT can exercise chat + calls fully)

tech-stack:
  added: []  # all deps shipped by Plan 04-01 / 04-02
  patterns:
    - "Server Component fetches initial UNION timeline + passes to SOLE 'use client' boundary _components/chat-app.tsx (Pitfall #13)"
    - "Single <audio> per call — render only on the FIRST turn for each callId; subsequent turns reuse the ref via a shared Map (D-26)"
    - "Audio seek via audio.currentTime = timestampMs/1000 + audio.play().catch — user-gesture covers Chrome autoplay restriction (Pitfall #8)"
    - "Voice channel threads NEVER show intercept (D-47) — guard at thread-view boundary, NOT a backend concern"
    - "URL-bookmarkable filters for /dashboard/calls — searchParams parsed server-side via CallListQuerySchema.safeParse + router.push on change (D-29)"
    - "SWR refreshInterval + isPaused on document.visibilityState (D-56/D-57) — chat active 5s, chat list 15s, calls 30s"
    - "Component smoke tests via React.createElement + dynamic import + vi.mock for next/navigation + swr + @/lib/i18n/use-t"

key-files:
  created:
    - apps/web/src/app/(main)/dashboard/chat/_components/thread-list.tsx
    - apps/web/src/app/(main)/dashboard/chat/_components/thread-view.tsx
    - apps/web/src/app/(main)/dashboard/chat/_components/voice-turn.tsx
    - apps/web/src/app/(main)/dashboard/chat/_components/telegram-message.tsx
    - apps/web/src/app/(main)/dashboard/chat/_components/manager-input.tsx
    - apps/web/src/app/(main)/dashboard/calls/page.tsx
    - apps/web/src/app/(main)/dashboard/calls/_components/calls-app.tsx
    - apps/web/src/app/(main)/dashboard/calls/_components/calls-table.tsx
    - apps/web/src/app/(main)/dashboard/calls/_components/calls-filters.tsx
    - apps/web/src/app/(main)/dashboard/calls/_components/call-detail-modal.tsx
  modified:
    - apps/web/src/app/(main)/dashboard/chat/page.tsx (Server Component rewrite — UNION fetch via apiGet)
    - apps/web/src/app/(main)/dashboard/chat/_components/chat-app.tsx (near-rewrite — drops Zenith mock store, consumes UNION API + SWR + intercept)
    - apps/api/src/routes/leads.ts (LIST + PATCH SELECTs + serializer expose manager_active)
    - apps/api/src/routes/calls.ts (linkedLead serializer adds managerActive)
    - apps/api/src/routes/orders.ts (OrderDetailExtended.lead serializer adds managerActive)
    - packages/shared-types/src/api/leads.ts (LeadSchema gains managerActive: boolean)
    - apps/web/tests/unit/pages-smoke.test.ts (chat + calls smoke tests + useT mock)
    - apps/api/tests/unit/phase-4-stubs.test.ts (ADMIN-03 + ADMIN-NEW-08 flipped — folded into Plan 04-05 commit a8a03b7)
  deleted:
    - apps/web/src/app/(main)/dashboard/chat/_components/channel-icon.tsx (Zenith mock orphan)
    - apps/web/src/app/(main)/dashboard/chat/_components/chat-thread.tsx (Zenith mock orphan)
    - apps/web/src/app/(main)/dashboard/chat/_components/conversation-list.tsx (Zenith mock orphan)
    - apps/web/src/app/(main)/dashboard/chat/_components/conversations-rail.tsx (Zenith mock orphan)
    - apps/web/src/app/(main)/dashboard/chat/_components/customer-panel.tsx (Zenith mock orphan)

key-decisions:
  - "LeadSchema.managerActive added end-to-end (Rule 2 deviation): the DB column existed since Phase 1 migration 0002 but the /api/leads response never exposed it. The chat UI cannot decide whether to show Перехватить vs Вернуть боту without it. Updated LeadSchema + leads.ts/calls.ts/orders.ts SELECT + serializer."
  - "Audio per call, not per turn (D-26): renderedCalls Set tracked at thread-view level; VoiceTurn receives mountAudio prop deciding whether to render the <audio>. Map of refs shared so any turn's Play button seeks the existing element."
  - "D-47 voice intercept guard lives at thread-view, NOT backend: backend doesn't know which UI surfaces the lead. Frontend checks `lead.channel !== 'voice' && lead.channel !== 'call'` (handles legacy 'call' rows from Phase 1)."
  - "useT vi.mock in pages-smoke (Rule 3 deviation): the real useT imports usePreferencesStore which imports geist/font/pixel; geist's directory-export breaks Node ESM in vitest happy-dom. Smoke tests don't exercise language switching — identity stub keeps them runnable without making jsdom resolve geist."
  - "Zenith chat-app delete-and-rewrite per Pitfall #9: Zenith shipped a Zustand store + WA/IG/email/SMS mock channels. Wiring our UNION API into it would have meant rewriting most of it anyway. The clean rewrite + deletion of 5 orphan components is cheaper than incremental adaptation."

patterns-established:
  - "Single-audio-per-call pattern (D-26): tracked via Map<callId, HTMLAudioElement> shared across multiple VoiceTurn instances; mount-once gate via renderedCalls Set"
  - "Frontend-enforced channel guard for intercept controls (D-47): pure UI concern; no backend coupling needed because the API endpoints don't refuse voice-channel intercepts (they're just never invoked)"
  - "useT mock idiom for component smoke tests: identity stub with explicit dict subset — fast, no transitive ESM resolution"

requirements-completed: [ADMIN-03, ADMIN-NEW-08]

duration: ~15min
completed: 2026-06-10
---

# Phase 4 / Plan 04-04: Chat + Calls Pages Summary

**2 dashboard surfaces shipped — /dashboard/chat (mixed Telegram + voice timeline with audio playback + manager intercept) and /dashboard/calls (table + filters + detail modal). Closes ADMIN-03 + ADMIN-NEW-08. Combined with Plan 04-05's parallel work, the Phase 4 stub marker count is 0 — Phase 4 frontend is feature-complete.**

## Performance

- **Duration:** ~15 min (2 task commits + this metadata commit)
- **Started:** 2026-06-10 22:31Z
- **Completed:** 2026-06-10 22:45Z
- **Tasks:** 2 (chat rewire, then calls new pages + stub flips)
- **Files created:** 10 (5 chat components + 5 calls components)
- **Files modified:** 7 (chat page.tsx + chat-app.tsx + 3 backend routes + 2 test files)
- **Files deleted:** 5 (orphan Zenith chat-app dependencies)

## Accomplishments

- **/dashboard/chat** — Replaces Zenith's Zustand + mock-channels chat with our UNION API consumer. Server Component fetches the active thread's UnifiedMessage[] via apiGet from /api/clients/:id/messages. Client orchestrator (chat-app.tsx) is the SOLE 'use client' boundary; SWR refreshInterval=5000 on the active thread + 15000 on the leads index; tab-visibility pause via isPaused. Thread list dedupes leads to one row per client with a channel icon (TG green vs Voice purple).
- **Mixed timeline rendering** — Telegram messages render via `<TelegramMessage>` (green TG badge + plain text bubble); voice transcript turns render via `<VoiceTurn>` (purple Voice badge + monospace transcript + inline ▶ Play button). The Play button seeks `audio.currentTime = msg.timestampMs / 1000` and resumes playback. Per-call audio element mounts ONCE (on the first turn for each callId); subsequent turns reuse the shared ref via a Map.
- **Manager intercept (TG-only per D-47)** — When `activeLead.channel === 'telegram'` AND `activeLead.managerActive === false`, the header shows the Перехватить button → POST /api/leads/:id/intercept → SWR mutate refreshes both messages + lead. When manager is active, the input box is replaced with `<ManagerInput>` (placeholder via useT('chat.managerMessagePlaceholder')) submitting to POST /api/leads/:id/manager-message; the header swaps in a Вернуть боту button → POST /api/leads/:id/release. Voice channel threads NEVER expose any of these controls.
- **/dashboard/calls** — Brand-new page. Server Component parses searchParams via CallListQuerySchema.safeParse + apiGet returns z.array(CallSchema). Client orchestrator runs SWR refreshInterval=30000 per D-56. Filters (outcome / lang / date preset) call `router.push` to update URL search params (D-29 bookmarkable).
- **CallsTable** — @tanstack/react-table with D-28's 6 columns: timestamp (formatDate ru), masked phone (last 4 of twilio_call_sid as a stand-in until v2 joins clients + libphonenumber-js), lang badge (RU/UA outline), duration mm:ss via formatDuration, outcome color-coded Badge (green/yellow/blue/red), linked_order arrow/em-dash. Row click sets selectedCallId.
- **CallDetailModal** — shadcn Dialog (D-30). Top: 2×2 metadata grid + `<audio controls preload="metadata">`. Middle: scrollable transcript where each turn is a button → seek + play (D-26). Bottom: linked-lead → `/dashboard/chat?clientId=…` and linked-order → `/dashboard/orders/…` buttons (asChild + `<a>`).
- **Backend exposure of manager_active (Rule 2 deviation)** — `LeadSchema` gains `managerActive: z.boolean().default(false)`. The DB column existed since Phase 1 migration 0002 with `NOT NULL DEFAULT false`, but the GET /api/leads response and the embedded leads inside CallDetail + OrderDetailExtended did not surface it. Three serializer paths updated: leads.ts list + PATCH (with SELECT clause), calls.ts linkedLead, orders.ts OrderDetailExtended.lead.
- **5 orphan Zenith mock components deleted** — channel-icon, chat-thread, conversation-list, conversations-rail, customer-panel. Their data source (`@/data/chat`) is gone from imports.
- **Phase 4 stub marker count: 0** — Plan 04-04's ADMIN-03 + ADMIN-NEW-08 flips were folded into Plan 04-05's parallel commit a8a03b7 (they noticed the chat code shipped without the test file and helped close the loop). All 13 Phase 4 reqs now have green it() assertions in phase-4-stubs.test.ts.

## Task Commits

1. **Task 1: /dashboard/chat rewire — mixed-timeline + audio seek + manager intercept (ADMIN-03)** — `565e31b`
2. **Task 2: /dashboard/calls page + CallDetailModal + useT smoke mock (ADMIN-NEW-08)** — `00db56c`
3. **Plan metadata** — `[this commit]` (docs(04-04): complete chat-calls-pages plan)

## Decisions Made

- **LeadSchema.managerActive added (Rule 2)** — Required for chat UI to gate the intercept button. The flag was always persisted by the Phase 3 routes but never serialized into the GET /leads list response. End-to-end fix is one schema field + 3 SQL select clauses + 3 serializer additions.
- **Audio per call, not per turn (D-26)** — Mount the `<audio>` element on the FIRST turn for each callId; downstream turns share the ref via a Map indexed by callId. Avoids N audio players per call while keeping all turns clickable for seek.
- **D-47 enforced at thread-view (frontend), not at the API** — The backend intercept endpoints don't refuse voice leads (they would, in principle, succeed). The UI never invokes them for voice channels by hiding the controls. Simpler boundary; mirrors D-47's spirit (manager listens back AFTER the call, not during it).
- **Zenith chat-app delete-and-rewrite, not adapt (Pitfall #9)** — Zenith's mock store + 5 channels would have required as much code to wire into UNION API as a rewrite. Deleting the 5 orphan files removes the temptation to import them later.
- **useT vi.mock in smoke tests (Rule 3)** — The real useT imports usePreferencesStore → font registry → `geist/font/pixel` whose directory-style export breaks Node ESM resolution under vitest+happy-dom. Smoke tests aren't testing language switching; an identity stub with explicit RU dict subset is the smallest change that keeps the tests green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing critical functionality] LeadSchema.managerActive end-to-end**
- **Found during:** Task 1 — chat-app drafting
- **Issue:** Chat UI needs `lead.managerActive` to decide whether to show Перехватить (`false`) vs Вернуть боту (`true`). DB column exists, intercept/release responses expose it via LeadInterceptResponseSchema, but the GET /api/leads list serializer + the linkedLead nested in CallDetail/OrderDetailExtended both omit it. Plan body assumed it was available.
- **Fix:** Added `managerActive: z.boolean().default(false)` to LeadSchema. Updated SQL SELECT clauses (3 places: leads.ts list + leads.ts PATCH RETURNING + calls.ts linkedLead + orders.ts OrderDetailExtended.lead) to include `manager_active AS "managerActive"`. Updated serializeLeadRow + inline linkedLead constructors to emit `managerActive: Boolean(r.managerActive ?? false)`.
- **Files modified:** packages/shared-types/src/api/leads.ts, apps/api/src/routes/{leads,calls,orders}.ts
- **Verification:** apps/api unit suite: 200 passed | 0 todo (no regressions on Phase 1–3 contract tests).
- **Committed in:** 565e31b (Task 1)

**2. [Rule 3 — Blocking] vitest cannot resolve geist/font/pixel for smoke tests**
- **Found during:** Task 2 — first run of chat + calls smoke tests
- **Issue:** ChatApp + CallsTable + ManagerInput call useT(); useT imports usePreferencesStore from `@/stores/preferences/preferences-provider`; that file imports `@/lib/fonts/registry` which imports `geist/font/pixel`. geist exports its font modules as directories; Node ESM under vitest+happy-dom can't resolve directory imports without an explicit index.js. Plan 04-05's other smoke tests pass because their components don't use useT.
- **Fix:** Added `vi.mock('@/lib/i18n/use-t', () => ({ useT: () => (key) => RU_FALLBACK[key] ?? key }))` to pages-smoke.test.ts. Smoke tests don't exercise language switching; the identity stub keeps the resolver from walking into geist.
- **Files modified:** apps/web/tests/unit/pages-smoke.test.ts
- **Verification:** apps/web suite: 28 passed | 0 todo.
- **Committed in:** 00db56c (Task 2)

**3. [Rule 1 — Bug] biome lint complained about useMemo([messages]) in thread-view.tsx**
- **Found during:** Task 1 — biome auto-fix run
- **Issue:** I initially used `useMemo(() => new Set<string>(), [messages])` to reset the renderedCalls set when messages changed. Biome's `useExhaustiveDependencies` flagged `messages` as an unused dep (it's not used inside the factory).
- **Fix:** Switched to a plain `new Set<string>()` per render. Rebuilding the Set on every render is O(messages.length) which is bounded by the SWR cap of 100; equivalent cost to useMemo + dep check.
- **Files modified:** apps/web/src/app/(main)/dashboard/chat/_components/thread-view.tsx
- **Committed in:** 565e31b (Task 1)

### Out-of-scope discoveries

- **Plan 04-05 ran in parallel** — They modified ~25 Zenith files (analytics + default + orders Zenith mock dirs) that I would have only touched via biome auto-fix. I scoped each commit to ONLY my chat/calls files and used `git add <explicit-paths>` (never `git add .`) to avoid stealing their work. Plan 04-05's commit a8a03b7 incorporated my pending phase-4-stubs flips, demonstrating clean cross-plan coordination.

## Notes for Wave 5 (Plan 04-06, UAT gate)

- All 6 dashboard pages now exist with real backend data:
  - `/dashboard/default` (Plan 04-05) — KPI tiles + last-5 lists
  - `/dashboard/analytics` (Plan 04-05) — recharts + window selector
  - `/dashboard/chat` (this plan) — mixed timeline + audio seek + manager intercept
  - `/dashboard/calls` (this plan) — table + filters + modal
  - `/dashboard/orders` (Plan 04-05) — table + filters
  - `/dashboard/orders/[id]` (Plan 04-05) — detail + timeline + breadcrumb
- UAT-05 storyboard ready: login → chat → calls table → row click → modal audio → orders → /[id] → "Прослушать звонок" → callback into chat → switch RU↔UA → repeat. All routes tested by smoke at minimum.
- Voice channel intercept is HIDDEN per D-47 — UAT must verify the controls do NOT appear on voice threads.
- /dashboard/calls phone column shows last 4 of `twilio_call_sid` — v2 hardening should join `clients.phone` + libphonenumber-js mask. Documented as deferred in deferred-items if it ever blocks UAT.

## Self-Check: PASSED

- All 12 created files verified present on disk
- Both task commits (565e31b + 00db56c) reachable in git log
- apps/web: 28 passed | 0 todo (test count includes 2 newly added smoke tests)
- apps/api: 200 passed | 0 todo (Phase 4 marker count 0)
- pnpm --filter @ai-logist/web exec tsc --noEmit: clean
- pnpm --filter @ai-logist/web build: /dashboard/calls + /dashboard/chat compile via Turbopack
- All 5 static-rules grep guards GREEN

---
*Phase: 04-admin-web-reduced-scope-chat-calls-orders-kpi*
*Completed: 2026-06-10*
