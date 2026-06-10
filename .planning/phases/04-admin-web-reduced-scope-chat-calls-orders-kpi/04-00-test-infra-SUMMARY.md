---
phase: 04-admin-web-reduced-scope-chat-calls-orders-kpi
plan: 00
subsystem: testing
tags: [vitest, testcontainers, happy-dom, testing-library-react, biome, monorepo, phase-4]

# Dependency graph
requires:
  - phase: 01-database-backend-skeleton
    provides: vitest config + testcontainers PostGIS pattern + Biome lint baseline
  - phase: 02-llm-pipeline-deterministic-core-high-risk
    provides: phase-N-stubs.test.ts comment hygiene pattern
  - phase: 03-telegram-channel
    provides: webhook-driver + integration scaffold pattern
  - phase: 03.1-voice-channel-elevenlabs-twilio
    provides: phase-3.1-stubs.test.ts shape — 1:1 mirror for phase-4-stubs

provides:
  - 13 Phase 4 pending markers in apps/api/tests/unit/phase-4-stubs.test.ts (verifier grep baseline)
  - 7 backend integration scaffolds gated by AI_LOGIST_NO_DOCKER for Wave 3 flips
  - apps/web first-ever test runner (vitest 4 + happy-dom + @testing-library/react 16)
  - 3 frontend test helpers (render, mock-api, mock-cookies)
  - 5 live static grep guards (Pitfall #13 + Next.js 16 + auth matcher) running from CI Wave 0 onward
  - 5 frontend unit scaffolds (19 it.todo markers) staged for Wave 1-5 flips
  - apps/api/tests/PHASE-4.md architectural reference (wave-by-wave schedule + 3-layer test architecture + verifier grep gate + Phase 1-3.1 bit-identical contract)

affects:
  - 04-01 (Zenith vendor — flips ADMIN-01 marker, must keep marker count == 12)
  - 04-02 (auth + lib primitives — flips ADMIN-02 + I18N-02 markers + activates proxy-auth, login-route, use-t, i18n-dict scaffolds)
  - 04-03 (backend handlers — flips API-03/04/05/06/09 markers + activates 7 backend integration scaffolds)
  - 04-04 (chat + calls pages — flips ADMIN-03 + ADMIN-NEW-08 + activates pages-smoke chat/calls scaffold)
  - 04-05 (orders + KPI pages — flips ADMIN-05 + ADMIN-NEW-02 + ADMIN-NEW-03 + activates pages-smoke orders/default/analytics scaffold)
  - 04-06 (UAT gate — asserts marker count == 0)

# Tech tracking
tech-stack:
  added:
    - vitest@^4 (apps/web — first-ever test runner)
    - "@testing-library/react@^16 + @testing-library/dom@^10 (apps/web)"
    - happy-dom@^15 (lighter than jsdom, sufficient for RTL Phase 4 scope)
  patterns:
    - "Wave 0 stub-baseline pattern (mirrors Phase 1/2/3/3.1): N pending markers at plan-creation; monotonic decrease through plans"
    - "Backend integration scaffold pattern (mirrors Phase 3/3.1): describe.skipIf(!dockerAvailable) gate + 1 it.todo() placeholder per acceptance criterion"
    - "Frontend static-rules grep guards: 5 live checks running from Wave 0 — CI catches Pitfall #13 violations before review"
    - "Frontend unit scaffold pattern: it.todo() placeholders per requirement → Wave 2-5 plans flip without restructuring files"
    - "PHASE-N.md architectural reference per phase: wave schedule + test architecture overview + verifier gate command + bit-identical contract"

key-files:
  created:
    - apps/api/tests/unit/phase-4-stubs.test.ts
    - apps/api/tests/integration/leads-list.test.ts
    - apps/api/tests/integration/orders-list.test.ts
    - apps/api/tests/integration/orders-detail.test.ts
    - apps/api/tests/integration/trucks-list.test.ts
    - apps/api/tests/integration/clients-messages-union.test.ts
    - apps/api/tests/integration/analytics-kpi.test.ts
    - apps/api/tests/integration/calls-list.test.ts
    - apps/api/tests/PHASE-4.md
    - apps/web/vitest.config.ts
    - apps/web/tests/_helpers/render.ts
    - apps/web/tests/_helpers/mock-api.ts
    - apps/web/tests/_helpers/mock-cookies.ts
    - apps/web/tests/unit/static-rules.test.ts
    - apps/web/tests/unit/i18n-dict.test.ts
    - apps/web/tests/unit/proxy-auth.test.ts
    - apps/web/tests/unit/login-route.test.ts
    - apps/web/tests/unit/use-t.test.ts
    - apps/web/tests/unit/pages-smoke.test.ts
  modified:
    - apps/web/package.json (test scripts + devDependencies)
    - pnpm-lock.yaml (new dev deps for apps/web)

key-decisions:
  - "happy-dom over jsdom — lighter (~3MB vs ~30MB), faster startup, fully sufficient for RTL render/query/event needs across Phase 4 scope. Switch to jsdom only if a specific DOM API gap surfaces during Wave 4-5."
  - "5 unit scaffolds total 19 it.todo() (i18n-dict 3 + proxy-auth 3 + login-route 4 + use-t 3 + pages-smoke 6) — plan body content authoritative over the plan's text counts (acceptance criterion says 16, verify literal says 22 todo; both arithmetic slips). 19 reflects the actual TS shipped by the plan."
  - "static-rules.test.ts ships 5 LIVE grep guards from Wave 0 — these are it() blocks (not it.todo), running in CI from the first commit. Catches Pitfall #13 + Next.js 16 async-API violations + auth matcher mistakes BEFORE Wave 1-5 land production code. Pre-Wave-1 dirs don't exist → grep empty → tests PASS by default. Wave 1+ tests still PASS when implementation is correct."
  - "PHASE-4.md architectural reference inserted at apps/api/tests/PHASE-4.md — mirrors Phase 2/3/3.1 convention (PHASE-2.md, PHASE-3.md, PHASE-3.1.md exist). Verifier and human reviewers locate the wave-by-wave schedule + grep gate command + bit-identical contract here."
  - "phase-4-stubs.test.ts docstring NEVER mentions literal marker substring (re-burning the lesson for the 6th time — Phase 1 Plan 01-10, Phase 2 02-03b/04a/04b, Phase 3 03-00, Phase 3.1 03.1-00 burned this each). Marker count via naive grep -c stays at exactly 13 across both code-only sites + zero comment leakage."

patterns-established:
  - "Phase 4 marker baseline: 13 (5 backend reqs + 8 frontend reqs)"
  - "Frontend scaffold authority: TS code provided in plan action block is authoritative — plan-text counts in must_haves / acceptance / verify gate that disagree are slips, not contracts."
  - "apps/web vitest config — happy-dom + globals=false + setupFiles + @ alias to src/. globals=false enforces explicit vi/it/describe imports in every test (matches apps/api convention)."

requirements-completed: []
# Wave 0 ships test infrastructure only — no requirements flipped this plan.
# The 13 plan-listed requirements (API-03/04/05/06/09 + ADMIN-01/02/03/05 +
# ADMIN-NEW-02/03/08 + I18N-02) get flipped progressively across Plans 04-01..04-05
# per the wave-by-wave schedule documented in apps/api/tests/PHASE-4.md.

# Metrics
duration: 7min
completed: 2026-06-10
---

# Phase 4 Plan 00: Test Infrastructure Summary

**Vitest 4 + @testing-library/react 16 + happy-dom installed in apps/web for the first time; 13 Phase 4 stub markers locked as verifier baseline; 5 live grep guards enforcing Pitfall #13 + Next.js 16 async-API + auth matcher from Wave 0 onward.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-06-10T20:05:18Z
- **Completed:** 2026-06-10T20:12:10Z
- **Tasks:** 2
- **Files created:** 19
- **Files modified:** 2 (apps/web/package.json + pnpm-lock.yaml)
- **Lines added:** 494 (test + config + helpers + docs)

## Accomplishments

- **Backend test infra:** 7 integration scaffolds + phase-4-stubs.test.ts (13 pending markers) + PHASE-4.md architectural reference. Each scaffold gated by `describe.skipIf(!dockerAvailable)` so Wave 3 plans flip `it.todo` → `it()` without restructuring files. Verifier grep gate command documented exactly: `grep -c "it.todo\|test.todo" apps/api/tests/unit/phase-4-stubs.test.ts` must decrease 13 → 12 → 10 → 5 → 3 → 0 monotonically per wave.
- **apps/web first-ever test runner:** Installed vitest@^4 + @testing-library/react@^16 + @testing-library/dom@^10 + happy-dom@^15 as devDependencies. Configured `apps/web/vitest.config.ts` with `happy-dom` env + `globals=false` (explicit imports enforced) + `setupFiles` → `tests/_helpers/render.ts` + `@` → `src/` path alias. `pnpm test` now runs vitest instead of the Phase 1 echo placeholder.
- **5 live grep guards** in `apps/web/tests/unit/static-rules.test.ts` running from Wave 0 onward: (1) no `'use cache'` on chat/calls/orders/login routes (D-12); (2) no bare `border` class without `border-border` (D-58 + Tailwind v4); (3) all `(main)/dashboard/*/page.tsx` are Server Components (D-59); (4) `proxy.ts` matcher covers `/dashboard/:path*` and excludes `/api` + `/auth`; (5) no sync `cookies()`/`headers()`/`params`/`searchParams` usage (Next.js 16 async-only — Pitfall #2). Pre-Wave-1 paths don't exist → grep empty → tests PASS by default. Catches Pitfall #13 violations BEFORE review starting Wave 1.
- **5 frontend unit scaffolds** with 19 `it.todo()` placeholders staged for Wave 1-5 flips: `i18n-dict.test.ts` (3) + `proxy-auth.test.ts` (3) + `login-route.test.ts` (4) + `use-t.test.ts` (3) + `pages-smoke.test.ts` (6). Wave 2 (Plan 04-02) flips 13; Wave 4 (Plan 04-04) flips 2; Wave 5 (Plan 04-05) flips 4.
- **3 frontend helpers** under `apps/web/tests/_helpers/`: `render.ts` (RTL re-exports + `afterEach` cleanup), `mock-api.ts` (keyed-by-URL fetch mock with `mockFetch`/`installMockFetch`/`resetMockFetch`), `mock-cookies.ts` (Next.js `cookies()` mock via `vi.mock('next/headers')` for proxy + login tests in Wave 2).
- **Phase 1-3.1 production code untouched:** `git diff apps/api/src/ apps/web/app/ packages/shared-types/src/` returns empty after both task commits. Confirmed via two-commit range diff.

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend integration scaffolds + phase-4-stubs.test.ts + PHASE-4.md** — `87af5bd` (test)
2. **Task 2: apps/web vitest config + helpers + frontend unit scaffolds + 5 static-rules grep guards** — `c4b5e1d` (test)

**Plan metadata:** _committed below via final commit (SUMMARY + STATE + ROADMAP + REQUIREMENTS)_

## Files Created/Modified

### Backend (apps/api/tests/)

- `apps/api/tests/unit/phase-4-stubs.test.ts` — 13 pending markers (verifier grep baseline)
- `apps/api/tests/integration/leads-list.test.ts` — API-03 scaffold (3 todos)
- `apps/api/tests/integration/orders-list.test.ts` — API-04 list scaffold (3 todos)
- `apps/api/tests/integration/orders-detail.test.ts` — API-04 detail scaffold (3 todos)
- `apps/api/tests/integration/trucks-list.test.ts` — API-05 scaffold (2 todos)
- `apps/api/tests/integration/clients-messages-union.test.ts` — API-06 UNION scaffold (5 todos, MOST IMPORTANT)
- `apps/api/tests/integration/analytics-kpi.test.ts` — API-09 extended KPI scaffold (5 todos)
- `apps/api/tests/integration/calls-list.test.ts` — NEW `/api/calls` scaffold (6 todos)
- `apps/api/tests/PHASE-4.md` — architectural reference (wave schedule + 3-layer architecture + verifier gate + bit-identical contract)

### Frontend (apps/web/)

- `apps/web/vitest.config.ts` — happy-dom + globals=false + setupFiles + @ → src alias
- `apps/web/tests/_helpers/render.ts` — RTL re-exports + afterEach cleanup
- `apps/web/tests/_helpers/mock-api.ts` — keyed-by-URL fetch mock
- `apps/web/tests/_helpers/mock-cookies.ts` — Next.js cookies() mock for proxy/login
- `apps/web/tests/unit/static-rules.test.ts` — 5 LIVE grep guards (Pitfall #13 + Next 16 + auth)
- `apps/web/tests/unit/i18n-dict.test.ts` — I18N-02 dict + useT() scaffold (3 todos)
- `apps/web/tests/unit/proxy-auth.test.ts` — ADMIN-02 proxy.ts scaffold (3 todos)
- `apps/web/tests/unit/login-route.test.ts` — ADMIN-02 login/logout scaffold (4 todos)
- `apps/web/tests/unit/use-t.test.ts` — I18N-02 useT() hook scaffold (3 todos)
- `apps/web/tests/unit/pages-smoke.test.ts` — 6-page render smoke scaffold (6 todos)
- `apps/web/package.json` — `"test": "vitest run"`, `"test:watch"`, `"typecheck"` added; devDependencies extended with vitest + @testing-library/react + @testing-library/dom + happy-dom
- `pnpm-lock.yaml` — new dev deps for apps/web (vitest 4.1.8 + RTL 16 + happy-dom 15 transitive closure)

## Decisions Made

1. **happy-dom over jsdom** — lighter dep, faster startup, fully sufficient for RTL render/query/event needs in Phase 4 scope. Switch to jsdom only if a specific DOM API gap surfaces during Wave 4-5 chat/audio-player tests.
2. **19 it.todo() in frontend scaffolds (plan body authoritative)** — plan must_haves frontmatter says "16 frontend test.todo markers" and verify gate says "22 todo", both arithmetic slips relative to the TS code the plan body verbatim provides. Counted from the TS plan body: 3+3+4+3+6 = 19. Suite shows 5 passed (static-rules) + 19 todo = 24 total tests on apps/web — matches reality, not the plan's frontmatter arithmetic.
3. **static-rules.test.ts ships LIVE (it() not it.todo)** — 5 grep guards run from Wave 0 onward, not deferred. Pre-Wave-1 paths don't exist → grep returns empty → tests PASS by default. Wave 1+ keeps tests PASSING when implementation is correct (catches violations as red).
4. **PHASE-4.md architectural reference** — mirrors PHASE-2.md / PHASE-3.md / PHASE-3.1.md convention. Documents wave-by-wave flip schedule (13 → 12 → 10 → 5 → 3 → 0), 3-layer test architecture (backend integration via testcontainers, backend unit, frontend unit via vitest + RTL + happy-dom), exact verifier grep gate command, Phase 1-3.1 bit-identical contract.
5. **Comment hygiene re-burned for 6th time** — phase-4-stubs.test.ts docstring contains NO literal `it.todo` / `test.todo` substring. Verified by `grep -c "it.todo\|test.todo" apps/api/tests/unit/phase-4-stubs.test.ts == 13` (exact match to the 13 marker call sites). Same lesson burned in Phase 1 Plan 01-10, Phase 2 Plans 02-03b/02-04a/02-04b, Phase 3 Plan 03-00, Phase 3.1 Plan 03.1-00.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Biome formatter rewrote 4 files for line-width + removed unused `expect` import**
- **Found during:** Task 1 (immediately after Write calls)
- **Issue:** Biome 2.4 enforces 110-col line width and noUnusedImports — initial Write put long `it.todo('...')` strings on single lines (formatter wants multi-line wrapping) and imported `expect` unused (phase-4-stubs.test.ts has no assertions, only todo markers).
- **Fix:** Ran `pnpm exec biome check --write` to auto-format 4 files (phase-4-stubs.test.ts, analytics-kpi.test.ts, clients-messages-union.test.ts, orders-detail.test.ts). Manually removed `expect` from phase-4-stubs.test.ts import line (biome flagged as unsafe-fix; safer to handle manually).
- **Files modified:** apps/api/tests/unit/phase-4-stubs.test.ts + 3 integration scaffolds
- **Verification:** `pnpm exec biome check` returns "No fixes applied" + `grep -c "it.todo\|test.todo" == 13` (marker count preserved through reformatting).
- **Committed in:** 87af5bd (Task 1 commit)

**2. [Rule 1 - Bug] Biome formatter rewrote 2 apps/web test files for line-width**
- **Found during:** Task 2 (immediately after Write calls)
- **Issue:** static-rules.test.ts had a single long regex `.test(line)` call that exceeded line width; pages-smoke.test.ts had long `it.todo()` argument strings.
- **Fix:** Ran `pnpm exec biome check --write` for auto-format. Verified todo count unchanged.
- **Files modified:** apps/web/tests/unit/static-rules.test.ts + apps/web/tests/unit/pages-smoke.test.ts
- **Verification:** `pnpm exec biome check apps/web/` returns clean; `pnpm --filter @ai-logist/web test` shows 5 passed + 19 todo.
- **Committed in:** c4b5e1d (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 lint/format — non-semantic).
**Impact on plan:** No semantic deviation. Biome reformatting is purely whitespace/import-list normalization; marker counts + test semantics unchanged. No scope creep.

## Issues Encountered

- **Plan acceptance criterion / verify-gate arithmetic slip:** Plan must_haves frontmatter said "16 frontend test.todo markers"; plan verify automated section said `5 passed|22 todo`. The TS code provided verbatim in the plan body actually defines 19 todos (3+3+4+3+6 across the 5 frontend unit scaffolds). I followed the plan body TS as authoritative — it's the directly executable specification. The arithmetic mismatch in must_haves vs body is a planner-side slip; treating it as a Rule 1 fix would be wrong because the plan body intent is preserved exactly. Outcome: 5 passed + 19 todo on apps/web matches the plan body verbatim.
- **Docker daemon unreachable on Claude's runner** (consistent with Phase 1-3.1): integration tests skip cleanly under AI_LOGIST_NO_DOCKER=1. All 7 Phase 4 integration scaffolds have `describe.skipIf(!dockerAvailable)` gates so Wave 3 flips work identically whether Docker is available or not. Verifier passes need a Docker-enabled runner for full integration coverage (same pattern as Phase 1-3.1).

## User Setup Required

None — no external service configuration required this plan. Test infrastructure only.

## Verifier Grep Gate Baseline

```bash
# Phase 4 marker count baseline (verifier asserts after every wave)
$ grep -c "it.todo\|test.todo" apps/api/tests/unit/phase-4-stubs.test.ts
13
```

Expected monotonic sequence across Plans 04-01..04-06:

| After plan | Expected count | Reqs flipped this plan                                    |
| ---------- | -------------- | --------------------------------------------------------- |
| 04-00      | 13             | — (baseline)                                              |
| 04-01      | 12             | ADMIN-01                                                  |
| 04-02      | 10             | ADMIN-02, I18N-02                                         |
| 04-03      | 5              | API-03, API-04, API-05, API-06, API-09                    |
| 04-04      | 3              | ADMIN-03, ADMIN-NEW-08                                    |
| 04-05      | 0              | ADMIN-05, ADMIN-NEW-02, ADMIN-NEW-03                      |
| 04-06      | 0              | UAT-05 (verifies count)                                   |

## Next Phase Readiness

- **Wave 1 (Plan 04-01) Zenith vendor** is unblocked. Static-rules grep guards (D-12 no `'use cache'`, D-59 no `'use client'` on dashboard page.tsx) start enforcing the moment apps/web/src/app/(main)/dashboard/ directories appear. Wave 1 must keep marker count == 12 — exactly one flip (ADMIN-01).
- **Wave 2 (Plan 04-02) auth + lib primitives** scaffolds are pre-positioned: proxy-auth.test.ts (3 todos), login-route.test.ts (4 todos), i18n-dict.test.ts (3 todos), use-t.test.ts (3 todos). mock-cookies.ts helper ready for proxy/login tests. Wave 2 flips ADMIN-02 + I18N-02 → marker count must hit 10.
- **Wave 3 (Plan 04-03) backend handlers** scaffolds are pre-positioned: 7 integration tests with `describe.skipIf(!dockerAvailable)` gates ready for `it.todo` → `it()` flips. Each scaffold names its target Phase 4 requirement (API-03/04/05/06/09 + NEW /api/calls). UNION query in clients-messages-union.test.ts has 5 todos pre-positioned for the MOST IMPORTANT API-06 test.
- **Wave 4-5 pages** scaffold pages-smoke.test.ts (6 todos) is pre-positioned for all 6 dashboard pages (chat, calls, orders, orders/[id], default, analytics). render.ts helper provides SWR provider hook for Wave 4 fleshing-out.
- **Phase 1-3.1 contract verified** — `git diff apps/api/src/ packages/shared-types/src/ apps/web/app/` empty across both task commits. Future Phase 4 plans must preserve this contract.

---
*Phase: 04-admin-web-reduced-scope-chat-calls-orders-kpi*
*Plan: 00-test-infra*
*Completed: 2026-06-10*

## Self-Check: PASSED

All 19 files verified present on disk. Both task commits (87af5bd, c4b5e1d) verified in git log.
