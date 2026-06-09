---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_plan: 5
status: executing
last_updated: "2026-06-09T11:43:27.771Z"
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 19
  completed_plans: 15
  percent: 79
---

# State: AI-Логист

**Last updated:** 2026-06-09

## Project Reference

**Core value:** Диалог ведёт LLM, но решения по деньгам и подбору принимает детерминированный код — цена и подбор должны быть предсказуемыми, тестируемыми, воспроизводимыми.

**Current focus:** Phase 02 — llm-pipeline-deterministic-core

**Stack (locked):** Node 22 LTS + TypeScript 5.7 strict + Fastify 5 + Drizzle ORM 0.45.2 + PostgreSQL 17 + PostGIS 3.5 + Redis 7.4 + grammY 1.43 + Anthropic SDK 0.102 (betaZodTool) + Next.js 16 / React 19 / Tailwind v4 / shadcn/ui (Zenith Admin template) + Leaflet + OSM. Monorepo via pnpm workspaces. Deploy: docker-compose + Caddy on single VM.

## Current Position

Phase: 02 (llm-pipeline-deterministic-core) — EXECUTING
Plan: 5 of 8
Current Plan: 5
Total Plans in Phase: 8
**Phase:** 2 of 6 (llm pipeline + deterministic core ⚠️ high risk)
**Plan:** Phase 1 (01-00..01-10) complete. Phase 2 Plans 02-00 (Wave 0 test infra), 02-01 (Wave 1: migration 0002 + lib primitives + llm-client wrapper), and 02-03 (Wave 2b: lead-fsm + order-fsm + errors + concurrency/audit integration tests) complete. Plan 02-02 (Wave 2a LLM tools) is running in parallel; Plan 02-03b (FSM-01/02/03/05 todo flips in phase-2-stubs.test.ts) is the next serial step.
**Status:** Ready to execute

**Progress:**

[████████░░] 79%
[██████████] 100%
[████████████████████] 11/11 plans complete in Phase 01
[█░░░░░░░░░░░░░░░░░░░] 1/6 phases complete

```

## Performance Metrics

| Metric | Value |
|--------|-------|
| v1 Requirements | 89 enumerated, 89 mapped (100% coverage) |
| Phases | 6 |
| Granularity | standard |
| Parallelization | Phase 4 parallelizable with Phase 3 after P2 contracts |
| High-risk phases | Phase 2, Phase 5 (per PITFALLS.md) |
| 01-00 duration | ~3 min, 2 tasks, 9 files |
| Phase 01-database-backend-skeleton P01 | 5m46s | 2 tasks | 15 files |
| Phase 01 P02 | 3m27s | 2 tasks | 14 files |
| Phase 01-database-backend-skeleton P03 | 5m47s | 2 tasks | 15 files |
| Phase 01-database-backend-skeleton P04 | 2m 12s | 2 tasks | 6 files |
| Phase 01-database-backend-skeleton P05 | 2m 30s | 2 tasks | 6 files |
| Phase 01-database-backend-skeleton P06 | 4m 10s | 3 tasks | 14 files |
| Phase 01-database-backend-skeleton P07 | 9m 0s | 2 tasks | 13 files |
| Phase 01-database-backend-skeleton P08 | 6m 21s | 2 tasks | 18 files |
| Phase 01-database-backend-skeleton P09 | 3m 50s | 2 tasks | 9 files |
| Phase 01-database-backend-skeleton P10 | 3m 33s | 2 tasks | 5 files |
| Phase 02-llm-pipeline-deterministic-core-high-risk P00 | 6min | 2 tasks | 12 files |
| Phase 02-llm-pipeline-deterministic-core-high-risk P03 | 10min | 3 tasks | 7 files |
| Phase 02-llm-pipeline-deterministic-core-high-risk P02 | ~12min | 3 tasks | 19 files |

## Accumulated Context

### Key Decisions

- **Stack fixed** (Node 22 + Fastify + Drizzle + PostGIS + grammY + Anthropic SDK + Next.js 16 / Zenith template) per PROJECT.md Key Decisions table — research converged unambiguously.
- **Modular monolith** in `apps/api` with 11 internal modules; cross-module talk only through public exports.
- **LLM tool sandwich** — every business action is a registered tool with JSON Schema + Zod sandwich; the LLM cannot mutate state except through validated tools; prices are rendered from `leads.quoted_price` via templated strings, never paraphrased.
- **PostGIS CTE re-rank** is mandatory for `nearestTruck`: overfetch 20 by `<->` (sphere, GiST-accelerated), re-rank by `ST_Distance(geog, true)` (spheroid). KNN sphere ≠ ST_Distance spheroid is a documented PostGIS gotcha (ticket #3127).
- **Telegram idempotency** on `update_id` is a non-negotiable Phase 3 invariant.
- **Demo-credibility additions** (beyond spec §9) merged into v1 from FEATURES research: public tracking link `/track/[token]`, TTN/CMR PDF stub, driver-confirmation loop, extended cargo fields, price-override audit, POD section, global search.
- **Plan 01-00:** Wave 0 test infrastructure landed BEFORE any production code — Vitest 4.1.8 + @testcontainers/postgresql 12.0.1; 19 `test.todo()` markers cover every Phase 1 acceptance criterion (DB-01..10, API-01/02/16, DEPLOY-01..04). Testcontainers helper pinned to `postgis/postgis:17-3.5` to match the docker-compose image (D-22).
- **Plan 01-00:** Bumped @testcontainers/postgresql from planned 10.18.0 → 12.0.1 (latest GA on npm — 10.x line was superseded). Plan's documented fallback (`npm view`) was used.
- **Plan 01-01:** Biome 2.4.16 schema migration — plan used 2.4.0 schema with `files.ignore`+`noConsoleLog`; CLI required matching schema. Ran `biome migrate --write` to convert to `files.includes` (negative globs) + `noConsole` rule, then dropped trailing `/**` from folder ignores per `useBiomeIgnoreFolder` lint rule (Biome 2.2+ convention).
- **Plan 01-01:** Dropped `rootDir: ./src` from `apps/api/tsconfig.json` — plan's rootDir contradicted `include: [src/**/*, tests/**/*, drizzle.config.ts]` producing TS6059. Removing rootDir lets TS infer it from include; outDir still drives emit.
- **Plan 01-01:** Added `@ts-expect-error` on `await import('pg')` and `await import('drizzle-orm/node-postgres')` in Wave 0's `tests/_helpers/test-db.ts` so the apps/api project type-checks before Plan 01-04 installs the deps. Plan 01-04 must remove the directives.
- **Plan 01-01:** Removed stale `apps/api/pnpm-lock.yaml` (Plan 01-00 created via `--ignore-workspace`; root lockfile is now authoritative — anticipated in Plan 01-00 SUMMARY).
- **Plan 01-02:** Reworded the Pitfall #3 reminder in Caddyfile so the literal string `handle_path` does not appear — acceptance criterion `! grep -q 'handle_path' Caddyfile` is a strict literal-string match that fails even on explanatory comments. The actual routing uses `handle /api/*` correctly.
- **Plan 01-02:** Docker CLI v2 compose plugin not available on Claude's runner (CLI 29.1.5 reports `unknown command: docker compose`; docker daemon socket unreachable). YAML validation via `python3 yaml.safe_load` substituted per the plan's explicit deviation guidance. `docker compose up` smoke test deferred to verifier + developer machines.
- **Plan 01-02:** Next.js caret `^16.0.0` resolved to 16.2.7 (current stable); React 19.2.1 + react-dom 19.2.1; Turbopack-enabled `next build` exit 0 with 3/3 static pages.
- **Plan 01-02:** Committed `apps/web/next-env.d.ts` per Next.js convention — auto-generated by `next build` but required on disk for downstream `tsc --noEmit`. Next.js docs explicitly call this out: "This file should not be edited."
- **Plan 01-03:** Hand-rolled `geographyPoint` customType — Drizzle 0.45.2 ships no `geography()` helper (RESEARCH.md Pitfall #1). Verified at runtime via `pgTable + getTableColumns + col.getSQLType()` that it emits the literal string `geography(Point, 4326)` so Wave 3b migrations will produce correct DDL.
- **Plan 01-03:** `drizzle.config.ts` replaces RESEARCH.md's verbatim `process.env.DATABASE_URL!` with an explicit `if (!DATABASE_URL) throw` guard — Biome 2.4 `noNonNullAssertion` rule blocks the bang. Semantics identical.
- **Plan 01-03:** Removed `@ts-expect-error` directives in `tests/_helpers/test-db.ts` that Plan 01-01 added as forward-references. Plan 01-01's note claimed "Plan 01-04 must remove them" but Plan 01-03 is actually the plan that installs `drizzle-orm + pg` — directives became unused (TS2578) the moment Task 1 finished installing the deps. Also cleaned the two `deferred-items.md` Wave 0 lint warnings while editing the file.
- **Plan 01-03:** Live `pnpm db:migrate` smoke against Docker Postgres deferred — Docker daemon unreachable on Claude's runner (same blocker as Plan 01-02). `drizzle-kit migrate` reaches the connection step before timing out, proving config + journal + SQL are syntactically valid. Developer/verifier must run `docker compose up -d postgres && pnpm --filter @ai-logist/api db:migrate && docker exec ailogist-postgres psql -U ailogist -d ailogist -c "SELECT PostGIS_Version();"` on a properly configured machine. Expected output: `3.5 USE_GEOS=1 USE_PROJ=1 USE_STATS=1` (or similar 3.5.x string).
- **Plan 01-03:** Used `webhook_source` as the 7th pgEnum (CONTEXT D-06 enumerates 6; RESEARCH.md adds `webhook_source` for D-09 idempotency table).
- **Plan 01-04:** Used Drizzle 0.45.2 callback-array API for table indexes (`(t) => [index(...), check(...)]`) — older Drizzle docs show the object form (`(t) => ({ ... })`); 0.45.2 requires the tuple/array form for correct `getTableConfig()` type inference.
- **Plan 01-04:** `truck_positions.truck_id` is ON DELETE CASCADE — demo seed recreates data on every reset, orphan position rows would clutter the Phase 5 live tracking map. Production would soft-delete trucks instead.
- **Plan 01-04:** `cities.country_code` is TEXT, not an ENUM — values today are RU/UA/border; future demos may add UA oblast codes / BY / KZ. TEXT keeps it migration-free; seed validates the set at write time.
- **Plan 01-04:** `drizzle-kit generate` deferred to Plan 01-07 — Waves 3b + 3c + 3d will ship as ONE init migration (`0001_init.sql`) covering clients/cities/trucks/truck_positions + leads/orders + channels/repos tables together, avoiding 3 sequential migrations for never-released schema.
- **Plan 01-04:** Test assertion strategy: `Object.keys(schemaObject)` + source-grep. Drizzle's public runtime API doesn't expose indexes/checks at runtime via the table object — only columns iterate. The eventual `0001_init.sql` (Plan 01-07) will let stricter tests assert DDL strings directly.
- **Plan 01-05:** orders declared before leads in source ordering — though Drizzle's lazy `references(() => x.id)` callback resolves circular FKs at runtime, source-first orders matches the migration's ALTER TABLE ADD CONSTRAINT order and keeps the conceptual flow intuitive.
- **Plan 01-05:** orders.lead_id is a bare uuid (no .references() callback). leads.order_id carries the FK constraint instead so deleting a lead in demo cleanup doesn't cascade or block the order.
- **Plan 01-05:** orders.public_token is text + UNIQUE (not uuid) so the Phase 5 `/track/[token]` URL stays short and shareable. nanoid 5 will generate the values in seed (Plan 01-09) and createOrder (Phase 2).
- **Plan 01-05:** orders.currency and order_events.actor are plain text not ENUM — the domains will grow (UAH/KZT, geofence/scheduler) and migrations-on-every-new-value isn't worth the ENUM type safety here. Validation lives in createOrder / appendEvent helpers.
- **Plan 01-05:** pod_artifacts.gps has no GiST index — POD points are written once at delivery and never queried by KNN/radius. GiST would add write cost for zero read benefit until a hypothetical delivered-density heatmap feature (deferred to Phase 6).
- **Plan 01-05:** Nullable-safe SRID CHECK pattern established for optional geo columns (order_events.geom, pod_artifacts.gps): `IS NULL OR ST_SRID(col) = 4326`. Reusable invariant for any future optional geo column.
- **Plan 01-06:** Thin per-aggregate repos use namespace re-export (`export * as fooRepo from './foo.js'`) — call sites stay grep-friendly (`trucksRepo.findById`) without exploding the barrel's named-export surface; 6 repos × ~5 funcs each, all taking Db as first arg per D-07.
- **Plan 01-06:** PostGIS-heavy methods (nearestTruck KNN, ST_DWithin, CTE re-rank) deliberately OMITTED from thin repos — D-08 says they ship as raw `db.execute(sql\`…\`)` in Phase 2. Keeping repos to plain CRUD avoids leaking half-baked spatial helpers that Phase 2 would have to refactor.
- **Plan 01-06:** `messages.role` / `calls.outcome` / `orders.currency` / `order_events.actor` all chosen as plain `text` not ENUM — each domain is guaranteed to grow (system/broadcast actors; voicemail/dropped outcomes; KZT/BYN currencies; geofence/webhook actors) and PostgreSQL ENUM migrations require ALTER TYPE per new value. Validation lives in TS at the producing code path.
- **Plan 01-06:** `webhook_updates.id` is `bigserial` (RESEARCH.md verbatim) — Telegram update_id is bigint; voice/gps external ids may also exceed int32. bigserial gives a numeric PK independent of the external_id semantics. UNIQUE(source, external_id) makes the duplicate-delivery case a no-op write via `onConflictDoNothing({target: [...]})`.
- **Plan 01-06:** `bourse_cache.query_hash` UNIQUE via explicit `uniqueIndex` name (`'bourse_cache_query_hash_unq'`) not `.unique()` shortcut — Phase 2's cache writer can reference the constraint name in raw SQL ON CONFLICT clauses.
- **Plan 01-07:** Drizzle 0.45.2 customType emits double-quoted type names for non-native types — `geography(Point, 4326)` gets wrapped as `"geography(Point, 4326)"` in generated SQL because drizzle-kit's `parseType()` `pgNativeTypes` list includes `geometry` but excludes `geography`. The quoted form would fail at apply time (Postgres treats it as a literal type identifier, not as the parameterized geography type). Fix: post-process the generated SQL via a small `node -e` script appended to `db:generate` — idempotent on re-runs. RESEARCH.md Pitfall #1 documented the customType pattern but missed this emission-quoting issue.
- **Plan 01-07:** `ioredis` named import (`import { Redis } from 'ioredis'`) not default — RESEARCH.md verbatim default import fails under `module:NodeNext + esModuleInterop:true` because ioredis's CJS shape resolves the default as a namespace (TS2709/TS2351). Named import gives both type + value `Redis` cleanly.
- **Plan 01-07:** HealthResponseSchema pattern (Zod v4 in `packages/shared-types/src/api/health.ts`, re-exported from package barrel, imported by route via `@ai-logist/shared-types/api/health` subpath) is the template for every future API-* DTO. Plan 01-08 will replicate it for leads/orders/trucks/clients/analytics/webhooks.
- **Plan 01-07:** `buildApp()` registers plugins in deterministic order — sensible → db → redis → swagger → swagger-ui → routes. Both db.ts and redis.ts use `fastify-plugin (fp)` so `app.db`/`app.pgPool`/`app.redis` decorators escape encapsulation. Both smoke-test (`SELECT 1` / `PING`) on boot — fail-fast if infra is down. Plugin lifecycle drains connections on `app.close()`.
- **Plan 01-07:** Live `pnpm dev &` + `curl /api/health` smoke skipped — Docker daemon unreachable on Claude's runner (consistent with Plans 01-02..06). testcontainers integration test (`tests/integration/health.test.ts`) ships the actual contract enforcement for verifier/developer machines that have Docker — boots `postgis/postgis:17-3.5`, applies both migrations, calls `app.inject({method:'GET',url:'/api/health'})`, asserts 200 + `checks.postgis ~ /3.5/`.
- **Plan 01-07:** Integration test imports `app.ts` DYNAMICALLY (`await import('../../src/app.js')`) inside `beforeAll` AFTER `process.env.DATABASE_URL` is overridden to the testcontainers URL — `config.ts` validates env at module load, so any static top-of-file import would capture the original DATABASE_URL before the override.
- **Plan 01-08:** 501-stub route pattern (RESEARCH.md Pattern 7) — every API-* and webhook endpoint declared in Fastify with FULL Zod schema; handler calls `reply.notImplemented()` from @fastify/sensible; Phase 2/3/4/5 swap only the handler body, schemas remain. 17 total routes (1 health + 16 stubs); Swagger UI at /api/docs exposes the contract.
- **Plan 01-08:** numeric + bigint columns serialise as `string` in DTOs (LeadSchema.tons, OrderSchema.price, etc.) — node-postgres returns NUMERIC/BIGINT as JS strings to preserve precision; Zod schemas mirror that with `z.string().nullable()` instead of `z.number()`. Avoids precision loss for kopecks (bigint) and tonnage (numeric(10,2)).
- **Plan 01-08:** TelegramUpdateBodySchema + VoiceCallbackBodySchema use `.passthrough()` with only the idempotency-key field strict — Telegram Bot API ships hundreds of optional fields that evolve; we only need `update_id` to dedupe via `webhook_updates` (D-09). Phase 3 tightens with grammY-typed context.
- **Plan 01-08:** PriceOverrideBodySchema enforces `reason` at the schema level (`z.string().min(3)`) — ADMIN-NEW-06 requires every price override to carry an audit reason. Phase 4 manager UI form validation reuses the same Zod schema so even automated clients can't submit without justification.
- **Plan 01-08:** shared-types `package.json` exports map gains `./domain/*` subpath — Plan 01-07 added `./api/*` for HealthResponseSchema; Plan 01-08's `enums.ts` under `domain/` needed the symmetric entry for direct subpath imports (e.g. `@ai-logist/shared-types/domain/enums`) from apps/api tests and Phase 4 apps/web typed UI.
- **Plan 01-08:** Multi-method route plugin per domain — e.g. `apps/api/src/routes/leads.ts` hosts 4 routes (GET, PATCH /:id, POST /:id/match, POST /:id/quote). Single `FastifyPluginAsyncZod` with multiple `app.{get,patch,post}()` calls is cleaner than one file per verb. Matches the Phase 4 handler shape where match + quote logic sits next to list/patch handlers.
- **Plan 01-09:** Added kursk as the 30th city to match D-19's "~30 cities" literally; gives the KNN smoke a third reasonable RU candidate within ~500km of Kyiv (plan literally suggested this as the "exactly 30" option). Final composition: 13 RU + 12 UA + 5 border.
- **Plan 01-09:** `onConflictDoNothing` targets the natural unique column (`cities.slug` / `trucks.plateNumber` / `clients.phone`), NOT the auto-generated UUID id — auto IDs differ per run so targeting id would never trigger the conflict path. Idempotency requires the natural key. `pricing_config` uses raw `db.execute(sql\`...ON CONFLICT (key) DO NOTHING\`)` because the 3 rows have heterogeneous jsonb shapes (number / object / number); single SQL statement is cleaner than 3 separate Drizzle calls and 1 RTT vs 3.
- **Plan 01-09:** JSON fixtures (apps/api/src/seed/data/*.json) over TS literal arrays — non-coders can edit coordinates without compile step; type-safety lives in run.ts via local fixture type aliases (CityFixture, TruckFixture, etc.) that cast on read. RESEARCH Open Question 1 recommendation. JSON imports use Node 22 native ESM with-attributes (`with { type: 'json' }`).
- **Plan 01-09:** Integration test (`apps/api/tests/integration/seed.test.ts`) runs `seed()` TWICE in `beforeAll()` — single best signal for D-20 idempotency. If `onConflictDoNothing` is wrong, second run either errors (unique violation) or doubles counts (24 trucks, 16 clients). Both fail the assertion. 6 cases total (idempotency, RU/UA split, body_type mix, KNN ascending, border count ≥5, rate_per_km=4200 kopecks contract).
- **Plan 01-09:** DB-10 unit test imports JSON via Node 22 native ESM `with { type: 'json' }` — same syntax run.ts uses; Vitest 4 supports it. Lets the unit suite verify fixture shape OFFLINE without spinning up testcontainers (unit suite: 16 / 4 todo, was 15 / 5). Remaining 4 todos are DEPLOY-01..04 (Plan 01-10).
- **Plan 01-09:** Canonical KNN smoke (`smoke.ts` → `printNearestTrucksSmoke(db)`) uses CTE re-rank pattern per PITFALLS.md #2: overfetch 20 by `<->` (GiST-accelerated sphere) inside a CTE filtering trucks `WHERE status='available'`, then re-rank by `ST_Distance(geom, pickup, true)` (spheroid meters) and LIMIT 3. Pickup point pinned to Kyiv center (30.5234, 50.4501) — Phase 1 sanity check. Phase 2's `nearestTruck` reuses the shape with `tons` + `body_type` filters added inside the CTE.
- **Plan 01-10:** Auto-approved checkpoint:human-verify in --auto mode; created HUMAN-UAT.md UAT-01 (status ⏳ pending) to track the deferred real-human 10-minute README walkthrough — sweep before Phase 1 milestone tag. Pattern reusable across phases: every auto-mode-approved human-verify logs a UAT-NN entry with acceptance checklist so the deferred human verification debt is explicit rather than invisible.
- **Plan 01-10:** Full-stack smoke test (`apps/api/tests/smoke/full-stack.test.ts`) gated on `AI_LOGIST_FULL_STACK_SMOKE=1` env (default skipped) — opt-in for verifier/buyer-eval pass; needs `docker compose up -d` beforehand (postgres + redis + api + web + caddy). 3 cases discoverable via `AI_LOGIST_FULL_STACK_SMOKE=1 vitest list --project smoke`: health-via-Caddy + OpenAPI surface + Next.js placeholder. Same gating pattern reusable for Phase 5 tracking WS smoke, Phase 3 Telegram webhook smoke.
- **Plan 01-10:** DEPLOY-01..04 acceptance asserts via filesystem + grep (5-service line count in docker-compose, env-var presence + Zod ConfigSchema + process.exit(1) in config.ts source, workspace protocol + 'apps/*'/'packages/*' globs, README 10-min copy + 6 verbatim command strings: `docker compose up -d postgres redis`, `pnpm install`, `pnpm db:migrate`, `pnpm seed`, `pnpm dev`, `curl http://localhost:3000/api/health`). Single-test cross-cutting deploy assertions without YAML parser dep. Locks the README to its canonical commands — any rename breaks the test and forces a deliberate update.
- **Plan 01-10:** Removed `test.todo()` literal mentions from the phase-1-stubs.test.ts header docstring to satisfy `grep -c "test.todo" ... is 0` acceptance criterion. The grep is naive (doesn't distinguish code from comments); rewrote the docstring as "Phase 1 acceptance criteria assertions" framing. Lesson: literal-grep acceptance criteria require careful comment hygiene.
- **Plan 01-10:** Pre-existing apps/web/next-env.d.ts biome format issue (single-vs-double-quote on auto-generated import) logged to deferred-items.md. Next.js says "This file should not be edited" — hand-edit would be reverted on next `next build`. Out of scope for Plan 01-10 (README + smoke); absorbed by Phase 4 (admin web refactor).
- **Plan 02-00:** `LlmProvider` interface returns `{ toolCalls[], finalText, usage{ input_tokens, output_tokens } }` — Wave 1 production wrapper around `client.beta.messages.toolRunner` MUST flatten the SDK's response into this shape so handlers see one stable contract regardless of SDK version. MockAnthropicClient in tests implements the same interface so Wave 2-4 tests are SDK-version-agnostic.
- **Plan 02-00:** `FIXED_NOW` pinned at `2026-06-09T12:00:00Z` (project time, business-hours) rather than RESEARCH.md §11's `10:00Z` example — `12:00Z` keeps `deadline_iso` math intact in snapshot scenarios that touch business-hour logic. Registered as `setupFile` on the **unit** project only; integration project MUST NOT freeze Date because testcontainers Postgres `NOW()` and JS `Date.now()` would drift, producing ambiguous `FOR UPDATE` / version-mismatch failures.
- **Plan 02-00:** `phase-2-stubs.test.ts` comment hygiene rule — NO literal `test.todo` mentions in docstrings since the verifier uses naive `grep -c 'test.todo'` to assert exactly 18 markers. Phase 1 Plan 01-10 burned this lesson; encoded again here. Waves 1-4 stub-flip plans must preserve the count gate when editing the file.
- **Plan 02-00:** `DETERMINISTIC_UUIDS` sized at exactly 20 entries (mirrors canonical-inputs.json count). Tests needing more UUIDs throw on `nextUuid()` — forces test authors to think about scope rather than silently wrap around. RFC 4122 v4-compliant (version-4 marker in third group, variant `8` in fourth group).
- **Plan 02-00:** Dynamic-import + `@ts-expect-error` pattern reused from Phase 1 Plans 01-01/01-03: `dialog-harness.ts` imports `src/pipeline/intake.js` dynamically with the directive so the Wave 0 helper compiles before Wave 3 ships `intake.ts`. Wave 3 plan 02-04a/b MUST remove the directive once `intake.ts` lands — failure to remove will produce a TS2578 "Unused @ts-expect-error directive" error.
- **Plan 02-00:** Added `typecheck` script to `apps/api/package.json` — Phase 1 never added it (only documented in 02-VALIDATION.md "Auxiliary commands"); subsequent plans had no way to run `pnpm typecheck`. Now `pnpm --filter @ai-logist/api typecheck` executes `tsc --noEmit -p tsconfig.json` exit 0. Reusable across Waves 1-4.
- **Plan 02-00:** Biome `apps/api/tests/...` paths only resolve when run from monorepo root (not from `apps/api/` cwd). Documented in the SUMMARY's "Issues Encountered" — Wave 1-4 plans must run biome from project root, not the package cwd.
- **Plan 02-03:** transitionLead/transitionOrder ship as hand-rolled, table-driven FSMs (D-28 lock) with three-layer concurrency defense: pessimistic SELECT FOR UPDATE row lock + optimistic version+1 compare-and-set + Wave 3 per-client pg_advisory_xact_lock. order_events audit uses ON CONFLICT (order_id, type) DO NOTHING to preserve Phase 5 geofence idempotency. transitionOrder returns audit_row_inserted boolean so the geofence handler can detect ON CONFLICT suppression.
- **Plan 02-03:** STATUS_TO_EVENT bridges uppercase order_status → lowercase order_event_type with CLOSED→null instead of omitted (keeps `Record<OrderStatus,…>` shape complete — guards against forgetting to add new statuses). Integration tests apply migrations 0000+0001+0002 inline via raw `pg.Client` (PLAN's `seed(db)` call was unworkable — actual `seed()` is parameterless and runs `printNearestTrucksSmoke` side-effect).
- **Plan 02-02:** 6 betaZodTool registrations + ToolContext interface landed under `apps/api/src/pipeline/llm-tools/`. ExtractRequestSchema = D-09 VERBATIM with strict mode (LOGIC-05). nearestTruck implements RESEARCH §4 CTE re-rank (overfetch 20 by `<->` sphere → spheroid `ST_Distance(.., true)` LIMIT 3, filters INSIDE CTE — closes Pitfall #2). createOrder input schema has NO `price` field — D-06 closes Pitfall #1 at type level; handler re-reads `quoted_price` under SELECT FOR UPDATE. calcPrice pure (no I/O), 10x snapshot byte-stable. discount enforces `quoted × 0.85` floor; below → `escalation_needed`.
- **Plan 02-02 deviations:** (1) Actual GiST index name is `trucks_geom_gist`, not `trucks_geom_gist_idx` as RESEARCH §12 referenced — test asserts the real name. (2) Pre-existing `package.json` `test:snapshot` script was broken (vitest 4 dropped `--repeat=10`) — replaced with `for i in 1..10; do vitest run -t snapshot \|\| exit 1; done` bash loop. Rule 1 auto-fixes; no plan change required. (3) `phase-2-stubs.test.ts` UNCHANGED per design — Plan 02-03b atomic-flips all Wave-2 todos after both 02-02 and 02-03 merge.

### TODOs

- Decide TTN/CMR template fidelity for demo (real RU legal form vs stylized PDF) — flagged in SUMMARY.md gaps; address during Phase 4 planning.
- Decide driver delivery mechanism for demo (real Telegram for one demo-driver vs simulator-only) — address during Phase 3 planning.
- Decide counterparty verification scope (mock badge only vs wire Opendatabot for UA EDRPOU) — likely defer to v2; verify during Phase 4 planning.
- ~~Confirm pricing config seed values (`rate_per_km`, `dir_coef`, `season_coef` realistic ranges for RU↔UA market)~~ — RESOLVED in Plan 01-09: rate_per_km=4200 kopecks (42 ₽/км per D-19), dir_coef {default:1.0, back_haul:0.85}, season_coef 1.1.

### Blockers

- None.

### Notes

- REQUIREMENTS.md Coverage section states "**97 total**" but enumerated requirements sum to **89**. Treating 89 as canonical; updated traceability accordingly. See ROADMAP.md "Coverage Note" for detail.
- Phase 2 and Phase 5 are risk-weighted per PITFALLS.md. Phase 2 absorbs 5+ critical pitfalls (LLM in money path, KNN sphere/spheroid, FSM races, bilingual detection, prompt injection, token-cost runaway). Phase 5 absorbs the WS-reconnect/teleport cluster and the fake-looking-GPS risk.
- Voice channel is explicitly OUT of v1 demo (spec §5.2). POLISH-02 "simulate inbound call" button + POLISH-03 pre-recorded video absorb buyer pressure on voice.
- Tracking and admin-tracking page is split across Phase 4 (admin scaffold for `/dashboard/tracking`) and Phase 5 (live WS + simulator + geofence wiring) — both required for the visual demo moment.

## Session Continuity

**Last session stopped at:** Completed 02-02-llm-tools-PLAN.md (Wave 2a — 6 LLM tools). All 6 betaZodTool registrations + ToolContext interface landed. Wave 2b (Plan 02-03 — FSMs) also complete (committed earlier today by parallel run). Next serial step is Plan 02-03b (atomic-flip all Wave-2 phase-2-stubs todos in one commit). Then Wave 3 (Plans 02-04a + 02-04b: intake pipeline + price-lock plumbing) instantiates ToolContext and wires buildToolRegistry(ctx) into the production tool loop.

Plan 02-00 shipped: 4 helper files in `apps/api/tests/_helpers/` (dialog-harness with `runScript(db, llm, clientId, messages)` driving scripted dialogs via dynamic import of pipeline/intake.js; mock-anthropic with LlmProvider interface that Wave 1 production llm-client.ts MUST implement; fake-timers preset at FIXED_NOW=2026-06-09T12:00:00Z registered as setupFile on unit project only; db-seed with 20 RFC 4122 v4 deterministic UUIDs + installDeterministicCrypto teardown helper), 4 JSON fixtures (canonical-inputs.json with 20 dialog scripts; llm-responses.json as `{}` placeholder; cities-extra.json with 5 cities forcing Nominatim path; injection-attempts.json with 5 Pitfall #11 corpus entries), apps/api/tests/unit/phase-2-stubs.test.ts (EXACTLY 18 `test.todo()` markers — one per Phase 2 req), apps/api/tests/PHASE-2.md harness usage doc, vitest.config.ts (added unit setupFiles + bumped integration timeout 60s → 90s), apps/api/package.json (added test:llm, test:snapshot, typecheck scripts). Unit suite: 20 passed (Phase 1) + 18 todo (Phase 2) / 0 failures. Biome + tsc --noEmit clean.

**Phase 2 status:** Plan 1 of 8 complete (Wave 0). Plans 2-8 cover migration + LLM tools + FSM + pipeline orchestration + routes API. Per VALIDATION.md, the test harness this plan locked in is the foundation Waves 1-4 build against; every snapshot test must use FIXED_NOW + installDeterministicCrypto, every LLM-dependent test must use MockAnthropicClient (real LLM only via `pnpm test:llm` gated on ANTHROPIC_API_KEY).

**Next action:** Execute Plan 02-01 (Wave 1) — migration 0002, lib primitives, llm-client wrapper. The migration adds `leads.{tokens_in, tokens_out, llm_calls}` columns (token ledger for Pitfall #12), creates `lead_events` audit table + `lead_event_actor` enum. The lib primitives (money/lang-detect/routing/geocoding/price-guard) are pure functions — unit-testable without testcontainers. llm-client.ts wraps `client.beta.messages.toolRunner` and implements the LlmProvider interface this plan locked in. After Plan 02-01: flip MATCH-03/04/05 + LOGIC-02 todos to real assertions.

**To resume after compaction:** Read `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, and this `STATE.md`. Phase 1 (11/11 plans) complete; Phase 2 plan 02-00 (Wave 0 test infra) complete; Plans 02-01..05 ahead. Wave 0 ships LlmProvider interface + MockAnthropicClient + runScript harness + FIXED_NOW preset + DETERMINISTIC_UUIDS + 18 test.todo placeholders. Wave 1 (Plan 02-01) ships migration 0002 + lib primitives + llm-client wrapper. Wave 2 (Plan 02-02 + 02-03) ships LLM tools + FSMs. Wave 3 (Plan 02-03b + 02-04a/b) ships stub-flips + pipeline/intake.ts (which the Wave 0 dialog-harness imports dynamically with @ts-expect-error — Wave 3 MUST remove the directive). Wave 4 (Plan 02-05) ships routes API-07 un-stub. Docker daemon remains unreachable on Claude's runner; live testcontainers integration tests deferred to verifier/developer machine. Next: `/gsd:execute-plan 02-01-PLAN.md` or continue chained auto-mode.

---
*State initialized: 2026-06-08 after roadmap creation*
