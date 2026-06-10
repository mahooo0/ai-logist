# Phase 4: Admin Web (REDUCED scope — chat + calls + orders + KPI) — Context

**Gathered:** 2026-06-10 (auto mode, recommended defaults)
**Status:** Ready for planning
**Risk profile:** MEDIUM (Next.js 16 + Tailwind v4 + shadcn template integration — Pitfall #13)

<domain>
## Phase Boundary

Demo-supporting web admin that **shows what voice + Telegram channels produced**. Forks `mahooo0/next-shadcn-admin-dashboard` (Zenith Admin) into `apps/web/` (replacing the Phase 1 placeholder) and wires 6 dashboard pages to the existing REST surface.

**In scope (12 reqs + 1 implicit endpoint):**
- Auth via `/auth/v1/login` (env-set login/password, single-user manager) — ADMIN-02
- `/dashboard/chat` — **multi-channel** unified view of Telegram messages + voice call transcripts with inline audio playback; manager intercept controls for Telegram threads — ADMIN-03
- `/dashboard/default` + `/dashboard/analytics` — KPI tiles + charts (calls vs Telegram, conversion, revenue, avg call duration) — ADMIN-05
- `/dashboard/calls` — table of all voice calls with filters (outcome, lang, date), detail modal with audio player + transcript + linked lead/order — ADMIN-NEW-08
- `/dashboard/orders` — table with status + channel filters — ADMIN-NEW-02
- `/dashboard/orders/[id]` — detail card with order_events timeline, channel breadcrumb, no price-override modal — ADMIN-NEW-03
- Backend REST handlers (replace 501-stubs from Phase 1):
  - `GET /api/leads` (filter by stage, channel) — API-03
  - `GET /api/orders` + `GET /api/orders/:id` — API-04
  - `GET /api/trucks` — API-05 (read-only list for orders detail; CRUD deferred to v2)
  - `GET /api/clients/:id/messages` — API-06
  - `GET /api/analytics/kpi` — API-09
  - **NEW:** `GET /api/calls` + `GET /api/calls/:id` (implicit prerequisite for ADMIN-NEW-08; not in original API-* list)
- I18N-02 — Customize-panel RU/UA toggle hooked to `apps/web/src/lib/i18n.ts` dictionary

**NOT in scope (deferred per 2026-06-09 pivot):**
- `/dashboard/kanban` (DnD funnel) — v2 ADMIN_V2-KANBAN
- `/dashboard/fleet` (CRUD + RHF phone-input) — v2 ADMIN_V2-FLEET
- `/dashboard/calendar` — v2 ADMIN_V2-CALENDAR
- `/dashboard/tracking` (Leaflet + WS) — v2 ADMIN_V2-TRACKING
- Global search (⌘K) — v2 ADMIN_V2-SEARCH
- Price-override modal with audit reason — v2 ADMIN_V2-PRICE-OVERRIDE
- TTN/CMR PDF stub — v2 ADMIN_V2-TTN-PDF
- WebSocket `/ws/inbox` + `/ws/tracking` — Phase 5 (Polish) uses polling for chat refresh
- Real-time live map — v2 (TRACK_V2-*)
- Full ICU pluralization — Phase 5 (I18N-03)
- Locale-aware date helpers (`date-fns/locale`) — Phase 5 (I18N-04)
- Auth invalidation/multi-session — single-user demo only

</domain>

<decisions>
## Implementation Decisions

### Template Fork Strategy
- **D-01:** Replace the current `apps/web/` placeholder (Phase 1 hello-world `page.tsx`/`layout.tsx`) with the Zenith Admin template content. Strategy:
  1. `git clone --depth 1 https://github.com/mahooo0/next-shadcn-admin-dashboard.git /tmp/zenith`
  2. Copy `/tmp/zenith/{src,public,components.json,tailwind.config.ts,postcss.config.mjs,next.config.ts,tsconfig.json}` into `apps/web/`
  3. Merge Zenith's `package.json` dependencies into our existing `apps/web/package.json` (keeping our scripts: `next dev --turbopack -p 3001`, etc.)
  4. Run `pnpm install` from monorepo root — pnpm workspaces resolves
  5. Commit as one big "vendor Zenith template" commit + follow-up "wire monorepo conventions" commit
- **D-02:** Do NOT use git submodule or git subtree — adds toolchain complexity for zero benefit. The template's MIT license permits straight vendoring.
- **D-03:** Preserve Zenith's directory layout: `src/app/(main)/dashboard/<feature>/page.tsx` + `_components/<feature>-app.tsx` per spec §7.3. Do not flatten or restructure.
- **D-04:** Pin Zenith's `package.json` versions exactly as cloned (no auto-bump to `^latest`). Zenith ships React 19 + Tailwind v4 + Next 16 which already match STACK.md.

### Auth (ADMIN-02)
- **D-05:** **Env-set single-user credentials** (no NextAuth, no Clerk, no OAuth). New env vars in `apps/web/.env`:
  - `ADMIN_USERNAME` (required) — default for demo `admin`
  - `ADMIN_PASSWORD_HASH` (required) — bcrypt hash; `pnpm gen:admin-password` script writes a fresh hash
  - `AUTH_COOKIE_SECRET` (required) — 32-byte random; HMAC signs the session cookie
- **D-06:** Session = signed HTTP-only cookie `al_session`, contents `{username, issuedAt}`. Lifetime 12h. Verified in Next.js middleware (`middleware.ts`) — gates everything under `(main)/`. Unauthenticated → redirect to `/auth/v1/login`.
- **D-07:** Login form = Zenith's existing `/auth/v1/login` page. We replace the placeholder `onSubmit` handler with `POST /auth/v1/login` (Next.js API route under `apps/web/src/app/auth/v1/login/route.ts`) that bcrypt-compares + sets cookie.
- **D-08:** Logout = `POST /auth/v1/logout` clears cookie + redirects to login. Single-user, no "active sessions" UI.
- **D-09:** NO backend `/api/auth/*` endpoint on Fastify — admin auth lives entirely in Next.js. Fastify API trusts requests from the web app (same VPS, behind Caddy). Phase 4 does NOT add bearer auth on `/api/*` — that's a v2 PROD-03 (RBAC) concern.

### Data Fetching Pattern
- **D-10:** **Server Components for initial fetch + Client Components with SWR for interactive surfaces.** Per spec §7.3 convention:
  - `page.tsx` (Server) — fetches initial data via `fetch('http://api:3000/api/...')` inside a `getXxx()` helper
  - `_components/<feature>-app.tsx` (Client, `'use client'`) — receives initial data as props, uses `useSWR` for refresh/filter
- **D-11:** **SWR for refresh + interaction**, not React Query. Reasons: smaller bundle (~4kb), Zenith already includes patterns compatible with SWR, no mutation queue needed for Phase 4 (no admin-side writes except manager-intercept).
- **D-12:** **NEVER `'use cache'`** on `/dashboard/chat`, `/dashboard/calls`, `/dashboard/orders`, `/dashboard/orders/[id]` (per Pitfall #13). These pages must be dynamic — manager needs to see fresh data. CI grep guard:
  ```bash
  grep -rE "'use cache'" apps/web/src/app/\\(main\\)/dashboard/{chat,calls,orders} && exit 1 || exit 0
  ```
- **D-13:** **`/dashboard/default` and `/dashboard/analytics` CAN use `'use cache'` with `cacheLife('minutes')`** — KPI is aggregated, doesn't need realtime.
- **D-14:** **Server Component fetcher helper** in `apps/web/src/lib/api.ts`:
  ```ts
  export async function apiGet<T extends z.ZodTypeAny>(
    path: string,
    schema: T,
    init?: RequestInit
  ): Promise<z.infer<T>>
  ```
  Validates response via shared-types Zod schema before returning. On invalid response → throw with full path + payload for fast diagnosis.

### API URL Strategy
- **D-15:** **Caddy reverse-proxies `/api/*` to Fastify** (already configured in Phase 1 Caddyfile). Browser-side code uses **relative URLs** (`/api/leads`) — NO CORS, NO env-based base URL on client.
- **D-16:** **Server Components inside docker-compose** use absolute internal URL `http://api:3000/api/...`. Env var `API_INTERNAL_URL` (default `http://api:3000`) — only Server Components read it. Local dev (outside docker) falls back to `http://localhost:3000`.
- **D-17:** **`apiGet` auto-routes:** if running on server (no window), uses `API_INTERNAL_URL`; if on client, uses relative `/api/...`.

### Type Sharing
- **D-18:** **Import directly from `@ai-logist/shared-types`** — Zod schemas + types are already published as a workspace package. Add it to `apps/web/package.json` as `"@ai-logist/shared-types": "workspace:*"`. NO duplicate types in `apps/web`.
- **D-19:** **NEW shared-types module:** `packages/shared-types/src/api/calls.ts` with `CallSchema`, `CallDetailSchema` (call + transcript turns), `CallListQuerySchema` (filters: outcome, lang, dateFrom, dateTo, limit, offset). Phase 4 plans add this.

### Multi-Channel Chat (`/dashboard/chat` — ADMIN-03)
- **D-20:** **Mixed-timeline thread view, NOT separate tabs per channel.** Each thread is one client. Inside the thread, messages from BOTH Telegram and voice calls appear chronologically with channel badges:
  - Telegram message → green `TG` badge + text bubble
  - Voice transcript turn → purple `Voice` badge + transcript text + inline `▶ Play` button that loads the **whole call audio** with `currentTime` seek to that turn's `timestamp_ms`
- **D-21:** **Thread list (left rail)** unifies both channels — one row per client. Sorted by `MAX(last_message_at, last_call_at) DESC`. Each row shows: client name, last activity preview (truncated), channel icon(s) shown for activity in last 24h, unread badge (= count of `messages` since manager last viewed; tracked client-side in localStorage for demo simplicity).
- **D-22:** **Status filter** (Open / Pending / Resolved) maps to lead `stage` — Open = stages NEW..AGREED, Pending = ORDER_CREATED..IN_PROGRESS, Resolved = DONE / LOST. Single dropdown above thread list.
- **D-23:** **Backend support:** `GET /api/clients/:id/messages` already specced (API-06). Phase 4 implements it as a **union query** that returns messages JOINed with calls.transcript turns (transformed into virtual messages with `role='ai'|'client'`, channel='voice'). Sort by `created_at`. Pagination: `limit/offset` (default 100/0).
- **D-24:** **Polling refresh:** SWR `refreshInterval: 5000` (5s) on the active thread. New messages auto-append. No WS in Phase 4 (deferred to Phase 5 polish). 5s is good enough for demo.

### Voice Audio Playback
- **D-25:** **Inline `<audio controls preload="metadata" src={call.audio_url}>`** per voice call rendered in chat. Browser native player. NO custom waveform UI, NO third-party audio library (saves bundle + complexity).
- **D-26:** **Audio currentTime seek on transcript turn click:** wrapping component holds `<audio ref>`; each transcript turn's `▶ Play` button calls `audio.currentTime = turn.timestamp_ms / 1000; audio.play()`. Single audio element per call (not per turn).
- **D-27:** **Audio served from Twilio** (`calls.audio_url`). No proxy through our API in Phase 4 (Twilio URLs are signed + time-limited; for demo this is fine). v2 hardening: proxy + cache.

### `/dashboard/calls` (ADMIN-NEW-08)
- **D-28:** **Table layout** with columns: `timestamp`, `phone` (masked last 4 digits), `lang` (RU/UA badge), `duration_s` (formatted `mm:ss`), `outcome` (color-coded badge: green=completed / yellow=abandoned / blue=escalated / red=error), `linked_order` (link if present, em-dash if null). Sort default: `created_at DESC`.
- **D-29:** **Filters above table:** outcome (multi-select), lang (RU/UA/all), date range (last 24h / last 7d / last 30d / custom). Filters update URL search params (`?outcome=completed&lang=ru`) — bookmarkable, shareable.
- **D-30:** **Click row → modal** (shadcn `<Dialog>`) showing: full transcript (scrollable), large audio player at top, linked lead/order quick info, "Open lead" / "Open order" buttons.
- **D-31:** **Backend new endpoints:**
  - `GET /api/calls?outcome=&lang=&from=&to=&limit=&offset=` → paginated list (sorted DESC by `created_at`)
  - `GET /api/calls/:id` → call detail with full transcript jsonb + linked lead + linked order
  - New file `apps/api/src/routes/calls.ts`, registered in `app.ts`

### `/dashboard/orders` (ADMIN-NEW-02)
- **D-32:** **Table** with columns: `number` (e.g. `#KU-4471`), `created_at` (relative: "5 мин назад"), `client_name`, `from → to` (city names from joined `cities`), `status` (color-coded badge per FSM), `price` (formatted via `formatMoney(kopecks)` from shared lib), `channel` (voice/telegram badge — derived from lead.channel).
- **D-33:** **Filters:** status (FSM status multi-select), channel (voice/telegram/all), date range. URL params bookmarkable.
- **D-34:** **Click row → navigate to `/dashboard/orders/[id]`** (full page, not modal — order detail has timeline + actions).
- **D-35:** **Backend `GET /api/orders` returns list with joined city names + client name + lead.channel** — server-side join saves N+1. Response shape: `OrderListItemSchema` (new in shared-types — extends `OrderSchema` with `fromCityName`, `toCityName`, `clientName`, `channel`).

### `/dashboard/orders/[id]` (ADMIN-NEW-03)
- **D-36:** **Detail layout:** header (order number + status badge + price), body splits two columns:
  - Left: client card, route card, truck card, cargo card
  - Right: **vertical timeline of `order_events`** rendered as stacked entries with type icon, actor pill (ai/manager/system), timestamp, payload preview (JSON pretty-printed in `<details>`)
- **D-37:** **No actions in v1** — read-only. No "change status" button (manual FSM moves are a v2 concern). No "override price" (deferred). No "reassign truck" (deferred).
- **D-38:** **"Source channel" breadcrumb** at top: if lead came from voice → link "Прослушать звонок" → opens calls modal. If from Telegram → link "Открыть диалог" → routes to `/dashboard/chat?clientId=...`.
- **D-39:** **Backend `GET /api/orders/:id` returns `OrderDetailSchema`** (already specced in shared-types: order + events array). Phase 4 extends response with `client`, `fromCity`, `toCity`, `truck` so the page doesn't need 4 separate fetches.

### `/dashboard/default` + `/dashboard/analytics` (ADMIN-05)
- **D-40:** **`/dashboard/default`** = compact KPI tiles + last 5 calls + last 5 orders (manager landing page).
- **D-41:** **`/dashboard/analytics`** = full charts:
  - Calls per day (bar chart, last 7/30 days)
  - Conversion funnel: total calls → answered → leads created → orders confirmed → delivered (vertical funnel from recharts)
  - Channel split: voice vs telegram (donut)
  - Revenue trend (line chart, kopecks → rubles formatted)
  - Avg call duration (single big number + sparkline)
- **D-42:** **Recharts** (already in Zenith template `dependencies`). No new chart library.
- **D-43:** **Window selector** at top: `day | week | month` — drives `?window=` param to `GET /api/analytics/kpi`. Default `week`.
- **D-44:** **Backend `GET /api/analytics/kpi` schema** (already in shared-types) is **extended** during Phase 4 to add: `avgCallDurationS`, `byChannel: { voice: number, telegram: number }`, `conversionFunnel: { calls, answered, leadsCreated, ordersConfirmed, delivered }`. Update `packages/shared-types/src/api/analytics.ts` accordingly.

### Manager Intercept UI (uses Phase 3 endpoints TG-06)
- **D-45:** **In `/dashboard/chat`, when a thread's lead has `manager_active=false`:** show button `Перехватить` (RU) / `Перехопити` (UA) in the thread header. Click → `POST /api/leads/:id/intercept` → SWR revalidate.
- **D-46:** **When `manager_active=true`:** the input box becomes a **manager-message input** (placeholder: «Сообщение от менеджера»). On submit → `POST /api/leads/:id/manager-message` with `{text}`. Also show `Вернуть боту` button in header → `POST /api/leads/:id/release`.
- **D-47:** **Voice channel threads NEVER show intercept controls** — voice calls finish naturally; manager can only listen back after the fact (per Phase 3.1 D-21).

### Sidebar Nav (template trimming)
- **D-48:** **DO NOT delete unused template pages** (kanban, fleet, calendar, finance, crm, e-commerce, mail, tasks, etc.). They stay in the build to minimize Phase 4 churn. They're still reachable by direct URL for demo curiosity but ARE NOT linked.
- **D-49:** **Modify the sidebar config** to only show our shipped routes:
  - Default (KPI)
  - Analytics
  - Chat
  - Calls
  - Orders
  All other Zenith nav items are commented out (not deleted from config) so v2 can re-enable without re-finding them.
- **D-50:** **Customize-panel** (theme + language toggle) stays as Zenith ships it — we hook the language selector to our dictionary (D-52).

### i18n RU/UA (I18N-02)
- **D-51:** **Zustand-stored language preference** (Zenith already has this in their Customize panel). Reuse the existing store; we only add our dictionary.
- **D-52:** **Dictionary file** `apps/web/src/lib/i18n/dict.ts`:
  ```ts
  export const dict = {
    ru: { 'chat.intercept': 'Перехватить', 'chat.release': 'Вернуть боту', ... },
    ua: { 'chat.intercept': 'Перехопити', 'chat.release': 'Повернути боту', ... },
  } as const satisfies Record<'ru'|'ua', Record<string, string>>;
  export type DictKey = keyof typeof dict.ru;
  ```
  + thin hook `useT()` reading from Zustand store. RU is default.
- **D-53:** **NO ICU / no plural forms / no date-fns/locale in Phase 4** — all that lives in Phase 5 (I18N-01, I18N-03, I18N-04). Phase 4 only covers I18N-02 (the toggle + basic dictionary).
- **D-54:** **Date display:** raw ISO timestamps run through `Intl.DateTimeFormat('ru-RU' | 'uk-UA')` for now. `date-fns/locale` formatting is Phase 5 polish.
- **D-55:** **Dictionary scope:** ONLY translate the new strings we add (chat headers, calls page filter labels, orders columns, KPI tile titles). Do NOT translate the entire Zenith template (its built-in EN/RU strings stay as-is for the demo). Manager will see a clean RU/UA experience on our pages.

### Realtime / Polling
- **D-56:** **SWR polling intervals (no WS in Phase 4):**
  - `/dashboard/chat` active thread: 5s
  - `/dashboard/chat` thread list: 15s
  - `/dashboard/calls` list: 30s (calls aren't created that fast)
  - `/dashboard/orders` list: 15s
  - `/dashboard/orders/[id]`: 10s (status may flip from voice/telegram)
  - `/dashboard/default` + `/dashboard/analytics`: 60s
- **D-57:** **Tab-visibility-aware:** pause polling when `document.visibilityState !== 'visible'` (SWR built-in `revalidateOnFocus: true` + custom `isPaused`). Demo demands manager keep the tab open anyway, but this prevents background tab burn.

### Tailwind v4 Gotchas (Pitfall #13)
- **D-58:** **Use `border-border` explicitly.** Tailwind v4 changed default border color from `gray-200` to `currentColor`. Zenith template already handles this — Phase 4 doesn't introduce new ungated `border` classes. CI grep guard:
  ```bash
  # Match `border` not followed by `-` or non-class chars (rough check)
  grep -rE 'className="[^"]*\bborder\b[^-]' apps/web/src/app/\\(main\\)/dashboard/ | grep -v border-border && exit 1 || exit 0
  ```
- **D-59:** **`page.tsx` server / `_components/*.tsx` client** convention is enforced per spec §7.3 — Phase 4 plans must verify with a build-time `'use client'` consistency check (CI tsc + Biome already cover most).

### File Layout (new files in Phase 4)
- **D-60:** **Backend additions:**
  - `apps/api/src/routes/calls.ts` (new — list + detail)
  - `apps/api/src/routes/leads.ts` — implement `GET /api/leads` + extend `GET /api/leads/:id` for chat thread context
  - `apps/api/src/routes/orders.ts` — implement `GET /api/orders` + `GET /api/orders/:id` (uncached, joined)
  - `apps/api/src/routes/clients.ts` — implement `GET /api/clients/:id/messages` (union with calls.transcript turns)
  - `apps/api/src/routes/trucks.ts` — implement `GET /api/trucks` (read-only)
  - `apps/api/src/routes/analytics.ts` — implement `GET /api/analytics/kpi` aggregation
- **D-61:** **Frontend additions** (under `apps/web/src/`):
  - `app/(main)/dashboard/calls/page.tsx` + `_components/calls-app.tsx`
  - `app/(main)/dashboard/orders/page.tsx` + `_components/orders-app.tsx`
  - `app/(main)/dashboard/orders/[id]/page.tsx` + `_components/order-detail-app.tsx`
  - `app/(main)/dashboard/default/page.tsx` (re-wire Zenith page to our KPI API)
  - `app/(main)/dashboard/analytics/page.tsx` (re-wire)
  - `app/(main)/dashboard/chat/page.tsx` + `_components/chat-app.tsx` (re-wire Zenith chat to our messages + calls union API)
  - `lib/api.ts`, `lib/i18n/dict.ts`, `lib/format.ts` (money + phone + date helpers)
  - `app/auth/v1/login/route.ts` (auth API)
  - `middleware.ts` (route gating)
- **D-62:** **Shared-types additions:** `packages/shared-types/src/api/calls.ts` (CallSchema, CallDetailSchema, CallListQuerySchema), extend `analytics.ts` for new KPI fields, extend `orders.ts` with `OrderListItemSchema`.

### Testing Strategy
- **D-63:** **Frontend tests = page-level smoke** via `@testing-library/react` + `vitest`. Goals: each page renders without crashing given mocked API response; key interactions (filter change updates URL; intercept button posts; modal opens). NOT full E2E.
- **D-64:** **Backend tests = handler integration** via testcontainers Postgres (already pattern from Phase 1-3.1). Each new route has a happy-path + edge case (empty data, invalid filter, 404 detail).
- **D-65:** **Visual smoke = manual UAT-05** (HUMAN-UAT-05.md) covering: login → chat thread → calls table → click call → orders table → click order → switch to UA → repeat. No Playwright in Phase 4 (deferred to Phase 5 polish).

### Configuration & Env
- **D-66:** **New env vars** (`.env.example` updated):
  - `ADMIN_USERNAME` (default `admin` for demo)
  - `ADMIN_PASSWORD_HASH` (bcrypt; generated via `pnpm gen:admin-password`)
  - `AUTH_COOKIE_SECRET` (32-byte hex)
  - `API_INTERNAL_URL` (server-side only; default `http://api:3000`)
- **D-67:** **No new backend env vars** — all of Phase 4's backend work uses existing Phase 1-3.1 infrastructure.

### Demo Polish Carry-Over (out of Phase 4, into Phase 5)
- WS `/ws/inbox` + `/ws/tracking` — Phase 5
- Locale-aware dates — Phase 5
- ICU pluralization — Phase 5
- Voice fallback video bundling — Phase 5

### Claude's Discretion
- Exact pixel-level spacing inside cards (use Zenith defaults)
- Color palette for status badges (use shadcn semantic colors: `default`, `secondary`, `destructive`)
- Specific tooltip copy on KPI tiles
- Sidebar navigation icon choices (use lucide-react matching what's in Zenith)
- Internal log severity for failed `/api/*` fetches in Server Components (pino-style on backend, plain console on frontend dev)
- Whether to fetch the order detail right column data (client, route, truck, cargo) in a single combined response or one query per card — recommend single combined (D-39).

### Folded Todos
*Нет — backlog пуст.*

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec & Project Docs
- `ai-logist-logic-spec.md` §7 — Веб-админка (full section on Zenith template)
- `ai-logist-logic-spec.md` §7.1 — Шаблон (locked Next.js 16 / React 19 / Tailwind v4 / shadcn / Zustand / RHF+zod / sonner / lucide-react / libphonenumber-js / date-fns / @dnd-kit / pnpm + Biome)
- `ai-logist-logic-spec.md` §7.2 — Mapping наших функций на страницы шаблона (table: chat/kanban/dashboards/fleet/orders/tracking/calendar/i18n)
- `ai-logist-logic-spec.md` §7.3 — Конвенции репо: `page.tsx` server / `_components/*.tsx` client
- `ai-logist-logic-spec.md` §7.4 — Поток данных админки (REST + WS, with WS deferred)
- `ai-logist-logic-spec.md` §7.5 — Запуск шаблона
- `ai-logist-logic-spec.md` §6 — REST endpoints (API-03..06, API-09 contracts)
- `.planning/PROJECT.md` — Core Value, Key Decisions table (template lock, bilingual approach)
- `.planning/REQUIREMENTS.md` — Phase 4 reqs (ADMIN-01..05, ADMIN-NEW-02/03/08, API-03..06/09, I18N-02 + deferred-to-v2 list)
- `.planning/ROADMAP.md` — Phase 4 success criteria (5 numbered items) + 2026-06-09 pivot rationale + risk note (Pitfall #13)

### Research
- `.planning/research/STACK.md` — Frontend stack locked + Tailwind v4 + Next 16 + Biome
- `.planning/research/ARCHITECTURE.md` — Monorepo layout (apps/api, apps/web, packages/shared-types)
- `.planning/research/PITFALLS.md` Pitfall #13 — Next.js 16 + Tailwind v4 + shadcn integration traps (`'use cache'` ban on dynamic pages; `border-border` explicit)
- `.planning/research/FEATURES.md` — 6 research-derived gaps

### Prior Phase Contexts (must respect existing decisions)
- `.planning/phases/03-telegram-channel/03-CONTEXT.md` — D-21..23 (manager intercept endpoints used by Phase 4 UI); D-24..26 (notification templates)
- `.planning/phases/03.1-voice-channel-elevenlabs-twilio/03.1-CONTEXT.md` — D-13..15 (calls schema extensions consumed by `/dashboard/calls`); D-21 (voice escalation copy); D-32 (Agent config doc)

### Phase 1+2+3+3.1 Artifacts (consumed by Phase 4)
- `apps/api/src/persistence/schema/messages.ts` — chat history source
- `apps/api/src/persistence/schema/calls.ts` — voice calls source (extended in 0004)
- `apps/api/src/persistence/schema/orders.ts` — orders + relations
- `apps/api/src/persistence/schema/order_events.ts` — timeline source for `/orders/[id]`
- `apps/api/src/persistence/schema/leads.ts` — channel field + manager_active flag
- `apps/api/src/persistence/schema/trucks.ts` — read-only list
- `apps/api/src/persistence/schema/clients.ts` — joined into list responses
- `apps/api/src/persistence/schema/cities.ts` — joined into orders for `from → to` display
- `apps/api/src/routes/leads.ts` — has POST intercept/release/manager-message already; GET /leads + PATCH stubs flipped here
- `apps/api/src/routes/orders.ts` — 501-stubs flipped to real handlers (NOT price-override — deferred to v2)
- `apps/api/src/routes/trucks.ts` — GET stub flipped; CRUD remains deferred
- `apps/api/src/routes/clients.ts` — GET /:id/messages stub flipped (union with calls.transcript)
- `apps/api/src/routes/analytics.ts` — GET /kpi stub flipped
- `apps/api/src/routes/webhooks.ts` — webhook routes registered in Phase 3/3.1 (unchanged here)
- `packages/shared-types/src/api/{leads,orders,trucks,clients,analytics}.ts` — existing schemas extended; new `calls.ts` added
- `packages/shared-types/src/domain/enums.ts` — LeadStage / OrderStatus / OrderEventType / BodyType / ClientLang reused in UI
- `apps/web/{package.json,next.config.ts,app/}` — current Phase 1 placeholder, replaced by Zenith template

### External Library Docs
- next-shadcn-admin-dashboard repo — https://github.com/mahooo0/next-shadcn-admin-dashboard
- next-shadcn-admin-dashboard live demo — https://next-shadcn-admin-dashboard-two.vercel.app
- shadcn/ui docs — https://ui.shadcn.com
- Next.js 16 App Router — https://nextjs.org/docs/app
- Tailwind CSS v4 — https://tailwindcss.com/docs/v4-beta
- SWR docs — https://swr.vercel.app/docs
- recharts docs — https://recharts.org/en-US/api
- bcryptjs — https://github.com/dcodeIO/bcrypt.js (auth password hashing)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (from Phase 1, 2, 3, 3.1)
- **`packages/shared-types/src/api/{leads,orders,trucks,clients,analytics}.ts`** — Zod schemas + types ready to consume in `apps/web/`. **Will be extended**, not rewritten.
- **`apps/api/src/routes/*.ts`** — All Phase 4 routes are already specced as 501-stubs with correct response types from Phase 1 Plan 01-08. Phase 4 turns them into real handlers; no new Fastify wiring.
- **`apps/api/src/persistence/repos/{leads,orders,trucks,clients,messages}.ts`** — thin per-aggregate repos already exist from Phase 1 Plan 01-06. Phase 4 adds query helpers (`findManyWithFilters`, `findByIdWithRelations`) but does NOT change repo boundaries.
- **`apps/api/src/persistence/schema/order_events.ts`** — has UNIQUE(order_id, type); timeline data ready for `/orders/[id]`.
- **`apps/api/src/lib/money.ts`** — kopecks→string formatter; reused by `formatMoney` in `apps/web/src/lib/format.ts`.
- **`apps/web/src/lib/format.ts`** (new) — money, phone (libphonenumber-js), date helpers — frontend mirrors of backend formatting where needed.
- **`apps/api/Caddyfile`** — reverse-proxy `/api/*` → fastify already set; web served at `/`.
- **`apps/web/Dockerfile`** — Phase 1 multi-stage build; needs only dependency-set refresh after Zenith vendoring.

### Established Patterns (must follow)
- **Per spec §7.3:** `page.tsx` is server (SSR fetch), `_components/<feature>-app.tsx` is the SOLE client boundary. Phase 4 enforces this for every new page.
- **`NEVER 'use cache'` on dynamic pages** (chat/calls/orders) per Pitfall #13 — CI grep guard required.
- **`border-border` explicit** (Tailwind v4 — Pitfall #13).
- **Money as bigint kopecks** — Phase 4 displays via `formatMoney(kopecks, lang)`; never as raw number. String-bigint over JSON wire.
- **Phone display** via libphonenumber-js — masked last 4 digits for privacy in `/calls` and `/chat` thread list.
- **Idempotency on writes** — N/A for Phase 4 (read-only API except manager intercept which Phase 3 owns).
- **Zod-validation at all boundaries** — `apiGet` validates every response.
- **i18n via Zustand store** (Zenith ships this already) — Phase 4 only adds the dictionary.

### Integration Points
- **`apps/web/src/app/(main)/dashboard/<feature>/`** — Zenith convention; all our new pages land here.
- **`apps/web/middleware.ts`** — gates `/(main)/*` behind cookie check.
- **`apps/web/src/lib/api.ts`** — single Server Component fetcher + Zod validator.
- **`apps/api/src/app.ts`** — register `callsRoutes` (new) alongside existing `leadsRoutes`/`ordersRoutes`/etc.
- **`apps/api/src/routes/calls.ts`** (new) — Fastify plugin for `GET /api/calls` + `GET /api/calls/:id`.
- **`packages/shared-types/src/api/calls.ts`** (new) — schemas exported via `packages/shared-types/src/index.ts`.
- **`apps/web/src/store/preferences.ts`** (Zenith path may differ — verify on fork) — Zustand store with `lang` field hooked to dictionary lookup.
- **`apps/web/src/components/customize-panel.tsx`** (Zenith) — language toggle reused.
- **`apps/api/Caddyfile`** — unchanged; existing `/api/*` proxy serves new endpoints transparently.

### Required New Modules
- `apps/web/src/lib/api.ts` — typed fetcher + Zod validation
- `apps/web/src/lib/i18n/dict.ts` + `useT()` hook
- `apps/web/src/lib/format.ts` — money/phone/date formatters
- `apps/web/middleware.ts` — auth cookie verification
- `apps/web/src/app/auth/v1/login/route.ts` — POST login handler (bcrypt + cookie issuance)
- `apps/web/src/app/auth/v1/logout/route.ts` — clear cookie
- `apps/api/src/routes/calls.ts` — list + detail
- `packages/shared-types/src/api/calls.ts` — Call/CallDetail/CallListQuery schemas
- `apps/web/scripts/gen-admin-password.ts` — bcrypt hash CLI for setting `ADMIN_PASSWORD_HASH`

### Files to Delete / Replace
- `apps/web/app/page.tsx` (Phase 1 placeholder) — superseded by Zenith
- `apps/web/app/layout.tsx` — superseded by Zenith root layout
- `apps/web/next-env.d.ts` — regenerated by Zenith's `next.config.ts`
- `apps/web/app/globals.css` (if present) — Zenith ships its own

### Risks / Watch-Outs
- **Zenith repo may have changed since spec was written** — check for breaking changes in their nav config + chat page structure before integrating. Plan: snapshot the SHA we vendor in a `apps/web/VENDOR.md` file.
- **`'use cache'`** might appear in Zenith's own pages — audit during fork; if so, REMOVE from chat/calls/orders/orders/[id]/login routes.
- **Zenith's chat page** is built for a fake-data scenario — Phase 4 rewires it. Audit how their thread store interacts with our SWR pattern; may need partial rewrite of `_components/chat-app.tsx`.
- **Tailwind v4 + Next 16 stable status** as of 2026-06 — confirm during fork that the Zenith repo's pinned versions still install cleanly on Node 22 LTS.
- **SWR + Server Components hydration mismatch** — initial data passed via `initialData` prop to `useSWR` must match Server Component fetch byte-for-byte. Use `fallbackData` to avoid the hydration warning.

</code_context>

<specifics>
## Specific Ideas

- **"Manager opens admin, glances, knows everything"** — single Default page must convey: today's call count, today's order count, conversion rate, revenue. Five-second glance test. Tile sizes mirror Zenith Default page; only the data source changes.
- **"Click call → hear it"** — `/dashboard/calls` table row click must reveal audio + transcript in <500ms (preloaded metadata, server-side data already loaded). No spinner.
- **"Mixed timeline reads like a real conversation"** — Telegram and Voice turns from the same client appear in one scrolling pane. Two visual cues: channel badge color + monospace font for voice transcripts to indicate "this was spoken aloud."
- **"Order page tells the whole story"** — `/dashboard/orders/[id]` must show channel breadcrumb + every order_events row. Manager can answer "where did this order come from + what happened" without leaving the page.
- **"Reduced doesn't mean ugly"** — the trimmed sidebar should still feel intentional, not "half-broken." Hide unused items but keep the visual polish (icons, dividers, theme toggle).
- **Use Phase 3's seeded driver_telegram_id** — `/orders/[id]` can show "driver was notified via Telegram" badge when truck.driver_telegram_id is set.
- **UAT-05 storyboard:** real call → Twilio number → order created → manager opens admin → sees order in list → opens detail → clicks "Прослушать звонок" → audio plays → transcript visible → switches to UA → all labels translate → switches back. Phase 4 closes this loop visually.
- **Demo budget impact:** Phase 4 adds no recurring infra cost (Caddy, web container already running). Only one-time dev time. Stays within $15 monthly demo budget that Phase 3.1 set.

</specifics>

<deferred>
## Deferred Ideas

- **Real-time WS (`/ws/inbox`, `/ws/tracking`)** — Phase 5 (NOTIF + Polish)
- **`/dashboard/tracking`** Leaflet + WS map — v2 ADMIN_V2-TRACKING
- **`/dashboard/kanban`** lead funnel with DnD — v2 ADMIN_V2-KANBAN
- **`/dashboard/fleet`** CRUD with libphonenumber-js phone-input — v2 ADMIN_V2-FLEET
- **`/dashboard/calendar`** loading/unloading schedule — v2 ADMIN_V2-CALENDAR
- **Global search (⌘K)** — v2 ADMIN_V2-SEARCH
- **Price-override modal with audit reason** — v2 ADMIN_V2-PRICE-OVERRIDE
- **TTN/CMR PDF generator stub** — v2 ADMIN_V2-TTN-PDF
- **POST /api/orders (manual order create)** — v2 ADMIN_V2-ORDER-CREATE
- **POST /api/orders/:id/price-override** — v2 ADMIN_V2-PRICE-OVERRIDE
- **Full ICU MessageFormat pluralization** — Phase 5 (I18N-03)
- **`date-fns/locale` formatted dates ("8 чер, ср")** — Phase 5 (I18N-04)
- **POLISH-02 "Simulate call" button** — Phase 5
- **POLISH-03 Voice fallback video** — Phase 5
- **Multi-tenant admin / RBAC** — v2 PROD-03
- **Audit log + PII encryption** — v2 PROD-03
- **Rate limiting on admin API** — v2 PROD-05
- **Mobile-first responsive polish** — out of scope (demo is presented from a laptop)
- **Playwright visual regression** — Phase 5 polish or v2
- **Server-side rendering of recharts** — leave client-only for Phase 4 (good enough)
- **Audio proxying through our API** (instead of direct Twilio URL) — v2 hardening

### Reviewed Todos (not folded)
*Нет — backlog пуст.*

</deferred>

---

*Phase: 04-admin-web-reduced-scope-chat-calls-orders-kpi*
*Context gathered: 2026-06-10 (auto mode, 67 locked decisions)*
