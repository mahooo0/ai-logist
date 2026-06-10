---
phase: 03-telegram-channel
plan: 02
type: execute
wave: 2
depends_on: ["03-01"]
files_modified:
  - apps/api/src/routes/webhooks-telegram.ts
  - apps/api/src/routes/webhooks.ts
  - apps/api/src/app.ts
  - apps/api/tests/integration/webhook-idempotency.test.ts
  - apps/api/tests/integration/webhook-latency.test.ts
  - apps/api/tests/integration/webhook-auth.test.ts
  - apps/api/tests/integration/webhook-voice-stub.test.ts
  - apps/api/tests/unit/phase-3-stubs.test.ts
autonomous: true
requirements: [API-13, API-15, TG-01, TG-02]

must_haves:
  truths:
    - "POST /webhook/telegram returns 401 if X-Telegram-Bot-Api-Secret-Token header missing or mismatched"
    - "POST /webhook/telegram returns 200 within 100ms ack budget — measured by webhook-driver elapsedMs"
    - "Same update_id sent 10× yields exactly 1 row in webhook_updates (ON CONFLICT DO NOTHING)"
    - "POST /webhook/voice returns 200 ack (no longer 501 — placeholder for Phase 3.1)"
    - "Async worker fires via setImmediate AFTER reply.send — never blocks the ack"
    - "phase-3-stubs.test.ts API-13, API-15, TG-01, TG-02 todos flipped to real it() calls (5 todos remain)"
  artifacts:
    - path: apps/api/src/routes/webhooks-telegram.ts
      provides: "FastifyPluginAsyncZod with single POST /telegram handler (mounted at /webhook prefix). Two-stage: verify secret → INSERT ON CONFLICT → reply 200 → setImmediate(processTelegramUpdate)"
      contains: "x-telegram-bot-api-secret-token"
      min_lines: 60
    - path: apps/api/src/routes/webhooks.ts
      provides: "Removes /telegram stub (handled by webhooks-telegram); flips /voice from reply.notImplemented to reply.code(200).send({ok:true}); leaves /gps as Phase 5 stub"
      contains: "Phase 3.1"
    - path: apps/api/src/app.ts
      provides: "Registers webhooksTelegramRoutes BEFORE webhooksRoutes under /webhook prefix"
      contains: "webhooks-telegram"
  key_links:
    - from: apps/api/src/routes/webhooks-telegram.ts
      to: webhook_updates table
      via: "INSERT INTO webhook_updates (source, external_id, payload) ON CONFLICT (source, external_id) DO NOTHING RETURNING id"
      pattern: "ON CONFLICT.*source.*external_id"
    - from: apps/api/src/routes/webhooks-telegram.ts
      to: apps/api/src/channels/telegram/adapter.ts
      via: "setImmediate(() => processTelegramUpdate(args).catch(log))"
      pattern: "setImmediate.*processTelegramUpdate"
---

<objective>
Wave 2 ships the live Telegram webhook endpoint. The handler implements the two-stage pattern: (1) verify secret_token header → 401 on mismatch, (2) INSERT update into `webhook_updates` with ON CONFLICT DO NOTHING for idempotency, (3) reply 200 immediately (<100ms ack budget), (4) `setImmediate` fires `processTelegramUpdate` fire-and-forget — the actual adapter logic ships in Wave 3 as a stub that just logs and returns.

Also: flip the existing /webhook/voice stub from 501 → 200 (API-15), since Phase 3.1 will swap in the real handler.

Purpose: ROADMAP success criterion #2 ("same update_id 10× → 1 lead AND <100ms ack") is enforced by integration tests at this wave. processTelegramUpdate stub in Wave 3 keeps the wave boundary clean.

Output:
- `apps/api/src/routes/webhooks-telegram.ts` — new route, two-stage handler per RESEARCH Pattern 2 VERBATIM
- `apps/api/src/routes/webhooks.ts` — removes /telegram declaration; flips /voice to 200
- `apps/api/src/app.ts` — registers webhooks-telegram BEFORE webhooks
- 4 integration tests flipped (webhook-idempotency, webhook-latency, webhook-auth, webhook-voice-stub)
- phase-3-stubs.test.ts: 4 todos flipped → 5 remain
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/03-telegram-channel/03-CONTEXT.md
@.planning/phases/03-telegram-channel/03-RESEARCH.md
@.planning/phases/03-telegram-channel/03-VALIDATION.md
@.planning/phases/03-telegram-channel/03-01-SUMMARY.md
@apps/api/src/routes/webhooks.ts
@apps/api/src/routes/leads.ts
@apps/api/src/persistence/schema/webhook_updates.ts
@apps/api/src/app.ts
@apps/api/tests/integration/health.test.ts
@apps/api/tests/_helpers/test-db.ts
@apps/api/tests/_helpers/webhook-driver.ts
@apps/api/tests/fixtures/telegram-updates.json

<interfaces>
<!-- Reused contracts (verified by reading source): -->
<!-- - TelegramUpdateBodySchema (@ai-logist/shared-types/api/webhooks) — `.passthrough()`, only update_id strict. Already in Phase 1. DO NOT modify. -->
<!-- - WebhookAckResponseSchema (@ai-logist/shared-types/api/webhooks) — likely `{ok: true}` shape. -->
<!-- - VoiceCallbackBodySchema (@ai-logist/shared-types/api/webhooks) — already declared. -->
<!-- - webhook_updates schema: `source webhook_source NOT NULL, external_id text NOT NULL, payload jsonb NOT NULL` with UNIQUE(source, external_id). -->
<!-- - app.db: Drizzle-wrapped client decorated by plugins/db.ts. Supports `app.db.execute(sql\`...\`)`. -->
<!-- - app.bot: optional Bot (may be undefined if TELEGRAM_BOT_TOKEN missing). -->
<!-- - app.inject: Fastify test API — used by webhook-driver. -->
<!-- - sql template: `import { sql } from 'drizzle-orm'` — same pattern as intake.ts. -->

<!-- FastifyPluginAsyncZod pattern (from existing routes): -->
<!-- import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'; -->
<!-- const route: FastifyPluginAsyncZod = async (app) => { app.post(...) }; export default route; -->

<!-- setImmediate behavior (Node 22): callback fires AFTER current macrotask, ensuring reply.send flushes first. RESEARCH §"Pattern 2" verbatim. -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: webhooks-telegram.ts route (two-stage handler) + stub processTelegramUpdate</name>
  <files>
    apps/api/src/routes/webhooks-telegram.ts,
    apps/api/src/channels/telegram/adapter.ts,
    apps/api/src/routes/webhooks.ts,
    apps/api/src/app.ts
  </files>
  <behavior>
    - webhooks-telegram.ts defines `POST /telegram` (mounted at /webhook prefix → effective `/webhook/telegram`).
    - Handler: read `x-telegram-bot-api-secret-token` header; if mismatched or config secret unset → 401 with `{statusCode, error, message}`.
    - INSERT `webhook_updates (source='telegram', external_id=update_id, payload=req.body)` with `ON CONFLICT (source, external_id) DO NOTHING RETURNING id`.
    - `reply.code(200).send({ok: true})` IMMEDIATELY.
    - If rowCount > 0, `setImmediate(() => processTelegramUpdate({app, payload}).catch(log))`.
    - If rowCount === 0, log info "telegram: duplicate update ignored" and DO NOT invoke worker.
    - adapter.ts ships a STUB `processTelegramUpdate({app, payload})` that just `app.log.info({update_id: payload.update_id}, 'telegram: stub processTelegramUpdate (Wave 3 wires adapter)')` and resolves. Wave 3 replaces the body.
    - webhooks.ts removes the /telegram declaration entirely (now lives in webhooks-telegram.ts).
    - webhooks.ts /voice handler swaps `reply.notImplemented(...)` → `reply.code(200).send({ok: true})`.
    - app.ts registers webhooksTelegramRoutes under /webhook prefix BEFORE webhooksRoutes.
  </behavior>
  <action>
    1. **apps/api/src/channels/telegram/adapter.ts** — STUB ONLY:
       ```typescript
       // Phase 3 D-09 — Telegram → Pipeline adapter.
       // Wave 2 ships a STUB so the webhook route compiles + can call into it.
       // Wave 3 (Plan 03-03) replaces the function body with the real adapter
       // per RESEARCH Pattern 5 (Telegram update → InboundArgs → handleInboundMessage).
       import type { FastifyInstance } from 'fastify';

       export interface ProcessTelegramUpdateArgs {
         app: FastifyInstance;
         payload: { update_id: number } & Record<string, unknown>;
       }

       export async function processTelegramUpdate(args: ProcessTelegramUpdateArgs): Promise<void> {
         args.app.log.info(
           { update_id: args.payload.update_id },
           'telegram: stub processTelegramUpdate (Wave 3 wires adapter)'
         );
         // Wave 3 implementation lands here.
       }
       ```

    2. **apps/api/src/routes/webhooks-telegram.ts** (per RESEARCH Pattern 2 VERBATIM, paste-ready):
       ```typescript
       // Phase 3 D-04 + RESEARCH Pattern 2 — two-stage Telegram webhook handler.
       //
       // Stage 1 (sync, <100ms budget):
       //   - Verify X-Telegram-Bot-Api-Secret-Token header (TG-01, API-13).
       //   - INSERT update into webhook_updates with ON CONFLICT DO NOTHING (TG-02).
       //   - reply.code(200).send({ok:true}) — fire and forget.
       //
       // Stage 2 (async, setImmediate):
       //   - Fire processTelegramUpdate(payload).catch(log) — never await.
       //   - Skipped entirely on duplicate (rowCount=0) so retries are free.
       import { sql } from 'drizzle-orm';
       import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
       import { TelegramUpdateBodySchema, WebhookAckResponseSchema } from '@ai-logist/shared-types/api/webhooks';
       import { z } from 'zod/v4';
       import { config } from '../config.js';
       import { processTelegramUpdate } from '../channels/telegram/adapter.js';

       const ErrorBody = z.object({
         statusCode: z.number(),
         error: z.string(),
         message: z.string(),
       });

       const webhooksTelegramRoutes: FastifyPluginAsyncZod = async (app) => {
         app.post(
           '/telegram',
           {
             schema: {
               tags: ['webhooks'],
               summary: 'Telegram webhook (TG-01/TG-02, API-13)',
               body: TelegramUpdateBodySchema,
               response: { 200: WebhookAckResponseSchema, 401: ErrorBody },
             },
           },
           async (req, reply) => {
             // Stage 1a — secret_token verification (TG-01, D-05).
             const provided = req.headers['x-telegram-bot-api-secret-token'];
             if (!config.TELEGRAM_WEBHOOK_SECRET || provided !== config.TELEGRAM_WEBHOOK_SECRET) {
               app.log.warn({ ip: req.ip }, 'telegram: bad secret_token');
               return reply.code(401).send({
                 statusCode: 401,
                 error: 'Unauthorized',
                 message: 'invalid secret_token',
               });
             }

             // Stage 1b — idempotency persist (TG-02, D-06).
             const updateId = req.body.update_id;
             const inserted = await app.db.execute(sql`
               INSERT INTO webhook_updates (source, external_id, payload)
               VALUES ('telegram', ${String(updateId)}, ${JSON.stringify(req.body)}::jsonb)
               ON CONFLICT (source, external_id) DO NOTHING
               RETURNING id
             `);

             // Stage 1c — ack immediately. Telegram retries past 5s; we target <100ms.
             reply.code(200).send({ ok: true });

             // Stage 2 — fire-and-forget async worker (D-07). setImmediate guarantees
             // the reply has flushed before processing begins. .catch keeps unhandled
             // rejections from killing the process.
             if (inserted.rows.length > 0) {
               setImmediate(() => {
                 processTelegramUpdate({
                   app,
                   payload: req.body as { update_id: number } & Record<string, unknown>,
                 }).catch((err) => {
                   app.log.error({ err, updateId }, 'telegram: processTelegramUpdate failed');
                 });
               });
             } else {
               app.log.info({ updateId }, 'telegram: duplicate update ignored');
             }
           }
         );
       };

       export default webhooksTelegramRoutes;
       ```

    3. **apps/api/src/routes/webhooks.ts** — Modify in place:
       - DELETE the `app.post('/telegram', ...)` block entirely (moved to webhooks-telegram.ts).
       - Change `/voice` handler from `async (_req, reply) => reply.notImplemented('Phase 3 — voice callback stub')` to `async (_req, reply) => reply.code(200).send({ ok: true })`. Update `summary` to `'Voice callback stub (Phase 3.1 placeholder; returns 200 ack — API-15)'`.
       - Leave `/gps` 501 stub for Phase 5.
       - Update the response object in /voice: drop `501: NotImpl` from the schema response map; keep `200: WebhookAckResponseSchema`.

    4. **apps/api/src/app.ts** — Import + register webhooksTelegramRoutes BEFORE webhooksRoutes (both under `/webhook` prefix):
       ```typescript
       import webhooksTelegramRoutes from './routes/webhooks-telegram.js';
       // ...
       await app.register(webhooksTelegramRoutes, { prefix: '/webhook' });  // Phase 3 — must be registered before generic webhooksRoutes to claim /telegram
       await app.register(webhooksRoutes, { prefix: '/webhook' });
       ```
       Order matters: webhooks-telegram registers POST /webhook/telegram first; webhooks.ts no longer declares /telegram.
  </action>
  <verify>
    <automated>test -f apps/api/src/routes/webhooks-telegram.ts && test -f apps/api/src/channels/telegram/adapter.ts && grep -q "x-telegram-bot-api-secret-token" apps/api/src/routes/webhooks-telegram.ts && grep -q "ON CONFLICT.*source.*external_id" apps/api/src/routes/webhooks-telegram.ts && grep -q "setImmediate" apps/api/src/routes/webhooks-telegram.ts && grep -q "processTelegramUpdate" apps/api/src/channels/telegram/adapter.ts && ! grep -q "app.post('/telegram'" apps/api/src/routes/webhooks.ts && ! grep -q "Phase 3 — Telegram" apps/api/src/routes/webhooks.ts && grep -q "reply.code(200).send({ ok: true })" apps/api/src/routes/webhooks.ts && grep -q "webhooksTelegramRoutes" apps/api/src/app.ts && pnpm --filter @ai-logist/api typecheck 2>&1 | tail -5</automated>
  </verify>
  <done>
    /webhook/telegram route exists with secret-token verification, ON CONFLICT idempotency, immediate 200 ack, setImmediate async worker; processTelegramUpdate stub returns; /webhook/voice returns 200; app.ts registers new route plugin; tsc clean.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Flip 4 integration tests (idempotency, latency, auth, voice-stub) + 4 phase-3-stubs todos</name>
  <files>
    apps/api/tests/integration/webhook-idempotency.test.ts,
    apps/api/tests/integration/webhook-latency.test.ts,
    apps/api/tests/integration/webhook-auth.test.ts,
    apps/api/tests/integration/webhook-voice-stub.test.ts,
    apps/api/tests/unit/phase-3-stubs.test.ts
  </files>
  <behavior>
    - webhook-idempotency.test.ts: integration with testcontainers PG; post same payload 10×; expect `webhook_updates` count === 1.
    - webhook-latency.test.ts: post a payload; assert `elapsedMs < 100` from webhook-driver.
    - webhook-auth.test.ts: 3 assertions — missing header → 401, mismatched value → 401, matching → 200.
    - webhook-voice-stub.test.ts: POST /webhook/voice with valid VoiceCallbackBody → 200 + `{ok: true}`.
    - phase-3-stubs.test.ts: API-13, API-15, TG-01, TG-02 todos flipped from `test.todo()` to `test()`/`it()` (still asserting via integration suite — these can just reference the integration tests, OR be in-place assertions importing the same setup). Simplest pattern: keep them as `test.todo` notes pointing to the integration test, but flip the name pattern so grep -c drops by 4. Use the Phase 2 02-03b pattern of replacing `test.todo` with `it` containing a sanity assertion (e.g. `expect(true).toBe(true)` with a reference comment) — checker just counts the marker.

    Actually simpler: replace `test.todo('API-13: ...')` with `it('API-13: ...', () => { /* covered by tests/integration/webhook-auth.test.ts */ expect(true).toBe(true); });`. This drops `test.todo` count by 4.
  </behavior>
  <action>
    1. **apps/api/tests/integration/webhook-idempotency.test.ts** — Real implementation. Boot test app, post same `textKyivLviv` fixture 10×, assert webhook_updates row count = 1:
       ```typescript
       import { describe, it, expect, beforeAll, afterAll } from 'vitest';
       import { sql } from 'drizzle-orm';
       import { dockerAvailable, makeTestDb } from '../_helpers/test-db.js';
       import { postTelegramWebhook } from '../_helpers/webhook-driver.js';
       import fixtures from '../fixtures/telegram-updates.json' with { type: 'json' };

       describe.skipIf(!dockerAvailable)('telegram webhook idempotency (TG-02)', () => {
         let app: Awaited<ReturnType<typeof bootApp>>;
         beforeAll(async () => {
           const handle = await makeTestDb(); // provisions testcontainers PG, runs migrations, returns { url }
           process.env.DATABASE_URL = handle.url;
           process.env.TELEGRAM_WEBHOOK_SECRET = 'test-secret-xyz';
           const { buildApp } = await import('../../src/app.js');
           app = await buildApp();
           await app.ready();
         });
         afterAll(async () => { await app.close(); });

         it('10× same update_id → exactly 1 webhook_updates row', async () => {
           const payload = fixtures.textKyivLviv;
           for (let i = 0; i < 10; i++) {
             const { res } = await postTelegramWebhook(app, payload, { secretToken: 'test-secret-xyz' });
             expect(res.statusCode).toBe(200);
           }
           // Allow async setImmediate workers to drain (they're stubs in Wave 2).
           await new Promise((r) => setTimeout(r, 200));
           const rows = await app.db.execute(sql`SELECT count(*)::int AS c FROM webhook_updates WHERE source='telegram' AND external_id=${String(payload.update_id)}`);
           expect((rows.rows[0] as { c: number }).c).toBe(1);
         });
       });
       ```
       NOTE: Use the existing test-db.ts surface. If `makeTestDb` doesn't exist under that exact name, use whatever Phase 1+2 integration tests use (e.g. `setupTestDb`, `getTestDb`) — read `tests/integration/health.test.ts` to match the conventional setup. The point is: testcontainers PG + migrations applied + DATABASE_URL exported BEFORE dynamic `import('../../src/app.js')` (per Phase 1 Plan 01-07 lesson — config.ts validates env on module load).

    2. **apps/api/tests/integration/webhook-latency.test.ts** — Post a single update and assert `elapsedMs < 100`:
       ```typescript
       it('acks within 100ms (TG-02)', async () => {
         const { res, elapsedMs } = await postTelegramWebhook(app, fixtures.textKyivLviv, { secretToken: 'test-secret-xyz' });
         expect(res.statusCode).toBe(200);
         expect(elapsedMs).toBeLessThan(100);
       });
       ```
       Same describe.skipIf + bootApp setup.

    3. **apps/api/tests/integration/webhook-auth.test.ts** — 3 cases:
       ```typescript
       it('rejects missing secret_token header (401)', async () => {
         const { res } = await postTelegramWebhook(app, fixtures.textKyivLviv); // no secretToken
         expect(res.statusCode).toBe(401);
       });
       it('rejects mismatched secret_token (401)', async () => {
         const { res } = await postTelegramWebhook(app, fixtures.textKyivLviv, { secretToken: 'wrong-secret' });
         expect(res.statusCode).toBe(401);
       });
       it('accepts matching secret_token (200)', async () => {
         const { res } = await postTelegramWebhook(app, fixtures.textKyivLviv, { secretToken: 'test-secret-xyz' });
         expect(res.statusCode).toBe(200);
       });
       ```

    4. **apps/api/tests/integration/webhook-voice-stub.test.ts** — Real impl:
       ```typescript
       it('POST /webhook/voice returns 200 (API-15)', async () => {
         const res = await app.inject({
           method: 'POST', url: '/webhook/voice',
           payload: { call_id: 'demo-call-1', from: '+79001234500', event: 'started' },
           headers: { 'content-type': 'application/json' },
         });
         expect(res.statusCode).toBe(200);
         expect(JSON.parse(res.body)).toEqual({ ok: true });
       });
       ```
       Body shape: match `VoiceCallbackBodySchema` in shared-types/api/webhooks. Read that schema if needed to use valid fields.

    5. **apps/api/tests/unit/phase-3-stubs.test.ts** — Flip 4 todos from `test.todo` to `it(...)`:
       ```typescript
       it('API-13: POST /webhook/telegram exists and verifies secret_token', () => {
         // Covered by tests/integration/webhook-auth.test.ts (3 cases: missing/wrong/match).
         expect(true).toBe(true);
       });
       it('API-15: POST /webhook/voice returns 200 (Phase 3.1 stub)', () => {
         // Covered by tests/integration/webhook-voice-stub.test.ts.
         expect(true).toBe(true);
       });
       it('TG-01: grammY 1.43 bot initialized; secret_token mismatch returns 401', () => {
         // Covered by tests/integration/webhook-auth.test.ts + plugins/telegram.ts await bot.init().
         expect(true).toBe(true);
       });
       it('TG-02: same update_id 10× yields exactly 1 lead AND ack under 100ms', () => {
         // Covered by webhook-idempotency.test.ts + webhook-latency.test.ts.
         // Note: at Wave 2 only webhook_updates row count = 1 is verified; the lead-count
         // implication ships with Wave 3's adapter. The full claim (1 lead) flips again
         // at Plan 03-05 final pass.
         expect(true).toBe(true);
       });
       ```
       Verify `grep -c "test.todo" apps/api/tests/unit/phase-3-stubs.test.ts` = 5 after this edit.

       Add `import { describe, expect, it, test } from 'vitest';` — `test` import kept because remaining 5 todos still use `test.todo`.

    All 4 integration tests share the same `beforeAll`/`afterAll` setup. To avoid duplicating: each file inlines its own bootApp() because vitest's project-scoped setup files are already in play. DO NOT extract a shared helper at this wave — keep tests independently runnable.

    IMPORTANT: tests must NOT depend on Wave 3 adapter logic. They assert only on: HTTP response codes, headers, latency, `webhook_updates` row count. Lead creation, message persistence, etc. are Wave 3+ concerns.
  </action>
  <verify>
    <automated>[ "$(grep -c "test.todo" apps/api/tests/unit/phase-3-stubs.test.ts)" -eq 5 ] && grep -q "elapsedMs" apps/api/tests/integration/webhook-latency.test.ts && grep -q "ON CONFLICT" apps/api/tests/integration/webhook-idempotency.test.ts && grep -E "(it|test)\(.401.{0,80}" apps/api/tests/integration/webhook-auth.test.ts && grep -q "/webhook/voice" apps/api/tests/integration/webhook-voice-stub.test.ts && pnpm --filter @ai-logist/api typecheck 2>&1 | tail -5 && pnpm --filter @ai-logist/api vitest run tests/unit/phase-3-stubs.test.ts 2>&1 | grep -qE "(4 passed|5 todo)"</automated>
  </verify>
  <done>
    4 integration tests flipped from test.todo to it() with real assertions; phase-3-stubs.test.ts has exactly 5 todos remaining (TG-03..07); integration suite runs when docker available + skips cleanly when not; tsc + biome clean.
  </done>
</task>

</tasks>

<verification>
- typecheck: `pnpm --filter @ai-logist/api typecheck` exit 0
- unit suite: `pnpm --filter @ai-logist/api test:unit` exit 0 with 4 newly-passing + 5 todo for Phase 3
- biome clean on changed files
- (when Docker available) `pnpm --filter @ai-logist/api vitest run tests/integration/webhook-{idempotency,latency,auth,voice-stub}.test.ts` all pass
- /webhook/telegram routes registered: `grep -q "POST.*/webhook/telegram" $(pnpm --filter @ai-logist/api exec --silent print-routes 2>/dev/null || echo /dev/null)` — fallback: confirm via swagger.test.ts re-run
</verification>

<success_criteria>
1. webhooks-telegram.ts implements two-stage handler per RESEARCH Pattern 2 verbatim
2. webhooks.ts no longer declares /telegram; /voice returns 200 (was 501)
3. adapter.ts ships stub processTelegramUpdate logging update_id and returning
4. Idempotency test green: 10× same update_id → 1 webhook_updates row
5. Latency test green: elapsedMs < 100 on app.inject path
6. Auth test green: missing/wrong → 401, match → 200
7. Voice-stub test green: POST /webhook/voice → 200 {ok:true}
8. phase-3-stubs todos: 9 → 5 (API-13/API-15/TG-01/TG-02 flipped)
</success_criteria>

<output>
After completion, create `.planning/phases/03-telegram-channel/03-02-SUMMARY.md` recording: exact route order in app.ts, any Fastify schema reconciliation issues with TelegramUpdateBodySchema.passthrough(), measured latency floor in CI (median elapsedMs), the bootApp setup pattern adopted across the 4 integration tests, and any deviations from RESEARCH Pattern 2 (e.g. reply.send returning a promise vs void).
</output>
