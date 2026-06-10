# @ai-logist/web — Admin Dashboard

Next.js 16 (App Router, Turbopack) + React 19 + Tailwind v4 + shadcn/ui admin dashboard, vendored from `mahooo0/next-shadcn-admin-dashboard` (Zenith Admin, MIT). See `VENDOR.md` for the exact upstream SHA pinned at vendor time.

## Pages (v1 — reduced scope per 2026-06-09 pivot)

| Page | Purpose | Requirement |
|------|---------|-------------|
| `/auth/v1/login` | Single-user login (env-set credentials) | ADMIN-02 |
| `/dashboard/default` | Compact KPI tiles + last-5 calls + last-5 orders | ADMIN-05 |
| `/dashboard/analytics` | 5 recharts (funnel / channel split / revenue / calls per day / avg duration) | ADMIN-05 |
| `/dashboard/chat` | Multi-channel chat (Telegram messages + voice transcript turns) | ADMIN-03 |
| `/dashboard/calls` | Calls table + filters + detail modal with audio + transcript | ADMIN-NEW-08 |
| `/dashboard/orders` | Orders table with channel + status filters | ADMIN-NEW-02 |
| `/dashboard/orders/[id]` | Read-only order detail + event timeline + channel breadcrumb | ADMIN-NEW-03 |

**Deferred to v2:** kanban, fleet, calendar, tracking, global search, PDF stub, price-override modal, manual order create.

## Environment

| Var | Required | Purpose |
|-----|----------|---------|
| `ADMIN_USERNAME` | yes | Single-user login identity (default `admin`) |
| `ADMIN_PASSWORD_HASH` | yes | bcrypt hash; generate via `pnpm gen:admin-password` |
| `AUTH_COOKIE_SECRET` | yes | 32-byte HS256 key for the signed `al_session` cookie |
| `API_INTERNAL_URL` | no | Server-side fetch base; default `http://api:3000` in docker, `http://localhost:3000` outside |

Copy `apps/web/.env.example` → `apps/web/.env.local` before the first `pnpm dev`.

## Scripts

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Next.js dev server on `:3001` (Turbopack) |
| `pnpm build` | Production build (`next build --turbopack`) |
| `pnpm typecheck` | `tsc --noEmit` strict |
| `pnpm test` | vitest + happy-dom + @testing-library/react |
| `pnpm gen:admin-password` | bcrypt-hash a password for `ADMIN_PASSWORD_HASH` |

## Conventions (per spec §7.3 + Pitfall #13)

1. **`page.tsx` is a Server Component** — fetches data via `apiGet`, passes to a single client boundary.
2. **`_components/<feature>-app.tsx` is the SOLE `'use client'` boundary** for that feature.
3. **NEVER `'use cache'`** on dynamic pages (`/dashboard/chat`, `/dashboard/calls`, `/dashboard/orders`, `/dashboard/orders/[id]`). CI grep guard enforces this.
4. **`'use cache'` IS allowed** on `/dashboard/default` + `/dashboard/analytics` (KPI aggregated — D-13).
5. **Always `border-border` explicit** — Tailwind v4 changed the bare `border` default from `gray-200` to `currentColor`.
6. **Next.js 16 async APIs** — `cookies()`, `headers()`, `params`, `searchParams` are all async; always `await`.
7. **`proxy.ts` not `middleware.ts`** — Next.js 16 native name (Pitfall #4).
8. **All UI strings via `useT()`** — RU default, UA via Customize panel.

These rules are enforced by 5 live CI grep guards in `tests/unit/static-rules.test.ts`.

## Architecture

```
apps/web/src/
├── app/
│   ├── (main)/dashboard/
│   │   ├── default/page.tsx + _components/
│   │   ├── analytics/page.tsx + _components/
│   │   ├── chat/page.tsx + _components/
│   │   ├── calls/page.tsx + _components/
│   │   └── orders/page.tsx + [id]/page.tsx + _components/
│   ├── auth/v1/login/page.tsx       ← Zenith UI (rewired)
│   └── api/auth/{login,logout}/route.ts ← bcrypt + jose JWT cookie
├── proxy.ts                          ← Next.js 16 auth gate (Pattern 4 in RESEARCH)
├── lib/
│   ├── api.ts                        ← apiGet<Schema>(path, schema) with auto-routing
│   ├── auth.ts                       ← jose HS256 sign + verify + bcryptjs compare
│   ├── format.ts                     ← formatMoney + formatPhone + formatDate
│   └── i18n/
│       ├── dict.ts                   ← RU/UA dictionary
│       └── use-t.ts                  ← useT() hook reading Zenith preferences store
└── navigation/sidebar/sidebar-items.ts ← trimmed to 5 nav items (D-49)
```

## Origin (vendored from Zenith)

See `VENDOR.md` for the exact git SHA, MIT license note, deps snapshot at vendor time, and the re-vendoring procedure.

## Phase 4 reference

- **CONTEXT** (locked design, 67 decisions): `.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-CONTEXT.md`
- **RESEARCH** (technical brief): `.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-RESEARCH.md`
- **VALIDATION** (test contract): `.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-VALIDATION.md`
- **UAT protocol** (15-min end-to-end): `.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/HUMAN-UAT-05.md`
