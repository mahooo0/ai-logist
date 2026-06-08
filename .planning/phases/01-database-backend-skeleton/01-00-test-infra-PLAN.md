---
phase: 01-database-backend-skeleton
plan: 00
type: execute
wave: 0
depends_on: []
files_modified:
  - apps/api/package.json
  - apps/api/vitest.config.ts
  - apps/api/tests/README.md
  - apps/api/tests/conftest.ts
  - apps/api/tests/unit/.gitkeep
  - apps/api/tests/integration/.gitkeep
  - apps/api/tests/smoke/.gitkeep
  - apps/api/tests/unit/phase-1-stubs.test.ts
  - apps/api/tests/_helpers/test-db.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "Vitest 4.x is installed and `pnpm --filter @ai-logist/api test` runs (even if all tests are .todo)"
    - "Testcontainers helper boots a real `postgis/postgis:17-3.5` container and returns a `NodePgDatabase` connection"
    - "Every Phase 1 acceptance criterion has a `test.todo()` stub so coverage tracker shows MISSING (red) until producing task fills it"
    - "`tests/README.md` documents how to run unit / integration / smoke categories"
  artifacts:
    - path: "apps/api/vitest.config.ts"
      provides: "Vitest 4.x config with projects=unit|integration|smoke, environment=node, testTimeout=15000"
      contains: "defineConfig"
    - path: "apps/api/tests/_helpers/test-db.ts"
      provides: "Testcontainers helper that boots postgis/postgis:17-3.5 and yields NodePgDatabase"
      exports: ["startPostgisContainer", "stopPostgisContainer", "getTestDb"]
    - path: "apps/api/tests/unit/phase-1-stubs.test.ts"
      provides: "test.todo() markers for every Phase 1 acceptance criterion"
      contains: "test.todo"
  key_links:
    - from: "apps/api/tests/_helpers/test-db.ts"
      to: "@testcontainers/postgresql + postgis/postgis:17-3.5"
      via: "PostgreSqlContainer with custom image tag"
      pattern: "new PostgreSqlContainer\\(['\"]postgis/postgis:17-3.5['\"]"
    - from: "apps/api/package.json scripts.test"
      to: "vitest run"
      via: "package.json script entry"
      pattern: "vitest"
---

<objective>
Wave 0 ships test infrastructure BEFORE any production code. Every Wave 1+ task can be verified because Vitest + testcontainers + stubs are already in place. This task is mandatory per `.planning/phases/01-database-backend-skeleton/01-VALIDATION.md` — without it the Nyquist rule ("every <verify> includes an <automated> command") fails immediately on Wave 1.

Purpose: Make red→green the default. Every Phase 1 acceptance criterion becomes a `test.todo()` stub now, and downstream tasks flip stubs to passing tests as they ship production code.

Output: `apps/api/` directory with a working `pnpm --filter @ai-logist/api test` command, testcontainers helper, and stub tests for every Phase 1 requirement.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/01-database-backend-skeleton/01-CONTEXT.md
@.planning/phases/01-database-backend-skeleton/01-VALIDATION.md
@.planning/phases/01-database-backend-skeleton/01-RESEARCH.md
@CLAUDE.md

<note>
The repo is greenfield — no `package.json` exists yet at root or in `apps/api`. This Wave 0 plan creates the MINIMUM `apps/api/package.json` needed to install Vitest + testcontainers. Plan 01-01 (monorepo skeleton) will extend root-level scaffolding; this plan only seeds `apps/api/package.json` and lets later plans add deps via `pnpm --filter @ai-logist/api add`.

This means: when running Task 1, `pnpm install` will WARN about missing pnpm-workspace.yaml. That's expected. Wave 1 fixes it. Use `pnpm install --ignore-workspace` or simply `pnpm install` from inside `apps/api/` if the workspace file is missing.
</note>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Create apps/api skeleton + install Vitest 4 + testcontainers</name>
  <read_first>
    - .planning/phases/01-database-backend-skeleton/01-RESEARCH.md (Standard Stack section — exact versions)
    - .planning/phases/01-database-backend-skeleton/01-VALIDATION.md (Wave 0 Requirements)
  </read_first>
  <files>
    - apps/api/package.json
  </files>
  <action>
    Create `apps/api/package.json` with the MINIMUM shape needed to install dev test dependencies. This is a stub package.json — Plan 01-04 (Fastify skeleton) will replace it with the full version from RESEARCH.md §`apps/api/package.json`.

    File content (copy verbatim):

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
      "devDependencies": {
        "vitest": "^4.1.0",
        "@vitest/coverage-v8": "^4.1.0",
        "@testcontainers/postgresql": "^10.18.0",
        "testcontainers": "^10.18.0",
        "@types/node": "^22.0.0",
        "typescript": "^5.7.0"
      }
    }
    ```

    Then `mkdir -p apps/api` and write the file. Run `cd apps/api && pnpm install` (use `--ignore-workspace` if pnpm complains about no workspace). This MUST succeed — if `@testcontainers/postgresql` 10.18.0 doesn't exist, look up latest via `npm view @testcontainers/postgresql version` and pin that.

    Per D-11 ESM is non-negotiable: keep `"type": "module"`.
  </action>
  <verify>
    <automated>cd apps/api && pnpm install --ignore-workspace 2>&1 | tail -5 && test -d apps/api/node_modules/vitest && test -d apps/api/node_modules/@testcontainers && echo OK</automated>
  </verify>
  <done>
    `apps/api/package.json` exists with `vitest`, `@testcontainers/postgresql`, `testcontainers` in devDependencies; `pnpm install` succeeds in `apps/api/`; `apps/api/node_modules/vitest` and `apps/api/node_modules/@testcontainers/postgresql` directories exist.
  </done>
  <acceptance_criteria>
    - `test -f apps/api/package.json` returns true
    - `node -e "const p = require('./apps/api/package.json'); console.log(p.name)"` prints `@ai-logist/api`
    - `cd apps/api && pnpm exec vitest --version` prints `4.x.x`
    - `apps/api/package.json` contains the literal string `"type": "module"`
  </acceptance_criteria>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Vitest config + testcontainers helper + stub tests</name>
  <read_first>
    - apps/api/package.json (just created)
    - .planning/phases/01-database-backend-skeleton/01-VALIDATION.md (Per-Task Verification Map — every stub here)
    - .planning/phases/01-database-backend-skeleton/01-RESEARCH.md (Validation Architecture section — Wave 0 Gaps list)
  </read_first>
  <files>
    - apps/api/vitest.config.ts
    - apps/api/tests/README.md
    - apps/api/tests/conftest.ts
    - apps/api/tests/_helpers/test-db.ts
    - apps/api/tests/unit/.gitkeep
    - apps/api/tests/integration/.gitkeep
    - apps/api/tests/smoke/.gitkeep
    - apps/api/tests/unit/phase-1-stubs.test.ts
  </files>
  <action>
    Create five files. Copy each block VERBATIM.

    **`apps/api/vitest.config.ts`** (Vitest 4.x supports `projects` field for splitting unit / integration / smoke):

    ```typescript
    import { defineConfig } from 'vitest/config';

    export default defineConfig({
      test: {
        environment: 'node',
        globals: false,
        testTimeout: 15_000,
        hookTimeout: 30_000,
        // Vitest 4: projects replace deprecated 'projects' workspace config
        projects: [
          {
            test: {
              name: 'unit',
              include: ['tests/unit/**/*.test.ts', 'src/**/*.test.ts'],
              environment: 'node',
            },
          },
          {
            test: {
              name: 'integration',
              include: ['tests/integration/**/*.test.ts'],
              environment: 'node',
              testTimeout: 60_000, // testcontainers startup is slow
            },
          },
          {
            test: {
              name: 'smoke',
              include: ['tests/smoke/**/*.test.ts'],
              environment: 'node',
              testTimeout: 60_000,
            },
          },
        ],
      },
    });
    ```

    **`apps/api/tests/README.md`**:

    ```markdown
    # apps/api tests

    Three categories — keep boundaries clean:

    | Category | Path | Speed | Needs Docker? | When to run |
    |----------|------|-------|---------------|-------------|
    | **unit** | `tests/unit/**`, `src/**/*.test.ts` | < 1s/test | no | per commit |
    | **integration** | `tests/integration/**` | 10-30s/test (testcontainers boot) | yes | per wave merge |
    | **smoke** | `tests/smoke/**` | 30-60s/test (full app boot) | yes | before `/gsd:verify-work` |

    ## Commands

    ```bash
    pnpm --filter @ai-logist/api test               # all categories
    pnpm --filter @ai-logist/api test:unit          # fast feedback
    pnpm --filter @ai-logist/api test:integration   # needs Docker
    pnpm --filter @ai-logist/api test:smoke         # needs Docker + built app
    pnpm --filter @ai-logist/api test:watch         # dev loop
    ```

    ## Test fixtures

    `tests/_helpers/test-db.ts` boots a real PostGIS container per integration suite. Use:

    ```typescript
    import { startPostgisContainer, getTestDb, stopPostgisContainer } from '../_helpers/test-db.js';

    beforeAll(async () => { await startPostgisContainer(); });
    afterAll(async () => { await stopPostgisContainer(); });

    it('uses a real PostGIS', async () => {
      const db = getTestDb();
      // … your test
    });
    ```
    ```

    **`apps/api/tests/conftest.ts`** (shared beforeAll/afterAll wiring re-exported for convenience):

    ```typescript
    // Shared test wiring — re-exports the testcontainers helper.
    // Import from here in tests/integration/** to avoid relative-path drift.
    export {
      startPostgisContainer,
      stopPostgisContainer,
      getTestDb,
      getTestDbUrl,
    } from './_helpers/test-db.js';
    ```

    **`apps/api/tests/_helpers/test-db.ts`** — Testcontainers helper. The `drizzle-orm/node-postgres` import is forward-looking (Plan 01-04 ships it); if `drizzle-orm` is not yet installed, the export `getTestDb` will throw at call time, which is FINE — Wave 0 only needs the file to exist and be lint-clean:

    ```typescript
    import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

    let container: StartedPostgreSqlContainer | null = null;
    let connectionUrl: string | null = null;

    /**
     * Boot a real postgis/postgis:17-3.5 container.
     * Call in beforeAll(); pair with stopPostgisContainer() in afterAll().
     */
    export async function startPostgisContainer(): Promise<string> {
      if (container) return connectionUrl!;
      container = await new PostgreSqlContainer('postgis/postgis:17-3.5')
        .withDatabase('ailogist_test')
        .withUsername('ailogist')
        .withPassword('ailogist')
        .withStartupTimeout(60_000)
        .start();
      connectionUrl = container.getConnectionUri() + '?sslmode=disable';
      return connectionUrl;
    }

    export async function stopPostgisContainer(): Promise<void> {
      if (container) {
        await container.stop();
        container = null;
        connectionUrl = null;
      }
    }

    export function getTestDbUrl(): string {
      if (!connectionUrl) throw new Error('Call startPostgisContainer() in beforeAll() first');
      return connectionUrl;
    }

    /**
     * Returns a Drizzle NodePgDatabase pointing at the test container.
     * Throws if drizzle-orm/pg are not yet installed (Plan 01-04 ships them).
     * Wave 0 callers should rely on getTestDbUrl() + raw pg.Client only.
     */
    export async function getTestDb(): Promise<unknown> {
      const url = getTestDbUrl();
      try {
        // Dynamic import — drizzle-orm/pg are added in Plan 01-04
        const { Pool } = await import('pg');
        const { drizzle } = await import('drizzle-orm/node-postgres');
        const pool = new Pool({ connectionString: url });
        return drizzle(pool);
      } catch (err) {
        throw new Error(
          'getTestDb requires drizzle-orm and pg to be installed (Plan 01-04 ships them). ' +
            'For Wave 0 tests, use getTestDbUrl() + new pg.Client() directly.'
        );
      }
    }
    ```

    Empty `.gitkeep` files (touch them):

    ```bash
    touch apps/api/tests/unit/.gitkeep
    touch apps/api/tests/integration/.gitkeep
    touch apps/api/tests/smoke/.gitkeep
    ```

    **`apps/api/tests/unit/phase-1-stubs.test.ts`** — one `test.todo()` per requirement so coverage shows red until producing task ships its real test:

    ```typescript
    import { describe, test } from 'vitest';

    /**
     * Phase 1 acceptance criteria stubs.
     * Each test.todo() marker is filled by the task that ships the producing artifact.
     * If you see a test.todo() entry below not yet filled, that's a coverage gap — red.
     */

    describe('Phase 1: Database & Schema (DB-*)', () => {
      test.todo('DB-01: postgis extension loaded in first migration (0000_postgis_extension.sql)');
      test.todo('DB-02: clients table has lang/tax_id/tax_id_country columns');
      test.todo('DB-03: cities table has name_ru/name_ua + geography(Point, 4326)');
      test.todo('DB-04: trucks table has geography(Point, 4326) + GiST index + CHECK SRID=4326');
      test.todo('DB-05: leads table has extended cargo fields + price_overrides jsonb[]');
      test.todo('DB-06: orders + order_events tables with UNIQUE (order_id, type)');
      test.todo('DB-07: calls, messages, bourse_cache tables exist');
      test.todo('DB-08: pod_artifacts table with signature_url, photo_url, gps, captured_at');
      test.todo('DB-09: webhook_updates with UNIQUE(source, external_id) + ON CONFLICT DO NOTHING');
      test.todo('DB-10: seed populates 12 trucks, ~30 cities, 8 clients idempotently');
    });

    describe('Phase 1: Backend API & Infrastructure (API-*)', () => {
      test.todo('API-01: GET /api/health returns 200 with PostGIS_Version() in checks.postgis');
      test.todo('API-02: drizzle-kit migrate is idempotent (re-run produces zero diff)');
      test.todo('API-16: routes validate request body via Zod and reject malformed input with 400');
    });

    describe('Phase 1: Deployment & Demo (DEPLOY-*)', () => {
      test.todo('DEPLOY-01: docker compose config -q passes; all 5 services declared');
      test.todo('DEPLOY-02: Zod env validation rejects missing DATABASE_URL with process.exit(1)');
      test.todo('DEPLOY-03: pnpm workspaces resolve @ai-logist/shared-types from apps/api');
      test.todo('DEPLOY-04: README "fresh dev in ≤10 min" sequence is executable end-to-end');
    });
    ```
  </action>
  <verify>
    <automated>cd apps/api && pnpm exec vitest run --reporter=basic 2>&1 | grep -E "(todo|skipped|passed)" | head -3 && test -f apps/api/vitest.config.ts && test -f apps/api/tests/_helpers/test-db.ts && test -f apps/api/tests/README.md && echo OK</automated>
  </verify>
  <done>
    `pnpm --filter @ai-logist/api test` (or run from `apps/api/`) executes, reports 17 `.todo` tests, and exits 0. All 8 files exist on disk.
  </done>
  <acceptance_criteria>
    - `test -f apps/api/vitest.config.ts` returns true and the file contains the literal string `defineConfig`
    - `test -f apps/api/tests/_helpers/test-db.ts` returns true and the file contains the literal string `postgis/postgis:17-3.5`
    - `test -f apps/api/tests/unit/phase-1-stubs.test.ts` returns true
    - `grep -c "test.todo" apps/api/tests/unit/phase-1-stubs.test.ts` returns at least 17
    - `cd apps/api && pnpm exec vitest run --reporter=basic 2>&1` exits with code 0 and reports todo tests (look for "todo" or "skipped" markers in output)
    - `test -f apps/api/tests/unit/.gitkeep && test -f apps/api/tests/integration/.gitkeep && test -f apps/api/tests/smoke/.gitkeep` returns true
  </acceptance_criteria>
</task>

</tasks>

<verification>
- `cd apps/api && pnpm install --ignore-workspace` succeeds (Wave 1 fixes the workspace warning)
- `cd apps/api && pnpm exec vitest run` exits 0, reports 17 `.todo` tests
- `test -f apps/api/vitest.config.ts && test -f apps/api/tests/_helpers/test-db.ts` returns true
- `grep -q "postgis/postgis:17-3.5" apps/api/tests/_helpers/test-db.ts` returns true
- `grep -c "test.todo" apps/api/tests/unit/phase-1-stubs.test.ts` returns at least 17
</verification>

<success_criteria>
1. Vitest 4.x and @testcontainers/postgresql are installed in `apps/api/node_modules`.
2. `pnpm --filter @ai-logist/api test` (or `cd apps/api && pnpm test`) reports 17 `.todo` tests and exits 0.
3. Wave 1+ tasks can write production code AND a real test in the same task, and the test will execute against the existing Vitest config without ANY infrastructure setup.
4. `tests/README.md` documents the 3 test categories and how to run each.
</success_criteria>

<output>
After completion, create `.planning/phases/01-database-backend-skeleton/01-00-SUMMARY.md` documenting:
- `pnpm install` succeeded inside `apps/api/`
- Vitest version actually installed
- `@testcontainers/postgresql` version actually installed
- Output of `pnpm exec vitest run --reporter=basic` (count of todo tests)
- Any deviations from the planned versions (if npm pinning forced a newer release)
</output>
