---
phase: 01-database-backend-skeleton
plan: 03
type: execute
wave: 3
depends_on: ["01-01", "01-02"]
files_modified:
  - apps/api/package.json
  - apps/api/drizzle.config.ts
  - apps/api/src/config.ts
  - apps/api/src/db.ts
  - apps/api/src/persistence/schema/index.ts
  - apps/api/src/persistence/schema/_enums.ts
  - apps/api/src/persistence/schema/_columns.ts
  - apps/api/drizzle/0000_postgis_extension.sql
  - .env.local
autonomous: true
requirements: ["DB-01"]
must_haves:
  truths:
    - "drizzle-kit migrate runs 0000_postgis_extension.sql against the docker postgres and SELECT PostGIS_Version() succeeds"
    - "geographyPoint customType is exported and emits the SQL literal geography(Point, 4326) as its dataType()"
    - "All 7 pgEnum types (lead_stage, order_status, order_event_type, body_type_t, truck_status, client_lang, webhook_source) are declared and re-exported from schema/index.ts"
    - "drizzle.config.ts uses extensionsFilters [postgis] so drizzle-kit ignores PostGIS-owned objects on diff"
  artifacts:
    - path: "apps/api/src/persistence/schema/_columns.ts"
      provides: "geographyPoint customType + LngLat type"
      exports: ["geographyPoint", "LngLat"]
    - path: "apps/api/src/persistence/schema/_enums.ts"
      provides: "7 pgEnum declarations matching D-06 + webhook_source"
      exports: ["leadStageEnum", "orderStatusEnum", "orderEventTypeEnum", "bodyTypeEnum", "truckStatusEnum", "clientLangEnum", "webhookSourceEnum"]
    - path: "apps/api/drizzle.config.ts"
      provides: "Drizzle Kit config — schema, out, dialect, extensionsFilters"
      contains: "extensionsFilters"
    - path: "apps/api/drizzle/0000_postgis_extension.sql"
      provides: "First migration — CREATE EXTENSION IF NOT EXISTS postgis (alone, no tables)"
      contains: "CREATE EXTENSION IF NOT EXISTS postgis"
    - path: "apps/api/src/db.ts"
      provides: "Drizzle client + pg.Pool factory (for migrate, seed, tests)"
      exports: ["createPool", "createDb", "Db"]
    - path: "apps/api/src/config.ts"
      provides: "Zod-validated config (Phase 1 minimal env per D-15)"
      exports: ["config", "AppConfig"]
  key_links:
    - from: "apps/api/src/persistence/schema/_columns.ts"
      to: "drizzle-orm/pg-core customType"
      via: "customType wrapper"
      pattern: "customType<"
    - from: "apps/api/drizzle.config.ts"
      to: "process.env.DATABASE_URL"
      via: "dbCredentials.url"
      pattern: "DATABASE_URL"
    - from: "apps/api/drizzle/0000_postgis_extension.sql"
      to: "PostGIS extension"
      via: "CREATE EXTENSION"
      pattern: "CREATE EXTENSION IF NOT EXISTS postgis"
---

<objective>
Wave 3a installs Drizzle 0.45.2 + pg + drizzle-kit, ships the foundation files that every schema table will depend on (customType `geographyPoint`, pgEnums, drizzle.config.ts), creates the standalone PostGIS extension migration, and verifies it applies cleanly against the live Docker Postgres.

Per RESEARCH.md Pitfall #2 + CONTEXT D-01: extension creation MUST be its own migration so the `geography` type exists before any table tries to use it. Per RESEARCH.md Pitfall #1: Drizzle 0.45.2 has NO `geography()` helper — we hand-roll the customType wrapper per the exact pattern in RESEARCH.md.

Purpose: Lock down the geo + enum primitives so Wave 3b/3c/3d can declare table after table without re-inventing the wheel.

Output: 8 files. After this plan, `pnpm db:migrate` works against the live Docker DB and `SELECT PostGIS_Version()` succeeds.
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
@.env.example
@docker-compose.yml
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Install drizzle stack + write config.ts, db.ts, drizzle.config.ts</name>
  <read_first>
    - apps/api/package.json (Wave 0+1 — keep existing scripts and deps; we extend)
    - .env.example
    - .planning/phases/01-database-backend-skeleton/01-RESEARCH.md — sections "Standard Stack", "Zod env validation config.ts", "Drizzle DB plugin", "drizzle.config.ts", "Pitfall 4: Zod v4 + fastify-type-provider-zod v6 import paths"
    - .planning/phases/01-database-backend-skeleton/01-CONTEXT.md — D-13, D-14, D-15
  </read_first>
  <files>
    - apps/api/package.json
    - apps/api/drizzle.config.ts
    - apps/api/src/config.ts
    - apps/api/src/db.ts
    - .env.local
  </files>
  <action>
    Install Drizzle stack and create the env + db primitives.

    Step 1: Install dependencies. Run from repo root:

    ```bash
    pnpm --filter @ai-logist/api add drizzle-orm@0.45.2 pg@^8.21.0 zod@^4.4.3
    pnpm --filter @ai-logist/api add -D drizzle-kit@^0.31.10 @types/pg@^8.11.0 tsx@^4.22.0
    ```

    Edit `apps/api/package.json` (do NOT overwrite — merge with existing Wave 0/1 contents). Add these scripts:

    - `"db:generate": "drizzle-kit generate"`
    - `"db:migrate": "node --env-file=../../.env.local --import tsx ./node_modules/.bin/drizzle-kit migrate"`
    - `"db:studio": "drizzle-kit studio"`
    - `"db:migrate:check": "drizzle-kit check"`

    Step 2: Create `apps/api/drizzle.config.ts` per RESEARCH.md — copy VERBATIM:

    ```typescript
    import 'node:process';
    import { defineConfig } from 'drizzle-kit';

    export default defineConfig({
      schema: './src/persistence/schema/index.ts',
      out: './drizzle',
      dialect: 'postgresql',
      dbCredentials: {
        url: process.env.DATABASE_URL!,
      },
      // Tell drizzle-kit that PostGIS owns these objects so it ignores them on diff
      extensionsFilters: ['postgis'],
      schemaFilter: ['public'],
      strict: true,
      verbose: true,
    });
    ```

    Step 3: Create `apps/api/src/config.ts` per RESEARCH.md — copy VERBATIM. Note Pitfall #4: use `zod/v4` import path:

    ```typescript
    import { z } from 'zod/v4';

    const ConfigSchema = z.object({
      NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
      PORT: z.coerce.number().int().positive().default(3000),
      HOST: z.string().default('0.0.0.0'),
      DATABASE_URL: z.string().url().or(z.string().startsWith('postgresql://')),
      REDIS_URL: z.string().url().or(z.string().startsWith('redis://')),
      LOG_LEVEL: z
        .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
        .default('info'),

      // Phase 2+ — optional in Phase 1 so the schema doesn't reject .env.local
      ANTHROPIC_API_KEY: z.string().optional(),
      TELEGRAM_BOT_TOKEN: z.string().optional(),
      TELEGRAM_WEBHOOK_SECRET: z.string().optional(),

      // Build info (passed at docker build time)
      VERSION: z.string().default('dev'),
    });

    export type AppConfig = z.infer<typeof ConfigSchema>;

    const parsed = ConfigSchema.safeParse(process.env);

    if (!parsed.success) {
      console.error('Invalid environment configuration:');
      console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
      process.exit(1);
    }

    export const config: AppConfig = parsed.data;
    ```

    Step 4: Create `apps/api/src/db.ts` — factory pattern so migrate/seed/Fastify all reuse it:

    ```typescript
    import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
    import pg from 'pg';
    import { config } from './config.js';
    import type * as schema from './persistence/schema/index.js';

    const { Pool } = pg;

    export type Db = NodePgDatabase<typeof schema>;

    /** Create a node-postgres Pool from DATABASE_URL */
    export function createPool(connectionString = config.DATABASE_URL): pg.Pool {
      return new Pool({
        connectionString,
        max: 10,
        idleTimeoutMillis: 30_000,
      });
    }

    /** Create a Drizzle client decorated with our schema barrel */
    export async function createDb(pool: pg.Pool): Promise<Db> {
      const schemaModule = await import('./persistence/schema/index.js');
      return drizzle(pool, { schema: schemaModule });
    }
    ```

    Step 5: Create `.env.local` by copying `.env.example`:

    ```bash
    cp .env.example .env.local
    ```

    Verify `pnpm exec tsc --noEmit -p apps/api/tsconfig.json` passes. The schema index.ts does not yet exist so the type import inside db.ts might warn — this is FINE because Task 2 of this plan creates `apps/api/src/persistence/schema/index.ts`. If tsc fails on the missing module, stub-create it as `export {};` first, then Task 2 fills it.
  </action>
  <verify>
    <automated>pnpm --filter @ai-logist/api list drizzle-orm 2>&1 | grep -q "0.45.2" && pnpm --filter @ai-logist/api list drizzle-kit 2>&1 | grep -q "0.31" && test -f apps/api/drizzle.config.ts && test -f apps/api/src/config.ts && test -f apps/api/src/db.ts && test -f .env.local && grep -q "extensionsFilters" apps/api/drizzle.config.ts && grep -q "zod/v4" apps/api/src/config.ts && echo OK</automated>
  </verify>
  <done>
    drizzle-orm 0.45.2 and drizzle-kit ^0.31 installed; config.ts uses `zod/v4` import and validates env via safeParse + process.exit(1); db.ts exports createPool + createDb + Db type; drizzle.config.ts uses extensionsFilters; `.env.local` exists.
  </done>
  <acceptance_criteria>
    - `pnpm --filter @ai-logist/api list drizzle-orm | grep -q "0.45.2"` returns 0
    - `test -f apps/api/drizzle.config.ts && test -f apps/api/src/config.ts && test -f apps/api/src/db.ts && test -f .env.local` returns 0
    - `grep -q "extensionsFilters" apps/api/drizzle.config.ts` returns 0
    - `grep -q "import { z } from 'zod/v4'" apps/api/src/config.ts` returns 0
    - `grep -q "process.exit(1)" apps/api/src/config.ts` returns 0
    - `grep -q "export function createPool" apps/api/src/db.ts` returns 0
    - `grep -q "export async function createDb" apps/api/src/db.ts` returns 0
    - `grep -q "db:migrate" apps/api/package.json` returns 0
  </acceptance_criteria>
</task>

<task type="auto" tdd="false">
  <name>Task 2: customType geographyPoint + pgEnums + schema barrel + 0000 postgis extension migration + apply migration</name>
  <read_first>
    - apps/api/drizzle.config.ts (Task 1)
    - apps/api/src/db.ts (Task 1)
    - .planning/phases/01-database-backend-skeleton/01-RESEARCH.md — sections "geography(Point, 4326) customType wrapper", "PostgreSQL ENUMs", "First (CREATE EXTENSION) migration via --custom", "Pitfall 7: Drizzle Kit can't introspect customType"
    - .planning/phases/01-database-backend-skeleton/01-CONTEXT.md — D-01, D-02, D-06
  </read_first>
  <files>
    - apps/api/src/persistence/schema/_columns.ts
    - apps/api/src/persistence/schema/_enums.ts
    - apps/api/src/persistence/schema/index.ts
    - apps/api/drizzle/0000_postgis_extension.sql
  </files>
  <action>
    Four schema-foundation files.

    Step 1: Create `apps/api/src/persistence/schema/_columns.ts` per RESEARCH.md — copy VERBATIM. Note RESEARCH.md's caveat: `fromDriver` falls back to EWKT parsing; production reads should use `ST_X(geom::geometry)` and `ST_Y(geom::geometry)` in raw SQL. This file ships the write-side type contract that drizzle-kit uses for DDL.

    ```typescript
    // Source pattern: https://github.com/drizzle-team/drizzle-orm/discussions/1618
    // Adapted for geography(Point, 4326) per CONTEXT.md D-02.
    // PostGIS WKT format on the wire: 'SRID=4326;POINT(lon lat)'

    import { customType } from 'drizzle-orm/pg-core';

    export type LngLat = { lng: number; lat: number };

    /**
     * geography(Point, 4326) column type.
     * Reads/writes EWKT 'SRID=4326;POINT(lon lat)' strings on the toDriver side.
     *
     * IMPORTANT CAVEAT (verified against node-postgres):
     * node-postgres returns PostGIS columns as HEX EWKB by default, not EWKT.
     * The fromDriver below works only when the SQL explicitly returns text
     * (e.g. ST_AsText(geom)). For typed reads, prefer hand-written sql`` with
     * ST_X(geom::geometry) AS lng, ST_Y(geom::geometry) AS lat and map manually.
     *
     * customType is here PRIMARILY so drizzle-kit emits the correct
     * `geography(Point, 4326)` DDL when generating migrations.
     */
    export const geographyPoint = customType<{
      data: LngLat;
      driverData: string;
    }>({
      dataType() {
        return 'geography(Point, 4326)';
      },
      toDriver(value: LngLat): string {
        return `SRID=4326;POINT(${value.lng} ${value.lat})`;
      },
      fromDriver(value: string): LngLat {
        const m = /POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i.exec(value);
        if (!m) throw new Error(`Cannot parse geography point from driver: ${value}`);
        return { lng: Number(m[1]), lat: Number(m[2]) };
      },
    });
    ```

    Step 2: Create `apps/api/src/persistence/schema/_enums.ts` per RESEARCH.md + CONTEXT D-06 — 7 enums (matches spec §4.4, §4.5 + webhook_source for D-09):

    ```typescript
    import { pgEnum } from 'drizzle-orm/pg-core';

    export const leadStageEnum = pgEnum('lead_stage', [
      'NEW',
      'QUALIFIED',
      'MATCHED',
      'QUOTED',
      'AGREED',
      'ORDER_CREATED',
      'IN_PROGRESS',
      'DONE',
      'LOST',
    ]);

    export const orderStatusEnum = pgEnum('order_status', [
      'CREATED',
      'DRIVER_ASSIGNED',
      'AT_LOADING',
      'IN_TRANSIT',
      'AT_BORDER',
      'DELIVERED',
      'CLOSED',
    ]);

    export const orderEventTypeEnum = pgEnum('order_event_type', [
      'created',
      'driver_assigned',
      'at_loading',
      'in_transit',
      'at_border',
      'delivered',
    ]);

    export const bodyTypeEnum = pgEnum('body_type_t', [
      'tent',
      'ref',
      'iso',
      'container',
    ]);

    export const truckStatusEnum = pgEnum('truck_status', [
      'available',
      'busy',
      'maintenance',
    ]);

    export const clientLangEnum = pgEnum('client_lang', ['ru', 'ua']);

    export const webhookSourceEnum = pgEnum('webhook_source', [
      'telegram',
      'voice',
      'gps',
    ]);
    ```

    Step 3: Create `apps/api/src/persistence/schema/index.ts` — barrel re-export. Wave 3b/3c/3d will append per-table re-exports; Wave 3a only re-exports enums + columns:

    ```typescript
    // Schema barrel
    // Wave 3a: enums + customType
    // Wave 3b: clients, cities, trucks, truck_positions
    // Wave 3c: leads, orders, order_events, pod_artifacts
    // Wave 3d: calls, messages, bourse_cache, webhook_updates, pricing_config

    export * from './_enums.js';
    export * from './_columns.js';
    ```

    Step 4: Create `apps/api/drizzle/0000_postgis_extension.sql` MANUALLY (not via drizzle-kit, because drizzle-kit `--custom` produces an empty file we'd then hand-edit anyway — we skip that step). Content per RESEARCH.md — copy VERBATIM:

    ```sql
    -- 0000_postgis_extension.sql
    -- Pitfall #3 of 01-RESEARCH.md: extension must be its own migration so the geography
    -- type exists before any table that uses it.
    CREATE EXTENSION IF NOT EXISTS postgis;
    ```

    Also create the drizzle-kit journal stub so drizzle-kit knows about this migration. Create `apps/api/drizzle/meta/_journal.json`:

    ```json
    {
      "version": "7",
      "dialect": "postgresql",
      "entries": [
        {
          "idx": 0,
          "version": "7",
          "when": 1717891200000,
          "tag": "0000_postgis_extension",
          "breakpoints": true
        }
      ]
    }
    ```

    Note: The exact journal version (`"7"`) may differ for drizzle-kit 0.31.x. If the manually written journal doesn't match drizzle-kit's expectations, run `pnpm --filter @ai-logist/api db:generate` once with an empty schema to let drizzle-kit create a valid empty journal, then manually add the 0000 entry. Alternatively (preferred path):

    Alternative preferred path — generate via drizzle-kit:
    ```bash
    cd apps/api
    pnpm exec drizzle-kit generate --custom --name=postgis_extension
    ```
    This produces an empty `drizzle/0000_postgis_extension.sql` AND a valid journal. Then edit the empty SQL file to contain ONLY `CREATE EXTENSION IF NOT EXISTS postgis;`.

    Step 5: Verify the migration applies. Postgres must be running (from Wave 2: `docker compose up -d postgres redis`). Then:

    ```bash
    pnpm --filter @ai-logist/api db:migrate
    ```

    Verify via psql:
    ```bash
    docker exec ailogist-postgres psql -U ailogist -d ailogist -c "SELECT PostGIS_Version();"
    ```
    Expected: returns a row like `3.5 USE_GEOS=1 USE_PROJ=1 USE_STATS=1`.

    Step 6: Update the phase-1-stubs.test.ts to flip the DB-01 todo to a real test. Edit `apps/api/tests/unit/phase-1-stubs.test.ts` and replace the DB-01 line with:

    ```typescript
      test('DB-01: postgis extension loaded in first migration (0000_postgis_extension.sql)', async () => {
        const fs = await import('node:fs/promises');
        const sql = await fs.readFile('drizzle/0000_postgis_extension.sql', 'utf-8');
        expect(sql).toMatch(/CREATE EXTENSION IF NOT EXISTS postgis/i);
      });
    ```
    Make sure to import `expect` at the top: `import { describe, expect, test } from 'vitest';`

    Run `pnpm --filter @ai-logist/api test:unit` — should now show 16 todo + 1 passing.
  </action>
  <verify>
    <automated>test -f apps/api/src/persistence/schema/_columns.ts && test -f apps/api/src/persistence/schema/_enums.ts && test -f apps/api/src/persistence/schema/index.ts && test -f apps/api/drizzle/0000_postgis_extension.sql && grep -q "geography(Point, 4326)" apps/api/src/persistence/schema/_columns.ts && grep -q "CREATE EXTENSION IF NOT EXISTS postgis" apps/api/drizzle/0000_postgis_extension.sql && grep -c "pgEnum(" apps/api/src/persistence/schema/_enums.ts | xargs -I {} test {} -ge 7 && pnpm --filter @ai-logist/api db:migrate 2>&1 | tail -3 && docker exec ailogist-postgres psql -U ailogist -d ailogist -tAc "SELECT PostGIS_Version();" | grep -q "3.5" && cd apps/api && pnpm exec vitest run --project unit 2>&1 | tail -3 && echo OK</automated>
  </verify>
  <done>
    Three schema files exist with correct content; first migration applies cleanly against Docker Postgres; `SELECT PostGIS_Version()` returns 3.5.x; DB-01 stub test is now passing.
  </done>
  <acceptance_criteria>
    - `test -f apps/api/src/persistence/schema/_columns.ts && test -f apps/api/src/persistence/schema/_enums.ts && test -f apps/api/src/persistence/schema/index.ts && test -f apps/api/drizzle/0000_postgis_extension.sql` returns 0
    - `grep -q "customType<" apps/api/src/persistence/schema/_columns.ts` returns 0
    - `grep -q "geography(Point, 4326)" apps/api/src/persistence/schema/_columns.ts` returns 0
    - `grep -q "export const geographyPoint" apps/api/src/persistence/schema/_columns.ts` returns 0
    - `grep -c "pgEnum(" apps/api/src/persistence/schema/_enums.ts` is at least 7
    - `grep -q "leadStageEnum\\|orderStatusEnum\\|orderEventTypeEnum\\|bodyTypeEnum\\|truckStatusEnum\\|clientLangEnum\\|webhookSourceEnum" apps/api/src/persistence/schema/_enums.ts` returns 0 (all 7 enum names present)
    - `grep -q "CREATE EXTENSION IF NOT EXISTS postgis" apps/api/drizzle/0000_postgis_extension.sql` returns 0
    - `docker exec ailogist-postgres psql -U ailogist -d ailogist -tAc "SELECT extname FROM pg_extension WHERE extname='postgis';" | grep -q "postgis"` returns 0
    - `docker exec ailogist-postgres psql -U ailogist -d ailogist -tAc "SELECT PostGIS_Version();" | grep -q "3.5"` returns 0
    - After running unit tests, the DB-01 todo is now a passing test (no longer .todo)
  </acceptance_criteria>
</task>

</tasks>

<verification>
- `pnpm exec tsc --noEmit -p apps/api/tsconfig.json` passes
- `pnpm exec biome check apps/api/src apps/api/drizzle.config.ts` passes
- `pnpm --filter @ai-logist/api db:migrate` succeeds against the live Docker Postgres
- `docker exec ailogist-postgres psql -U ailogist -d ailogist -tAc "SELECT PostGIS_Version();"` returns `3.5 USE_GEOS=1 USE_PROJ=1 USE_STATS=1`
- `apps/api/drizzle/__drizzle_migrations` table exists in DB with one row (migration 0000 applied)
- Re-running `pnpm db:migrate` is idempotent (no errors, no changes)
- DB-01 todo test now passes
</verification>

<success_criteria>
1. Drizzle 0.45.2 + drizzle-kit 0.31.x + pg + zod v4 installed in apps/api with correct version pins (Drizzle is EXACTLY 0.45.2, no caret).
2. `geographyPoint` customType emits SQL literal `geography(Point, 4326)` per D-02.
3. All 7 pgEnums declared in `_enums.ts` matching spec §4.4 + §4.5 + webhook_source.
4. `drizzle.config.ts` uses `extensionsFilters: ['postgis']` so drizzle-kit ignores PostGIS-owned objects on schema diff.
5. `0000_postgis_extension.sql` applied successfully against Docker Postgres; `SELECT PostGIS_Version()` returns 3.5.x.
6. `config.ts` validates env with Zod v4 and exits 1 on invalid env.
7. DB-01 stub test (from Plan 01-00) is now flipped to a passing real test.
</success_criteria>

<output>
After completion, create `.planning/phases/01-database-backend-skeleton/01-03-SUMMARY.md` documenting:
- Drizzle versions actually installed
- Output of `docker exec ailogist-postgres psql -U ailogist -d ailogist -tAc "SELECT PostGIS_Version();"`
- Confirmation that `drizzle/meta/_journal.json` records the 0000 migration
- `pnpm db:migrate` re-run is idempotent (apply twice, no diff)
- DB-01 test count: 1 passing
</output>
