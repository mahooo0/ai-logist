---
phase: 01-database-backend-skeleton
plan: 02
type: execute
wave: 2
depends_on: ["01-01"]
files_modified:
  - docker-compose.yml
  - docker-compose.prod.yml
  - Caddyfile
  - apps/api/Dockerfile
  - apps/api/.dockerignore
  - apps/web/Dockerfile
  - apps/web/.dockerignore
  - apps/web/package.json
  - apps/web/next.config.ts
  - apps/web/tsconfig.json
  - apps/web/app/page.tsx
  - apps/web/app/layout.tsx
  - apps/web/app/globals.css
autonomous: true
requirements: ["DEPLOY-01", "DEPLOY-04"]
must_haves:
  truths:
    - "`docker compose config -q` exits 0 (yaml valid, all 5 services declared)"
    - "`docker compose up -d postgres` boots a postgis/postgis:17-3.5 container and `pg_isready -U ailogist` succeeds via healthcheck"
    - "`docker compose up -d redis` boots redis:7-alpine and `redis-cli ping` returns PONG"
    - "Caddyfile uses `handle /api/*` (NOT `handle_path` — Pitfall #3) and routes /api/*, /webhook/*, /ws/* to api:3000, everything else to web:3001"
    - "apps/web is a minimal Next.js 16 placeholder that builds to `.next/` and serves a single page"
  artifacts:
    - path: "docker-compose.yml"
      provides: "5 services: postgres (postgis/postgis:17-3.5), redis (7-alpine), api, web, caddy (2-alpine)"
      contains: "postgis/postgis:17-3.5"
    - path: "Caddyfile"
      provides: "Path routing for :80 with handle /api/*, /webhook/*, /ws/* → api; else → web"
      contains: "handle /api/*"
    - path: "apps/api/Dockerfile"
      provides: "Multi-stage build with pnpm 9.15.0, Node 22-alpine, ships drizzle/ migrations"
      contains: "node:22-alpine"
    - path: "apps/web/package.json"
      provides: "Next.js 16 placeholder workspace"
      contains: "@ai-logist/web"
    - path: "apps/web/app/page.tsx"
      provides: "Single placeholder page confirming Caddy → web routing works end-to-end"
      contains: "AI-Логист"
  key_links:
    - from: "Caddyfile"
      to: "api:3000 (Fastify) + web:3001 (Next.js)"
      via: "reverse_proxy directive"
      pattern: "reverse_proxy api:3000"
    - from: "docker-compose.yml"
      to: "Caddyfile"
      via: "volumes mount ./Caddyfile:/etc/caddy/Caddyfile:ro"
      pattern: "Caddyfile:/etc/caddy"
    - from: "apps/api/Dockerfile"
      to: "packages/shared-types"
      via: "COPY package.json + workspace build step"
      pattern: "shared-types"
---

<objective>
Wave 2 ships the deploy surface: a complete `docker-compose.yml` topology (per D-22, D-24), the Caddyfile with the documented `handle` (not `handle_path` — Pitfall #3) routing, multi-stage Dockerfiles for `apps/api` and `apps/web`, and the Next.js 16 placeholder that makes `docker compose up` boot end-to-end as soon as Wave 4 ships the Fastify app.

Purpose: Production-grade compose topology + Caddy routing locked in before any application code. Lets every downstream wave verify against a real `docker compose up -d postgres redis` boot.

Output: 13 files including docker-compose.yml, docker-compose.prod.yml, Caddyfile, 2 Dockerfiles, 2 .dockerignore files, and the apps/web Next.js 16 placeholder (package.json, next.config.ts, tsconfig.json, app/page.tsx, app/layout.tsx, app/globals.css).
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
@docker-compose.yml
@Caddyfile
@.env.example
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: docker-compose.yml + Caddyfile + prod overlay</name>
  <read_first>
    - .env.example (Wave 1 — for DB_PASSWORD, DATABASE_URL contract)
    - .planning/phases/01-database-backend-skeleton/01-RESEARCH.md (sections: "`docker-compose.yml`", "`Caddyfile` — local dev", "Pitfall 3: `handle_path`")
    - .planning/phases/01-database-backend-skeleton/01-CONTEXT.md (D-22, D-23, D-24)
  </read_first>
  <files>
    - docker-compose.yml
    - docker-compose.prod.yml
    - Caddyfile
  </files>
  <action>
    Three deployment files. Copy each block VERBATIM from RESEARCH.md.

    **`docker-compose.yml`** (per RESEARCH §"`docker-compose.yml`" — copy VERBATIM, all 5 services + healthchecks + volumes):

    ```yaml
    services:
      postgres:
        image: postgis/postgis:17-3.5
        container_name: ailogist-postgres
        environment:
          POSTGRES_DB: ailogist
          POSTGRES_USER: ailogist
          POSTGRES_PASSWORD: ${DB_PASSWORD:-ailogist}
        volumes:
          - pgdata:/var/lib/postgresql/data
        ports:
          - '127.0.0.1:5432:5432'
        healthcheck:
          test: ['CMD-SHELL', 'pg_isready -U ailogist -d ailogist']
          interval: 5s
          timeout: 5s
          retries: 10
        restart: unless-stopped

      redis:
        image: redis:7-alpine
        container_name: ailogist-redis
        command: redis-server --appendonly yes
        volumes:
          - redisdata:/data
        ports:
          - '127.0.0.1:6379:6379'
        healthcheck:
          test: ['CMD', 'redis-cli', 'ping']
          interval: 5s
          timeout: 3s
          retries: 10
        restart: unless-stopped

      api:
        build:
          context: .
          dockerfile: apps/api/Dockerfile
        container_name: ailogist-api
        depends_on:
          postgres:
            condition: service_healthy
          redis:
            condition: service_healthy
        environment:
          NODE_ENV: ${NODE_ENV:-production}
          PORT: 3000
          HOST: 0.0.0.0
          DATABASE_URL: postgresql://ailogist:${DB_PASSWORD:-ailogist}@postgres:5432/ailogist?sslmode=disable
          REDIS_URL: redis://redis:6379
          LOG_LEVEL: ${LOG_LEVEL:-info}
          VERSION: ${VERSION:-dev}
        expose:
          - '3000'
        healthcheck:
          test: ['CMD', 'wget', '-qO-', 'http://localhost:3000/api/health']
          interval: 10s
          timeout: 5s
          retries: 5
        restart: unless-stopped

      web:
        build:
          context: .
          dockerfile: apps/web/Dockerfile
        container_name: ailogist-web
        depends_on:
          - api
        environment:
          NODE_ENV: ${NODE_ENV:-production}
          PORT: 3001
          NEXT_PUBLIC_API_URL: http://api:3000
        expose:
          - '3001'
        restart: unless-stopped

      caddy:
        image: caddy:2-alpine
        container_name: ailogist-caddy
        ports:
          - '80:80'
          - '443:443'
        volumes:
          - ./Caddyfile:/etc/caddy/Caddyfile:ro
          - caddydata:/data
          - caddyconfig:/config
        depends_on:
          - api
          - web
        restart: unless-stopped

    volumes:
      pgdata:
      redisdata:
      caddydata:
      caddyconfig:
    ```

    **`Caddyfile`** (per RESEARCH §"`Caddyfile` — local dev (no TLS)" — copy VERBATIM, uses `handle` NOT `handle_path`):

    ```caddyfile
    # Local development — listens on :80 only, no TLS
    # For prod VPS, replace ':80' with your domain and Caddy auto-provisions Let's Encrypt.
    :80 {
        encode gzip

        # API: /api/* — preserve prefix (Fastify routes are /api/health, /api/leads, …)
        # Pitfall #3 of 01-RESEARCH.md: handle_path STRIPS prefix; we use handle.
        handle /api/* {
            reverse_proxy api:3000
        }

        # Webhooks (Telegram in Phase 3, voice/gps in Phase 5)
        handle /webhook/* {
            reverse_proxy api:3000
        }

        # WebSocket (Phase 5: /ws/tracking, /ws/inbox)
        handle /ws/* {
            reverse_proxy api:3000
        }

        # Everything else → web (Next.js, including /track/[token] in Phase 5)
        handle {
            reverse_proxy web:3001
        }

        log {
            output stdout
            format console
        }
    }
    ```

    **`docker-compose.prod.yml`** (production overlay — domain-aware Caddy + tightened restart policies):

    ```yaml
    # Production overlay
    # Usage: docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
    #
    # Steps before first run on a VPS:
    # 1. Set DOMAIN env var (e.g., ai-logist.example.com)
    # 2. Edit Caddyfile: replace ':80' with your domain — Caddy auto-acquires Let's Encrypt
    # 3. Open ports 80 + 443 in firewall

    services:
      postgres:
        ports: []  # Don't expose to host on prod — only api container connects via Docker network
        restart: always

      redis:
        ports: []  # Same — no host exposure on prod
        restart: always

      api:
        environment:
          NODE_ENV: production
          LOG_LEVEL: info
        restart: always

      web:
        restart: always

      caddy:
        restart: always
        environment:
          DOMAIN: ${DOMAIN:-localhost}
    ```

    After writing: run `docker compose config -q` to validate yaml (this REQUIRES Docker installed; if not available locally, document it and trust the verify step). Then attempt `docker compose up -d postgres redis` to boot infrastructure containers and verify both healthchecks pass within 30 seconds.

    Per D-23: order is `docker compose up -d postgres redis` FIRST, then `pnpm install + db:migrate + seed`, then `pnpm dev`. The `api` + `web` services in compose are only used in full-stack deploy mode — not during Phase 1 local dev.
  </action>
  <verify>
    <automated>docker compose config -q && docker compose up -d postgres redis 2>&1 | tail -5 && sleep 8 && docker compose ps --format '{{.Service}} {{.Status}}' | grep -E "(postgres|redis).*healthy" | wc -l | xargs -I {} test {} -ge 2 && docker exec ailogist-postgres pg_isready -U ailogist -d ailogist && docker exec ailogist-redis redis-cli ping | grep -q PONG && echo OK</automated>
  </verify>
  <done>
    `docker compose config` passes (yaml valid); `docker compose up -d postgres redis` brings both containers to healthy state; `pg_isready` returns success and `redis-cli ping` returns PONG; Caddyfile uses `handle /api/*` (NOT `handle_path`).
  </done>
  <acceptance_criteria>
    - `test -f docker-compose.yml && test -f docker-compose.prod.yml && test -f Caddyfile` returns true
    - `docker compose config -q` exits 0
    - `grep -c "^  [a-z]*:$" docker-compose.yml` returns at least 5 (5 services: postgres, redis, api, web, caddy)
    - `grep -q "postgis/postgis:17-3.5" docker-compose.yml` returns true
    - `grep -q "redis:7-alpine" docker-compose.yml` returns true
    - `grep -q "caddy:2-alpine" docker-compose.yml` returns true
    - `grep -q "handle /api/\\*" Caddyfile` returns true
    - `! grep -q "handle_path" Caddyfile` returns true (the `!` inverts — NO handle_path)
    - `docker compose up -d postgres redis` exits 0 and both containers report healthy within 30s (`docker compose ps` confirms)
    - `docker exec ailogist-postgres pg_isready -U ailogist -d ailogist` returns success
    - `docker exec ailogist-redis redis-cli ping` returns `PONG`
  </acceptance_criteria>
</task>

<task type="auto" tdd="false">
  <name>Task 2: apps/api Dockerfile + apps/web Next.js 16 placeholder + Dockerfiles</name>
  <read_first>
    - docker-compose.yml (just created — confirms api builds from apps/api/Dockerfile, web from apps/web/Dockerfile)
    - apps/api/package.json (Wave 0+1 stub)
    - .planning/phases/01-database-backend-skeleton/01-RESEARCH.md (sections: "`apps/api/Dockerfile`", "Open Question 4: `web` service in Phase 1")
    - .planning/phases/01-database-backend-skeleton/01-CONTEXT.md (D-22, code_context section about apps/web)
    - tsconfig.base.json (Wave 1)
  </read_first>
  <files>
    - apps/api/Dockerfile
    - apps/api/.dockerignore
    - apps/web/Dockerfile
    - apps/web/.dockerignore
    - apps/web/package.json
    - apps/web/next.config.ts
    - apps/web/tsconfig.json
    - apps/web/app/page.tsx
    - apps/web/app/layout.tsx
    - apps/web/app/globals.css
  </files>
  <action>
    Two Dockerfiles + apps/web placeholder. Recommendation from RESEARCH §Open Question 4: minimal `create-next-app` shape with ONE page.

    **`apps/api/Dockerfile`** (per RESEARCH §"`apps/api/Dockerfile`" — copy VERBATIM):

    ```dockerfile
    # syntax=docker/dockerfile:1
    FROM node:22-alpine AS base
    RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
    WORKDIR /app

    FROM base AS deps
    COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
    COPY apps/api/package.json apps/api/
    COPY packages/shared-types/package.json packages/shared-types/
    RUN pnpm install --frozen-lockfile

    FROM deps AS build
    COPY . .
    RUN pnpm --filter @ai-logist/shared-types build && \
        pnpm --filter @ai-logist/api build

    FROM node:22-alpine AS runtime
    RUN apk add --no-cache wget
    WORKDIR /app
    COPY --from=build /app/node_modules ./node_modules
    COPY --from=build /app/apps/api/dist ./apps/api/dist
    COPY --from=build /app/apps/api/drizzle ./apps/api/drizzle
    COPY --from=build /app/apps/api/package.json ./apps/api/package.json
    COPY --from=build /app/packages/shared-types/dist ./packages/shared-types/dist
    COPY --from=build /app/packages/shared-types/package.json ./packages/shared-types/package.json
    WORKDIR /app/apps/api
    EXPOSE 3000
    CMD ["node", "dist/index.js"]
    ```

    Note: we add `wget` explicitly (Alpine's base image strips it from some 22.x releases) so the healthcheck in docker-compose.yml succeeds.

    **`apps/api/.dockerignore`**:

    ```
    node_modules
    **/node_modules
    dist
    **/dist
    .next
    **/.next
    *.log
    .env
    .env.local
    .env.*.local
    coverage
    .vitest-cache
    .git
    .gitignore
    .planning
    *.md
    tests
    ```

    **`apps/web/.dockerignore`** (same content):

    ```
    node_modules
    **/node_modules
    dist
    **/dist
    .next
    **/.next
    *.log
    .env
    .env.local
    .env.*.local
    coverage
    .git
    .gitignore
    .planning
    *.md
    ```

    **`apps/web/package.json`** (Next.js 16 + React 19 — pin EXACTLY):

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
        "test": "echo 'Phase 1 placeholder — no tests yet' && exit 0"
      },
      "dependencies": {
        "next": "^16.0.0",
        "react": "^19.0.0",
        "react-dom": "^19.0.0"
      },
      "devDependencies": {
        "@types/node": "^22.0.0",
        "@types/react": "^19.0.0",
        "@types/react-dom": "^19.0.0",
        "typescript": "^5.7.0"
      }
    }
    ```

    **`apps/web/next.config.ts`** (standalone output so Dockerfile can copy a minimal runtime):

    ```typescript
    import type { NextConfig } from 'next';

    const nextConfig: NextConfig = {
      output: 'standalone',
      reactStrictMode: true,
    };

    export default nextConfig;
    ```

    **`apps/web/tsconfig.json`** (extends base; Next.js needs `jsx: preserve`, `paths`):

    ```json
    {
      "extends": "../../tsconfig.base.json",
      "compilerOptions": {
        "lib": ["dom", "dom.iterable", "ES2023"],
        "jsx": "preserve",
        "module": "ESNext",
        "moduleResolution": "Bundler",
        "allowJs": true,
        "noEmit": true,
        "incremental": true,
        "isolatedModules": true,
        "plugins": [{ "name": "next" }],
        "paths": {
          "@/*": ["./*"]
        }
      },
      "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
      "exclude": ["node_modules"]
    }
    ```

    **`apps/web/app/page.tsx`** (placeholder per RESEARCH §Open Question 4):

    ```typescript
    export const metadata = {
      title: 'AI-Логист',
      description: 'Bilingual (RU/UA) logistics dispatching demo — admin coming in Phase 4',
    };

    export default function HomePage() {
      return (
        <main
          style={{
            display: 'flex',
            minHeight: '100vh',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            fontFamily: 'system-ui, sans-serif',
            background: '#0a0a0a',
            color: '#fafafa',
          }}
        >
          <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>AI-Логист</h1>
          <p style={{ fontSize: '1.125rem', opacity: 0.7, marginBottom: '2rem' }}>
            Admin web coming in Phase 4 (Zenith Admin template).
          </p>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem' }}>
            <a href="/api/health" style={{ color: '#60a5fa' }}>
              /api/health
            </a>
            <span style={{ opacity: 0.4 }}>·</span>
            <a href="/api/docs" style={{ color: '#60a5fa' }}>
              /api/docs (Swagger UI)
            </a>
          </div>
        </main>
      );
    }
    ```

    **`apps/web/app/layout.tsx`**:

    ```typescript
    import type { ReactNode } from 'react';
    import './globals.css';

    export default function RootLayout({ children }: { children: ReactNode }) {
      return (
        <html lang="ru">
          <body>{children}</body>
        </html>
      );
    }
    ```

    **`apps/web/app/globals.css`** (minimal):

    ```css
    * {
      box-sizing: border-box;
      padding: 0;
      margin: 0;
    }

    html,
    body {
      max-width: 100vw;
      overflow-x: hidden;
    }
    ```

    **`apps/web/Dockerfile`** (Next.js standalone output — slim runtime):

    ```dockerfile
    # syntax=docker/dockerfile:1
    FROM node:22-alpine AS base
    RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
    WORKDIR /app

    FROM base AS deps
    COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
    COPY apps/web/package.json apps/web/
    COPY apps/api/package.json apps/api/
    COPY packages/shared-types/package.json packages/shared-types/
    RUN pnpm install --frozen-lockfile

    FROM deps AS build
    COPY . .
    RUN pnpm --filter @ai-logist/web build

    FROM node:22-alpine AS runtime
    WORKDIR /app
    ENV NODE_ENV=production
    ENV PORT=3001
    # Next.js standalone output bundles its own server.js + minimal node_modules
    COPY --from=build /app/apps/web/.next/standalone ./
    COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
    COPY --from=build /app/apps/web/public ./apps/web/public
    WORKDIR /app/apps/web
    EXPOSE 3001
    CMD ["node", "server.js"]
    ```

    After all files: `pnpm install` at repo root must succeed (now resolves `apps/web` too). Then `pnpm --filter @ai-logist/web build` must produce `.next/standalone/`.

    Then validate the apps/api Dockerfile by attempting a build (this is heavy — it'll fail because Wave 4 hasn't written `apps/api/src/index.ts` yet, so use `docker build --target deps` to ONLY validate the deps stage):

    ```bash
    docker build --target deps -f apps/api/Dockerfile -t ailogist-api-deps:test .
    ```

    The deps target should succeed because it only needs package.json files. The full `build` target will fail until Wave 4 ships source — that's fine and expected for Phase 1, Wave 2.

    Verify the web Dockerfile similarly:

    ```bash
    docker build -f apps/web/Dockerfile -t ailogist-web:test .
    ```

    This SHOULD succeed because the web placeholder has all the source it needs.

    NOTE: if `pnpm-lock.yaml` does not yet exist (we'd see it after first pnpm install), the Dockerfile `COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./` line will fail in deps stage. Run `pnpm install` at root FIRST to generate the lockfile, THEN attempt docker build.
  </action>
  <verify>
    <automated>pnpm install 2>&1 | tail -3 && test -f pnpm-lock.yaml && pnpm --filter @ai-logist/web build 2>&1 | tail -5 && test -d apps/web/.next/standalone && docker build --target deps -f apps/api/Dockerfile -t ailogist-api-deps:test . 2>&1 | tail -3 && docker build -f apps/web/Dockerfile -t ailogist-web:test . 2>&1 | tail -3 && echo OK</automated>
  </verify>
  <done>
    `pnpm-lock.yaml` exists at root; `pnpm --filter @ai-logist/web build` produces `apps/web/.next/standalone/server.js`; `docker build --target deps` succeeds for apps/api; `docker build` succeeds for apps/web full stage.
  </done>
  <acceptance_criteria>
    - All 10 files listed in `<files>` exist (verify via `for f in apps/api/Dockerfile apps/api/.dockerignore apps/web/Dockerfile apps/web/.dockerignore apps/web/package.json apps/web/next.config.ts apps/web/tsconfig.json apps/web/app/page.tsx apps/web/app/layout.tsx apps/web/app/globals.css; do test -f "$f" || echo MISSING:$f; done`)
    - `test -f pnpm-lock.yaml` returns true
    - `pnpm --filter @ai-logist/web build` exits 0
    - `test -f apps/web/.next/standalone/apps/web/server.js` OR `test -f apps/web/.next/standalone/server.js` returns true
    - `docker build --target deps -f apps/api/Dockerfile -t ailogist-api-deps:test .` exits 0
    - `docker build -f apps/web/Dockerfile -t ailogist-web:test .` exits 0
    - `grep -q "FROM node:22-alpine" apps/api/Dockerfile` returns true
    - `grep -q "corepack prepare pnpm@9.15.0" apps/api/Dockerfile` returns true
    - `grep -q "AI-Логист" apps/web/app/page.tsx` returns true
  </acceptance_criteria>
</task>

</tasks>

<verification>
- `docker compose config -q` exits 0
- `docker compose up -d postgres redis` brings both to healthy state within 30 seconds
- `docker exec ailogist-postgres pg_isready -U ailogist -d ailogist` succeeds
- `docker exec ailogist-redis redis-cli ping` returns PONG
- `pnpm --filter @ai-logist/web build` succeeds (Next.js 16 standalone output)
- `docker build -f apps/web/Dockerfile -t ailogist-web:test .` succeeds
- `docker build --target deps -f apps/api/Dockerfile -t ailogist-api-deps:test .` succeeds (full target fails until Wave 4 — expected)
- `grep -q "handle /api/\\*" Caddyfile && ! grep -q "handle_path" Caddyfile` (correct routing per Pitfall #3)
</verification>

<success_criteria>
1. `docker compose config -q` validates yaml; all 5 services (postgres, redis, api, web, caddy) declared with correct image tags (`postgis/postgis:17-3.5`, `redis:7-alpine`, `caddy:2-alpine`).
2. Caddy uses `handle /api/*` (NOT `handle_path` — Pitfall #3) routing /api, /webhook, /ws to api:3000 and everything else to web:3001.
3. Postgres + Redis boot to healthy state via `docker compose up -d postgres redis` within 30s.
4. apps/web is a buildable Next.js 16 placeholder; `pnpm --filter @ai-logist/web build` produces `.next/standalone/server.js`.
5. apps/api Dockerfile deps stage succeeds (full build deferred to Wave 4 when src/ exists).
</success_criteria>

<output>
After completion, create `.planning/phases/01-database-backend-skeleton/01-02-SUMMARY.md` documenting:
- `docker compose ps` output showing postgres + redis healthy
- Confirmed image tags (postgis/postgis:17-3.5, redis:7-alpine, caddy:2-alpine)
- Next.js version actually installed (^16.x)
- Verification that Caddyfile uses `handle` not `handle_path`
- Any deviations (e.g., Docker not installed on Claude's runner — document that compose config + Caddyfile content were verified textually, and infrastructure boot was deferred)
</output>
