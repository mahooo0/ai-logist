# Phase 4: Admin Web (REDUCED) — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-10
**Phase:** 04-admin-web-reduced-scope-chat-calls-orders-kpi
**Mode:** discuss (--auto)
**Areas analyzed:** Template fork strategy, Auth, Data fetching, Multi-channel chat, Voice playback, /dashboard/calls structure, /dashboard/orders structure, KPI scope, Manager intercept UI, Sidebar trim, i18n RU/UA, Realtime, API URL strategy, Type sharing

---

## Template Fork Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Replace placeholder + vendor template | Clone Zenith, copy files into `apps/web/`, merge deps, single big commit | ✓ |
| Git submodule | Keep Zenith as submodule, easier upstream pulls | |
| Cherry-pick components | Take only chat/dashboard pieces, build new shell | |

**User's choice:** Replace + vendor (recommended)
**Notes:** Submodule adds toolchain complexity; cherry-pick loses Zenith's auth/customize patterns. Vendoring is simplest for a demo with no upstream-sync needs.

---

## Auth

| Option | Description | Selected |
|--------|-------------|----------|
| Env-set credentials + HTTP-only cookie | Single admin user, bcrypt hash in env, signed cookie via `AUTH_COOKIE_SECRET` | ✓ |
| NextAuth.js | Provider-rich auth library | |
| Clerk | Hosted auth via Vercel Marketplace | |

**User's choice:** Env-set + cookie (recommended)
**Notes:** Single-user demo per REQUIREMENTS.md — no OAuth, no multi-session, no provider rotation. NextAuth/Clerk over-engineered for a demo.

---

## Data Fetching

| Option | Description | Selected |
|--------|-------------|----------|
| Server Components + SWR Client | `page.tsx` SSR fetch + `_components/*-app.tsx` SWR refresh | ✓ |
| TanStack Query | Full client-side caching layer | |
| Raw fetch in Server Components only | No client-side updates, refresh = navigate | |

**User's choice:** SC + SWR (recommended)
**Notes:** SWR lighter than TanStack Query (~4kb), Zenith template's patterns are SWR-compatible, and we have no admin-side mutations beyond manager-intercept.

---

## Multi-Channel Chat

| Option | Description | Selected |
|--------|-------------|----------|
| Mixed timeline + channel badges | Telegram + voice transcript turns chronologically in one thread | ✓ |
| Separate tabs per channel | Tab strip ("Telegram" / "Voice") inside each thread | |
| Two parallel panes | Telegram left, voice right, synced scroll | |

**User's choice:** Mixed timeline (recommended)
**Notes:** Reflects spec §7.2 "multi-channel CRM chat" intent. Manager wants one story per client, not two parallel timelines.

---

## Voice Audio Playback

| Option | Description | Selected |
|--------|-------------|----------|
| Inline `<audio controls>` | Native browser player per call | ✓ |
| Floating mini-player | Persistent bottom-right with current call | |
| Waveform with timeline-synced transcript | Custom WaveSurfer.js UI | |

**User's choice:** Inline native (recommended)
**Notes:** Bundle-light, no third-party audio dep, works on every browser. Waveform = v2 polish.

---

## /dashboard/calls Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Table + click-to-modal detail | List view with filters; modal opens audio + transcript | ✓ |
| Master-detail split-pane | List left, detail right (always visible) | |
| Full-page detail per call | List → navigate to `/dashboard/calls/[id]` | |

**User's choice:** Table + modal (recommended)
**Notes:** Faster context-switch for manager comparing multiple calls; matches Zenith dialog patterns.

---

## KPI Charts

| Option | Description | Selected |
|--------|-------------|----------|
| Recharts (already in Zenith) | Use template's bundled chart library | ✓ |
| Chart.js | Mature alternative | |
| Visx | Lower-level d3 wrapper | |

**User's choice:** Recharts (recommended)
**Notes:** Zero-dep cost; Zenith ships compatible chart wrappers already.

---

## Realtime Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| SWR polling (5s chat / 30s rest) | Tab-visibility-aware, no new infra | ✓ |
| WebSocket `/ws/inbox` | Live push, requires Phase 5 work | |
| SSE / EventSource | One-way server push, lighter than WS | |

**User's choice:** SWR polling (recommended)
**Notes:** WS deferred to Phase 5 per ROADMAP pivot. Polling at 5s feels live enough for demo without new infra.

---

## i18n RU/UA

| Option | Description | Selected |
|--------|-------------|----------|
| Zustand store + `lib/i18n/dict.ts` | Reuse Zenith Customize-panel lang toggle | ✓ |
| next-intl | Server-side i18n with locale routing | |
| Just ship RU only | Defer UA to Phase 5 polish | |

**User's choice:** Zustand dict (recommended)
**Notes:** Spec §7.2 explicitly says Customize-panel language toggle. ICU/plural/date-fns/locale stays in Phase 5.

---

## Manager Intercept UI

| Option | Description | Selected |
|--------|-------------|----------|
| Header button + replaced input box | "Перехватить" → input becomes manager-message; "Вернуть боту" releases | ✓ |
| Drawer with separate manager pane | Slide-out manager chat below client thread | |
| Modal manager-message composer | Per-message dialog box | |

**User's choice:** Header button + input (recommended)
**Notes:** Minimal UI surface, reuses existing input affordance, matches Phase 3 endpoint semantics (intercept/manager-message/release).

---

## API URL Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Caddy proxy + relative URLs | `/api/*` → Fastify via Caddy; no CORS | ✓ |
| Separate domain per service | `api.foo.com` + `app.foo.com` with CORS | |
| Next.js API routes proxying Fastify | Add another hop, more code | |

**User's choice:** Caddy + relative (recommended)
**Notes:** Already configured in Phase 1 Caddyfile. Zero CORS work; one less env var on client.

---

## Sidebar Nav Trim

| Option | Description | Selected |
|--------|-------------|----------|
| Hide unused items, keep template files | Comment out nav entries; pages still build | ✓ |
| Delete unused page files | Smaller bundle, less code to grep | |
| Keep all nav items, label as "(coming v2)" | Show what's planned | |

**User's choice:** Hide, don't delete (recommended)
**Notes:** Minimizes Phase 4 churn; v2 can re-enable in a few lines. Deleting risks accidentally removing shared layout pieces.

---

## Unused Template Pages (Zenith's bundled extras)

| Decision | Action |
|----------|--------|
| Kanban / fleet / calendar / tracking | Hide from nav, leave files |
| E-commerce / finance / CRM extras | Hide from nav, leave files |
| Mail / Tasks / Settings | Hide from nav, leave files |
| Auth / Default / Analytics / Chat | Keep and wire |
| **NEW** /dashboard/calls + /orders + /orders/[id] | Add new Phase 4 pages |

---

## Type Sharing

| Option | Description | Selected |
|--------|-------------|----------|
| `@ai-logist/shared-types` workspace dep | Pnpm workspace import | ✓ |
| Re-declare DTOs in apps/web | Independent client schemas | |
| GraphQL-style code-gen | Generate TS from OpenAPI | |

**User's choice:** Shared workspace (recommended)
**Notes:** Pnpm workspaces already set up. Zod schemas already exist for every endpoint. No code-gen step needed.

---

## Tests

| Option | Description | Selected |
|--------|-------------|----------|
| RTL + vitest page smoke + backend handler integration | Page-level smoke + testcontainers handler tests | ✓ |
| Playwright full E2E | Browser automation across the demo flow | |
| Only manual UAT | No automated tests | |

**User's choice:** RTL smoke + handler integration (recommended)
**Notes:** Phase 4 ships UAT-05 (manual) as the visual contract; automated covers regression on the heavy data paths. Playwright is a v2 or Phase 5 polish concern.

---

## Auto-Resolved Decisions (no user input needed)

These were auto-selected with the recommended default because the discussion clearly converged:

- D-01..04: Template fork mechanism + version pinning + directory structure
- D-12, D-13: `'use cache'` ban on dynamic pages + allow on KPI pages
- D-15..17: API URL strategy + dual-mode `apiGet`
- D-22: Status filter semantics mapping to lead stages
- D-28..31: `/calls` table column set + filters + new endpoint shape
- D-32..39: `/orders` table + detail page split + channel breadcrumb
- D-40..44: KPI tile + chart selection + window dropdown
- D-48..50: Sidebar trim + Customize-panel reuse
- D-51..55: Dictionary scope (new strings only)
- D-56..57: Polling intervals per page
- D-58..59: Tailwind v4 grep guards + page convention enforcement
- D-60..62: File creation manifest
- D-63..65: Test boundaries
- D-66..67: Env vars

## Deferred Ideas Surfaced

All deferred items captured in CONTEXT.md `<deferred>` section. No backlog promotions.

## Reviewed Todos (not folded)

*Backlog empty — no todos surfaced for Phase 4.*
