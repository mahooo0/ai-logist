---
phase: 04-admin-web-reduced-scope-chat-calls-orders-kpi
plan: 01
type: execute
wave: 1
depends_on: [04-00]
files_modified:
  - apps/web/src
  - apps/web/public
  - apps/web/components.json
  - apps/web/tailwind.config.ts
  - apps/web/postcss.config.mjs
  - apps/web/next.config.ts
  - apps/web/tsconfig.json
  - apps/web/package.json
  - apps/web/VENDOR.md
  - apps/web/app
  - apps/web/.env.example
  - pnpm-lock.yaml
  - apps/api/tests/unit/phase-4-stubs.test.ts
autonomous: true
requirements:
  - ADMIN-01

must_haves:
  truths:
    - "Zenith template (mahooo0/next-shadcn-admin-dashboard) is vendored straight into apps/web/ — directory layout per D-03 preserved (src/app/(main)/dashboard/<feature>/page.tsx + _components/<feature>-app.tsx)."
    - "apps/web/package.json merges Zenith dependencies with our scripts (next dev --turbopack -p 3001 PRESERVED) — Wave 0 vitest scripts retained + Wave 0 devDependencies retained."
    - "apps/web/VENDOR.md records exact Zenith git SHA + npm versions captured (Pitfall #1 — Zenith repo evolves, future plans cite SHA not 'latest')."
    - "Phase 1 placeholder apps/web/app/ removed — superseded by Zenith's apps/web/src/app/ layout."
    - "`pnpm install` from monorepo root succeeds; `pnpm --filter @ai-logist/web build` exits 0 with 6 dashboard pages reachable (default, analytics, chat, calls, orders, orders/[id])."
    - "`pnpm --filter @ai-logist/web exec tsc --noEmit` exits 0 — Zenith template typechecks against React 19 + Next.js 16 strict."
    - "5 static-rules guards from Wave 0 still GREEN after vendor (no 'use cache' / no bare border / no sync cookies / no 'use client' on page.tsx / proxy matcher placeholder OK)."
  artifacts:
    - path: "apps/web/src/app/(main)/dashboard"
      provides: "Zenith dashboard pages — default, analytics, chat, calls (NEW), orders (NEW), orders/[id] (NEW), plus untouched kanban/fleet/calendar/mail/crm/finance (D-48 — kept in build, hidden from nav)"
      contains: "default,analytics,chat"
    - path: "apps/web/src/components/ui"
      provides: "shadcn primitives — Card, Button, Dialog, Badge, Table, Input, etc."
      contains: "card,button,dialog"
    - path: "apps/web/VENDOR.md"
      provides: "Vendoring receipt: Zenith repo URL + git SHA + commit timestamp + dependency snapshot + Pitfall #1 audit notes"
      contains: "SHA,Zenith,git clone"
      min_lines: 25
    - path: "apps/web/package.json"
      provides: "Merged deps — Zenith additions + workspace shared-types + SWR + bcryptjs + jose"
      contains: "next,react,tailwindcss,swr,bcryptjs,jose,@ai-logist/shared-types"
    - path: "apps/web/next.config.ts"
      provides: "Zenith next config with our standalone output preserved"
      contains: "output"
    - path: "apps/web/.env.example"
      provides: "ADMIN_USERNAME + ADMIN_PASSWORD_HASH + AUTH_COOKIE_SECRET + API_INTERNAL_URL env vars documented"
      contains: "ADMIN_USERNAME,ADMIN_PASSWORD_HASH,AUTH_COOKIE_SECRET,API_INTERNAL_URL"
  key_links:
    - from: "Wave 2 auth (Plan 04-02)"
      to: "apps/web/src/app/auth/v1/login/page.tsx (Zenith) + proxy.ts (new)"
      via: "Zenith's existing login page rewires to our POST handler"
      pattern: "auth/v1/login"
    - from: "Wave 2 i18n hook (Plan 04-02)"
      to: "Zenith's usePreferencesStore"
      via: "VENDOR.md records the exact hook signature so useT() can call it without spelunking"
      pattern: "usePreferencesStore"
    - from: "Waves 4 + 5 (page rewires)"
      to: "Zenith's chat/default/analytics pages"
      via: "Plans 04-04 + 04-05 modify _components/<feature>-app.tsx to consume our SWR + apiGet helper"
      pattern: "_components"
---

<objective>
Replace the Phase 1 apps/web/ Next.js hello-world placeholder with the full Zenith Admin template (mahooo0/next-shadcn-admin-dashboard) via mechanical vendor + monorepo wire. This single fork transforms apps/web from a 1-page placeholder into a 30+ page admin dashboard whose data sources we rewire in Waves 4-5.

Purpose:
- Land the Zenith template as a single mechanical commit (D-01) — no edits beyond `package.json` merge. Keeps `git blame` legible ("this came from upstream Zenith" vs "this is our Phase 4 work").
- Pin Zenith versions exactly as cloned (D-04) — no `^latest` auto-bump.
- Record exact git SHA + dependency snapshot in `apps/web/VENDOR.md` (Pitfall #1 — Zenith evolves; future plans cite SHA).
- Audit Zenith for Next.js 16 + Tailwind v4 + Pitfall #13 trip-wires; document findings in VENDOR.md.
- Install Phase 4 NEW dependencies (swr + bcryptjs + jose + workspace shared-types) — wires Waves 2-5 against the right toolchain.
- Flip ADMIN-01 stub in phase-4-stubs (13 → 12) — the Zenith vendor lands the structural ground (apps/web/src/app/(main)/dashboard/<feature>/ tree, components.json, tailwind v4 config, shadcn primitives) which is what ADMIN-01 asserts. Marker chain: 13(W0) → 12(this plan W1) → 10(04-02 W2) → 5(04-03 W3 after API handlers) → 3(04-04 W3 after chat+calls) → 0(04-05 W3 after orders+KPI).

Output: Full Zenith template vendored under apps/web/src + apps/web/public; merged package.json; VENDOR.md receipt; .env.example updated; Phase 1 placeholder files removed.
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
@.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-00-test-infra-PLAN.md
@.planning/research/PITFALLS.md
@apps/web/package.json

<interfaces>
<!-- Current apps/web/package.json shape (post-Wave 0, pre-vendor): -->
<!--   name: @ai-logist/web -->
<!--   scripts.dev: "next dev --turbopack -p 3001"  -- MUST be preserved -->
<!--   scripts.test/test:watch/typecheck — Wave 0 added; MUST be preserved -->
<!--   dependencies: next@^16.0.0, react@^19.0.0, react-dom@^19.0.0 -->
<!--   devDependencies (Wave 0): vitest@^4, @testing-library/react@^16, @testing-library/dom@^10, happy-dom@^15, @types/react@^19, @types/react-dom@^19 -->

<!-- Zenith template package.json shape (live as of 2026-06-10 — RESEARCH §Standard Stack): -->
<!--   name: studio-admin → MUST be renamed to @ai-logist/web -->
<!--   Dependencies confirmed: next@^16.2.4, react@^19.2.5, tailwindcss@^4.1.5, -->
<!--     @tailwindcss/postcss@^4.2.4, shadcn@^4.6.0, radix-ui@^1.4.3, -->
<!--     zustand@^5.0.12, react-hook-form@^7.75.0, zod@^4.4.2, sonner@^2.0.7, -->
<!--     lucide-react@^1.14.0, recharts@^3.8.0, @tanstack/react-table@^8.21.3, -->
<!--     date-fns@^4.1.0, libphonenumber-js@^1.12.42, next-themes@^0.4.6, -->
<!--     tw-animate-css@^1.4.0, @dnd-kit/{core,sortable,modifiers}, react-day-picker, embla-carousel, etc. -->
<!--   Zenith dev deps: husky + lint-staged + prepare script — DROP (root Biome covers this) -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Clone Zenith + capture VENDOR.md receipt + bulk-copy template into apps/web/</name>
  <files>
    apps/web/src,
    apps/web/public,
    apps/web/components.json,
    apps/web/tailwind.config.ts,
    apps/web/postcss.config.mjs,
    apps/web/next.config.ts,
    apps/web/tsconfig.json,
    apps/web/VENDOR.md,
    apps/web/app
  </files>
  <read_first>
    apps/web/package.json,
    apps/web/next.config.ts,
    apps/web/app/page.tsx,
    apps/web/app/layout.tsx,
    .planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-RESEARCH.md,
    .planning/research/PITFALLS.md
  </read_first>
  <action>
Step 1 — Clone Zenith to a temp dir and capture metadata:

```bash
mkdir -p /tmp/ai-logist-vendor
cd /tmp/ai-logist-vendor
rm -rf zenith
git clone --depth 1 https://github.com/mahooo0/next-shadcn-admin-dashboard.git zenith
cd zenith
ZENITH_SHA=$(git rev-parse HEAD)
ZENITH_DATE=$(git log -1 --format=%cI)
echo "Cloned Zenith @ $ZENITH_SHA (committed $ZENITH_DATE)"
```

Step 2 — Remove Phase 1 placeholder files BEFORE copy (D-01 step 2 — Zenith uses `src/app/`, our Phase 1 placeholder used `app/`):

```bash
cd /Users/muhemmedibrahimov/Documents/holy-water/ai-logist
rm -rf apps/web/app                # Phase 1 placeholder (page.tsx, layout.tsx)
rm -f  apps/web/next-env.d.ts      # auto-regenerated by Next on next build
```

Step 3 — Bulk-copy Zenith contents (D-01 step 2). Copy these specifically (NOT a full directory copy — we keep our own package.json + tsconfig.json from Phase 1 as a base for merging):

```bash
ZENITH_DIR=/tmp/ai-logist-vendor/zenith

# Source code + public assets — straight copies
cp -R $ZENITH_DIR/src apps/web/src
cp -R $ZENITH_DIR/public apps/web/public

# Config files — straight copies (D-01: pin exactly as cloned per D-04)
cp $ZENITH_DIR/components.json     apps/web/components.json
cp $ZENITH_DIR/tailwind.config.ts  apps/web/tailwind.config.ts 2>/dev/null || \
  cp $ZENITH_DIR/tailwind.config.js apps/web/tailwind.config.ts
cp $ZENITH_DIR/postcss.config.mjs  apps/web/postcss.config.mjs

# next.config.ts — MERGE manually (Task 2 will overwrite if needed; capture Zenith's first)
cp $ZENITH_DIR/next.config.ts      apps/web/next.config.ts.zenith

# tsconfig.json — Zenith strict + path alias '@/' → 'src/'; capture for merge in Task 2
cp $ZENITH_DIR/tsconfig.json       apps/web/tsconfig.json.zenith

# Capture Zenith's package.json verbatim for the merge in Task 2
cp $ZENITH_DIR/package.json        apps/web/package.json.zenith
```

Step 4 — Merge `next.config.ts` (preserve Phase 1's `output: 'standalone'` for Docker, layer Zenith config on top):

Read both files. The MERGED `apps/web/next.config.ts` MUST contain:
- All of Zenith's config (typically `experimental`, `images`, `webpack`, etc.)
- Phase 1 addition: `output: 'standalone'` (top-level — required by apps/web/Dockerfile)
- No CommonJS — pure ESM (`export default { ... }`)
- TypeScript: `import type { NextConfig } from 'next';` + `const nextConfig: NextConfig = { ... };`

If Zenith's `next.config.ts` lacks `output: 'standalone'`, add it. If Zenith uses `cacheComponents: true` to enable `'use cache'` directive, KEEP it (D-13 allows analytics/default to opt-in cached) — but verify CI grep guard from Wave 0 still passes on chat/calls/orders.

Step 5 — Merge `tsconfig.json` (preserve monorepo workspace refs, layer Zenith strict on top):

The merged `apps/web/tsconfig.json` MUST contain:
- Extends: Zenith's compilerOptions (strict, target, lib, module, paths) — preserve `"@/*": ["./src/*"]`
- Add (monorepo): `"references": [{ "path": "../../packages/shared-types" }]`
- Include: `"src/**/*", "tests/**/*", "vitest.config.ts", ".next/types/**/*"`
- Exclude: `"node_modules", ".next", "dist"`
- TypeScript version: `"typescript": "^5.9.3"` (Zenith pins; matches RESEARCH)

Step 6 — Remove the `.zenith` capture files (cleanup):

```bash
rm apps/web/next.config.ts.zenith apps/web/tsconfig.json.zenith
# package.json.zenith retained for Task 2 (deleted at end of Task 2)
```

Step 7 — Create `apps/web/VENDOR.md` (Pitfall #1 — record exact SHA so future plans cite truth):

```markdown
# apps/web — Zenith Admin Vendor Receipt

**Vendored:** 2026-06-10 (Phase 4, Plan 04-01)
**Source:** https://github.com/mahooo0/next-shadcn-admin-dashboard
**Git SHA:** {ZENITH_SHA}
**Source commit date:** {ZENITH_DATE}
**License:** MIT (permits vendoring per D-02)

## Files copied verbatim from Zenith
- `apps/web/src/` (full source tree)
- `apps/web/public/` (static assets)
- `apps/web/components.json` (shadcn config)
- `apps/web/tailwind.config.ts` (Tailwind v4 PostCSS config)
- `apps/web/postcss.config.mjs`
- `apps/web/next.config.ts` (merged with our `output: 'standalone'`)
- `apps/web/tsconfig.json` (merged with monorepo workspace references)

## Files NOT copied / dropped from Zenith
- `husky`, `lint-staged`, `prepare` script (Pitfall #3 — replaced by root Biome)
- Zenith's `package.json` `name` (we keep `@ai-logist/web`)
- Zenith's `pnpm-lock.yaml` (root lockfile is authoritative)
- `proxy.disabled.ts` artifact (Zenith ships this as an example — Wave 2 creates real `proxy.ts`)

## Zenith preferences store hook signature (Pitfall #1 — Open Question #1 resolved)
File: `apps/web/src/stores/preferences/preferences-provider.tsx`
Hook export: `usePreferencesStore` (Zustand hook)
Field names (relevant to Phase 4): `<EXTRACT THIS VERBATIM FROM THE FILE — see Task 1 sub-step 8 below>`

## Sidebar config file location
File: `apps/web/src/navigation/sidebar/sidebar-items.ts`
Modified by: Wave 2 Plan 04-02 (D-49 — comment out non-Phase-4 entries)

## Chat page structure (Zenith)
File: `apps/web/src/app/(main)/dashboard/chat/page.tsx`
Convention: page.tsx is Server Component, `_components/chat-app.tsx` is `'use client'`
Modified by: Wave 4 Plan 04-04 (D-20..D-24 — rewire to our UNION API + audio player + intercept controls)

## Pitfall #13 audit (Tailwind v4 + Next.js 16 + shadcn)
- [ ] Tailwind v4 default border = `currentColor` (D-58) — Zenith template uses `border-border` consistently. CI grep guard from Wave 0 (Plan 04-00) re-runs after every Wave.
- [ ] Next.js 16 async `cookies()`/`headers()`/`searchParams`/`params` (Pitfall #2) — audited via grep. Findings: `<FILL IN>`
- [ ] No `'use cache'` on chat/calls/orders pages (D-12) — pre-Wave-2 Zenith DOES NOT yet have our calls/orders/orders[id] pages. Verified `grep -rE "'use cache'" src/app/\(main\)/dashboard/chat` returns empty.
- [ ] `border-border` explicit (D-58) — Wave 0 grep guard passes against Zenith default.
- [ ] `page.tsx server / _components/* client` (D-03 + D-59) — verified via grep: `'use client'` only appears in `_components/*` files, never in `page.tsx`.

## Pitfall #4 — `middleware.ts` vs `proxy.ts` (Next.js 16)
Zenith ships `proxy.disabled.ts` as scaffolding. We will create `apps/web/src/proxy.ts` in Wave 2 (Plan 04-02) per RESEARCH recommendation (Next.js 16 native convention). NO `middleware.ts` will be created.

## Dependencies snapshot (versions at vendor time)
{Copy the dependencies + devDependencies tables from /tmp/ai-logist-vendor/zenith/package.json verbatim — Task 2 will reference this snapshot in the merged package.json}

## Re-vendoring procedure
To upgrade Zenith in the future:
1. `cd /tmp && git clone --depth 1 <url> zenith-new`
2. `diff -r /tmp/zenith-new/src apps/web/src` — review breaking changes
3. Run all Phase 4 tests after copy: `pnpm -r test`
4. Update this file's `Git SHA` + `Source commit date`
```

Step 8 — Extract Zenith's `usePreferencesStore` hook signature (resolves RESEARCH Open Question #1). Read `apps/web/src/stores/preferences/preferences-provider.tsx` (or the closest equivalent under `apps/web/src/stores/`). Capture VERBATIM into VENDOR.md the export name + the field shape (e.g. `{ theme: 'light' | 'dark'; language: 'en' | 'ru' | 'ua'; ... }`).

Commit message: `feat(04-01): vendor mahooo0/next-shadcn-admin-dashboard@{SHA short} into apps/web/`.
  </action>
  <verify>
    <automated>
test -d apps/web/src/app && \
test -d apps/web/src/components/ui && \
test -d apps/web/src/app/\(main\)/dashboard && \
test -f apps/web/src/app/\(main\)/dashboard/chat/page.tsx && \
test -f apps/web/src/app/\(main\)/dashboard/default/page.tsx && \
test -f apps/web/src/app/\(main\)/dashboard/analytics/page.tsx && \
test -f apps/web/components.json && \
test -f apps/web/tailwind.config.ts && \
test -f apps/web/postcss.config.mjs && \
test -f apps/web/next.config.ts && \
test -f apps/web/VENDOR.md && \
! test -d apps/web/app && \
grep -q "output: 'standalone'" apps/web/next.config.ts && \
grep -q "Git SHA" apps/web/VENDOR.md && \
grep -q "usePreferencesStore" apps/web/VENDOR.md && \
grep -q "MIT" apps/web/VENDOR.md
    </automated>
  </verify>
  <acceptance_criteria>
    - Directory exists: `apps/web/src/app/(main)/dashboard/` with at minimum: chat, default, analytics subdirs (Zenith ships these)
    - Directory exists: `apps/web/src/components/ui/` with shadcn primitives (card.tsx, button.tsx, dialog.tsx, etc.)
    - File exists: `apps/web/components.json` (shadcn config)
    - File exists: `apps/web/tailwind.config.ts` (Tailwind v4 config)
    - File exists: `apps/web/postcss.config.mjs`
    - File exists: `apps/web/next.config.ts` AND it contains the literal string `output: 'standalone'`
    - File exists: `apps/web/tsconfig.json` AND it contains `"@/*"` path alias
    - File exists: `apps/web/VENDOR.md` with sections: "Git SHA", "License", "Files copied verbatim", "Pitfall #13 audit", "Re-vendoring procedure", "Zenith preferences store hook signature"
    - Phase 1 placeholder removed: `! test -d apps/web/app` (legacy `app/` dir gone — Zenith uses `src/app/`)
    - `apps/web/VENDOR.md` records actual `usePreferencesStore` export name + field shape (resolves RESEARCH Open Question #1)
    - No `.zenith` capture files remain in apps/web/
  </acceptance_criteria>
  <done>
Zenith template vendored, VENDOR.md receipt locked, Phase 1 placeholder removed. apps/web/ directory layout now matches D-03 (src/app/(main)/dashboard/<feature>/page.tsx + _components/<feature>-app.tsx).
  </done>
</task>

<task type="auto">
  <name>Task 2: Merge package.json + install Phase 4 deps + update .env.example + build smoke</name>
  <files>
    apps/web/package.json,
    apps/web/.env.example,
    pnpm-lock.yaml
  </files>
  <read_first>
    apps/web/package.json,
    apps/web/package.json.zenith,
    .env.example,
    .planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-RESEARCH.md,
    .planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-CONTEXT.md
  </read_first>
  <action>
Step 1 — Merge `apps/web/package.json` (Pitfall #3 — KEEP our scripts, ADD Zenith deps, DROP husky/lint-staged):

Read `apps/web/package.json` (post-Wave 0) and `apps/web/package.json.zenith` (Zenith capture from Task 1). Produce the merged file with this exact shape:

```json
{
  "name": "@ai-logist/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --turbopack -p 3001",
    "build": "next build",
    "start": "next start -p 3001",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "gen:admin-password": "tsx scripts/gen-admin-password.ts"
  },
  "dependencies": {
    "@ai-logist/shared-types": "workspace:*",
    "next": "<COPY EXACT VERSION FROM ZENITH>",
    "react": "<COPY EXACT VERSION FROM ZENITH>",
    "react-dom": "<COPY EXACT VERSION FROM ZENITH>",
    "tailwindcss": "<COPY EXACT VERSION FROM ZENITH>",
    "@tailwindcss/postcss": "<COPY EXACT VERSION FROM ZENITH>",
    "tw-animate-css": "<COPY EXACT VERSION FROM ZENITH>",
    "zustand": "<COPY>",
    "react-hook-form": "<COPY>",
    "@hookform/resolvers": "<COPY>",
    "zod": "<COPY — must be ^4 to match apps/api>",
    "sonner": "<COPY>",
    "lucide-react": "<COPY>",
    "recharts": "<COPY ^3.x>",
    "@tanstack/react-table": "<COPY>",
    "date-fns": "<COPY ^4>",
    "libphonenumber-js": "<COPY>",
    "next-themes": "<COPY>",
    "radix-ui": "<COPY>",
    "swr": "^2.4.1",
    "bcryptjs": "^3.0.3",
    "jose": "^6.2.3",
    "<ALL OTHER ZENITH dependencies copied verbatim — @dnd-kit/*, react-day-picker, embla-carousel, react-resizable-panels, simple-icons, geist, etc.>": "<COPY>"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "<COPY ^19>",
    "@types/react-dom": "<COPY ^19>",
    "@types/bcryptjs": "<latest>",
    "typescript": "<COPY ^5.9.3 from Zenith>",
    "tsx": "<COPY from Zenith or add ^4.20>",
    "vitest": "^4.1.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/dom": "^10.0.0",
    "happy-dom": "^15.0.0",
    "<ALL OTHER ZENITH devDependencies (NOT husky, NOT lint-staged)>": "<COPY>"
  }
}
```

DROP these from Zenith's package.json:
- `"husky"` (dev) — Pitfall #3
- `"lint-staged"` (dev) — Pitfall #3
- `"prepare": "husky"` script — Pitfall #3
- Zenith's name `"studio-admin"` — keep `@ai-logist/web`
- Zenith's `"dev"` script if it differs from `"next dev --turbopack -p 3001"` — we keep our port 3001

KEEP from Zenith (verbatim):
- Every entry in `dependencies` (sans the dropped items above)
- Every entry in `devDependencies` (sans husky/lint-staged)
- Zenith's `engines`, `packageManager`, `volta` fields if present

ADD on top:
- `"@ai-logist/shared-types": "workspace:*"` in dependencies (D-18)
- `"swr": "^2.4.1"` in dependencies (D-11 / RESEARCH §New deps)
- `"bcryptjs": "^3.0.3"` in dependencies (D-05)
- `"jose": "^6.2.3"` in dependencies (D-06)
- `"@types/bcryptjs"` in devDependencies (TS types)
- `"gen:admin-password": "tsx scripts/gen-admin-password.ts"` in scripts (D-66)
- Preserve Wave 0 entries: `vitest@^4.1.0`, `@testing-library/react@^16.0.0`, `@testing-library/dom@^10.0.0`, `happy-dom@^15.0.0`

Step 2 — Delete the capture file:
```bash
rm apps/web/package.json.zenith
```

Step 3 — Run `pnpm install` from monorepo root:
```bash
cd /Users/muhemmedibrahimov/Documents/holy-water/ai-logist
pnpm install
```

If `pnpm install` fails due to peer-dep conflict, document the conflict + resolution in VENDOR.md "Pitfall #13 audit" section. Common fix: bump a specific Zenith dep up to the next minor (e.g. `radix-ui@^1.4.4` if it pins a peer too tight). Document any version bump applied.

Step 4 — Update `.env.example` (D-66 — add Phase 4 web env vars):

Read current `.env.example` (project root) and append:
```
# Phase 4 — apps/web admin auth + API base
ADMIN_USERNAME=admin
# Generate hash via: pnpm --filter @ai-logist/web gen:admin-password
ADMIN_PASSWORD_HASH=
# 32-byte hex random — generate via: openssl rand -hex 32
AUTH_COOKIE_SECRET=
# Server-Component fetch base (docker-compose internal hostname)
API_INTERNAL_URL=http://api:3000
```

Also create `apps/web/.env.example` (apps/web-local convention — Next.js auto-loads `apps/web/.env.local` in dev):
```
# Local dev (apps/web/.env.local)
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=
AUTH_COOKIE_SECRET=
API_INTERNAL_URL=http://localhost:3000
```

Step 5 — Smoke build:
```bash
pnpm --filter @ai-logist/web exec tsc --noEmit
pnpm --filter @ai-logist/web build
```

Document any errors + fixes in VENDOR.md. Expected: build exits 0 with all Zenith pages compiling. If a page references a hook that doesn't exist (e.g. due to Zenith dep version drift), pin that dep to the next minor and re-run.

Step 6 — Re-run Wave 0 tests to confirm static-rules guards still pass against post-vendor state:
```bash
pnpm --filter @ai-logist/web test
```
Expected: 5 passing + 16 todo. If a guard fires (e.g. Zenith inadvertently uses `'use cache'` somewhere in chat/calls/orders), surface it and remove the offending directive in this task (D-12 + RESEARCH §Risks).

Step 7 — Flip ADMIN-01 partial in `apps/api/tests/unit/phase-4-stubs.test.ts`. Replace:
```ts
it.todo('ADMIN-01: Zenith template vendored into apps/web/ with workspace shared-types ref + 6 dashboard pages exist');
```
With a real it() block:
```ts
it('ADMIN-01: Zenith template vendored into apps/web/ + workspace shared-types ref + 6 dashboard pages exist', async () => {
  // Structural proof — paths verified at test time
  const { existsSync } = await import('node:fs');
  const cwd = process.cwd();
  expect(existsSync(`${cwd}/../web/src/app/(main)/dashboard/chat/page.tsx`)).toBe(true);
  expect(existsSync(`${cwd}/../web/src/app/(main)/dashboard/default/page.tsx`)).toBe(true);
  expect(existsSync(`${cwd}/../web/src/app/(main)/dashboard/analytics/page.tsx`)).toBe(true);
  expect(existsSync(`${cwd}/../web/VENDOR.md`)).toBe(true);
  // Calls + orders dirs are CREATED in Wave 4/5 — assertion deferred.
  const { readFileSync } = await import('node:fs');
  const webPkg = JSON.parse(readFileSync(`${cwd}/../web/package.json`, 'utf8'));
  expect(webPkg.dependencies['@ai-logist/shared-types']).toBe('workspace:*');
  expect(webPkg.dependencies.swr).toMatch(/^\^?2/);
  expect(webPkg.dependencies.bcryptjs).toMatch(/^\^?3/);
  expect(webPkg.dependencies.jose).toMatch(/^\^?6/);
});
```
Marker count: 13 → 12.

Commit message: `feat(04-01): merge Zenith package.json + install swr/bcryptjs/jose + update .env.example`.
  </action>
  <verify>
    <automated>
test -f apps/web/package.json && \
grep -q '"@ai-logist/shared-types": "workspace:\*"' apps/web/package.json && \
grep -q '"swr"' apps/web/package.json && \
grep -q '"bcryptjs"' apps/web/package.json && \
grep -q '"jose"' apps/web/package.json && \
grep -q '"vitest"' apps/web/package.json && \
! grep -q '"husky"' apps/web/package.json && \
! grep -q '"lint-staged"' apps/web/package.json && \
grep -q "next dev --turbopack -p 3001" apps/web/package.json && \
grep -q "ADMIN_USERNAME" .env.example && \
grep -q "AUTH_COOKIE_SECRET" .env.example && \
grep -q "API_INTERNAL_URL" .env.example && \
test -f apps/web/.env.example && \
pnpm --filter @ai-logist/web exec tsc --noEmit 2>&1 | tail -1 | grep -qE "^$|error TS" -v 2>/dev/null; \
pnpm --filter @ai-logist/web build 2>&1 | tail -5 | grep -q "Compiled\|built" && \
cd apps/api && pnpm test:unit -t "Phase 4" 2>&1 | grep -E "1 passed|12 todo"
    </automated>
  </verify>
  <acceptance_criteria>
    - `apps/web/package.json` `name` is `"@ai-logist/web"` (NOT `studio-admin`)
    - `apps/web/package.json` scripts.dev contains `next dev --turbopack -p 3001`
    - `apps/web/package.json` dependencies contain ALL of: `@ai-logist/shared-types`, `next`, `react`, `react-dom`, `tailwindcss`, `swr`, `bcryptjs`, `jose`, `zustand`, `react-hook-form`, `zod`, `sonner`, `lucide-react`, `recharts`, `@tanstack/react-table`, `date-fns`, `libphonenumber-js`, `radix-ui`
    - `apps/web/package.json` dependencies field DOES NOT contain `husky` or `lint-staged`
    - `apps/web/package.json` scripts contain: `"test": "vitest run"`, `"typecheck": "tsc --noEmit"`, `"gen:admin-password"` (preserves Wave 0 scripts + adds D-66 CLI)
    - `.env.example` (root) contains all 4 new env vars: `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `AUTH_COOKIE_SECRET`, `API_INTERNAL_URL`
    - `apps/web/.env.example` exists with same 4 vars
    - `apps/web/package.json.zenith` capture file DOES NOT exist (deleted)
    - `pnpm --filter @ai-logist/web exec tsc --noEmit` exits 0 with no errors
    - `pnpm --filter @ai-logist/web build` exits 0 (Next.js compiles all Zenith pages)
    - `pnpm --filter @ai-logist/web test` exits 0 with 5 passing + 16 todo (Wave 0 guards still green)
    - `cd apps/api && pnpm test:unit` shows 12 todo markers for "Phase 4" (down from 13 — ADMIN-01 flipped)
    - `pnpm-lock.yaml` updated (root lockfile reflects new deps)
  </acceptance_criteria>
  <done>
package.json merged (Zenith deps + ours), .env.example documents Phase 4 vars, build + typecheck green, Wave 0 guards re-pass, ADMIN-01 stub flipped. Ready for Wave 2 auth wiring.
  </done>
</task>

</tasks>

<verification>
- `pnpm --filter @ai-logist/web build` exits 0
- `pnpm --filter @ai-logist/web exec tsc --noEmit` exits 0
- `pnpm --filter @ai-logist/web test` exits 0 (5 passing, 16 todo)
- `cd apps/api && pnpm test:unit -t "Phase 4"` shows 12 todo (1 fewer than Wave 0 — ADMIN-01 flipped)
- `apps/web/VENDOR.md` documents exact Zenith SHA + dependency snapshot
- Phase 1 placeholder removed: `! test -d apps/web/app`
- Phase 1-3.1 backend source untouched: `git diff apps/api/src/` returns empty
</verification>

<success_criteria>
- Zenith template fully vendored — all dashboard pages compile, shadcn primitives available, Tailwind v4 + Next.js 16 build green
- package.json merged with Phase 4 NEW deps (swr + bcryptjs + jose + workspace shared-types) without breaking Wave 0 setup
- VENDOR.md receipt locks the exact Zenith SHA (Pitfall #1 mitigation)
- Pitfall #13 audit recorded in VENDOR.md ('use cache' / border-border / 'use client' on page.tsx / proxy.ts naming)
- Open Question #1 (Zenith usePreferencesStore signature) resolved + documented for Wave 2
- ADMIN-01 stub marker flipped from todo to passing it() block — count down to 12
</success_criteria>

<output>
After completion, create `.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-01-SUMMARY.md` summarizing:
- Zenith git SHA vendored
- Total file count added (apps/web/src + apps/web/public size)
- Dependencies added (swr/bcryptjs/jose + workspace shared-types) + dropped (husky/lint-staged)
- Pitfall #13 audit findings (use cache hits / border-border audit / cookies sync usage)
- Open Question #1 resolution: usePreferencesStore hook signature recorded
- Marker count: 13 → 12 (ADMIN-01 flipped)
- Notes for Wave 2 (Plan 04-02) — proxy.ts + auth + lib primitives + sidebar trim
</output>
