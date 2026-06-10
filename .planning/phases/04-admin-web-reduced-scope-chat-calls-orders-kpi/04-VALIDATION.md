---
phase: 4
slug: admin-web-reduced-scope-chat-calls-orders-kpi
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-10
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from RESEARCH.md `## Validation Architecture`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (backend)** | Vitest 4.1.x + @testcontainers/postgresql 12.x (existing from Phase 1-3.1) |
| **Framework (frontend)** | Vitest + @testing-library/react 16 + happy-dom (NEW for Phase 4) |
| **Config file (backend)** | `apps/api/vitest.config.ts` (existing) |
| **Config file (frontend)** | `apps/web/vitest.config.ts` (NEW — Wave 0 installs) |
| **Quick run command** | `pnpm --filter @ai-logist/api test:unit && pnpm --filter @ai-logist/web test` |
| **Full suite command** | `pnpm -r test` (all packages) |
| **Estimated runtime** | ~45 seconds quick / ~3 minutes full (incl. testcontainers) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @ai-logist/api test:unit && pnpm --filter @ai-logist/web test`
- **After every plan wave:** Run `pnpm -r test` + `pnpm --filter @ai-logist/web build` + `pnpm --filter @ai-logist/web exec tsc --noEmit` + `pnpm exec biome check`
- **Before `/gsd:verify-work`:** Full suite green + manual UAT-05 + visual smoke RU/UA light+dark + integration tests against docker-compose Postgres
- **Max feedback latency:** 45s (unit) / 180s (full with containers)

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| API-03 | `GET /api/leads` filters by stage | integration | `pnpm --filter @ai-logist/api test:integration -t "leads-list"` | ❌ W0 | ⬜ pending |
| API-03 | `GET /api/leads?channel=voice` filters by channel | integration | same | ❌ W0 | ⬜ pending |
| API-04 | `GET /api/orders` returns joined list (cities + client + channel) | integration | `pnpm --filter @ai-logist/api test:integration -t "orders-list"` | ❌ W0 | ⬜ pending |
| API-04 | `GET /api/orders/:id` returns order + events + client + cities + truck | integration | `pnpm --filter @ai-logist/api test:integration -t "orders-detail"` | ❌ W0 | ⬜ pending |
| API-04 | `GET /api/orders/:id` returns 404 for missing | integration | same | ❌ W0 | ⬜ pending |
| API-05 | `GET /api/trucks` returns full fleet | integration | `pnpm --filter @ai-logist/api test:integration -t "trucks-list"` | ❌ W0 | ⬜ pending |
| API-06 | UNION returns telegram + voice turns chronologically | integration | `pnpm --filter @ai-logist/api test:integration -t "clients-messages union"` | ❌ W0 | ⬜ pending |
| API-06 | UNION empty when client has no msgs/calls | integration | same | ❌ W0 | ⬜ pending |
| API-06 | Voice turn carries `callId` + `timestampMs` + `audioUrl` | integration | same | ❌ W0 | ⬜ pending |
| API-09 | `GET /api/analytics/kpi?window=week` returns extended shape | integration | `pnpm --filter @ai-logist/api test:integration -t "analytics-kpi"` | ❌ W0 | ⬜ pending |
| API-09 | KPI conversion funnel monotonically decreasing | integration | same | ❌ W0 | ⬜ pending |
| API-09 | KPI revenue summed as bigint string | integration | same | ❌ W0 | ⬜ pending |
| ADMIN-01 | `apps/web/package.json` contains Zenith deps + workspace shared-types | unit grep | `pnpm --filter @ai-logist/web test -t "package.json contracts"` | ❌ W0 | ⬜ pending |
| ADMIN-01 | `apps/web/src/app/(main)/dashboard/calls/page.tsx` exists | unit | same | ❌ W0 | ⬜ pending |
| ADMIN-02 | `proxy.ts` redirects unauth `/dashboard/*` to `/auth/v1/login` | unit jsdom | `pnpm --filter @ai-logist/web test -t "proxy auth gate"` | ❌ W0 | ⬜ pending |
| ADMIN-02 | `/auth/v1/login` route validates body + sets cookie on match | unit | `pnpm --filter @ai-logist/web test -t "login route"` | ❌ W0 | ⬜ pending |
| ADMIN-02 | `/auth/v1/login` returns 401 on bad password | unit | same | ❌ W0 | ⬜ pending |
| ADMIN-02 | `/auth/v1/logout` clears cookie | unit | `pnpm --filter @ai-logist/web test -t "logout route"` | ❌ W0 | ⬜ pending |
| ADMIN-03 | `/dashboard/chat` `page.tsx` is Server Component (no `'use client'`) | static grep | `pnpm --filter @ai-logist/web test -t "RSC boundary chat"` | ❌ W0 | ⬜ pending |
| ADMIN-03 | `chat-app.tsx` mounts SWR with 5s refresh on active thread | unit RTL | `pnpm --filter @ai-logist/web test -t "chat-app refresh"` | ❌ W0 | ⬜ pending |
| ADMIN-03 | Voice turn renders `<audio>` + transcript text + Play button | unit RTL | `pnpm --filter @ai-logist/web test -t "voice turn render"` | ❌ W0 | ⬜ pending |
| ADMIN-03 | Telegram message renders with channel badge "TG" | unit RTL | same | ❌ W0 | ⬜ pending |
| ADMIN-03 | Intercept button POSTs `/api/leads/:id/intercept` | unit RTL+fetch | `pnpm --filter @ai-logist/web test -t "intercept POST"` | ❌ W0 | ⬜ pending |
| ADMIN-03 | Voice thread does NOT show intercept button (D-47) | unit RTL | same | ❌ W0 | ⬜ pending |
| ADMIN-05 | `/dashboard/default` renders KPI tiles from initial fetch | unit RTL | `pnpm --filter @ai-logist/web test -t "kpi default"` | ❌ W0 | ⬜ pending |
| ADMIN-05 | `/dashboard/analytics` window selector updates `?window=` | unit RTL | `pnpm --filter @ai-logist/web test -t "analytics window"` | ❌ W0 | ⬜ pending |
| ADMIN-NEW-02 | `/dashboard/orders` table renders rows with city names | unit RTL | `pnpm --filter @ai-logist/web test -t "orders table"` | ❌ W0 | ⬜ pending |
| ADMIN-NEW-02 | Orders filter changes update URL search params | unit RTL | same | ❌ W0 | ⬜ pending |
| ADMIN-NEW-03 | `/dashboard/orders/[id]` renders order detail timeline | unit RTL | `pnpm --filter @ai-logist/web test -t "order detail"` | ❌ W0 | ⬜ pending |
| ADMIN-NEW-03 | Channel breadcrumb shows "Прослушать звонок" for voice lead | unit RTL | same | ❌ W0 | ⬜ pending |
| ADMIN-NEW-03 | Channel breadcrumb shows "Открыть диалог" for telegram lead | unit RTL | same | ❌ W0 | ⬜ pending |
| ADMIN-NEW-08 | `/dashboard/calls` table renders columns matching D-28 | unit RTL | `pnpm --filter @ai-logist/web test -t "calls table"` | ❌ W0 | ⬜ pending |
| ADMIN-NEW-08 | Click row opens modal with audio + transcript | unit RTL | same | ❌ W0 | ⬜ pending |
| ADMIN-NEW-08 | Click transcript turn seeks `audio.currentTime` | unit RTL | same | ❌ W0 | ⬜ pending |
| I18N-02 | `useT('chat.intercept')` returns 'Перехопити' when lang=ua | unit | `pnpm --filter @ai-logist/web test -t "i18n ua"` | ❌ W0 | ⬜ pending |
| I18N-02 | `useT('chat.intercept')` returns 'Перехватить' when lang=ru | unit | same | ❌ W0 | ⬜ pending |
| I18N-02 | Customize-panel language toggle updates Zustand `language` | unit RTL | `pnpm --filter @ai-logist/web test -t "customize panel lang toggle"` | ❌ W0 | ⬜ pending |
| Pitfall #13 | No `'use cache'` in chat/calls/orders pages | static grep | `pnpm --filter @ai-logist/web test -t "no use cache on dynamic"` | ❌ W0 | ⬜ pending |
| Pitfall #13 | No bare `border` class without `border-border` in dashboard/ | static grep | `pnpm --filter @ai-logist/web test -t "border-border explicit"` | ❌ W0 | ⬜ pending |
| Pitfall #13 | All `page.tsx` under `(main)/dashboard/*` are Server Components | static grep | `pnpm --filter @ai-logist/web test -t "RSC convention"` | ❌ W0 | ⬜ pending |
| Auth | `proxy.ts` matcher covers `/dashboard/:path*` excludes `/api`/`/auth` | static grep | `pnpm --filter @ai-logist/web test -t "proxy matcher"` | ❌ W0 | ⬜ pending |
| Next 16 | No sync `cookies()`/`headers()`/`params`/`searchParams` usage | static grep | `pnpm --filter @ai-logist/web test -t "no sync cookies"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Success Criterion → Test Map

| # | Criterion (from ROADMAP) | Verifiable Test |
|---|--------------------------|-----------------|
| 1 | Zenith forked, boots `pnpm dev` on `:3001`, login at `/auth/v1/login`, 6 pages live | UAT-05 step 1; `pnpm --filter @ai-logist/web build` exits 0 + `vitest -t "page renders"` for all 6 |
| 2 | `/dashboard/chat` unifies both channels with audio + intercept (TG only) | API-06 + ADMIN-03 rows above |
| 3 | `/dashboard/calls` table + click modal | API + ADMIN-NEW-08 rows above |
| 4 | `/dashboard/default` + `/dashboard/analytics` KPI from `/api/analytics/kpi` | API-09 + ADMIN-05 rows above |
| 5 | tsc + Biome pass; RU/UA toggle flips strings; visual smoke shows no broken borders | CI gates + I18N-02 + static `border-border` grep |

---

## Wave 0 Requirements

- [ ] `apps/api/tests/integration/calls-list.test.ts` — `/api/calls` endpoints
- [ ] `apps/api/tests/integration/orders-list.test.ts` — API-04 list with joins
- [ ] `apps/api/tests/integration/orders-detail.test.ts` — API-04 detail with timeline
- [ ] `apps/api/tests/integration/leads-list.test.ts` — API-03 with channel filter
- [ ] `apps/api/tests/integration/trucks-list.test.ts` — API-05
- [ ] `apps/api/tests/integration/clients-messages-union.test.ts` — API-06 UNION query (MOST IMPORTANT)
- [ ] `apps/api/tests/integration/analytics-kpi.test.ts` — API-09 extended schema
- [ ] `apps/api/tests/unit/phase-4-stubs.test.ts` — pending markers for 13 reqs (decreases per wave)
- [ ] `apps/web/vitest.config.ts` — happy-dom + @testing-library/react config
- [ ] `apps/web/tests/_helpers/render.ts` — wraps `render()` with mock SWR config
- [ ] `apps/web/tests/_helpers/mock-api.ts` — mock fetch responses keyed by URL
- [ ] `apps/web/tests/_helpers/mock-cookies.ts` — mock Next.js cookies() for proxy/login tests
- [ ] `apps/web/tests/unit/static-rules.test.ts` — static grep tests (no `'use cache'`, no bare `border`, no sync `cookies()`)
- [ ] Framework install: `pnpm --filter @ai-logist/web add -D vitest@^4 @testing-library/react@^16 @testing-library/dom@^10 happy-dom@^15`
- [ ] `pnpm --filter @ai-logist/web typecheck` script added to package.json

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual polish in light + dark mode | Success #5 | Browser-driven visual diff is out of scope (Phase 5 polish covers Playwright) | UAT-05 step 6: open in browser, switch theme via Customize panel, scroll through 6 pages, confirm no broken borders / off-color text / missing icons |
| Audio playback through speakers | ADMIN-NEW-08 | DOM HTMLMediaElement is mocked in unit tests; real audio needs real browser | UAT-05 step 4: click row → modal opens → press Play → hear audio. Click 2-3 transcript turns → audio seeks to that timestamp |
| Live data refresh under polling | ADMIN-03 | Real-time UX validation needs live test data | UAT-05 step 3: open chat, send Telegram message from test bot, wait 5s, see message appear |
| Manager intercept end-to-end | ADMIN-03 | Cross-system flow (web → API → Telegram bot → client) | UAT-05 step 5: open active Telegram thread → click Перехватить → send manager message → confirm client receives it via Telegram |
| RU/UA language toggle visual | I18N-02 | UI rendering correctness across locales | UAT-05 step 7: Customize panel → switch to UA → confirm chat header, calls filters, orders columns translate; switch back to RU |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter after Wave 0 ships

**Approval:** pending
