---
phase: 02-llm-pipeline-deterministic-core-high-risk
plan: 04
type: execute
wave: 3
depends_on:
  - "02-02"
  - "02-03"
files_modified:
  - apps/api/src/pipeline/intake.ts
  - apps/api/src/pipeline/follow-up-scheduler.ts
  - apps/api/src/app.ts
  - apps/api/src/plugins/db.ts
  - apps/api/tests/_helpers/dialog-harness.ts
  - apps/api/tests/integration/pipeline-canonical.test.ts
  - apps/api/tests/integration/pipeline-sticky-lang.test.ts
  - apps/api/tests/integration/token-budget.test.ts
  - apps/api/tests/integration/advisory-lock.test.ts
  - apps/api/tests/integration/follow-up-scheduler.test.ts
  - apps/api/tests/integration/pipeline-injection.test.ts
  - apps/api/tests/fixtures/llm-responses.json
  - apps/api/tests/unit/phase-2-stubs.test.ts
autonomous: true
requirements:
  - LOGIC-03
  - LOGIC-04
  - MATCH-06
  - FSM-04
  - FSM-06

must_haves:
  truths:
    - "handleInboundMessage(db, llm, clientId, text, channel) is the SINGLE entry point. Phase 3 webhook will call it; tests call it via dialog-harness.runScript."
    - "intake.ts acquires pg_advisory_xact_lock(hashtext(client_id)) at the START of the outer transaction (FSM-04)."
    - "On FIRST message ≥ 20 chars per client, detect language ONCE via cyrillicHeuristic → fallback LLM. Save to clients.lang. NEVER re-detect (D-12)."
    - "Pipeline flow: detectLang → extractRequest (LLM tool) → if missing fields: clarifying question (budget 2 rounds) → transitionLead(NEW→QUALIFIED) → nearestTruck (SQL) → transitionLead(QUALIFIED→MATCHED) → routeKm → calcPrice → leadsRepo.update({quoted_price: default}) BEFORE reply → transitionLead(MATCHED→QUOTED) → templated reply with priceGuard verification → on client confirm: createOrder (re-reads quoted_price) → transitionLead(QUOTED→AGREED→ORDER_CREATED)."
    - "Price-lock protocol: leads.quoted_price written to DB BEFORE the reply is rendered (success criterion #1)."
    - "Token ledger: after every LLM call, UPDATE leads SET tokens_in = tokens_in + $usage.input_tokens, tokens_out = tokens_out + $usage.output_tokens, llm_calls = llm_calls + 1. When tokens_in+tokens_out > LLM_TOKEN_BUDGET_PER_LEAD (default 30000) → transitionLead(→LOST, payload={reason:'token_budget_exhausted'})."
    - "Anti-injection: tools schemas are the structural defense. canon-11 (injection attempt) results in stage=NEW (LLM extracted nothing useful) — no mutation, no leaked admin privileges."
    - "Follow-up scheduler registered via registerFollowUpScheduler(app) — runs every 60s in production; cleared on app.close()."
    - "runScript test harness calls handleInboundMessage directly (no Fastify, no webhook) and proves end-to-end 'Киев-Львов 18 тонн тент' → ORDER_CREATED."
  artifacts:
    - path: "apps/api/src/pipeline/intake.ts"
      provides: "handleInboundMessage entry point"
      contains: "pg_advisory_xact_lock"
    - path: "apps/api/src/pipeline/follow-up-scheduler.ts"
      provides: "setInterval-based follow-up + → LOST on stale"
      contains: "registerFollowUpScheduler"
  key_links:
    - from: "src/pipeline/intake.ts"
      to: "pg_advisory_xact_lock(hashtext(client_id))"
      via: "SELECT inside outer db.transaction"
      pattern: "pg_advisory_xact_lock.*hashtext"
    - from: "src/pipeline/intake.ts"
      to: "leads.quoted_price"
      via: "leadsRepo.update({quotedPrice: defaultKop}) BEFORE buildReply"
      pattern: "quotedPrice|quoted_price"
    - from: "src/pipeline/intake.ts"
      to: "leads.tokens_in, leads.tokens_out, leads.llm_calls"
      via: "UPDATE after every llm.runTurn"
      pattern: "tokens_in.*=.*tokens_in.*\\+"
    - from: "src/app.ts"
      to: "src/pipeline/follow-up-scheduler.ts"
      via: "registerFollowUpScheduler(app) call"
      pattern: "registerFollowUpScheduler"
---

<objective>
Wave 3 — wire the pipeline. This is the integration layer where everything from Waves 1+2 composes into a single dialog turn.

Purpose:
- `apps/api/src/pipeline/intake.ts` = the single entry point. Phase 3 (Telegram webhook) calls it; test harness calls it.
- Implement per-client serialization via `pg_advisory_xact_lock(hashtext(client_id))` (FSM-04 — closes Pitfall #6 second layer).
- Implement sticky language detection (Pitfall #7 — D-12..D-15).
- Implement clarification budget (LOGIC-04 — 2 rounds then triage).
- Implement price-lock protocol (MATCH-06 — write to DB before render).
- Implement token-cost ledger + budget exhaustion → LOST (Pitfall #12).
- Implement follow-up scheduler (FSM-06).
- Implement anti-injection wrapping (`<client_message>...</client_message>`) for every LLM call.
- Flip 5 final non-route todos: LOGIC-03 (city normalization wired here), LOGIC-04 (clarification budget enforced here), MATCH-06 (price-lock enforced here), FSM-04 (advisory lock), FSM-06 (follow-up scheduler).

Output: 2 production files + 6 integration tests covering canonical flow + sticky lang + token budget + advisory lock + scheduler + injection. dialog-harness.ts gets the `@ts-expect-error` directive removed.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-CONTEXT.md
@.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-RESEARCH.md
@.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-VALIDATION.md
@.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-00-SUMMARY.md
@.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-01-SUMMARY.md
@.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-02-SUMMARY.md
@.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-03-SUMMARY.md
@apps/api/src/lib/lang-detect.ts
@apps/api/src/lib/routing.ts
@apps/api/src/lib/geocoding.ts
@apps/api/src/lib/price-guard.ts
@apps/api/src/lib/money.ts
@apps/api/src/pipeline/llm-client.ts
@apps/api/src/pipeline/llm-tools/extract-request.ts
@apps/api/src/pipeline/llm-tools/nearest-truck.ts
@apps/api/src/pipeline/llm-tools/calc-price.ts
@apps/api/src/pipeline/llm-tools/create-order.ts
@apps/api/src/pipeline/lifecycle/lead-fsm.ts
@apps/api/src/pipeline/lifecycle/order-fsm.ts
@apps/api/src/persistence/repos/clients.ts
@apps/api/src/persistence/repos/leads.ts
@apps/api/src/persistence/repos/messages.ts
@apps/api/src/persistence/repos/cities.ts
@apps/api/src/app.ts
@apps/api/tests/_helpers/dialog-harness.ts
@apps/api/tests/fixtures/canonical-inputs.json

<interfaces>
<!-- Wave 0/1/2 contracts this plan composes. -->

LlmProvider (Wave 1 + Wave 0 share):
```typescript
export interface LlmProvider {
  runTurn(args: { systemPrompt: string; userMessages: Array<{role:'user'|'assistant';content:string}>; toolNames: string[] }): Promise<{
    toolCalls: Array<{ name: string; args: unknown }>;
    finalText: string | null;
    usage: { input_tokens: number; output_tokens: number };
  }>;
}
```

dialog-harness.ts (Wave 0) signature:
```typescript
export async function runScript(db: Db, mockLlm: LlmProvider, clientId: string, messages: ScriptMessage[]): Promise<ScriptResult>;
// runScript calls handleInboundMessage which Wave 3 must provide.
```

Wave 2a tools available via buildToolRegistry:
```typescript
buildToolRegistry({db, log, llm, leadId, clientId, clientLang}): [extractRequest, nearestTruck, calcPrice, createOrder, discount, detectLanguage]
```

Wave 2b FSM functions:
```typescript
transitionLead(db, {leadId, to, actor, payload?}): Promise<{from, to, version}>
transitionOrder(db, {orderId, to, actor, payload?, geomWkt?}): Promise<{from, to, version, audit_row_inserted}>
```

Phase 1 + Wave 1 leads columns relevant here:
- stage, version (CAS)
- tokensIn, tokensOut, llmCalls (Wave 1 token ledger)
- quotedPrice (price-lock target)
- fromCityId, toCityId, tons, bodyType, matchedTruckId (extraction results)

Phase 1 messages repo (apps/api/src/persistence/repos/messages.ts):
- Used to persist conversation history (D-35).
- create(db, {clientId, leadId, role, text}): Promise<Message>
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: pipeline/intake.ts — full handleInboundMessage with advisory lock + sticky lang + extract + match + price-lock + create-order + token ledger</name>
  <files>apps/api/src/pipeline/intake.ts, apps/api/tests/_helpers/dialog-harness.ts, apps/api/tests/fixtures/llm-responses.json</files>
  <behavior>
    - handleInboundMessage(args) is async, returns `{leadId: string, exchanges: Array<{role: 'user'|'assistant'|'tool', content: unknown}>}`.
    - Outer pattern: `await args.db.transaction(async (tx) => { await tx.execute(sql\`SELECT pg_advisory_xact_lock(hashtext(${args.clientId}))\`); ... pipeline body ... })`.
    - Step A — Persist inbound message + find-or-create lead in NEW:
      1. messagesRepo.create(tx, {clientId, role:'client', text}).
      2. If client has an open lead (stage NOT IN ('DONE','LOST','ORDER_CREATED','IN_PROGRESS')) → reuse it. Else INSERT new lead with stage='NEW'.
      3. Update `messages.lead_id` to the chosen lead.
    - Step B — Sticky language detection (Pitfall #7):
      1. Read clients.lang. If already set (non-null) → use it.
      2. Else: If text.length < 20 → reply with RU boilerplate ("Здравствуйте! Расскажите подробнее..."), do NOT save lang yet.
      3. Else: cyrillicHeuristic(text). If UA marker → set clients.lang='ua'. Else LLM detectLanguage tool. Save result.
    - Step C — Token-budget check (Pitfall #12):
      1. Read leads.tokens_in + tokens_out. If > LLM_TOKEN_BUDGET_PER_LEAD → transitionLead(→LOST, actor:'system', payload:{reason:'token_budget_exhausted'}) and return immediately with a sorry reply.
    - Step D — Extract request (LOGIC-01, LOGIC-04):
      1. Load last 8 messages for context (D-35 truncate-to-8; full summarization deferred).
      2. Call extractRequestHandler with the wrapped message. Increment token ledger after the call.
      3. If from_city/to_city/tons confidence all >= 0.7 → proceed. Else:
         - Read leads.price_overrides as crude clarification counter (or store counter in payload). For Phase 2 demo: count messages in this lead where role='ai-tool' AND text contains 'clarifying_question'. If counter < 2 → emit clarifying_question_${lang}, persist as AI message, return. If counter == 2 → leave at NEW, flag "needs manual triage" via payload, return.
    - Step E — City normalization (LOGIC-03):
      1. citiesRepo.findBySlug for slugified extract.from_city; ditto for to_city.
      2. If miss → geocode(name, ['ru','ua']). Cache via citiesRepo.upsert.
      3. Set leads.from_city_id / to_city_id.
    - Step F — Match (MATCH-01):
      1. transitionLead(NEW→QUALIFIED, actor:'ai', payload:{extracted: true}).
      2. nearestTruck(tx, {pickupLon, pickupLat, tons, bodyType}). If 0 rows → bourse-stub already handled in Wave 2a.
      3. leadsRepo.update({matchedTruckId: best.id}).
      4. transitionLead(QUALIFIED→MATCHED, actor:'ai', payload:{trucks_found: rows.length, best_id: best.id}).
    - Step G — Route + Price + Price-lock (MATCH-03/04/05/06):
      1. routeKm(from_geom, to_geom). Use fromCity/toCity geom from the cities rows. log warns on haversine fallback.
      2. cfg = readPricingConfig(tx). out = calcPrice({route_km, tons, body, date: new Date(), direction:'default'}, cfg).
      3. **PRICE-LOCK STEP (CRITICAL)**: leadsRepo.update(tx, leadId, {quotedPrice: out.default}). VERIFY: this completes BEFORE the next step.
      4. transitionLead(MATCHED→QUOTED, actor:'ai', payload:{quoted_price: out.default.toString(), min: out.min.toString(), max: out.max.toString()}).
      5. Re-fetch lead, read quoted_price from DB (paranoia — never trust in-memory).
      6. Build reply by template: `"Цена за рейс: {formatPriceKop(lead.quotedPrice!, lang)} руб. Подтверждаете?"` (RU) or UA equivalent.
      7. priceGuard(reply, lead.quoted_price, out.min, out.max). If !ok → log warning + retry once with stricter prompt (only relevant if LLM ever drafts numbers; for templated reply this is a defensive check).
      8. messagesRepo.create({clientId, leadId, role:'ai', text: reply}).
    - Step H — Confirmation (if this turn's client text matches a confirmation pattern OR previous turn ended in QUOTED and client said "да"/"так"/etc.):
      1. transitionLead(QUOTED→AGREED, actor:'ai').
      2. createOrderHandler(ctx, {lead_id, confirmed: true}). Re-reads quoted_price from DB (D-06).
      3. transitionLead(AGREED→ORDER_CREATED, actor:'ai', payload:{order_id, order_number}).
      4. Build templated reply with order_number + public_token. Persist as ai message.
    - Returns the exchanges array — sequence of messages (user, assistant, tool calls) for snapshot tests.
    - Token-ledger UPDATE pattern (after every LLM call):
      ```sql
      UPDATE leads SET tokens_in = tokens_in + ${usage.input_tokens},
                       tokens_out = tokens_out + ${usage.output_tokens},
                       llm_calls = llm_calls + 1,
                       updated_at = NOW()
      WHERE id = ${leadId}
      ```
  </behavior>
  <read_first>
    - .planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-RESEARCH.md §5.5 (price-lock pseudocode VERBATIM), §6.5 (advisory lock SQL VERBATIM), §14 (scheduler skeleton), "Pitfall 6: token-ledger" (atomic UPDATE block)
    - .planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-CONTEXT.md D-12..D-15 (sticky lang), D-30 (advisory lock), D-36 (token ledger), "Specific Ideas" canonical scenario
    - apps/api/src/persistence/repos/leads.ts (leadsRepo.findById, update)
    - apps/api/src/persistence/repos/clients.ts (findById, update for lang)
    - apps/api/src/persistence/repos/messages.ts (create)
    - apps/api/src/persistence/repos/cities.ts (findBySlug, upsert)
    - apps/api/src/pipeline/llm-tools/extract-request.ts (Wave 2a — extractRequestHandler signature)
    - apps/api/src/pipeline/llm-tools/calc-price.ts (Wave 2a — readPricingConfig + calcPrice)
    - apps/api/src/pipeline/llm-tools/create-order.ts (Wave 2a — createOrderHandler signature)
    - apps/api/src/pipeline/lifecycle/lead-fsm.ts (Wave 2b — transitionLead signature)
    - apps/api/tests/_helpers/dialog-harness.ts (Wave 0 — handleInboundMessage signature this plan must implement)
  </read_first>
  <action>
    **(a) apps/api/src/pipeline/intake.ts** — single source file (~250-400 lines). Skeleton:
    ```ts
    import { sql } from 'drizzle-orm';
    import type { FastifyBaseLogger } from 'fastify';
    import type { Db } from '../db.js';
    import { config } from '../config.js';
    import { cyrillicHeuristic, type Lang } from '../lib/lang-detect.js';
    import { formatPriceKop } from '../lib/money.js';
    import { priceGuard } from '../lib/price-guard.js';
    import { routeKm } from '../lib/routing.js';
    import { geocode } from '../lib/geocoding.js';
    import { clientsRepo, leadsRepo, messagesRepo, citiesRepo } from '../persistence/repos/index.js';
    import { transitionLead } from './lifecycle/lead-fsm.js';
    import { extractRequestHandler } from './llm-tools/extract-request.js';
    import { calcPrice, readPricingConfig } from './llm-tools/calc-price.js';
    import { createOrderHandler } from './llm-tools/create-order.js';
    import { nearestTruck } from './llm-tools/nearest-truck.js';
    import type { ToolContext } from './llm-tools/index.js';
    import type { LlmProvider } from './llm-client.js';

    export interface InboundMessageArgs {
      db: Db;
      llm: LlmProvider;
      log?: FastifyBaseLogger;
      clientId: string;
      text: string;
      channel: string;
    }

    export interface InboundMessageResult {
      leadId: string;
      exchanges: Array<{ role: 'user' | 'assistant' | 'tool'; content: unknown }>;
    }

    const RU_BOILERPLATE_SHORT = 'Здравствуйте! Расскажите подробнее: откуда, куда, сколько тонн?';
    const CONFIRM_PATTERNS = /\b(да|ок|подтверждаю|согласен|так|погоджуюсь|підтверджую)\b/iu;

    export async function handleInboundMessage(args: InboundMessageArgs): Promise<InboundMessageResult> {
      return await args.db.transaction(async (tx) => {
        // STEP 0 — Per-client advisory lock (FSM-04, Pitfall #6 second layer).
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${args.clientId}))`);

        const exchanges: InboundMessageResult['exchanges'] = [];

        // STEP A — Persist message + find/create lead.
        const client = await clientsRepo.findById(tx as Db, args.clientId);
        if (!client) throw new Error(`client ${args.clientId} not found`);

        let lead = await findOpenLead(tx as Db, args.clientId);
        if (!lead) {
          const created = await leadsRepo.create(tx as Db, {
            clientId: args.clientId, channel: args.channel, stage: 'NEW', version: 0,
          });
          lead = created;
        }
        await messagesRepo.create(tx as Db, { clientId: args.clientId, leadId: lead.id, role: 'client', text: args.text });

        // STEP B — Sticky language detection (D-12..D-15).
        let lang: Lang = (client.lang as Lang | null) ?? 'ru';
        if (!client.lang) {
          if (args.text.length < 20) {
            await messagesRepo.create(tx as Db, { clientId: args.clientId, leadId: lead.id, role: 'ai', text: RU_BOILERPLATE_SHORT });
            exchanges.push({ role: 'assistant', content: RU_BOILERPLATE_SHORT });
            return { leadId: lead.id, exchanges };
          }
          const cheap = cyrillicHeuristic(args.text);
          if (cheap) { lang = cheap.lang; }
          // (LLM detect path omitted in this skeleton — default 'ru' when heuristic null.)
          await clientsRepo.update(tx as Db, args.clientId, { lang });
        }

        // STEP C — Token budget check (Pitfall #12).
        const currentTokens = Number(lead.tokensIn ?? 0) + Number(lead.tokensOut ?? 0);
        if (currentTokens > config.LLM_TOKEN_BUDGET_PER_LEAD) {
          await transitionLead(tx as Db, { leadId: lead.id, to: 'LOST', actor: 'system', payload: { reason: 'token_budget_exhausted' } });
          const sorry = lang === 'ua' ? 'Перевищили бюджет. Будь ласка, зв\'яжіться з менеджером.' : 'Превышен бюджет диалога. Свяжитесь с менеджером.';
          await messagesRepo.create(tx as Db, { clientId: args.clientId, leadId: lead.id, role: 'ai', text: sorry });
          exchanges.push({ role: 'assistant', content: sorry });
          return { leadId: lead.id, exchanges };
        }

        // STEP D — Confirmation shortcut: if lead in QUOTED and client confirms → AGREED → ORDER.
        if (lead.stage === 'QUOTED' && CONFIRM_PATTERNS.test(args.text)) {
          await transitionLead(tx as Db, { leadId: lead.id, to: 'AGREED', actor: 'ai', payload: { confirm_text: args.text } });
          const ctx: ToolContext = { db: tx as Db, log: args.log ?? noopLogger(), llm: args.llm, leadId: lead.id, clientId: args.clientId, clientLang: lang };
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

        // STEP E — Extract (LOGIC-01) + token accounting.
        const wrapped = `<client_message>${args.text}</client_message>`;
        const llmResult = await args.llm.runTurn({
          systemPrompt: '...', // EXTRACT_REQUEST_SYSTEM_PROMPT
          userMessages: [{ role: 'user', content: wrapped }],
          toolNames: ['extractRequest'],
        });
        await incrementTokenLedger(tx as Db, lead.id, llmResult.usage);
        const extracted = parseExtractResult(llmResult);  // helper that finds the toolCall args and validates

        // STEP F — Clarification budget (LOGIC-04).
        const lowConfidence = extracted.confidence.from_city < 0.7 || extracted.confidence.to_city < 0.7 || extracted.confidence.tons < 0.7;
        if (lowConfidence) {
          const clarifyCount = await countClarificationRounds(tx as Db, lead.id);
          if (clarifyCount >= 2) {
            // Mark for manual triage, leave at NEW.
            await leadsRepo.update(tx as Db, lead.id, { /* annotate via payload elsewhere */ });
            const reply = lang === 'ua' ? 'Не вдалося розпізнати. Менеджер зв\'яжеться.' : 'Не удалось понять. Менеджер свяжется.';
            await messagesRepo.create(tx as Db, { clientId: args.clientId, leadId: lead.id, role: 'ai', text: reply });
            exchanges.push({ role: 'assistant', content: reply });
            return { leadId: lead.id, exchanges };
          }
          const q = lang === 'ua' ? (extracted.clarifying_question_ua ?? 'Уточніть місто та тоннаж.') : (extracted.clarifying_question_ru ?? 'Уточните город и тоннаж.');
          await messagesRepo.create(tx as Db, { clientId: args.clientId, leadId: lead.id, role: 'ai', text: q });
          exchanges.push({ role: 'assistant', content: q });
          return { leadId: lead.id, exchanges };
        }

        // STEP G — City normalization (LOGIC-03).
        const fromCity = await resolveCity(tx as Db, extracted.from_city!, args.log);
        const toCity = await resolveCity(tx as Db, extracted.to_city!, args.log);
        if (!fromCity || !toCity) {
          // bail out as clarification
          const reply = lang === 'ua' ? 'Не знайшов місто. Уточніть.' : 'Не нашёл город. Уточните.';
          await messagesRepo.create(tx as Db, { clientId: args.clientId, leadId: lead.id, role: 'ai', text: reply });
          exchanges.push({ role: 'assistant', content: reply });
          return { leadId: lead.id, exchanges };
        }

        // STEP H — Match (MATCH-01).
        await leadsRepo.update(tx as Db, lead.id, { fromCityId: fromCity.id, toCityId: toCity.id, tons: String(extracted.tons!), bodyType: extracted.body_type });
        await transitionLead(tx as Db, { leadId: lead.id, to: 'QUALIFIED', actor: 'ai', payload: { extracted: true } });
        const trucks = await nearestTruck(tx as Db, {
          pickupLon: fromCity.lonLat.lon, pickupLat: fromCity.lonLat.lat,
          tons: extracted.tons!, bodyType: extracted.body_type,
        });
        if (trucks.length === 0) {
          // Bourse fallback already handled by nearestTruck; if STILL empty → LOST.
          await transitionLead(tx as Db, { leadId: lead.id, to: 'LOST', actor: 'system', payload: { reason: 'no_trucks' } });
          const reply = lang === 'ua' ? 'Машин немає.' : 'Машин нет.';
          await messagesRepo.create(tx as Db, { clientId: args.clientId, leadId: lead.id, role: 'ai', text: reply });
          exchanges.push({ role: 'assistant', content: reply });
          return { leadId: lead.id, exchanges };
        }
        const best = trucks[0];
        await leadsRepo.update(tx as Db, lead.id, { matchedTruckId: best.source === 'own-fleet' ? best.id : null });
        await transitionLead(tx as Db, { leadId: lead.id, to: 'MATCHED', actor: 'ai', payload: { trucks_found: trucks.length, best_id: best.id, source: best.source } });

        // STEP I — Price (MATCH-03/04/05).
        const { route_km, source: routeSource } = await routeKm(fromCity.lonLat, toCity.lonLat, args.log);
        const cfg = await readPricingConfig(tx as Db);
        const priceOut = calcPrice({ route_km, tons: extracted.tons!, bodyType: extracted.body_type ?? 'tent', date: new Date(), direction: 'default' }, cfg);

        // STEP J — PRICE-LOCK (MATCH-06, the protocol). Write FIRST. Read SECOND. Render THIRD.
        await leadsRepo.update(tx as Db, lead.id, { quotedPrice: priceOut.default });
        await transitionLead(tx as Db, { leadId: lead.id, to: 'QUOTED', actor: 'ai', payload: {
          quoted_price: priceOut.default.toString(), min: priceOut.min.toString(), max: priceOut.max.toString(),
          route_km, route_source: routeSource,
        }});
        const refreshed = await leadsRepo.findById(tx as Db, lead.id);
        if (!refreshed?.quotedPrice) throw new Error('price-lock: quoted_price missing after write');
        const priceStr = formatPriceKop(BigInt(refreshed.quotedPrice as unknown as string), lang);
        const reply = lang === 'ua' ? `Ціна за рейс: ${priceStr} ₽. Підтверджуєте?` : `Цена за рейс: ${priceStr} ₽. Подтверждаете?`;

        // Defensive guard: priceGuard against templated reply (passes by construction; defends future LLM injection).
        const guard = priceGuard({ llmText: reply, quotedPriceKop: BigInt(refreshed.quotedPrice as unknown as string), minKop: priceOut.min, maxKop: priceOut.max });
        if (!guard.ok) {
          args.log?.warn({ leadId: lead.id, badNumbers: guard.badNumbers }, 'price-guard: anomaly in templated reply');
        }
        await messagesRepo.create(tx as Db, { clientId: args.clientId, leadId: lead.id, role: 'ai', text: reply });
        exchanges.push({ role: 'tool', content: { name: 'calcPrice', result: { default: priceOut.default.toString() } } });
        exchanges.push({ role: 'assistant', content: reply });
        return { leadId: lead.id, exchanges };
      });
    }

    // Helpers
    async function findOpenLead(db: Db, clientId: string) {
      const rows = await db.execute(sql`SELECT * FROM leads WHERE client_id = ${clientId} AND stage NOT IN ('DONE','LOST','ORDER_CREATED','IN_PROGRESS') ORDER BY updated_at DESC LIMIT 1`);
      return rows.rows[0] as any | undefined;
    }
    async function incrementTokenLedger(db: Db, leadId: string, usage: { input_tokens: number; output_tokens: number }): Promise<void> {
      await db.execute(sql`
        UPDATE leads SET tokens_in = tokens_in + ${usage.input_tokens},
                         tokens_out = tokens_out + ${usage.output_tokens},
                         llm_calls = llm_calls + 1,
                         updated_at = NOW()
        WHERE id = ${leadId}
      `);
    }
    async function countClarificationRounds(db: Db, leadId: string): Promise<number> {
      const rows = await db.execute(sql`SELECT count(*)::int AS c FROM messages WHERE lead_id = ${leadId} AND role = 'ai' AND text LIKE '%Уточн%'`);
      return Number((rows.rows[0] as { c: number }).c);
    }
    async function resolveCity(db: Db, name: string, log: FastifyBaseLogger | undefined): Promise<{ id: string; lonLat: { lon: number; lat: number } } | null> {
      // Local cities ILIKE first (LOGIC-03).
      const local = await db.execute(sql`SELECT id, ST_X(geom::geometry) AS lon, ST_Y(geom::geometry) AS lat FROM cities WHERE name_ru ILIKE ${name} OR name_ua ILIKE ${name} LIMIT 1`);
      const hit = local.rows[0] as { id: string; lon: number; lat: number } | undefined;
      if (hit) return { id: hit.id, lonLat: { lon: hit.lon, lat: hit.lat } };
      // Nominatim fallback.
      const geo = await geocode(name, ['ru', 'ua'], log);
      if (!geo) return null;
      // Cache via citiesRepo.upsert (lon/lat parsed from pointWkt).
      const m = /POINT\(([-\d.]+) ([-\d.]+)\)/.exec(geo.pointWkt);
      if (!m) return null;
      const lon = Number(m[1]); const lat = Number(m[2]);
      const slug = name.toLowerCase().replace(/[^a-zа-яё]+/giu, '-').slice(0, 60);
      const up = await citiesRepo.upsert(db, {
        slug, nameRu: name, nameUa: name,
        countryCode: geo.country_code,
        geom: sql`ST_GeogFromText(${'SRID=4326;' + geo.pointWkt})` as any,
      });
      return { id: up.id, lonLat: { lon, lat } };
    }
    function parseExtractResult(r: Awaited<ReturnType<LlmProvider['runTurn']>>): any {
      const call = r.toolCalls.find((c) => c.name === 'extractRequest');
      if (!call) throw new Error('extractRequest tool call missing from LLM result');
      return call.args;
    }
    function noopLogger(): FastifyBaseLogger {
      const fn = () => {};
      // @ts-expect-error minimal logger for off-Fastify callers
      return { info: fn, warn: fn, error: fn, debug: fn, trace: fn, fatal: fn, level: 'silent', child: () => noopLogger(), bindings: () => ({}), silent: fn };
    }
    ```

    Notes:
    - The skeleton above leaves `extracted` typed as `any` in a few places; tighten to `ExtractRequestOutput` from `extract-request.ts`.
    - Confirmation pattern in Step D handles the canonical success-criterion #1 path (client confirms → ORDER_CREATED).
    - Token-budget check in Step C runs BEFORE the LLM call to avoid wasting one more call.
    - `findOpenLead` raw SQL: should use leadsRepo if a `findOpenByClient` is added (consider adding to apps/api/src/persistence/repos/leads.ts).
    - The `resolveCity` cast `as any` on geom is a workaround for Drizzle 0.45.2 customType insert; verify with Phase 1's seed code (apps/api/src/seed/run.ts) for the exact pattern.

    **(b) apps/api/tests/_helpers/dialog-harness.ts** — REMOVE the `@ts-expect-error` Wave-0 directive. The dynamic import is no longer needed; import statically:
    ```ts
    import { handleInboundMessage, type InboundMessageResult } from '../../src/pipeline/intake.js';
    ```
    Update the result extraction to use the typed `InboundMessageResult` shape.

    **(c) apps/api/tests/fixtures/llm-responses.json** — APPEND fixture entries keyed by `extractRequest::<hash>` for at least the canonical inputs canon-01, canon-02, canon-04 (RU literal, UA literal, ambiguous). Each entry: `{toolCalls:[{name:'extractRequest', args:{...}}], finalText:null, usage:{input_tokens: 50, output_tokens: 30}}`. Use deterministic token counts for snapshot stability.
  </behavior>
  <action>
    Sequence:
    1. Write `apps/api/src/pipeline/intake.ts` per skeleton (expand placeholders to compile + pass tsc).
    2. Update `apps/api/tests/_helpers/dialog-harness.ts` (remove @ts-expect-error; static import).
    3. Append llm-responses.json fixtures for the canonical extracts.
    4. Run `pnpm --filter @ai-logist/api typecheck` + biome.
  </action>
  <verify>
    <automated>cd apps/api && test -f src/pipeline/intake.ts && grep -q "pg_advisory_xact_lock.*hashtext" src/pipeline/intake.ts && grep -q "leadsRepo.update.*quotedPrice" src/pipeline/intake.ts && grep -q "tokens_in.*+.*tokens_in" src/pipeline/intake.ts && grep -q "LLM_TOKEN_BUDGET_PER_LEAD" src/pipeline/intake.ts && grep -q "CONFIRM_PATTERNS" src/pipeline/intake.ts && grep -q "RU_BOILERPLATE_SHORT" src/pipeline/intake.ts && grep -q "import.*handleInboundMessage" tests/_helpers/dialog-harness.ts && ! grep -q "@ts-expect-error pipeline" tests/_helpers/dialog-harness.ts && pnpm --filter @ai-logist/api typecheck 2>&1 | tail -10</automated>
  </verify>
  <done>
    intake.ts implements all 10 steps (advisory lock → persist → lang → budget → extract → clarify → city → match → price-lock → confirm); dialog-harness.ts statically imports handleInboundMessage; llm-responses.json has fixtures for at least 3 canonical inputs.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: follow-up scheduler + app.ts wiring + integration tests for scheduler/advisory lock</name>
  <files>apps/api/src/pipeline/follow-up-scheduler.ts, apps/api/src/app.ts, apps/api/src/plugins/db.ts, apps/api/tests/integration/advisory-lock.test.ts, apps/api/tests/integration/follow-up-scheduler.test.ts</files>
  <behavior>
    - follow-up-scheduler.ts: paste RESEARCH.md §14 VERBATIM (registerFollowUpScheduler with POLL_INTERVAL_MS=60_000, QUIET_THRESHOLD_MS=4h, STALE_THRESHOLD_MS=24h).
    - Scheduler skips when NODE_ENV='test' (so vitest doesn't trip it).
    - registerFollowUpScheduler(app) attaches an onClose hook that clears the interval.
    - app.ts gains `registerFollowUpScheduler(app)` after route plugins.
    - app.ts buildApp() optionally accepts a `llm: LlmProvider` parameter (default new AnthropicLlmClient()) so Phase 3 tests can inject MockAnthropicClient. If omitted, defer instantiation until the first request that needs it.
    - Advisory lock test: fire 10 parallel handleInboundMessage calls for the same client_id with short text snippets; assert messages persist in the same order they were fired (sequential serialization) and there are no concurrent lead-creation races (exactly one lead created across all 10 calls).
    - Scheduler test: insert a lead at QUOTED with updated_at = NOW() - INTERVAL '25 hours' → call the scheduler tick function (export the inner async tick separately for testability) → assert lead.stage = 'LOST', lead_events row written with payload.reason='no_reply_24h'.
  </behavior>
  <read_first>
    - .planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-RESEARCH.md §14 (scheduler VERBATIM)
    - .planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-CONTEXT.md D-31
    - apps/api/src/app.ts (Phase 1 buildApp shape)
    - apps/api/src/plugins/db.ts (Phase 1 db plugin shape — does `app.db` exist? scheduler reads `app.db`)
    - apps/api/tests/_helpers/fake-timers.ts (Wave 0 — for FSM-06 fake-timer test)
    - apps/api/tests/_helpers/test-db.ts (testcontainers)
  </read_first>
  <action>
    **(a) apps/api/src/pipeline/follow-up-scheduler.ts** — paste from RESEARCH.md §14 VERBATIM. Also export the inner tick function separately for testability:
    ```ts
    export async function followUpTick(app: { db: Db; log: FastifyBaseLogger; config?: { NODE_ENV?: string } }): Promise<void> {
      // ... body of the setInterval callback factored out ...
    }
    export function registerFollowUpScheduler(app: FastifyInstance): void {
      if (app.config?.NODE_ENV === 'test') return;
      const handle = setInterval(() => { void followUpTick(app as never).catch((e) => app.log.error({ err: e }, 'follow-up.tick_failed')); }, POLL_INTERVAL_MS);
      app.addHook('onClose', async () => { clearInterval(handle); });
    }
    ```

    **(b) apps/api/src/app.ts** — add the registration after all route plugins:
    ```ts
    import { registerFollowUpScheduler } from './pipeline/follow-up-scheduler.js';
    // ... at end of buildApp, after all .register(...) calls:
    registerFollowUpScheduler(app);
    ```

    **(c) apps/api/src/plugins/db.ts** — verify `app.db` decorator exists with type `Db`. If `app.config` decorator doesn't exist (Phase 1 may have used config.NODE_ENV directly), the scheduler signature must read `config.NODE_ENV` from the imported `config` module instead. Confirm via Read.

    **(d) apps/api/tests/integration/advisory-lock.test.ts** — FSM-04:
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

    **(e) apps/api/tests/integration/follow-up-scheduler.test.ts** — FSM-06:
    ```ts
    import { describe, it, expect, beforeAll, afterAll } from 'vitest';
    import { sql } from 'drizzle-orm';
    import { followUpTick } from '../../src/pipeline/follow-up-scheduler.js';
    import { startPostgisContainer, stopPostgisContainer, getTestDb } from '../_helpers/test-db.js';

    describe('FSM-06 — auto-follow-up scheduler', () => {
      let db: any;

      beforeAll(async () => {
        await startPostgisContainer();
        db = await getTestDb();
        await import('../../src/seed/run.js').then((m) => m.seed(db));
      }, 90_000);
      afterAll(async () => { await stopPostgisContainer(); });

      it('lead in QUOTED >24h → → LOST with reason=no_reply_24h', async () => {
        const c = await db.execute(sql`SELECT id FROM clients LIMIT 1`);
        const clientId = (c.rows[0] as { id: string }).id;
        const ins = await db.execute(sql`
          INSERT INTO leads (client_id, channel, stage, version, updated_at)
          VALUES (${clientId}, 'test', 'QUOTED', 0, NOW() - INTERVAL '25 hours')
          RETURNING id
        `);
        const leadId = (ins.rows[0] as { id: string }).id;

        const fakeLog = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, trace: () => {}, fatal: () => {} };
        await followUpTick({ db, log: fakeLog as any, config: { NODE_ENV: 'production' } });

        const after = await db.execute(sql`SELECT stage FROM leads WHERE id = ${leadId}`);
        expect((after.rows[0] as { stage: string }).stage).toBe('LOST');

        const events = await db.execute(sql`SELECT payload FROM lead_events WHERE lead_id = ${leadId} ORDER BY created_at DESC LIMIT 1`);
        expect((events.rows[0] as { payload: { reason: string } }).payload.reason).toBe('no_reply_24h');
      }, 30_000);

      it('lead in QUOTED 5h (< 24h) → quiet follow-up log only, stage unchanged', async () => {
        const c = await db.execute(sql`SELECT id FROM clients LIMIT 1`);
        const clientId = (c.rows[0] as { id: string }).id;
        const ins = await db.execute(sql`
          INSERT INTO leads (client_id, channel, stage, version, updated_at)
          VALUES (${clientId}, 'test', 'QUOTED', 0, NOW() - INTERVAL '5 hours')
          RETURNING id
        `);
        const leadId = (ins.rows[0] as { id: string }).id;
        const fakeLog = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, trace: () => {}, fatal: () => {} };
        await followUpTick({ db, log: fakeLog as any, config: { NODE_ENV: 'production' } });
        const after = await db.execute(sql`SELECT stage FROM leads WHERE id = ${leadId}`);
        expect((after.rows[0] as { stage: string }).stage).toBe('QUOTED');
      }, 30_000);
    });
    ```

    **(f) Flip FSM-04, FSM-06 todos in phase-2-stubs.test.ts**: real sanity assertions referencing the integration test files.
  </action>
  <verify>
    <automated>cd apps/api && test -f src/pipeline/follow-up-scheduler.ts && grep -q "registerFollowUpScheduler" src/pipeline/follow-up-scheduler.ts && grep -q "followUpTick" src/pipeline/follow-up-scheduler.ts && grep -q "registerFollowUpScheduler" src/app.ts && grep -q "no_reply_24h" src/pipeline/follow-up-scheduler.ts && pnpm --filter @ai-logist/api typecheck 2>&1 | tail -10</automated>
  </verify>
  <done>
    Scheduler module exists; followUpTick exported for testability; app.ts wires the scheduler; advisory-lock test demonstrates 10 parallel calls → 1 lead + messages in order; follow-up scheduler test demonstrates QUOTED >24h → LOST with payload reason.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Pipeline integration tests — canonical E2E + sticky lang + token budget + injection (flip remaining 3 todos LOGIC-03, LOGIC-04, MATCH-06)</name>
  <files>apps/api/tests/integration/pipeline-canonical.test.ts, apps/api/tests/integration/pipeline-sticky-lang.test.ts, apps/api/tests/integration/pipeline-injection.test.ts, apps/api/tests/integration/token-budget.test.ts, apps/api/tests/unit/phase-2-stubs.test.ts, apps/api/tests/fixtures/llm-responses.json</files>
  <behavior>
    - pipeline-canonical.test.ts: canon-01 ("Киев-Львов 18 тонн тент, нужно завтра") → after first message, lead in QUOTED with quotedPrice set; after second message ("да"), lead in ORDER_CREATED, order in CREATED with public_token + number.
    - pipeline-sticky-lang.test.ts: client sends "ок" (<20 chars), then "Київ-Львів 18т" → clients.lang='ua' after second message; subsequent reply contains UA characters or "Ціна".
    - pipeline-injection.test.ts: client sends one of the 5 injection-attempts.json texts; after pipeline runs, lead.stage='NEW' (extraction returned all-null with low confidence); orders table has 0 rows for this client; lead_events does NOT contain any audit row with malicious payload.
    - token-budget.test.ts: pre-set leads.tokens_in=20000, tokens_out=15000 (sum > 30000); send any message; lead transitions to LOST with payload.reason='token_budget_exhausted'.
  </behavior>
  <read_first>
    - apps/api/tests/fixtures/canonical-inputs.json (Wave 0 — canon-01, canon-10, canon-11)
    - apps/api/tests/fixtures/injection-attempts.json (Wave 0 — 5 entries)
    - apps/api/tests/_helpers/dialog-harness.ts (Wave 0 — runScript)
    - apps/api/tests/_helpers/mock-anthropic.ts (Wave 0 — MockAnthropicClient)
    - apps/api/tests/_helpers/fake-timers.ts (Wave 0)
    - apps/api/tests/_helpers/db-seed.ts (Wave 0 — DETERMINISTIC_UUIDS)
  </read_first>
  <action>
    **(a) apps/api/tests/fixtures/llm-responses.json** — APPEND fixtures for canon-01 (extractRequest returns from_city='Киев', to_city='Львов', tons=18, body='tent', all confidence 1.0), canon-10 step 2 (UA extract from "Київ-Львів 18т"), canon-11 (injection — returns all null + low confidence), canon-19 (discount below min — but this fixture is for the discount tool, may be omitted in Wave 3).

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
        // Verify price-lock: messages show quoted_price written to DB before reply rendered.
        const events = await db.execute(sql`SELECT to_stage, payload, created_at FROM lead_events WHERE lead_id = ${result.finalLead.id} ORDER BY created_at ASC`);
        const quotedEvent = (events.rows as Array<{ to_stage: string; payload: { quoted_price: string }; created_at: string }>).find((e) => e.to_stage === 'QUOTED');
        expect(quotedEvent).toBeDefined();
        expect(quotedEvent!.payload.quoted_price).toMatch(/^\d+$/);
      }, 60_000);
    });
    ```

    **(c) apps/api/tests/integration/pipeline-sticky-lang.test.ts** — canon-10 path (success criterion #5):
    ```ts
    // Fresh client (NOT from seed) so clients.lang starts null.
    it('"ок" then "Київ-Львів 18т" → lang=ua sticky', async () => {
      const fresh = await db.execute(sql`
        INSERT INTO clients (name, phone, lang) VALUES ('Test', '+380501111111', NULL) RETURNING id
      `);
      const cid = (fresh.rows[0] as { id: string }).id;
      const llm = new MockAnthropicClient();
      await runScript(db, llm, cid, [
        { from: 'client', text: 'ок' },                 // < 20 chars: RU boilerplate, lang NOT yet decided
        { from: 'client', text: 'Київ-Львів 18 тонн тент' },  // UA marker → lang=ua
      ]);
      const c = await db.execute(sql`SELECT lang FROM clients WHERE id = ${cid}`);
      expect((c.rows[0] as { lang: string }).lang).toBe('ua');
      const msgs = await db.execute(sql`SELECT text FROM messages WHERE client_id = ${cid} AND role = 'ai' ORDER BY created_at ASC`);
      const aiTexts = (msgs.rows as Array<{ text: string }>).map((r) => r.text);
      expect(aiTexts.some((t) => /Ціна|підтвер/iu.test(t))).toBe(true);
    }, 60_000);
    ```

    **(d) apps/api/tests/integration/pipeline-injection.test.ts** — Pitfall #11 closure:
    ```ts
    import injections from '../fixtures/injection-attempts.json' with { type: 'json' };
    it.each(injections)('injection %s does not mutate state', async ({ id, text }) => {
      const fresh = await db.execute(sql`INSERT INTO clients (name, phone) VALUES ('Inj', '+7900' || (random()*1e7)::int) RETURNING id`);
      const cid = (fresh.rows[0] as { id: string }).id;
      const llm = new MockAnthropicClient();
      await runScript(db, llm, cid, [{ from: 'client', text }]);
      const lead = await db.execute(sql`SELECT stage, quoted_price FROM leads WHERE client_id = ${cid}`);
      expect((lead.rows[0] as { stage: string; quoted_price: string | null }).stage).toMatch(/^(NEW|LOST)$/);
      const orders = await db.execute(sql`SELECT count(*)::int AS c FROM orders WHERE client_id = ${cid}`);
      expect((orders.rows[0] as { c: number }).c).toBe(0);
    }, 60_000);
    ```

    **(e) apps/api/tests/integration/token-budget.test.ts** — Pitfall #12 closure:
    ```ts
    it('lead with tokens_in+out > 30000 → → LOST on next message', async () => {
      const c = await db.execute(sql`SELECT id FROM clients LIMIT 1`);
      const cid = (c.rows[0] as { id: string }).id;
      const ins = await db.execute(sql`
        INSERT INTO leads (client_id, channel, stage, version, tokens_in, tokens_out)
        VALUES (${cid}, 'test', 'QUOTED', 0, 20000, 15000) RETURNING id
      `);
      const leadId = (ins.rows[0] as { id: string }).id;
      const llm = new MockAnthropicClient();
      await runScript(db, llm, cid, [{ from: 'client', text: 'Любое следующее сообщение' }]);
      const lead = await db.execute(sql`SELECT stage FROM leads WHERE id = ${leadId}`);
      expect((lead.rows[0] as { stage: string }).stage).toBe('LOST');
      const events = await db.execute(sql`SELECT payload FROM lead_events WHERE lead_id = ${leadId} ORDER BY created_at DESC LIMIT 1`);
      expect((events.rows[0] as { payload: { reason: string } }).payload.reason).toBe('token_budget_exhausted');
    }, 60_000);
    ```

    **(f) Flip LOGIC-03, LOGIC-04, MATCH-06 todos in phase-2-stubs.test.ts**: real `it()` calls referencing the integration test files (sanity-checks: city resolver exported; budget constant set; price-lock function path called).

    Constraints:
    - All integration tests gate on testcontainers availability. On Docker-less runner they skip (Phase 1 pattern).
    - Tests use fixtures from Wave 0 — adding more fixtures to llm-responses.json may be necessary as you write the canonical test.
  </action>
  <verify>
    <automated>cd apps/api && test -f tests/integration/pipeline-canonical.test.ts && test -f tests/integration/pipeline-sticky-lang.test.ts && test -f tests/integration/pipeline-injection.test.ts && test -f tests/integration/token-budget.test.ts && grep -q "ORDER_CREATED" tests/integration/pipeline-canonical.test.ts && grep -q "Київ" tests/integration/pipeline-sticky-lang.test.ts && grep -q "injection-attempts" tests/integration/pipeline-injection.test.ts && grep -q "token_budget_exhausted" tests/integration/token-budget.test.ts && pnpm --filter @ai-logist/api typecheck 2>&1 | tail -10 && test "$(grep -c "test.todo" tests/unit/phase-2-stubs.test.ts)" = "1"</automated>
  </verify>
  <done>
    4 integration tests written; LOGIC-03, LOGIC-04, MATCH-06 todos flipped; phase-2-stubs.test.ts has 1 todo remaining (API-07, flipped in Plan 02-05).
  </done>
</task>

</tasks>

<verification>
Wave 3 overall gates:
1. `pnpm --filter @ai-logist/api typecheck` — passes
2. `pnpm exec biome check apps/api/src/pipeline apps/api/tests/integration` — passes
3. `pnpm --filter @ai-logist/api test:integration -- pipeline-canonical pipeline-sticky-lang token-budget advisory-lock follow-up-scheduler pipeline-injection` — Docker-equipped only; all green
4. phase-2-stubs.test.ts shows 1 todo remaining (API-07 — Plan 02-05)
5. dialog-harness.ts no longer has `@ts-expect-error` for intake.ts (statically imported)
</verification>

<success_criteria>
- intake.ts is the single pipeline entry. Implements: advisory lock → persist → sticky lang → token budget → confirm shortcut → extract → clarification budget → city normalization → match → route → price-lock → templated reply with guard.
- follow-up-scheduler.ts shipped (RESEARCH.md §14 VERBATIM); wired into app.ts via registerFollowUpScheduler.
- 6 integration tests cover all 5 ROADMAP success criteria:
  - #1 canonical "Киев-Львов 18 тонн тент" → ORDER_CREATED (pipeline-canonical)
  - #4 concurrency (in Plan 02-03 fsm-concurrency)
  - #5 sticky lang "ок" → "Київ-Львів" → ua (pipeline-sticky-lang)
  - Pitfall #11 — injection (pipeline-injection)
  - Pitfall #12 — token budget (token-budget)
- FSM-04 (advisory lock) + FSM-06 (auto-follow-up) flipped via dedicated tests.
- 5 more todos flipped: LOGIC-03, LOGIC-04, MATCH-06, FSM-04, FSM-06. Only 1 todo remains (API-07).
- dialog-harness statically imports handleInboundMessage.
</success_criteria>

<output>
After completion, create `.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-04-SUMMARY.md` documenting:
- handleInboundMessage signature (final — Phase 3 webhook calls it verbatim)
- Pipeline step ordering (advisory lock → persist → lang → budget → confirm → extract → clarify → city → match → price-lock)
- Price-lock protocol verification: leads.quoted_price written before reply rendered
- Scheduler shipped (60s poll); SIGTERM-safe via onClose hook
- Defensive priceGuard applied even to templated replies (future-proofing)
- 5 todos flipped this wave; only API-07 remains for Wave 4
- Closes Pitfalls #1 (LLM in money path via createOrder DB re-read), #6 (FSM races via advisory lock + version CAS), #7 (sticky lang), #11 (anti-injection via tool boundaries), #12 (token-budget LOST)
</output>
