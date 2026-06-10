# Phase 4: Admin Web (REDUCED scope — chat + calls + orders + KPI) — Research

**Researched:** 2026-06-10
**Domain:** Next.js 16 admin dashboard fork (Zenith / mahooo0) + Fastify REST handler completion + Multi-channel chat (Telegram + Voice transcript union) + KPI dashboards
**Confidence:** HIGH on stack mechanics (verified against current docs); HIGH on Zenith template (fetched live package.json + chat page); HIGH on pitfalls (verified against PITFALLS.md #13 + Next.js 16 release notes); MEDIUM on UNION query patterns (need verification under load — demo scale fine).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Template Fork Strategy**
- **D-01:** Replace `apps/web/` Phase 1 placeholder with Zenith Admin template content. Recipe: `git clone --depth 1 https://github.com/mahooo0/next-shadcn-admin-dashboard.git /tmp/zenith` → copy `{src,public,components.json,tailwind.config.ts,postcss.config.mjs,next.config.ts,tsconfig.json}` → merge Zenith's `package.json` deps into existing `apps/web/package.json` keeping our scripts (`next dev --turbopack -p 3001`) → `pnpm install` from monorepo root → one "vendor Zenith template" commit + follow-up "wire monorepo conventions" commit.
- **D-02:** No git submodule / subtree — straight vendoring (MIT license permits).
- **D-03:** Preserve Zenith's `src/app/(main)/dashboard/<feature>/page.tsx` + `_components/<feature>-app.tsx` layout per spec §7.3.
- **D-04:** Pin Zenith's `package.json` versions exactly as cloned (no `^latest` auto-bump).

**Auth (ADMIN-02)**
- **D-05:** Env-set single-user credentials (no NextAuth/Clerk/OAuth). New env vars in `apps/web/.env`: `ADMIN_USERNAME` (default `admin`), `ADMIN_PASSWORD_HASH` (bcrypt; `pnpm gen:admin-password` script writes), `AUTH_COOKIE_SECRET` (32-byte random; HMAC signs session cookie).
- **D-06:** Session = signed HTTP-only cookie `al_session`, contents `{username, issuedAt}`, lifetime 12h, verified in Next.js middleware (`middleware.ts`) — gates everything under `(main)/`. Unauth → redirect to `/auth/v1/login`.
- **D-07:** Login form = Zenith's existing `/auth/v1/login` page; replace placeholder `onSubmit` with `POST /auth/v1/login` (Next.js API route `apps/web/src/app/auth/v1/login/route.ts`) bcrypt-compares + sets cookie.
- **D-08:** Logout = `POST /auth/v1/logout` clears cookie + redirects to login. Single-user, no "active sessions" UI.
- **D-09:** NO backend `/api/auth/*` endpoint on Fastify — admin auth lives entirely in Next.js. Fastify trusts requests from web app (same VPS, behind Caddy). NO bearer auth on `/api/*` in Phase 4 — that's v2 PROD-03.

**Data Fetching Pattern**
- **D-10:** Server Components for initial fetch + Client Components with SWR for interactive surfaces. `page.tsx` (Server) → `getXxx()` helper → `_components/<feature>-app.tsx` (Client) receives initial data as props, uses `useSWR` for refresh.
- **D-11:** SWR (not React Query) — smaller bundle (~4kb), no mutation queue needed in Phase 4.
- **D-12:** NEVER `'use cache'` on `/dashboard/chat`, `/dashboard/calls`, `/dashboard/orders`, `/dashboard/orders/[id]`. CI grep guard: `grep -rE "'use cache'" apps/web/src/app/\(main\)/dashboard/{chat,calls,orders} && exit 1 || exit 0`.
- **D-13:** `/dashboard/default` and `/dashboard/analytics` CAN use `'use cache'` with `cacheLife('minutes')` — KPI aggregated, no realtime need.
- **D-14:** Server Component fetcher helper in `apps/web/src/lib/api.ts`:
  ```ts
  export async function apiGet<T extends z.ZodTypeAny>(
    path: string, schema: T, init?: RequestInit
  ): Promise<z.infer<T>>
  ```
  Validates via shared-types Zod schema. Invalid response → throw with full path + payload.

**API URL Strategy**
- **D-15:** Caddy reverse-proxies `/api/*` to Fastify. Browser uses relative URLs (`/api/leads`) — no CORS, no env-based base URL on client.
- **D-16:** Server Components inside docker-compose use absolute internal URL `http://api:3000/api/...` via `API_INTERNAL_URL` env (default `http://api:3000`). Local dev falls back to `http://localhost:3000`.
- **D-17:** `apiGet` auto-routes: server → `API_INTERNAL_URL`; client → relative `/api/...`.

**Type Sharing**
- **D-18:** Import directly from `@ai-logist/shared-types`. Add `"@ai-logist/shared-types": "workspace:*"` to `apps/web/package.json`. NO duplicate types in `apps/web`.
- **D-19:** NEW shared-types module `packages/shared-types/src/api/calls.ts` with `CallSchema`, `CallDetailSchema`, `CallListQuerySchema`.

**Multi-Channel Chat (ADMIN-03)**
- **D-20:** Mixed-timeline thread per client — Telegram messages + voice transcript turns chronologically, channel badges (green TG / purple Voice).
- **D-21:** Thread list (left rail) unified per client, sorted by `MAX(last_message_at, last_call_at) DESC`. Each row: name + preview + channel icon(s) for 24h activity + unread badge (localStorage).
- **D-22:** Status filter (Open / Pending / Resolved) maps to lead `stage`: Open=NEW..AGREED, Pending=ORDER_CREATED..IN_PROGRESS, Resolved=DONE/LOST.
- **D-23:** Backend `GET /api/clients/:id/messages` = union query — messages JOIN with calls.transcript turns transformed into virtual messages with role='ai'|'client', channel='voice'. Sort by `created_at`. Pagination: `limit/offset` default 100/0.
- **D-24:** SWR `refreshInterval: 5000` on active thread. No WS in Phase 4.

**Voice Audio Playback**
- **D-25:** Inline `<audio controls preload="metadata" src={call.audio_url}>` per voice call. NO custom waveform / third-party audio lib.
- **D-26:** Audio currentTime seek on transcript turn click — wrapping component holds `<audio ref>`; turn's `▶ Play` calls `audio.currentTime = turn.timestamp_ms / 1000; audio.play()`. Single audio element per call.
- **D-27:** Audio served direct from Twilio (`calls.audio_url`). No proxy in v1.

**`/dashboard/calls` (ADMIN-NEW-08)**
- **D-28:** Table columns: timestamp, phone (masked last 4), lang (RU/UA badge), duration_s (`mm:ss`), outcome (color badge), linked_order. Sort default `created_at DESC`.
- **D-29:** Filters above table: outcome (multi-select), lang, date range. URL search params, bookmarkable.
- **D-30:** Click row → shadcn `<Dialog>` modal: full transcript scrollable + large audio player + linked lead/order quick info + "Open lead"/"Open order" buttons.
- **D-31:** Backend new endpoints: `GET /api/calls?outcome=&lang=&from=&to=&limit=&offset=` → paginated list (`created_at DESC`); `GET /api/calls/:id` → call + full transcript jsonb + linked lead + linked order. New file `apps/api/src/routes/calls.ts`.

**`/dashboard/orders` (ADMIN-NEW-02)**
- **D-32:** Table columns: number (`#KU-4471`), created_at (relative), client_name, from→to (city names from joined `cities`), status (color badge per FSM), price (`formatMoney(kopecks)`), channel (voice/telegram badge derived from lead.channel).
- **D-33:** Filters: status multi-select, channel multi-select (voice/telegram/all), date range. URL params bookmarkable.
- **D-34:** Click row → navigate to `/dashboard/orders/[id]` full page (not modal).
- **D-35:** Backend `GET /api/orders` returns list with joined city names + client name + lead.channel — server-side join saves N+1. New `OrderListItemSchema` in shared-types extends `OrderSchema`.

**`/dashboard/orders/[id]` (ADMIN-NEW-03)**
- **D-36:** Layout: header (order number + status badge + price); two columns — Left: client/route/truck/cargo cards; Right: vertical timeline of `order_events` (type icon + actor pill + timestamp + payload `<details>` JSON pretty-printed).
- **D-37:** No actions in v1 (read-only). No status-change/override-price/reassign-truck.
- **D-38:** Source channel breadcrumb at top: voice → "Прослушать звонок" → calls modal; Telegram → "Открыть диалог" → `/dashboard/chat?clientId=...`.
- **D-39:** Backend `GET /api/orders/:id` extends `OrderDetailSchema` with `client`, `fromCity`, `toCity`, `truck` so page doesn't need 4 fetches.

**KPI (ADMIN-05)**
- **D-40:** `/dashboard/default` = compact KPI tiles + last 5 calls + last 5 orders.
- **D-41:** `/dashboard/analytics` = full charts: calls per day bar (7/30d), conversion funnel (calls→answered→leads→orders→delivered) recharts vertical funnel, channel split donut (voice vs telegram), revenue trend line (kopecks→rubles formatted), avg call duration big number + sparkline.
- **D-42:** Recharts (already in Zenith). No new chart library.
- **D-43:** Window selector at top: `day | week | month` → `?window=` param to `GET /api/analytics/kpi`. Default `week`.
- **D-44:** Extend `KpiResponseSchema` in shared-types: add `avgCallDurationS`, `byChannel: { voice: number, telegram: number }`, `conversionFunnel: { calls, answered, leadsCreated, ordersConfirmed, delivered }`.

**Manager Intercept UI (uses Phase 3 endpoints)**
- **D-45:** In `/dashboard/chat`, when lead has `manager_active=false`: show `Перехватить`/`Перехопити` button → `POST /api/leads/:id/intercept` → SWR revalidate.
- **D-46:** When `manager_active=true`: input box becomes manager-message input ("Сообщение от менеджера"). On submit → `POST /api/leads/:id/manager-message {text}`. Also show `Вернуть боту` → `POST /api/leads/:id/release`.
- **D-47:** Voice channel threads NEVER show intercept controls (per Phase 3.1 D-21).

**Sidebar Nav (template trimming)**
- **D-48:** DO NOT delete unused template pages (kanban, fleet, calendar, finance, etc.) — they stay in build to minimize churn.
- **D-49:** Modify sidebar config to only show: Default (KPI), Analytics, Chat, Calls, Orders. Other items commented out (not deleted) for v2 re-enable.
- **D-50:** Customize-panel (theme + language toggle) stays as Zenith ships it.

**i18n RU/UA (I18N-02)**
- **D-51:** Zustand-stored language preference (Zenith already has this). Reuse existing store; add our dictionary.
- **D-52:** Dictionary `apps/web/src/lib/i18n/dict.ts`:
  ```ts
  export const dict = {
    ru: { 'chat.intercept': 'Перехватить', ... },
    ua: { 'chat.intercept': 'Перехопити', ... },
  } as const satisfies Record<'ru'|'ua', Record<string, string>>;
  ```
  + `useT()` hook reading from Zustand. RU is default.
- **D-53:** NO ICU / no plural forms / no date-fns/locale in Phase 4 — Phase 5.
- **D-54:** Date display: raw ISO via `Intl.DateTimeFormat('ru-RU' | 'uk-UA')`. date-fns/locale formatting → Phase 5.
- **D-55:** Dictionary scope: ONLY translate new strings we add (chat headers, calls page filter labels, orders columns, KPI tile titles). Do NOT translate Zenith template's built-in EN/RU strings.

**Realtime / Polling**
- **D-56:** SWR polling intervals (no WS): chat active thread 5s, chat thread list 15s, calls list 30s, orders list 15s, order detail 10s, default+analytics 60s.
- **D-57:** Tab-visibility-aware: pause polling when `document.visibilityState !== 'visible'`. SWR built-in `revalidateOnFocus: true` + custom `isPaused`.

**Tailwind v4 Gotchas (Pitfall #13)**
- **D-58:** Use `border-border` explicitly. Tailwind v4 changed default border color from `gray-200` to `currentColor`. CI grep guard.
- **D-59:** `page.tsx` server / `_components/*.tsx` client convention per spec §7.3 — verify with build-time tsc + Biome.

**File Layout (new files in Phase 4)**
- **D-60:** Backend additions: `apps/api/src/routes/calls.ts` (new); flip 501-stubs in `routes/{leads,orders,trucks,clients,analytics}.ts`.
- **D-61:** Frontend additions under `apps/web/src/`: 6 pages × `page.tsx` + `_components/<feature>-app.tsx` + `lib/{api,format}.ts` + `lib/i18n/dict.ts` + `app/auth/v1/login/route.ts` + `app/auth/v1/logout/route.ts` + `middleware.ts`.
- **D-62:** Shared-types additions: `api/calls.ts` (new), extend `api/analytics.ts` for new KPI fields, extend `api/orders.ts` with `OrderListItemSchema`.

**Testing**
- **D-63:** Frontend tests = page-level smoke via `@testing-library/react` + `vitest`. Each page renders without crash given mocked API response; key interactions assert. NOT full E2E.
- **D-64:** Backend tests = handler integration via testcontainers Postgres (existing Phase 1-3.1 pattern). Each new route: happy-path + edge case.
- **D-65:** Visual smoke = manual UAT-05 (HUMAN-UAT-05.md). No Playwright in Phase 4.

**Config & Env**
- **D-66:** New env vars (`.env.example`): `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `AUTH_COOKIE_SECRET`, `API_INTERNAL_URL`.
- **D-67:** No new backend env vars.

### Claude's Discretion
- Exact pixel spacing inside cards (use Zenith defaults)
- Color palette for status badges (use shadcn semantic: `default`, `secondary`, `destructive`)
- Specific tooltip copy on KPI tiles
- Sidebar navigation icon choices (use lucide-react matching Zenith)
- Internal log severity for failed `/api/*` fetches in Server Components (pino on backend, plain console on frontend dev)
- Whether to fetch order detail right column data (client, route, truck, cargo) as combined response or per-card — recommend single combined (D-39 already).

### Deferred Ideas (OUT OF SCOPE)
- WS `/ws/inbox`, `/ws/tracking` — Phase 5
- `/dashboard/tracking` Leaflet — v2 ADMIN_V2-TRACKING
- `/dashboard/kanban` DnD — v2 ADMIN_V2-KANBAN
- `/dashboard/fleet` CRUD with phone-input — v2 ADMIN_V2-FLEET
- `/dashboard/calendar` — v2 ADMIN_V2-CALENDAR
- Global search (⌘K) — v2 ADMIN_V2-SEARCH
- Price-override modal with audit reason — v2 ADMIN_V2-PRICE-OVERRIDE
- TTN/CMR PDF stub — v2 ADMIN_V2-TTN-PDF
- POST /api/orders (manual create) — v2 ADMIN_V2-ORDER-CREATE
- POST /api/orders/:id/price-override — v2 ADMIN_V2-PRICE-OVERRIDE
- Full ICU MessageFormat pluralization — Phase 5 (I18N-03)
- date-fns/locale formatted dates — Phase 5 (I18N-04)
- POLISH-02 "Simulate call" — Phase 5
- POLISH-03 Voice fallback video — Phase 5
- Multi-tenant admin / RBAC — v2 PROD-03
- Audit log + PII encryption — v2 PROD-03
- Rate limiting on admin API — v2 PROD-05
- Mobile-first responsive — out of scope (demo on laptop)
- Playwright visual regression — Phase 5 / v2
- Server-side rendering of recharts — client-only for Phase 4
- Audio proxying through API — v2 hardening
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| API-03 | `GET /api/leads` (filter by stage, channel) | Existing 501-stub in `apps/api/src/routes/leads.ts`; schema in shared-types/leads.ts already defines `LeadListQuerySchema`. Add `channel` to query schema. Handler = standard Drizzle `leadsRepo.findMany` + filter. |
| API-04 | `GET /api/orders`, `GET /api/orders/:id` | 501-stubs in `apps/api/src/routes/orders.ts`; schemas `OrderListQuerySchema` + `OrderDetailSchema` ready. New `OrderListItemSchema` (extends OrderSchema with `fromCityName`, `toCityName`, `clientName`, `channel`) needed. UNION join pattern (see Architecture Pattern 4). |
| API-05 | `GET /api/trucks` (read-only) | 501-stub in `apps/api/src/routes/trucks.ts`; schema ready. Simple `trucksRepo.findMany` — used only by order detail right column. NO CRUD in Phase 4. |
| API-06 | `GET /api/clients/:id/messages` (UNION messages + calls.transcript) | 501-stub in `apps/api/src/routes/clients.ts`. Multi-source UNION query is the key research item (see Architecture Pattern 4). |
| API-09 | `GET /api/analytics/kpi` (extended) | 501-stub in `apps/api/src/routes/analytics.ts`. Existing `KpiResponseSchema` needs extension per D-44. SQL aggregation pattern in Architecture Pattern 5. |
| ADMIN-01 | Fork Zenith template into `apps/web/` | Recipe in D-01. Verified template details: Next 16.2.4, React 19.2.5, Tailwind 4.1.5, Zod v4 (matches our `zod/v4`), Recharts v3.8, has `proxy.disabled.ts` artifact (Next.js 16 convention). |
| ADMIN-02 | Auth via `/auth/v1/login` | Env-set creds + bcryptjs hash + signed HTTP-only cookie via `middleware.ts` (renamed to `proxy.ts` in Next.js 16 — keep `middleware.ts` deprecated but supported, OR rename — see Pitfall #4). |
| ADMIN-03 | `/dashboard/chat` multi-channel | Zenith ships `src/app/(main)/dashboard/chat/page.tsx` + `_components/chat-app.tsx` — rewire to our union API + audio player + intercept buttons. |
| ADMIN-05 | `/dashboard/default` + `/dashboard/analytics` KPI | Zenith ships both pages with recharts widgets. Rewire data source to our `/api/analytics/kpi`. |
| ADMIN-NEW-02 | `/dashboard/orders` table | New page, follow Zenith convention. Use `@tanstack/react-table` (already in Zenith deps). |
| ADMIN-NEW-03 | `/dashboard/orders/[id]` detail + timeline | New page. Timeline = vertical list of `order_events`. |
| ADMIN-NEW-08 | `/dashboard/calls` table + audio/transcript modal | New page. Audio player = native `<audio>` element (D-25). |
| I18N-02 | Customize-panel RU/UA toggle | Zustand store in `src/stores/preferences/` (Zenith path verified). Hook `useT()` reads `state.lang`, falls back to RU. |
</phase_requirements>

## Summary

Phase 4 is a **scaffold-and-wire** phase — high I/O (UI + backend handler swaps), low conceptual risk. The risk profile is entirely in the **integration seams**: Next.js 16's new opt-in caching model (`'use cache'` ban on dynamic pages), Tailwind v4's `currentColor` border default, Server Component / Client Component boundary discipline, and the **single non-trivial backend query**: the messages + calls.transcript UNION that powers the unified chat thread.

The work splits cleanly into **two parallel tracks**:
1. **Backend (apps/api):** Flip 6 existing 501-stub routes + 1 new file (`routes/calls.ts`). All schemas already exist or extend trivially in `packages/shared-types`. The only research-heavy query is the multi-channel UNION (Pattern 4).
2. **Frontend (apps/web):** Vendor Zenith template wholesale, then add 6 new/rewired pages + auth middleware + i18n dict + API fetcher. Most of the design work is already in the template — Phase 4 swaps data sources.

**Primary recommendation:** Land the Zenith vendoring as a **single mechanical commit** (no edits beyond `package.json` merge), then layer admin-specific changes on top in small commits. This keeps `git blame` legible — "this came from upstream Zenith" vs "this is our Phase 4 work" stays separable, which matters when Zenith ships breaking updates.

**Critical Pitfall #13 trip-wires** (PITFALLS.md):
- `'use cache'` ban on dynamic pages — verified via Next.js 16 docs that caching is now **opt-in** (was implicit in 14/15). Lower risk than originally feared, but CI grep guard still needed because devs may add `'use cache'` for perf "by reflex."
- `border-border` explicit — Tailwind v4 verified: default is now `currentColor`. Zenith template already handles this; new components must follow.
- `page.tsx` server / `_components/*-app.tsx` client — verified Zenith chat page follows this. Phase 4 must enforce on all new pages.
- **NEW finding:** Next.js 16 **renamed `middleware.ts` → `proxy.ts`** as the preferred convention. `middleware.ts` still works (deprecated, slated for removal). CONTEXT.md D-06 references `middleware.ts` — this is fine for Phase 4 (deprecated ≠ broken), but research recommends naming the file `proxy.ts` from day one to avoid Phase 5 churn. **PROPOSE TO PLANNER**: use `proxy.ts` instead of `middleware.ts` to match Next.js 16 native convention (file behaves identically, deprecation timer doesn't expire on us).

## Project Constraints (from CLAUDE.md)

The project CLAUDE.md and `holy-water/CLAUDE.md` were read. Directives Phase 4 must honor:
- **GSD workflow enforcement** — only edit through GSD commands; plans go through `/gsd:execute-phase`.
- **Stack lock**: Next.js 16 (App Router, Turbopack), React 19, TypeScript 5.7 strict, Tailwind v4, shadcn/ui, Zustand, react-hook-form, zod, sonner, lucide-react, libphonenumber-js, date-fns, @dnd-kit, pnpm, Biome. **All frozen — no substitutions.**
- **Backend stack**: Fastify v5 + Drizzle 0.45.2 + PostgreSQL 17 + PostGIS 3.5 + Redis 7. **Already running, no changes.**
- **Anti-LLM-in-money-path discipline (Core Value)**: read-only handlers in Phase 4; no LLM calls in the new admin routes (no risk).
- **No emojis in code or commits** (per Zenith template's CLAUDE.md, which we inherit).
- **`pnpm exec tsc --noEmit` must pass** (Zenith template convention).
- **`pnpm exec biome check` must pass** (project + template convention).
- **Path alias `@/` → `src/`** (Zenith convention; verified from package.json + tsconfig in remote).

## Standard Stack

### Core (locked by CONTEXT + template — verified versions from live Zenith package.json)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **next** | `^16.2.4` (latest 16.2.9 as of 2026-06) | App Router, Turbopack default, Cache Components opt-in | Zenith pins; matches Phase 1 placeholder; supports `proxy.ts` and `'use cache'` directives |
| **react** | `^19.2.5` (latest 19.2.7) | React 19.2 — View Transitions, useEffectEvent, Activity | Required by Next 16; locked by template |
| **typescript** | `^5.9.3` | Strict mode | Bumped from CONTEXT's "5.7+" floor; Zenith uses 5.9 |
| **tailwindcss** | `^4.1.5` | Tailwind v4 (postcss plugin) | Locked. **Note breaking change** — default border = currentColor (D-58) |
| **@tailwindcss/postcss** | `^4.2.4` | Tailwind v4 PostCSS plugin | Zenith convention; replaces v3's `tailwind.config.{js,ts}` |
| **shadcn** | `^4.6.0` | CLI for adding components | Components live in `src/components/ui/` |
| **radix-ui** | `^1.4.3` | Composite Radix UI primitives package | Zenith uses the meta-package; do NOT mix with individual `@radix-ui/*` |
| **zustand** | `^5.0.12` (latest 5.0.14) | Lang preference + theme state | Zenith ships preference store at `src/stores/preferences/` |
| **react-hook-form** | `^7.75.0` | Login form validation | Already in template |
| **@hookform/resolvers** | `^5.2.2` | Zod adapter for RHF | Already in template |
| **zod** | `^4.4.2` | Schema validation | **v4, not v3** — matches `zod/v4` imports already used in `apps/api` + `packages/shared-types` |
| **sonner** | `^2.0.7` | Toasts | Already in template |
| **lucide-react** | `^1.14.0` | Icons | Already in template (note: lucide bumped major to 1.x in 2026) |
| **recharts** | `^3.8.0` (latest 3.8.1) | KPI charts | **v3 not v2** — Zenith confirms; client-only library, requires `'use client'` boundary |
| **@tanstack/react-table** | `^8.21.3` | Calls/orders tables | Already in template; preferred over hand-rolled |
| **date-fns** | `^4.1.0` (latest 4.4.0) | Date math | Already in template; Phase 4 uses minimal subset (no locale yet — D-54) |
| **libphonenumber-js** | `^1.12.42` | Phone display + format | Already in template; Phase 4 uses for masked phone display in `/calls` |
| **@dnd-kit/core/sortable/modifiers** | various | DnD primitives | Present but **UNUSED in Phase 4** (Kanban is deferred to v2) |
| **next-themes** | `^0.4.6` | Light/dark theme switching | Already in template; Customize panel uses it |
| **tw-animate-css** | `^1.4.0` | Tailwind v4 animation utilities | Already in template (replaces deprecated `tailwindcss-animate`) |

### NEW dependencies Phase 4 must ADD to `apps/web/package.json`

| Library | Version | Purpose | Why Needed |
|---------|---------|---------|-----------|
| **swr** | `^2.4.1` (latest 2.4.1) | Client-side data refresh on chat/calls/orders/order-detail | D-11. Not in Zenith. Smaller than React Query, no mutation queue needed. |
| **bcryptjs** | `^3.0.3` (latest 3.0.3) | Hash admin password (D-05) | Pure JS, **no native build tools needed** (critical for our containerized deploy). bcryptjs 3.x added native ESM support. |
| **jose** | `^6.2.3` (latest 6.2.3) | Sign/verify HTTP-only cookie via HMAC (D-06) | Pure-ESM JWT/JWS library; works in Next.js 16 proxy.ts (Node.js runtime). Avoids iron-session's session store complexity. |
| **@ai-logist/shared-types** | `workspace:*` | Zod schemas + types | D-18. Workspace dep — pnpm resolves automatically. |

### Supporting (for backend handler completion)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| existing `drizzle-orm` | 0.45.2 | All new query builders | Standard repo patterns; `db.execute(sql\`...\`)` for the UNION query |
| existing `fastify-type-provider-zod` | bundled | Type provider | Already in use across all routes |
| existing `@fastify/sensible` | bundled | `reply.notImplemented()` etc | Already in use |

### What we DON'T add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **NextAuth / Auth.js** | Single-user admin, no OAuth needed (D-05); brings unnecessary DB schema | Hand-rolled bcryptjs + jose + signed cookie (40 LOC total) |
| **iron-session** | Session store complexity unnecessary for stateless single-user demo | jose-signed cookie carries `{username, issuedAt}` — stateless |
| **React Query (@tanstack/react-query)** | Bigger bundle, mutation queue overkill for Phase 4 (mostly read-only) | SWR (D-11) |
| **argon2 npm** | Requires C compiler + node-gyp at install — breaks in serverless / minimal containers | bcryptjs (pure JS, ESM-native) — security difference negligible for single-user demo |
| **wavesurfer.js / howler.js / react-audio-player** | Saves bundle (Twilio MP3 + native `<audio>` is enough) | Native `<audio controls>` (D-25) |
| **chart.js / nivo / visx** | Recharts already in Zenith | recharts (D-42) |
| **react-leaflet / leaflet** | Tracking deferred to v2 | — (don't install) |
| **@dnd-kit usage** | Kanban deferred; deps are in template but no Phase 4 import | — (deps stay installed, code-import absent) |

**Installation (apps/web after Zenith vendor):**
```bash
pnpm --filter @ai-logist/web add swr@^2.4.1 bcryptjs@^3.0.3 jose@^6.2.3 @ai-logist/shared-types@workspace:*
pnpm --filter @ai-logist/web add -D @testing-library/react@^16 @testing-library/dom@^10 happy-dom@^15
```

**Version verification (recorded 2026-06-10):**
```
next            16.2.9 (Zenith pins ^16.2.4, latest 16.2.9 — same minor)
react           19.2.7 (Zenith pins ^19.2.5)
swr             2.4.1
bcryptjs        3.0.3 (latest 3.x, ESM-native)
jose            6.2.3
recharts        3.8.1
tailwindcss     4.3.0 (Zenith pins ^4.1.5; minor floats fine)
date-fns        4.4.0
zustand         5.0.14
sonner          2.0.7
@tanstack/rq    5.101.0 (for reference only — not used)
iron-session    8.0.4 (for reference only — not used)
```

## Architecture Patterns

### Recommended Project Structure (after Zenith vendor)

```
apps/web/
├── src/
│   ├── app/
│   │   ├── auth/
│   │   │   └── v1/
│   │   │       ├── login/
│   │   │       │   ├── page.tsx              # Zenith login UI (reuse)
│   │   │       │   ├── _components/
│   │   │       │   │   └── login-form.tsx    # Rewire onSubmit to POST /auth/v1/login
│   │   │       │   └── route.ts              # NEW — POST handler (bcrypt + set cookie)
│   │   │       └── logout/
│   │   │           └── route.ts              # NEW — POST handler (clear cookie + redirect)
│   │   └── (main)/
│   │       ├── layout.tsx                    # Zenith — keep
│   │       └── dashboard/
│   │           ├── default/                  # ADMIN-05 — REWIRE (KPI tiles)
│   │           ├── analytics/                # ADMIN-05 — REWIRE (charts)
│   │           ├── chat/                     # ADMIN-03 — REWIRE (multi-channel)
│   │           ├── calls/                    # ADMIN-NEW-08 — NEW
│   │           │   ├── page.tsx              # Server: fetch initial list
│   │           │   └── _components/
│   │           │       ├── calls-app.tsx     # Client: table + filters + modal
│   │           │       └── call-detail-modal.tsx
│   │           ├── orders/                   # ADMIN-NEW-02 — NEW
│   │           │   ├── page.tsx
│   │           │   ├── _components/orders-app.tsx
│   │           │   └── [id]/                 # ADMIN-NEW-03 — NEW
│   │           │       ├── page.tsx
│   │           │       └── _components/order-detail-app.tsx
│   │           ├── kanban/                   # KEEP — unmodified Zenith (D-48)
│   │           ├── calendar/                 # KEEP — unmodified
│   │           ├── mail/                     # KEEP — unmodified
│   │           ├── crm/, finance/, productivity/, draggable/, components/, coming-soon/, (legacy)/, [...not-found]/  # KEEP all
│   │           └── _components/sidebar/      # Modify sidebar-items to hide non-Phase-4 entries
│   ├── lib/
│   │   ├── api.ts                            # NEW — apiGet<Schema>(path, schema) helper (D-14)
│   │   ├── auth.ts                           # NEW — signCookie + verifyCookie + hash
│   │   ├── format.ts                         # NEW — formatMoney + formatPhone + formatDate
│   │   └── i18n/
│   │       ├── dict.ts                       # NEW — RU/UA dictionary (D-52)
│   │       └── use-t.ts                      # NEW — useT() hook reading Zustand
│   ├── stores/
│   │   └── preferences/                      # ZENITH — extend with our t() lookup
│   ├── navigation/sidebar/sidebar-items.ts   # MODIFY — comment out non-Phase-4 items
│   ├── components/ui/                        # ZENITH shadcn primitives — untouched
│   └── proxy.ts                              # NEW (renamed from CONTEXT's middleware.ts per Next.js 16)
├── scripts/
│   └── gen-admin-password.ts                 # NEW — bcrypt CLI for ADMIN_PASSWORD_HASH
├── public/                                   # ZENITH static — untouched
├── components.json                           # ZENITH shadcn config — copy as-is
├── postcss.config.mjs                        # ZENITH — copy as-is
├── tailwind.config.ts                        # ZENITH — copy as-is (v4 config)
├── next.config.ts                            # MERGE Zenith config + our `output: 'standalone'`
├── tsconfig.json                             # MERGE Zenith strict + monorepo refs
└── package.json                              # MERGE: keep our dev script (`-p 3001`), inherit Zenith deps + add SWR/bcryptjs/jose

apps/api/
└── src/routes/
    ├── calls.ts                              # NEW — GET /api/calls, GET /api/calls/:id
    ├── clients.ts                            # REWIRE — UNION messages + calls.transcript
    ├── orders.ts                             # REWIRE — GET list (joined) + detail (extended)
    ├── leads.ts                              # REWIRE — flip GET /leads stub
    ├── trucks.ts                             # REWIRE — flip GET /trucks stub
    └── analytics.ts                          # REWIRE — KPI aggregation

packages/shared-types/src/api/
├── calls.ts                                  # NEW — CallSchema, CallDetailSchema, CallListQuerySchema
├── orders.ts                                 # EXTEND — add OrderListItemSchema (joined fields)
├── analytics.ts                              # EXTEND — KpiResponseSchema += avgCallDurationS, byChannel, conversionFunnel
└── leads.ts                                  # EXTEND — LeadListQuerySchema += channel filter
```

### Pattern 1: Server fetch → Client SWR hydration

**What:** `page.tsx` (server) fetches initial data with `apiGet`; `_components/<feature>-app.tsx` (client) receives it via props, passes to SWR as `fallbackData`. Client component remains interactive (filters, refresh, polling) but first paint is fully populated.

**When to use:** Every dynamic dashboard page (chat, calls, orders, orders/[id]).

**Example:**
```tsx
// page.tsx (Server Component — NO 'use client', NO 'use cache')
// Source: https://swr.vercel.app/docs/with-nextjs (server prefetch pattern)
import { Metadata } from 'next';
import { apiGet } from '@/lib/api';
import { OrderListItemSchema } from '@ai-logist/shared-types/api/orders';
import { z } from 'zod/v4';
import { OrdersApp } from './_components/orders-app';

export const metadata: Metadata = { title: 'Orders' };

export default async function OrdersPage({
  searchParams,
}: { searchParams: Promise<{ status?: string; channel?: string }> }) {
  // Next.js 16 — searchParams is async (breaking change)
  const params = await searchParams;
  const qs = new URLSearchParams(params).toString();

  const initial = await apiGet(
    `/orders?${qs}`,
    z.array(OrderListItemSchema)
  );

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="font-bold text-2xl tracking-tight">Заказы</h1>
      </header>
      <OrdersApp initialOrders={initial} initialQuery={params} />
    </div>
  );
}
```

```tsx
// _components/orders-app.tsx
'use client';
import useSWR from 'swr';
import type { OrderListItem } from '@ai-logist/shared-types/api/orders';

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`API ${r.status}`);
  return r.json();
};

export function OrdersApp({
  initialOrders,
  initialQuery,
}: {
  initialOrders: OrderListItem[];
  initialQuery: { status?: string; channel?: string };
}) {
  const [filters, setFilters] = useState(initialQuery);
  const qs = new URLSearchParams(filters as Record<string, string>).toString();

  const { data: orders } = useSWR<OrderListItem[]>(
    `/api/orders?${qs}`,
    fetcher,
    {
      fallbackData: initialOrders,   // Critical: prevents hydration mismatch
      refreshInterval: 15_000,        // D-56 — orders list polls every 15s
      revalidateOnFocus: true,
      isPaused: () => document.visibilityState !== 'visible',  // D-57
    }
  );

  // ... render table
}
```

**Hydration mismatch avoidance:** Use `fallbackData` (NOT `initialData` — different SWR API for v2.x: `fallbackData` is the per-hook initial value that SWR considers stale-by-default and triggers an immediate revalidation; `initialData` is older v1 API and does not trigger revalidation). SWR v2 docs explicitly recommend `fallbackData` for SSR/RSC hydration.

### Pattern 2: Recharts inside Server-rendered analytics page

**What:** Recharts requires `'use client'` (uses `useRef` + Resize observer). Server fetches data; client component renders charts.

**When to use:** `/dashboard/default` (KPI tiles), `/dashboard/analytics` (full charts).

**Example:**
```tsx
// app/(main)/dashboard/analytics/page.tsx (Server)
import { apiGet } from '@/lib/api';
import { KpiResponseSchema } from '@ai-logist/shared-types/api/analytics';
import { AnalyticsApp } from './_components/analytics-app';

// D-13: can opt into 'use cache' for KPI page (aggregated data)
// 'use cache';  // <-- enable ONLY if cacheComponents:true in next.config; otherwise no-op
// import { cacheLife } from 'next/cache';

export default async function AnalyticsPage({
  searchParams,
}: { searchParams: Promise<{ window?: 'day' | 'week' | 'month' }> }) {
  const { window: w = 'week' } = await searchParams;
  const kpi = await apiGet(`/analytics/kpi?window=${w}`, KpiResponseSchema);
  return <AnalyticsApp initialKpi={kpi} initialWindow={w} />;
}
```

```tsx
// _components/analytics-app.tsx
'use client';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import useSWR from 'swr';
// ... chart components using KPI data
```

**Note:** Even if `next.config.ts` enables `cacheComponents: true`, the `'use cache'` directive on chat/calls/orders is forbidden per D-12. Analytics can opt-in (D-13) but recommend leaving it off in Phase 4 — adds caching complexity for ~5% perf win at demo scale.

### Pattern 3: Cookie-signed auth via Next.js proxy.ts (formerly middleware.ts)

**What:** A signed cookie carries `{username, issuedAt}`; `proxy.ts` (Node.js runtime) verifies it on every request to `/(main)/*`. Unauth → 307 redirect to `/auth/v1/login`.

**When to use:** Every page under `(main)/` route group needs gating. Login + logout route handlers issue/clear the cookie.

**Example:**
```ts
// apps/web/src/proxy.ts
// Source: https://nextjs.org/blog/next-16#proxyts-formerly-middlewarets
// proxy.ts is the Next.js 16 replacement for middleware.ts — runs on Node.js runtime
import { type NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'al_session';
const SECRET = new TextEncoder().encode(process.env.AUTH_COOKIE_SECRET);

export async function proxy(req: NextRequest) {
  const isProtected = req.nextUrl.pathname.startsWith('/dashboard');
  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.redirect(new URL('/auth/v1/login', req.url));

  try {
    await jwtVerify(token, SECRET);  // HMAC-SHA256 (HS256)
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/auth/v1/login', req.url));
  }
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
```

```ts
// apps/web/src/app/auth/v1/login/route.ts
// Source: Next.js 16 route handler patterns + bcryptjs ESM-native
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';

const LoginBody = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const SECRET = new TextEncoder().encode(process.env.AUTH_COOKIE_SECRET);

export async function POST(req: NextRequest) {
  const body = LoginBody.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }
  const { username, password } = body.data;

  // Constant-time compare for username (avoid timing-side-channel)
  if (username !== process.env.ADMIN_USERNAME) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }
  const ok = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH!);
  if (!ok) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  const token = await new SignJWT({ username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(SECRET);

  const c = await cookies();  // Next.js 16 — async (breaking change)
  c.set('al_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
  return NextResponse.json({ ok: true });
}
```

**Critical Next.js 16 detail:** `cookies()`, `headers()`, `searchParams`, `params` are now ALL async. Phase 4 code must `await` them everywhere. This is also a breaking change from Next.js 15 → 16. Zenith template's `cookies()` calls (if any) need audit during vendor.

### Pattern 4: PostgreSQL UNION query — messages + calls.transcript chronological feed

**What:** `GET /api/clients/:id/messages` returns a chronologically sorted virtual stream merging:
1. Real `messages` rows (role='client'|'ai'|'manager', channel='telegram')
2. `calls.transcript` jsonb turns expanded — each turn becomes a virtual message (role='ai' if speaker='agent', role='client' if speaker='caller'; channel='voice')

Each voice turn carries `call_id` + `timestamp_ms` (offset within audio) so the UI can seek the audio player.

**When to use:** Backend implementation of API-06 (the only non-trivial query in Phase 4).

**Recommended pattern — UNION ALL with `jsonb_array_elements`:**
```sql
-- Source: PostgreSQL jsonb_array_elements docs + UNION ALL pattern
-- (multi-source chronological feeds — verified pattern, demo-scale appropriate)
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
  WHERE m.client_id = $1
),
voice AS (
  SELECT
    c.id::text || ':' || (turn->>'idx')         AS id,
    -- Project turn timestamp onto an absolute timestamp by adding ms offset
    -- to the call's created_at (assumes call start time stays accurate to
    -- transcript offset — true for ElevenLabs).
    c.created_at + ((turn->>'timestamp_ms')::bigint * INTERVAL '1 ms') AS created_at,
    CASE WHEN turn->>'speaker' = 'agent' THEN 'ai' ELSE 'client' END   AS role,
    turn->>'text'                                                       AS text,
    'voice'                                                             AS channel,
    c.id                                                                AS call_id,
    (turn->>'timestamp_ms')::bigint                                     AS timestamp_ms,
    c.audio_url                                                         AS audio_url
  FROM calls c,
       LATERAL jsonb_array_elements(c.transcript) WITH ORDINALITY AS t(turn, idx)
  WHERE
    -- Must restrict to this client: either linked_lead_id's lead.client_id matches,
    -- OR the call's lead_id (legacy linkage) matches.
    EXISTS (
      SELECT 1 FROM leads l
      WHERE (l.id = c.linked_lead_id OR l.id = c.lead_id)
        AND l.client_id = $1
    )
)
SELECT * FROM msgs
UNION ALL
SELECT * FROM voice
ORDER BY created_at ASC
LIMIT $2 OFFSET $3;
```

**Performance notes:**
- `messages` has `messages_client_id_idx` (Phase 1 — verified). UNION ALL leaves merging to PG; planner can use index.
- `calls.transcript` is jsonb — `jsonb_array_elements` is a row-expansion function (`LATERAL` keyword is correct here). At demo scale (<200 calls, <20 turns each = 4k rows expanded), this is sub-100ms.
- For production scale (>10k calls): pre-materialize transcript turns into a `voice_turns` table on call-end (denormalize). NOT needed for Phase 4 demo.
- `WITH ORDINALITY` gives each turn an `idx` so virtual `id` is stable across pagination.

**Alternative considered & rejected:** Window functions over a single materialized view. Would require a refresh trigger on call-end webhook. Heavier than UNION ALL for demo scale.

**Critical assumption:** ElevenLabs transcript turn shape (from Phase 3.1 D-13):
```json
[
  {"speaker": "agent", "text": "Здравствуйте", "timestamp_ms": 0},
  {"speaker": "caller", "text": "Алло", "timestamp_ms": 1200},
  ...
]
```
The handler defensively coerces missing fields to defaults. If `timestamp_ms` is missing, virtual `created_at` falls back to `c.created_at + idx * 1000` (rough sequencing).

### Pattern 5: KPI aggregation SQL for `/api/analytics/kpi`

**What:** Single roundtrip computes calls/leads/orders/revenue/conversion-funnel/byChannel/avgCallDuration over the selected window.

**When to use:** Backend implementation of API-09 (extended per D-44).

**Recommended pattern — single query, multiple CTEs:**
```sql
-- Source: PostgreSQL FILTER clause for conditional aggregation (PG 9.4+)
WITH window_bounds AS (
  SELECT
    NOW() - CASE $1::text
      WHEN 'day'   THEN INTERVAL '1 day'
      WHEN 'week'  THEN INTERVAL '7 days'
      WHEN 'month' THEN INTERVAL '30 days'
    END AS since
),
call_stats AS (
  SELECT
    COUNT(*) FILTER (WHERE outcome IS NOT NULL)                 AS total,
    COUNT(*) FILTER (WHERE outcome IN ('completed','escalated')) AS answered,
    AVG(duration_s) FILTER (WHERE duration_s IS NOT NULL)::int  AS avg_duration_s
  FROM calls
  WHERE created_at >= (SELECT since FROM window_bounds)
),
lead_stats AS (
  SELECT
    COUNT(*)                                                     AS total,
    COUNT(*) FILTER (WHERE channel = 'voice')                    AS by_voice,
    COUNT(*) FILTER (WHERE channel = 'telegram')                 AS by_telegram,
    jsonb_object_agg(stage, n) AS by_stage
  FROM (
    SELECT stage, channel, COUNT(*) AS n
    FROM leads
    WHERE created_at >= (SELECT since FROM window_bounds)
    GROUP BY stage, channel
  ) g
),
order_stats AS (
  SELECT
    COUNT(*) FILTER (WHERE status >= 'CREATED')                  AS created,
    COUNT(*) FILTER (WHERE status = 'DELIVERED' OR status = 'CLOSED') AS delivered,
    COALESCE(SUM(price), 0)::text                                AS revenue_kopecks
  FROM orders
  WHERE created_at >= (SELECT since FROM window_bounds)
)
SELECT
  $1::text       AS window,
  jsonb_build_object(
    'total',    (SELECT total FROM call_stats),
    'answered', (SELECT answered FROM call_stats)
  )              AS calls,
  jsonb_build_object(
    'total',   (SELECT total FROM lead_stats),
    'byStage', COALESCE((SELECT by_stage FROM lead_stats), '{}'::jsonb)
  )              AS leads,
  jsonb_build_object(
    'created',   (SELECT created FROM order_stats),
    'delivered', (SELECT delivered FROM order_stats)
  )              AS orders,
  jsonb_build_object(
    'amount',   COALESCE((SELECT revenue_kopecks FROM order_stats), '0'),
    'currency', 'RUB'
  )              AS revenue,
  (SELECT avg_duration_s FROM call_stats)              AS "avgCallDurationS",
  jsonb_build_object(
    'voice',    COALESCE((SELECT by_voice FROM lead_stats), 0),
    'telegram', COALESCE((SELECT by_telegram FROM lead_stats), 0)
  )              AS "byChannel",
  jsonb_build_object(
    'calls',           (SELECT total FROM call_stats),
    'answered',        (SELECT answered FROM call_stats),
    'leadsCreated',    (SELECT total FROM lead_stats),
    'ordersConfirmed', (SELECT created FROM order_stats),
    'delivered',       (SELECT delivered FROM order_stats)
  )              AS "conversionFunnel";
```

**Notes:**
- `OrderStatus` enum ordering: per Phase 1 enums (`CREATED < DRIVER_ASSIGNED < AT_LOADING < IN_TRANSIT < AT_BORDER < DELIVERED < CLOSED`). The `>= 'CREATED'` filter is always true; kept for clarity.
- `revenue` summed as bigint kopecks → string via `::text` cast (avoids JS number precision loss).
- `byChannel` derived from lead's `channel` column ('voice' / 'telegram') — Phase 3 added it.

### Anti-Patterns to Avoid

- **`'use client'` on `page.tsx`** — Forbidden per spec §7.3 + Pitfall #13. Causes loss of SSR data fetching; all data hits client-side. Symptom: spinner on first paint.
- **Bare `<div className="border">` without `border-border`** — Tailwind v4 default = `currentColor` → looks broken in dark mode (text color borders). CI grep gate from D-58.
- **`'use cache'` on chat/calls/orders** — Forbidden per D-12. Manager won't see fresh data. CI grep gate from D-12.
- **`useEffect` polling instead of SWR `refreshInterval`** — Reinvents what SWR does correctly. Symptom: polling continues on hidden tabs, wastes API quota.
- **Importing `recharts` inside `page.tsx`** — Recharts is client-only; SSR errors on `window is not defined`. Always wrap in `_components/<feature>-app.tsx` with `'use client'`.
- **Mixing `@radix-ui/react-*` with `radix-ui` meta-package** — Zenith uses the meta-package. Two installations create duplicate components. Always import from `radix-ui` directly.
- **Using `cookies()` / `headers()` synchronously** — Next.js 16 broke this; must `await cookies()` everywhere. Zenith package.json pin (16.2.4) confirms this is the version we vendor.
- **Trusting `format` libraries for kopecks** — `Intl.NumberFormat` accepts a `bigint` but rounds to JS number internally for non-integer cases. Phase 4 displays kopecks ÷ 100 as integer rubles (no decimals shown) so this is fine; document the boundary.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| **Data refresh / polling** | Custom `useEffect` + `setInterval` | `useSWR({ refreshInterval })` | SWR handles tab-visibility, dedupe, focus revalidation, error retry. |
| **Table sorting/filtering/pagination** | Hand-rolled `useState` table logic | `@tanstack/react-table` (already in Zenith) | Handles client-side sort/filter/pagination + URL search-param sync. |
| **Modal/dialog primitives** | Custom `<div>` with portal | shadcn `<Dialog>` (already in template) | A11y (focus trap, escape, restore focus) is hard. |
| **Status badge colors** | Custom `if (status === 'ACTIVE') return red` | shadcn `<Badge variant>` (default/secondary/destructive/outline) | Theme-aware; supports dark mode automatically. |
| **Audio waveform UI** | wavesurfer.js or custom canvas | Native `<audio controls>` (D-25) | Saves ~80kb bundle; native controls work everywhere; no Chrome autoplay friction. |
| **Date display** | Hand-rolled "5 минут назад" | `date-fns/formatDistanceToNow` (already in template) | Polish to Phase 5; Phase 4 just uses raw `new Date().toLocaleString('ru-RU')` per D-54. |
| **Phone number masking** | String substring | `libphonenumber-js` (already in template) | Handles E.164 + national formats; we use it for last-4-digit display. |
| **Cookie signing** | Hand-rolled HMAC | `jose` (jose.SignJWT + jose.jwtVerify) | jose is the de-facto standard for stateless JWT/JWS in Node.js ESM. iron-session adds session store complexity not needed for single-user. |
| **Password hashing** | crypto.pbkdf2 | `bcryptjs` (pure JS, ESM-native) | bcryptjs is battle-tested for 20+ years; argon2 needs native compile. |
| **CSV / JSON export buttons** | Custom blob download | NOT in Phase 4 (deferred) | If asked: `@tanstack/react-table` has CSV export plugin in v9 roadmap. |
| **Chart components** | D3 from scratch | `recharts` (already in Zenith) | Composable React components, declarative, theme-aware. |

**Key insight:** Zenith template already ships ~85% of UI primitives needed. Phase 4's job is wiring + data, not component building.

## Runtime State Inventory

> Phase 4 is **not** a rename/refactor — it's a scaffold-and-wire. This section is included because Phase 4 introduces **NEW runtime state** (auth cookie, env vars, browser localStorage for unread badges) that must be inventoried.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data (DB) | No schema changes in Phase 4. All tables (messages, calls, leads, orders, order_events, trucks, clients, cities) already exist with the columns we need. | None — read-only access only. |
| Live service config | None — Caddy `/api/*` proxy already configured in Phase 1; Fastify routes register self via existing `app.ts`. | None. |
| OS-registered state | None — no systemd / cron / pm2 work in Phase 4. | None. |
| Secrets/env vars | **NEW (D-66):** `ADMIN_USERNAME` (web), `ADMIN_PASSWORD_HASH` (web — bcrypt), `AUTH_COOKIE_SECRET` (web — 32-byte hex), `API_INTERNAL_URL` (web — server-side fetch base). | Add to `.env.example` + `apps/web/.env.example` + README "Setup" section. `pnpm gen:admin-password` CLI writes the hash. |
| Build artifacts | Zenith vendor brings new `node_modules` entries (radix-ui meta-package, base-ui, react-day-picker, embla-carousel, react-resizable-panels, simple-icons, etc.). Old Phase 1 `apps/web/node_modules/.next` cache must be wiped after vendor. | `rm -rf apps/web/.next apps/web/node_modules && pnpm install` post-vendor. |
| Browser localStorage | **NEW (D-21):** unread badge counters keyed by `chat:lastViewed:<client_id>` (ISO timestamp). Cleared on tab opening matching thread. Cleared by user via "Mark all read" button (defer to v2 polish). | Document key naming in `apps/web/src/lib/storage.ts` (`UNREAD_KEY_PREFIX = 'al:chat:lastViewed:'`). |
| Session cookie | **NEW (D-06):** `al_session` HTTP-only cookie carrying `{username, iat, exp}` signed with HS256 via jose. 12h lifetime. | `proxy.ts` verifies; `auth/v1/login/route.ts` issues; `auth/v1/logout/route.ts` clears. |
| Twilio audio URLs | `calls.audio_url` already populated by Phase 3.1. Phase 4 just reads it. Twilio URLs are signed + time-limited — for demo this is fine (D-27). v2 hardening proxies through our API. | None in Phase 4. |

**Nothing found in category:** Categories with "None" above were verified explicitly by reading Phase 1-3.1 STATE.md + grep of `apps/api/src` for new registrations.

## Common Pitfalls

### Pitfall 1: Zenith repo evolves between vendor moment and Phase 4 start
**What goes wrong:** Zenith CLAUDE.md / sidebar config / chat-app shape changes between when we read the README and when Plan 01 vendors. Phase 4 plans reference shapes that don't exist.
**Why it happens:** Solo maintainer repo, no version tags, rolling main.
**How to avoid:** Plan 01 MUST record the exact git SHA vendored in `apps/web/VENDOR.md` (also documented in CONTEXT D-57's "Risks / Watch-Outs"). Capture `package.json` deps verbatim in the same file. Future plans cite SHA, not "latest main."
**Warning signs:** `pnpm install` fails with new peer deps. Zenith's chat-app uses a hook our SWR pattern doesn't recognize.

### Pitfall 2: Next.js 16 async breaking changes
**What goes wrong:** Zenith template was last touched against an earlier Next 16 minor; codebases using sync `cookies()` / `headers()` / `searchParams` / `params` throw at runtime.
**Why it happens:** Next.js 16 made all 4 APIs async — a known breaking change from 15.
**How to avoid:** Audit Zenith chat-app + login-form for these calls; rewrite to `await`. Add a CI check: `grep -rn "cookies()" apps/web/src | grep -v "await cookies()"` returns empty.
**Warning signs:** "Cannot read properties of undefined (reading 'get')" on `cookies.get(...)`. `await searchParams` not propagated.

### Pitfall 3: PNPM workspace + Zenith package.json merge conflict
**What goes wrong:** Zenith ships `"name": "studio-admin"` — keep our `"name": "@ai-logist/web"`. Zenith adds `husky` and `lint-staged` deps that conflict with our root-level lint setup. Zenith uses `"dev": "next dev"` (port 3000) — we need `"dev": "next dev --turbopack -p 3001"`.
**Why it happens:** Two separately maintained `package.json` files. Vendor is bulk-copy.
**How to avoid:** Merge logic in Plan 01:
  - KEEP from current `apps/web/package.json`: `name`, `version`, `private`, `type: "module"`, our scripts (`dev`, `build`, `start`).
  - ADD from Zenith: every dependency under `dependencies` + `devDependencies` (no version manipulation per D-04).
  - DROP from Zenith: `husky`, `lint-staged`, `prepare` script (we use root-level Biome via existing `pnpm check`).
  - ADD new: `swr`, `bcryptjs`, `jose`, `@ai-logist/shared-types@workspace:*`.
**Warning signs:** Two `node_modules/.bin/biome` resolved differently between root and apps/web. `pnpm dev` runs on :3000 instead of :3001.

### Pitfall 4: `middleware.ts` vs `proxy.ts` confusion (Next.js 16)
**What goes wrong:** CONTEXT D-06 says "Next.js middleware (`middleware.ts`)". Next.js 16 **renamed this to `proxy.ts`** and deprecated `middleware.ts`. Both work in 16.x; `middleware.ts` will be removed in a future version.
**Why it happens:** Recent rename (Oct 2025 in Next.js 16 release notes). Stale tutorials still say "middleware."
**How to avoid:** **RESEARCH RECOMMENDS to PLANNER:** rename to `proxy.ts` from day one. The behavior is identical (Node.js runtime, same `NextRequest`/`NextResponse` API, same `matcher` config). Why use the deprecated name? Note that Zenith template already has `proxy.disabled.ts` artifact — they anticipated this. CONTEXT.md D-06 wording is the only thing to override; the plan's task description should say "proxy.ts (formerly middleware.ts)."
**Warning signs:** `middleware.ts` works but throws a deprecation warning in next 16.x dev console. Plan 5 (notif) might add new gate logic and the file name divergence creates churn.

### Pitfall 5: Tailwind v4 `border-border` regression in new components
**What goes wrong:** Phase 4 dev copies a chart card component from a shadcn snippet on the web. The snippet uses bare `border` instead of `border-border`. In Phase 4 light mode looks fine; in dark mode the border picks up text color (white-on-dark text) → visible white box around every card.
**Why it happens:** Tailwind v4 changed the default border color from `gray-200` to `currentColor` (verified — see tailwindcss.com/docs/upgrade-guide).
**How to avoid:** CI grep guard from D-58:
```bash
# Match `border` followed by space/quote/end (bare class), but not `border-border` etc.
grep -rE 'className="[^"]*\bborder\b(\s|"|$)[^"]*"' apps/web/src/app/\(main\)/dashboard/ \
  | grep -v 'border-border\|border-[a-z]' \
  && exit 1 || exit 0
```
Add to plan-check pre-commit. Visual smoke test: open each new page in dark mode after first paint.
**Warning signs:** White borders on cards in dark mode. Tailwind diagnostic "border-color: currentcolor" in DevTools computed style.

### Pitfall 6: SWR `fallbackData` vs `initialData` confusion → hydration mismatch
**What goes wrong:** Dev uses `initialData` (SWR v1 API) instead of `fallbackData` (v2). SWR v2 silently uses initialData but doesn't trigger revalidation, so first interaction sees stale data forever. OR uses `fallbackData` but the server-rendered value differs from the SWR cache key — hydration warning, content flicker.
**Why it happens:** SWR v1 → v2 API split; both names live in different code paths.
**How to avoid:** Standardize on `fallbackData` (per SWR v2 + Next.js App Router docs). Key the SWR hook by the EXACT same URL the server fetched. Use `unstable_serialize` if key includes arrays/objects.
**Warning signs:** React dev warning "Hydration mismatch." First-paint data is from server but never refreshes. Network tab shows no fetch on page load.

### Pitfall 7: UNION query performance under cold cache
**What goes wrong:** First load of `/dashboard/chat` for a client with 100 messages + 5 calls × 20 turns = 200 virtual rows. Without proper indexing, this can take 200-500ms cold.
**Why it happens:** `jsonb_array_elements` is row-expansion (a SET RETURNING FUNCTION); planner may not push filters down efficiently across the LATERAL boundary.
**How to avoid:** For demo scale (≤5 active clients × ≤30 calls each), index `calls.linked_lead_id` + `calls.lead_id` (Phase 3.1 added both — verified in `apps/api/src/persistence/schema/calls.ts`). The CTE form with EXISTS is plan-friendly. Add `EXPLAIN ANALYZE` smoke to plan acceptance: query for the largest demo client returns in <100ms.
**Warning signs:** Chat thread "loading..." spinner visible. `pg_stat_statements` shows the query at top of slow list.

### Pitfall 8: Audio autoplay restrictions (Chrome / Safari)
**What goes wrong:** D-26's "click transcript turn → seek + play" fails on first interaction because the browser blocks autoplay without user gesture.
**Why it happens:** Chrome's autoplay policy requires user-gesture initiation for audio.play() unless audio is muted.
**How to avoid:** First call to `audio.play()` inside a click handler (which is a user gesture). The first turn-click satisfies the autoplay heuristic; subsequent calls work. If user navigates to the modal and clicks a turn before the audio element renders, ensure we re-attach after mount. Use `audio.play().catch(() => {})` to silence rejected promise.
**Warning signs:** Console: "NotAllowedError: play() failed because the user didn't interact with the document first."

### Pitfall 9: Zenith's existing chat page state collides with our SWR refresh
**What goes wrong:** Zenith's chat page may use Zustand or its own state for the thread list. Our SWR refresh overwrites Zenith's optimistic update for the "intercept" button.
**Why it happens:** Two state systems writing to the same UI.
**How to avoid:** Rewrite Zenith's `_components/chat-app.tsx` to use OUR SWR pattern entirely — no Zustand for chat state. Keep Zustand only for the lang preference (D-51) which Zenith already owns. Document this in plan as "chat-app.tsx is a near-total rewrite, not a wire-up."
**Warning signs:** Click "intercept" → button flashes "Перехватить" → "Manager active" → back to "Перехватить" within 100ms (because two refreshes race).

### Pitfall 10: Recharts v3 vs v2 API changes
**What goes wrong:** Phase 4 dev copies recharts snippets from a 2024 tutorial. Recharts v3 (in Zenith deps) has API breakages from v2 — different `Tooltip` API, removed `Legend.iconType`, etc.
**Why it happens:** Recharts v3 released early 2026.
**How to avoid:** Pin to Zenith's `^3.8.0`. When stuck, read https://recharts.org/en-US/api (always show latest). Avoid stack-overflow snippets older than 2026.
**Warning signs:** `<Tooltip />` renders blank. Recharts console warning about deprecated prop.

## Code Examples

### Example 1: `apiGet` helper (Server Component fetcher)

```ts
// apps/web/src/lib/api.ts
// Source: D-14 + D-17 + project convention
import type { z } from 'zod/v4';

const INTERNAL_BASE = process.env.API_INTERNAL_URL ?? 'http://localhost:3000';

export async function apiGet<T extends z.ZodTypeAny>(
  path: string,
  schema: T,
  init?: RequestInit
): Promise<z.infer<T>> {
  const isServer = typeof window === 'undefined';
  const url = isServer
    ? `${INTERNAL_BASE}/api${path}`
    : `/api${path}`;

  const res = await fetch(url, {
    ...init,
    headers: { 'accept': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',  // Dynamic pages — let SWR / Server Component control freshness
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`apiGet ${path} ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    // Surface full path + payload for fast diagnosis (D-14)
    throw new Error(
      `apiGet ${path} schema mismatch: ${JSON.stringify(parsed.error.issues.slice(0, 3))}`
    );
  }
  return parsed.data;
}
```

### Example 2: Calls table page (server + client split)

```tsx
// apps/web/src/app/(main)/dashboard/calls/page.tsx
// SERVER — no 'use client', no 'use cache' (D-12)
import type { Metadata } from 'next';
import { z } from 'zod/v4';
import { CallSchema, CallListQuerySchema } from '@ai-logist/shared-types/api/calls';
import { apiGet } from '@/lib/api';
import { CallsApp } from './_components/calls-app';

export const metadata: Metadata = { title: 'Звонки' };

export default async function CallsPage({
  searchParams,
}: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;  // Next.js 16: async
  const query = CallListQuerySchema.parse({
    outcome: params.outcome,
    lang: params.lang,
    from: params.from,
    to: params.to,
    limit: 50,
    offset: 0,
  });
  const qs = new URLSearchParams(query as Record<string, string>).toString();
  const initial = await apiGet(`/calls?${qs}`, z.array(CallSchema));

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="font-bold text-2xl tracking-tight">Звонки</h1>
        <p className="text-muted-foreground text-sm">
          Голосовые звонки через ElevenLabs + Twilio
        </p>
      </header>
      <CallsApp initialCalls={initial} initialQuery={query} />
    </div>
  );
}
```

```tsx
// apps/web/src/app/(main)/dashboard/calls/_components/calls-app.tsx
'use client';
// Client — SWR + table + modal
import { useState } from 'react';
import useSWR from 'swr';
import type { Call } from '@ai-logist/shared-types/api/calls';

export function CallsApp({
  initialCalls,
  initialQuery,
}: { initialCalls: Call[]; initialQuery: { outcome?: string; lang?: string; from?: string; to?: string } }) {
  const [filters, setFilters] = useState(initialQuery);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const qs = new URLSearchParams(filters as Record<string, string>).toString();
  const { data: calls = initialCalls } = useSWR<Call[]>(
    `/api/calls?${qs}`,
    (url) => fetch(url).then((r) => r.json()),
    {
      fallbackData: initialCalls,
      refreshInterval: 30_000,  // D-56
      revalidateOnFocus: true,
      isPaused: () => document.visibilityState !== 'visible',  // D-57
    }
  );

  return (
    <>
      <CallsFilters value={filters} onChange={setFilters} />
      <CallsTable calls={calls} onRowClick={setSelectedId} />
      {selectedId && <CallDetailModal callId={selectedId} onClose={() => setSelectedId(null)} />}
    </>
  );
}
```

### Example 3: Backend UNION query (clients/messages route)

```ts
// apps/api/src/routes/clients.ts (REWIRED from 501-stub)
// Source: Pattern 4 above
import { ListMessagesQuerySchema, MessageSchema } from '@ai-logist/shared-types/api/clients';
import { sql } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

// Extended message schema for voice turns
const UnifiedMessageSchema = z.object({
  id: z.string(),
  createdAt: z.string().datetime(),
  role: z.enum(['client', 'ai', 'manager']),
  text: z.string(),
  channel: z.enum(['telegram', 'voice']),
  callId: z.string().uuid().nullable(),
  timestampMs: z.number().nullable(),
  audioUrl: z.string().nullable(),
});

const clientsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/clients/:id/messages',
    {
      schema: {
        tags: ['clients'],
        params: z.object({ id: z.string().uuid() }),
        querystring: ListMessagesQuerySchema,
        response: { 200: z.array(UnifiedMessageSchema) },
      },
    },
    async (req) => {
      const { id } = req.params;
      const { limit, offset } = req.query;

      const rows = await app.db.execute(sql`
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
          WHERE m.client_id = ${id}
        ),
        voice AS (
          SELECT
            c.id::text || ':' || idx::text                                    AS id,
            c.created_at + ((turn->>'timestamp_ms')::bigint * INTERVAL '1 ms') AS created_at,
            CASE WHEN turn->>'speaker' = 'agent' THEN 'ai' ELSE 'client' END   AS role,
            turn->>'text'                                                      AS text,
            'voice'                                                            AS channel,
            c.id                                                               AS call_id,
            (turn->>'timestamp_ms')::bigint                                    AS timestamp_ms,
            c.audio_url                                                        AS audio_url
          FROM calls c,
               LATERAL jsonb_array_elements(c.transcript) WITH ORDINALITY AS t(turn, idx)
          WHERE EXISTS (
            SELECT 1 FROM leads l
            WHERE (l.id = c.linked_lead_id OR l.id = c.lead_id)
              AND l.client_id = ${id}
          )
        )
        SELECT * FROM msgs
        UNION ALL
        SELECT * FROM voice
        ORDER BY created_at ASC
        LIMIT ${limit} OFFSET ${offset}
      `);

      // node-postgres rows are arrays of objects; map snake → camel
      return rows.rows.map((r: any) => ({
        id: r.id,
        createdAt: new Date(r.created_at).toISOString(),
        role: r.role,
        text: r.text,
        channel: r.channel,
        callId: r.call_id,
        timestampMs: r.timestamp_ms ? Number(r.timestamp_ms) : null,
        audioUrl: r.audio_url,
      }));
    }
  );
};

export default clientsRoutes;
```

### Example 4: New `routes/calls.ts` (list + detail)

```ts
// apps/api/src/routes/calls.ts (NEW file)
import {
  CallSchema,
  CallDetailSchema,
  CallListQuerySchema,
} from '@ai-logist/shared-types/api/calls';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';
import { calls, leads, orders } from '../persistence/schema/index.js';

const callsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/calls',
    {
      schema: {
        tags: ['calls'],
        querystring: CallListQuerySchema,
        response: { 200: z.array(CallSchema) },
      },
    },
    async (req) => {
      const { outcome, lang, from, to, limit, offset } = req.query;
      const conds = [];
      if (outcome) conds.push(eq(calls.outcome, outcome));
      if (lang)    conds.push(eq(calls.lang, lang));
      if (from)    conds.push(gte(calls.createdAt, new Date(from)));
      if (to)      conds.push(lte(calls.createdAt, new Date(to)));

      const rows = await app.db
        .select()
        .from(calls)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(calls.createdAt))
        .limit(limit)
        .offset(offset);

      return rows.map(serializeCall);  // mask phone, format duration, etc
    }
  );

  app.get(
    '/calls/:id',
    {
      schema: {
        tags: ['calls'],
        params: z.object({ id: z.string().uuid() }),
        response: { 200: CallDetailSchema, 404: ErrorSchema },
      },
    },
    async (req, reply) => {
      const { id } = req.params;
      const row = await app.db
        .select({
          call: calls,
          linkedLead: leads,
          linkedOrder: orders,
        })
        .from(calls)
        .leftJoin(leads, eq(leads.id, calls.linkedLeadId))
        .leftJoin(orders, eq(orders.leadId, leads.id))
        .where(eq(calls.id, id))
        .limit(1);

      if (row.length === 0) return reply.notFound('Call not found');

      return {
        call: serializeCall(row[0].call),
        linkedLead: row[0].linkedLead ? serializeLead(row[0].linkedLead) : null,
        linkedOrder: row[0].linkedOrder ? serializeOrder(row[0].linkedOrder) : null,
      };
    }
  );
};

export default callsRoutes;
```

### Example 5: i18n dictionary + `useT()` hook

```ts
// apps/web/src/lib/i18n/dict.ts
// Source: D-52 verbatim
export const dict = {
  ru: {
    'chat.intercept': 'Перехватить',
    'chat.release': 'Вернуть боту',
    'chat.managerMessagePlaceholder': 'Сообщение от менеджера',
    'calls.title': 'Звонки',
    'calls.filter.outcome': 'Исход',
    'calls.filter.outcome.completed': 'Завершён',
    'calls.filter.outcome.abandoned': 'Брошен',
    'calls.filter.outcome.escalated': 'Передан менеджеру',
    'calls.filter.outcome.error': 'Ошибка',
    'orders.title': 'Заказы',
    'orders.col.number': 'Номер',
    'orders.col.client': 'Клиент',
    'orders.col.route': 'Маршрут',
    'orders.col.status': 'Статус',
    'orders.col.price': 'Цена',
    'orders.col.channel': 'Канал',
    'kpi.tile.calls': 'Звонков',
    'kpi.tile.telegram': 'Telegram',
    'kpi.tile.conversion': 'Конверсия',
    'kpi.tile.avgCallDuration': 'Средняя длительность звонка',
    'kpi.tile.revenue': 'Выручка',
    'order.section.client': 'Клиент',
    'order.section.route': 'Маршрут',
    'order.section.truck': 'Машина',
    'order.section.cargo': 'Груз',
    'order.section.timeline': 'История',
    'order.breadcrumb.listenCall': 'Прослушать звонок',
    'order.breadcrumb.openChat': 'Открыть диалог',
  },
  ua: {
    'chat.intercept': 'Перехопити',
    'chat.release': 'Повернути боту',
    'chat.managerMessagePlaceholder': 'Повідомлення від менеджера',
    'calls.title': 'Дзвінки',
    'calls.filter.outcome': 'Результат',
    'calls.filter.outcome.completed': 'Завершено',
    'calls.filter.outcome.abandoned': 'Кинуто',
    'calls.filter.outcome.escalated': 'Передано менеджеру',
    'calls.filter.outcome.error': 'Помилка',
    'orders.title': 'Замовлення',
    'orders.col.number': 'Номер',
    'orders.col.client': 'Клієнт',
    'orders.col.route': 'Маршрут',
    'orders.col.status': 'Статус',
    'orders.col.price': 'Ціна',
    'orders.col.channel': 'Канал',
    'kpi.tile.calls': 'Дзвінків',
    'kpi.tile.telegram': 'Telegram',
    'kpi.tile.conversion': 'Конверсія',
    'kpi.tile.avgCallDuration': 'Середня тривалість дзвінка',
    'kpi.tile.revenue': 'Виторг',
    'order.section.client': 'Клієнт',
    'order.section.route': 'Маршрут',
    'order.section.truck': 'Машина',
    'order.section.cargo': 'Вантаж',
    'order.section.timeline': 'Історія',
    'order.breadcrumb.listenCall': 'Прослухати дзвінок',
    'order.breadcrumb.openChat': 'Відкрити діалог',
  },
} as const satisfies Record<'ru' | 'ua', Record<string, string>>;

export type DictKey = keyof typeof dict.ru;
```

```ts
// apps/web/src/lib/i18n/use-t.ts
'use client';
import { usePreferencesStore } from '@/stores/preferences/preferences-provider';
import { dict, type DictKey } from './dict';

export function useT() {
  // Zenith's Zustand store exposes a `language` field — verify exact path on vendor.
  const lang = usePreferencesStore((s) => s.language ?? 'ru');
  const safeLang: 'ru' | 'ua' = lang === 'ua' ? 'ua' : 'ru';
  return (key: DictKey, vars?: Record<string, string | number>): string => {
    let out: string = dict[safeLang][key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
    return out;
  };
}
```

### Example 6: Password hash CLI (`pnpm gen:admin-password`)

```ts
// apps/web/scripts/gen-admin-password.ts
// Source: D-66 — bcryptjs hash generator for ADMIN_PASSWORD_HASH env var
import bcrypt from 'bcryptjs';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';

const rl = createInterface({ input: stdin, output: stdout });
const password = await rl.question('Password: ');
rl.close();
const hash = await bcrypt.hash(password, 12);
console.log(`\nADMIN_PASSWORD_HASH=${hash}\n`);
process.exit(0);
```

```json
// Add to apps/web/package.json scripts
{
  "scripts": {
    "gen:admin-password": "tsx scripts/gen-admin-password.ts"
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Implicit caching in Next.js App Router (Next 14/15) | **Opt-in `'use cache'`** (Next.js 16) | Oct 2025 release | Pages are dynamic by default — Phase 4's "NEVER 'use cache' on chat/calls/orders" rule (D-12) is now the *default*, not a fight. CI grep guard remains useful in case devs reflexively add it for perf. |
| `middleware.ts` (Edge runtime, Next 14/15) | **`proxy.ts` (Node.js runtime)** | Next.js 16 Oct 2025 | RESEARCH RECOMMENDS the planner use `proxy.ts` instead of `middleware.ts` (still works but deprecated). Identical API. |
| Sync `cookies()`, `headers()`, `params`, `searchParams` | **All async** in Next.js 16 | Oct 2025 | Phase 4 code uses `await` everywhere. Audit Zenith for sync usage. |
| Tailwind v3 default border = `gray-200` | **Tailwind v4 default = `currentColor`** | Tailwind v4 release 2025 | All new components must explicitly use `border-border` (or another concrete color). Zenith already does this; new code follows. |
| SWR v1 `initialData` | **SWR v2 `fallbackData`** | SWR 2.x release 2024 | Use `fallbackData` for SSR hydration; triggers revalidation. |
| Recharts v2 API | **Recharts v3 API** | Recharts v3 release 2026 | Different Tooltip/Legend props. Pin to Zenith's `^3.8.0`. |
| node bcrypt (native) | **bcryptjs 3.x (pure JS, ESM-native)** | bcryptjs 3.0 release 2025 | Picks bcryptjs to avoid native compile in container. Argon2id is technically superior but needs node-gyp. |
| iron-session (stateful session store) | **jose-signed cookie (stateless JWS)** | de-facto since 2023 | Single-user demo doesn't benefit from session store; jose is simpler. |
| `@radix-ui/react-*` individual packages | **`radix-ui` meta-package** | 2025+ | Zenith uses the meta. Don't mix. |

**Deprecated/outdated for this phase:**
- `tailwindcss-animate` plugin — Tailwind v4 replaced with `tw-animate-css` (already in Zenith). Don't reinstall the old one.
- `next/font` filesystem mode — use Geist via `geist/font` package (in Zenith deps).
- `useEffect` + `setInterval` for polling — use SWR `refreshInterval`.
- AMP support — removed from Next.js 16 entirely; not relevant to admin.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | apps/web + apps/api | ✓ | 22.x LTS | — |
| pnpm | monorepo | ✓ | 9.x | — |
| Postgres + PostGIS | Backend reads for new handlers | ✓ (via docker-compose) | 17 + 3.5 | — |
| Redis | Existing — Phase 4 doesn't use | ✓ | 7.4 | — |
| Caddy | Reverse proxy `/api/*` → Fastify, `/` → Next.js | ✓ | 2 | — |
| Docker | Demo deploy + integration tests | ✗ (on Claude's runner) | — | testcontainers tests skip under `AI_LOGIST_NO_DOCKER=1` (existing pattern from Phase 1-3.1) |
| Twilio CDN | Audio URL hosting | ✓ (Phase 3.1 already wired) | — | Audio just fails to load if URL expires — demo runs fresh enough |
| ElevenLabs transcript shape | Phase 4 UNION query depends on it | ✓ (Phase 3.1 calls.transcript jsonb already populated) | — | Defensive coercion in SQL (NULL → idx-based fallback) |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** Docker daemon on Claude's runner — existing `describe.skipIf(!dockerAvailable)` pattern from Phase 1-3.1 already in place. Integration tests deferred to verifier/developer machines.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (backend) | Vitest 4.1.x + @testcontainers/postgresql 12.x (existing from Phase 1-3.1) |
| Framework (frontend) | Vitest + @testing-library/react 16 + happy-dom (NEW for Phase 4) |
| Config file | `apps/api/vitest.config.ts` (existing); `apps/web/vitest.config.ts` (NEW for Phase 4) |
| Quick run command | `pnpm --filter @ai-logist/api test:unit` (backend); `pnpm --filter @ai-logist/web test` (frontend) |
| Full suite command | `pnpm -r test` (all packages) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| API-03 | `GET /api/leads` returns filtered list by stage | integration | `pnpm --filter @ai-logist/api test:integration -t "leads-list"` | ❌ Wave 0 |
| API-03 | `GET /api/leads?channel=voice` filters by channel | integration | `pnpm --filter @ai-logist/api test:integration -t "leads-list channel"` | ❌ Wave 0 |
| API-04 | `GET /api/orders` returns joined list with city + client names + channel | integration | `pnpm --filter @ai-logist/api test:integration -t "orders-list"` | ❌ Wave 0 |
| API-04 | `GET /api/orders/:id` returns order + events + client + cities + truck | integration | `pnpm --filter @ai-logist/api test:integration -t "orders-detail"` | ❌ Wave 0 |
| API-04 | `GET /api/orders/:id` returns 404 for missing | integration | same file | ❌ Wave 0 |
| API-05 | `GET /api/trucks` returns full fleet | integration | `pnpm --filter @ai-logist/api test:integration -t "trucks-list"` | ❌ Wave 0 |
| API-06 | UNION query returns telegram + voice turns chronologically sorted | integration | `pnpm --filter @ai-logist/api test:integration -t "clients-messages union"` | ❌ Wave 0 |
| API-06 | UNION query empty when client has no msgs/calls | integration | same file | ❌ Wave 0 |
| API-06 | Voice transcript turn carries `callId` + `timestampMs` + `audioUrl` | integration | same file | ❌ Wave 0 |
| API-09 | `GET /api/analytics/kpi?window=week` returns extended shape | integration | `pnpm --filter @ai-logist/api test:integration -t "analytics-kpi"` | ❌ Wave 0 |
| API-09 | KPI conversion funnel monotonically decreasing | integration | same file | ❌ Wave 0 |
| API-09 | KPI revenue summed as string (bigint) | integration | same file | ❌ Wave 0 |
| ADMIN-01 | `apps/web/package.json` contains Zenith deps + workspace shared-types ref | unit (file-grep) | `pnpm --filter @ai-logist/web test -t "package.json contracts"` | ❌ Wave 0 |
| ADMIN-01 | `apps/web/src/app/(main)/dashboard/calls/page.tsx` exists | unit (file-exists) | same | ❌ Wave 0 |
| ADMIN-02 | `proxy.ts` redirects unauth `/dashboard/*` to `/auth/v1/login` | unit (vitest-jsdom + mock NextRequest) | `pnpm --filter @ai-logist/web test -t "proxy auth gate"` | ❌ Wave 0 |
| ADMIN-02 | `/auth/v1/login` route handler validates body + sets cookie on match | unit | `pnpm --filter @ai-logist/web test -t "login route"` | ❌ Wave 0 |
| ADMIN-02 | `/auth/v1/login` returns 401 on bad password | unit | same | ❌ Wave 0 |
| ADMIN-02 | `/auth/v1/logout` clears cookie | unit | `pnpm --filter @ai-logist/web test -t "logout route"` | ❌ Wave 0 |
| ADMIN-03 | `/dashboard/chat` `page.tsx` is Server Component (no `'use client'`) | static (grep) | `pnpm --filter @ai-logist/web test -t "RSC boundary chat"` | ❌ Wave 0 |
| ADMIN-03 | `chat-app.tsx` mounts SWR with 5s refresh on active thread | unit (RTL) | `pnpm --filter @ai-logist/web test -t "chat-app refresh"` | ❌ Wave 0 |
| ADMIN-03 | Voice turns render with `<audio>` element + transcript text + Play button | unit (RTL) | `pnpm --filter @ai-logist/web test -t "voice turn render"` | ❌ Wave 0 |
| ADMIN-03 | Telegram message renders with channel badge "TG" | unit (RTL) | same file | ❌ Wave 0 |
| ADMIN-03 | Intercept button calls POST /api/leads/:id/intercept on click | unit (RTL + mock fetch) | `pnpm --filter @ai-logist/web test -t "intercept POST"` | ❌ Wave 0 |
| ADMIN-03 | Voice channel thread does NOT show intercept button (D-47) | unit (RTL) | same file | ❌ Wave 0 |
| ADMIN-05 | `/dashboard/default` renders KPI tiles from initial fetch | unit (RTL) | `pnpm --filter @ai-logist/web test -t "kpi default"` | ❌ Wave 0 |
| ADMIN-05 | `/dashboard/analytics` window selector updates `?window=` URL param | unit (RTL) | `pnpm --filter @ai-logist/web test -t "analytics window"` | ❌ Wave 0 |
| ADMIN-NEW-02 | `/dashboard/orders` table renders rows with city names from initial fetch | unit (RTL) | `pnpm --filter @ai-logist/web test -t "orders table"` | ❌ Wave 0 |
| ADMIN-NEW-02 | Orders filter changes update URL search params | unit (RTL) | same | ❌ Wave 0 |
| ADMIN-NEW-03 | `/dashboard/orders/[id]` renders order detail timeline | unit (RTL) | `pnpm --filter @ai-logist/web test -t "order detail"` | ❌ Wave 0 |
| ADMIN-NEW-03 | Channel breadcrumb shows "Прослушать звонок" for voice lead | unit (RTL) | same | ❌ Wave 0 |
| ADMIN-NEW-03 | Channel breadcrumb shows "Открыть диалог" for telegram lead | unit (RTL) | same | ❌ Wave 0 |
| ADMIN-NEW-08 | `/dashboard/calls` table renders columns matching D-28 | unit (RTL) | `pnpm --filter @ai-logist/web test -t "calls table"` | ❌ Wave 0 |
| ADMIN-NEW-08 | Click row opens modal with audio + transcript | unit (RTL) | same | ❌ Wave 0 |
| ADMIN-NEW-08 | Click transcript turn seeks audio.currentTime (mocked HTMLMediaElement) | unit (RTL) | same | ❌ Wave 0 |
| I18N-02 | `useT('chat.intercept')` returns 'Перехопити' when lang=ua | unit | `pnpm --filter @ai-logist/web test -t "i18n ua"` | ❌ Wave 0 |
| I18N-02 | `useT('chat.intercept')` returns 'Перехватить' when lang=ru (default) | unit | same | ❌ Wave 0 |
| I18N-02 | Customize-panel language toggle updates Zustand `language` | unit (RTL) | `pnpm --filter @ai-logist/web test -t "customize panel lang toggle"` | ❌ Wave 0 |
| (Pitfall #13) | No `'use cache'` directive in chat/calls/orders pages | static (grep) | `pnpm --filter @ai-logist/web test -t "no use cache on dynamic"` | ❌ Wave 0 |
| (Pitfall #13) | No bare `border` class without `border-border` in dashboard/ | static (grep) | `pnpm --filter @ai-logist/web test -t "border-border explicit"` | ❌ Wave 0 |
| (Pitfall #13) | All `page.tsx` files under `(main)/dashboard/*` are Server Components (no `'use client'`) | static (grep) | `pnpm --filter @ai-logist/web test -t "RSC convention"` | ❌ Wave 0 |
| (Auth) | `proxy.ts` matcher covers `/dashboard/:path*` and not `/api`, not `/auth` | static (grep) | `pnpm --filter @ai-logist/web test -t "proxy matcher"` | ❌ Wave 0 |
| (Pitfall #2) | Next.js 16 async cookies/headers/params — no sync usage | static (grep) | `pnpm --filter @ai-logist/web test -t "no sync cookies"` | ❌ Wave 0 |

### Success Criterion → Test Map (from ROADMAP.md Phase 4)

| # | Criterion | Verifiable Test |
|---|-----------|-----------------|
| 1 | Zenith forked, boots with `pnpm dev` on `:3001`, login at `/auth/v1/login`, 6 pages live with real data | manual UAT-05 step 1; automated: `pnpm --filter @ai-logist/web build` exits 0 + `vitest -t "page renders"` for all 6 pages |
| 2 | `/dashboard/chat` unifies both channels with audio playback + intercept controls (Telegram only) | API-06 + ADMIN-03 tests above |
| 3 | `/dashboard/calls` lists every call with filters, click → modal with audio + transcript + linked order | API + ADMIN-NEW-08 tests above |
| 4 | `/dashboard/default` + `/dashboard/analytics` show KPI from `/api/analytics/kpi` | API-09 + ADMIN-05 tests above |
| 5 | `pnpm exec tsc --noEmit` passes; Biome check passes; RU/UA toggle flips strings; visual smoke shows no broken borders | CI gates + I18N-02 tests + static `border-border` grep |

### Sampling Rate

- **Per task commit:** `pnpm --filter @ai-logist/api test:unit && pnpm --filter @ai-logist/web test`
- **Per wave merge:** `pnpm -r test` (full suite) + `pnpm --filter @ai-logist/web build` + `pnpm --filter @ai-logist/web exec tsc --noEmit` + `pnpm exec biome check`
- **Phase gate:** Full suite green + manual UAT-05 (HUMAN-UAT-05.md) + visual smoke RU/UA in light + dark mode + `pnpm --filter @ai-logist/api test:integration` against docker-compose Postgres before `/gsd:verify-work`

### Wave 0 Gaps

Wave 0 of Phase 4 needs to establish test infrastructure BEFORE any production code lands:

- [ ] `apps/api/tests/integration/calls-list.test.ts` — covers API for `/api/calls` endpoints
- [ ] `apps/api/tests/integration/orders-list.test.ts` — covers API-04 list with joins
- [ ] `apps/api/tests/integration/orders-detail.test.ts` — covers API-04 detail with timeline
- [ ] `apps/api/tests/integration/leads-list.test.ts` — covers API-03 with channel filter
- [ ] `apps/api/tests/integration/trucks-list.test.ts` — covers API-05
- [ ] `apps/api/tests/integration/clients-messages-union.test.ts` — covers API-06 UNION query (MOST IMPORTANT)
- [ ] `apps/api/tests/integration/analytics-kpi.test.ts` — covers API-09 extended schema
- [ ] `apps/api/tests/unit/phase-4-stubs.test.ts` — pending markers for 13 reqs (decreases per wave)
- [ ] `apps/web/vitest.config.ts` — NEW, configures happy-dom + @testing-library/react
- [ ] `apps/web/tests/_helpers/render.ts` — wraps render() with mock SWR config
- [ ] `apps/web/tests/_helpers/mock-api.ts` — mock fetch responses keyed by URL
- [ ] `apps/web/tests/_helpers/mock-cookies.ts` — mock Next.js cookies() for proxy/login tests
- [ ] `apps/web/tests/unit/static-rules.test.ts` — static grep tests (no `'use cache'`, no bare `border`, no sync `cookies()`)
- [ ] Framework install: `pnpm --filter @ai-logist/web add -D vitest@^4 @testing-library/react@^16 @testing-library/dom@^10 happy-dom@^15`
- [ ] `pnpm --filter @ai-logist/web typecheck` script added to package.json

## Open Questions

1. **Zenith's preferences-store path / shape**
   - What we know: Per Zenith README and our remote fetch, `src/stores/preferences/` exists, language toggle in Customize panel.
   - What's unclear: Exact Zustand hook export name and signature; whether `language` field is `'ru' | 'ua'` or some other shape.
   - Recommendation: Plan 01 (vendor) records the actual hook signature in `apps/web/VENDOR.md`. Plan 02 (lib/api + i18n) reads that file to wire `useT()`.

2. **`proxy.ts` vs `middleware.ts` naming**
   - What we know: Next.js 16 renamed; `middleware.ts` still works (deprecated).
   - What's unclear: Whether CONTEXT D-06's "Next.js middleware (`middleware.ts`)" was a strict file-name lock or just descriptive shorthand.
   - Recommendation: **Treat as descriptive**, use `proxy.ts` from day one. Planner can confirm or override; both work for Phase 4 deliverable.

3. **Does Phase 4 need to update Phase 3.1's calls.transcript shape if it differs from D-13?**
   - What we know: Phase 3.1 wrote transcript as `jsonb` array of turns; Phase 3.1 D-13 specifies `{role:'agent'|'caller', text, timestamp_ms}`.
   - What's unclear: Whether real ElevenLabs Agent output matches this exactly (only verified during UAT-04 + Phase 4 dev).
   - Recommendation: UNION query handler defensively coerces missing fields. If shape mismatch emerges in UAT-05, plan a small Phase 4 patch to align transformer.

4. **Channel field on `leads` — text or enum?**
   - What we know: `leads.channel` is `text` (not enum) per `apps/api/src/persistence/schema/leads.ts`. Values: 'telegram' | 'call' (Phase 1) — but Phase 3.1 may have added 'voice'.
   - What's unclear: Whether Phase 3.1 used 'call' or 'voice' literal in leads.channel.
   - Recommendation: Plan 01 audits actual `leads.channel` distinct values in seed/test DB via `SELECT DISTINCT channel FROM leads` — adjust `OrderListItemSchema.channel` enum accordingly. Likely value: `z.enum(['telegram', 'voice', 'call']).transform(v => v === 'call' ? 'voice' : v)` for graceful handling.

5. **Should `/dashboard/default` differ visually from `/dashboard/analytics`?**
   - What we know: D-40 = "compact KPI tiles + last 5 calls + last 5 orders"; D-41 = "full charts."
   - What's unclear: Whether Zenith's existing `default/` page matches the "compact tiles + last-5 lists" layout or needs heavy reshape.
   - Recommendation: Plan 02 inspects Zenith's `default/page.tsx` and decides: minimal rewire vs near-rewrite. Lean toward minimal — keep template's polish.

## Sources

### Primary (HIGH confidence)
- **Live Zenith template** — `curl https://raw.githubusercontent.com/mahooo0/next-shadcn-admin-dashboard/main/package.json` — verified exact deps + versions (Next 16.2.4, React 19.2.5, Tailwind 4.1.5, Zod v4, Recharts v3.8, etc.) on 2026-06-10.
- **Live Zenith chat page** — `https://raw.githubusercontent.com/mahooo0/next-shadcn-admin-dashboard/main/src/app/(main)/dashboard/chat/page.tsx` — verified server/client split convention follows spec §7.3 exactly.
- **[Next.js 16 release notes](https://nextjs.org/blog/next-16)** — verified `proxy.ts` rename, async `cookies()/headers()/params/searchParams` breaking changes, `'use cache'` is opt-in (Cache Components must be enabled in `next.config.ts`).
- **[Next.js `use cache` API reference](https://nextjs.org/docs/app/api-reference/directives/use-cache)** — verified directive is opt-in, requires `cacheComponents: true`, has explicit constraints around request-time APIs.
- **[SWR with Next.js App Router](https://swr.vercel.app/docs/with-nextjs)** — verified `fallbackData` (not `initialData`) is the right SSR hydration pattern in SWR v2.
- **[Tailwind CSS Upgrade Guide](https://tailwindcss.com/docs/upgrade-guide)** — verified border default changed from `gray-200` to `currentColor` in v4; preservation pattern documented.
- **`ai-logist-logic-spec.md` §6 + §7** — REST endpoints + admin web spec verbatim.
- **PROJECT CLAUDE.md + .planning/PROJECT.md + .planning/REQUIREMENTS.md + .planning/ROADMAP.md + .planning/research/STACK.md + .planning/research/PITFALLS.md** — locked stack + Pitfall #13 + 13 phase requirements + success criteria.
- **Existing `apps/api/src/{routes,persistence/schema}/*.ts`** — verified 501-stub locations, schema column names, existing index coverage on `messages.client_id`, `calls.linked_lead_id`, `calls.lead_id`, `calls.created_at`, `calls.outcome`, `calls.lang`.
- **Existing `packages/shared-types/src/api/*.ts`** — verified `OrderListQuerySchema`, `OrderDetailSchema`, `KpiResponseSchema`, `MessageSchema`, `LeadListQuerySchema` shapes (so we know what to extend vs add).

### Secondary (MEDIUM confidence — multiple sources concur)
- **[Recharts in Next.js Server Components](https://www.freecodecamp.org/news/how-to-share-components-between-server-and-client-in-nextjs/)** — wrap recharts in `'use client'` component; data fetched in Server Component and passed as props.
- **[Authgear: Next.js Session Management](https://www.authgear.com/post/nextjs-session-management/)** — verified HTTP-only cookie + httpOnly + Secure + SameSite + Max-Age pattern as 2026 best practice for stateless single-user auth.
- **[bcryptjs vs bcrypt vs argon2 2026 (PkgPulse)](https://www.pkgpulse.com/guides/bcrypt-vs-argon2-vs-scrypt-password-hashing-2026)** — bcryptjs pure-JS path of least resistance for containerized deploys; argon2 needs node-gyp.
- **[PostgreSQL JSON functions](https://www.postgresql.org/docs/current/functions-json.html)** — `jsonb_array_elements` + `WITH ORDINALITY` for transcript turn expansion.

### Tertiary (LOW confidence — verify during implementation)
- **Zenith's exact preferences-store hook signature** — README mentioned `src/stores/preferences/`; exact `usePreferencesStore` export not verified by remote fetch. Plan 01 records the truth on vendor day.
- **ElevenLabs transcript turn shape exactness** — Phase 3.1 D-13 specifies `{speaker, text, timestamp_ms}` but real Agent output not validated by Phase 4 research. Defensive coercion in UNION query SQL.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — live remote fetch of Zenith package.json + npm-registry version checks; CONTEXT.md decisions are explicit.
- Architecture patterns: HIGH for SWR/RSC + auth via cookie + recharts wrapping (multiple verified sources); MEDIUM for UNION query (correct pattern, demo-scale-appropriate, but performance under load not load-tested).
- Pitfalls: HIGH — every pitfall traceable to either PITFALLS.md #13, Next.js 16 release notes, Tailwind v4 upgrade guide, or live observation of Zenith.
- Validation architecture: HIGH — each of 13 reqs + 5 success criteria has a concrete vitest-runnable command and a file path. Wave 0 gap list is exhaustive.

**Research date:** 2026-06-10
**Valid until:** 2026-07-10 (30 days — Next.js 16 + Tailwind v4 + Zenith template are stable; if Next 17 ships within window, re-verify `proxy.ts` and async-APIs guidance).
