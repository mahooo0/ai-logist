---
phase: 03-telegram-channel
plan: 01
subsystem: telegram-foundation
tags: [grammy, telegram, fastify-plugin, migration, drizzle, env, config]

# Dependency graph
requires:
  - phase: 02-llm-pipeline-deterministic-core-high-risk
    provides: "config.ts ConfigSchema pattern, Fastify plugin lifecycle (db + redis), drizzle-kit generate workflow with custom-quote post-processor"
  - phase: 03-telegram-channel
    plan: 00
    provides: "MockTelegramBot factory (createMockBot) + webhook-driver + 11 fixtures + 9 phase-3-stubs test.todo placeholders ready for Wave 2+ flips"
provides:
  - "config.requireTelegramConfig() runtime boundary guard for live Telegram channel (throws when token/secret/username missing)"
  - "Migration 0003_phase3_telegram.sql adding leads.manager_active BOOLEAN NOT NULL DEFAULT FALSE + partial index trucks_driver_tg_idx ON trucks(driver_telegram_id) WHERE NOT NULL"
  - "Drizzle schema column leads.managerActive matching migration"
  - "grammy 1.43.0 package installed in apps/api dependencies"
  - "channels/telegram/bot.ts exporting createBot(cfg) factory + TelegramContext type alias"
  - "plugins/telegram.ts Fastify plugin decorating app.bot when TELEGRAM_BOT_TOKEN is configured (with dependencies:['db'] + onClose stop hook)"
  - "FastifyInstance.bot type augmentation (module declaration)"
  - ".env.example documents all 5 Telegram env entries (root + apps/api per-package copy)"
affects:
  - 03-02-webhook-route
  - 03-03-adapter-keyboards-outbound
  - 03-04-notifications-driver-fsm-hook
  - 03-05-manager-intercept-readme

# Tech tracking
tech-stack:
  added:
    - "grammy@1.43.0 (Telegram Bot framework, TS-native, webhook-first per STACK.md)"
  patterns:
    - "Boundary-guard pattern: keep token/secret .optional() in Zod schema (so Phase 2 tests boot without them) + add requireTelegramConfig() throwing helper called at plugin/route boundary. Mirrors ANTHROPIC_API_KEY precedent from Phase 2."
    - "Skip-on-missing-config Fastify plugin: when TELEGRAM_BOT_TOKEN absent, plugin logs warn and returns early WITHOUT decorating app.bot. Routes that touch app.bot must guard via `if ('bot' in app)` or call requireTelegramConfig() up-front. Boot-with-bot-disabled is intentional so non-Telegram routes stay reachable in dev."
    - "Drizzle 0.45.2 customType post-processor (inherited from Phase 1 Plan 01-07) runs as part of `pnpm db:generate` to strip quotes around `geography(Point, 4326)` — confirmed idempotent on re-runs across the new 0003 migration (no quote changes needed since only manager_active touched leads)."
    - "drizzle-kit generates random-slug migration filenames (`0003_sharp_randall_flagg.sql`); the rename-and-update-journal-tag step is the convention (matches Phase 1 0001_init → 0001_init.sql + Phase 2 0002_phase2_lead_events_tokens.sql)."

key-files:
  created:
    - apps/api/.env.example
    - apps/api/drizzle/0003_phase3_telegram.sql
    - apps/api/drizzle/meta/0003_snapshot.json
    - apps/api/src/channels/telegram/bot.ts
    - apps/api/src/plugins/telegram.ts
  modified:
    - .env.example
    - apps/api/package.json
    - apps/api/src/app.ts
    - apps/api/src/config.ts
    - apps/api/src/persistence/schema/leads.ts
    - apps/api/drizzle/meta/_journal.json
    - pnpm-lock.yaml

key-decisions:
  - "Kept TELEGRAM_BOT_TOKEN + TELEGRAM_WEBHOOK_SECRET as `.optional()` instead of promoting to required (despite CONTEXT D-30 wording). Rationale: Phase 2 unit tests (148 passing) boot without these env vars; requireTelegramConfig() runtime guard at the plugin/route boundary gives the same safety + explicit error message. Same precedent as ANTHROPIC_API_KEY (Plan 02-01)."
  - "Migration 0003 contains ONLY leads.manager_active + trucks_driver_tg_idx partial index. trucks.driver_telegram_id column was ALREADY ADDED in Phase 1 (verified at apps/api/src/persistence/schema/trucks.ts:24 — `driverTelegramId: text('driver_telegram_id')`). RESEARCH override on D-20 explicitly forbids re-adding it; drizzle-kit generate confirmed no trucks ALTER was emitted."
  - "Fastify plugin declared with `dependencies: ['db']` only (NOT 'redis'). Phase 3 plan boundary doesn't touch Redis (no FSM session storage in this wave; intake.ts already owns advisory locks). Removing the unnecessary dependency keeps plugin registration order stricter — Phase 3.1 voice can still add 'redis' if needed."
  - "Renamed auto-generated `0003_sharp_randall_flagg.sql` → `0003_phase3_telegram.sql` + updated journal tag in sync. Conventions match Phase 1 (0001_init) + Phase 2 (0002_phase2_lead_events_tokens). The randomized drizzle-kit slug would have made grep gates (`grep -E ALTER TABLE leads.*manager_active apps/api/drizzle/0003_*.sql`) less self-documenting."
  - "Added apps/api/.env.example as a per-package convenience copy in addition to the authoritative root .env.example. Both list the 5 Telegram entries; the per-package copy makes onboarding to apps/api easier without forcing developers to navigate up to the root."

patterns-established:
  - "Phase 3 channels-directory convention — `apps/api/src/channels/<channel>/{bot,adapter,handlers,keyboards,notifications,setup}.ts` per RESEARCH §Recommended Project Structure. Wave 1 plants `bot.ts`; subsequent waves add adapter/handlers/keyboards/notifications under the same directory."
  - "Plugin-vs-route boundary for env validation — config.ts schema stays permissive (tests boot); concrete usage sites (plugin + route handler) call requireXxxConfig() helper that throws with explicit error message. Reusable for Phase 3.1 voice (`requireVoiceConfig`) + Phase 5 OSRM (`requireRoutingConfig`)."

requirements-completed: [TG-01, TG-06]

# Metrics
duration: 5m17s
completed: 2026-06-10
---

# Phase 3 Plan 01: Telegram Foundation Summary

**grammY 1.43 installed + 3 new env vars + requireTelegramConfig() boundary guard + migration 0003 (leads.manager_active + trucks_driver_tg partial index) + createBot factory + Fastify telegram plugin decorating app.bot — Wave 1 lands the scaffold so Wave 2 (webhook route) and Wave 3+ (adapter/handlers/keyboards/notifications) can land their code against a typed app.bot decorator.**

## Performance

- **Duration:** ~5m17s
- **Started:** 2026-06-10T05:46:12Z
- **Completed:** 2026-06-10T05:51:29Z
- **Tasks:** 3 (all `auto` with `tdd="true"` semantics — TDD here means "verify acceptance gates before commit")
- **Files created:** 5
- **Files modified:** 7

## Accomplishments

- **Task 1 (`f3d34a6`)** — Extended `apps/api/src/config.ts` ConfigSchema with 3 new entries (TELEGRAM_BOT_USERNAME optional, TELEGRAM_PUBLIC_URL optional URL, TELEGRAM_SET_WEBHOOK_ON_BOOT coerced boolean default false) WITHOUT touching the 2 existing TELEGRAM_* optional entries. Added `requireTelegramConfig()` export at file bottom that throws `Telegram channel requires TELEGRAM_BOT_TOKEN + TELEGRAM_WEBHOOK_SECRET + TELEGRAM_BOT_USERNAME` if any are absent. Installed `grammy@^1.43.0` (resolved to 1.43.0 — STACK.md-confirmed version) via `pnpm --filter @ai-logist/api add`. Documented all 5 Telegram env entries in both `apps/api/.env.example` (new — per-package convenience) and root `.env.example`. Typecheck + biome clean.
- **Task 2 (`ef23043`)** — Added `boolean` to `drizzle-orm/pg-core` imports in `apps/api/src/persistence/schema/leads.ts` and inserted `managerActive: boolean('manager_active').notNull().default(false)` column between `priceOverrides` and `version`. Ran `DATABASE_URL=... pnpm db:generate` which auto-emitted `apps/api/drizzle/0003_sharp_randall_flagg.sql` + `meta/0003_snapshot.json` (14 tables tracked, `manager_active` present in `public.leads.columns`). Renamed SQL file to `0003_phase3_telegram.sql` and synced journal tag. Appended the partial index:
  ```sql
  CREATE INDEX IF NOT EXISTS trucks_driver_tg_idx
    ON trucks (driver_telegram_id)
    WHERE driver_telegram_id IS NOT NULL;
  ```
  drizzle-kit produced ONLY `ALTER TABLE leads ADD COLUMN manager_active` — no trucks ALTER (confirms D-20 override: trucks.driver_telegram_id already exists as TEXT). Typecheck + biome + 148 unit tests pass.
- **Task 3 (`587fceb`)** — Created `apps/api/src/channels/telegram/bot.ts` exporting `TelegramContext = Context` type alias + `createBot(cfg: AppConfig): Bot<TelegramContext>` factory that throws if `TELEGRAM_BOT_TOKEN` missing. Created `apps/api/src/plugins/telegram.ts` — `fastify-plugin` named 'telegram' with `dependencies: ['db']` that (when token present) creates bot via `createBot`, awaits `bot.init()`, decorates `app.bot`, logs `{ username }` at info, and registers `onClose` hook calling `bot.stop()`. Module augmentation adds `bot: Bot` to `FastifyInstance` type. Updated `apps/api/src/app.ts` to import and register `telegramPlugin` between `redisPlugin` and the OpenAPI/route registrations. Typecheck + biome + 148 unit tests pass.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend config.ts + add grammy + write .env.example** — `f3d34a6` (feat)
2. **Task 2: Migration 0003 (leads.manager_active + trucks_driver_tg_idx) + schema patch** — `ef23043` (feat)
3. **Task 3: createBot factory + telegram Fastify plugin + register in app.ts** — `587fceb` (feat)

Plus the metadata commit (follows this summary).

## Files Created/Modified

### Created (5)

- `apps/api/.env.example` — per-package convenience copy of env-example content; mirrors the root `.env.example` for quick reference while developing apps/api features.
- `apps/api/drizzle/0003_phase3_telegram.sql` — migration: `ALTER TABLE leads ADD COLUMN manager_active boolean DEFAULT false NOT NULL` + `CREATE INDEX IF NOT EXISTS trucks_driver_tg_idx ON trucks (driver_telegram_id) WHERE driver_telegram_id IS NOT NULL`.
- `apps/api/drizzle/meta/0003_snapshot.json` — drizzle-kit-generated schema snapshot (14 tables, `manager_active` present in `public.leads.columns`).
- `apps/api/src/channels/telegram/bot.ts` — `createBot(cfg)` factory + `TelegramContext` type alias. Throws if `TELEGRAM_BOT_TOKEN` missing.
- `apps/api/src/plugins/telegram.ts` — Fastify plugin (`fp(...)` with `dependencies:['db']`) that decorates `app.bot` when token configured; skips decoration with `app.log.warn` when token missing; registers `onClose` hook calling `bot.stop()`.

### Modified (7)

- `.env.example` — replaced the 2-line "uncomment when you add bot" stub with 5 active Telegram entries (token, secret, username, public_url, set_webhook_on_boot).
- `apps/api/package.json` — added `grammy: "^1.43.0"` to dependencies.
- `apps/api/src/app.ts` — imported `telegramPlugin` and registered it AFTER `redisPlugin` and BEFORE `swagger` registrations.
- `apps/api/src/config.ts` — added 3 new Zod entries + `requireTelegramConfig()` helper.
- `apps/api/src/persistence/schema/leads.ts` — added `boolean` to drizzle-orm/pg-core imports + `managerActive` column.
- `apps/api/drizzle/meta/_journal.json` — appended entry idx=3 with tag `0003_phase3_telegram`.
- `pnpm-lock.yaml` — auto-updated by pnpm add grammy.

## Decisions Made

- **Keep token+secret `.optional()` in Zod, add requireTelegramConfig() guard at plugin boundary.** Phase 2 unit tests (148 passing) boot without TELEGRAM env vars; promoting them to required would have broken every Phase 1+2 test config. requireTelegramConfig() at the plugin/route boundary gives equivalent safety with an explicit error message. Identical precedent: ANTHROPIC_API_KEY (Plan 02-01 — kept optional in Zod, AnthropicLlmClient constructor throws if instantiated without a key).
- **Migration 0003 contains ONLY leads.manager_active + trucks_driver_tg_idx partial index.** Verified at `apps/api/src/persistence/schema/trucks.ts:24` that `driverTelegramId: text('driver_telegram_id')` is already declared (Phase 1 — predates Phase 3 planning by 24 hours). RESEARCH override on D-20 says explicitly: "Skip ALTER TABLE trucks in migration 0003". drizzle-kit generate output confirms — only `ALTER TABLE leads` was emitted (no trucks delta). Migration runs cleanly on a fresh Postgres because Phase 1 already created the column.
- **Plugin dependencies: ['db'] only — not 'redis'.** Phase 3 plan boundary does not need Redis (intake.ts already holds the advisory lock for per-client serialization). Removing the unnecessary dependency keeps plugin registration order stricter. Phase 3.1 (voice) can extend dependencies if it adds Redis-backed FSM sessions.
- **Rename auto-generated drizzle-kit slug to `0003_phase3_telegram.sql` + sync journal tag.** drizzle-kit generates random Marvel-character-style slugs (`0003_sharp_randall_flagg.sql`) which would have broken the CONTEXT D-30 grep gates that assert presence of `0003_phase3_*` filenames. Manual rename + journal tag update is the convention established in Phase 1 (0001_init) + Phase 2 (0002_phase2_lead_events_tokens).
- **Per-package `apps/api/.env.example` alongside root `.env.example`.** Both list the same 5 Telegram entries. Per-package copy makes onboarding to apps/api easier without forcing developers to navigate up to the root for env reference. Root remains authoritative for compose/CI loading.
- **`registerTelegramHandlers` wiring deferred to Wave 3.** Per RESEARCH Pattern 1, handlers.ts registration belongs inside the plugin; this plan ships only the scaffold. Left an explicit comment in plugins/telegram.ts as a forward marker: `// registerTelegramHandlers wired in Wave 3 (Plan 03-03)`. Keeps Wave 1 minimal — the plugin already decorates app.bot, which is what Wave 2's webhook route needs.

## Deviations from Plan

None — plan executed exactly as written.

Edge note: drizzle-kit needs `DATABASE_URL` even for `generate` (not just migrate). The plan said `pnpm --filter @ai-logist/api db:generate`; in practice it required `DATABASE_URL=postgresql://... pnpm db:generate` because the drizzle config reads the env var at startup. This is a Phase 1 holdover (drizzle.config.ts validates DATABASE_URL is set), not a Phase 3 deviation — using a localhost dev URL satisfies the validation without needing a live DB connection (drizzle-kit generate is purely schema-diff, no DB roundtrip).

## Authentication Gates

None encountered. All work was offline (typecheck, biome, drizzle-kit schema diff, unit tests). No Telegram API calls made — that lands in Wave 5 (`pnpm telegram:setup` script).

## Issues Encountered

None blocking. Notes:

- `pnpm --filter @ai-logist/api db:generate` requires DATABASE_URL set (Phase 1 holdover). Plan didn't call this out; using localhost dev URL satisfies the env validation without needing a live DB.
- Initial typecheck after adding grammy import passed cleanly — grammy 1.43 has zero TS errors against `module:NodeNext + esModuleInterop:true` (verified). The `import { Bot, type Context } from 'grammy'` is the canonical entry point per grammY docs.
- Biome wrapped no lines on first format pass — file lengths stayed inside the 100-char limit. No grep-count gates touched.

## Next Phase Readiness

- **Wave 2 (Plan 03-02)** can now `import type { Bot } from 'grammy'` to type-check route handlers that call `app.bot.api.sendMessage`. The plugin guarantees `app.bot` is decorated when TELEGRAM_BOT_TOKEN is present; webhook route will need to call `requireTelegramConfig()` at module load (or per-request) to fail fast in production. Use the new SQL file `apps/api/drizzle/0003_phase3_telegram.sql` if the integration tests need to apply 0003 inline (matches Phase 2 plan pattern).
- **Wave 3 (Plan 03-03)** can `import { createTelegramOutbound } from '../channels/telegram/outbound.ts'` after adding `outbound.ts` next to `bot.ts`. The `// registerTelegramHandlers wired in Wave 3` comment in plugins/telegram.ts is the insertion point.
- **Wave 4 (Plan 03-04)** can use `leads.managerActive` via `leadsRepo.findById` (Drizzle infers the new field automatically — verified by typecheck pass).
- **Wave 5 (Plan 03-05)** can call `requireTelegramConfig()` from the manager-intercept route handler to fail-fast with explicit 503 error if env not configured.

**No blockers.** Plan progress: 2/6 plans complete in Phase 3 (03-00 + 03-01). 4 plans remaining: 03-02 webhook route, 03-03 adapter+keyboards+outbound, 03-04 notifications+driver-fsm-hook, 03-05 manager intercept + README + final stub flip.

## Known Stubs

None introduced by this plan. The plugin's "skip when token missing" path is intentional (RESEARCH Open Question §1) — not a stub. The `// registerTelegramHandlers wired in Wave 3` comment is a forward-marker, not a stub: handlers genuinely belong in Wave 3 (callback query patterns + /start /help commands), not Wave 1.

## Self-Check: PASSED

Verified all created files exist:
- apps/api/.env.example — FOUND
- apps/api/drizzle/0003_phase3_telegram.sql — FOUND (contains `manager_active` + `trucks_driver_tg_idx`)
- apps/api/drizzle/meta/0003_snapshot.json — FOUND (14 tables, manager_active in leads.columns)
- apps/api/src/channels/telegram/bot.ts — FOUND
- apps/api/src/plugins/telegram.ts — FOUND

Verified all modified files updated correctly:
- .env.example — 5 Telegram entries replace 2-line stub
- apps/api/package.json — grammy 1.43.0 in dependencies
- apps/api/src/app.ts — telegramPlugin registered after redisPlugin
- apps/api/src/config.ts — 3 new entries + requireTelegramConfig export
- apps/api/src/persistence/schema/leads.ts — managerActive column + boolean import
- apps/api/drizzle/meta/_journal.json — entry idx=3 tag 0003_phase3_telegram, 4 entries total
- pnpm-lock.yaml — grammy 1.43.0 lockfile entry

Verified commits exist:
- f3d34a6 (Task 1) — FOUND
- ef23043 (Task 2) — FOUND
- 587fceb (Task 3) — FOUND

Verified all 8 plan success criteria:
- [x] 3 new env vars + requireTelegramConfig in config.ts
- [x] grammy 1.43.0 in dependencies (verified via pnpm list grammy)
- [x] Migration 0003 ONLY ALTERs leads + creates trucks_driver_tg partial index; NO trucks ALTER
- [x] leads.ts schema has managerActive column matching migration
- [x] createBot factory throws when token missing (defensive guard)
- [x] telegramPlugin decorates app.bot when token present; logs warn + skips when absent
- [x] app.ts wires plugin between redis and routes (line 60, after redisPlugin line 59)
- [x] Tsc + Biome clean; 148 unit tests pass / 9 todo (unchanged from Plan 03-00)

Verified negative gate:
- `! grep -E "ALTER TABLE trucks ADD COLUMN.*driver_telegram_id" apps/api/drizzle/0003_phase3_telegram.sql` → no match (PASS — trucks column already exists from Phase 1)

---
*Phase: 03-telegram-channel*
*Completed: 2026-06-10*
