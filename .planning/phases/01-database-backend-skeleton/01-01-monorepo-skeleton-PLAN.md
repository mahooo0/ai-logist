---
phase: 01-database-backend-skeleton
plan: 01
type: execute
wave: 1
depends_on: ["01-00"]
files_modified:
  - package.json
  - pnpm-workspace.yaml
  - tsconfig.base.json
  - biome.json
  - .gitignore
  - .env.example
  - .nvmrc
  - apps/api/tsconfig.json
  - packages/shared-types/package.json
  - packages/shared-types/tsconfig.json
  - packages/shared-types/src/index.ts
autonomous: true
requirements: ["DEPLOY-02", "DEPLOY-03"]
must_haves:
  truths:
    - "`pnpm install` at repo root resolves @ai-logist/shared-types via workspace:* without ENOENT"
    - "`pnpm exec tsc --noEmit` across all workspaces (api + shared-types) succeeds (empty schema is OK for now)"
    - "`pnpm exec biome check .` produces no errors on the skeleton files"
    - "`.env.example` contains exactly the Phase 1 env vars (DATABASE_URL, REDIS_URL, NODE_ENV, PORT, HOST, LOG_LEVEL, VERSION) per D-15"
  artifacts:
    - path: "pnpm-workspace.yaml"
      provides: "Workspace declaration for apps/* and packages/*"
      contains: "packages:"
    - path: "package.json"
      provides: "Root scripts (dev, build, tsc, lint, test, db:migrate, seed, compose:up)"
      exports: ["scripts.dev", "scripts.tsc", "scripts.lint", "scripts.test", "scripts.compose:up"]
    - path: "tsconfig.base.json"
      provides: "Shared strict TS 5.7 config — every workspace extends it"
      contains: "strict"
    - path: "biome.json"
      provides: "Shared lint+format config (Biome 2.4)"
      contains: "linter"
    - path: "packages/shared-types/package.json"
      provides: "Empty Zod-DTO package with workspace:* resolution wiring"
      contains: "@ai-logist/shared-types"
    - path: ".env.example"
      provides: "Phase 1 env template (no LLM/Telegram secrets yet — those are .optional())"
      contains: "DATABASE_URL"
  key_links:
    - from: "package.json"
      to: "apps/api + packages/shared-types"
      via: "pnpm-workspace.yaml + workspace:* protocol"
      pattern: "workspace:\\*"
    - from: "apps/api/tsconfig.json"
      to: "tsconfig.base.json"
      via: "extends"
      pattern: "extends.*tsconfig.base"
---

<objective>
Wave 1 lays down the pnpm-workspaces monorepo skeleton (per D-10, D-11, D-12, D-13) so every subsequent wave can `pnpm install` cleanly and `tsc --noEmit` succeeds at the root. Three workspaces: `apps/api` (extended from Wave 0 stub), `apps/web` (created in Wave 2), `packages/shared-types` (Zod DTOs — created here as an empty barrel).

Purpose: Lock the foundation conventions that all 5 downstream phases will inherit. ESM everywhere (`"type": "module"`), strict TS, Biome shared via extends, workspace:* protocol for cross-package resolution (Pitfall #6 in RESEARCH.md).

Output: Root + per-workspace package.json files, tsconfig.base.json + per-workspace tsconfig.json files, biome.json, .gitignore, .env.example, .nvmrc.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/01-database-backend-skeleton/01-CONTEXT.md
@.planning/phases/01-database-backend-skeleton/01-RESEARCH.md
@CLAUDE.md
@apps/api/package.json
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Root scaffolding — pnpm-workspace, root package.json, tsconfig.base, biome, .gitignore, .nvmrc, .env.example</name>
  <read_first>
    - apps/api/package.json (Wave 0 stub — we keep its scripts and extend later)
    - .planning/phases/01-database-backend-skeleton/01-RESEARCH.md (sections: "Root `package.json` scripts", "`pnpm-workspace.yaml`", "`.env.example`", "Anti-Patterns to Avoid")
    - .planning/phases/01-database-backend-skeleton/01-CONTEXT.md (D-10..D-15, D-23)
  </read_first>
  <files>
    - package.json
    - pnpm-workspace.yaml
    - tsconfig.base.json
    - biome.json
    - .gitignore
    - .nvmrc
    - .env.example
  </files>
  <action>
    Create seven root-level files. Copy each block VERBATIM — they were validated in RESEARCH.md against npm version pins.

    **`package.json`** (per RESEARCH §"Root `package.json` scripts" — keep VERBATIM):

    ```json
    {
      "name": "ai-logist",
      "private": true,
      "type": "module",
      "packageManager": "pnpm@9.15.0",
      "scripts": {
        "dev": "pnpm --filter @ai-logist/api dev",
        "dev:web": "pnpm --filter @ai-logist/web dev",
        "build": "pnpm -r build",
        "lint": "pnpm exec biome check .",
        "lint:fix": "pnpm exec biome check --write .",
        "tsc": "pnpm -r exec tsc --noEmit",
        "test": "pnpm -r test",
        "db:generate": "pnpm --filter @ai-logist/api db:generate",
        "db:migrate": "pnpm --filter @ai-logist/api db:migrate",
        "seed": "pnpm --filter @ai-logist/api seed",
        "compose:up": "docker compose up -d postgres redis",
        "compose:down": "docker compose down",
        "compose:full": "docker compose up -d"
      },
      "devDependencies": {
        "@biomejs/biome": "^2.4.16",
        "typescript": "^5.7.0",
        "tsx": "^4.22.0",
        "vitest": "^4.1.0"
      }
    }
    ```

    **`pnpm-workspace.yaml`**:

    ```yaml
    packages:
      - 'apps/*'
      - 'packages/*'
    ```

    **`tsconfig.base.json`** (strict TS 5.7, ESM, NodeNext per D-11):

    ```json
    {
      "compilerOptions": {
        "target": "ES2022",
        "module": "NodeNext",
        "moduleResolution": "NodeNext",
        "lib": ["ES2023"],
        "strict": true,
        "noUncheckedIndexedAccess": true,
        "noImplicitOverride": true,
        "exactOptionalPropertyTypes": false,
        "esModuleInterop": true,
        "forceConsistentCasingInFileNames": true,
        "skipLibCheck": true,
        "resolveJsonModule": true,
        "isolatedModules": true,
        "declaration": true,
        "declarationMap": true,
        "sourceMap": true,
        "verbatimModuleSyntax": false,
        "useUnknownInCatchVariables": true
      }
    }
    ```

    **`biome.json`** (Biome 2.4 — `linter.enabled` + `formatter.enabled` are top-level in 2.x):

    ```json
    {
      "$schema": "https://biomejs.dev/schemas/2.4.0/schema.json",
      "vcs": {
        "enabled": true,
        "clientKind": "git",
        "useIgnoreFile": true
      },
      "files": {
        "ignore": [
          "**/node_modules/**",
          "**/dist/**",
          "**/.next/**",
          "**/drizzle/meta/**",
          "**/*.md"
        ]
      },
      "formatter": {
        "enabled": true,
        "indentStyle": "space",
        "indentWidth": 2,
        "lineWidth": 100
      },
      "linter": {
        "enabled": true,
        "rules": {
          "recommended": true,
          "suspicious": {
            "noConsoleLog": "off"
          }
        }
      },
      "javascript": {
        "formatter": {
          "quoteStyle": "single",
          "trailingCommas": "es5",
          "semicolons": "always"
        }
      },
      "json": {
        "formatter": {
          "enabled": true
        }
      }
    }
    ```

    **`.gitignore`**:

    ```gitignore
    # Dependencies
    node_modules/
    .pnpm-store/

    # Build outputs
    dist/
    build/
    .next/
    *.tsbuildinfo

    # Env
    .env
    .env.local
    .env.*.local

    # Logs
    *.log
    npm-debug.log*
    yarn-debug.log*
    pnpm-debug.log*

    # OS
    .DS_Store
    Thumbs.db

    # Editor
    .vscode/
    .idea/
    *.swp

    # Test
    coverage/
    .vitest-cache/

    # Drizzle migration journal (we DO commit migrations themselves)
    # Nothing extra — drizzle/meta/ IS committed
    ```

    **`.nvmrc`**:

    ```
    22
    ```

    **`.env.example`** (per RESEARCH §"`.env.example`" — copy VERBATIM, matches D-15 minimal env):

    ```bash
    # Phase 1 minimal env — Phase 2/3 will add LLM/Telegram keys

    NODE_ENV=development
    PORT=3000
    HOST=0.0.0.0

    # Postgres (matches docker-compose service name + port mapping)
    DB_PASSWORD=ailogist
    DATABASE_URL=postgresql://ailogist:ailogist@localhost:5432/ailogist?sslmode=disable

    # Redis
    REDIS_URL=redis://localhost:6379

    LOG_LEVEL=debug

    # Phase 2 (LLM) — uncomment when you add ANTHROPIC_API_KEY
    # ANTHROPIC_API_KEY=

    # Phase 3 (Telegram) — uncomment when you add bot
    # TELEGRAM_BOT_TOKEN=
    # TELEGRAM_WEBHOOK_SECRET=
    ```

    After writing files: run `pnpm install` at repo root. It MUST succeed (resolves the Wave 0 `apps/api` workspace) and create a root `node_modules/` with Biome, TypeScript, tsx, vitest hoisted. If pnpm warns about apps/web not existing yet — that's expected; Wave 2 creates it.
  </action>
  <verify>
    <automated>pnpm install 2>&1 | tail -10 && pnpm exec biome --version && pnpm exec tsc --version && test -f pnpm-workspace.yaml && test -f tsconfig.base.json && test -f biome.json && grep -q "DATABASE_URL=postgresql" .env.example && echo OK</automated>
  </verify>
  <done>
    Root `pnpm install` succeeds; `pnpm exec biome --version` prints `2.4.x` (or compatible); `pnpm exec tsc --version` prints `5.7.x`; all seven root files exist with correct content.
  </done>
  <acceptance_criteria>
    - `test -f package.json && test -f pnpm-workspace.yaml && test -f tsconfig.base.json && test -f biome.json && test -f .gitignore && test -f .nvmrc && test -f .env.example` returns true (all 7 files present)
    - `node -e "console.log(require('./package.json').name)"` prints `ai-logist`
    - `grep -q "@ai-logist" package.json` returns true OR `grep -q "apps/\\*" pnpm-workspace.yaml` returns true
    - `pnpm exec biome --version` exits 0 and prints a version starting with `2.`
    - `pnpm exec tsc --version` exits 0 and prints a version starting with `Version 5.7`
    - `grep -q "DATABASE_URL=postgresql://ailogist:ailogist@localhost:5432/ailogist" .env.example` returns true
    - `grep -q "^22$" .nvmrc` returns true
  </acceptance_criteria>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Create packages/shared-types + apps/api tsconfig + verify workspace resolution</name>
  <read_first>
    - package.json (just created)
    - pnpm-workspace.yaml (just created)
    - tsconfig.base.json (just created)
    - apps/api/package.json (Wave 0)
    - .planning/phases/01-database-backend-skeleton/01-RESEARCH.md (sections: "Pitfall 6: pnpm workspace dependency", "`apps/api/package.json`")
  </read_first>
  <files>
    - packages/shared-types/package.json
    - packages/shared-types/tsconfig.json
    - packages/shared-types/src/index.ts
    - apps/api/tsconfig.json
  </files>
  <action>
    Two workspaces wired up.

    **`packages/shared-types/package.json`** (per RESEARCH §Pitfall 6 — exports map for ESM + workspace:* consumers):

    ```json
    {
      "name": "@ai-logist/shared-types",
      "version": "0.0.0",
      "private": true,
      "type": "module",
      "main": "./dist/index.js",
      "types": "./dist/index.d.ts",
      "exports": {
        ".": {
          "types": "./dist/index.d.ts",
          "default": "./dist/index.js"
        },
        "./api/*": {
          "types": "./dist/api/*.d.ts",
          "default": "./dist/api/*.js"
        }
      },
      "scripts": {
        "build": "tsc -p tsconfig.json",
        "dev": "tsc -p tsconfig.json --watch",
        "test": "echo 'no tests yet — Phase 4 will add DTO tests' && exit 0"
      },
      "devDependencies": {
        "typescript": "^5.7.0"
      },
      "dependencies": {
        "zod": "^4.4.3"
      }
    }
    ```

    **`packages/shared-types/tsconfig.json`** (extends base, emits to dist/, includes src):

    ```json
    {
      "extends": "../../tsconfig.base.json",
      "compilerOptions": {
        "outDir": "./dist",
        "rootDir": "./src",
        "composite": false
      },
      "include": ["src/**/*"],
      "exclude": ["node_modules", "dist"]
    }
    ```

    **`packages/shared-types/src/index.ts`** (empty barrel — Phase 2/3/4 fill it):

    ```typescript
    // @ai-logist/shared-types
    // Zod schemas for REST DTOs and domain enums, shared by apps/api and apps/web.
    // Phase 1: empty barrel — Plan 01-04 adds HealthResponseSchema and 501-stub schemas.

    export const SHARED_TYPES_VERSION = '0.0.0';
    ```

    **`apps/api/tsconfig.json`** (extends base, includes src + tests, no emit yet):

    ```json
    {
      "extends": "../../tsconfig.base.json",
      "compilerOptions": {
        "outDir": "./dist",
        "rootDir": "./src",
        "types": ["node"],
        "paths": {
          "@ai-logist/shared-types": ["../../packages/shared-types/src/index.ts"],
          "@ai-logist/shared-types/*": ["../../packages/shared-types/src/*"]
        }
      },
      "include": ["src/**/*", "tests/**/*", "drizzle.config.ts"],
      "exclude": ["node_modules", "dist"]
    }
    ```

    After writing: ALSO extend `apps/api/package.json` to declare the workspace dependency (the only edit to the Wave 0 stub):

    Add `"dependencies": { "@ai-logist/shared-types": "workspace:*" }` to `apps/api/package.json`. Use Edit tool to merge — DO NOT overwrite the existing `devDependencies` block from Wave 0. The final apps/api/package.json should have BOTH the Wave 0 test deps AND this new dependency.

    Then run `pnpm install` at repo root. It must succeed and create a symlink at `apps/api/node_modules/@ai-logist/shared-types` pointing at `packages/shared-types`.

    Verify: `pnpm --filter @ai-logist/shared-types build` produces `packages/shared-types/dist/index.js`. Then `pnpm exec tsc --noEmit -p apps/api/tsconfig.json` passes (only tests + empty src, so should be clean).
  </action>
  <verify>
    <automated>pnpm install 2>&1 | tail -5 && pnpm --filter @ai-logist/shared-types build && test -f packages/shared-types/dist/index.js && test -L apps/api/node_modules/@ai-logist/shared-types && pnpm exec tsc --noEmit -p apps/api/tsconfig.json && pnpm exec biome check . 2>&1 | tail -5 && echo OK</automated>
  </verify>
  <done>
    `@ai-logist/shared-types` resolves via symlink from `apps/api/node_modules/`; `pnpm exec tsc --noEmit` passes for both workspaces; Biome check passes; `packages/shared-types/dist/index.js` exists.
  </done>
  <acceptance_criteria>
    - `test -f packages/shared-types/package.json && test -f packages/shared-types/tsconfig.json && test -f packages/shared-types/src/index.ts && test -f apps/api/tsconfig.json` returns true (all 4 files present)
    - `grep -q "workspace:\\*" apps/api/package.json` returns true
    - `pnpm --filter @ai-logist/shared-types build` exits 0
    - `test -f packages/shared-types/dist/index.js` returns true
    - `test -L apps/api/node_modules/@ai-logist/shared-types` returns true (symlink exists — pnpm hoisting may vary; if symlink not present, `test -d apps/api/node_modules/@ai-logist/shared-types` is acceptable per Pitfall #6 fallback)
    - `pnpm exec tsc --noEmit -p apps/api/tsconfig.json` exits 0
    - `pnpm exec biome check apps/api/tsconfig.json packages/shared-types/` exits 0
    - `cd apps/api && pnpm exec vitest run --reporter=basic 2>&1 | tail -3` still reports 17 `.todo` (Wave 0 tests still green)
  </acceptance_criteria>
</task>

</tasks>

<verification>
- `pnpm install` at repo root succeeds with no ENOENT or workspace errors
- `pnpm exec tsc --noEmit` exits 0 across all workspaces
- `pnpm exec biome check .` exits 0 (clean)
- `pnpm --filter @ai-logist/shared-types build` produces `dist/index.js`
- `apps/api/node_modules/@ai-logist/shared-types` is a symlink (or directory) to `packages/shared-types`
- `cd apps/api && pnpm test` still reports 17 `.todo` (Wave 0 tests still green)
</verification>

<success_criteria>
1. Root-level pnpm workspace + Biome + TS 5.7 strict + ESM-everywhere are configured per D-10..D-13.
2. `@ai-logist/shared-types` is empty but installable via `workspace:*` from `apps/api`.
3. `.env.example` matches D-15 (only Phase 1 required vars; Phase 2/3 vars commented out).
4. `pnpm exec tsc --noEmit` and `pnpm exec biome check .` both pass cleanly — every downstream wave starts from green.
</success_criteria>

<output>
After completion, create `.planning/phases/01-database-backend-skeleton/01-01-SUMMARY.md` documenting:
- Output of `pnpm install` (key counts: packages resolved)
- Final `apps/api/package.json` shape (devDeps from Wave 0 + new dependency on shared-types)
- `pnpm exec tsc --noEmit` clean
- `pnpm exec biome check .` clean
- Any deviations (e.g., Biome 2.4.16 vs newer minor)
</output>
