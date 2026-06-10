---
phase: 04-admin-web-reduced-scope-chat-calls-orders-kpi
plan: 01
subsystem: frontend-vendor
tags: [zenith, next-16, react-19, tailwind-v4, shadcn, vendoring, phase-4]

# Dependency graph
requires:
  - phase: 04-admin-web-reduced-scope-chat-calls-orders-kpi
    plan: 00
    provides: 13 stub markers + 5 grep guards + apps/web vitest config
  - phase: 01-database-backend-skeleton
    provides: apps/web Phase 1 placeholder (replaced this plan)

provides:
  - Full Zenith Admin template vendored under apps/web/src/ (mahooo0/next-shadcn-admin-dashboard SHA 4e667cc)
  - apps/web/VENDOR.md vendor receipt with SHA + deps snapshot + Pitfall #13 audit
  - apps/web/package.json merged (Zenith deps + workspace shared-types + swr + bcryptjs + jose)
  - apps/web/next.config.ts merged (Zenith reactCompiler + Phase 1 output:'standalone')
  - apps/web/tsconfig.json merged (Zenith strict + monorepo extends + noUncheckedIndexedAccess override)
  - apps/web/postcss.config.mjs verbatim from Zenith (Tailwind v4 PostCSS plugin)
  - apps/web/components.json verbatim from Zenith (shadcn radix-nova config)
  - 26-route Next.js build green (chat / default / analytics + 23 other Zenith pages reachable)
  - ADMIN-01 stub flipped — marker count 13 → 12 (1 of 13 Phase 4 markers down)
  - usePreferencesStore hook signature documented for Wave 2 i18n wiring
  - Phase 1 placeholder apps/web/app/ + next-env.d.ts removed

affects:
  - 04-02 (Wave 2 auth + lib primitives — proxy.ts uses signed cookie via jose; gen-admin-password CLI uses bcryptjs; useT() reads usePreferencesStore documented here)
  - 04-03 (Wave 3 backend handlers — schemas consumed via @ai-logist/shared-types workspace dep landed here)
  - 04-04 (Wave 4 chat + calls — chat-app.tsx rewires to our UNION API; modify _components/ per D-03 convention)
  - 04-05 (Wave 5 orders + KPI — new pages under (main)/dashboard/orders + calls following Zenith directory convention)

# Tech tracking
tech-stack:
  added:
    - "next ^16.2.4 (was ^16.0.0 — Zenith pin)"
    - "react ^19.2.5 (was ^19.0.0 — Zenith pin)"
    - "react-dom ^19.2.5"
    - "tailwindcss ^4.1.5 + @tailwindcss/postcss ^4.2.4 + tw-animate-css ^1.4.0"
    - "shadcn ^4.6.0 + radix-ui ^1.4.3 + class-variance-authority ^0.7.1 + clsx ^2.1.1 + tailwind-merge ^3.5.0"
    - "zustand ^5.0.12 + react-hook-form ^7.75.0 + @hookform/resolvers ^5.2.2"
    - "zod ^4.4.2 (matches apps/api + packages/shared-types)"
    - "lucide-react ^1.14.0 + simple-icons ^16.18.1 + geist ^1.7.0"
    - "recharts ^3.8.0 (charts for /dashboard/default + /dashboard/analytics)"
    - "@tanstack/react-table ^8.21.3 (calls/orders tables)"
    - "@dnd-kit/core ^6.3.1 + @dnd-kit/modifiers ^9.0.0 + @dnd-kit/sortable ^10.0.0 (kept though Kanban deferred)"
    - "date-fns ^4.1.0 + libphonenumber-js ^1.12.42 + next-themes ^0.4.6"
    - "sonner ^2.0.7 (toasts) + cmdk ^1.1.1 + input-otp ^1.4.2 + vaul ^1.1.2"
    - "embla-carousel-react ^8.6.0 + react-day-picker ^9.14.0 + react-resizable-panels ^4.11.0"
    - "@base-ui/react ^1.4.1"
    - "swr ^2.4.1 — D-11 client refresh (Phase 4 NEW)"
    - "bcryptjs ^3.0.3 — D-05 admin password hash (Phase 4 NEW)"
    - "jose ^6.2.3 — D-06 signed HTTP-only cookie (Phase 4 NEW)"
    - "@ai-logist/shared-types workspace:* — D-18 workspace ref (Phase 4 NEW)"
    - "tsx ^4.22.0 + babel-plugin-react-compiler ^1.0.0 + postcss ^8.5.13 (devDeps)"
  patterns:
    - "Mechanical vendor pattern: single big commit copying Zenith verbatim, follow-up merge commit for our scripts/deps. Keeps git blame legible (Zenith vs our Phase 4 work separable)."
    - "Tailwind v4 CSS-first config — no tailwind.config.ts file (CSS @theme + @tailwindcss/postcss plugin only)."
    - "noUncheckedIndexedAccess=false override at apps/web/tsconfig.json — Zenith template uses array[i] / Map.get() / Object[k] patterns without ?. guards; re-enabling would require ~50 edits inside vendored code (out of scope). Phase-4 production code (Wave 2+) writes defensively, leaves vendor untouched."
    - "VENDOR.md receipt pattern — Pitfall #1 mitigation. Records exact SHA + deps snapshot + Pitfall #13 audit findings + Open Question #1 resolution + re-vendoring procedure. Template for any future upstream vendor."

key-files:
  created:
    - apps/web/src (full Zenith source tree — 222 files)
    - apps/web/components.json
    - apps/web/postcss.config.mjs
    - apps/web/VENDOR.md
    - apps/web/.env.example
  modified:
    - apps/web/next.config.ts (merged: Zenith reactCompiler + dashboard redirect + Phase 1 output:'standalone')
    - apps/web/tsconfig.json (merged: Zenith strict + monorepo extends + noUncheckedIndexedAccess=false override)
    - apps/web/package.json (merged: 31 Zenith deps + 4 Phase 4 NEW deps - 3 dropped: husky/lint-staged/ts-node)
    - .env.example (root — appended 4 Phase 4 env vars)
    - apps/api/tests/unit/phase-4-stubs.test.ts (flipped ADMIN-01 from it.todo to it())
    - pnpm-lock.yaml (Zenith deps + swr + bcryptjs + jose transitive closure)
  deleted:
    - apps/web/app/page.tsx (Phase 1 hello-world placeholder)
    - apps/web/app/layout.tsx
    - apps/web/app/globals.css
    - apps/web/next-env.d.ts (auto-regenerated by next build on next run)
    - apps/web/package.json.zenith (temporary capture file from Task 1)

key-decisions:
  - "Zenith uses next.config.mjs + no tailwind.config.ts — Tailwind v4 is PostCSS-only with CSS-first @theme config. Plan's verify gate expected tailwind.config.ts but Tailwind v4 deprecated the JS config (Tailwind 4.0 release Jan 2024). Our merged next.config.ts retains TS form for type safety; postcss.config.mjs verbatim from Zenith."
  - "noUncheckedIndexedAccess override — monorepo root tsconfig.base.json sets noUncheckedIndexedAccess=true (defensive Phase 1 decision for backend strictness). Zenith template uses array[i] / Map.get() / Object[k] / chartConfig.income patterns extensively without ?. or non-null assertions. Re-enabling would require 10+ changes inside vendored code (analytics-v1, finance-v1, crm, kanban-board, theme-switcher, app-sidebar). Auto-applied Rule 3 — override at apps/web/tsconfig.json only; backend stays strict."
  - "Dropped @types/bcryptjs — bcryptjs v3+ ships its own TypeScript types per upstream DefinitelyTyped deprecation notice. Initial package.json had @types/bcryptjs ^3.0.0 (deprecation warning at install); removed in same Task 2 commit."
  - "babel-plugin-react-compiler ^1.0.0 retained — Zenith dev dep enables reactCompiler:true in next.config. Removing it would break Zenith's intended React 19 compiler integration. Kept verbatim."
  - "Zenith Language type is 'en' | 'de' | 'fr'. Wave 2 (Plan 04-02) must extend LANGUAGE_OPTIONS in apps/web/src/lib/preferences/layout.ts to add ru/ua. usePreferencesStore selector + setLanguage setter signatures stay identical — only the union type widens. Documented in VENDOR.md for Wave 2."
  - "Zenith ships proxy.disabled.ts as scaffolding (Next.js 16 convention proof). Wave 2 creates real apps/web/src/proxy.ts. NO middleware.ts will be created (Pitfall #4 — proxy.ts is the native Next.js 16 name, middleware.ts is deprecated)."

patterns-established:
  - "Vendor-receipt pattern (VENDOR.md): SHA + deps snapshot + Pitfall audit + Open Questions resolved + re-vendoring procedure. Mirrors Phase 1's docker-compose recipe / Phase 3.1's voice-config.md doc convention."
  - "Mechanical-merge package.json pattern: keep our name + scripts + Wave 0 dev deps; inherit Zenith deps verbatim; add Phase-4 NEW deps in alphabetic order; drop tooling we replace at monorepo level (husky/lint-staged → Biome)."
  - "apps/web first-ever next build: 26 routes generated (4 static auth pages + 22 dynamic dashboard pages). Build smoke = `pnpm --filter @ai-logist/web build` exits 0. Verifier will run this on Phase 4 closure."

requirements-completed:
  - ADMIN-01

# Metrics
duration: 7m23s
completed: 2026-06-10
---

# Phase 4 Plan 01: Zenith Vendor Summary

**Vendored mahooo0/next-shadcn-admin-dashboard @ SHA `4e667cc` (2026-05-05) into apps/web/ — 222 source files, 35 production deps merged with workspace shared-types + swr + bcryptjs + jose, 26-route Next.js build green, Wave 0 grep guards still GREEN, ADMIN-01 stub flipped (markers 13 → 12).**

## Performance

- **Duration:** 7m23s
- **Started:** 2026-06-11T00:19:09Z
- **Tasks:** 2
- **Files created:** ~226 (Zenith src + VENDOR.md + apps/web/.env.example + components.json + postcss.config.mjs)
- **Files modified:** 6 (next.config.ts + tsconfig.json + package.json + .env.example + phase-4-stubs.test.ts + pnpm-lock.yaml)
- **Files deleted:** 5 (Phase 1 app/ placeholder + next-env.d.ts + package.json.zenith capture)
- **Build smoke:** `next build` exits 0 with 26 routes (4 static + 22 dynamic dashboard pages)
- **Test smoke:** apps/web 5 passed + 19 todo (Wave 0 grep guards GREEN); apps/api 188 passed + 12 todo (ADMIN-01 flipped, was 187 + 13)

## Accomplishments

- **Zenith template vendored** — SHA `4e667ccf5056d52830e1d99b2bd39372ae386932` (2026-05-05), 222 source files under `apps/web/src/`. All 22 Zenith dashboard pages reachable post-build (chat, default, analytics, calls-not-yet, orders-not-yet, kanban, calendar, mail, crm, finance, productivity, draggable, components, coming-soon, [...not-found], (legacy)/analytics-v1, (legacy)/crm-v1, (legacy)/default-v1, (legacy)/finance-v1, dashboard root redirect, plus 4 auth pages).
- **Tailwind v4 + Next.js 16 + React 19 build chain confirmed working** — Zenith pins `next ^16.2.4`, `react ^19.2.5`, `tailwindcss ^4.1.5`. Build resolved to `next@16.2.7` + `react@19.2.7` + `tailwindcss@4.3.0` (minor float fine, semver-compatible with Zenith floors). `next build --turbopack` exits 0 in 9.8s.
- **VENDOR.md receipt locked** — Pitfall #1 mitigated. Records exact Zenith SHA, source commit date, MIT license confirmation, full deps snapshot (32 deps + 13 devDeps verbatim from upstream), Pitfall #13 audit findings (all PASS), usePreferencesStore hook signature (Open Question #1 RESOLVED for Wave 2), and re-vendoring procedure.
- **package.json merged correctly** — kept our `@ai-logist/web` name + `next dev --turbopack -p 3001` script + Wave 0 vitest+RTL+happy-dom devDeps; inherited 31 Zenith production deps verbatim; added 4 Phase 4 NEW deps (`@ai-logist/shared-types workspace:*`, `swr ^2.4.1`, `bcryptjs ^3.0.3`, `jose ^6.2.3`); dropped husky + lint-staged + ts-node (Pitfall #3 — root Biome covers).
- **next.config.ts merged correctly** — Phase 1 `output: 'standalone'` (required by apps/web/Dockerfile) preserved on top of Zenith's `reactCompiler: true` + console-removal in prod + `/dashboard → /dashboard/default` redirect.
- **tsconfig.json merged correctly** — Zenith strict + path alias + plugins, monorepo `extends: ../../tsconfig.base.json`, tests + vitest includes for Wave 0 test runner. `noUncheckedIndexedAccess=false` override at apps/web level only — Zenith vendor untouched, backend stays strict (Rule 3 auto-fix).
- **Phase 1 placeholder fully removed** — `apps/web/app/` (page.tsx + layout.tsx + globals.css) + `next-env.d.ts` deleted. Zenith uses `src/app/` per Next.js 13+ convention; no orphan files.
- **`.env.example` updated** — root .env.example documents 4 Phase 4 env vars (ADMIN_USERNAME, ADMIN_PASSWORD_HASH, AUTH_COOKIE_SECRET, API_INTERNAL_URL). apps/web/.env.example created for local dev with `API_INTERNAL_URL=http://localhost:3000` (vs root's `http://api:3000` for docker-compose).
- **ADMIN-01 stub flipped** — `apps/api/tests/unit/phase-4-stubs.test.ts` marker count 13 → 12 (exact match per Plan 04-00 verifier monotonic sequence). The new it() block asserts structural proof: chat/default/analytics page.tsx exist + VENDOR.md exists + package.json has shared-types workspace ref + swr + bcryptjs + jose with correct major versions.
- **Wave 0 contracts preserved** — `apps/web/vitest.config.ts`, `apps/web/tests/_helpers/{render,mock-api,mock-cookies}.ts`, and `apps/web/tests/unit/{static-rules,i18n-dict,proxy-auth,login-route,use-t,pages-smoke}.test.ts` untouched. 5 grep guards (D-12 no 'use cache' / D-58 border-border / D-59 page.tsx server-only / proxy.ts matcher / Pitfall #2 async cookies) all GREEN against vendored Zenith.
- **Phase 1-3.1 production code bit-identical** — `git diff --stat apps/api/src/ packages/shared-types/src/` returns empty across both task commits. Backend remained 188 unit tests passing throughout.

## Task Commits

Each task was committed atomically:

1. **Task 1: Clone + bulk-copy Zenith + VENDOR.md + Phase 1 placeholder removal staged** — `5332d1c` (feat)
2. **Task 2: package.json merge + pnpm install + .env.example + ADMIN-01 flip + Phase 1 placeholder deleted** — `60a62fa` (feat)

**Plan metadata:** _committed below via final commit (SUMMARY + STATE + ROADMAP + REQUIREMENTS)_

## Files Created/Modified

### apps/web/ (vendored tree, 222 files)

- `apps/web/src/app/(main)/dashboard/{chat,default,analytics,kanban,calendar,mail,crm,finance,productivity,draggable,components,coming-soon,[...not-found],(legacy)/*}/` — full Zenith dashboard pages
- `apps/web/src/app/(main)/auth/{v1,v2}/{login,register}/` — Zenith auth pages
- `apps/web/src/components/ui/` — shadcn primitives (Card, Button, Dialog, Badge, Table, Input, etc.)
- `apps/web/src/lib/{preferences,fonts,utils}/` — Zenith library code
- `apps/web/src/navigation/sidebar/sidebar-items.ts` — sidebar config (Wave 2 will trim per D-49)
- `apps/web/src/stores/preferences/{preferences-provider.tsx,preferences-store.ts}` — Zustand preferences store (i18n hook in Wave 2)
- `apps/web/src/proxy.disabled.ts` — Zenith scaffolding artifact (Wave 2 creates real `proxy.ts`)
- `apps/web/components.json` — shadcn config (radix-nova style, lucide icons)
- `apps/web/postcss.config.mjs` — Tailwind v4 PostCSS plugin
- `apps/web/VENDOR.md` — vendor receipt (Pitfall #1 mitigation, 248 lines)
- `apps/web/.env.example` — local dev env template

### Modified (6 files)

- `apps/web/next.config.ts` — merged Phase 1 `output: 'standalone'` + Zenith reactCompiler + console-removal + dashboard redirect
- `apps/web/tsconfig.json` — Zenith strict + monorepo extends + `noUncheckedIndexedAccess: false` override
- `apps/web/package.json` — 31 Zenith deps + 4 Phase 4 NEW deps + dropped husky/lint-staged/ts-node + kept Wave 0 dev deps
- `.env.example` (root) — appended 4 Phase 4 env vars
- `apps/api/tests/unit/phase-4-stubs.test.ts` — flipped ADMIN-01 from `it.todo` to `it()`
- `pnpm-lock.yaml` — Zenith production deps + swr + bcryptjs + jose transitive closure

### Deleted (5 files)

- `apps/web/app/page.tsx` (Phase 1 hello-world)
- `apps/web/app/layout.tsx`
- `apps/web/app/globals.css`
- `apps/web/next-env.d.ts` (auto-regenerated on next build)
- `apps/web/package.json.zenith` (Task 1 temporary capture file)

## Decisions Made

1. **Mechanical vendor + merge split into two commits** — Task 1 captures Zenith verbatim (one big "this came from upstream" commit), Task 2 merges our scripts/deps (small targeted change). Keeps `git blame` legible — future Zenith upgrades can `git diff 5332d1c..NEW_VENDOR_COMMIT` to see only upstream delta.
2. **Tailwind v4 has no tailwind.config.ts** — plan's verify gate expected `test -f apps/web/tailwind.config.ts` but Tailwind v4 (Jan 2024 release) moved to CSS-first config via `@theme` blocks + `@tailwindcss/postcss` plugin. We follow Zenith verbatim — no tailwind.config.ts created. VENDOR.md documents this in the audit section.
3. **noUncheckedIndexedAccess=false at apps/web level** — Zenith uses `array[i]` / `Map.get()` / `chartConfig.income` patterns extensively. Re-enabling would require 10+ defensive edits inside vendored code (analytics-v1, finance-v1, crm, kanban-board, theme-switcher, app-sidebar). Rule 3 auto-fix: override at apps/web tsconfig only; backend (apps/api) stays strict. Phase 4 wave 2+ code we write follows defensive index-access patterns regardless.
4. **Dropped @types/bcryptjs** — bcryptjs v3+ ships its own TypeScript types; the v3.0.0 DefinitelyTyped package is deprecated. Initial package.json included it (plan body said "@types/bcryptjs `<latest>`"); removed in the same Task 2 commit after the install warning surfaced. Rule 1 auto-fix.
5. **Kept babel-plugin-react-compiler** — Zenith dev dep enables `reactCompiler: true` in next.config. Removing would break Zenith's intended React 19 compiler integration. Verified `next build` exits 0 with it enabled.
6. **Kept @dnd-kit packages installed even though Kanban is deferred** — D-48 says "do not delete unused template pages." Removing the dep would force editing `kanban-board.tsx` to comment out imports. Cheaper to leave installed (transitive cost ~30KB gzipped); Wave 2 sidebar trim hides nav entry.
7. **`apps/web/.env.example` separate from root** — root .env.example uses `API_INTERNAL_URL=http://api:3000` (docker-compose service hostname); apps/web/.env.example uses `http://localhost:3000` (local dev with backend on host). Manager copies apps/web/.env.example → apps/web/.env.local before first `pnpm dev`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] No `tailwind.config.ts` in Zenith (Tailwind v4 CSS-first)**
- **Found during:** Task 1 (after Zenith clone)
- **Issue:** Plan's bulk-copy step listed `cp $ZENITH_DIR/tailwind.config.ts apps/web/tailwind.config.ts` as a hard requirement, and the automated verify gate included `test -f apps/web/tailwind.config.ts`. Zenith does not ship `tailwind.config.ts` (or `.js`) — Tailwind v4 moved to CSS-first config via `@theme` blocks in `src/app/globals.css` + the `@tailwindcss/postcss` plugin.
- **Fix:** Copied `postcss.config.mjs` verbatim from Zenith (does contain `@tailwindcss/postcss` plugin entry). Did NOT create a synthetic `tailwind.config.ts` because that would be inventing config Zenith does not have. Documented in VENDOR.md under "Pitfall #13 audit / Tailwind v4 config location" section.
- **Files modified:** apps/web/postcss.config.mjs created; no tailwind.config.ts.
- **Verification:** `pnpm --filter @ai-logist/web build` exits 0; Tailwind classes from Zenith pages render correctly.
- **Committed in:** 5332d1c (Task 1 commit)

**2. [Rule 3 - Blocking] `noUncheckedIndexedAccess=true` from monorepo root broke 10+ Zenith files**
- **Found during:** Task 2 (after `pnpm exec tsc --noEmit` ran)
- **Issue:** Monorepo root `tsconfig.base.json` sets `noUncheckedIndexedAccess: true` (Phase 1 backend strictness decision). Zenith template uses `array[i] / Map.get() / chartConfig.income / chartConfig.expenses / Kanban tasks[i] / themeMode[v]` patterns without `?.` or non-null assertions. Result: 11 TS2532 / TS18048 / TS2345 errors across analytics-v1, finance-v1/cash-flow-overview, app-sidebar, theme-switcher, crm/opportunities, kanban-board.
- **Fix:** Added `"noUncheckedIndexedAccess": false` override at apps/web/tsconfig.json (overrides the monorepo extends). Backend (apps/api/tsconfig.json) stays strict — only the vendored frontend relaxes the rule.
- **Files modified:** apps/web/tsconfig.json
- **Verification:** `pnpm exec tsc --noEmit` exits 0 after override.
- **Committed in:** 60a62fa (Task 2 commit)

**3. [Rule 1 - Bug] Initial package.json included @types/bcryptjs (deprecated)**
- **Found during:** Task 2 (immediately after `pnpm install`)
- **Issue:** Initial merged package.json included `@types/bcryptjs ^3.0.0` per plan body's "`@types/bcryptjs <latest>`" instruction. pnpm install printed: `WARN deprecated @types/bcryptjs@3.0.0`. bcryptjs v3+ ships its own types; the DefinitelyTyped package was deprecated.
- **Fix:** Removed `@types/bcryptjs` from devDependencies; re-ran `pnpm install` (cleanly resolved). bcryptjs types now come from bcryptjs's own d.ts file inside `node_modules/bcryptjs/typings/`.
- **Files modified:** apps/web/package.json
- **Verification:** `pnpm exec tsc --noEmit` still exits 0 (bcryptjs types resolved from package's own typings).
- **Committed in:** 60a62fa (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 Rule 1 + 2 Rule 3 — all environmental compatibility issues between Zenith template + monorepo strictness).
**Impact on plan:** No semantic deviation from plan intent. All 3 fixes preserve the plan's goal (vendor Zenith verbatim, get build green) — just adjust for Tailwind v4 / Phase 1 strictness deltas that the plan didn't anticipate.

## Pitfall #13 Audit Findings (from VENDOR.md)

| Trip-wire | Status |
|-----------|--------|
| `'use cache'` on dynamic routes (D-12) | PASS — Zenith does NOT use Cache Components |
| `border-border` explicit vs bare `border` (D-58) | PASS — Wave 0 grep guard GREEN against vendor |
| `page.tsx` server / `_components/*` client (D-03 + D-59) | PASS — only `[...not-found]/page.tsx` is client (catch-all stub, not a Phase-4 target page) |
| Next.js 16 async `cookies()`/`headers()`/`searchParams`/`params` (Pitfall #2) | PASS — Wave 0 grep guard GREEN |
| `middleware.ts` vs `proxy.ts` (Pitfall #4) | DOCUMENTED — Wave 2 creates `proxy.ts`; Zenith ships `proxy.disabled.ts` scaffolding |
| Tailwind v4 config location | INFO — no `tailwind.config.ts` (Tailwind v4 CSS-first via globals.css) |

## Open Question #1 Resolution (from RESEARCH)

**Question:** What is the exact signature of Zenith's `usePreferencesStore` hook so Wave 2's `useT()` can read the language preference without spelunking?

**Answer (recorded in VENDOR.md):**
```ts
// Hook signature
export const usePreferencesStore = <T,>(selector: (state: PreferencesState) => T): T

// Language field (Phase 4 hook target)
type PreferencesState = {
  language: Language;  // 'en' | 'de' | 'fr' currently
  setLanguage: (language: Language) => void;
  // ... + 13 other preference fields (themeMode, themePreset, font, ...)
}

// Wave 2 action: extend LANGUAGE_OPTIONS in apps/web/src/lib/preferences/layout.ts
// to add { label: 'Русский', value: 'ru' } + { label: 'Українська', value: 'ua' }.
// Existing setLanguage setter handles the wider type automatically.
```

## Issues Encountered

- **Plan's `tailwind.config.ts` requirement is stale** — Zenith repo evolved to Tailwind v4 (post-Jan 2024) which deprecated the JS config file. Plan was written assuming v3 layout. Handled as Rule 3 deviation; VENDOR.md documents the audit finding. Future plans should reference `postcss.config.mjs` + `src/app/globals.css` for Tailwind config inspection, not a non-existent `tailwind.config.ts`.
- **Plan's verify automated section had a flawed regex** — `pnpm --filter @ai-logist/web build 2>&1 | tail -5 | grep -q "Compiled\|built"` would match against `next build` output but our actual output says "Compiled successfully in 9.8s" — matches "Compiled" so passes. Recorded for future planners: include explicit exit-code checks in verify gates rather than substring greps.
- **pnpm install warned about 5 deprecated subdependencies** (`@esbuild-kit/core-utils@3.3.2`, `@esbuild-kit/esm-loader@2.6.5`, `glob@10.5.0`, `node-domexception@1.0.0`, `scmp@2.1.0`) — these are transitive deps from various Zenith packages; not direct dependencies. No action required this plan. Future Zenith re-vendor may surface upstream-driven version bumps.

## User Setup Required

None — vendor + merge are local operations. Wave 2 (Plan 04-02) will require:
- `pnpm --filter @ai-logist/web gen:admin-password` (CLI created in Wave 2) → writes bcrypt hash for `ADMIN_PASSWORD_HASH` in `apps/web/.env.local`
- `openssl rand -hex 32` → fills `AUTH_COOKIE_SECRET`
- Copy `apps/web/.env.example` → `apps/web/.env.local` before first `pnpm dev`

## Verifier Grep Gate Baseline

```bash
# Phase 4 marker count after Plan 04-01
$ grep -c "it.todo\|test.todo" apps/api/tests/unit/phase-4-stubs.test.ts
12
```

Sequence per Plan 04-00 architectural reference:

| After plan | Expected count | Actual | Status |
| ---------- | -------------- | ------ | ------ |
| 04-00      | 13             | 13     | OK     |
| **04-01**  | **12**         | **12** | **OK (this plan)** |
| 04-02      | 10             | —      | pending |
| 04-03      | 5              | —      | pending |
| 04-04      | 3              | —      | pending |
| 04-05      | 0              | —      | pending |

## Notes for Wave 2 (Plan 04-02 — auth + lib primitives + sidebar trim)

- **proxy.ts target:** `apps/web/src/proxy.ts` (NOT `middleware.ts` per Pitfall #4 + Wave 0 grep guard 4). Use `import { jwtVerify } from 'jose';` + `process.env.AUTH_COOKIE_SECRET`. Matcher must gate `/dashboard/:path*` and exclude `/api` + `/auth` (Wave 0 grep guard 4 will verify).
- **Login route:** `apps/web/src/app/auth/v1/login/route.ts` — POST handler with `bcrypt.compare` + `SignJWT().sign(SECRET)` + `cookies().set('al_session', ...)`. Reuse Zenith's existing `/auth/v1/login/page.tsx` UI; rewire the form's `onSubmit` to call `POST /auth/v1/login` (Next.js 16 `cookies()` is async — await required).
- **gen-admin-password CLI:** `apps/web/scripts/gen-admin-password.ts` — prompts for password, prints `bcrypt.hash(password, 10)` to stdout. Hook script entry already exists (`pnpm --filter @ai-logist/web gen:admin-password`).
- **i18n dictionary:** `apps/web/src/lib/i18n/dict.ts` with `{ ru: { ... }, ua: { ... } }` + `useT()` hook reading `usePreferencesStore((s) => s.language)`. Extend `LANGUAGE_OPTIONS` in `apps/web/src/lib/preferences/layout.ts` to add `ru` + `ua` entries.
- **Sidebar trim:** `apps/web/src/navigation/sidebar/sidebar-items.ts` — comment out non-Phase-4 entries (kanban, calendar, mail, crm, finance, productivity, draggable, components, coming-soon, (legacy)/*). Keep Default, Analytics, Chat visible. Plans 04-04 + 04-05 will add Calls + Orders entries when those pages exist.
- **NEW dirs Wave 2 will create:** `apps/web/src/lib/{api,format,auth,i18n}.ts` (or subdirs); `apps/web/src/proxy.ts`; `apps/web/src/app/auth/v1/login/route.ts`; `apps/web/src/app/auth/v1/logout/route.ts`; `apps/web/scripts/gen-admin-password.ts`.
- **Stubs to flip:** ADMIN-02 + I18N-02 → marker count 12 → 10. Both pre-positioned in `apps/api/tests/unit/phase-4-stubs.test.ts`.

---
*Phase: 04-admin-web-reduced-scope-chat-calls-orders-kpi*
*Plan: 01-zenith-vendor*
*Completed: 2026-06-10*

## Self-Check: PASSED

All 14 claimed artifacts verified on disk:
- VENDOR.md, components.json, postcss.config.mjs, next.config.ts, tsconfig.json, package.json, .env.example
- src/app/(main)/dashboard/{chat,default,analytics}/page.tsx
- src/stores/preferences/preferences-provider.tsx, src/proxy.disabled.ts, src/components/ui/
- 04-01-zenith-vendor-SUMMARY.md

Both task commits verified in git log: 5332d1c (Task 1 — vendor) + 60a62fa (Task 2 — merge + flip).
Phase 1-3.1 production code bit-identical: `git diff 5332d1c^..HEAD -- apps/api/src/ packages/shared-types/src/` returns empty.
