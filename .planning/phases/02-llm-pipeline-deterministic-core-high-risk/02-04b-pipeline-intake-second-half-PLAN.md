---
phase: 02-llm-pipeline-deterministic-core-high-risk
plan: 04b
type: execute
wave: 5
depends_on:
  - "02-04a"
files_modified:
  - apps/api/src/pipeline/intake.ts
  - apps/api/src/pipeline/follow-up-scheduler.ts
  - apps/api/src/app.ts
  - apps/api/src/plugins/db.ts
  - apps/api/tests/integration/pipeline-canonical.test.ts
  - apps/api/tests/integration/advisory-lock.test.ts
  - apps/api/tests/integration/follow-up-scheduler.test.ts
  - apps/api/tests/unit/phase-2-stubs.test.ts
autonomous: true
requirements:
  - MATCH-06
  - FSM-04
  - FSM-06

must_haves:
  truths:
    - "intake.ts is now FULL pipeline: Step 0 + A + B + C + D + E + F (from 02-04a) → G (match) → H (price-lock) → I (templated reply with priceGuard) → confirmation shortcut on subsequent QUOTED message → J (createOrder + transitionLead chain to ORDER_CREATED)."
    - "MATCH-06 price-lock: leadsRepo.update({quotedPrice: out.default}) BEFORE buildReply. Re-fetch via leadsRepo.findById to read quoted_price from DB. priceGuard verifies the templated reply numbers match quoted_price + min/max corridor."
    - "Confirmation shortcut: if lead.stage === 'QUOTED' AND text matches CONFIRM_PATTERNS regex (RU/UA confirm words) → transitionLead(QUOTED→AGREED) → createOrderHandler → transitionLead(AGREED→ORDER_CREATED). Re-reads quoted_price from DB inside createOrderHandler transaction."
    - "follow-up-scheduler.ts exports registerFollowUpScheduler(app) AND followUpTick(app) (separately for testability). POLL_INTERVAL_MS=60_000. QUIET_THRESHOLD_MS=4h. STALE_THRESHOLD_MS=24h."
    - "Scheduler skips when NODE_ENV='test' (so vitest doesn't trip the real interval)."
    - "Scheduler lifecycle: setInterval registered on app boot; cleared via app.addHook('onClose', () => clearInterval(handle)) for SIGTERM safety."
    - "follow-up-scheduler.test.ts uses vi.useFakeTimers({ shouldAdvanceTime: true }) + vi.setSystemTime(...) + vi.advanceTimersByTime(POLL_INTERVAL_MS) to drive the scheduler — NOT real time, NOT updated_at = NOW() - INTERVAL '25 hours'."
    - "follow-up-scheduler.test.ts exercises FULL setInterval lifecycle: start scheduler with registerFollowUpScheduler → setSystemTime to 25h after lead.updated_at → advanceTimersByTime(POLL_INTERVAL_MS) → assert followUpTick fired (lead.stage = LOST, lead_events row with payload.reason='no_reply_24h') → assert clearInterval called on app.close()."
    - "advisory-lock.test.ts fires 10 parallel handleInboundMessage calls for same client_id → exactly 1 lead created (advisory lock serializes the find-or-create), all 10 messages persisted in order."
    - "pipeline-canonical.test.ts: 'Киев-Львов 18 тонн тент' → after first message lead in QUOTED with quotedPrice set; after 'да' message lead in ORDER_CREATED, order in CREATED with public_token + number."
    - "Plan 02-04b flips FSM-04 (advisory lock) + FSM-06 (scheduler) todos. No file overlap: 02-04a flipped LOGIC-03/04; this plan owns FSM-04/06; 02-05 owns API-07."
  artifacts:
    - path: "apps/api/src/pipeline/intake.ts"
      provides: "handleInboundMessage entry point — FULL pipeline (Steps 0 → J)"
      contains: "createOrderHandler|quotedPrice|priceGuard"
    - path: "apps/api/src/pipeline/follow-up-scheduler.ts"
      provides: "setInterval-based follow-up + registerFollowUpScheduler + followUpTick (testable)"
      contains: "registerFollowUpScheduler"
  key_links:
    - from: "src/pipeline/intake.ts"
      to: "leads.quoted_price"
      via: "leadsRepo.update({quotedPrice: defaultKop}) BEFORE buildReply"
      pattern: "quotedPrice|quoted_price"
    - from: "src/pipeline/intake.ts"
      to: "createOrderHandler"
      via: "Confirmation shortcut transitionLead chain"
      pattern: "createOrderHandler|createOrder"
    - from: "src/app.ts"
      to: "src/pipeline/follow-up-scheduler.ts"
      via: "registerFollowUpScheduler(app) call"
      pattern: "registerFollowUpScheduler"
    - from: "tests/integration/follow-up-scheduler.test.ts"
      to: "vi.useFakeTimers"
      via: "Fake timers + setSystemTime + advanceTimersByTime"
      pattern: "useFakeTimers|advanceTimersByTime|setSystemTime"
---

<objective>
Wave 4 — extend `apps/api/src/pipeline/intake.ts` with Steps G + H + I + J (match → price-lock → templated reply → confirm → create-order chain), plus ship `follow-up-scheduler.ts` with proper fake-timers test.

Purpose:
- Closes Pitfall #1 (LLM in money path via createOrder DB re-read).
- Closes MATCH-06 (price-lock protocol: write quoted_price BEFORE reply; priceGuard defends future LLM injection).
- Closes FSM-04 (advisory lock proven via 10-parallel test).
- Closes FSM-06 (follow-up scheduler driven by fake timers — proves the setInterval lifecycle works).
- Includes the full canonical scenario E2E test ('Киев-Львов 18 тонн тент' → ORDER_CREATED).

Output: extended intake.ts (now full pipeline), follow-up-scheduler.ts, app.ts wiring, 3 integration tests (canonical, advisory-lock, follow-up-scheduler with fake timers), 2 todos flipped (FSM-04, FSM-06).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-CONTEXT.md
@.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-RESEARCH.md
@.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-VALIDATION.md
@.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-02-SUMMARY.md
@.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-03-SUMMARY.md
@.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-04a-SUMMARY.md
@apps/api/src/lib/routing.ts
@apps/api/src/lib/price-guard.ts
@apps/api/src/lib/money.ts
@apps/api/src/pipeline/intake.ts
@apps/api/src/pipeline/llm-tools/nearest-truck.ts
@apps/api/src/pipeline/llm-tools/calc-price.ts
@apps/api/src/pipeline/llm-tools/create-order.ts
@apps/api/src/pipeline/lifecycle/lead-fsm.ts
@apps/api/src/persistence/repos/leads.ts
@apps/api/src/persistence/repos/messages.ts
@apps/api/src/app.ts

<interfaces>
<!-- Plan 02-04a left intake.ts with this signature (we EXTEND, not replace). -->

handleInboundMessage signature (UNCHANGED from 02-04a):
```typescript
export async function handleInboundMessage(args: {
  db: Db;
  llm: LlmProvider;
  log?: FastifyBaseLogger;
  clientId: string;
  text: string;
  channel: string;
}): Promise<{ leadId: string; exchanges: Array<{ role: 'user'|'assistant'|'tool'; content: unknown }> }>;
```

State at start of Plan 02-04b (after 02-04a Steps 0-F):
- `lead` exists (NEW or open) with fromCityId + toCityId + tons + bodyType populated.
- `extracted` ExtractRequestOutput available.
- `fromCity`, `toCity` resolved with {id, lonLat}.
- `lang: Lang` decided.
- Reply at this point in 02-04a is "Подбираю машину…" placeholder — REPLACE with real match + price-lock + reply.

Wave 2a tool functions:
```typescript
nearestTruck(db, {pickupLon, pickupLat, tons, bodyType}): Promise<NearestTruckRow[]>
calcPrice(input, cfg): { default: bigint; min: bigint; max: bigint; breakdown }
readPricingConfig(db): Promise<PricingConfig>
createOrderHandler(ctx, {lead_id, confirmed: true}): Promise<CreateOrderResult>  // re-reads quoted_price from DB
```

Wave 1 lib primitives:
```typescript
routeKm(from, to, log): Promise<{route_km, eta_sec, source}>
formatPriceKop(kopecks, lang): string
priceGuard({llmText, quotedPriceKop, minKop, maxKop}): {ok, badNumbers?}
```

Wave 2b FSM:
```typescript
transitionLead(db, {leadId, to, actor, payload?}): Promise<{from, to, version}>
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: intake.ts extend — nearestTruck call + calcPrice + price-lock + priceGuard + transitionLead chain to QUOTED</name>
  <files>apps/api/src/pipeline/intake.ts</files>
  <behavior>
    - Replace the 02-04a Step F end placeholder ("Подбираю машину…") with Steps G + H + I (match → price-lock → templated reply).
    - Step G — Match (MATCH-01): transitionLead(NEW→QUALIFIED, actor:'ai', payload:{extracted:true}). nearestTruck(tx, {pickupLon, pickupLat, tons, bodyType}). If 0 rows → transitionLead(→LOST, payload:{reason:'no_trucks'}) + sorry reply.
    - Persist best truck via leadsRepo.update({matchedTruckId: best.source === 'own-fleet' ? best.id : null}). transitionLead(QUALIFIED→MATCHED, actor:'ai', payload:{trucks_found, best_id, source}).
    - Step H — Route + Price + Price-lock (MATCH-03/04/05/06):
      1. routeKm(fromCity.lonLat, toCity.lonLat, log).
      2. cfg = readPricingConfig(tx). out = calcPrice({route_km, tons, bodyType, date: new Date(), direction:'default'}, cfg).
      3. **PRICE-LOCK STEP (MATCH-06)**: leadsRepo.update(tx, leadId, {quotedPrice: out.default}). MUST COMPLETE BEFORE next step.
      4. transitionLead(MATCHED→QUOTED, actor:'ai', payload:{quoted_price: out.default.toString(), min: out.min.toString(), max: out.max.toString(), route_km, route_source}).
      5. Re-fetch lead, read quoted_price from DB (paranoia — never trust in-memory).
      6. Build reply by template: `"Цена за рейс: ${formatPriceKop(quotedPrice, lang)} ₽. Подтверждаете?"` (RU) or UA equivalent.
      7. priceGuard(reply, quotedPriceKop, minKop, maxKop). If !ok → log warning (templated reply passes by construction; defends future LLM-drafted numbers).
      8. messagesRepo.create({clientId, leadId, role:'ai', text: reply}).
      9. exchanges.push({role: 'tool', content: {name: 'calcPrice', result: {default: out.default.toString()}}}); exchanges.push({role: 'assistant', content: reply}); return.
  </behavior>
  <read_first>
    - apps/api/src/pipeline/intake.ts (02-04a output — extend AFTER Step F city-resolve block)
    - apps/api/src/pipeline/llm-tools/nearest-truck.ts (Wave 2a — nearestTruck signature)
    - apps/api/src/pipeline/llm-tools/calc-price.ts (Wave 2a — calcPrice + readPricingConfig)
    - apps/api/src/lib/routing.ts (Wave 1 — routeKm)
    - apps/api/src/lib/price-guard.ts (Wave 1 — priceGuard)
    - apps/api/src/lib/money.ts (Wave 1 — formatPriceKop)
    - apps/api/src/persistence/repos/leads.ts (leadsRepo.update for quoted_price + findById)
  </read_first>
  <action>
    Open `apps/api/src/pipeline/intake.ts`. Add imports if not already present from 02-04a:
    ```ts
    import { formatPriceKop } from '../lib/money.js';
    import { priceGuard } from '../lib/price-guard.js';
    import { routeKm } from '../lib/routing.js';
    import { nearestTruck } from './llm-tools/nearest-truck.js';
    import { calcPrice, readPricingConfig } from './llm-tools/calc-price.js';
    ```

    Replace the 02-04a end placeholder block:
    ```ts
    // (02-04a placeholder removed)
    // Placeholder — Plan 02-04b extends with match + price-lock + confirm.
    // const placeholder = lang === 'ua' ? 'Обчислюю ціну…' : 'Подбираю машину…';
    // ...
    ```

    With:
    ```ts
    // STEP G — Match (MATCH-01).
    await transitionLead(tx as Db, { leadId: lead.id, to: 'QUALIFIED', actor: 'ai', payload: { extracted: true } });
    const trucks = await nearestTruck(tx as Db, {
      pickupLon: fromCity.lonLat.lon, pickupLat: fromCity.lonLat.lat,
      tons: extracted.tons!, bodyType: extracted.body_type,
    });
    if (trucks.length === 0) {
      await transitionLead(tx as Db, { leadId: lead.id, to: 'LOST', actor: 'system', payload: { reason: 'no_trucks' } });
      const reply = lang === 'ua' ? 'Машин немає.' : 'Машин нет.';
      await messagesRepo.create(tx as Db, { clientId: args.clientId, leadId: lead.id, role: 'ai', text: reply });
      exchanges.push({ role: 'assistant', content: reply });
      return { leadId: lead.id, exchanges };
    }
    const best = trucks[0];
    await leadsRepo.update(tx as Db, lead.id, { matchedTruckId: best.source === 'own-fleet' ? best.id : null });
    await transitionLead(tx as Db, { leadId: lead.id, to: 'MATCHED', actor: 'ai', payload: { trucks_found: trucks.length, best_id: best.id, source: best.source } });

    // STEP H — Route + Price (MATCH-03/04/05).
    const { route_km, source: routeSource } = await routeKm(fromCity.lonLat, toCity.lonLat, args.log);
    const cfg = await readPricingConfig(tx as Db);
    const priceOut = calcPrice({ route_km, tons: extracted.tons!, bodyType: extracted.body_type ?? 'tent', date: new Date(), direction: 'default' }, cfg);

    // STEP I — PRICE-LOCK (MATCH-06): write FIRST, read SECOND, render THIRD.
    await leadsRepo.update(tx as Db, lead.id, { quotedPrice: priceOut.default });
    await transitionLead(tx as Db, { leadId: lead.id, to: 'QUOTED', actor: 'ai', payload: {
      quoted_price: priceOut.default.toString(), min: priceOut.min.toString(), max: priceOut.max.toString(),
      route_km, route_source: routeSource,
    }});
    const refreshed = await leadsRepo.findById(tx as Db, lead.id);
    if (!refreshed?.quotedPrice) throw new Error('price-lock: quoted_price missing after write');
    const quotedPriceKop = BigInt(refreshed.quotedPrice as unknown as string);
    const priceStr = formatPriceKop(quotedPriceKop, lang);
    const reply = lang === 'ua' ? `Ціна за рейс: ${priceStr} ₽. Підтверджуєте?` : `Цена за рейс: ${priceStr} ₽. Подтверждаете?`;

    // Defensive guard: priceGuard against templated reply (passes by construction; defends future LLM injection).
    const guard = priceGuard({ llmText: reply, quotedPriceKop, minKop: priceOut.min, maxKop: priceOut.max });
    if (!guard.ok) {
      args.log?.warn({ leadId: lead.id, badNumbers: guard.badNumbers }, 'price-guard: anomaly in templated reply');
    }
    await messagesRepo.create(tx as Db, { clientId: args.clientId, leadId: lead.id, role: 'ai', text: reply });
    exchanges.push({ role: 'tool', content: { name: 'calcPrice', result: { default: priceOut.default.toString() } } });
    exchanges.push({ role: 'assistant', content: reply });
    return { leadId: lead.id, exchanges };
    ```

    Verify by running typecheck + biome. No external file modifications.
  </action>
  <verify>
    <automated>cd apps/api && grep -q "leadsRepo.update.*quotedPrice" src/pipeline/intake.ts && grep -q "priceGuard" src/pipeline/intake.ts && grep -q "nearestTruck.*pickupLon" src/pipeline/intake.ts && grep -q "calcPrice" src/pipeline/intake.ts && grep -q "transitionLead.*QUOTED" src/pipeline/intake.ts && grep -q "formatPriceKop" src/pipeline/intake.ts && grep -q "no_trucks" src/pipeline/intake.ts && pnpm --filter @ai-logist/api typecheck 2>&1 | tail -10</automated>
  </verify>
  <done>
    intake.ts extended with Steps G + H + I; price-lock enforced (leadsRepo.update before reply); priceGuard wired defensively; transitionLead chain NEW→QUALIFIED→MATCHED→QUOTED runs; tsc + biome pass.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: intake.ts confirmation shortcut + createOrder + transitionLead chain to ORDER_CREATED + pipeline-canonical test</name>
  <files>apps/api/src/pipeline/intake.ts, apps/api/tests/integration/pipeline-canonical.test.ts</files>
  <behavior>
    - Add confirmation shortcut at the TOP of intake.ts after Step C (token budget check) and BEFORE Step D (extract):
      ```ts
      const CONFIRM_PATTERNS = /\b(да|ок|подтверждаю|согласен|так|погоджуюсь|підтверджую)\b/iu;
      ```
    - If lead.stage === 'QUOTED' AND CONFIRM_PATTERNS.test(text):
      1. transitionLead(QUOTED→AGREED, actor:'ai', payload:{confirm_text: text}).
      2. ctx = {db: tx, log, llm, leadId, clientId, clientLang: lang}.
      3. order = await createOrderHandler(ctx, {lead_id: leadId, confirmed: true}). createOrderHandler re-reads quoted_price from DB inside transaction (D-06).
      4. transitionLead(AGREED→ORDER_CREATED, actor:'ai', payload:{order_id, order_number}).
      5. Build templated reply with order_number + public_token.
      6. messagesRepo.create({clientId, leadId, role:'ai', text: reply}).
      7. exchanges.push({role:'tool', content:{name:'createOrder', result: order}}); exchanges.push({role:'assistant', content: reply}); return.
    - Skip Steps D-I if confirmation shortcut triggers.
    - pipeline-canonical.test.ts: full E2E canon-01 scenario:
      1. First message "Киев-Львов 18 тонн тент, нужно завтра" → lead in QUOTED with quotedPrice set.
      2. Second message "да" → lead in ORDER_CREATED, order in CREATED with public_token + number.
      3. Verify lead_events shows QUOTED event with payload.quoted_price BEFORE the assistant reply (price-lock proof at audit-log level).
  </behavior>
  <read_first>
    - apps/api/src/pipeline/intake.ts (Task 1 output to extend)
    - apps/api/src/pipeline/llm-tools/create-order.ts (Wave 2a — createOrderHandler signature)
    - apps/api/tests/fixtures/canonical-inputs.json (canon-01)
    - apps/api/tests/_helpers/dialog-harness.ts (02-04a static import — runScript)
    - apps/api/tests/_helpers/mock-anthropic.ts (MockAnthropicClient)
  </read_first>
  <action>
    **(a) intake.ts** — Add `CONFIRM_PATTERNS` constant + imports + confirmation block AFTER Step C and BEFORE Step D.

    Add imports if not yet present:
    ```ts
    import { createOrderHandler } from './llm-tools/create-order.js';
    import type { ToolContext } from './llm-tools/index.js';
    ```

    Add the constant near the top (next to RU_BOILERPLATE_SHORT):
    ```ts
    const CONFIRM_PATTERNS = /\b(да|ок|подтверждаю|согласен|так|погоджуюсь|підтверджую)\b/iu;
    ```

    Insert this block AFTER Step C (token budget check) and BEFORE Step D (extract):
    ```ts
    // STEP D-pre — Confirmation shortcut: if lead in QUOTED and client confirms → AGREED → ORDER.
    if (lead.stage === 'QUOTED' && CONFIRM_PATTERNS.test(args.text)) {
      await transitionLead(tx as Db, { leadId: lead.id, to: 'AGREED', actor: 'ai', payload: { confirm_text: args.text } });
      const ctx: ToolContext = {
        db: tx as Db, log: args.log ?? noopLogger(), llm: args.llm,
        leadId: lead.id, clientId: args.clientId, clientLang: lang,
      };
      const order = await createOrderHandler(ctx, { lead_id: lead.id, confirmed: true });
      await transitionLead(tx as Db, { leadId: lead.id, to: 'ORDER_CREATED', actor: 'ai', payload: { order_id: order.order_id, order_number: order.order_number } });
      const reply = lang === 'ua'
        ? `Замовлення ${order.order_number} створено. Стеження: /track/${order.public_token}`
        : `Заказ ${order.order_number} создан. Отслеживание: /track/${order.public_token}`;
      await messagesRepo.create(tx as Db, { clientId: args.clientId, leadId: lead.id, role: 'ai', text: reply });
      exchanges.push({ role: 'tool', content: { name: 'createOrder', result: order } });
      exchanges.push({ role: 'assistant', content: reply });
      return { leadId: lead.id, exchanges };
    }
    ```

    Add the helper `noopLogger` (if not already present):
    ```ts
    function noopLogger(): FastifyBaseLogger {
      const fn = () => {};
      // @ts-expect-error minimal logger for off-Fastify callers
      return { info: fn, warn: fn, error: fn, debug: fn, trace: fn, fatal: fn, level: 'silent', child: () => noopLogger(), bindings: () => ({}), silent: fn };
    }
    ```

    **(b) apps/api/tests/integration/pipeline-canonical.test.ts** — canonical scenario:
    ```ts
    import { describe, it, expect, beforeAll, afterAll } from 'vitest';
    import { sql } from 'drizzle-orm';
    import { runScript } from '../_helpers/dialog-harness.js';
    import { MockAnthropicClient } from '../_helpers/mock-anthropic.js';
    import { startPostgisContainer, stopPostgisContainer, getTestDb } from '../_helpers/test-db.js';

    describe('Pipeline canonical: "Киев-Львов 18 тонн тент" → ORDER_CREATED', () => {
      let db: any; let clientId: string;
      beforeAll(async () => {
        await startPostgisContainer();
        db = await getTestDb();
        await import('../../src/seed/run.js').then((m) => m.seed(db));
        const c = await db.execute(sql`SELECT id FROM clients LIMIT 1`);
        clientId = (c.rows[0] as { id: string }).id;
      }, 90_000);
      afterAll(async () => { await stopPostgisContainer(); });

      it('reaches ORDER_CREATED with quoted_price written BEFORE reply (success criterion #1)', async () => {
        const llm = new MockAnthropicClient();
        const result = await runScript(db, llm, clientId, [
          { from: 'client', text: 'Киев-Львов 18 тонн тент, нужно завтра' },
          { from: 'client', text: 'да' },
        ]);
        expect(result.finalLead.stage).toBe('ORDER_CREATED');
        expect(result.finalLead.quotedPrice).toBeTruthy();
        expect(result.finalOrder?.status).toBe('CREATED');
        expect(result.finalOrder?.price).toBeTruthy();
        // Verify price-lock at audit-log level: QUOTED event with payload.quoted_price exists.
        const events = await db.execute(sql`SELECT to_stage, payload, created_at FROM lead_events WHERE lead_id = ${result.finalLead.id} ORDER BY created_at ASC`);
        const quotedEvent = (events.rows as Array<{ to_stage: string; payload: { quoted_price: string }; created_at: string }>).find((e) => e.to_stage === 'QUOTED');
        expect(quotedEvent).toBeDefined();
        expect(quotedEvent!.payload.quoted_price).toMatch(/^\d+$/);
      }, 60_000);
    });
    ```
  </action>
  <verify>
    <automated>cd apps/api && grep -q "CONFIRM_PATTERNS" src/pipeline/intake.ts && grep -q "createOrderHandler" src/pipeline/intake.ts && grep -q "transitionLead.*ORDER_CREATED" src/pipeline/intake.ts && grep -q "track" src/pipeline/intake.ts && test -f tests/integration/pipeline-canonical.test.ts && grep -q "ORDER_CREATED" tests/integration/pipeline-canonical.test.ts && grep -q "quoted_price" tests/integration/pipeline-canonical.test.ts && pnpm --filter @ai-logist/api typecheck 2>&1 | tail -10</automated>
  </verify>
  <done>
    intake.ts has confirmation shortcut → AGREED → createOrder → ORDER_CREATED chain; pipeline-canonical test asserts QUOTED + ORDER_CREATED transitions + price-lock audit; tsc passes.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: follow-up-scheduler.ts with FAKE TIMERS test + advisory-lock integration test + app.ts wiring + flip FSM-04/FSM-06 todos</name>
  <files>apps/api/src/pipeline/follow-up-scheduler.ts, apps/api/src/app.ts, apps/api/src/plugins/db.ts, apps/api/tests/integration/follow-up-scheduler.test.ts, apps/api/tests/integration/advisory-lock.test.ts, apps/api/tests/unit/phase-2-stubs.test.ts</files>
  <behavior>
    - follow-up-scheduler.ts: paste RESEARCH.md §14 base + export tick separately. POLL_INTERVAL_MS=60_000, QUIET_THRESHOLD_MS=4*60*60*1000 (4h), STALE_THRESHOLD_MS=24*60*60*1000 (24h).
    - Skips when NODE_ENV='test' (so non-fake-timer tests don't trip it).
    - registerFollowUpScheduler(app) attaches onClose hook that clears the interval (lifecycle proof for FSM-06).
    - app.ts gains `registerFollowUpScheduler(app)` after route plugins.
    - **CRITICAL (per CHECKER WARNING #5): follow-up-scheduler.test.ts uses FAKE TIMERS (vi.useFakeTimers + setSystemTime + advanceTimersByTime) — NOT `updated_at = NOW() - INTERVAL '25 hours'`. The test exercises the FULL setInterval lifecycle:**
      1. Insert lead in QUOTED with updated_at = current frozen time.
      2. Start scheduler via registerFollowUpScheduler(app) (in NODE_ENV='production' mode).
      3. vi.setSystemTime(25 hours in the future).
      4. vi.advanceTimersByTime(POLL_INTERVAL_MS) → setInterval callback fires → followUpTick scans, finds the stale lead, transitionLead(→LOST).
      5. Assert lead.stage='LOST', lead_events row with payload.reason='no_reply_24h'.
      6. Trigger app.close() → assert clearInterval was called (verifiable by setting up a second time advance after close and asserting NO further tick).
    - Advisory-lock test: 10 parallel handleInboundMessage calls for same client_id → exactly 1 lead created (advisory lock serializes find-or-create), all 10 client messages persisted in order.
    - Flip FSM-04 + FSM-06 todos.
  </behavior>
  <read_first>
    - .planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-RESEARCH.md §14 (scheduler VERBATIM)
    - .planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-CONTEXT.md D-31
    - apps/api/src/app.ts (Phase 1 buildApp shape)
    - apps/api/src/plugins/db.ts (Phase 1 db plugin shape — does `app.db` exist? scheduler reads `app.db`)
    - apps/api/tests/_helpers/fake-timers.ts (Wave 0 — FIXED_NOW + setup)
    - apps/api/tests/_helpers/test-db.ts (testcontainers)
  </read_first>
  <action>
    **(a) apps/api/src/pipeline/follow-up-scheduler.ts** — paste from RESEARCH.md §14. Export inner tick function separately for testability:
    ```ts
    import { sql } from 'drizzle-orm';
    import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
    import type { Db } from '../db.js';
    import { transitionLead } from './lifecycle/lead-fsm.js';

    export const POLL_INTERVAL_MS = 60_000;
    export const QUIET_THRESHOLD_MS = 4 * 60 * 60 * 1000;   // 4 hours
    export const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;  // 24 hours

    export interface SchedulerApp {
      db: Db;
      log: FastifyBaseLogger;
      config?: { NODE_ENV?: string };
    }

    export async function followUpTick(app: SchedulerApp): Promise<void> {
      const now = new Date();
      const staleCutoff = new Date(now.getTime() - STALE_THRESHOLD_MS);
      const quietCutoff = new Date(now.getTime() - QUIET_THRESHOLD_MS);

      // Stale: lead in QUOTED|AGREED for > 24h → → LOST.
      const stale = await app.db.execute(sql`
        SELECT id FROM leads
        WHERE stage IN ('QUOTED','AGREED')
          AND updated_at < ${staleCutoff.toISOString()}::timestamptz
      `);
      for (const row of (stale.rows as Array<{ id: string }>)) {
        try {
          await transitionLead(app.db, { leadId: row.id, to: 'LOST', actor: 'system', payload: { reason: 'no_reply_24h' } });
          app.log.info({ leadId: row.id }, 'follow-up: → LOST (no_reply_24h)');
        } catch (e) {
          app.log.warn({ leadId: row.id, err: e }, 'follow-up: transition failed (likely concurrent)');
        }
      }

      // Quiet: lead in QUOTED|AGREED for 4h-24h → emit follow-up event (Phase 4 admin notification).
      const quiet = await app.db.execute(sql`
        SELECT id FROM leads
        WHERE stage IN ('QUOTED','AGREED')
          AND updated_at < ${quietCutoff.toISOString()}::timestamptz
          AND updated_at >= ${staleCutoff.toISOString()}::timestamptz
      `);
      for (const row of (quiet.rows as Array<{ id: string }>)) {
        app.log.info({ leadId: row.id }, 'follow-up: quiet (4h-24h) — notify manager (Phase 4 hook)');
      }
    }

    export function registerFollowUpScheduler(app: FastifyInstance & { config?: { NODE_ENV?: string }; db: Db }): void {
      if (app.config?.NODE_ENV === 'test') return;  // tests use followUpTick directly
      const handle = setInterval(() => {
        void followUpTick({ db: app.db, log: app.log, config: app.config }).catch((e) => {
          app.log.error({ err: e }, 'follow-up.tick_failed');
        });
      }, POLL_INTERVAL_MS);
      app.addHook('onClose', async () => { clearInterval(handle); });
    }
    ```

    **(b) apps/api/src/app.ts** — add at end of buildApp:
    ```ts
    import { registerFollowUpScheduler } from './pipeline/follow-up-scheduler.js';
    // ... after all .register(...) calls:
    registerFollowUpScheduler(app);
    ```

    **(c) apps/api/src/plugins/db.ts** — verify `app.db` decorator exists with type `Db`. If `app.config` doesn't exist (Phase 1 may have used imported `config` directly), adjust the scheduler signature to read `config.NODE_ENV` from the imported `config` module instead. Confirm via Read.

    **(d) apps/api/tests/integration/follow-up-scheduler.test.ts** — FSM-06 with FAKE TIMERS (per checker WARNING #5):
    ```ts
    import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
    import { sql } from 'drizzle-orm';
    import { followUpTick, registerFollowUpScheduler, POLL_INTERVAL_MS } from '../../src/pipeline/follow-up-scheduler.js';
    import { startPostgisContainer, stopPostgisContainer, getTestDb } from '../_helpers/test-db.js';
    import Fastify from 'fastify';

    describe('FSM-06 — auto-follow-up scheduler (fake-timer driven)', () => {
      let db: any;
      let app: any;
      const FROZEN_NOW = new Date('2026-06-09T12:00:00Z');

      beforeAll(async () => {
        await startPostgisContainer();
        db = await getTestDb();
        await import('../../src/seed/run.js').then((m) => m.seed(db));
      }, 90_000);
      afterAll(async () => {
        await stopPostgisContainer();
      });

      beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true, now: FROZEN_NOW });
      });
      afterEach(async () => {
        vi.useRealTimers();
        if (app) await app.close();
      });

      it('FULL lifecycle: lead 25h stale → setInterval tick fires → → LOST → clearInterval on close', async () => {
        const c = await db.execute(sql`SELECT id FROM clients LIMIT 1`);
        const clientId = (c.rows[0] as { id: string }).id;

        // Lead created at FROZEN_NOW; quoted with stage QUOTED.
        const ins = await db.execute(sql`
          INSERT INTO leads (client_id, channel, stage, version, updated_at)
          VALUES (${clientId}, 'test', 'QUOTED', 0, ${FROZEN_NOW.toISOString()}::timestamptz)
          RETURNING id
        `);
        const leadId = (ins.rows[0] as { id: string }).id;

        // Boot Fastify-shaped app with scheduler registered in production mode.
        app = Fastify();
        // @ts-expect-error decorate db + config like Phase 1 plugins
        app.decorate('db', db);
        // @ts-expect-error config decorator (matches plugins/db.ts)
        app.decorate('config', { NODE_ENV: 'production' });
        registerFollowUpScheduler(app as any);

        // Advance system time to 25h after lead.updated_at. lead is now stale.
        vi.setSystemTime(new Date(FROZEN_NOW.getTime() + 25 * 60 * 60 * 1000));

        // Drive one setInterval tick — fires followUpTick.
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

        // Allow async tick body (transitionLead is async) to settle.
        await vi.runOnlyPendingTimersAsync();

        // Assert: lead → LOST with payload.reason.
        const after = await db.execute(sql`SELECT stage FROM leads WHERE id = ${leadId}`);
        expect((after.rows[0] as { stage: string }).stage).toBe('LOST');

        const events = await db.execute(sql`SELECT payload FROM lead_events WHERE lead_id = ${leadId} ORDER BY created_at DESC LIMIT 1`);
        expect((events.rows[0] as { payload: { reason: string } }).payload.reason).toBe('no_reply_24h');

        // Close app — clearInterval should fire. Advance time again; no further tick should run.
        await app.close();
        app = null;
        // Track followUpTick call count via spy. Insert a SECOND stale lead AFTER close, then advance.
        const ins2 = await db.execute(sql`
          INSERT INTO leads (client_id, channel, stage, version, updated_at)
          VALUES (${clientId}, 'test', 'QUOTED', 0, ${new Date(FROZEN_NOW.getTime()).toISOString()}::timestamptz)
          RETURNING id
        `);
        const leadId2 = (ins2.rows[0] as { id: string }).id;
        vi.setSystemTime(new Date(FROZEN_NOW.getTime() + 50 * 60 * 60 * 1000));
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
        const after2 = await db.execute(sql`SELECT stage FROM leads WHERE id = ${leadId2}`);
        // Stage should STILL be QUOTED because the cleared interval doesn't fire.
        expect((after2.rows[0] as { stage: string }).stage).toBe('QUOTED');
      }, 60_000);

      it('followUpTick called directly: lead 5h stale (< 24h) → quiet log, stage unchanged', async () => {
        const c = await db.execute(sql`SELECT id FROM clients LIMIT 1`);
        const clientId = (c.rows[0] as { id: string }).id;
        const ins = await db.execute(sql`
          INSERT INTO leads (client_id, channel, stage, version, updated_at)
          VALUES (${clientId}, 'test', 'QUOTED', 0, ${FROZEN_NOW.toISOString()}::timestamptz)
          RETURNING id
        `);
        const leadId = (ins.rows[0] as { id: string }).id;
        const fakeLog = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, trace: () => {}, fatal: () => {} };
        vi.setSystemTime(new Date(FROZEN_NOW.getTime() + 5 * 60 * 60 * 1000));
        await followUpTick({ db, log: fakeLog as any, config: { NODE_ENV: 'production' } });
        const after = await db.execute(sql`SELECT stage FROM leads WHERE id = ${leadId}`);
        expect((after.rows[0] as { stage: string }).stage).toBe('QUOTED');
      }, 30_000);
    });
    ```

    **(e) apps/api/tests/integration/advisory-lock.test.ts** — FSM-04:
    ```ts
    import { describe, it, expect, beforeAll, afterAll } from 'vitest';
    import { sql } from 'drizzle-orm';
    import { handleInboundMessage } from '../../src/pipeline/intake.js';
    import { MockAnthropicClient } from '../_helpers/mock-anthropic.js';
    import { startPostgisContainer, stopPostgisContainer, getTestDb } from '../_helpers/test-db.js';

    describe('FSM-04 — per-client advisory lock serializes inbound messages', () => {
      let db: any;
      let clientId: string;

      beforeAll(async () => {
        await startPostgisContainer();
        db = await getTestDb();
        await import('../../src/seed/run.js').then((m) => m.seed(db));
        const c = await db.execute(sql`SELECT id FROM clients LIMIT 1`);
        clientId = (c.rows[0] as { id: string }).id;
      }, 90_000);
      afterAll(async () => { await stopPostgisContainer(); });

      it('10 parallel calls for same client → exactly 1 lead, messages in order', async () => {
        const llm = new MockAnthropicClient();
        const promises = Array.from({ length: 10 }, (_, i) =>
          handleInboundMessage({ db, llm, clientId, text: `msg-${i} короткое сообщение для теста advisory lock`, channel: 'test' })
        );
        const results = await Promise.all(promises);
        const leadIds = new Set(results.map((r) => r.leadId));
        expect(leadIds.size).toBe(1);

        const messages = await db.execute(sql`SELECT text FROM messages WHERE client_id = ${clientId} AND role = 'client' ORDER BY created_at ASC`);
        const texts = (messages.rows as Array<{ text: string }>).map((r) => r.text);
        for (let i = 0; i < 10; i++) {
          expect(texts).toContain(`msg-${i} короткое сообщение для теста advisory lock`);
        }
      }, 60_000);
    });
    ```

    **(f) Flip FSM-04 + FSM-06 todos in apps/api/tests/unit/phase-2-stubs.test.ts**:
    ```ts
    // FSM-04 — pg_advisory_xact_lock (was: test.todo)
    it('FSM-04: pg_advisory_xact_lock(hashtext(client_id)) wired in intake.ts', async () => {
      const src = await readFile('src/pipeline/intake.ts', 'utf8');
      expect(src).toMatch(/pg_advisory_xact_lock.*hashtext.*clientId/);
      // Full coverage: tests/integration/advisory-lock.test.ts proves 10 parallel calls → 1 lead.
    });

    // FSM-06 — auto-follow-up (was: test.todo)
    it('FSM-06: follow-up scheduler exports tick + register; fake-timer test proves lifecycle', async () => {
      const mod = await import('../../src/pipeline/follow-up-scheduler.js');
      expect(typeof mod.followUpTick).toBe('function');
      expect(typeof mod.registerFollowUpScheduler).toBe('function');
      expect(mod.POLL_INTERVAL_MS).toBe(60_000);
      // Full coverage: tests/integration/follow-up-scheduler.test.ts uses vi.useFakeTimers +
      // setSystemTime + advanceTimersByTime to drive setInterval and verify clearInterval on close.
    });
    ```

    Verify: `grep -c "test.todo" tests/unit/phase-2-stubs.test.ts` = 1 (only API-07 remains).
  </action>
  <verify>
    <automated>cd apps/api && test -f src/pipeline/follow-up-scheduler.ts && grep -q "registerFollowUpScheduler" src/pipeline/follow-up-scheduler.ts && grep -q "followUpTick" src/pipeline/follow-up-scheduler.ts && grep -q "POLL_INTERVAL_MS" src/pipeline/follow-up-scheduler.ts && grep -q "no_reply_24h" src/pipeline/follow-up-scheduler.ts && grep -q "useFakeTimers" tests/integration/follow-up-scheduler.test.ts && grep -q "advanceTimersByTimeAsync\|advanceTimersByTime" tests/integration/follow-up-scheduler.test.ts && grep -q "setSystemTime" tests/integration/follow-up-scheduler.test.ts && grep -q "app.close" tests/integration/follow-up-scheduler.test.ts && ! grep -q "INTERVAL '25 hours'" tests/integration/follow-up-scheduler.test.ts && grep -q "registerFollowUpScheduler" src/app.ts && test "$(grep -c "test.todo" tests/unit/phase-2-stubs.test.ts)" = "1" && pnpm --filter @ai-logist/api typecheck 2>&1 | tail -10</automated>
  </verify>
  <done>
    Scheduler module exists with followUpTick + registerFollowUpScheduler exports; app.ts wires the scheduler; fake-timer test exercises FULL setInterval lifecycle (advance → tick fires → close → no further ticks); advisory-lock test demonstrates 10 parallel calls → 1 lead + messages in order; phase-2-stubs.test.ts has 1 todo remaining (API-07).
  </done>
</task>

</tasks>

<verification>
Plan 02-04b overall gates:
1. `pnpm --filter @ai-logist/api typecheck` — passes
2. `pnpm exec biome check apps/api/src/pipeline apps/api/tests/integration` — passes
3. `pnpm --filter @ai-logist/api test:integration -- pipeline-canonical advisory-lock follow-up-scheduler` — Docker-equipped only; all green
4. phase-2-stubs.test.ts shows 1 todo remaining (API-07 — Plan 02-05)
5. follow-up-scheduler.test.ts uses vi.useFakeTimers exclusively (no `INTERVAL '25 hours'`)
6. follow-up-scheduler.test.ts exercises FULL setInterval lifecycle (tick fires on advance; no further ticks after close)
</verification>

<success_criteria>
- intake.ts is the FULL pipeline entry — Steps 0+A+B+C+D-pre(confirm)+D+E+F+G+H+I+J.
- Confirmation shortcut: QUOTED + "да" → AGREED → createOrder → ORDER_CREATED.
- Price-lock at the audit-log level: lead_events.QUOTED.payload.quoted_price set BEFORE assistant reply persisted.
- follow-up-scheduler.ts shipped per RESEARCH.md §14; lifecycle proven via fake timers (NOT real time).
- Scheduler test uses `vi.useFakeTimers({ shouldAdvanceTime: true })` + `vi.setSystemTime(...)` + `vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)` (per CHECKER WARNING #5).
- Scheduler test exercises FULL setInterval lifecycle: start, advance, tick fires, close, no further ticks.
- Advisory-lock test demonstrates per-client serialization (10 parallel → 1 lead, in-order messages).
- pipeline-canonical test backs ROADMAP success criterion #1 ('Киев-Львов 18 тонн тент' → ORDER_CREATED).
- 2 todos flipped: FSM-04, FSM-06. Only 1 remains (API-07 for Plan 02-05).
- Closes Pitfalls #1 (LLM in money path), #6 (FSM races second layer via advisory lock), and #12 second-half.
</success_criteria>

<output>
After completion, create `.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-04b-SUMMARY.md` documenting:
- handleInboundMessage final signature (FULL pipeline)
- Pipeline step ordering 0-J: advisory lock → persist → lang → budget → confirm shortcut → extract → clarify → city → match → price-lock → templated reply → create order
- Price-lock protocol verification: leads.quoted_price written before reply rendered (audit-log proof in lead_events)
- Scheduler shipped (60s poll); SIGTERM-safe via onClose hook; FULL lifecycle proven via vi.useFakeTimers
- Defensive priceGuard applied even to templated replies (future-proofing)
- 2 todos flipped this plan; only API-07 remains for Plan 02-05
- Closes Pitfalls #1 (LLM in money path via createOrder DB re-read), #6 (FSM races via advisory lock + version CAS), #7 (sticky lang — completed in 02-04a), #11 (anti-injection via tool boundaries — completed in 02-02), #12 (token-budget LOST — completed in 02-04a)
</output>
