# Phase 4 — Admin Web (reduced scope: chat + calls + orders + KPI) Testing Architecture

## Wave-by-wave flip schedule (phase-4-stubs.test.ts)

| Wave | Plan    | Flipped this wave                                                                       | Markers remaining |
| ---- | ------- | --------------------------------------------------------------------------------------- | ----------------- |
| 0    | 04-00   | — (13 created — baseline)                                                               | 13                |
| 1    | 04-01   | ADMIN-01 (Zenith template vendor + 6 dashboard pages exist)                             | 12                |
| 2    | 04-02   | ADMIN-02, I18N-02 (auth proxy + login route + RU/UA dict + useT() hook)                 | 10                |
| 3    | 04-03   | API-03, API-04, API-05, API-06, API-09 (backend handlers + extended KPI shape)          | 5                 |
| 3    | 04-04   | ADMIN-03, ADMIN-NEW-08 (chat + calls pages)                                             | 3                 |
| 3    | 04-05   | ADMIN-05, ADMIN-NEW-02, ADMIN-NEW-03 (orders + KPI pages)                               | 0                 |
| 4    | 04-06   | UAT-05 gate verifies marker count = 0; visual / manual smoke logged                     | 0                 |

Verifier gate after each wave:

```bash
grep -c "it.todo\|test.todo" apps/api/tests/unit/phase-4-stubs.test.ts
```

Expected sequence: `13 → 12 → 10 → 5 → 3 → 0`.

## Test architecture overview

Phase 4 testing surface spans THREE layers:

### (a) Backend integration via testcontainers PostGIS 17-3.5

`apps/api/tests/integration/*.test.ts` — each test:
- Boots `postgis/postgis:17-3.5` container via `startPostgisContainer()` from `tests/_helpers/test-db.ts`.
- Applies migrations 0000..N inline via `drizzle-kit migrate` or raw `pg.Client` SQL apply.
- Calls `buildApp()` then `app.inject({ method, url, headers, payload })` to exercise routes.
- Asserts response shape via Zod schema imported from `@ai-logist/shared-types`.
- Each scaffold is gated by `describe.skipIf(!dockerAvailable)` so AI_LOGIST_NO_DOCKER=1 skips cleanly.

7 Phase 4 integration scaffolds (Wave 0 → Wave 3 flips):

| File                                  | Wave that flips | Production code under test                            |
| ------------------------------------- | --------------- | ----------------------------------------------------- |
| leads-list.test.ts                    | 3 (04-03)       | apps/api/src/routes/leads.ts (list handler)           |
| orders-list.test.ts                   | 3 (04-03)       | apps/api/src/routes/orders.ts (list with joins)       |
| orders-detail.test.ts                 | 3 (04-03)       | apps/api/src/routes/orders.ts (detail + 404)          |
| trucks-list.test.ts                   | 3 (04-03)       | apps/api/src/routes/trucks.ts                         |
| clients-messages-union.test.ts        | 3 (04-03)       | apps/api/src/routes/clients.ts (UNION query)          |
| analytics-kpi.test.ts                 | 3 (04-03)       | apps/api/src/routes/analytics.ts (extended KPI shape) |
| calls-list.test.ts                    | 3 (04-03)       | apps/api/src/routes/calls.ts (NEW route)              |

### (b) Backend unit

Phase 4 introduces no new backend unit suites — Wave 0 only ships the `phase-4-stubs.test.ts` invariant tracker. Existing Phase 2-3.1 unit tests must remain green.

### (c) Frontend unit via vitest + @testing-library/react + happy-dom (NEW)

`apps/web/tests/unit/*.test.ts(x)` — apps/web previously had no test runner; Phase 4 Wave 0 installs:
- `vitest@^4` + `@testing-library/react@^16` + `@testing-library/dom@^10` + `happy-dom@^15`.
- `apps/web/vitest.config.ts` configures `happy-dom` env + `setupFiles` → `tests/_helpers/render.ts`.
- Helpers: `render.ts` (wraps RTL render with SWR provider — placeholder until Wave 4), `mock-api.ts` (keyed fetch mock by URL), `mock-cookies.ts` (vi.mock next/headers for proxy + login tests).

7 frontend unit scaffolds (Wave 0 → Wave 1-5 flips):

| File                       | Wave that flips | Subject                                                  |
| -------------------------- | --------------- | -------------------------------------------------------- |
| static-rules.test.ts       | 0 (live)        | 5 grep guards (Pitfall #13 + Next 16 async + auth)       |
| i18n-dict.test.ts          | 2 (04-02)       | lib/i18n/dict.ts + useT() hook                           |
| proxy-auth.test.ts         | 2 (04-02)       | src/proxy.ts redirect + matcher                          |
| login-route.test.ts        | 2 (04-02)       | /auth/v1/login + /auth/v1/logout routes                  |
| use-t.test.ts              | 2 (04-02)       | useT() Zustand integration + fallback                    |
| pages-smoke.test.ts        | 4-5 (04-04/05)  | 6-page render smoke (chat/calls/orders/[id]/default/an.) |

## Verifier grep gate

Exact bash command verifier runs after every wave:

```bash
grep -c "it.todo\|test.todo" apps/api/tests/unit/phase-4-stubs.test.ts
```

Must decrease monotonically `13 → 12 → 10 → 5 → 3 → 0` per wave. ANY non-monotonic step is a hard fail.

Static-rules guards (apps/web/tests/unit/static-rules.test.ts) MUST stay green from Wave 0 onward:
- `'use cache'` directive absent from chat/calls/orders/orders[id]/login routes.
- No bare `border` class without `border-border` (Tailwind v4 + Pitfall #13).
- All `(main)/dashboard/*/page.tsx` are Server Components (no `'use client'`).
- `proxy.ts` matcher covers `/dashboard/:path*` and excludes `/api` + `/auth`.
- No sync `cookies()` / `headers()` usage (Next.js 16 async-only — Pitfall #2).

## Phase 1-3.1 contract (must remain bit-identical)

Phase 4 is an admin web phase — apps/api source must not change. After every Wave 0..4 commit, the following git diff MUST be empty:

```bash
git diff apps/api/src/pipeline/llm-tools/ apps/api/src/channels/ apps/api/src/persistence/schema/
```

Specifically:
- `apps/api/src/pipeline/llm-tools/*.ts` — Phase 2 contract (calc-price, nearest-truck, extract-request, create-order, discount).
- `apps/api/src/channels/telegram/**` — Phase 3 contract.
- `apps/api/src/channels/voice/**` — Phase 3.1 contract.
- `apps/api/src/persistence/schema/*.ts` — Drizzle table definitions (Wave 3 may ADD a column for orders.channel if missing per CONTEXT D-7; otherwise schema is untouched).

Production code in apps/api/src/routes/ MAY change for Wave 3 — new handlers for API-03/04/05/06/09 + new /api/calls route. But all routes existed as 501 stubs from Phase 1 Plan 01-08; Wave 3 replaces handler bodies, not schemas.

## Comment hygiene reminder

NO file in `apps/api/tests/` may contain the literal marker-function substring
in comments or docstrings — the verifier uses naive `grep -c`. Keep that
substring strictly as a code-only occurrence inside the marker call itself.

This rule has been re-burned six times now (Phase 1 Plan 01-10, Phase 2
Plans 02-03b / 02-04a / 02-04b, Phase 3 Plan 03-00, Phase 3.1 Plan 03.1-00).
Avoid the seventh.

## Test commands

- Unit (backend): `pnpm --filter @ai-logist/api test:unit`
- Integration (backend, Docker): `pnpm --filter @ai-logist/api test:integration`
- Skip integration: `AI_LOGIST_NO_DOCKER=1 pnpm --filter @ai-logist/api test`
- Frontend unit: `pnpm --filter @ai-logist/web test`
- Frontend typecheck: `pnpm --filter @ai-logist/web typecheck`
- Frontend build: `pnpm --filter @ai-logist/web build`
- Full repo: `pnpm -r test`

## UAT-05 (Phase 4 close)

UAT-05 lives in `.planning/HUMAN-UAT.md` after Plan 04-06 runs. Covers:
- 7 manual visual checks across 6 pages × (light, dark) × (RU, UA).
- Audio playback through real browser.
- Live polling refresh on `/dashboard/chat`.
- Manager intercept end-to-end (web → API → Telegram bot → client).
- RU/UA toggle visual.

Items unverifiable in unit + integration tests are deferred to UAT-05.
