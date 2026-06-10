---
phase: 03-telegram-channel
plan: 00
type: execute
wave: 0
depends_on: []
files_modified:
  - apps/api/tests/_helpers/telegram-mock.ts
  - apps/api/tests/_helpers/webhook-driver.ts
  - apps/api/tests/fixtures/telegram-updates.json
  - apps/api/tests/unit/phase-3-stubs.test.ts
  - apps/api/tests/integration/webhook-idempotency.test.ts
  - apps/api/tests/integration/webhook-latency.test.ts
  - apps/api/tests/integration/webhook-auth.test.ts
  - apps/api/tests/integration/webhook-voice-stub.test.ts
  - apps/api/tests/integration/telegram-adapter.test.ts
  - apps/api/tests/integration/telegram-keyboards.test.ts
  - apps/api/tests/integration/driver-confirmation.test.ts
  - apps/api/tests/integration/client-notifications.test.ts
  - apps/api/tests/integration/manager-intercept.test.ts
  - apps/api/tests/PHASE-3.md
autonomous: true
requirements: [API-13, API-15, TG-01, TG-02, TG-03, TG-04, TG-05, TG-06, TG-07]

must_haves:
  truths:
    - "Phase 3 has 9 unit-level test.todo() stubs (one per requirement) gating completion"
    - "MockTelegramBot records sent messages and recorded callback responses without network calls"
    - "webhook-driver helper measures elapsed ms for ack-latency assertions"
    - "8 integration scaffolds exist with describe.skipIf(!dockerAvailable) wrapping and test.todo placeholders"
  artifacts:
    - path: apps/api/tests/_helpers/telegram-mock.ts
      provides: "MockTelegramBot factory implementing { api: { sendMessage, getMe, answerCallbackQuery, editMessageReplyMarkup, setWebhook }, botInfo, init, handleUpdate, stop } with sent[] recorder"
      min_lines: 40
    - path: apps/api/tests/_helpers/webhook-driver.ts
      provides: "postTelegramWebhook(app, payload, secret) helper returning { res, elapsedMs } via process.hrtime.bigint"
      min_lines: 25
    - path: apps/api/tests/fixtures/telegram-updates.json
      provides: "8+ canonical Telegram Update payloads: text-kyiv-lviv, text-confirm, callback-confirm, callback-reject, callback-change, callback-driver-accept, callback-driver-decline, command-start, command-help, sticker-non-text, short-ok"
      min_lines: 40
    - path: apps/api/tests/unit/phase-3-stubs.test.ts
      provides: "Exactly 9 test.todo() markers, one per Phase 3 req (API-13, API-15, TG-01..07)"
      contains: "test.todo"
    - path: apps/api/tests/PHASE-3.md
      provides: "How-to docs for running Telegram channel tests; explains MockTelegramBot, webhook-driver, fixtures"
  key_links:
    - from: apps/api/tests/_helpers/telegram-mock.ts
      to: apps/api/tests/integration/telegram-keyboards.test.ts
      via: "createMockBot() factory"
      pattern: "createMockBot|MockTelegramBot"
    - from: apps/api/tests/_helpers/webhook-driver.ts
      to: apps/api/tests/integration/webhook-latency.test.ts
      via: "postTelegramWebhook helper"
      pattern: "postTelegramWebhook"
---

<objective>
Wave 0 ships ALL Phase 3 test infrastructure BEFORE any production code lands. This mirrors Phase 1 Plan 01-00 and Phase 2 Plan 02-00 — every Phase 3 requirement gets a `test.todo()` marker in `phase-3-stubs.test.ts` that subsequent plans flip to real `it()` assertions.

Purpose: Tests-first means executors in Waves 1–5 have a concrete acceptance target (flip the todo) and can never ship production code without coverage. Mock infrastructure prevents real Telegram API calls in CI.

Output:
- `apps/api/tests/_helpers/telegram-mock.ts` — MockTelegramBot factory
- `apps/api/tests/_helpers/webhook-driver.ts` — latency-measuring webhook poster
- `apps/api/tests/fixtures/telegram-updates.json` — canonical Update payloads
- `apps/api/tests/unit/phase-3-stubs.test.ts` — exactly 9 `test.todo()` markers
- 8 integration test scaffolds (each ships as `test.todo()` inside a real describe block; later waves flip them to `it(...)`)
- `apps/api/tests/PHASE-3.md` — harness usage doc
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/03-telegram-channel/03-CONTEXT.md
@.planning/phases/03-telegram-channel/03-RESEARCH.md
@.planning/phases/03-telegram-channel/03-VALIDATION.md
@apps/api/tests/_helpers/dialog-harness.ts
@apps/api/tests/_helpers/integration-env.ts
@apps/api/tests/_helpers/test-db.ts
@apps/api/tests/unit/phase-2-stubs.test.ts
@apps/api/tests/PHASE-2.md
@apps/api/vitest.config.ts

<interfaces>
<!-- Reused infra from Phases 1+2: -->
<!-- - dialog-harness.ts already loads handleInboundMessage dynamically. Phase 3 calls intake from inside webhook adapter; tests reuse runScript pattern. -->
<!-- - integration-env.ts sets DATABASE_URL/REDIS_URL localhost defaults so config.ts safeParse passes before describe.skipIf(!dockerAvailable). -->
<!-- - test-db.ts exports dockerAvailable boolean. Pattern: `describe.skipIf(!dockerAvailable)('test name', () => { ... })`. -->
<!-- - phase-2-stubs.test.ts pattern: header docstring MUST NOT contain literal 'test.todo' (grep-counted gate). -->
<!-- - vitest.config.ts has 3 projects: unit, integration, smoke. unit setupFiles include fake-timers + integration-env. -->

<!-- Existing Telegram-adjacent schema (DO NOT redefine — Phase 1 + 2 own these): -->
<!-- - webhook_updates: UNIQUE(source, external_id); use 'telegram' as source per webhookSourceEnum. -->
<!-- - clients.telegramId: text (nullable). -->
<!-- - clients.lang: clientLangEnum default 'ru'. -->
<!-- - trucks.driverTelegramId: text (nullable). -->
<!-- - leads.stage: leadStageEnum. -->
<!-- - messages.role: text (values 'client'|'ai'|'manager'). -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: MockTelegramBot + webhook-driver + fixtures + PHASE-3.md</name>
  <files>
    apps/api/tests/_helpers/telegram-mock.ts,
    apps/api/tests/_helpers/webhook-driver.ts,
    apps/api/tests/fixtures/telegram-updates.json,
    apps/api/tests/PHASE-3.md
  </files>
  <behavior>
    - telegram-mock.ts: `createMockBot()` returns `{ bot, sent }` where `sent: SentMessage[]` is mutated by `bot.api.sendMessage`. Bot also exposes `getMe`, `setWebhook`, `answerCallbackQuery`, `editMessageReplyMarkup` returning sensible defaults. Includes `botInfo`, `init`, `handleUpdate`, `stop` (all no-op async). Optional `callbackQueries: CallbackQueryRecord[]` array records `answerCallbackQuery` calls.
    - webhook-driver.ts: `postTelegramWebhook(app, payload, opts?)` returns `{ res, elapsedMs }` using `process.hrtime.bigint()` for sub-ms precision. Defaults headers `x-telegram-bot-api-secret-token` from `opts.secretToken` if provided.
    - telegram-updates.json: 11 canonical Update fixtures (see artifacts.contains list).
    - PHASE-3.md: Documents how to use MockTelegramBot, webhook-driver, fixtures. Includes "when to use mock vs real bot" + grep-friendly example invocations.
  </behavior>
  <action>
    Read CONTEXT.md and RESEARCH.md Code Block 13 (Mock grammY Bot) VERBATIM — copy the mock into telegram-mock.ts. Specifically:

    1. **apps/api/tests/_helpers/telegram-mock.ts** (per RESEARCH Code Block 13 verbatim, extended with callback recorder):
       ```typescript
       // In-memory bot mock for unit + integration tests. Records sends and
       // callback responses; NEVER hits the network. Use createMockBot() in tests
       // that exercise Phase 3 outbound paths (keyboard sends, driver notifications,
       // client notifications, manager-message). Wire it into app via `app.decorate('bot', bot)`.
       export interface SentMessage {
         chatId: string | number;
         text: string;
         replyMarkup?: unknown;
         parseMode?: string;
       }
       export interface CallbackQueryRecord {
         callbackQueryId: string;
         text?: string;
         showAlert?: boolean;
       }
       export interface MockBotHandle {
         bot: {
           api: {
             sendMessage(chatId: string | number, text: string, opts?: { reply_markup?: unknown; parse_mode?: string }): Promise<unknown>;
             getMe(): Promise<{ id: number; is_bot: true; first_name: string; username: string }>;
             setWebhook(...args: unknown[]): Promise<true>;
             answerCallbackQuery(id: string, opts?: { text?: string; show_alert?: boolean }): Promise<true>;
             editMessageReplyMarkup(...args: unknown[]): Promise<true>;
           };
           botInfo: { id: number; is_bot: true; first_name: string; username: string };
           init(): Promise<void>;
           handleUpdate(update: unknown): Promise<void>;
           stop(): Promise<void>;
         };
         sent: SentMessage[];
         callbackQueries: CallbackQueryRecord[];
       }
       export function createMockBot(): MockBotHandle { /* impl */ }
       ```
       Implementation must push to `sent[]` on every `sendMessage` (record chatId, text, reply_markup as replyMarkup, parse_mode as parseMode) and push to `callbackQueries[]` on every `answerCallbackQuery`. Return shape matches Telegram's actual Message object surface used downstream.

    2. **apps/api/tests/_helpers/webhook-driver.ts**:
       ```typescript
       import type { FastifyInstance } from 'fastify';
       export interface WebhookDriverOpts {
         secretToken?: string;
         extraHeaders?: Record<string, string>;
       }
       export async function postTelegramWebhook(
         app: FastifyInstance,
         payload: unknown,
         opts: WebhookDriverOpts = {}
       ): Promise<{ res: Awaited<ReturnType<FastifyInstance['inject']>>; elapsedMs: number }> {
         const headers: Record<string, string> = {
           'content-type': 'application/json',
           ...(opts.secretToken ? { 'x-telegram-bot-api-secret-token': opts.secretToken } : {}),
           ...(opts.extraHeaders ?? {}),
         };
         const start = process.hrtime.bigint();
         const res = await app.inject({
           method: 'POST',
           url: '/webhook/telegram',
           payload: payload as never,
           headers,
         });
         const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
         return { res, elapsedMs };
       }
       ```

    3. **apps/api/tests/fixtures/telegram-updates.json** — exactly 11 keys, each a valid Telegram Update shape. Required keys (verbatim names): `textKyivLviv`, `textConfirm`, `textShortOk`, `callbackConfirm`, `callbackReject`, `callbackChange`, `callbackDriverAccept`, `callbackDriverDecline`, `commandStart`, `commandHelp`, `sticker`. Each MUST have `update_id` (unique integer), and either `message` or `callback_query` per the Telegram Bot API Update schema. Example shape for textKyivLviv:
       ```json
       {
         "textKyivLviv": {
           "update_id": 42001,
           "message": {
             "message_id": 1, "date": 1717920000,
             "from": { "id": 555000001, "is_bot": false, "first_name": "Demo", "language_code": "ru" },
             "chat": { "id": 555000001, "type": "private" },
             "text": "Киев-Львов, 18 тонн, тент"
           }
         },
         "callbackConfirm": {
           "update_id": 42010,
           "callback_query": {
             "id": "cb-001",
             "from": { "id": 555000001, "is_bot": false, "first_name": "Demo" },
             "chat_instance": "abc",
             "data": "confirm:00000000-0000-4000-8000-000000000001",
             "message": { "message_id": 2, "date": 1717920100, "chat": { "id": 555000001, "type": "private" }, "text": "Цена" }
           }
         }
       }
       ```
       Use `callback_query.data` formatted as `<action>:<leadId>` per D-13. Use placeholder UUID `00000000-0000-4000-8000-000000000001` for leadId in confirm/reject/change callbacks; `00000000-0000-4000-8000-0000000000A1` for orderId in driver callbacks.

    4. **apps/api/tests/PHASE-3.md** — Documents harness with these grep-friendly sections:
       - `## MockTelegramBot` — when/how to use; example wiring `app.decorate('bot', mock.bot)`
       - `## webhook-driver` — when/how; example latency assertion
       - `## telegram-updates fixtures` — list of 11 keys + purpose
       - `## Real bot smoke (TELEGRAM_BOT_TOKEN gated)` — explains opt-in `test:tg` via env

    Do NOT install grammy yet — Wave 1 owns that. The mock must NOT import from 'grammy'; it implements the surface structurally. Use `import type` if grammy types are referenced anywhere — but prefer pure structural mock with no grammy import.
  </action>
  <verify>
    <automated>test -f apps/api/tests/_helpers/telegram-mock.ts && test -f apps/api/tests/_helpers/webhook-driver.ts && test -f apps/api/tests/fixtures/telegram-updates.json && test -f apps/api/tests/PHASE-3.md && node -e "const f=require('./apps/api/tests/fixtures/telegram-updates.json'); const required=['textKyivLviv','textConfirm','textShortOk','callbackConfirm','callbackReject','callbackChange','callbackDriverAccept','callbackDriverDecline','commandStart','commandHelp','sticker']; for(const k of required){if(!f[k])throw new Error('missing fixture: '+k);if(!f[k].update_id)throw new Error('fixture missing update_id: '+k);} console.log('fixtures ok')" && grep -q "createMockBot" apps/api/tests/_helpers/telegram-mock.ts && grep -q "postTelegramWebhook" apps/api/tests/_helpers/webhook-driver.ts && grep -q "MockTelegramBot" apps/api/tests/PHASE-3.md && pnpm --filter @ai-logist/api typecheck 2>&1 | tail -5</automated>
  </verify>
  <done>
    telegram-mock.ts exports createMockBot returning {bot, sent, callbackQueries}; webhook-driver.ts exports postTelegramWebhook with elapsedMs; fixtures JSON has all 11 keys with valid update_id; PHASE-3.md documents usage; tsc passes with no Phase 3 errors.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: phase-3-stubs.test.ts (9 todos) + 8 integration scaffolds</name>
  <files>
    apps/api/tests/unit/phase-3-stubs.test.ts,
    apps/api/tests/integration/webhook-idempotency.test.ts,
    apps/api/tests/integration/webhook-latency.test.ts,
    apps/api/tests/integration/webhook-auth.test.ts,
    apps/api/tests/integration/webhook-voice-stub.test.ts,
    apps/api/tests/integration/telegram-adapter.test.ts,
    apps/api/tests/integration/telegram-keyboards.test.ts,
    apps/api/tests/integration/driver-confirmation.test.ts,
    apps/api/tests/integration/client-notifications.test.ts,
    apps/api/tests/integration/manager-intercept.test.ts
  </files>
  <behavior>
    - phase-3-stubs.test.ts: 9 `test.todo()` markers (EXACTLY 9 — grep-counted). One per requirement. Header docstring MUST NOT contain literal `test.todo` string (avoids the Phase 1+2 grep-count gotcha).
    - 9 integration test files (8 scaffolds + 1 voice-stub for API-15): each has `describe.skipIf(!dockerAvailable)` wrapper + 1+ `test.todo()` placeholders. Files import nothing from production Phase 3 code (it doesn't exist yet) — only test helpers.
  </behavior>
  <action>
    1. **apps/api/tests/unit/phase-3-stubs.test.ts** — EXACTLY 9 `test.todo()` markers. Pattern copied from `phase-2-stubs.test.ts`:
       ```typescript
       import { describe, test } from 'vitest';

       // Phase 3 acceptance criteria assertions.
       // Each requirement has one stub; Waves 1-5 flip them to real it() calls.
       // Note: header MUST NOT contain the literal stub-marker string —
       // verifier counts occurrences by naive grep.

       describe('Phase 3 — Telegram channel (acceptance stubs)', () => {
         test.todo('API-13: POST /webhook/telegram exists and verifies secret_token');
         test.todo('API-15: POST /webhook/voice returns 200 (Phase 3.1 stub)');
         test.todo('TG-01: grammY 1.43 bot initialized; secret_token mismatch returns 401');
         test.todo('TG-02: same update_id 10× yields exactly 1 lead AND ack under 100ms');
         test.todo('TG-03: inline keyboard with confirm/reject/change buttons rendered for QUOTED');
         test.todo('TG-04: quote card includes route, tons, price from DB');
         test.todo('TG-05: driver receives Принять/Отказаться buttons; missing telegram_id falls to stub');
         test.todo('TG-06: manager intercept flips manager_active; bot silent; manager-message routes via bot');
         test.todo('TG-07: order FSM transition triggers notifyClient with i18n RU/UA template');
       });
       ```
       After write, verify with `grep -c "test.todo" apps/api/tests/unit/phase-3-stubs.test.ts` = exactly 9.

    2. **8 integration scaffold files** — each follows this exact template (replace TEST_NAME + DESCRIBE_NAME + TODO_NAME per file):
       ```typescript
       import { describe, test } from 'vitest';
       import { dockerAvailable } from '../_helpers/test-db.js';

       describe.skipIf(!dockerAvailable)('TEST_NAME', () => {
         test.todo('TODO_NAME');
       });
       ```

       File assignments (TEST_NAME → TODO_NAME):
       - `webhook-idempotency.test.ts` → "telegram webhook idempotency (TG-02)" → "10× same update_id → 1 lead row"
       - `webhook-latency.test.ts` → "telegram webhook latency (TG-02)" → "ack within 100ms via postTelegramWebhook elapsedMs"
       - `webhook-auth.test.ts` → "telegram webhook secret_token verification (TG-01, API-13)" → "401 on missing header; 401 on mismatch; 200 on match"
       - `webhook-voice-stub.test.ts` → "voice webhook stub (API-15)" → "POST /webhook/voice returns 200 ack"
       - `telegram-adapter.test.ts` → "telegram update→inbound adapter (TG-01, TG-02)" → "find-or-create client by telegram_id; synthetic phone tg:<id>; non-text returns polite refusal"
       - `telegram-keyboards.test.ts` → "telegram inline keyboards (TG-03, TG-04)" → "quote keyboard sent after QUOTED with RU/UA labels and price from DB"
       - `driver-confirmation.test.ts` → "driver Telegram notification (TG-05)" → "driver_telegram_id present → bot.api.sendMessage with driverKeyboard; null → stub auto-accept log"
       - `client-notifications.test.ts` → "client status notifications (TG-07)" → "transitionOrder DRIVER_ASSIGNED onSuccess hook calls notifyClient with i18n template"
       - `manager-intercept.test.ts` → "manager intercept endpoints (TG-06)" → "intercept flips manager_active; subsequent inbound persists but skips intake; release returns control to bot"

       Note: `webhook-voice-stub.test.ts` is the 9th file (counts as scaffold #9). The eight Wave 0 deliverables called out in VALIDATION.md correspond to webhook-idempotency/latency/auth + telegram-adapter/keyboards/driver-confirmation/client-notifications/manager-intercept (=8). The voice-stub is a 9th file for API-15 — it's tiny and belongs to this plan.

    3. **Header rule (Phase 1+2 lesson):** No file may contain the literal string `test.todo` OUTSIDE of actual `test.todo(...)` calls. Comments like "this test.todo() will be flipped" are FORBIDDEN — they break the naive grep gate later waves rely on.

    Reference: Phase 2 Plan 02-00 SUMMARY (phase-2-stubs.test.ts pattern). VALIDATION.md `Wave 0 Requirements` section lists these files verbatim.
  </action>
  <verify>
    <automated>test -f apps/api/tests/unit/phase-3-stubs.test.ts && [ "$(grep -c "test.todo" apps/api/tests/unit/phase-3-stubs.test.ts)" -eq 9 ] && test -f apps/api/tests/integration/webhook-idempotency.test.ts && test -f apps/api/tests/integration/webhook-latency.test.ts && test -f apps/api/tests/integration/webhook-auth.test.ts && test -f apps/api/tests/integration/webhook-voice-stub.test.ts && test -f apps/api/tests/integration/telegram-adapter.test.ts && test -f apps/api/tests/integration/telegram-keyboards.test.ts && test -f apps/api/tests/integration/driver-confirmation.test.ts && test -f apps/api/tests/integration/client-notifications.test.ts && test -f apps/api/tests/integration/manager-intercept.test.ts && pnpm --filter @ai-logist/api vitest run tests/unit/phase-3-stubs.test.ts 2>&1 | grep -q "9 todo"</automated>
  </verify>
  <done>
    phase-3-stubs.test.ts has EXACTLY 9 test.todo (verified by grep -c); 9 integration files exist with describe.skipIf(!dockerAvailable) + 1+ test.todo each; vitest run reports "9 todo" for the stubs file; no production code touched.
  </done>
</task>

</tasks>

<verification>
- typecheck passes: `pnpm --filter @ai-logist/api typecheck` exit 0
- biome clean: `pnpm exec biome check apps/api/tests/_helpers apps/api/tests/unit apps/api/tests/integration apps/api/tests/fixtures` exit 0
- stub count locked: `grep -c "test.todo" apps/api/tests/unit/phase-3-stubs.test.ts` = 9
- Wave 1 can `import { createMockBot } from '../_helpers/telegram-mock.js'` and `import { postTelegramWebhook } from '../_helpers/webhook-driver.js'`
</verification>

<success_criteria>
1. 9 test.todo markers exist in phase-3-stubs.test.ts (one per Phase 3 req)
2. MockTelegramBot factory records sends + callback responses with NO network access
3. webhook-driver helper measures ack latency via process.hrtime.bigint
4. 11 canonical Telegram Update fixtures persist with stable shape
5. 8 integration scaffolds compile and report `test.todo` count > 0
6. Subsequent waves can import all helpers without modification
</success_criteria>

<output>
After completion, create `.planning/phases/03-telegram-channel/03-00-SUMMARY.md` summarizing: files created, fixture key list, 9 todo markers' wave assignments (which wave will flip which todo), and any tweaks to the verbatim RESEARCH Code Block 13 mock.
</output>
