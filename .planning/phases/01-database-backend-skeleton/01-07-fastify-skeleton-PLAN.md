---
phase: 01-database-backend-skeleton
plan: 07
type: execute
wave: 7
depends_on: ["01-06"]
files_modified:
  - apps/api/package.json
  - apps/api/src/index.ts
  - apps/api/src/app.ts
  - apps/api/src/plugins/db.ts
  - apps/api/src/plugins/redis.ts
  - apps/api/src/routes/health.ts
  - packages/shared-types/src/api/health.ts
  - packages/shared-types/src/index.ts
  - apps/api/drizzle/0001_init.sql
  - apps/api/drizzle/meta/_journal.json
  - apps/api/tests/integration/health.test.ts
  - apps/api/tests/unit/phase-1-stubs.test.ts
autonomous: true
requirements: ["API-01", "API-16"]
must_haves:
  truths:
    - "Fastify buildApp() registers sensible + db plugin + redis plugin + swagger + zod type provider + /api/health route"
    - "GET /api/health returns 200 with checks.db='ok', checks.postgis matching /3\\.5/, checks.redis='ok' when infra is up"
    - "GET /api/health returns 503 with degraded status when any subsystem fails (db/postgis/redis)"
    - "packages/shared-types exports HealthResponseSchema (Zod v4)"
    - "drizzle-kit generate produces 0001_init.sql containing all 13 tables + 7 ENUMs + GiST indexes + CHECK SRID constraints"
    - "drizzle-kit migrate applies 0001 cleanly; re-run is idempotent (zero diff)"
    - "Integration test against testcontainers PostGIS passes for /api/health 200 + 503 degradation"
  artifacts:
    - path: "apps/api/src/app.ts"
      provides: "buildApp(): FastifyInstance with all plugins + zod + swagger + routes"
      exports: ["buildApp"]
    - path: "apps/api/src/index.ts"
      provides: "Entry point — listens on config.PORT, graceful shutdown"
      contains: "app.listen"
    - path: "apps/api/src/plugins/db.ts"
      provides: "Fastify plugin decorating app with `db` (Drizzle) and `pgPool`"
      exports: ["dbPlugin"]
    - path: "apps/api/src/plugins/redis.ts"
      provides: "Fastify plugin decorating app with `redis` (ioredis)"
      exports: ["redisPlugin"]
    - path: "apps/api/src/routes/health.ts"
      provides: "GET /api/health route with full Zod schema + PostGIS_Version() check"
      exports: ["healthRoutes"]
    - path: "packages/shared-types/src/api/health.ts"
      provides: "HealthResponseSchema (Zod v4)"
      exports: ["HealthResponseSchema", "HealthResponse"]
    - path: "apps/api/drizzle/0001_init.sql"
      provides: "Generated migration with all 13 tables, 7 ENUMs, indexes, CHECK constraints"
      contains: "geography(Point, 4326)"
  key_links:
    - from: "apps/api/src/app.ts"
      to: "apps/api/src/plugins/db.ts + redis.ts + routes/health.ts"
      via: "app.register()"
      pattern: "register\\("
    - from: "apps/api/src/routes/health.ts"
      to: "app.db (Drizzle) + app.redis (ioredis)"
      via: "Fastify decorators set by plugins"
      pattern: "app\\.db|app\\.redis"
    - from: "packages/shared-types/src/api/health.ts"
      to: "apps/api/src/routes/health.ts"
      via: "Schema import"
      pattern: "HealthResponseSchema"
---

<objective>
Wave 7 ships the Fastify skeleton: `buildApp()` with all plugins (sensible, db, redis, swagger), Zod type provider wiring (Pitfall #4: use `zod/v4` imports), pino logging per D-17, the FULL `/api/health` route returning PostGIS version (API-01), `HealthResponseSchema` in `packages/shared-types` (API-16), `drizzle-kit generate` produces the consolidated init migration (covering all 13 schema tables from Waves 3a-3d), `drizzle-kit migrate` applies it cleanly to Docker Postgres, and an integration test using testcontainers proves the /api/health route works end-to-end.

This is the bedrock for Plan 01-08 (501 stubs) and Plan 01-09 (seed). After this plan, `pnpm dev` boots a real Fastify app that answers `curl http://localhost:3000/api/health` with PostGIS_Version().

Purpose: Close API-01 + API-16 (Phase 1 has only 3 API-* reqs; this plan handles 2 of them; Plan 01-08 handles the rest via 501 stubs).

Output: 12 files (Fastify skeleton + plugins + health route + shared-types health schema + generated migration + journal + integration test + test stub flip).
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
@apps/api/src/config.ts
@apps/api/src/db.ts
@apps/api/src/persistence/schema/index.ts
@apps/api/drizzle/0000_postgis_extension.sql
@packages/shared-types/src/index.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Install Fastify stack + write app.ts, index.ts, plugins, shared-types HealthResponseSchema, routes/health.ts</name>
  <read_first>
    - apps/api/src/config.ts (Wave 3a)
    - apps/api/src/db.ts (Wave 3a)
    - apps/api/src/persistence/schema/index.ts (Wave 3d — all 13 tables exported)
    - packages/shared-types/src/index.ts (Wave 1 — empty barrel)
    - .planning/phases/01-database-backend-skeleton/01-RESEARCH.md — sections "Standard Stack" (versions), "Fastify v5 app bootstrap with swagger + zod + sensible", "Drizzle DB plugin", "Redis plugin", "/api/health route with PostGIS version", "Pitfall 4: Zod v4 import paths", "Pitfall 5: pino-pretty in production"
    - .planning/phases/01-database-backend-skeleton/01-CONTEXT.md — D-14, D-16, D-17, D-26, D-27
  </read_first>
  <behavior>
    - Fastify boots without error when DATABASE_URL + REDIS_URL are valid and Postgres+Redis are reachable.
    - GET /api/health returns 200 + `{status:'ok', version, uptime_s, checks: {db:'ok', postgis: '3.5.x', redis:'ok'}}` when everything is up.
    - GET /api/health returns 503 + `{status:'degraded', …}` if any check fails.
    - Zod v4 schema rejects responses that don't match shape (caught by `serializerCompiler`).
    - Swagger UI mounts at `/api/docs`.
    - Pino logs JSON in production, pretty in development.
  </behavior>
  <files>
    - apps/api/package.json
    - apps/api/src/index.ts
    - apps/api/src/app.ts
    - apps/api/src/plugins/db.ts
    - apps/api/src/plugins/redis.ts
    - apps/api/src/routes/health.ts
    - packages/shared-types/src/api/health.ts
    - packages/shared-types/src/index.ts
  </files>
  <action>
    Multi-step. Each step has a verbatim source from RESEARCH.md.

    Step 1: Install Fastify + plugins + pino + ioredis + nanoid + fastify-plugin. From repo root:

    ```bash
    pnpm --filter @ai-logist/api add fastify@5.8.5 \
      "@fastify/swagger@^9.7" \
      "@fastify/swagger-ui@^5.2" \
      "@fastify/sensible@^6.0" \
      "fastify-plugin@^5" \
      "fastify-type-provider-zod@^6.1" \
      "ioredis@^5.11" \
      "pino@^10.3" \
      "nanoid@^5"
    pnpm --filter @ai-logist/api add -D "pino-pretty@^13.1"
    ```

    Edit `apps/api/package.json` (Edit, do not overwrite):
    - Add scripts: `"dev": "tsx watch --env-file=../../.env.local src/index.ts"`, `"build": "tsc -p tsconfig.json"`, `"start": "node --env-file=.env.local dist/index.js"`
    - Keep all Wave 0/1/3 scripts (test, db:migrate, db:generate, etc.)

    Step 2: Create `packages/shared-types/src/api/health.ts` (per RESEARCH.md §"`/api/health` route" — extracted as shared schema per D-27):

    ```typescript
    import { z } from 'zod/v4';

    export const HealthResponseSchema = z.object({
      status: z.enum(['ok', 'degraded']),
      version: z.string(),
      uptime_s: z.number(),
      checks: z.object({
        db: z.enum(['ok', 'fail']),
        postgis: z.string(), // version string, or 'fail'
        redis: z.enum(['ok', 'fail']),
      }),
    });

    export type HealthResponse = z.infer<typeof HealthResponseSchema>;
    ```

    Edit `packages/shared-types/src/index.ts` to re-export:

    ```typescript
    // @ai-logist/shared-types — Phase 1
    export const SHARED_TYPES_VERSION = '0.0.0';

    export * from './api/health.js';
    ```

    Rebuild: `pnpm --filter @ai-logist/shared-types build`.

    Step 3: Create `apps/api/src/plugins/db.ts` per RESEARCH.md (copy VERBATIM):

    ```typescript
    import fp from 'fastify-plugin';
    import pg from 'pg';
    import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
    import * as schema from '../persistence/schema/index.js';
    import { config } from '../config.js';

    const { Pool } = pg;

    declare module 'fastify' {
      interface FastifyInstance {
        db: NodePgDatabase<typeof schema>;
        pgPool: pg.Pool;
      }
    }

    export const dbPlugin = fp(
      async (app) => {
        const pool = new Pool({
          connectionString: config.DATABASE_URL,
          max: 10,
          idleTimeoutMillis: 30_000,
        });

        // Smoke-test on boot — fail fast if DB is down
        await pool.query('SELECT 1');

        const db = drizzle(pool, { schema });

        app.decorate('db', db);
        app.decorate('pgPool', pool);

        app.addHook('onClose', async () => {
          await pool.end();
        });
      },
      { name: 'db' }
    );
    ```

    Step 4: Create `apps/api/src/plugins/redis.ts` per RESEARCH.md (copy VERBATIM):

    ```typescript
    import fp from 'fastify-plugin';
    import Redis from 'ioredis';
    import { config } from '../config.js';

    declare module 'fastify' {
      interface FastifyInstance {
        redis: Redis;
      }
    }

    export const redisPlugin = fp(
      async (app) => {
        const redis = new Redis(config.REDIS_URL, {
          maxRetriesPerRequest: null, // required for BullMQ in Phase 5
          enableReadyCheck: true,
          lazyConnect: false,
        });

        await redis.ping();

        app.decorate('redis', redis);

        app.addHook('onClose', async () => {
          redis.disconnect();
        });
      },
      { name: 'redis' }
    );
    ```

    Step 5: Create `apps/api/src/routes/health.ts` per RESEARCH.md (copy VERBATIM, but import `HealthResponseSchema` from shared-types per D-27):

    ```typescript
    import { sql } from 'drizzle-orm';
    import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
    import { HealthResponseSchema } from '@ai-logist/shared-types/api/health';
    import { config } from '../config.js';

    const startedAt = Date.now();

    const healthRoutes: FastifyPluginAsyncZod = async (app) => {
      app.get(
        '/health',
        {
          schema: {
            tags: ['system'],
            summary: 'Health check',
            response: { 200: HealthResponseSchema, 503: HealthResponseSchema },
          },
        },
        async (_req, reply) => {
          const checks = {
            db: 'fail' as 'ok' | 'fail',
            postgis: 'fail',
            redis: 'fail' as 'ok' | 'fail',
          };

          try {
            await app.db.execute(sql`SELECT 1`);
            checks.db = 'ok';
          } catch (err) {
            app.log.error(err, 'db health check failed');
          }

          try {
            const r = await app.db.execute<{ postgis_version: string }>(
              sql`SELECT PostGIS_Version() AS postgis_version`
            );
            checks.postgis = r.rows[0]?.postgis_version ?? 'fail';
          } catch (err) {
            app.log.error(err, 'postgis health check failed');
          }

          try {
            const pong = await app.redis.ping();
            if (pong === 'PONG') checks.redis = 'ok';
          } catch (err) {
            app.log.error(err, 'redis health check failed');
          }

          const allOk =
            checks.db === 'ok' && checks.postgis !== 'fail' && checks.redis === 'ok';
          const body = {
            status: allOk ? ('ok' as const) : ('degraded' as const),
            version: config.VERSION,
            uptime_s: Math.floor((Date.now() - startedAt) / 1000),
            checks,
          };

          return reply.status(allOk ? 200 : 503).send(body);
        }
      );
    };

    export default healthRoutes;
    ```

    Step 6: Create `apps/api/src/app.ts` per RESEARCH.md (copy VERBATIM). Note: we'll register the leads/orders/etc. 501-stub routes in Plan 01-08, so import/register only the modules that exist now. For Wave 7, ONLY register healthRoutes:

    ```typescript
    import Fastify, { type FastifyInstance } from 'fastify';
    import sensible from '@fastify/sensible';
    import swagger from '@fastify/swagger';
    import swaggerUi from '@fastify/swagger-ui';
    import {
      jsonSchemaTransform,
      serializerCompiler,
      validatorCompiler,
      type ZodTypeProvider,
    } from 'fastify-type-provider-zod';
    import { config } from './config.js';
    import { dbPlugin } from './plugins/db.js';
    import { redisPlugin } from './plugins/redis.js';
    import healthRoutes from './routes/health.js';

    export async function buildApp(): Promise<FastifyInstance> {
      const app = Fastify({
        logger: {
          level: config.LOG_LEVEL,
          ...(config.NODE_ENV === 'development'
            ? {
                transport: {
                  target: 'pino-pretty',
                  options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
                },
              }
            : {}),
        },
        disableRequestLogging: false,
        requestIdHeader: 'x-request-id',
      }).withTypeProvider<ZodTypeProvider>();

      app.setValidatorCompiler(validatorCompiler);
      app.setSerializerCompiler(serializerCompiler);

      await app.register(sensible);
      await app.register(dbPlugin);
      await app.register(redisPlugin);

      await app.register(swagger, {
        openapi: {
          info: {
            title: 'AI-Логист API',
            description: 'Logistics dispatching backend — Phase 1 skeleton',
            version: config.VERSION,
          },
          servers: [{ url: '/' }],
        },
        transform: jsonSchemaTransform,
      });
      await app.register(swaggerUi, { routePrefix: '/api/docs' });

      // Routes — only /api/health implemented in Wave 7; 501 stubs land in Plan 01-08
      await app.register(healthRoutes, { prefix: '/api' });

      return app;
    }
    ```

    Step 7: Create `apps/api/src/index.ts` per RESEARCH.md (copy VERBATIM):

    ```typescript
    import { buildApp } from './app.js';
    import { config } from './config.js';

    const app = await buildApp();

    try {
      await app.listen({ port: config.PORT, host: config.HOST });
    } catch (err) {
      app.log.fatal(err, 'server failed to start');
      process.exit(1);
    }

    const close = async (signal: string) => {
      app.log.info({ signal }, 'shutting down');
      await app.close();
      process.exit(0);
    };
    process.on('SIGINT', () => void close('SIGINT'));
    process.on('SIGTERM', () => void close('SIGTERM'));
    ```

    Step 8: Verify TS compiles, Biome passes.

    ```bash
    pnpm exec tsc --noEmit -p apps/api/tsconfig.json
    pnpm exec biome check apps/api/src packages/shared-types/src
    ```

    Step 9: Start the API and smoke-test (Postgres + Redis from Wave 2 must be up):

    ```bash
    # Ensure infra is up
    docker compose up -d postgres redis

    # Apply migrations (Wave 3a's 0000; Plan Task 2 below adds 0001)
    pnpm db:migrate

    # Start API in a background process for ~10s
    pnpm dev &
    DEV_PID=$!
    sleep 5
    curl -s http://localhost:3000/api/health | tee /tmp/health.json
    kill $DEV_PID 2>/dev/null || true
    ```

    The response should be 200 with `checks.postgis` matching `/3\.5/`.
  </action>
  <verify>
    <automated>pnpm exec tsc --noEmit -p apps/api/tsconfig.json 2>&1 | tail -3 && pnpm exec biome check apps/api/src packages/shared-types/src 2>&1 | tail -3 && pnpm --filter @ai-logist/shared-types build 2>&1 | tail -3 && test -f apps/api/src/index.ts && test -f apps/api/src/app.ts && test -f apps/api/src/plugins/db.ts && test -f apps/api/src/plugins/redis.ts && test -f apps/api/src/routes/health.ts && test -f packages/shared-types/src/api/health.ts && grep -q "HealthResponseSchema" packages/shared-types/src/api/health.ts && grep -q "withTypeProvider" apps/api/src/app.ts && grep -q "PostGIS_Version" apps/api/src/routes/health.ts && echo OK</automated>
  </verify>
  <done>
    All 8 files exist; TS strict + Biome clean; HealthResponseSchema exported from shared-types; app.ts uses zod type provider + swagger + sensible + db + redis plugins.
  </done>
  <acceptance_criteria>
    - All 8 files exist (verify each with `test -f`)
    - `grep -q "buildApp" apps/api/src/app.ts && grep -q "withTypeProvider<ZodTypeProvider>" apps/api/src/app.ts` returns 0
    - `grep -q "@fastify/sensible" apps/api/src/app.ts && grep -q "@fastify/swagger" apps/api/src/app.ts && grep -q "@fastify/swagger-ui" apps/api/src/app.ts` returns 0
    - `grep -q "dbPlugin\\|redisPlugin" apps/api/src/app.ts` returns 0
    - `grep -q "HealthResponseSchema" apps/api/src/routes/health.ts && grep -q "PostGIS_Version" apps/api/src/routes/health.ts && grep -q "app.redis.ping" apps/api/src/routes/health.ts` returns 0
    - `grep -q "import { z } from 'zod/v4'" packages/shared-types/src/api/health.ts` returns 0
    - `grep -q "decorate('db'" apps/api/src/plugins/db.ts && grep -q "decorate('redis'" apps/api/src/plugins/redis.ts` returns 0
    - `pnpm --filter @ai-logist/shared-types build` exits 0
    - `pnpm exec tsc --noEmit -p apps/api/tsconfig.json` exits 0
    - `pnpm exec biome check apps/api/src packages/shared-types/src` exits 0
  </acceptance_criteria>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Generate + apply 0001_init.sql via drizzle-kit; integration test of /api/health against testcontainers</name>
  <read_first>
    - apps/api/drizzle.config.ts (Wave 3a)
    - apps/api/drizzle/0000_postgis_extension.sql (Wave 3a)
    - apps/api/src/persistence/schema/index.ts (Wave 3d — all 13 tables)
    - apps/api/tests/_helpers/test-db.ts (Wave 0)
    - apps/api/src/app.ts (Task 1)
    - .planning/phases/01-database-backend-skeleton/01-RESEARCH.md — sections "First (CREATE EXTENSION) migration via --custom", "Then generate the rest" — `drizzle-kit generate --name=init`
  </read_first>
  <behavior>
    - `drizzle-kit generate --name=init` produces a `drizzle/0001_init.sql` file containing all 7 ENUM types + all 13 tables + all GiST indexes + all CHECK constraints.
    - The generated SQL contains the literal `geography(Point, 4326)` on every geo column.
    - `drizzle-kit migrate` applies 0001 cleanly against the live Docker Postgres.
    - Re-running `drizzle-kit check` (or generate after migrate) produces zero new statements (idempotency check per D-23).
    - Integration test boots a testcontainers PostGIS 17-3.5 container, applies BOTH migrations, builds the Fastify app pointed at the container, calls `app.inject({ method: 'GET', url: '/api/health' })`, asserts 200 + `checks.postgis ~ /3.5/`.
  </behavior>
  <files>
    - apps/api/drizzle/0001_init.sql
    - apps/api/drizzle/meta/_journal.json
    - apps/api/tests/integration/health.test.ts
    - apps/api/tests/unit/phase-1-stubs.test.ts
  </files>
  <action>
    Step 1: Ensure postgres + redis containers are healthy:

    ```bash
    docker compose up -d postgres redis
    docker exec ailogist-postgres pg_isready -U ailogist -d ailogist
    ```

    Step 2: Generate the init migration. Run from repo root:

    ```bash
    pnpm db:generate -- --name=init
    ```

    OR if pnpm doesn't forward args cleanly:

    ```bash
    cd apps/api && pnpm exec drizzle-kit generate --name=init
    ```

    drizzle-kit will read `drizzle.config.ts`, introspect `src/persistence/schema/index.ts`, and emit `drizzle/0001_init.sql` plus update `drizzle/meta/_journal.json` and a snapshot file `drizzle/meta/0001_snapshot.json`.

    Verify the generated SQL contains the expected DDL:
    ```bash
    grep -c "geography(Point, 4326)" apps/api/drizzle/0001_init.sql   # should be 5 (cities, trucks, truck_positions, order_events, pod_artifacts)
    grep -c "USING gist" apps/api/drizzle/0001_init.sql                # should be at least 4 (cities, trucks, truck_positions, possibly order_events geom)
    grep -c "CHECK" apps/api/drizzle/0001_init.sql                     # should be at least 4
    grep -q "CREATE TYPE \"public\".\"lead_stage\"" apps/api/drizzle/0001_init.sql   # ENUM
    grep -q "CREATE TABLE \"clients\"" apps/api/drizzle/0001_init.sql
    grep -q "CREATE TABLE \"trucks\"" apps/api/drizzle/0001_init.sql
    grep -q "CREATE TABLE \"webhook_updates\"" apps/api/drizzle/0001_init.sql
    ```

    NOTE: If drizzle-kit splits the migration into multiple SQL files (e.g. one per breakpoint), check whichever file contains the tables. The file name might be `0001_init.sql` OR something like `0001_smiling_xxx.sql`. Adjust verify commands to use the actual filename. If drizzle-kit's introspect emitted a column type like `point` instead of `geography(Point, 4326)`, the customType is broken — debug `_columns.ts` `dataType()` return.

    Step 3: Apply the migration:

    ```bash
    pnpm db:migrate
    ```

    Verify all 13 tables exist:
    ```bash
    docker exec ailogist-postgres psql -U ailogist -d ailogist -tAc "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;"
    ```
    Expected output includes: bourse_cache, calls, cities, clients, leads, messages, order_events, orders, pod_artifacts, pricing_config, truck_positions, trucks, webhook_updates (13 + `__drizzle_migrations` = 14 rows).

    Verify idempotency:
    ```bash
    pnpm exec drizzle-kit check 2>&1 | head -10
    pnpm db:migrate 2>&1 | tail -3    # should report "No migrations to apply"
    ```

    Step 4: Write integration test `apps/api/tests/integration/health.test.ts`:

    ```typescript
    import { afterAll, beforeAll, describe, expect, test } from 'vitest';
    import { exec as execCb } from 'node:child_process';
    import { promisify } from 'node:util';
    import path from 'node:path';
    import {
      startPostgisContainer,
      stopPostgisContainer,
      getTestDbUrl,
    } from '../_helpers/test-db.js';

    const exec = promisify(execCb);

    describe('GET /api/health (integration)', () => {
      let dbUrl: string;
      let originalDbUrl: string | undefined;
      let originalRedisUrl: string | undefined;
      let buildApp: typeof import('../../src/app.js').buildApp;

      beforeAll(async () => {
        dbUrl = await startPostgisContainer();
        originalDbUrl = process.env.DATABASE_URL;
        originalRedisUrl = process.env.REDIS_URL;
        process.env.DATABASE_URL = dbUrl;
        // For integration tests assume Redis from docker-compose is on localhost:6379
        process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

        // Apply migrations against the test container
        await exec(
          `node --env-file-if-exists=../../.env.local --import tsx ./node_modules/.bin/drizzle-kit migrate`,
          {
            cwd: path.resolve(import.meta.dirname, '..', '..'),
            env: { ...process.env, DATABASE_URL: dbUrl },
          }
        );

        // Re-import app.ts AFTER env vars are set so config.ts picks up the test DB
        const mod = await import('../../src/app.js');
        buildApp = mod.buildApp;
      }, 90_000);

      afterAll(async () => {
        await stopPostgisContainer();
        if (originalDbUrl !== undefined) process.env.DATABASE_URL = originalDbUrl;
        if (originalRedisUrl !== undefined) process.env.REDIS_URL = originalRedisUrl;
      });

      test('returns 200 with PostGIS version when all subsystems are up', async () => {
        const app = await buildApp();
        try {
          const res = await app.inject({ method: 'GET', url: '/api/health' });
          expect(res.statusCode).toBe(200);
          const body = res.json();
          expect(body.status).toBe('ok');
          expect(body.checks.db).toBe('ok');
          expect(body.checks.postgis).toMatch(/3\.5/);
          expect(body.checks.redis).toBe('ok');
        } finally {
          await app.close();
        }
      });

      test('API-16: invalid response shape would be caught by Zod serializer (smoke check on schema export)', async () => {
        const { HealthResponseSchema } = await import('@ai-logist/shared-types/api/health');
        const valid = HealthResponseSchema.safeParse({
          status: 'ok',
          version: 'dev',
          uptime_s: 1,
          checks: { db: 'ok', postgis: '3.5.0', redis: 'ok' },
        });
        expect(valid.success).toBe(true);

        const invalid = HealthResponseSchema.safeParse({
          status: 'whatever',
          version: 'dev',
          uptime_s: 1,
          checks: { db: 'ok', postgis: '3.5.0', redis: 'ok' },
        });
        expect(invalid.success).toBe(false);
      });
    });
    ```

    NOTE on test-db.ts: Wave 0 wrote `test-db.ts` with the testcontainers helper. This test depends on Docker being available (testcontainers spins up a real `postgis/postgis:17-3.5` container). If Docker isn't available on the runner, the test will fail. That's acceptable — it documents the contract.

    NOTE on Redis: the integration test reuses `localhost:6379` (the docker-compose redis container from Wave 2) rather than spinning a per-test Redis container, for speed. If Redis isn't running, this test will degrade to 503 — which is correctly handled by the assertion on `checks.redis === 'ok'`. Run `docker compose up -d redis` before invoking the test suite.

    Step 5: Flip API-01 + API-16 unit test stubs. Edit `apps/api/tests/unit/phase-1-stubs.test.ts`:

    ```typescript
      // Replace test.todo for API-01 with the integration assertion. Since /api/health
      // is real-DB-bound, the meaningful coverage lives in tests/integration/health.test.ts.
      // For the unit suite we assert the route file exports the handler and the schema is wired.
      test('API-01: /api/health route file exports plugin + uses PostGIS_Version', async () => {
        const fs = await import('node:fs/promises');
        const src = await fs.readFile('src/routes/health.ts', 'utf-8');
        expect(src).toMatch(/PostGIS_Version/);
        expect(src).toMatch(/app\.redis\.ping/);
        expect(src).toMatch(/HealthResponseSchema/);
      });

      test('API-16: HealthResponseSchema is exported from @ai-logist/shared-types/api/health', async () => {
        const mod = await import('@ai-logist/shared-types/api/health');
        expect(mod.HealthResponseSchema).toBeDefined();
        const valid = mod.HealthResponseSchema.safeParse({
          status: 'ok',
          version: 'dev',
          uptime_s: 1,
          checks: { db: 'ok', postgis: '3.5.0', redis: 'ok' },
        });
        expect(valid.success).toBe(true);
      });
    ```

    Run all unit tests: `cd apps/api && pnpm exec vitest run --project unit`. Expected: 12 passing (DB-01..09 minus DB-10 = 8, + API-01, API-02, API-16 = 11, + ... wait let me recount).

    Previous (after Wave 3d): 10 passing (DB-01..09 minus DB-10 = 8, plus API-02 = 9 ... actually wait, DB-01..09 minus DB-10 = 8 tests if DB-07 and DB-09 pass; DB-10 is still todo). Let me recount:
    - DB-01 ✅
    - DB-02 ✅
    - DB-03 ✅
    - DB-04 ✅
    - DB-05 ✅
    - DB-06 ✅
    - DB-07 ✅
    - DB-08 ✅
    - DB-09 ✅
    - API-02 ✅
    Total so far: 10 passing.
    Todos: DB-10, API-01, API-16, DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04 = 7.

    After this task flips API-01 + API-16:
    - 10 + 2 = 12 passing.
    - 7 - 2 = 5 todo (DB-10, DEPLOY-01..04).
  </action>
  <verify>
    <automated>cd apps/api && pnpm exec drizzle-kit generate --name=init 2>&1 | tail -5 && ls apps/api/drizzle/ | grep -E "0001.*\\.sql" && grep -c "geography(Point, 4326)" apps/api/drizzle/0001*.sql | xargs -I {} test {} -ge 5 && grep -q "CREATE TABLE \"trucks\"" apps/api/drizzle/0001*.sql && grep -q "CREATE TABLE \"webhook_updates\"" apps/api/drizzle/0001*.sql && pnpm db:migrate 2>&1 | tail -3 && docker exec ailogist-postgres psql -U ailogist -d ailogist -tAc "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename NOT LIKE '\\_\\_%'" | tr -d ' ' | xargs -I {} test {} -ge 13 && pnpm db:migrate 2>&1 | grep -iE "no migration|nothing to migrate|0 applied" && cd apps/api && pnpm exec vitest run --project unit 2>&1 | tail -5 && pnpm exec vitest run --project unit 2>&1 | grep -q "12 passed" && cd apps/api && pnpm exec vitest run --project integration 2>&1 | tail -5 && echo OK</automated>
  </verify>
  <done>
    `drizzle-kit generate --name=init` produces 0001 migration; `drizzle-kit migrate` applies it; all 13 user tables exist in DB; re-run is idempotent; integration test passes against testcontainers PostGIS; unit suite 12 passing / 5 todo.
  </done>
  <acceptance_criteria>
    - `ls apps/api/drizzle/ | grep -q "0001.*\\.sql"` returns 0 (init migration file exists)
    - `grep -c "geography(Point, 4326)" apps/api/drizzle/0001*.sql` is at least 5 (cities, trucks, truck_positions, order_events.geom, pod_artifacts.gps)
    - `grep -c "USING gist" apps/api/drizzle/0001*.sql` is at least 3 (cities, trucks, truck_positions)
    - `grep -c "CHECK" apps/api/drizzle/0001*.sql` is at least 3 (one CHECK per geo table)
    - `grep -c "CREATE TYPE" apps/api/drizzle/0001*.sql` is at least 7 (the 7 pgEnums)
    - `pnpm db:migrate` exits 0 (first run applies, second run says no migrations to apply)
    - `docker exec ailogist-postgres psql -U ailogist -d ailogist -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name NOT LIKE '\\_\\_%'"` returns at least 13
    - `cd apps/api && pnpm exec vitest run --project unit` exits 0 with 12 passing / 5 todo
    - `cd apps/api && pnpm exec vitest run --project integration` runs the health.test.ts file; if Docker is available, exits 0; if not, document the failure as environmental
    - `test -f apps/api/tests/integration/health.test.ts` returns 0
  </acceptance_criteria>
</task>

</tasks>

<verification>
- `pnpm exec tsc --noEmit -p apps/api/tsconfig.json` passes
- `pnpm exec biome check .` passes
- `pnpm db:generate` produces 0001 init migration with all 13 tables, 7 ENUMs, GiST indexes, CHECK constraints
- `pnpm db:migrate` applies all migrations cleanly (0000 + 0001); re-running is idempotent (zero diff)
- Live API smoke: `pnpm dev &` then `curl http://localhost:3000/api/health` returns 200 with `checks.postgis ~ /3.5/`
- Live Swagger UI: `http://localhost:3000/api/docs` renders the `/api/health` route
- Integration test passes against testcontainers postgis/postgis:17-3.5 (when Docker is available on runner)
- Unit suite: 12 passing / 5 todo
</verification>

<success_criteria>
1. Fastify v5.8.5 + Zod v4 + Swagger + sensible stack installed and wired per RESEARCH.md (no deviation from documented versions).
2. `buildApp()` registers all 5 plugins in correct order: sensible → db → redis → swagger → swaggerUi → healthRoutes.
3. GET /api/health returns 200 with `{status:'ok', version, uptime_s, checks: {db:'ok', postgis: <3.5.x>, redis:'ok'}}` and 503 if any subsystem fails (per D-16).
4. `HealthResponseSchema` lives in `packages/shared-types/src/api/health.ts` per D-27; imported by route via `@ai-logist/shared-types/api/health`.
5. `drizzle-kit generate --name=init` produces `0001_init.sql` with all 13 tables, 7 ENUMs, GiST indexes, CHECK constraints; `drizzle-kit migrate` applies cleanly and is idempotent.
6. Integration test against testcontainers PostGIS 17-3.5 boots, applies migrations, hits /api/health via `app.inject()`, asserts 200 + PostGIS version.
7. Unit suite: API-01, API-16 stubs flipped to passing; total 12 passing / 5 todo.
</success_criteria>

<output>
After completion, create `.planning/phases/01-database-backend-skeleton/01-07-SUMMARY.md` documenting:
- Fastify, swagger, type-provider-zod, ioredis, pino versions actually installed
- The exact filename drizzle-kit produced (e.g., `0001_init.sql` vs `0001_some_name.sql`)
- Table count in DB (`SELECT count(*) FROM pg_tables WHERE schemaname='public'`) — should be 13 user tables + `__drizzle_migrations` = 14
- Output of `curl http://localhost:3000/api/health` (the real response with PostGIS version)
- Integration test result (number of tests passed)
- Unit suite count: 12 passing / 5 todo
- Confirmation that Plan 01-08 can register the 501-stub routes without further infra work
</output>
