---
phase: 01-database-backend-skeleton
plan: 01
subsystem: monorepo-skeleton
tags: [pnpm, workspaces, typescript, biome, esm, shared-types, wave-1]

# Dependency graph
requires:
  - phase: 01-database-backend-skeleton
    plan: 00
    provides: "apps/api/ stub package (Vitest 4 + testcontainers), Wave 0 test todos"
provides:
  - "pnpm-workspaces monorepo with three workspace projects (apps/api, apps/web placeholder, packages/shared-types)"
  - "Shared TypeScript 5.9 strict config via tsconfig.base.json (NodeNext ESM, noUncheckedIndexedAccess)"
  - "Shared Biome 2.4.16 lint+format config (single-quote, 100 line width, recommended rules)"
  - "@ai-logist/shared-types empty Zod barrel package, resolves via workspace:* protocol"
  - ".env.example matching D-15 minimal Phase 1 env vars"
  - "Root package.json scripts (dev, build, lint, tsc, test, db:migrate, seed, compose:*)"
affects: ["01-02-infrastructure (docker-compose builds on these scripts)", "01-03-drizzle-setup (uses apps/api/tsconfig.json + drizzle-kit)", "01-07-fastify-skeleton (consumes @ai-logist/shared-types DTOs)", "all downstream phases (shared TS + Biome config)"]

# Tech tracking
tech-stack:
  added:
    - "@biomejs/biome 2.4.16 (root devDependency, replaces ESLint+Prettier)"
    - "typescript 5.9.3 (root devDependency — caret ^5.7.0 resolved latest 5.x)"
    - "tsx 4.22.4 (root devDependency)"
    - "vitest 4.1.8 (root devDependency, hoisted from Wave 0)"
    - "zod ^4.4.3 (packages/shared-types dependency — empty barrel for now)"
  patterns:
    - "ESM everywhere (`type: module`) on root + every workspace package"
    - "Shared tsconfig via `extends: '../../tsconfig.base.json'`"
    - "Shared biome.json at root (each workspace inherits via path)"
    - "workspace:* protocol for cross-package resolution (Pitfall #6 — prevents ENOENT at runtime)"
    - "Drop tsconfig rootDir when include spans src/ + tests/ + config files (avoids TS6059)"
    - "Forward-looking devDeps shimmed with @ts-expect-error until producer plan lands them"

key-files:
  created:
    - "package.json (root: pnpm 9.15 packageManager, full script set)"
    - "pnpm-workspace.yaml (apps/* + packages/*)"
    - "tsconfig.base.json (shared strict TS config)"
    - "biome.json (shared lint+format config — migrated to 2.4.16 schema)"
    - ".gitignore (extended with .pnpm-store/, .next/, .vitest-cache/)"
    - ".nvmrc (Node 22)"
    - ".env.example (Phase 1 minimal env per D-15)"
    - "apps/api/tsconfig.json (extends base, paths shim for shared-types)"
    - "packages/shared-types/package.json (workspace:* consumer entry)"
    - "packages/shared-types/tsconfig.json (extends base, dist/ outDir)"
    - "packages/shared-types/src/index.ts (empty barrel, exports SHARED_TYPES_VERSION)"
    - "pnpm-lock.yaml (root, replaces apps/api/pnpm-lock.yaml)"
  modified:
    - "apps/api/package.json (added dependencies.@ai-logist/shared-types=workspace:*)"
    - "apps/api/tests/_helpers/test-db.ts (added @ts-expect-error on dynamic pg/drizzle imports — Plan 01-04 will remove them)"
    - ".gitignore (Plan 01-00 had a minimal version; expanded per plan)"
  deleted:
    - "apps/api/pnpm-lock.yaml (stale --ignore-workspace lockfile from Plan 01-00; root lockfile is now authoritative)"

key-decisions:
  - "TypeScript 5.9.3 (not 5.7.x): caret ^5.7.0 resolved to latest 5.x; matches Plan 01-00's installed version. Plan's verify expected 'Version 5.7.x' literally — relaxed to 'Version 5.x' since 5.9 is a non-breaking minor."
  - "Biome 2.4.16 schema migration: plan's biome.json used the 2.4.0 schema (`files.ignore` array, `noConsoleLog` rule key). Biome 2.4.16 CLI requires the 2.4.16 schema (`files.includes` with negative globs, `noConsole` rule with options). Ran `biome migrate --write` then hand-fixed `useBiomeIgnoreFolder` warning (drop trailing `/**` from folder ignores)."
  - "Dropped `rootDir: ./src` from apps/api/tsconfig.json — `include: [src/**/*, tests/**/*, drizzle.config.ts]` matched files outside rootDir, causing TS6059. Removing rootDir lets TS infer it from include, while outDir continues to drive emit layout."
  - "Added @ts-expect-error on `await import('pg')` and `await import('drizzle-orm/node-postgres')` in tests/_helpers/test-db.ts. Plan 01-00 SUMMARY described those as a 'dynamic-import shim,' but TypeScript still resolves the module specifier at compile time. Plan 01-04 installs the deps and removes the directives."
  - "Removed stale apps/api/pnpm-lock.yaml — Plan 01-00 produced it via `--ignore-workspace` explicitly until 01-01 shipped `pnpm-workspace.yaml`. Per Plan 01-00 SUMMARY's 'Notes for Next Plan,' this was expected."

patterns-established:
  - "Workspace contract: every package extends tsconfig.base.json and uses workspace:* for cross-package resolution"
  - "Forward-looking dependency shim: when a test/util file imports a dep that a later plan will install, gate with @ts-expect-error + dynamic import so the current plan's tsc passes"
  - "Schema-version pinning: when Biome / Drizzle / similar tools require schema versions match the CLI, use the tool's `migrate` subcommand on bump"

requirements-completed:
  - "DEPLOY-02 (ENV via Node 22 --env-file)"
  - "DEPLOY-03 (pnpm workspaces monorepo)"

# Metrics
duration: ~5m46s
completed: 2026-06-09
---

# Phase 01 Plan 01: Monorepo Skeleton Summary

**pnpm workspaces monorepo with TS 5.9 strict + Biome 2.4.16 + ESM everywhere; `@ai-logist/shared-types` empty Zod barrel resolves via `workspace:*` from `apps/api`; `pnpm exec tsc --noEmit` and `pnpm exec biome check` (skeleton files) both pass; Wave 0 vitest todos still green (17/17).**

## Performance

- **Duration:** ~5m46s (346 s)
- **Started:** 2026-06-09T05:11:28Z
- **Completed:** 2026-06-09T05:17:14Z (approx)
- **Tasks:** 2 / 2
- **Files created:** 12
- **Files modified:** 3
- **Files deleted:** 1

## Accomplishments

- Root pnpm workspace is configured per D-10 — three packages discovered (`apps/api`, `apps/web` will be created in Wave 2, `packages/shared-types`).
- TypeScript 5.9 strict + ESM (`type: module`) wired via shared `tsconfig.base.json`; both `apps/api` and `packages/shared-types` extend it and both `tsc --noEmit` cleanly.
- Biome 2.4.16 installed at root and configured (single-quote, 100 line width, ES5 trailing commas, semicolons-always). All seven skeleton files plus the four new Task 2 files lint clean.
- `@ai-logist/shared-types` empty barrel package created; `pnpm --filter @ai-logist/shared-types build` emits `dist/index.js`; `apps/api/node_modules/@ai-logist/shared-types → ../../../../packages/shared-types` symlink confirms `workspace:*` resolution (Pitfall #6 defused).
- `.env.example` written per D-15 — matches `DATABASE_URL`, `REDIS_URL`, `NODE_ENV`, `PORT`, `HOST`, `LOG_LEVEL`, `DB_PASSWORD`, `VERSION` with LLM/Telegram secrets commented out for Phase 2/3.
- Root `package.json` scripts cover the full `pnpm install` → `pnpm db:migrate` → `pnpm seed` → `pnpm dev` README flow that D-23 mandates.
- Wave 0 vitest todos still green (17/17 reported, exit 0).

## Task Commits

Each task was committed atomically:

1. **Task 1: Root scaffolding** — `04e4fe5` (chore)
2. **Task 2: packages/shared-types + apps/api tsconfig** — `59f333f` (feat)

_Plan metadata commit will follow this SUMMARY._

## `pnpm install` results

```
Scope: all 3 workspace projects
Progress: resolved 290, reused 234, downloaded 0, added 1, done

devDependencies (root):
+ @biomejs/biome 2.4.16
+ tsx 4.22.4
+ typescript 5.9.3 (6.0.3 is available)
+ vitest 4.1.8

WARN  1 deprecated subdependencies found: glob@10.5.0
```

## Final `apps/api/package.json` shape

Wave 0 devDependencies preserved; new `dependencies.@ai-logist/shared-types = workspace:*` added:

```json
{
  "name": "@ai-logist/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:unit": "vitest run --project unit",
    "test:integration": "vitest run --project integration",
    "test:smoke": "vitest run --project smoke",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@ai-logist/shared-types": "workspace:*"
  },
  "devDependencies": {
    "vitest": "^4.1.0",
    "@vitest/coverage-v8": "^4.1.0",
    "@testcontainers/postgresql": "^12.0.1",
    "testcontainers": "^12.0.1",
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0"
  }
}
```

## Verification Results

| Check | Result |
|-------|--------|
| `pnpm install` at repo root | OK — 3 workspace projects, 1 new package (`shared-types` linked), no ENOENT |
| `pnpm exec biome --version` | `2.4.16` |
| `pnpm exec tsc --version` | `Version 5.9.3` (caret resolved newest 5.x) |
| `pnpm exec tsc --noEmit -p apps/api/tsconfig.json` | exit 0 |
| `pnpm exec tsc --noEmit -p packages/shared-types/tsconfig.json` | exit 0 |
| `pnpm exec biome check` on the 7 skeleton files + 4 Task 2 files | 11 files checked, 0 errors |
| `pnpm --filter @ai-logist/shared-types build` | exit 0 — `dist/index.js` emitted |
| `apps/api/node_modules/@ai-logist/shared-types` | symlink → `../../../../packages/shared-types` (workspace:* OK) |
| `cd apps/api && pnpm exec vitest run` | `17 todo (17)`, exit 0 (Wave 0 still green) |
| `.env.example` contains `DATABASE_URL=postgresql://ailogist:ailogist@localhost:5432/ailogist?sslmode=disable` | OK |
| `.nvmrc` contains `22` | OK |
| `grep -q "@ai-logist" package.json` | OK |
| `grep -q "apps/\*" pnpm-workspace.yaml` | OK |
| `grep -q "workspace:\*" apps/api/package.json` | OK |

## Decisions Made

1. **TypeScript 5.9.3 (not 5.7.x literally).** Plan acceptance criterion #5 said "starting with `Version 5.7`," but the caret in `package.json` resolves to the latest minor in the 5.x line, which is 5.9.3. Plan 01-00 already installed 5.9.3 inside `apps/api/`, so we kept the same version at root for consistency. No breaking changes between 5.7 and 5.9 for the rules we care about (`strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`).
2. **Biome schema migration.** Plan's biome.json used the 2.4.0 schema, but the CLI installed at 2.4.16 rejected it. Used `biome migrate --write` to convert `files.ignore` → `files.includes` (negative globs) and `noConsoleLog` → `noConsole`. Then dropped trailing `/**` from folder ignores per `useBiomeIgnoreFolder` lint rule (Biome 2.2+ convention). End config is semantically identical to plan's intent.
3. **Dropped `rootDir: ./src` from `apps/api/tsconfig.json`.** Plan's tsconfig had `rootDir: "./src"` and `include: ["src/**/*", "tests/**/*", "drizzle.config.ts"]` — these contradict because `tests/` and `drizzle.config.ts` live outside `src/`. `tsc` emits TS6059 ("not under rootDir"). Standard fix: remove `rootDir` and let TS infer it from include patterns. Emits still go to `outDir: "./dist"`.
4. **`@ts-expect-error` shim in `tests/_helpers/test-db.ts`.** Plan 01-00 used `await import('pg')` / `await import('drizzle-orm/node-postgres')` as a "dynamic-import shim" and ran `vitest` happily — but Vitest's esbuild doesn't typecheck modules, while `tsc --noEmit` does. Without the directives, the apps/api project would emit TS2307. Plan 01-04 installs pg + drizzle-orm and the directives need to be removed there.
5. **Removed `apps/api/pnpm-lock.yaml`.** Plan 01-00 created it via `pnpm install --ignore-workspace` because no root workspace existed yet. With the root `pnpm-workspace.yaml` shipped here, the root `pnpm-lock.yaml` is the authoritative one and the nested lockfile is stale. Plan 01-00's "Notes for Next Plan" explicitly handed this off.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Biome 2.4.0 schema rejected by 2.4.16 CLI**
- **Found during:** Task 1 verify
- **Issue:** `pnpm exec biome check .` errored on three keys (`files.ignore`, `noConsoleLog`, schema version mismatch). The `$schema` URL pinned to 2.4.0, but the CLI installed at 2.4.16 expects matching schema with `files.includes`/`noConsole`.
- **Fix:** Ran `pnpm exec biome migrate --write` to convert config. Hand-fixed the `useBiomeIgnoreFolder` warning by dropping trailing `/**` from folder ignores.
- **Files modified:** `biome.json`
- **Verification:** `pnpm exec biome check` on all 7 skeleton files + 4 Task 2 files → 0 errors.
- **Committed in:** `04e4fe5`

**2. [Rule 1 — Bug] `apps/api/tsconfig.json` rootDir contradicts include patterns**
- **Found during:** Task 2 verify (first `tsc --noEmit -p apps/api/tsconfig.json`)
- **Issue:** Plan's `rootDir: "./src"` + `include: ["src/**/*", "tests/**/*", "drizzle.config.ts"]` produced TS6059 because tests/ and drizzle.config.ts live outside rootDir.
- **Fix:** Removed `rootDir`. TS infers it from include; outDir still drives emit.
- **Files modified:** `apps/api/tsconfig.json`
- **Verification:** `pnpm exec tsc --noEmit -p apps/api/tsconfig.json` exits 0.
- **Committed in:** `59f333f`

**3. [Rule 1 — Bug] Dynamic import shim in test-db.ts didn't shim TS resolution**
- **Found during:** Task 2 verify (`tsc --noEmit` on apps/api)
- **Issue:** `await import('pg')` and `await import('drizzle-orm/node-postgres')` in Wave 0's tests/_helpers/test-db.ts trigger TS2307 because the modules aren't installed until Plan 01-04. Plan 01-00 ran `vitest` (esbuild, no typecheck) so it never saw the error.
- **Fix:** Added `// @ts-expect-error — installed in Plan 01-04` directly above each dynamic import. Comments include the expectation that Plan 01-04 removes them.
- **Files modified:** `apps/api/tests/_helpers/test-db.ts`
- **Verification:** `pnpm exec tsc --noEmit -p apps/api/tsconfig.json` exits 0; vitest still reports 17 todo, exit 0.
- **Committed in:** `59f333f`

**4. [Rule 3 — Blocking] Stale `apps/api/pnpm-lock.yaml` from --ignore-workspace install**
- **Found during:** Task 2 (after `pnpm install` at root)
- **Issue:** Root `pnpm install` produced `pnpm-lock.yaml` at repo root, but `apps/api/pnpm-lock.yaml` (from Plan 01-00's `--ignore-workspace` install) still existed and would diverge over time.
- **Fix:** `git rm apps/api/pnpm-lock.yaml`. Plan 01-00 SUMMARY's "Notes for Next Plan" anticipated this removal.
- **Files modified:** `apps/api/pnpm-lock.yaml` (deleted)
- **Verification:** Only one lockfile remains; `pnpm install` exits "Already up to date".
- **Committed in:** `59f333f`

### Out-of-scope Discoveries (logged, not fixed)

- `apps/api/tests/_helpers/test-db.ts` has two pre-existing Biome lint errors (`noNonNullAssertion`, `useTemplate`) — these are Wave 0 code, outside this plan's scope. Logged in `.planning/phases/01-database-backend-skeleton/deferred-items.md` for whoever next edits the file (likely Plan 01-04 or 01-07).

## Authentication Gates

None — no third-party services touched in this plan.

## Known Stubs

By design — Phase 1 is foundation only.

- `packages/shared-types/src/index.ts` exports a single string constant (`SHARED_TYPES_VERSION = '0.0.0'`). Plan 01-04 (schema-geo) and Plan 01-07 (Fastify skeleton) populate the `api/` subdirectory with `HealthResponseSchema`, `LeadSchema`, etc.
- `apps/web` doesn't exist yet — Wave 2 (post-Phase 1) creates the Next.js placeholder workspace. `pnpm install` already accepts `apps/*` glob; the workspace will appear automatically when 01-02 or a Wave 2 plan creates `apps/web/package.json`.
- Wave 0 `test.todo()` markers still in place. They turn into real `test()` calls as downstream plans (01-03..01-10) ship production code.

## Self-Check: PASSED

Verified post-write (commands run against current working tree):

- `package.json` exists — FOUND
- `pnpm-workspace.yaml` exists — FOUND
- `tsconfig.base.json` exists — FOUND
- `biome.json` exists — FOUND
- `.gitignore` exists — FOUND
- `.nvmrc` exists — FOUND
- `.env.example` exists — FOUND
- `apps/api/tsconfig.json` exists — FOUND
- `packages/shared-types/package.json` exists — FOUND
- `packages/shared-types/tsconfig.json` exists — FOUND
- `packages/shared-types/src/index.ts` exists — FOUND
- `packages/shared-types/dist/index.js` exists (built) — FOUND
- `apps/api/node_modules/@ai-logist/shared-types` symlink — FOUND
- Commit `04e4fe5` (Task 1) exists in `git log` — FOUND
- Commit `59f333f` (Task 2) exists in `git log` — FOUND

All claims in this SUMMARY map to files on disk and commits in the repo.

## Notes for Next Plan (01-02 — infrastructure)

- Root `package.json` already has `compose:up`, `compose:down`, `compose:full` scripts wired — Plan 01-02 just needs to create `docker-compose.yml` (+ `Caddyfile`).
- `.env.example` matches D-15 minimal set; Plan 01-02 may add `DB_PASSWORD` reference if it splits the var.
- `apps/api/node_modules/@ai-logist/shared-types` is symlinked; any production code that consumes shared-types DTOs in Phase 1 should import via `@ai-logist/shared-types` (not via relative path).
- `pnpm-lock.yaml` is now the single source of truth — never re-run `pnpm install --ignore-workspace` from inside a workspace.
- Plan 01-04 must remove the two `@ts-expect-error` directives in `apps/api/tests/_helpers/test-db.ts` once it installs pg + drizzle-orm.
- Wave 0 lint errors in test-db.ts (`noNonNullAssertion`, `useTemplate`) are recorded in `deferred-items.md` for the next plan that touches that file.
