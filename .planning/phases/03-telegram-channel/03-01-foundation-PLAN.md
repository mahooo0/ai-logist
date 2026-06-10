---
phase: 03-telegram-channel
plan: 01
type: execute
wave: 1
depends_on: ["03-00"]
files_modified:
  - apps/api/src/config.ts
  - apps/api/drizzle/0003_phase3_telegram.sql
  - apps/api/drizzle/meta/_journal.json
  - apps/api/drizzle/meta/0003_snapshot.json
  - apps/api/src/persistence/schema/leads.ts
  - apps/api/src/channels/telegram/bot.ts
  - apps/api/src/plugins/telegram.ts
  - apps/api/package.json
  - apps/api/.env.example
autonomous: true
requirements: [TG-01, TG-06]

must_haves:
  truths:
    - "config.ts validates TELEGRAM_BOT_USERNAME, TELEGRAM_PUBLIC_URL, TELEGRAM_SET_WEBHOOK_ON_BOOT env vars"
    - "config.ts exports requireTelegramConfig() that throws when token+secret+username missing"
    - "Migration 0003 adds leads.manager_active BOOLEAN NOT NULL DEFAULT FALSE"
    - "Migration 0003 adds partial index trucks_driver_tg_idx ON trucks (driver_telegram_id) WHERE driver_telegram_id IS NOT NULL"
    - "Migration 0003 does NOT touch trucks.driver_telegram_id column (already exists as text from Phase 1)"
    - "apps/api/src/channels/telegram/bot.ts exports createBot(cfg): Bot<Context>"
    - "apps/api/src/plugins/telegram.ts decorates app.bot when token present; logs warn + skips when missing (per RESEARCH Open Question §1 recommendation)"
    - "grammy 1.43 added to apps/api dependencies"
  artifacts:
    - path: apps/api/src/config.ts
      provides: "5 Telegram env entries: TELEGRAM_BOT_TOKEN/SECRET (already present, kept optional), TELEGRAM_BOT_USERNAME (optional), TELEGRAM_PUBLIC_URL (optional URL), TELEGRAM_SET_WEBHOOK_ON_BOOT (coerced boolean, default false); requireTelegramConfig() export"
      contains: "TELEGRAM_BOT_USERNAME"
    - path: apps/api/drizzle/0003_phase3_telegram.sql
      provides: "ALTER TABLE leads ADD COLUMN manager_active; CREATE INDEX IF NOT EXISTS trucks_driver_tg_idx"
      contains: "manager_active"
    - path: apps/api/src/persistence/schema/leads.ts
      provides: "managerActive: boolean('manager_active').notNull().default(false) column on leads pgTable"
      contains: "managerActive"
    - path: apps/api/src/channels/telegram/bot.ts
      provides: "export function createBot(cfg: AppConfig): Bot — throws if TELEGRAM_BOT_TOKEN missing"
      contains: "createBot"
    - path: apps/api/src/plugins/telegram.ts
      provides: "Fastify plugin that decorates app.bot if config has token; awaits bot.init(); onClose stop hook"
      contains: "fastify-plugin"
  key_links:
    - from: apps/api/src/plugins/telegram.ts
      to: apps/api/src/channels/telegram/bot.ts
      via: "import { createBot } from '../channels/telegram/bot.js'"
      pattern: "createBot"
    - from: apps/api/src/persistence/schema/leads.ts
      to: apps/api/drizzle/0003_phase3_telegram.sql
      via: "drizzle-kit generate uses schema → SQL; manager_active column on both sides"
      pattern: "manager_active"
---

<objective>
Wave 1 lands the foundation: config env extension, migration 0003 (leads.manager_active ONLY — driver_telegram_id ALREADY EXISTS per RESEARCH override), and the bot factory + Fastify plugin scaffold. NO webhook route, NO adapter, NO handlers yet — just the Bot instance accessible via `app.bot`.

Purpose: Subsequent waves need `app.bot` decorated and the migration applied to land their routes/adapters. Splitting foundation out keeps each plan focused.

Output:
- `apps/api/src/config.ts` extended with 3 new env vars + `requireTelegramConfig()` helper (per D-30 + RESEARCH Code Block 0)
- `apps/api/drizzle/0003_phase3_telegram.sql` — adds `leads.manager_active` + `trucks_driver_tg_idx` partial index ONLY (per RESEARCH override on D-20)
- `apps/api/src/persistence/schema/leads.ts` — `managerActive` column added to Drizzle schema
- `apps/api/src/channels/telegram/bot.ts` — `createBot(cfg)` factory (per RESEARCH Pattern 1)
- `apps/api/src/plugins/telegram.ts` — Fastify plugin decorating `app.bot` (per RESEARCH Pattern 1)
- `apps/api/package.json` — grammy 1.43 added
- `apps/api/.env.example` — 3 new entries documented
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/03-telegram-channel/03-CONTEXT.md
@.planning/phases/03-telegram-channel/03-RESEARCH.md
@.planning/phases/03-telegram-channel/03-00-SUMMARY.md
@apps/api/src/config.ts
@apps/api/src/persistence/schema/leads.ts
@apps/api/src/persistence/schema/trucks.ts
@apps/api/drizzle/0002_phase2_lead_events_tokens.sql
@apps/api/drizzle/meta/_journal.json
@apps/api/src/app.ts
@apps/api/src/plugins/db.ts

<interfaces>
<!-- Verified existing state (from RESEARCH Runtime State Inventory + direct reads): -->
<!-- - apps/api/src/config.ts ALREADY HAS: TELEGRAM_BOT_TOKEN (optional), TELEGRAM_WEBHOOK_SECRET (optional). DO NOT re-declare these — extend. -->
<!-- - apps/api/src/persistence/schema/trucks.ts line 24: `driverTelegramId: text('driver_telegram_id')` ALREADY EXISTS. Migration 0003 MUST NOT re-add. -->
<!-- - apps/api/src/persistence/repos/clients.ts line 17: `findByTelegramId` ALREADY EXISTS. -->
<!-- - apps/api/drizzle/meta/_journal.json already contains entries for 0000+0001+0002. Add 0003. -->
<!-- - apps/api/src/plugins/db.ts uses fp() pattern with `name: 'db'`. telegram plugin follows same pattern with `dependencies: ['db']` (do NOT depend on redis — not used by Phase 3). -->

<!-- grammY 1.43 surface needed for Wave 1: -->
<!-- - `import { Bot, type Context } from 'grammy'` -->
<!-- - `new Bot<Context>(token, options?)` constructor -->
<!-- - `bot.init()` async — fetches getMe and populates botInfo -->
<!-- - `bot.stop()` async — drains internal queues -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend config.ts + add grammy + write .env.example</name>
  <files>apps/api/src/config.ts, apps/api/package.json, apps/api/.env.example</files>
  <behavior>
    - config.ts ConfigSchema gains 3 NEW Zod entries (TELEGRAM_BOT_USERNAME optional, TELEGRAM_PUBLIC_URL optional URL, TELEGRAM_SET_WEBHOOK_ON_BOOT coerced boolean default false) without touching the 2 existing TELEGRAM_* entries.
    - config.ts exports a `requireTelegramConfig()` function that throws Error('Telegram channel requires …') if any of token, secret, username is missing.
    - apps/api/package.json gets `"grammy": "^1.43.0"` in dependencies (verified via `npm view grammy version` returns 1.43.0 per RESEARCH).
    - .env.example documents 3 new vars with example values + `openssl rand -hex 32` hint.
  </behavior>
  <action>
    1. **config.ts** — Add inside ConfigSchema after the existing `TELEGRAM_WEBHOOK_SECRET` line (RESEARCH Code Block 0 verbatim):
       ```typescript
       // Phase 3 — additional Telegram env (D-30). Token + secret already declared
       // above as .optional() so Phase 2 tests boot without them. requireTelegramConfig()
       // below enforces presence at the plugin/route boundary.
       TELEGRAM_BOT_USERNAME: z.string().optional(),
       TELEGRAM_PUBLIC_URL: z.string().url().optional(),
       TELEGRAM_SET_WEBHOOK_ON_BOOT: z.coerce.boolean().default(false),
       ```
       Add at bottom of file (after `export const config: AppConfig = parsed.data;`):
       ```typescript
       /** D-30 / RESEARCH Open Question §1 — boundary assertion for live Telegram channel. */
       export function requireTelegramConfig(): void {
         if (!config.TELEGRAM_BOT_TOKEN || !config.TELEGRAM_WEBHOOK_SECRET || !config.TELEGRAM_BOT_USERNAME) {
           throw new Error(
             'Telegram channel requires TELEGRAM_BOT_TOKEN + TELEGRAM_WEBHOOK_SECRET + TELEGRAM_BOT_USERNAME'
           );
         }
       }
       ```

    2. **apps/api/package.json** — Run `pnpm --filter @ai-logist/api add grammy@^1.43.0`. This updates package.json + root pnpm-lock.yaml.

    3. **apps/api/.env.example** — Append (using Write tool to overwrite full file after Read; preserve existing entries):
       ```
       # Phase 3 — Telegram channel
       TELEGRAM_BOT_TOKEN=                 # from @BotFather; required for Telegram channel
       TELEGRAM_WEBHOOK_SECRET=            # generate via: openssl rand -hex 32
       TELEGRAM_BOT_USERNAME=              # bot username without @ (e.g. ai_logist_demo_bot)
       TELEGRAM_PUBLIC_URL=                # https URL for setWebhook (e.g. https://xxx.ngrok.io)
       TELEGRAM_SET_WEBHOOK_ON_BOOT=false  # true to auto-register webhook on app start
       ```
       (If .env.example doesn't exist yet, create with just these 5 lines plus existing Phase 1+2 entries — Read first to determine state.)
  </action>
  <verify>
    <automated>grep -q "TELEGRAM_BOT_USERNAME" apps/api/src/config.ts && grep -q "TELEGRAM_PUBLIC_URL" apps/api/src/config.ts && grep -q "TELEGRAM_SET_WEBHOOK_ON_BOOT" apps/api/src/config.ts && grep -q "requireTelegramConfig" apps/api/src/config.ts && grep -q '"grammy"' apps/api/package.json && grep -q "TELEGRAM_BOT_USERNAME" apps/api/.env.example && pnpm --filter @ai-logist/api typecheck 2>&1 | tail -5</automated>
  </verify>
  <done>
    config.ts has 5 TELEGRAM_* entries + requireTelegramConfig export; grammy^1.43.0 in dependencies; .env.example documents new vars; tsc passes.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Migration 0003 (leads.manager_active + trucks_driver_tg_idx) + schema patch</name>
  <files>
    apps/api/drizzle/0003_phase3_telegram.sql,
    apps/api/drizzle/meta/_journal.json,
    apps/api/drizzle/meta/0003_snapshot.json,
    apps/api/src/persistence/schema/leads.ts
  </files>
  <behavior>
    - leads.ts adds `managerActive: boolean('manager_active').notNull().default(false)` column (alphabetically placed near `bodyType`/`budget`).
    - 0003_phase3_telegram.sql ALTERs leads to add the column + CREATE INDEX IF NOT EXISTS on trucks.driver_telegram_id (partial WHERE NOT NULL).
    - 0003_phase3_telegram.sql does NOT add `trucks.driver_telegram_id` (already exists as text per Phase 1 — RESEARCH override on D-20).
    - meta/_journal.json appends entry for 0003.
    - meta/0003_snapshot.json captures the new schema snapshot (drizzle-kit generates this).
  </behavior>
  <action>
    1. **Update leads.ts schema** — Add `boolean` to the imports from `drizzle-orm/pg-core` (it's not currently imported per the existing file). Then add the column inside `pgTable('leads', {...})` near other simple-type columns (after `priceOverrides` and before `version`):
       ```typescript
       // Phase 3 D-21 — manager intercept gate. False = bot drives the conversation;
       // true = manager has taken over and bot is silent for this lead.
       managerActive: boolean('manager_active').notNull().default(false),
       ```
       And update the import line to add `boolean`:
       ```typescript
       import {
         bigint,
         boolean,
         index,
         integer,
         jsonb,
         numeric,
         pgTable,
         text,
         timestamp,
         uuid,
       } from 'drizzle-orm/pg-core';
       ```

    2. **Generate migration** — Run `pnpm --filter @ai-logist/api db:generate` (drizzle-kit generate). This auto-creates `0003_<random_slug>.sql` + updates `meta/_journal.json` and writes `meta/0003_snapshot.json`. Then RENAME the generated SQL file to `0003_phase3_telegram.sql` (keep journal entry in sync — journal's `tag` field gets the new name) so the filename matches CONTEXT D-30 conventions and integration tests can grep for it.

       If drizzle-kit produces additional ALTER TABLE statements (e.g. inferred reorder), VERIFY only `leads` is touched. If trucks shows up, the schema drift came from elsewhere — STOP and document.

    3. **Append partial index** — Edit the generated `0003_phase3_telegram.sql` to APPEND (after the auto-generated ALTER TABLE leads):
       ```sql
       --> phase 3: partial index for driver_telegram_id lookups (notifyDriver path)
       CREATE INDEX IF NOT EXISTS trucks_driver_tg_idx
         ON trucks (driver_telegram_id)
         WHERE driver_telegram_id IS NOT NULL;
       ```

    4. **Verify the migration runs cleanly** against a fresh Postgres testcontainer:
       ```bash
       pnpm --filter @ai-logist/api vitest run tests/integration/migration-0002.test.ts
       ```
       (Phase 2 migration test passes → confirms 0003 doesn't break the journal chain.) Then verify `0003_phase3_telegram.sql` contains the literal `manager_active`, NOT `driver_telegram_id` as a new column ALTER TABLE.

    DO NOT modify trucks.ts — `driverTelegramId` already exists there per Phase 1 (verified). DO NOT include `ALTER TABLE trucks ADD COLUMN driver_telegram_id` in 0003. RESEARCH override on D-20 explicitly forbids this.
  </action>
  <verify>
    <automated>test -f apps/api/drizzle/0003_phase3_telegram.sql && grep -q "manager_active" apps/api/drizzle/0003_phase3_telegram.sql && grep -q "trucks_driver_tg_idx" apps/api/drizzle/0003_phase3_telegram.sql && ! grep -E "ALTER TABLE trucks ADD COLUMN.*driver_telegram_id" apps/api/drizzle/0003_phase3_telegram.sql && grep -q "managerActive" apps/api/src/persistence/schema/leads.ts && grep -q "0003" apps/api/drizzle/meta/_journal.json && pnpm --filter @ai-logist/api typecheck 2>&1 | tail -5</automated>
  </verify>
  <done>
    leads.ts has `managerActive` column; 0003_phase3_telegram.sql contains ALTER TABLE leads + CREATE INDEX trucks_driver_tg_idx; does NOT add driver_telegram_id column; journal entry for 0003 present; tsc passes.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: createBot factory + telegram Fastify plugin + register in app.ts</name>
  <files>
    apps/api/src/channels/telegram/bot.ts,
    apps/api/src/plugins/telegram.ts,
    apps/api/src/app.ts
  </files>
  <behavior>
    - bot.ts exports `TelegramContext = Context` type alias + `createBot(cfg: AppConfig): Bot<TelegramContext>` factory.
    - createBot throws if TELEGRAM_BOT_TOKEN missing (defensive — plugins/telegram.ts pre-checks).
    - plugins/telegram.ts is a `fastify-plugin` named 'telegram' with dependency 'db'. If token missing → logs warn + skips decoration. If present → creates bot, awaits `bot.init()`, decorates `app.bot`, registers onClose hook to `bot.stop()`.
    - module augmentation: `declare module 'fastify' { interface FastifyInstance { bot: Bot } }` — making `app.bot` typed.
    - app.ts registers telegramPlugin AFTER redisPlugin and BEFORE route registrations (per RESEARCH Pattern 1).
  </behavior>
  <action>
    1. **apps/api/src/channels/telegram/bot.ts** (per RESEARCH Pattern 1 verbatim):
       ```typescript
       // Phase 3 D-02 — grammY 1.43 bot factory. createBot is called by
       // plugins/telegram.ts at app boot. Token validation is enforced both here
       // (defensive) and at the plugin (early-skip path).
       import { Bot, type Context } from 'grammy';
       import type { AppConfig } from '../../config.js';

       // Phase 3 uses the default Context — no flavors yet. Future plugins
       // (sessions, conversations) would extend this.
       export type TelegramContext = Context;

       export function createBot(cfg: AppConfig): Bot<TelegramContext> {
         if (!cfg.TELEGRAM_BOT_TOKEN) {
           throw new Error('createBot: TELEGRAM_BOT_TOKEN is required');
         }
         // grammY 1.43 — default Bot constructor takes token + optional config.
         // botInfo: undefined forces bot.init() to fetch identity + validate token.
         const bot = new Bot<TelegramContext>(cfg.TELEGRAM_BOT_TOKEN, {
           botInfo: undefined,
         });
         return bot;
       }
       ```

    2. **apps/api/src/plugins/telegram.ts** (per RESEARCH Pattern 1 verbatim, adjusted for our config import):
       ```typescript
       // Phase 3 D-02 — Fastify plugin decorating app.bot when TELEGRAM_BOT_TOKEN is
       // configured. Boot-with-bot-disabled is intentional (RESEARCH Open Question §1):
       // the API still comes up for non-Telegram routes if the token is missing, but
       // any webhook hit returns 503 / 401 via guards at the route handler.
       import fp from 'fastify-plugin';
       import type { FastifyInstance } from 'fastify';
       import type { Bot } from 'grammy';
       import { config } from '../config.js';
       import { createBot } from '../channels/telegram/bot.js';

       declare module 'fastify' {
         interface FastifyInstance {
           bot: Bot;
         }
       }

       export const telegramPlugin = fp(
         async (app: FastifyInstance) => {
           if (!config.TELEGRAM_BOT_TOKEN) {
             app.log.warn('telegram: TELEGRAM_BOT_TOKEN missing — bot disabled');
             return;
           }
           const bot = createBot(config);
           // grammY needs init() before processing updates outside of bot.start().
           // init() fetches bot info (id, username) and validates the token.
           await bot.init();
           app.log.info({ username: bot.botInfo.username }, 'telegram: bot initialized');
           app.decorate('bot', bot);
           app.addHook('onClose', async () => {
             await bot.stop();
           });
         },
         { name: 'telegram', dependencies: ['db'] }
       );

       export default telegramPlugin;
       ```
       NOTE: Per RESEARCH Pattern 1, handlers registration (`registerTelegramHandlers(bot, app)`) happens here — but Wave 3 owns `handlers.ts`. For now, leave the wiring spot as a comment: `// registerTelegramHandlers wired in Wave 3 (Plan 03-03)`. This keeps Wave 1 atomic.

    3. **apps/api/src/app.ts** — Insert telegramPlugin registration AFTER redisPlugin, BEFORE route registrations. Add import + register:
       ```typescript
       import { telegramPlugin } from './plugins/telegram.js';
       // ...
       await app.register(redisPlugin);
       await app.register(telegramPlugin);  // Phase 3 — must run BEFORE routes that touch app.bot
       // ... existing swagger + routes
       ```

    DO NOT add the new webhook route yet (Wave 2). DO NOT register handlers (Wave 3). Keep this plan minimal — only the bot decoration.
  </action>
  <verify>
    <automated>test -f apps/api/src/channels/telegram/bot.ts && test -f apps/api/src/plugins/telegram.ts && grep -q "createBot" apps/api/src/channels/telegram/bot.ts && grep -q "fastify-plugin" apps/api/src/plugins/telegram.ts && grep -q "app.decorate('bot'" apps/api/src/plugins/telegram.ts && grep -q "telegramPlugin" apps/api/src/app.ts && pnpm --filter @ai-logist/api typecheck 2>&1 | tail -5 && pnpm --filter @ai-logist/api vitest run tests/unit 2>&1 | tail -10</automated>
  </verify>
  <done>
    bot.ts exports createBot + TelegramContext; plugins/telegram.ts uses fp() with dependencies ['db'] and decorates app.bot conditionally; app.ts registers it after redis + before routes; tsc + unit tests pass (no integration tests should regress — Wave 2 enables the route).
  </done>
</task>

</tasks>

<verification>
- typecheck: `pnpm --filter @ai-logist/api typecheck` exit 0
- biome clean on touched files
- existing tests still pass: `pnpm --filter @ai-logist/api test:unit` exit 0
- Phase 1+2 integration tests still pass (no schema regressions): `pnpm --filter @ai-logist/api vitest run tests/integration/health.test.ts tests/integration/seed.test.ts` exit 0
- migration journal valid JSON: `node -e "console.log(JSON.parse(require('fs').readFileSync('apps/api/drizzle/meta/_journal.json','utf8')).entries.length)"` >= 4
</verification>

<success_criteria>
1. 3 new env vars + requireTelegramConfig in config.ts
2. grammy 1.43.x added to dependencies
3. Migration 0003 adds ONLY leads.manager_active + trucks_driver_tg_idx index
4. leads.ts schema has managerActive column matching migration
5. createBot factory throws when token missing; happy-path returns typed Bot
6. telegramPlugin decorates app.bot when token present; logs warn + skips when absent
7. app.ts wires plugin between redis and routes
8. Tsc + Biome clean; no existing tests regress
</success_criteria>

<output>
After completion, create `.planning/phases/03-telegram-channel/03-01-SUMMARY.md` recording: exact env additions, the migration SQL emitted by drizzle-kit (paste verbatim), final filename of the 0003 migration, journal entry tag, any drizzle-kit oddities (PostGIS gotchas, customType quoting like Phase 1 Plan 01-07), and plugin lifecycle confirmation (init() succeeded against a fake token in dev or skipped path was exercised in CI).
</output>
