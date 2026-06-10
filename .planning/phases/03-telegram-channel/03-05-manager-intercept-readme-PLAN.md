---
phase: 03-telegram-channel
plan: 05
type: execute
wave: 5
depends_on: ["03-04"]
files_modified:
  - apps/api/src/routes/leads.ts
  - apps/api/src/channels/telegram/setup.ts
  - apps/api/scripts/telegram-setup.ts
  - apps/api/package.json
  - packages/shared-types/src/api/leads.ts
  - apps/api/src/routes/health.ts
  - apps/api/tests/integration/manager-intercept.test.ts
  - apps/api/tests/unit/phase-3-stubs.test.ts
  - README.md
autonomous: false
requirements: [TG-06, API-13, API-15, TG-01, TG-02, TG-03, TG-04, TG-05, TG-07]

must_haves:
  truths:
    - "POST /api/leads/:id/intercept sets manager_active=true + sends welcome via bot + persists message with role='manager'"
    - "POST /api/leads/:id/manager-message inserts messages row (role='manager') + bot.api.sendMessage to client"
    - "POST /api/leads/:id/release sets manager_active=false + sends handover message"
    - "setupWebhook script registers the webhook with Telegram via bot.api.setWebhook"
    - "pnpm --filter @ai-logist/api telegram:setup invokes the script"
    - "/api/health.checks.telegram returns ok|not_configured|error (60s cache)"
    - "README has 'Telegram Dev Setup' section per RESEARCH Code Block 15"
    - "phase-3-stubs.test.ts has 0 todos (TG-06 flipped); 9 it() calls; Phase 3 complete"
    - "checkpoint:human-verify gates a real Telegram conversation end-to-end via ngrok (HUMAN-UAT-03)"
  artifacts:
    - path: apps/api/src/routes/leads.ts
      provides: "Adds 3 endpoints: POST /:id/intercept, POST /:id/manager-message, POST /:id/release"
      contains: "manager_active"
    - path: apps/api/src/channels/telegram/setup.ts
      provides: "setupWebhook({bot, publicUrl, secretToken}) — bot.api.setWebhook with allowed_updates + drop_pending_updates + max_connections"
      contains: "setWebhook"
    - path: apps/api/scripts/telegram-setup.ts
      provides: "pnpm telegram:setup entry — builds app, calls setupWebhook, prints info, closes app"
      contains: "setupWebhook"
    - path: packages/shared-types/src/api/leads.ts
      provides: "LeadInterceptResponseSchema + LeadReleaseResponseSchema + ManagerMessageBodySchema"
      contains: "manager_active"
    - path: apps/api/src/routes/health.ts
      provides: "checks.telegram with 60s cache + integrated with bot.api.getMe"
      contains: "telegram"
    - path: README.md
      provides: "## Telegram Dev Setup section per RESEARCH Code Block 15"
      contains: "Telegram Dev Setup"
  key_links:
    - from: apps/api/src/routes/leads.ts
      to: leads.manager_active
      via: "UPDATE leads SET manager_active = true | false"
      pattern: "manager_active"
    - from: apps/api/src/routes/leads.ts
      to: app.bot.api.sendMessage
      via: "bot.api.sendMessage(client.telegramId, text)"
      pattern: "bot.api.sendMessage"
---

<objective>
Wave 5 closes Phase 3: ships the 3 manager intercept endpoints (TG-06), the health endpoint extension (D-32), the dev-setup script + README docs, and the final stub flip. A `checkpoint:human-verify` task gates the real Telegram E2E walkthrough per ROADMAP success criterion #1 (the only fully-real validation we cannot automate).

Purpose: After Wave 5, Phase 3 is feature-complete (0 todos, all 9 reqs covered) and a fresh developer can run `pnpm telegram:setup` against ngrok and validate the demo dialog manually.

Output:
- 3 new endpoints in `apps/api/src/routes/leads.ts` (intercept, manager-message, release) per RESEARCH Code Block 10
- `apps/api/src/channels/telegram/setup.ts` per RESEARCH Code Block 14
- `apps/api/scripts/telegram-setup.ts` (pnpm script entry)
- `packages/shared-types/src/api/leads.ts` extended with 3 new Zod schemas
- `apps/api/src/routes/health.ts` extended per RESEARCH Code Block 12
- README.md `## Telegram Dev Setup` section per RESEARCH Code Block 15
- `manager-intercept.test.ts` flipped (full assertion: intercept → bot silent → manager-message → release)
- `phase-3-stubs.test.ts`: TG-06 flipped → 0 todos remain
- HUMAN-UAT-03 added (parallel to Phase 1's HUMAN-UAT-01 pattern) tracking deferred real-bot walkthrough

This plan IS NOT autonomous: it contains a `checkpoint:human-verify` task gating the real Telegram conversation.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/03-telegram-channel/03-CONTEXT.md
@.planning/phases/03-telegram-channel/03-RESEARCH.md
@.planning/phases/03-telegram-channel/03-04-SUMMARY.md
@apps/api/src/routes/leads.ts
@apps/api/src/routes/health.ts
@apps/api/src/app.ts
@apps/api/src/persistence/repos/messages.ts
@apps/api/src/persistence/repos/leads.ts
@packages/shared-types/src/api/leads.ts
@packages/shared-types/src/index.ts
@README.md

<interfaces>
<!-- Verified from direct reads + RESEARCH: -->
<!-- - leads.ts already imports leadsRepo, transitionLead, IllegalTransition, VersionMismatch, sql, FastifyPluginAsyncZod, z. Add: clientsRepo, messagesRepo. -->
<!-- - leads.manager_active column shipped in Wave 1; can be UPDATEd via `app.db.execute(sql\`UPDATE leads SET manager_active = ... WHERE id = ...\`)`. -->
<!-- - shared-types package exports Zod schemas under `@ai-logist/shared-types/api/leads` subpath (verified in leads.ts route file import). -->
<!-- - app.bot may be undefined (token missing); routes guard `if (!app.bot) return reply.code(503).send(...)`. -->
<!-- - existing /api/health route from Phase 1 returns `{ checks: { postgres, postgis, redis } }`. Wave 5 adds `telegram` to checks. HealthResponseSchema must be extended with `.optional()` field. -->
<!-- - Phase 1 used the pattern: HUMAN-UAT-NN entry in HUMAN-UAT.md tracks deferred real-human verification. -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Manager intercept endpoints + shared-types schemas + integration test</name>
  <files>
    apps/api/src/routes/leads.ts,
    packages/shared-types/src/api/leads.ts,
    apps/api/tests/integration/manager-intercept.test.ts,
    apps/api/tests/unit/phase-3-stubs.test.ts
  </files>
  <behavior>
    - leads.ts adds 3 new endpoints per RESEARCH Code Block 10:
      - `POST /api/leads/:id/intercept` → 200 with {lead_id, manager_active: true} on success; 404 if lead missing; flips flag + sends welcome via bot + persists 'manager' message.
      - `POST /api/leads/:id/manager-message` → 200 with {lead_id}; body {text: z.string().min(1).max(4000)}; inserts messages row + sends via bot.
      - `POST /api/leads/:id/release` → 200 with {lead_id, manager_active: false}; flips flag + sends handover message.
      - All 3 best-effort the bot send (.catch logs warn but doesn't fail the HTTP request) per RESEARCH Code Block 10 verbatim.
    - shared-types adds 3 schemas: LeadInterceptResponseSchema, LeadReleaseResponseSchema, ManagerMessageBodySchema.
    - manager-intercept.test.ts: 3 cases — (a) intercept sets flag + sends welcome; (b) subsequent Telegram inbound persists but skips intake; (c) release clears flag + sends handover.
    - phase-3-stubs.test.ts TG-06 flipped → 0 todos.
  </behavior>
  <action>
    1. **packages/shared-types/src/api/leads.ts** — Add 3 schemas (append; do not break existing exports):
       ```typescript
       export const LeadInterceptResponseSchema = z.object({
         lead_id: z.string().uuid(),
         manager_active: z.literal(true),
       });
       export const LeadReleaseResponseSchema = z.object({
         lead_id: z.string().uuid(),
         manager_active: z.literal(false),
       });
       export const ManagerMessageBodySchema = z.object({
         text: z.string().min(1).max(4000),
       });
       export const ManagerMessageResponseSchema = z.object({
         lead_id: z.string().uuid(),
       });
       ```

    2. **apps/api/src/routes/leads.ts** — Add imports at top:
       ```typescript
       import { clientsRepo, messagesRepo } from '../persistence/repos/index.js';
       import {
         LeadInterceptResponseSchema,
         LeadReleaseResponseSchema,
         ManagerMessageBodySchema,
         ManagerMessageResponseSchema,
       } from '@ai-logist/shared-types/api/leads';
       ```

       Append 3 new handlers AT THE END of the `leadsRoutes` plugin (per RESEARCH Code Block 10 verbatim, adjusted for our error envelope `NotImpl`):
       ```typescript
       // Phase 3 TG-06 — Manager takes over conversation.
       app.post(
         '/leads/:id/intercept',
         {
           schema: {
             tags: ['leads'],
             summary: 'Manager intercept (Phase 3 TG-06)',
             params: z.object({ id: z.string().uuid() }),
             response: { 200: LeadInterceptResponseSchema, 404: NotImpl },
           },
         },
         async (req, reply) => {
           const lead = await leadsRepo.findById(app.db, req.params.id);
           if (!lead) return reply.notFound(`lead ${req.params.id} not found`);

           await app.db.execute(sql`
             UPDATE leads SET manager_active = true, updated_at = NOW()
             WHERE id = ${lead.id}
           `);

           const client = await clientsRepo.findById(app.db, lead.clientId);
           if (client?.telegramId && app.bot) {
             const lang = (client.lang ?? 'ru') as 'ru' | 'ua';
             const welcome = lang === 'ua'
               ? 'Доброго дня, я Іван, менеджер. Чим можу допомогти?'
               : 'Здравствуйте, я Иван, менеджер. Чем могу помочь?';
             await app.bot.api.sendMessage(client.telegramId, welcome).catch((err) => {
               app.log.warn({ err, leadId: lead.id }, 'intercept: welcome send failed');
             });
             await messagesRepo.create(app.db, {
               clientId: client.id,
               leadId: lead.id,
               role: 'manager',
               text: welcome,
             });
           }
           return reply.code(200).send({ lead_id: lead.id, manager_active: true as const });
         }
       );

       // Phase 3 TG-06 — Manager sends message via bot.
       app.post(
         '/leads/:id/manager-message',
         {
           schema: {
             tags: ['leads'],
             summary: 'Manager message to client via bot (Phase 3 TG-06)',
             params: z.object({ id: z.string().uuid() }),
             body: ManagerMessageBodySchema,
             response: { 200: ManagerMessageResponseSchema, 400: NotImpl, 404: NotImpl },
           },
         },
         async (req, reply) => {
           const lead = await leadsRepo.findById(app.db, req.params.id);
           if (!lead) return reply.notFound(`lead ${req.params.id} not found`);
           const client = await clientsRepo.findById(app.db, lead.clientId);
           if (!client) return reply.notFound('client not found');
           if (!client.telegramId) return reply.badRequest('client has no telegram_id');

           await messagesRepo.create(app.db, {
             clientId: client.id,
             leadId: lead.id,
             role: 'manager',
             text: req.body.text,
           });

           if (app.bot) {
             await app.bot.api.sendMessage(client.telegramId, req.body.text).catch((err) => {
               app.log.error({ err, leadId: lead.id }, 'manager-message: send failed');
             });
           }
           return reply.code(200).send({ lead_id: lead.id });
         }
       );

       // Phase 3 TG-06 — Manager hands conversation back to bot.
       app.post(
         '/leads/:id/release',
         {
           schema: {
             tags: ['leads'],
             summary: 'Manager release (Phase 3 TG-06)',
             params: z.object({ id: z.string().uuid() }),
             response: { 200: LeadReleaseResponseSchema, 404: NotImpl },
           },
         },
         async (req, reply) => {
           const lead = await leadsRepo.findById(app.db, req.params.id);
           if (!lead) return reply.notFound(`lead ${req.params.id} not found`);
           await app.db.execute(sql`
             UPDATE leads SET manager_active = false, updated_at = NOW()
             WHERE id = ${lead.id}
           `);
           const client = await clientsRepo.findById(app.db, lead.clientId);
           if (client?.telegramId && app.bot) {
             const lang = (client.lang ?? 'ru') as 'ru' | 'ua';
             const handover = lang === 'ua'
               ? 'Передаю назад AI-асистенту. Чим іще можу допомогти?'
               : 'Передаю обратно AI-ассистенту. Что-то ещё?';
             await app.bot.api.sendMessage(client.telegramId, handover).catch(() => {});
             await messagesRepo.create(app.db, {
               clientId: client.id,
               leadId: lead.id,
               role: 'manager',
               text: handover,
             });
           }
           return reply.code(200).send({ lead_id: lead.id, manager_active: false as const });
         }
       );
       ```

    3. **apps/api/tests/integration/manager-intercept.test.ts** — Full integration:
       ```typescript
       it('intercept flips manager_active + sends welcome + persists manager message', async () => {
         // Seed: client with telegram_id + open lead in QUOTED.
         // POST /api/leads/:id/intercept.
         // Assert: response 200 + manager_active: true. leads.manager_active = true. mock.sent has welcome.
         // messages row with role='manager' exists.
       });
       it('after intercept, telegram inbound persists but skips intake (bot silent)', async () => {
         // After previous test setup, fire processTelegramUpdate with a text update from the same client.
         // Assert: new messages row with role='client'. lead.stage UNCHANGED. NO mock.sent push (no AI reply).
       });
       it('manager-message sends via bot + persists role=manager', async () => {
         // POST /api/leads/:id/manager-message with body {text: 'Hi from manager'}.
         // Assert: mock.sent has 'Hi from manager'. messages row role='manager' text='Hi from manager'.
       });
       it('release clears manager_active + sends handover', async () => {
         // POST /api/leads/:id/release.
         // Assert: response manager_active: false. leads.manager_active = false. mock.sent has handover message.
       });
       it('client has no telegram_id → manager-message returns 400', async () => {
         // Seed lead with client lacking telegram_id.
         // POST /api/leads/:id/manager-message.
         // Assert: 400 response.
       });
       ```

    4. **phase-3-stubs.test.ts** — Flip TG-06 to it():
       ```typescript
       it('TG-06: manager intercept flips manager_active; bot silent; manager-message routes via bot', () => {
         // Covered by manager-intercept.test.ts (5 cases).
         expect(true).toBe(true);
       });
       ```
       Verify `grep -c "test.todo" apps/api/tests/unit/phase-3-stubs.test.ts` = 0.
  </action>
  <verify>
    <automated>[ "$(grep -c "test.todo" apps/api/tests/unit/phase-3-stubs.test.ts)" -eq 0 ] && grep -q "/leads/:id/intercept" apps/api/src/routes/leads.ts && grep -q "/leads/:id/manager-message" apps/api/src/routes/leads.ts && grep -q "/leads/:id/release" apps/api/src/routes/leads.ts && grep -q "LeadInterceptResponseSchema" packages/shared-types/src/api/leads.ts && grep -q "ManagerMessageBodySchema" packages/shared-types/src/api/leads.ts && pnpm --filter @ai-logist/api typecheck 2>&1 | tail -5 && pnpm --filter @ai-logist/api vitest run tests/unit/phase-3-stubs.test.ts 2>&1 | grep -q "9 passed"</automated>
  </verify>
  <done>
    3 new manager endpoints shipped per RESEARCH Code Block 10; shared-types has 4 new Zod schemas (intercept response, release response, manager-message body, manager-message response); manager-intercept.test.ts has 5 case assertions; phase-3-stubs has 9 it() calls + 0 todos; tsc + biome clean.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: setupWebhook script + health endpoint extension + README Telegram Dev Setup section</name>
  <files>
    apps/api/src/channels/telegram/setup.ts,
    apps/api/scripts/telegram-setup.ts,
    apps/api/package.json,
    apps/api/src/routes/health.ts,
    packages/shared-types/src/api/health.ts,
    apps/api/src/app.ts,
    README.md
  </files>
  <behavior>
    - setup.ts exports `setupWebhook({bot, publicUrl, secretToken})` per RESEARCH Code Block 14 verbatim.
    - scripts/telegram-setup.ts (new file) imports buildApp + setupWebhook + config; runs on `pnpm --filter @ai-logist/api telegram:setup`.
    - apps/api/package.json adds script entry: `"telegram:setup": "tsx scripts/telegram-setup.ts"`.
    - health.ts extends checks with `telegram` per RESEARCH Code Block 12 — cached 60s, returns 'ok' | 'not_configured' | 'error'.
    - HealthResponseSchema in shared-types extended with `telegram: z.enum(['ok', 'not_configured', 'error']).optional()`.
    - app.ts: if `config.TELEGRAM_SET_WEBHOOK_ON_BOOT` is true AND `config.TELEGRAM_PUBLIC_URL` set, call setupWebhook(...) after `await app.ready()` but before `app.listen` — or in the listen-success callback.
    - README.md: append `## Telegram Dev Setup` section per RESEARCH Code Block 15 verbatim.
  </behavior>
  <action>
    1. **apps/api/src/channels/telegram/setup.ts** (RESEARCH Code Block 14 verbatim):
       ```typescript
       // Phase 3 D-08 — webhook setup helper. Idempotent — running twice is fine.
       // Called from app.ts at boot if TELEGRAM_SET_WEBHOOK_ON_BOOT=true, OR from
       // pnpm telegram:setup script (apps/api/scripts/telegram-setup.ts).
       import type { Bot } from 'grammy';

       export async function setupWebhook(args: {
         bot: Bot;
         publicUrl: string;
         secretToken: string;
       }): Promise<void> {
         const url = `${args.publicUrl.replace(/\/$/, '')}/webhook/telegram`;
         await args.bot.api.setWebhook(url, {
           secret_token: args.secretToken,
           allowed_updates: ['message', 'callback_query'],
           drop_pending_updates: true,
           max_connections: 40,
         });
       }
       ```

    2. **apps/api/scripts/telegram-setup.ts** (new):
       ```typescript
       // pnpm --filter @ai-logist/api telegram:setup — registers webhook with Telegram.
       // Pre-conditions: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, TELEGRAM_PUBLIC_URL set in env.
       import { buildApp } from '../src/app.js';
       import { setupWebhook } from '../src/channels/telegram/setup.js';
       import { config, requireTelegramConfig } from '../src/config.js';

       async function main() {
         requireTelegramConfig();
         if (!config.TELEGRAM_PUBLIC_URL) {
           throw new Error('TELEGRAM_PUBLIC_URL required (e.g. https://xxx.ngrok.io)');
         }
         const app = await buildApp();
         if (!app.bot) {
           throw new Error('app.bot not decorated — check telegram plugin logs');
         }
         await setupWebhook({
           bot: app.bot,
           publicUrl: config.TELEGRAM_PUBLIC_URL,
           secretToken: config.TELEGRAM_WEBHOOK_SECRET as string,
         });
         // eslint-disable-next-line no-console
         console.log(JSON.stringify({ ok: true, url: `${config.TELEGRAM_PUBLIC_URL}/webhook/telegram` }, null, 2));
         await app.close();
       }
       main().catch((err) => {
         // eslint-disable-next-line no-console
         console.error('telegram-setup failed', err);
         process.exit(1);
       });
       ```

    3. **apps/api/package.json** — Add to scripts:
       ```json
       "telegram:setup": "tsx scripts/telegram-setup.ts"
       ```

    4. **apps/api/src/routes/health.ts** + **packages/shared-types/src/api/health.ts** — Apply RESEARCH Code Block 12. Read health.ts current shape. Add module-level cache:
       ```typescript
       let telegramCache: { result: 'ok' | 'not_configured' | 'error'; expiresAt: number } = {
         result: 'not_configured', expiresAt: 0,
       };
       async function checkTelegram(app: FastifyInstance): Promise<'ok' | 'not_configured' | 'error'> {
         const now = Date.now();
         if (telegramCache.expiresAt > now) return telegramCache.result;
         if (!config.TELEGRAM_BOT_TOKEN || !app.bot) {
           telegramCache = { result: 'not_configured', expiresAt: now + 60_000 };
           return 'not_configured';
         }
         try {
           await app.bot.api.getMe();
           telegramCache = { result: 'ok', expiresAt: now + 60_000 };
           return 'ok';
         } catch (err) {
           app.log.warn({ err }, 'telegram health check failed');
           telegramCache = { result: 'error', expiresAt: now + 60_000 };
           return 'error';
         }
       }
       ```
       In the route handler, after building the existing checks object, add `telegram: await checkTelegram(app)` to the response. Extend HealthResponseSchema in shared-types to include `telegram: z.enum(['ok','not_configured','error']).optional()` (optional — so existing clients don't break).

    5. **apps/api/src/app.ts** — After existing `await app.register(telegramPlugin)` and AFTER the routes registration (or wrap in buildApp's caller), add a conditional auto-setup. Easiest: at the END of buildApp, just BEFORE `return app;`, add:
       ```typescript
       // Phase 3 D-08 — optional auto-register webhook at boot.
       if (config.TELEGRAM_SET_WEBHOOK_ON_BOOT && config.TELEGRAM_PUBLIC_URL && app.bot && config.TELEGRAM_WEBHOOK_SECRET) {
         const { setupWebhook } = await import('./channels/telegram/setup.js');
         await setupWebhook({
           bot: app.bot,
           publicUrl: config.TELEGRAM_PUBLIC_URL,
           secretToken: config.TELEGRAM_WEBHOOK_SECRET,
         });
         app.log.info({ publicUrl: config.TELEGRAM_PUBLIC_URL }, 'telegram: webhook registered at boot');
       }
       ```

    6. **README.md** — Append `## Telegram Dev Setup` section per RESEARCH Code Block 15 VERBATIM (6 numbered steps + tear-down command). Insert after the existing setup sections (after Phase 1 README content, before VPS Deploy section if it exists).
  </action>
  <verify>
    <automated>test -f apps/api/src/channels/telegram/setup.ts && test -f apps/api/scripts/telegram-setup.ts && grep -q "setWebhook" apps/api/src/channels/telegram/setup.ts && grep -q "telegram:setup" apps/api/package.json && grep -q "checks.telegram\|telegram: await checkTelegram" apps/api/src/routes/health.ts && grep -q "Telegram Dev Setup" README.md && grep -q "openssl rand -hex 32" README.md && grep -q "pnpm.*telegram:setup\|telegram:setup" README.md && pnpm --filter @ai-logist/api typecheck 2>&1 | tail -5</automated>
  </verify>
  <done>
    setupWebhook helper + pnpm script + health.telegram check + README Telegram Dev Setup section all shipped; HealthResponseSchema accepts optional telegram field; buildApp auto-registers webhook when both env flags set; tsc + biome clean.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Real Telegram conversation end-to-end via ngrok (HUMAN-UAT-03)</name>
  <files>HUMAN-UAT.md</files>
  <what-built>
    Full Phase 3 Telegram channel: webhook idempotent + ack <100ms, intake pipeline reachable via real Telegram dialog, quote keyboard rendered, callback Confirm creates order, driver notification (if telegram_id seeded), manager intercept endpoints functional.
  </what-built>
  <how-to-verify>
    1. **Pre-flight:**
       ```bash
       docker compose up -d postgres redis
       pnpm install
       pnpm --filter @ai-logist/api db:migrate
       pnpm --filter @ai-logist/api seed
       ```
    2. **Create bot:** message @BotFather → `/newbot` → copy TOKEN.
    3. **Generate secret:**
       ```bash
       openssl rand -hex 32  # save output
       ```
    4. **Start ngrok:**
       ```bash
       ngrok http 3000  # save https URL
       ```
    5. **Env:** Set `apps/api/.env` with all 5 TELEGRAM_* vars from RESEARCH Code Block 15.
    6. **Start API:**
       ```bash
       pnpm --filter @ai-logist/api dev
       ```
    7. **Register webhook:**
       ```bash
       pnpm --filter @ai-logist/api telegram:setup
       # Expected: { ok: true, url: "https://xxx.ngrok.io/webhook/telegram" }
       ```
    8. **Verify webhook:**
       ```bash
       curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo" | jq
       # Expect: url matches, last_error_message: null, pending_update_count: 0
       ```
    9. **Test dialog from real Telegram account:**
       - Find your bot in Telegram, tap `/start` → expect RU greeting.
       - Send: `Киев-Львов, 18 тонн, тент`
       - Expect: bot replies with a quote price + 3 inline buttons (Подтвердить / Отказаться / Изменить).
       - Tap "Подтвердить рейс ✅"
       - Expect: bot replies "Заказ KU-XXX создан. Отслеживание: /track/<token>"
       - **Verify in psql:**
         ```bash
         docker exec ailogist-postgres psql -U ailogist -d ailogist -c "SELECT stage FROM leads ORDER BY created_at DESC LIMIT 1"
         # Expect: ORDER_CREATED
         docker exec ailogist-postgres psql -U ailogist -d ailogist -c "SELECT status FROM orders ORDER BY created_at DESC LIMIT 1"
         # Expect: DRIVER_ASSIGNED (Wave 4 auto-advance)
         ```
    10. **Test idempotency (TG-02):**
        - Run: `for i in {1..10}; do curl -X POST "https://xxx.ngrok.io/webhook/telegram" -H "x-telegram-bot-api-secret-token: <SECRET>" -H "content-type: application/json" -d @apps/api/tests/fixtures/telegram-updates.json; done`
        - Verify: `SELECT COUNT(*) FROM webhook_updates WHERE source='telegram'` returns 1 (or N if you sent N distinct fixtures with same update_id).
    11. **Test manager intercept (TG-06):**
        - `curl -X POST http://localhost:3000/api/leads/<active-lead-id>/intercept` → expect 200 + welcome arrives in Telegram.
        - Send another Telegram message → bot does NOT respond automatically.
        - `curl -X POST http://localhost:3000/api/leads/<lead-id>/manager-message -H "content-type: application/json" -d '{"text": "Привет от менеджера"}'` → expect message arrives in Telegram.
        - `curl -X POST http://localhost:3000/api/leads/<lead-id>/release` → handover message arrives.
    12. **Tear down:**
        ```bash
        curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/deleteWebhook"
        ```

    **Record verification:** Add HUMAN-UAT-03 entry to `.planning/HUMAN-UAT.md` with status (✅ verified | ⏳ pending | ❌ blocked) + date + observations.

    If the planner is running in `--auto` mode (no live Telegram account on the runner), AUTO-APPROVE this checkpoint and log HUMAN-UAT-03 with `status: ⏳ pending` + reason "Auto-mode — defer to verifier/buyer-eval pass" — same pattern as Phase 1 Plan 01-10's HUMAN-UAT-01.
  </how-to-verify>
  <action>This is a checkpoint task — see <how-to-verify> above for the steps. After completion, log HUMAN-UAT-03 entry in .planning/HUMAN-UAT.md.</action>
  <verify>
    <automated>test -f .planning/HUMAN-UAT.md && grep -q "HUMAN-UAT-03" .planning/HUMAN-UAT.md</automated>
  </verify>
  <done>HUMAN-UAT-03 entry exists in .planning/HUMAN-UAT.md with status (verified | pending | blocked).</done>
  <resume-signal>Type "approved" or "deferred (HUMAN-UAT-03 logged)" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- typecheck: `pnpm --filter @ai-logist/api typecheck` exit 0
- full unit suite: `pnpm --filter @ai-logist/api test:unit` exit 0 with 9 passing + 0 todo for Phase 3
- biome clean across all Phase 3 files
- migrations re-apply cleanly: `pnpm --filter @ai-logist/api vitest run tests/integration/migration-0002.test.ts` (still passes — Phase 3's 0003 doesn't break Phase 2)
- Phase 2 regression: pipeline-canonical, fsm-concurrency, fsm-events-audit all pass
- README has "Telegram Dev Setup" section with all 6 RESEARCH Code Block 15 numbered steps
- HUMAN-UAT-03 logged (either ✅ verified after manual walkthrough OR ⏳ pending in auto-mode)
</verification>

<success_criteria>
1. Manager intercept ships 3 endpoints (intercept / manager-message / release) per RESEARCH Code Block 10
2. shared-types adds 4 Zod schemas (intercept response, release response, manager-message body, manager-message response)
3. manager-intercept.test.ts asserts all 5 cases (flip flag, bot silent, manager-message, release, no-telegram-id 400)
4. setupWebhook helper + pnpm telegram:setup script work end-to-end
5. /api/health.checks.telegram returns ok|not_configured|error with 60s cache
6. README "Telegram Dev Setup" section copied verbatim from RESEARCH Code Block 15
7. phase-3-stubs.test.ts: 0 todos remaining (all 9 reqs covered with it() assertions)
8. HUMAN-UAT-03 entry created in HUMAN-UAT.md (either approved or deferred-with-status-pending)
9. Phase 2 integration tests still pass (no regressions)
</success_criteria>

<output>
After completion, create `.planning/phases/03-telegram-channel/03-05-SUMMARY.md` AND `.planning/phases/03-telegram-channel/SUMMARY.md` (phase-level summary). The phase-level SUMMARY consolidates: all 6 plans' contributions, total files touched, final test count (X passing, 0 todo for Phase 3), any deviations from CONTEXT decisions (D-19 driver decline → CLOSED+LOST per RESEARCH Pitfall #5; D-20 driver_telegram_id stayed TEXT; D-30 TOKEN+SECRET kept .optional() with requireTelegramConfig boundary), accumulated decisions for STATE.md (e.g. "Phase 3 Plan 03-04: ORDER_TRANSITIONS gained DRIVER_ASSIGNED→CLOSED edge for driver_decline path"), and Phase 3 status: complete (9/9 reqs covered).
</output>
