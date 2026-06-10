---
phase: 03-telegram-channel
plan: 04
type: execute
wave: 4
depends_on: ["03-03"]
files_modified:
  - apps/api/src/channels/telegram/notifications.ts
  - apps/api/src/channels/telegram/handlers.ts
  - apps/api/src/pipeline/lifecycle/order-fsm.ts
  - apps/api/src/lib/i18n.ts
  - apps/api/src/pipeline/intake.ts
  - apps/api/tests/integration/driver-confirmation.test.ts
  - apps/api/tests/integration/client-notifications.test.ts
  - apps/api/tests/unit/phase-3-stubs.test.ts
autonomous: true
requirements: [TG-05, TG-07]

must_haves:
  truths:
    - "notifyDriver(orderId, db, bot, log) reads truck via JOIN; if driver_telegram_id null → log warn + return (simulated auto-accept); if present → bot.api.sendMessage with driverKeyboard"
    - "notifyClient(orderId, transition, db, bot, log) reads client.telegram_id + lang; if null → skip silent; if present → bot.api.sendMessage with i18n template"
    - "i18n.ts exports renderNotificationTemplate(transition, row, lang) for DRIVER_ASSIGNED|IN_TRANSIT|DELIVERED in RU + UA"
    - "transitionOrder gains optional onSuccess?: (result) => Promise<void> | void hook; fired AFTER db.transaction commits; errors caught + logged + never roll back"
    - "handlers.ts adds bot.callbackQuery(/^(driver_accept|driver_decline):(.+)$/) — accept logs ack; decline → transitionOrder→CLOSED + transitionLead→LOST(reason='driver_declined') + polite reply"
    - "intake.ts STEP D-pre confirmation shortcut: AFTER successful createOrder + ORDER_CREATED, immediately call transitionOrder → DRIVER_ASSIGNED with onSuccess: notifyDriver + notifyClient (RESEARCH Open Question §5 recommendation)"
    - "phase-3-stubs.test.ts TG-05 + TG-07 flipped (1 todo remains: TG-06)"
  artifacts:
    - path: apps/api/src/channels/telegram/notifications.ts
      provides: "notifyDriver + notifyClient async functions per RESEARCH Code Block 7 + 8"
      contains: "notifyDriver"
      min_lines: 80
    - path: apps/api/src/channels/telegram/handlers.ts
      provides: "Adds bot.callbackQuery(/^(driver_accept|driver_decline):(.+)$/) handler after existing client callbacks"
      contains: "driver_accept"
    - path: apps/api/src/pipeline/lifecycle/order-fsm.ts
      provides: "TransitionOrderArgs gains optional onSuccess; transitionOrder returns result + fires onSuccess(result).catch(log) AFTER db.transaction"
      contains: "onSuccess"
    - path: apps/api/src/lib/i18n.ts
      provides: "renderNotificationTemplate(transition, row, lang) for 3 transitions in 2 langs"
      contains: "DRIVER_ASSIGNED"
    - path: apps/api/src/pipeline/intake.ts
      provides: "STEP D-pre confirm shortcut: after createOrderHandler + transitionLead→ORDER_CREATED, schedule transitionOrder→DRIVER_ASSIGNED with onSuccess notifyDriver+notifyClient"
      contains: "DRIVER_ASSIGNED"
  key_links:
    - from: apps/api/src/pipeline/lifecycle/order-fsm.ts
      to: apps/api/src/channels/telegram/notifications.ts
      via: "transitionOrder({onSuccess: () => notifyDriver(...) + notifyClient(...)})"
      pattern: "onSuccess"
    - from: apps/api/src/channels/telegram/handlers.ts
      to: apps/api/src/pipeline/lifecycle/order-fsm.ts
      via: "transitionOrder({orderId, to: 'CLOSED', actor: 'system', payload: {driver_declined: true}})"
      pattern: "driver_declined"
    - from: apps/api/src/pipeline/intake.ts
      to: apps/api/src/pipeline/lifecycle/order-fsm.ts
      via: "After createOrder shortcut: transitionOrder(orderId, 'DRIVER_ASSIGNED', actor: 'ai', onSuccess: notify*)"
      pattern: "DRIVER_ASSIGNED"
---

<objective>
Wave 4 wires the driver loop + client notifications + the FSM post-commit hook that ties them together. After this wave, when a client confirms a quote via Telegram, the pipeline (a) creates the order, (b) immediately transitions it to DRIVER_ASSIGNED, (c) fires notifyDriver (Telegram keyboard to the assigned driver if telegram_id present, simulated auto-accept otherwise), and (d) fires notifyClient (Telegram message to the client with the truck details in their lang).

Driver decline → order→CLOSED + lead→LOST per RESEARCH Pitfall #5 + Open Question §3 (D-19 simplification documented).

CRITICAL: notifications MUST fire AFTER `db.transaction(...)` returns. The `onSuccess` hook in transitionOrder is fire-and-forget — errors caught and logged, never rolling back the FSM transition (per RESEARCH Pitfall #3).

Output:
- `apps/api/src/channels/telegram/notifications.ts` (new)
- `apps/api/src/pipeline/lifecycle/order-fsm.ts` (TransitionOrderArgs + onSuccess hook)
- `apps/api/src/lib/i18n.ts` (renderNotificationTemplate)
- `apps/api/src/channels/telegram/handlers.ts` (driver callbacks regex added)
- `apps/api/src/pipeline/intake.ts` (STEP D-pre post-ORDER_CREATED → transitionOrder hook)
- 2 integration tests flipped (driver-confirmation + client-notifications)
- phase-3-stubs.test.ts: 2 todos flipped → 1 remains (TG-06)
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/03-telegram-channel/03-CONTEXT.md
@.planning/phases/03-telegram-channel/03-RESEARCH.md
@.planning/phases/03-telegram-channel/03-03-SUMMARY.md
@apps/api/src/pipeline/lifecycle/order-fsm.ts
@apps/api/src/pipeline/intake.ts
@apps/api/src/channels/telegram/handlers.ts
@apps/api/src/channels/telegram/keyboards.ts
@apps/api/src/persistence/repos/leads.ts
@apps/api/src/persistence/schema/orders.ts

<interfaces>
<!-- Verified existing surface (from direct reads): -->
<!-- - transitionOrder signature: `(db: Db, args: TransitionOrderArgs): Promise<TransitionOrderResult>`. -->
<!-- - Args: { orderId, to, actor, payload?, geomWkt? }. Result: { from, to, version, audit_row_inserted }. -->
<!-- - ORDER_TRANSITIONS: CREATED → [DRIVER_ASSIGNED]; DRIVER_ASSIGNED → [AT_LOADING]; CLOSED → []. -->
<!-- - STATUS_TO_EVENT: CREATED='created', DRIVER_ASSIGNED='driver_assigned', ..., CLOSED=null (CLOSED skips audit). -->
<!-- - intake.ts STEP D-pre (lines 217-264 in current file): -->
<!--    if (lead.stage === 'QUOTED' && CONFIRM_PATTERNS.test(text)) { -->
<!--      transitionLead → AGREED -->
<!--      createOrderHandler(ctx, {lead_id, confirmed: true}) -->
<!--      transitionLead → ORDER_CREATED -->
<!--      reply "Заказ {N} создан. Отслеживание: /track/{token}" -->
<!--      return { leadId, exchanges } -->
<!--    } -->
<!-- - createOrderHandler returns { order_id, order_number, public_token } (from Phase 2 Plan 02-02). -->
<!-- - order created with status='CREATED' by Phase 2 createOrderHandler. -->
<!-- - leads.ts: leadsRepo.update(db, id, {orderId, ...}) called by createOrderHandler. -->
<!-- - The current intake.ts confirms shortcut does NOT transition order. Wave 4 adds the transition AFTER the existing `transitionLead → ORDER_CREATED` step. -->

<!-- RESEARCH Code Block 7 (notifyDriver): single JOIN query reading o + t + c + cf + ct; bot.api.sendMessage to truck.driver_telegram_id with driverKeyboard. -->
<!-- RESEARCH Code Block 8 (notifyClient): single JOIN reading o + t + c; bot.api.sendMessage to client.telegram_id with renderNotification template. -->
<!-- RESEARCH Code Block 9 (order-fsm hook): TransitionOrderArgs.onSuccess?: (result) => Promise<void> | void; fired after tx commit. -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: notifications.ts + i18n.ts templates + order-fsm.ts onSuccess hook</name>
  <files>
    apps/api/src/channels/telegram/notifications.ts,
    apps/api/src/lib/i18n.ts,
    apps/api/src/pipeline/lifecycle/order-fsm.ts
  </files>
  <behavior>
    - notifications.ts exports `notifyDriver({orderId, db, bot, log})` + `notifyClient({orderId, transition, db, bot, log})` per RESEARCH Code Blocks 7 + 8 verbatim.
    - i18n.ts (extend existing — Phase 2 stub) adds `renderNotificationTemplate(transition, row, lang)` with templates for DRIVER_ASSIGNED, IN_TRANSIT, DELIVERED in both RU + UA. Row shape: `{number, plate_number, driver_name, driver_phone}`.
    - order-fsm.ts TransitionOrderArgs gains optional `onSuccess?: (result: TransitionOrderResult) => Promise<void> | void`. The body remains EXACTLY the same — just at the END (after `return { from, to, version, audit_row_inserted }` line inside the tx) the tx returns the result; the OUTER wrapper fires `onSuccess(result).catch(log)` AFTER the tx returns.

    NOTE: existing transitionOrder body is wrapped in `db.transaction(async (tx) => { ... return result; })`. To add the post-commit hook, refactor to:
    ```typescript
    const result = await db.transaction(async (tx) => { /* existing body unchanged */ });
    if (args.onSuccess) {
      Promise.resolve(args.onSuccess(result)).catch((err) => {
        // No log injected — use console as fallback. Callers SHOULD pass log themselves.
        // eslint-disable-next-line no-console
        console.error('transitionOrder.onSuccess failed', err);
      });
    }
    return result;
    ```
    This is a SAFE refactor: the body inside `db.transaction` is byte-identical; only the outer wrapper changes.
  </behavior>
  <action>
    1. **apps/api/src/lib/i18n.ts** — Extend (Read first to see current state; likely a stub from Phase 2). Add:
       ```typescript
       // Phase 3 D-24 — Telegram notification templates for FSM transitions.
       export type OrderNotificationTransition = 'DRIVER_ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED';

       interface NotificationRow {
         number: string;
         plate_number: string | null;
         driver_name: string | null;
         driver_phone: string | null;
       }

       export function renderNotificationTemplate(
         transition: OrderNotificationTransition,
         row: NotificationRow,
         lang: 'ru' | 'ua'
       ): string {
         const templates = {
           ru: {
             DRIVER_ASSIGNED: `🚚 Машина назначена! Заказ ${row.number}.\nНомер: ${row.plate_number ?? '—'}.\nВодитель: ${row.driver_name ?? '—'}, ${row.driver_phone ?? '—'}.`,
             IN_TRANSIT: `📦 Груз в пути. Заказ ${row.number}.`,
             DELIVERED: `✅ Доставлено! Заказ ${row.number}. Спасибо за заказ.`,
           },
           ua: {
             DRIVER_ASSIGNED: `🚚 Машину призначено! Замовлення ${row.number}.\nНомер: ${row.plate_number ?? '—'}.\nВодій: ${row.driver_name ?? '—'}, ${row.driver_phone ?? '—'}.`,
             IN_TRANSIT: `📦 Вантаж у дорозі. Замовлення ${row.number}.`,
             DELIVERED: `✅ Доставлено! Замовлення ${row.number}. Дякуємо за замовлення.`,
           },
         } as const;
         return templates[lang][transition];
       }
       ```
       Preserve any existing exports from Phase 2 stub i18n.ts (likely empty or one boilerplate string export).

    2. **apps/api/src/channels/telegram/notifications.ts** — Per RESEARCH Code Blocks 7 + 8 verbatim:
       ```typescript
       // Phase 3 D-17, D-18, D-24, D-25, D-26 — Telegram notification senders.
       //
       // notifyDriver — called from intake STEP D-pre after order→DRIVER_ASSIGNED.
       // notifyClient — called from any transitionOrder onSuccess (e.g. driver_assigned, in_transit, delivered).
       //
       // Both MUST be called AFTER the FSM transaction commits (RESEARCH Pitfall #3).
       // Errors are logged + swallowed — they never roll back the FSM transition.
       import type { FastifyBaseLogger } from 'fastify';
       import { sql } from 'drizzle-orm';
       import type { Bot } from 'grammy';
       import type { Db } from '../../db.js';
       import { renderNotificationTemplate, type OrderNotificationTransition } from '../../lib/i18n.js';
       import { driverKeyboard } from './keyboards.js';

       export async function notifyDriver(args: {
         orderId: string;
         db: Db;
         bot: Bot;
         log: FastifyBaseLogger;
       }): Promise<void> {
         const { orderId, db, bot, log } = args;
         const result = await db.execute(sql`
           SELECT o.id AS order_id, o.number AS order_number, o.price,
                  t.id AS truck_id, t.plate_number, t.driver_name, t.driver_telegram_id,
                  c.name AS client_name,
                  cf.name_ru AS from_name, ct.name_ru AS to_name
           FROM orders o
           LEFT JOIN trucks t ON t.id = o.truck_id
           LEFT JOIN clients c ON c.id = o.client_id
           LEFT JOIN cities cf ON cf.id = o.from_city_id
           LEFT JOIN cities ct ON ct.id = o.to_city_id
           WHERE o.id = ${orderId}
         `);
         const row = result.rows[0] as {
           order_id: string;
           order_number: string;
           price: string;
           truck_id: string | null;
           plate_number: string | null;
           driver_name: string | null;
           driver_telegram_id: string | null;
           client_name: string | null;
           from_name: string | null;
           to_name: string | null;
         } | undefined;
         if (!row) { log.warn({ orderId }, 'notifyDriver: order not found'); return; }
         if (!row.driver_telegram_id) {
           log.warn(
             { truckId: row.truck_id, orderId },
             'notifyDriver: driver_telegram_id missing — simulated auto-accept'
           );
           return;
         }
         const text = [
           `🚚 <b>Новый рейс: ${row.order_number}</b>`,
           `Клиент: ${row.client_name ?? '—'}`,
           `Маршрут: ${row.from_name ?? '—'} → ${row.to_name ?? '—'}`,
           `Машина: ${row.plate_number ?? '—'}`,
           ``,
           `Принимаете рейс?`,
         ].join('\n');
         await bot.api.sendMessage(row.driver_telegram_id, text, {
           parse_mode: 'HTML',
           reply_markup: driverKeyboard(orderId, 'ru'),
         });
       }

       export async function notifyClient(args: {
         orderId: string;
         transition: OrderNotificationTransition;
         db: Db;
         bot: Bot;
         log: FastifyBaseLogger;
       }): Promise<void> {
         const { orderId, transition, db, bot, log } = args;
         const result = await db.execute(sql`
           SELECT o.number, t.plate_number, t.driver_name, t.driver_phone,
                  c.telegram_id, c.lang
           FROM orders o
           LEFT JOIN trucks t ON t.id = o.truck_id
           LEFT JOIN clients c ON c.id = o.client_id
           WHERE o.id = ${orderId}
         `);
         const row = result.rows[0] as
           | { number: string; plate_number: string | null; driver_name: string | null; driver_phone: string | null; telegram_id: string | null; lang: string | null }
           | undefined;
         if (!row) { log.warn({ orderId }, 'notifyClient: order not found'); return; }
         if (!row.telegram_id) {
           log.info({ orderId }, 'notifyClient: client has no telegram_id — skip');
           return;
         }
         const lang = (row.lang ?? 'ru') as 'ru' | 'ua';
         const text = renderNotificationTemplate(transition, row, lang);
         try {
           await bot.api.sendMessage(row.telegram_id, text, { parse_mode: 'HTML' });
         } catch (err) {
           log.error({ err, orderId, transition }, 'notifyClient: send failed');
         }
       }
       ```

    3. **apps/api/src/pipeline/lifecycle/order-fsm.ts** — Add `onSuccess` to TransitionOrderArgs interface and refactor body for post-commit hook (per RESEARCH Code Block 9):
       Read the existing file. Find:
       ```typescript
       export interface TransitionOrderArgs {
         orderId: string;
         to: OrderStatus;
         actor: OrderActor;
         payload?: Record<string, unknown>;
         geomWkt?: string;
       }
       ```
       Add field at end:
       ```typescript
         /**
          * Phase 3 D-25: optional callback fired AFTER db.transaction commits.
          * Errors caught + logged; they MUST NOT roll back the FSM transition.
          */
         onSuccess?: (result: TransitionOrderResult) => Promise<void> | void;
       ```

       Then refactor `transitionOrder` function body. Current shape:
       ```typescript
       export async function transitionOrder(db: Db, args: TransitionOrderArgs): Promise<TransitionOrderResult> {
         return await db.transaction(async (tx) => {
           // ... 80 lines of FSM logic ...
           return { from, to, version, audit_row_inserted };
         });
       }
       ```
       Refactor to:
       ```typescript
       export async function transitionOrder(db: Db, args: TransitionOrderArgs): Promise<TransitionOrderResult> {
         const result = await db.transaction(async (tx) => {
           // ... 80 lines of FSM logic UNCHANGED ...
           return { from, to, version, audit_row_inserted };
         });
         if (args.onSuccess) {
           Promise.resolve(args.onSuccess(result)).catch((err) => {
             // eslint-disable-next-line no-console
             console.error('transitionOrder.onSuccess failed', err);
           });
         }
         return result;
       }
       ```
       The body INSIDE the db.transaction callback must remain byte-identical. Only `return await db.transaction(...)` becomes `const result = await db.transaction(...); if (...) { ... }; return result;`.

       Verify no test in `tests/integration/fsm-*.test.ts` regresses.
  </action>
  <verify>
    <automated>test -f apps/api/src/channels/telegram/notifications.ts && grep -q "notifyDriver" apps/api/src/channels/telegram/notifications.ts && grep -q "notifyClient" apps/api/src/channels/telegram/notifications.ts && grep -q "renderNotificationTemplate" apps/api/src/lib/i18n.ts && grep -q "DRIVER_ASSIGNED" apps/api/src/lib/i18n.ts && grep -q "onSuccess" apps/api/src/pipeline/lifecycle/order-fsm.ts && pnpm --filter @ai-logist/api typecheck 2>&1 | tail -5 && pnpm --filter @ai-logist/api vitest run tests/integration/fsm-concurrency.test.ts tests/integration/fsm-events-audit.test.ts tests/unit/order-fsm.test.ts 2>&1 | tail -10</automated>
  </verify>
  <done>
    notifications.ts exports notifyDriver + notifyClient; i18n.ts has renderNotificationTemplate for 3 transitions × 2 langs; order-fsm.ts has onSuccess field on TransitionOrderArgs + fire-and-forget post-commit hook; existing FSM tests still pass.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Driver callback handlers + intake.ts D-pre transitionOrder wiring</name>
  <files>
    apps/api/src/channels/telegram/handlers.ts,
    apps/api/src/pipeline/intake.ts
  </files>
  <behavior>
    - handlers.ts adds `bot.callbackQuery(/^(driver_accept|driver_decline):(.+)$/, ...)` after the existing client callbacks.
      - `driver_accept`: `answerCallbackQuery + editMessageReplyMarkup({reply_markup: undefined}) + log info + ctx.reply('✅ Принято. Удачной поездки!')`. No FSM transition (order is already DRIVER_ASSIGNED — this is confirmation).
      - `driver_decline`: `answerCallbackQuery + editMessageReplyMarkup + transitionOrder(orderId, 'CLOSED', actor: 'system', payload: {driver_declined: true, driver_tg_id: ctx.from?.id ?? null}) + transitionLead via order→lead lookup → LOST(reason: 'driver_declined') + ctx.reply('Отказ зарегистрирован. Спасибо за обратную связь.')`. NOTE: ORDER_TRANSITIONS doesn't allow DRIVER_ASSIGNED → CLOSED directly. Document this deviation OR insert intermediate AT_LOADING → IN_TRANSIT → DELIVERED → CLOSED (too contrived). Better path: add a new FSM transition `DRIVER_ASSIGNED → CLOSED` explicitly for the decline path (with payload audit trail). Update ORDER_TRANSITIONS table accordingly.
    - intake.ts STEP D-pre (current implementation, lines 217-264) — after `transitionLead → ORDER_CREATED + reply`, ADD:
      ```typescript
      // Phase 3 D-17 — schedule order → DRIVER_ASSIGNED with notify hooks.
      // Runs AFTER tx commits (transitionOrder is a separate db.transaction).
      // captured for post-commit fire:
      postCommitAssign = { orderId: order.order_id };
      ```
      Then OUTSIDE the tx (after the existing post-commit `sendQuoteKeyboard` block from Wave 3), add:
      ```typescript
      if (postCommitAssign && args.outbound) {
        // Best-effort: import notifications + transitionOrder, fire driver assignment.
        import('../channels/telegram/notifications.js').then(async ({ notifyDriver, notifyClient }) => {
          const { transitionOrder } = await import('./lifecycle/order-fsm.js');
          // We need a Bot reference. For test envs without Telegram, skip.
          // Best path: have the Telegram adapter pass the bot via args (a `bot?: Bot` arg).
        });
      }
      ```

      ACTUAL BETTER DESIGN: instead of mixing the bot into intake, expose a generic `postCommit?: () => Promise<void>` hook in InboundMessageArgs that the adapter can fill. Adapter passes `postCommit: () => transitionOrder({orderId, onSuccess: notify*})`. But this couples adapter to intake's internal flow.

      SIMPLEST DESIGN (RECOMMENDED): intake.ts triggers the DRIVER_ASSIGNED transition via the SAME outbound abstraction expanded. OR: the adapter, after calling `handleInboundMessage`, INSPECTS the returned exchanges[] for the createOrder tool result and fires the transitionOrder + notifies from outside intake.ts.

      ✅ **CHOSEN DESIGN (decision):** Adapter-driven. intake.ts STAYS UNCHANGED for this wave (Wave 3 already added one minimal edit). The adapter.ts AFTER calling handleInboundMessage checks `result.exchanges` for a `tool` entry with `name='createOrder'`; if found, it extracts `order_id` and fires `transitionOrder(app.db, {orderId, to: 'DRIVER_ASSIGNED', actor: 'ai', payload: {auto: true}, onSuccess: async () => Promise.allSettled([notifyDriver(...), notifyClient(...)])})`. This keeps intake.ts surgically minimal and concentrates Telegram-specific lifecycle wiring in the adapter where it belongs.

      Apply CHOSEN DESIGN: NO further intake.ts edit in this wave. The post-DRIVER_ASSIGNED hook fires from adapter.ts (in callback handler for `confirm:` and in process direct-text path after handleInboundMessage returns).

      handlers.ts confirm callback ALSO needs the same hook — when client taps Confirm and intake creates the order via STEP D-pre, the callback returns to handlers.ts which must trigger transitionOrder→DRIVER_ASSIGNED.

      Cleanest: factor a small helper `tryAdvanceOrderAfterCreation(app, exchanges)` in adapter.ts that both adapter.ts AND handlers.ts callback handler call after handleInboundMessage returns.
  </behavior>
  <action>
    **Decision recap:** intake.ts NOT edited in this wave. All DRIVER_ASSIGNED + notification wiring lives in adapter.ts + handlers.ts after `handleInboundMessage` returns.

    1. **Add ORDER_TRANSITIONS update for driver decline** in `apps/api/src/pipeline/lifecycle/order-fsm.ts`:
       Find ORDER_TRANSITIONS table; add `CLOSED` to `DRIVER_ASSIGNED`'s allowed list:
       ```typescript
       DRIVER_ASSIGNED: ['AT_LOADING', 'CLOSED'],  // Phase 3 D-19 / RESEARCH Pitfall #5: decline path
       ```
       Document the deviation in a comment: `// CLOSED added 2026-06-10 (Phase 3) for driver_decline path — Pitfall #5 simplification.`

    2. **Add helper in adapter.ts** — Append at the bottom:
       ```typescript
       // Phase 3 D-17 — after handleInboundMessage returns with createOrder in exchanges,
       // schedule order→DRIVER_ASSIGNED + dual notify (driver + client). All POST-tx.
       export async function tryAdvanceOrderAfterCreation(
         app: FastifyInstance,
         exchanges: InboundMessageExchange[]
       ): Promise<void> {
         const createOrderEx = exchanges.find(
           (e) => e.role === 'tool' && typeof e.content === 'object' && e.content !== null && (e.content as { name?: string }).name === 'createOrder'
         );
         if (!createOrderEx) return;
         const content = createOrderEx.content as { result?: { order_id?: string } };
         const orderId = content.result?.order_id;
         if (!orderId) return;

         try {
           const { transitionOrder } = await import('../../pipeline/lifecycle/order-fsm.js');
           const { notifyDriver, notifyClient } = await import('./notifications.js');
           await transitionOrder(app.db, {
             orderId,
             to: 'DRIVER_ASSIGNED',
             actor: 'ai',
             payload: { auto_assign: true },
             onSuccess: async () => {
               if (!app.bot) return;
               await Promise.allSettled([
                 notifyDriver({ orderId, db: app.db, bot: app.bot, log: app.log }),
                 notifyClient({ orderId, transition: 'DRIVER_ASSIGNED', db: app.db, bot: app.bot, log: app.log }),
               ]);
             },
           });
         } catch (err) {
           app.log.warn({ err, orderId }, 'tryAdvanceOrderAfterCreation failed (non-fatal)');
         }
       }
       ```
       Import `InboundMessageExchange` type from intake.js. Add to existing imports at top of adapter.ts.

    3. **adapter.ts processTelegramUpdate** — After the existing exchange-rendering loop, add:
       ```typescript
       await tryAdvanceOrderAfterCreation(app, result.exchanges);
       ```

    4. **handlers.ts** — Add inside the existing `bot.callbackQuery(/^(confirm|reject|change):(.+)$/, ...)` handler, AFTER the exchanges loop:
       ```typescript
       // After confirm callback, if intake created an order via STEP D-pre,
       // advance to DRIVER_ASSIGNED + notify.
       await tryAdvanceOrderAfterCreation(app, result.exchanges);
       ```
       Add import: `import { tryAdvanceOrderAfterCreation } from './adapter.js';`

    5. **handlers.ts** — ADD driver callback handler at the END:
       ```typescript
       // Driver-side callbacks (TG-05). driver_accept / driver_decline.
       bot.callbackQuery(/^(driver_accept|driver_decline):(.+)$/, async (ctx) => {
         const action = ctx.match[1] as 'driver_accept' | 'driver_decline';
         const orderId = ctx.match[2];

         await ctx.answerCallbackQuery();
         await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {});

         if (action === 'driver_accept') {
           app.log.info({ orderId, driverTgId: ctx.from?.id }, 'telegram: driver accepted');
           await ctx.reply('✅ Принято. Удачной поездки!');
           return;
         }

         // driver_decline → order→CLOSED + lead→LOST (RESEARCH Pitfall #5 / Open Question §3).
         try {
           const { transitionOrder } = await import('../../pipeline/lifecycle/order-fsm.js');
           const { transitionLead } = await import('../../pipeline/lifecycle/lead-fsm.js');
           const { sql } = await import('drizzle-orm');

           await transitionOrder(app.db, {
             orderId,
             to: 'CLOSED',
             actor: 'system',
             payload: { driver_declined: true, driver_tg_id: ctx.from?.id ?? null },
           });

           // Lookup the lead via order.
           const rows = await app.db.execute(sql`SELECT lead_id FROM orders WHERE id = ${orderId}`);
           const leadRow = rows.rows[0] as { lead_id: string | null } | undefined;
           if (leadRow?.lead_id) {
             await transitionLead(app.db, {
               leadId: leadRow.lead_id,
               to: 'LOST',
               actor: 'system',
               payload: { reason: 'driver_declined', order_id: orderId },
             });
           }
         } catch (err) {
           app.log.error({ err, orderId }, 'telegram: decline transition failed');
         }
         await ctx.reply('Отказ зарегистрирован. Спасибо за обратную связь.');
       });
       ```

    Lookup verification: `orders.lead_id` column may not exist if Phase 1 schema places the FK on `leads.order_id` instead. Read `apps/api/src/persistence/schema/orders.ts` to confirm. If FK is on `leads.order_id`, change the lookup query to:
    ```sql
    SELECT id FROM leads WHERE order_id = ${orderId}
    ```
    Use whichever direction Phase 1 implemented. Per STATE.md notes: "orders.lead_id is a bare uuid (no .references() callback). leads.order_id carries the FK constraint instead". So query is `SELECT id FROM leads WHERE order_id = ${orderId}` returning `{id}`.

    The lookup itself is just for the lead id — use that. Update the code accordingly.

    DO NOT edit intake.ts in this task. Decision recap: all DRIVER_ASSIGNED + notify wiring lives in adapter.ts helper, called from both adapter.ts and handlers.ts confirm callback after handleInboundMessage returns.
  </action>
  <verify>
    <automated>grep -q "driver_accept" apps/api/src/channels/telegram/handlers.ts && grep -q "tryAdvanceOrderAfterCreation" apps/api/src/channels/telegram/adapter.ts && grep -q "tryAdvanceOrderAfterCreation" apps/api/src/channels/telegram/handlers.ts && grep -q "driver_declined" apps/api/src/channels/telegram/handlers.ts && grep -q "CLOSED" apps/api/src/pipeline/lifecycle/order-fsm.ts && grep -E "DRIVER_ASSIGNED:.*CLOSED" apps/api/src/pipeline/lifecycle/order-fsm.ts && pnpm --filter @ai-logist/api typecheck 2>&1 | tail -5 && pnpm --filter @ai-logist/api vitest run tests/integration/pipeline-canonical.test.ts 2>&1 | tail -10</automated>
  </verify>
  <done>
    ORDER_TRANSITIONS adds CLOSED to DRIVER_ASSIGNED's allowed list with deviation comment; adapter.ts ships tryAdvanceOrderAfterCreation helper; handlers.ts confirm callback invokes helper after handleInboundMessage; driver callback handler ships full decline flow (order→CLOSED + lead→LOST); pipeline-canonical still passes.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Flip driver-confirmation + client-notifications integration tests + 2 stubs</name>
  <files>
    apps/api/tests/integration/driver-confirmation.test.ts,
    apps/api/tests/integration/client-notifications.test.ts,
    apps/api/tests/unit/phase-3-stubs.test.ts
  </files>
  <behavior>
    - driver-confirmation.test.ts: 2 cases — (a) driver_telegram_id present on truck → notifyDriver invocation results in mock.bot.api.sendMessage call with driverKeyboard reply_markup; (b) driver_telegram_id null → no sendMessage; log warn captured (use pino mock or pino's silent sink + log inspection).
    - client-notifications.test.ts: 2 cases — (a) transitionOrder(orderId, 'DRIVER_ASSIGNED', onSuccess: () => notifyClient(...)) → mock.bot recorded sendMessage with i18n template text matching client.lang; (b) client.telegram_id null → no sendMessage.
    - phase-3-stubs.test.ts: TG-05 + TG-07 flipped → 1 todo remains (TG-06).
  </behavior>
  <action>
    1. **driver-confirmation.test.ts** — Real impl using mock bot + seeded order/truck/client:
       ```typescript
       it('driver_telegram_id present → bot.api.sendMessage called with driverKeyboard', async () => {
         // Insert seeded truck with driver_telegram_id='123456789' + order in CREATED + client.
         // Call notifyDriver directly.
         // Assert: mock.sent has 1 entry with chatId='123456789', text contains '🚚', reply_markup is an InlineKeyboard.
       });
       it('driver_telegram_id null → log warn + no sendMessage', async () => {
         // Seed truck with driver_telegram_id=null.
         // Call notifyDriver.
         // Assert: mock.sent.length unchanged.
       });
       ```
       Use existing testcontainers setup + seed inline. Mock bot wired into app via direct assignment.

    2. **client-notifications.test.ts** — Real impl:
       ```typescript
       it('transitionOrder DRIVER_ASSIGNED → notifyClient with i18n RU template', async () => {
         // Seed order + client with telegram_id + lang='ru'.
         // Call transitionOrder(db, {orderId, to: 'DRIVER_ASSIGNED', actor: 'ai', onSuccess: async () => notifyClient(...)});
         // Wait for fire-and-forget (await Promise.resolve / setImmediate flush).
         // Assert: mock.sent[N].text includes 'Машина назначена' AND order number.
       });
       it('client without telegram_id → notifyClient skips silently', async () => {
         // Seed order + client with telegram_id=null.
         // Call notifyClient directly.
         // Assert: mock.sent.length unchanged.
       });
       ```

    3. **phase-3-stubs.test.ts** — Flip TG-05 + TG-07 to it():
       ```typescript
       it('TG-05: driver receives Принять/Отказаться buttons; missing telegram_id falls to stub', () => {
         // Covered by driver-confirmation.test.ts (2 cases).
         expect(true).toBe(true);
       });
       it('TG-07: order FSM transition triggers notifyClient with i18n RU/UA template', () => {
         // Covered by client-notifications.test.ts.
         expect(true).toBe(true);
       });
       ```
       Verify `grep -c "test.todo" apps/api/tests/unit/phase-3-stubs.test.ts` = 1 after.
  </action>
  <verify>
    <automated>[ "$(grep -c "test.todo" apps/api/tests/unit/phase-3-stubs.test.ts)" -eq 1 ] && grep -q "driverKeyboard\|notifyDriver" apps/api/tests/integration/driver-confirmation.test.ts && grep -q "notifyClient" apps/api/tests/integration/client-notifications.test.ts && pnpm --filter @ai-logist/api typecheck 2>&1 | tail -5 && pnpm --filter @ai-logist/api vitest run tests/unit/phase-3-stubs.test.ts 2>&1 | grep -qE "(8 passed|1 todo)"</automated>
  </verify>
  <done>
    driver-confirmation + client-notifications tests assert mock bot interactions in both telegram_id present + null paths; phase-3-stubs has exactly 1 todo (TG-06); biome + tsc clean.
  </done>
</task>

</tasks>

<verification>
- typecheck: `pnpm --filter @ai-logist/api typecheck` exit 0
- unit suite: `pnpm --filter @ai-logist/api test:unit` exit 0 with 8 passing + 1 todo for Phase 3
- biome clean
- Phase 2 fsm tests still pass: `pnpm --filter @ai-logist/api vitest run tests/integration/fsm-concurrency.test.ts tests/integration/fsm-events-audit.test.ts tests/unit/order-fsm.test.ts` exit 0
- intake.ts unchanged from Wave 3: `git diff apps/api/src/pipeline/intake.ts` shows ONLY Wave 3's additions
- ORDER_TRANSITIONS includes new DRIVER_ASSIGNED→CLOSED edge with deviation comment
</verification>

<success_criteria>
1. notifications.ts ships notifyDriver + notifyClient per RESEARCH Code Blocks 7+8
2. i18n.ts has renderNotificationTemplate for 3 transitions × 2 langs
3. order-fsm.ts onSuccess hook fires AFTER db.transaction with .catch error swallow
4. ORDER_TRANSITIONS allows DRIVER_ASSIGNED→CLOSED (driver decline path) with documented deviation
5. adapter.ts tryAdvanceOrderAfterCreation helper detects createOrder in exchanges + fires transitionOrder→DRIVER_ASSIGNED with notify hooks
6. handlers.ts driver callback regex + decline FSM flow + invokes tryAdvance helper from confirm callback
7. intake.ts NOT modified in this wave (zero diff vs Wave 3)
8. 2 integration tests + 2 stub todos flipped (3 → 1 todo remains: TG-06)
</success_criteria>

<output>
After completion, create `.planning/phases/03-telegram-channel/03-04-SUMMARY.md` recording: exact deviation note in ORDER_TRANSITIONS (and impact on order-fsm.test.ts — must NOT regress), whether the FSM's STATUS_TO_EVENT got an updated entry (CLOSED is null → no audit event for the decline-path CLOSED — confirm tests still expect this), the dynamic-import pattern used in handlers.ts (whether to keep or refactor to top-level imports for clarity), how the mock bot was injected into transitionOrder's onSuccess closure during tests (it's not transitionOrder's responsibility — the test wraps the onSuccess), and the final exchanges[] shape that tryAdvanceOrderAfterCreation parses (the Phase 2 createOrder tool exchange shape).
</output>
