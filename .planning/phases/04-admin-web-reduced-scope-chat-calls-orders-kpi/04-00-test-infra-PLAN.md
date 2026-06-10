---
phase: 04-admin-web-reduced-scope-chat-calls-orders-kpi
plan: 00
type: execute
wave: 0
depends_on: []
files_modified:
  - apps/api/tests/unit/phase-4-stubs.test.ts
  - apps/api/tests/integration/leads-list.test.ts
  - apps/api/tests/integration/orders-list.test.ts
  - apps/api/tests/integration/orders-detail.test.ts
  - apps/api/tests/integration/trucks-list.test.ts
  - apps/api/tests/integration/clients-messages-union.test.ts
  - apps/api/tests/integration/analytics-kpi.test.ts
  - apps/api/tests/integration/calls-list.test.ts
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
  - apps/api/tests/PHASE-4.md
autonomous: true
requirements:
  - API-03
  - API-04
  - API-05
  - API-06
  - API-09
  - ADMIN-01
  - ADMIN-02
  - ADMIN-03
  - ADMIN-05
  - ADMIN-NEW-02
  - ADMIN-NEW-03
  - ADMIN-NEW-08
  - I18N-02

must_haves:
  truths:
    - "phase-4-stubs.test.ts ships exactly 13 pending markers (one per requirement: API-03/04/05/06/09 + ADMIN-01/02/03/05 + ADMIN-NEW-02/03/08 + I18N-02). Monotonic decrease per wave: 13 (W0) -> 12 (W1 after 04-01 flips ADMIN-01 via Zenith vendor) -> 10 (W2 after 04-02 flips ADMIN-02 + I18N-02) -> 5 (W3 after 04-03 flips API-03/04/05/06/09) -> 3 (W3 after 04-04 flips ADMIN-03 + ADMIN-NEW-08) -> 0 (W3 after 04-05 flips ADMIN-NEW-02 + ADMIN-NEW-03 + ADMIN-05). W4 (04-06) verifies count=0."
    - "7 backend integration scaffolds exist, each with describe.skipIf(!dockerAvailable) gate + a single test.todo placeholder, so Wave 3 flips only ADD it() calls."
    - "apps/web/vitest.config.ts configures happy-dom + globals=false + setupFiles pointing at tests/_helpers/render.ts."
    - "7 frontend unit scaffolds exist (static-rules, i18n-dict, proxy-auth, login-route, use-t, pages-smoke) — each contains test.todo placeholders ready for Wave 1-5 flips."
    - "apps/web devDependencies include vitest@^4, @testing-library/react@^16, @testing-library/dom@^10, happy-dom@^15 — installed via Wave 0 task 2."
    - "phase-4-stubs.test.ts docstring contains NO literal pending-token substring (verifier grep counts naively — same comment hygiene as Phase 1/2/3/3.1 Wave 0)."
    - "static-rules.test.ts implements 5 grep guards (no 'use cache' on chat/calls/orders, no bare 'border' without border-border, all dashboard page.tsx are Server Components, proxy.ts matcher excludes /api+/auth, no sync cookies/headers/params usage) — running in CI from Wave 0 onward."
  artifacts:
    - path: "apps/api/tests/unit/phase-4-stubs.test.ts"
      provides: "13 pending markers for API-03/04/05/06/09 + ADMIN-01/02/03/05 + ADMIN-NEW-02/03/08 + I18N-02"
      contains: "API-03,API-04,API-05,API-06,API-09,ADMIN-01,ADMIN-02,ADMIN-03,ADMIN-05,ADMIN-NEW-02,ADMIN-NEW-03,ADMIN-NEW-08,I18N-02"
      min_lines: 30
    - path: "apps/api/tests/integration/leads-list.test.ts"
      provides: "Scaffold for API-03 GET /api/leads filtered by stage+channel"
      contains: "describe,test.todo,skipIf"
    - path: "apps/api/tests/integration/orders-list.test.ts"
      provides: "Scaffold for API-04 GET /api/orders joined list"
      contains: "describe,test.todo,skipIf"
    - path: "apps/api/tests/integration/orders-detail.test.ts"
      provides: "Scaffold for API-04 GET /api/orders/:id detail + 404"
      contains: "describe,test.todo,skipIf"
    - path: "apps/api/tests/integration/trucks-list.test.ts"
      provides: "Scaffold for API-05 GET /api/trucks"
      contains: "describe,test.todo,skipIf"
    - path: "apps/api/tests/integration/clients-messages-union.test.ts"
      provides: "Scaffold for API-06 UNION query test (MOST IMPORTANT)"
      contains: "describe,test.todo,skipIf,UNION"
    - path: "apps/api/tests/integration/analytics-kpi.test.ts"
      provides: "Scaffold for API-09 extended KPI shape"
      contains: "describe,test.todo,skipIf"
    - path: "apps/api/tests/integration/calls-list.test.ts"
      provides: "Scaffold for new /api/calls + /api/calls/:id"
      contains: "describe,test.todo,skipIf"
    - path: "apps/web/vitest.config.ts"
      provides: "happy-dom + RTL config for apps/web"
      contains: "happy-dom,setupFiles"
      min_lines: 15
    - path: "apps/web/tests/_helpers/render.ts"
      provides: "render() wrapped with mock SWR provider"
      contains: "render,SWRConfig"
    - path: "apps/web/tests/_helpers/mock-api.ts"
      provides: "Mock fetch by URL key"
      contains: "mockFetch,Map"
    - path: "apps/web/tests/_helpers/mock-cookies.ts"
      provides: "Mock Next.js cookies() for proxy/login tests"
      contains: "cookies,vi.mock"
    - path: "apps/web/tests/unit/static-rules.test.ts"
      provides: "5 grep guards (Pitfall #13 + auth + Next 16 async)"
      contains: "use cache,border-border,'use client',matcher,cookies"
    - path: "apps/api/tests/PHASE-4.md"
      provides: "Wave-by-wave flip schedule + test architecture overview"
  key_links:
    - from: "Wave 3 backend handlers (Plan 04-03)"
      to: "7 integration scaffolds"
      via: "describe.skipIf wraps testcontainer PostGIS — Wave 3 flips test.todo to it() blocks"
      pattern: "test.todo"
    - from: "Wave 2 auth (Plan 04-02)"
      to: "tests/_helpers/mock-cookies.ts"
      via: "vi.mock('next/headers') stub for proxy.ts + login route tests"
      pattern: "mock-cookies"
    - from: "Wave 1+2+3+4+5 (all subsequent plans)"
      to: "phase-4-stubs.test.ts"
      via: "Each wave flips a subset of the 13 markers — verifier grep gate monotonic decrease"
      pattern: "phase-4-stubs"
---

<objective>
Wave 0 test infrastructure for Phase 4 — ships ALL test helpers, scaffolds, and stub markers BEFORE any production code so Waves 1-5 only add it() blocks and flip todos without restructuring files.

Purpose:
- Establish Phase 4 testing surface BEFORE Wave 1 Zenith vendor lands (Nyquist rule).
- Lock 7 backend integration scaffolds + 7 frontend unit scaffolds + 13 stub markers so the verifier grep on `apps/api/tests/unit/phase-4-stubs.test.ts` for the pending-marker token starts at exactly 13 and decreases monotonically per wave.
- Install Vitest + @testing-library/react + happy-dom in apps/web for the FIRST time (apps/web previously had no test runner).
- Pre-write 5 static grep guards (Pitfall #13 + Next.js 16 async APIs + auth matcher) so CI catches mistakes from Wave 1 onward.
- Pattern-mirror Phase 2/3/3.1 Wave 0 (02-00, 03-00, 03.1-00) — same Vitest 4 + testcontainers shape, same comment-hygiene discipline (NO literal pending-marker substring in docstrings).

Output: 19 new files. No production code touched. Existing Phase 1-3.1 source must remain bit-identical (`git diff apps/api/src/ apps/web/{app,src} packages/shared-types/src/` empty after Wave 0).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-CONTEXT.md
@.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-RESEARCH.md
@.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-VALIDATION.md
@.planning/research/PITFALLS.md
@apps/api/vitest.config.ts
@apps/api/tests/unit/phase-3.1-stubs.test.ts
@apps/api/package.json
@apps/web/package.json

<interfaces>
<!-- Stub-marker convention (Wave 0 pattern across all phases) -->
<!-- phase-4-stubs.test.ts MUST use test.todo() for each requirement; the docstring -->
<!-- MUST NEVER contain the literal substring "test.todo" — verifier grep counts naively. -->
<!-- Refer to apps/api/tests/unit/phase-3.1-stubs.test.ts for the proven pattern. -->

<!-- Existing test runner config — backend already has vitest with projects: -->
<!--   - unit (tests/unit/**/*.test.ts) — fake timers, no DB -->
<!--   - integration (tests/integration/**/*.test.ts) — testcontainers PostGIS, 90s timeout -->
<!--   - smoke (tests/smoke/**/*.test.ts) -->

<!-- apps/web HAS NO test runner yet — Phase 4 Wave 0 introduces it for the FIRST time. -->
<!-- Use happy-dom (not jsdom) — lighter, faster, sufficient for RTL @ Phase 4. -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Backend integration scaffolds + phase-4-stubs.test.ts + PHASE-4.md</name>
  <files>
    apps/api/tests/unit/phase-4-stubs.test.ts,
    apps/api/tests/integration/leads-list.test.ts,
    apps/api/tests/integration/orders-list.test.ts,
    apps/api/tests/integration/orders-detail.test.ts,
    apps/api/tests/integration/trucks-list.test.ts,
    apps/api/tests/integration/clients-messages-union.test.ts,
    apps/api/tests/integration/analytics-kpi.test.ts,
    apps/api/tests/integration/calls-list.test.ts,
    apps/api/tests/PHASE-4.md
  </files>
  <read_first>
    apps/api/tests/unit/phase-3.1-stubs.test.ts,
    apps/api/tests/integration/voice-call-lifecycle.test.ts,
    apps/api/vitest.config.ts,
    .planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-VALIDATION.md
  </read_first>
  <action>
Create `apps/api/tests/unit/phase-4-stubs.test.ts` with EXACTLY 13 pending markers (one per requirement). Use the exact format from `apps/api/tests/unit/phase-3.1-stubs.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

/**
 * Phase 4 acceptance criteria assertions — one block per requirement.
 *
 * Verifier grep gate: the pending-marker count decreases monotonically across waves.
 * Pre-Wave 1: 13 markers. Post-Wave 1: 13 (Zenith vendor — infrastructure only).
 * Post-Wave 2: 10 (ADMIN-02 + I18N-02 + ADMIN-01 partial flip). Post-Wave 3: 7
 * (backend reqs API-03..09 flip). Post-Wave 4: 3 (ADMIN-03 + ADMIN-NEW-08 +
 * ADMIN-05 flip). Post-Wave 5: 0 — Phase 4 CLOSED.
 *
 * Comment hygiene rule: this docstring NEVER mentions the literal marker function
 * name. The verifier uses naive grep -c so any prose mention inflates the count.
 * Re-burning the lesson for the SIXTH time (Phase 1/2/3/3.1/{this} burn).
 */
describe('Phase 4 — Admin Web acceptance criteria', () => {
  // Backend reqs — flipped in Wave 3 (Plan 04-03)
  it.todo('API-03: GET /api/leads filters by stage + channel');
  it.todo('API-04: GET /api/orders returns joined list (cities + client + channel) + GET /:id returns full detail with events/client/cities/truck');
  it.todo('API-05: GET /api/trucks returns full fleet read-only');
  it.todo('API-06: GET /api/clients/:id/messages UNION returns telegram + voice transcript turns chronologically with callId+timestampMs+audioUrl');
  it.todo('API-09: GET /api/analytics/kpi returns extended shape (avgCallDurationS + byChannel + conversionFunnel) with bigint revenue as string');

  // Frontend reqs — flipped in Wave 1+2+4+5
  it.todo('ADMIN-01: Zenith template vendored into apps/web/ with workspace shared-types ref + 6 dashboard pages exist');
  it.todo('ADMIN-02: Auth via /auth/v1/login (env-set creds + bcryptjs + jose-signed HTTP-only cookie + proxy.ts gate on /dashboard/*)');
  it.todo('ADMIN-03: /dashboard/chat unifies Telegram + voice transcript turns with audio playback + intercept controls (TG-only)');
  it.todo('ADMIN-05: /dashboard/default + /dashboard/analytics show KPI tiles + charts from /api/analytics/kpi');
  it.todo('ADMIN-NEW-02: /dashboard/orders table with status + channel filters + URL search params bookmarkable');
  it.todo('ADMIN-NEW-03: /dashboard/orders/[id] renders order detail + events timeline + channel breadcrumb');
  it.todo('ADMIN-NEW-08: /dashboard/calls table + filters + modal with audio player + transcript turn seek');
  it.todo('I18N-02: Customize-panel RU/UA toggle + dictionary in lib/i18n/dict.ts wired via useT() hook');
});
```

CRITICAL: the docstring above describes the marker decrease using the phrase "pending markers" / "the marker function" — NEVER write the literal `test.todo` substring inside the comment block. Only the 13 `it.todo()` calls are allowed to contain it.

Create 7 backend integration scaffolds — each follows the pattern from `apps/api/tests/integration/voice-call-lifecycle.test.ts`:

`apps/api/tests/integration/leads-list.test.ts`:
```ts
import { describe, it } from 'vitest';

// Docker gate — testcontainers requires Docker daemon.
const dockerAvailable = !process.env.AI_LOGIST_NO_DOCKER;

describe.skipIf(!dockerAvailable)('Phase 4 API-03 — GET /api/leads', () => {
  it.todo('returns filtered list by stage (NEW/QUALIFIED/MATCHED/QUOTED/AGREED/ORDER_CREATED/IN_PROGRESS/DONE/LOST) — Wave 3 Plan 04-03');
  it.todo('returns filtered list by channel (telegram|voice|call) — Wave 3 Plan 04-03');
  it.todo('paginates with limit/offset defaults 50/0 — Wave 3 Plan 04-03');
});
```

`apps/api/tests/integration/orders-list.test.ts`:
```ts
import { describe, it } from 'vitest';
const dockerAvailable = !process.env.AI_LOGIST_NO_DOCKER;
describe.skipIf(!dockerAvailable)('Phase 4 API-04 — GET /api/orders (joined list)', () => {
  it.todo('returns OrderListItem[] with fromCityName + toCityName + clientName + channel joined — Wave 3 Plan 04-03');
  it.todo('filters by status + channel — Wave 3 Plan 04-03');
  it.todo('sorts by createdAt DESC — Wave 3 Plan 04-03');
});
```

`apps/api/tests/integration/orders-detail.test.ts`:
```ts
import { describe, it } from 'vitest';
const dockerAvailable = !process.env.AI_LOGIST_NO_DOCKER;
describe.skipIf(!dockerAvailable)('Phase 4 API-04 — GET /api/orders/:id (detail)', () => {
  it.todo('returns order + events + client + fromCity + toCity + truck in ONE response — Wave 3 Plan 04-03');
  it.todo('returns 404 for missing order — Wave 3 Plan 04-03');
  it.todo('events sorted chronologically — Wave 3 Plan 04-03');
});
```

`apps/api/tests/integration/trucks-list.test.ts`:
```ts
import { describe, it } from 'vitest';
const dockerAvailable = !process.env.AI_LOGIST_NO_DOCKER;
describe.skipIf(!dockerAvailable)('Phase 4 API-05 — GET /api/trucks', () => {
  it.todo('returns full fleet (read-only) with capacity + body_type + driver_phone — Wave 3 Plan 04-03');
  it.todo('filters by status + bodyType — Wave 3 Plan 04-03');
});
```

`apps/api/tests/integration/clients-messages-union.test.ts`:
```ts
import { describe, it } from 'vitest';
const dockerAvailable = !process.env.AI_LOGIST_NO_DOCKER;
// API-06 UNION query — MOST IMPORTANT Phase 4 backend test.
// Seeds 2 messages (telegram) + 1 call with 3 transcript turns → asserts 5 rows
// sorted by created_at ASC, with voice turns carrying callId + timestampMs + audioUrl.
describe.skipIf(!dockerAvailable)('Phase 4 API-06 — clients/:id/messages UNION', () => {
  it.todo('UNION returns telegram messages + voice transcript turns chronologically — Wave 3 Plan 04-03');
  it.todo('voice turn role mapping: speaker=agent → role=ai, speaker=caller → role=client — Wave 3 Plan 04-03');
  it.todo('voice turn carries callId + timestampMs (offset in ms) + audioUrl — Wave 3 Plan 04-03');
  it.todo('returns empty array for client with no msgs and no calls — Wave 3 Plan 04-03');
  it.todo('defensive: handles transcript turns with missing timestamp_ms via idx-based fallback — Wave 3 Plan 04-03');
});
```

`apps/api/tests/integration/analytics-kpi.test.ts`:
```ts
import { describe, it } from 'vitest';
const dockerAvailable = !process.env.AI_LOGIST_NO_DOCKER;
describe.skipIf(!dockerAvailable)('Phase 4 API-09 — GET /api/analytics/kpi (extended)', () => {
  it.todo('returns calls.total + calls.answered for window=week — Wave 3 Plan 04-03');
  it.todo('returns extended fields: avgCallDurationS + byChannel{voice,telegram} + conversionFunnel — Wave 3 Plan 04-03');
  it.todo('conversionFunnel values are monotonically non-increasing (calls >= answered >= leadsCreated >= ordersConfirmed >= delivered) — Wave 3 Plan 04-03');
  it.todo('revenue.amount is bigint serialized as string (precision preserved) — Wave 3 Plan 04-03');
  it.todo('window=day|week|month adjusts SINCE bound correctly — Wave 3 Plan 04-03');
});
```

`apps/api/tests/integration/calls-list.test.ts`:
```ts
import { describe, it } from 'vitest';
const dockerAvailable = !process.env.AI_LOGIST_NO_DOCKER;
describe.skipIf(!dockerAvailable)('Phase 4 NEW endpoint — GET /api/calls + /api/calls/:id', () => {
  it.todo('GET /api/calls returns paginated list sorted by created_at DESC — Wave 3 Plan 04-03');
  it.todo('GET /api/calls filters by outcome (completed|abandoned|escalated|error) — Wave 3 Plan 04-03');
  it.todo('GET /api/calls filters by lang (ru|ua) — Wave 3 Plan 04-03');
  it.todo('GET /api/calls filters by date range (from/to) — Wave 3 Plan 04-03');
  it.todo('GET /api/calls/:id returns call + linkedLead + linkedOrder — Wave 3 Plan 04-03');
  it.todo('GET /api/calls/:id returns 404 for missing — Wave 3 Plan 04-03');
});
```

Create `apps/api/tests/PHASE-4.md` (architectural reference) with these sections:
- "Wave-by-wave flip schedule" — table mapping each wave to the markers it flips (Wave 1: ADMIN-01 partial / Wave 2: ADMIN-02 + I18N-02 + ADMIN-01 final / Wave 3: API-03..09 / Wave 4: ADMIN-03 + ADMIN-NEW-08 / Wave 5: ADMIN-05 + ADMIN-NEW-02 + ADMIN-NEW-03)
- "Test architecture overview" — 3 layers: (a) backend integration via testcontainers PostGIS 17-3.5 + apps/api buildApp() + app.inject(), (b) backend unit (none new in Phase 4), (c) frontend unit via vitest + @testing-library/react + happy-dom in apps/web (NEW)
- "Verifier grep gate" — exact bash command verifier runs: `grep -c "it.todo\\|test.todo" apps/api/tests/unit/phase-4-stubs.test.ts` must decrease 13 → 10 → 7 → 3 → 0 monotonically per wave
- "Phase 1-3.1 contract" — list of files that MUST remain bit-identical (`apps/api/src/pipeline/llm-tools/*.ts`, `apps/api/src/channels/**`, `apps/api/src/persistence/schema/*.ts`)

Commit message: `test(04-00): phase 4 wave 0 test infra — backend scaffolds + stubs`.
  </action>
  <verify>
    <automated>
test -f apps/api/tests/unit/phase-4-stubs.test.ts && \
test -f apps/api/tests/integration/leads-list.test.ts && \
test -f apps/api/tests/integration/orders-list.test.ts && \
test -f apps/api/tests/integration/orders-detail.test.ts && \
test -f apps/api/tests/integration/trucks-list.test.ts && \
test -f apps/api/tests/integration/clients-messages-union.test.ts && \
test -f apps/api/tests/integration/analytics-kpi.test.ts && \
test -f apps/api/tests/integration/calls-list.test.ts && \
test -f apps/api/tests/PHASE-4.md && \
[ "$(grep -cE 'it\.todo\(|test\.todo\(' apps/api/tests/unit/phase-4-stubs.test.ts)" = "13" ] && \
cd apps/api && pnpm test:unit -t "Phase 4" 2>&1 | grep -E "13 todo|13 (skipped|pending)"
    </automated>
  </verify>
  <acceptance_criteria>
    - File exists: `apps/api/tests/unit/phase-4-stubs.test.ts`
    - `grep -cE 'it\.todo\(|test\.todo\(' apps/api/tests/unit/phase-4-stubs.test.ts` returns exactly `13`
    - File contains all 13 requirement IDs verbatim: `grep -F "API-03" apps/api/tests/unit/phase-4-stubs.test.ts && grep -F "API-04" ... && grep -F "I18N-02" ...` all succeed
    - 7 integration scaffold files exist with `describe.skipIf(!dockerAvailable)` AND `it.todo` markers
    - Docstring of `phase-4-stubs.test.ts` does NOT contain literal substring `test.todo` or `it.todo` — verified by `grep -c "test\\.todo\\|it\\.todo" apps/api/tests/unit/phase-4-stubs.test.ts` returning exactly 13 (only the 13 call sites)
    - `cd apps/api && pnpm test:unit` exits 0 with 13 todo/pending count for "Phase 4" describe
    - `apps/api/tests/PHASE-4.md` exists with the 4 mandatory sections
    - `git diff apps/api/src/` returns empty (no production code touched)
  </acceptance_criteria>
  <done>
13 stub markers active, 7 backend integration scaffolds in place, PHASE-4.md architectural reference written, Phase 1-3.1 production code untouched.
  </done>
</task>

<task type="auto">
  <name>Task 2: apps/web vitest config + helpers + frontend unit scaffolds + 5 static-rules grep guards</name>
  <files>
    apps/web/vitest.config.ts,
    apps/web/tests/_helpers/render.ts,
    apps/web/tests/_helpers/mock-api.ts,
    apps/web/tests/_helpers/mock-cookies.ts,
    apps/web/tests/unit/static-rules.test.ts,
    apps/web/tests/unit/i18n-dict.test.ts,
    apps/web/tests/unit/proxy-auth.test.ts,
    apps/web/tests/unit/login-route.test.ts,
    apps/web/tests/unit/use-t.test.ts,
    apps/web/tests/unit/pages-smoke.test.ts,
    apps/web/package.json
  </files>
  <read_first>
    apps/web/package.json,
    apps/api/vitest.config.ts,
    .planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-RESEARCH.md,
    .planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-CONTEXT.md
  </read_first>
  <action>
Install Vitest + RTL + happy-dom in apps/web for the FIRST time:

```bash
pnpm --filter @ai-logist/web add -D vitest@^4 @testing-library/react@^16 @testing-library/dom@^10 happy-dom@^15 @types/react@^19 @types/react-dom@^19
```

Update `apps/web/package.json` scripts (PRESERVE existing dev/build/start; ADD test scripts):
```json
{
  "scripts": {
    "dev": "next dev --turbopack -p 3001",
    "build": "next build",
    "start": "next start -p 3001",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

Create `apps/web/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: false,
    setupFiles: ['./tests/_helpers/render.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

Create `apps/web/tests/_helpers/render.ts`:
```ts
// Wraps @testing-library/react render() with a default mock SWR provider.
// Phase 4 Wave 0 ships placeholder helpers; Wave 4 (chat/calls) fleshes them
// out with the real SWRConfig provider once SWR is installed (Wave 1).
import { afterEach, vi } from 'vitest';

// Cleanup after each test (RTL auto-imports cleanup when @testing-library/react is loaded
// — placeholder retained for future custom providers).
afterEach(() => {
  vi.clearAllMocks();
});

// Re-export render() from RTL once installed; consumers import from this helper.
export { render, screen, fireEvent, waitFor } from '@testing-library/react';
```

Create `apps/web/tests/_helpers/mock-api.ts`:
```ts
// Keyed-by-URL fetch mock. Each test registers expected URL → response.
import { vi } from 'vitest';

type MockResponse = { status?: number; body: unknown };
const routes = new Map<string, MockResponse>();

export function mockFetch(url: string, response: MockResponse) {
  routes.set(url, response);
}

export function installMockFetch() {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    const match = routes.get(url);
    if (!match) {
      throw new Error(`mock-api: no route registered for ${url}`);
    }
    return new Response(JSON.stringify(match.body), {
      status: match.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}

export function resetMockFetch() {
  routes.clear();
  vi.restoreAllMocks();
}
```

Create `apps/web/tests/_helpers/mock-cookies.ts`:
```ts
// Mock next/headers cookies() — used by proxy.ts auth tests + login route tests.
import { vi } from 'vitest';

const store = new Map<string, string>();

export function mockCookies(initial?: Record<string, string>) {
  store.clear();
  if (initial) for (const [k, v] of Object.entries(initial)) store.set(k, v);

  vi.mock('next/headers', () => ({
    cookies: async () => ({
      get: (name: string) => {
        const v = store.get(name);
        return v ? { name, value: v } : undefined;
      },
      set: (name: string, value: string) => {
        store.set(name, value);
      },
      delete: (name: string) => {
        store.delete(name);
      },
    }),
  }));
}

export function getMockCookieStore() {
  return store;
}
```

Create `apps/web/tests/unit/static-rules.test.ts` — the 5 CI grep guards from CONTEXT D-12/D-58/D-59 + RESEARCH Pitfalls #2 + #4:
```ts
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('../../', import.meta.url).pathname; // apps/web/

function grep(pattern: string, paths: string): string {
  try {
    return execSync(`grep -rE "${pattern}" ${paths} 2>/dev/null || true`, {
      cwd: ROOT,
      encoding: 'utf8',
    });
  } catch {
    return '';
  }
}

describe('Phase 4 static-rules (Pitfall #13 + Next.js 16 + auth)', () => {
  // Guard 1: D-12 — no 'use cache' on chat/calls/orders/orders[id]/login routes.
  it("no 'use cache' directive in chat/calls/orders pages (D-12)", () => {
    // Wave 1 will create these dirs; pre-Wave-1 the dirs don't exist → output empty (PASS).
    const hits = grep("'use cache'", "src/app/\\(main\\)/dashboard/chat src/app/\\(main\\)/dashboard/calls src/app/\\(main\\)/dashboard/orders src/app/auth/v1/login 2>/dev/null");
    expect(hits.trim()).toBe('');
  });

  // Guard 2: D-58 — Tailwind v4 border-border must be explicit (no bare `border`).
  it('no bare `border` class without border-border in dashboard/ (D-58)', () => {
    const hits = grep(
      'className=\\"[^\\"]*\\\\bborder\\\\b[^-][^\\"]*\\"',
      'src/app/\\(main\\)/dashboard/'
    );
    // Filter out lines containing border-border, border-primary, border-{color}.
    const offenders = hits
      .split('\n')
      .filter((line) => line && !/border-(border|primary|secondary|destructive|muted|accent|input|ring|[a-z]+-[0-9]+)/.test(line));
    expect(offenders).toEqual([]);
  });

  // Guard 3: D-59 — page.tsx under (main)/dashboard/ MUST NOT have 'use client'.
  it("all page.tsx under (main)/dashboard/ are Server Components — no 'use client' (D-59)", () => {
    const hits = grep("^'use client'", "src/app/\\(main\\)/dashboard/.*page.tsx");
    expect(hits.trim()).toBe('');
  });

  // Guard 4: Auth — proxy.ts matcher gates /dashboard/* and excludes /api + /auth.
  it("proxy.ts matcher covers /dashboard/:path* and excludes /api + /auth (Auth-01)", () => {
    // File may not exist pre-Wave-2 — grep returns '' (PASS by default).
    const content = grep('matcher', 'src/proxy.ts 2>/dev/null');
    if (content.trim() === '') {
      return; // proxy.ts not yet created — Wave 2 will add it.
    }
    expect(content).toMatch(/dashboard/);
    expect(content).not.toMatch(/\/api[^\w]/); // No /api in matcher
    expect(content).not.toMatch(/\/auth[^\w]/); // No /auth in matcher
  });

  // Guard 5: Next.js 16 — no sync cookies()/headers()/searchParams/params usage.
  it("no sync cookies()/headers()/params/searchParams — Next.js 16 async-only (Pitfall #2)", () => {
    const hits = grep('\\bcookies\\(\\)[^.][^a]', 'src/');
    // Allowed: `await cookies()`, `await headers()`, `cookies()` followed by .then/await
    const offenders = hits
      .split('\n')
      .filter((line) => line && !/await\s+cookies\(\)/.test(line) && !/cookies\(\)\s*\.then/.test(line));
    expect(offenders).toEqual([]);
  });
});
```

Create 5 additional unit scaffolds — each with 1 `test.todo()` placeholder per requirement, ready for Wave 1-5 flips:

`apps/web/tests/unit/i18n-dict.test.ts`:
```ts
import { describe, it } from 'vitest';
describe('Phase 4 I18N-02 — dict + useT()', () => {
  it.todo("useT('chat.intercept') returns 'Перехватить' for lang=ru (default) — Wave 2 Plan 04-02");
  it.todo("useT('chat.intercept') returns 'Перехопити' for lang=ua — Wave 2 Plan 04-02");
  it.todo("Customize-panel language toggle updates Zustand state — Wave 2 Plan 04-02");
});
```

`apps/web/tests/unit/proxy-auth.test.ts`:
```ts
import { describe, it } from 'vitest';
describe('Phase 4 ADMIN-02 — proxy.ts auth gate', () => {
  it.todo('proxy.ts redirects unauth /dashboard/* to /auth/v1/login — Wave 2 Plan 04-02');
  it.todo('proxy.ts allows authenticated requests through — Wave 2 Plan 04-02');
  it.todo('proxy.ts matcher excludes /api and /auth — Wave 2 Plan 04-02');
});
```

`apps/web/tests/unit/login-route.test.ts`:
```ts
import { describe, it } from 'vitest';
describe('Phase 4 ADMIN-02 — login + logout routes', () => {
  it.todo('POST /auth/v1/login with valid creds sets al_session cookie + returns {ok:true} — Wave 2 Plan 04-02');
  it.todo('POST /auth/v1/login with bad password returns 401 — Wave 2 Plan 04-02');
  it.todo('POST /auth/v1/login with bad username returns 401 — Wave 2 Plan 04-02');
  it.todo('POST /auth/v1/logout clears al_session cookie — Wave 2 Plan 04-02');
});
```

`apps/web/tests/unit/use-t.test.ts`:
```ts
import { describe, it } from 'vitest';
describe('Phase 4 I18N-02 — useT() hook reads Zustand preferences store', () => {
  it.todo("useT() reads Zustand language field — Wave 2 Plan 04-02");
  it.todo("useT() falls back to RU when language is unset or unknown — Wave 2 Plan 04-02");
  it.todo("useT() interpolates {var} placeholders — Wave 2 Plan 04-02");
});
```

`apps/web/tests/unit/pages-smoke.test.ts`:
```ts
import { describe, it } from 'vitest';
describe('Phase 4 page-render smoke (all 6 pages)', () => {
  it.todo('/dashboard/chat renders thread list + active thread with mocked SWR data — Wave 4 Plan 04-04');
  it.todo('/dashboard/calls renders table + filter bar + opens modal on row click — Wave 4 Plan 04-04');
  it.todo('/dashboard/orders renders table with city names + filter changes update URL — Wave 5 Plan 04-05');
  it.todo('/dashboard/orders/[id] renders timeline + channel breadcrumb (voice/telegram) — Wave 5 Plan 04-05');
  it.todo('/dashboard/default renders compact KPI tiles + last-5 lists — Wave 5 Plan 04-05');
  it.todo('/dashboard/analytics renders charts + window selector updates ?window= — Wave 5 Plan 04-05');
});
```

After everything, run `pnpm --filter @ai-logist/web test` — must exit 0 with 5 passing static-rules tests + 22 todo markers.

Commit message: `test(04-00): phase 4 wave 0 — apps/web vitest config + RTL + 5 grep guards + 5 unit scaffolds`.
  </action>
  <verify>
    <automated>
test -f apps/web/vitest.config.ts && \
test -f apps/web/tests/_helpers/render.ts && \
test -f apps/web/tests/_helpers/mock-api.ts && \
test -f apps/web/tests/_helpers/mock-cookies.ts && \
test -f apps/web/tests/unit/static-rules.test.ts && \
test -f apps/web/tests/unit/i18n-dict.test.ts && \
test -f apps/web/tests/unit/proxy-auth.test.ts && \
test -f apps/web/tests/unit/login-route.test.ts && \
test -f apps/web/tests/unit/use-t.test.ts && \
test -f apps/web/tests/unit/pages-smoke.test.ts && \
grep -q "happy-dom" apps/web/package.json && \
grep -q "@testing-library/react" apps/web/package.json && \
grep -q '"test": "vitest run"' apps/web/package.json && \
cd apps/web && pnpm test 2>&1 | grep -E "5 passed|22 todo"
    </automated>
  </verify>
  <acceptance_criteria>
    - File exists: `apps/web/vitest.config.ts` with `environment: 'happy-dom'`
    - `apps/web/package.json` devDependencies contain: `vitest`, `@testing-library/react`, `@testing-library/dom`, `happy-dom`
    - `apps/web/package.json` scripts contain: `"test": "vitest run"`, `"test:watch": "vitest"`, `"typecheck": "tsc --noEmit"`
    - 4 helper files exist under `apps/web/tests/_helpers/`
    - 6 unit test files exist under `apps/web/tests/unit/` (static-rules + 5 scaffolds)
    - `static-rules.test.ts` defines exactly 5 `it()` blocks (NOT todo — these are real grep guards running from Wave 0)
    - 5 unit scaffolds (i18n-dict, proxy-auth, login-route, use-t, pages-smoke) define a total of 16 `it.todo()` calls
    - `cd apps/web && pnpm test` exits 0 with 5 passing tests + 16 todo
    - `pnpm install` (from monorepo root) successfully resolves all new devDependencies
  </acceptance_criteria>
  <done>
apps/web has its first test runner (vitest + happy-dom + RTL), 5 static grep guards enforce Pitfall #13 + Next.js 16 async + auth matcher from Wave 0 onward, 16 frontend test.todo markers staged for Wave 1-5 flips.
  </done>
</task>

</tasks>

<verification>
- `cd apps/api && pnpm test:unit -t "Phase 4"` exits 0 with 13 todo markers
- `cd apps/web && pnpm test` exits 0 with 5 passing + 16 todo markers
- `git diff apps/api/src/ apps/web/src/ packages/shared-types/src/` returns empty (only test files + package.json + vitest.config.ts changed)
- Phase 4 stub marker count baseline locked at 13
</verification>

<success_criteria>
- 13-marker stub file exists at `apps/api/tests/unit/phase-4-stubs.test.ts` — verifier grep gate established
- 7 backend integration scaffolds + 7 frontend unit scaffolds exist with stable file layout — Waves 1-5 only ADD it() / FLIP test.todo()
- Static grep guards (Pitfall #13 trip-wires + Next.js 16 async + auth matcher) run from CI starting Wave 0
- No production code touched (apps/api/src + apps/web/{app,src} + packages/shared-types/src bit-identical pre-vs-post)
- Phase 1-3.1 contract preserved (apps/api/src/pipeline/llm-tools/* + apps/api/src/channels/* untouched)
</success_criteria>

<output>
After completion, create `.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-00-SUMMARY.md` summarizing:
- Files created (19) + lines added
- Stub-marker count baseline (13) confirmed via grep
- vitest test runner introduced to apps/web for the first time + 5 static guards green
- Decisions taken (e.g., happy-dom over jsdom, scaffold file naming convention)
- Phase 1-3.1 source untouched (git diff stat)
- Notes for Wave 1 (Plan 04-01) — Zenith vendor + monorepo wire
</output>
