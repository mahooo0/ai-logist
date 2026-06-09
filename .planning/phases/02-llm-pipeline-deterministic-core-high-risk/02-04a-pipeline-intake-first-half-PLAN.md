---
phase: 02-llm-pipeline-deterministic-core-high-risk
plan: 04a
type: execute
wave: 4
depends_on:
  - "02-02"
  - "02-03"
  - "02-03b"
files_modified:
  - apps/api/src/pipeline/intake.ts
  - apps/api/tests/_helpers/dialog-harness.ts
  - apps/api/tests/fixtures/llm-responses.json
  - apps/api/tests/integration/pipeline-sticky-lang.test.ts
  - apps/api/tests/integration/token-budget.test.ts
  - apps/api/tests/integration/pipeline-injection.test.ts
  - apps/api/tests/unit/phase-2-stubs.test.ts
autonomous: true
requirements:
  - LOGIC-03
  - LOGIC-04

must_haves:
  truths:
    - "intake.ts SKELETON (first half) exports handleInboundMessage(args) → opens db.transaction, acquires pg_advisory_xact_lock(hashtext(client_id)) at the START (FSM-04 deferred to 04b advisory-lock test)."
    - "Step A persists inbound message + finds-or-creates open lead via leadsRepo + messagesRepo."
    - "Step B implements sticky language detection (D-12..D-15): clients.lang null + text < 20 chars → RU boilerplate reply (no lang saved); ≥ 20 chars + cyrillic_heuristic UA → lang='ua' saved; ≥ 20 chars + no UA marker → default 'ru' saved. NEVER re-detect."
    - "Step C: token-budget check — if leads.tokens_in + tokens_out > LLM_TOKEN_BUDGET_PER_LEAD → transitionLead(→LOST, payload:{reason:'token_budget_exhausted'}) and early-return with sorry reply."
    - "Step D: extract request (LOGIC-01) — call extractRequestHandler with `<client_message>...` wrapping; increment token ledger atomically via UPDATE leads SET tokens_in = tokens_in + $usage.input_tokens..."
    - "Step E: clarification budget (LOGIC-04) — if confidence.from_city or confidence.to_city or confidence.tons < 0.7 → emit clarifying question (max 2 rounds counted via messages.text LIKE pattern); after 2 rounds → leave at NEW + manual-triage payload + sorry reply."
    - "Step F: city normalization (LOGIC-03) — cities ILIKE on name_ru OR name_ua first; geocoding/Nominatim fallback; persist resolved cities via citiesRepo.upsert."
    - "intake.ts does NOT yet contain match/price-lock/confirm/scheduler logic — those land in Plan 02-04b."
    - "dialog-harness.ts no longer carries @ts-expect-error for intake.ts (statically imports handleInboundMessage)."
    - "Plan 02-04a flips LOGIC-03 + LOGIC-04 todos in phase-2-stubs.test.ts. No file overlap with other Wave 3 plans (02-04b owns FSM-04 + FSM-06 flips)."
  artifacts:
    - path: "apps/api/src/pipeline/intake.ts"
      provides: "handleInboundMessage entry point — first half (lang, budget, extract, clarify, city)"
      contains: "pg_advisory_xact_lock"
  key_links:
    - from: "src/pipeline/intake.ts"
      to: "pg_advisory_xact_lock(hashtext(client_id))"
      via: "SELECT inside outer db.transaction"
      pattern: "pg_advisory_xact_lock.*hashtext"
    - from: "src/pipeline/intake.ts"
      to: "leads.tokens_in, leads.tokens_out, leads.llm_calls"
      via: "UPDATE after every llm.runTurn"
      pattern: "tokens_in.*=.*tokens_in.*\\+"
    - from: "src/pipeline/intake.ts"
      to: "clients.lang"
      via: "clientsRepo.update after cyrillic heuristic on first long message"
      pattern: "clientsRepo.update.*lang|lang.*ua|lang.*ru"
    - from: "src/pipeline/intake.ts"
      to: "src/lib/lang-detect.ts"
      via: "import cyrillicHeuristic for D-12 sticky detection"
      pattern: "cyrillicHeuristic"
---

<objective>
Wave 3 (first plan) — ship the FIRST HALF of `apps/api/src/pipeline/intake.ts`: advisory lock, sticky language, token budget, extract → clarify, city resolution.

Purpose:
- Split of original Plan 02-04 (per checker BLOCKER #1: 13 files / ~400-line single file was too large).
- This plan covers Steps 0 + A + B + C + D + E + F of the pipeline.
- Plan 02-04b owns Steps G + H + I + J (match, price-lock, confirm, scheduler).
- intake.ts at end of this plan is a partial implementation — it returns AFTER city resolution with a placeholder reply ("price calculation coming in 02-04b"). Tests verify only the steps owned by this plan.
- Closes Pitfalls #7 (sticky lang) + #12 (token budget) at the code level.
- Flip 2 todos: LOGIC-03 (city normalization), LOGIC-04 (clarification budget).

Output: 1 production file (intake.ts — partial), updated dialog-harness, 3 integration tests (sticky-lang, token-budget, injection), 2 todos flipped.
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
@.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-03b-SUMMARY.md
@apps/api/src/lib/lang-detect.ts
@apps/api/src/lib/geocoding.ts
@apps/api/src/pipeline/llm-client.ts
@apps/api/src/pipeline/llm-tools/extract-request.ts
@apps/api/src/pipeline/lifecycle/lead-fsm.ts
@apps/api/src/persistence/repos/clients.ts
@apps/api/src/persistence/repos/leads.ts
@apps/api/src/persistence/repos/messages.ts
@apps/api/src/persistence/repos/cities.ts
@apps/api/tests/_helpers/dialog-harness.ts
@apps/api/tests/fixtures/canonical-inputs.json
@apps/api/tests/fixtures/injection-attempts.json

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
// runScript calls handleInboundMessage which this plan provides (partial).
```

Wave 2a extractRequestHandler:
```typescript
extractRequestHandler({llm, ctx, text, clientLang}): Promise<ExtractRequestOutput>
```

Wave 2b transitionLead:
```typescript
transitionLead(db, {leadId, to, actor, payload?}): Promise<{from, to, version}>
```

Phase 1 + Wave 1 leads columns relevant here:
- stage, version (CAS)
- tokensIn, tokensOut, llmCalls (Wave 1 token ledger)
- fromCityId, toCityId, tons, bodyType (extraction results)
- quotedPrice (NOT touched by this plan; Plan 02-04b owns)

Phase 1 messages repo:
- messagesRepo.create(db, {clientId, leadId, role, text}): Promise<Message>
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: intake.ts skeleton + advisory lock + persist + sticky lang + token-budget check + dialog-harness static import</name>
  <files>apps/api/src/pipeline/intake.ts, apps/api/tests/_helpers/dialog-harness.ts, apps/api/tests/integration/token-budget.test.ts, apps/api/tests/integration/pipeline-sticky-lang.test.ts, apps/api/tests/integration/pipeline-injection.test.ts</files>
  <behavior>
    - handleInboundMessage(args) is async, returns `{leadId: string, exchanges: Array<{role: 'user'|'assistant'|'tool', content: unknown}>}`.
    - Outer pattern: `await args.db.transaction(async (tx) => { await tx.execute(sql\`SELECT pg_advisory_xact_lock(hashtext(${args.clientId}))\`); ... })`.
    - Step A — Persist message + find/create lead in NEW (open = stage NOT IN ('DONE','LOST','ORDER_CREATED','IN_PROGRESS')).
    - Step B — Sticky language detection (D-12..D-15):
      - clients.lang null + text.length < 20 → RU boilerplate reply ("Здравствуйте! Расскажите подробнее: откуда, куда, сколько тонн?") + DO NOT save lang.
      - clients.lang null + text.length ≥ 20 → cyrillicHeuristic(text). If UA marker → save lang='ua'. Else → save lang='ru' (default).
      - clients.lang set → reuse it (sticky — NEVER re-detect).
    - Step C — Token budget check (Pitfall #12): read leads.tokens_in + tokens_out; if > LLM_TOKEN_BUDGET_PER_LEAD → transitionLead(→LOST, payload:{reason:'token_budget_exhausted'}) + sorry reply + early return.
    - Token-ledger UPDATE pattern (used after every LLM call in this plan + 04b):
      ```sql
      UPDATE leads SET tokens_in = tokens_in + ${usage.input_tokens},
                       tokens_out = tokens_out + ${usage.output_tokens},
                       llm_calls = llm_calls + 1,
                       updated_at = NOW()
      WHERE id = ${leadId}
      ```
    - At end of Task 1, intake.ts returns AFTER Step C with a placeholder reply ("Step D extract/clarify lands in Task 2") if no early return triggered. Task 2 extends.
    - dialog-harness.ts: static `import { handleInboundMessage, type InboundMessageResult } from '../../src/pipeline/intake.js'` (no @ts-expect-error).
    - **Sticky-lang test MUST include three assertions (per CHECKER additional fix):**
      1. First message ("ок", <20 chars) → no lang saved.
      2. Second message ("Київ-Львів 18т", UA markers) → lang='ua' saved + AI reply contains UA text.
      3. **Third message: client sends RU text "Сколько стоит?" → AI reply STAYS UA (sticky test) — verifies clients.lang doesn't flip on subsequent RU messages.**
  </behavior>
  <read_first>
    - .planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-RESEARCH.md §6.5 (advisory lock SQL VERBATIM), "Pitfall 6: token-ledger" (atomic UPDATE block)
    - .planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-CONTEXT.md D-12..D-15 (sticky lang), D-30 (advisory lock), D-36 (token ledger)
    - apps/api/src/persistence/repos/leads.ts (leadsRepo.findById, update)
    - apps/api/src/persistence/repos/clients.ts (findById, update for lang)
    - apps/api/src/persistence/repos/messages.ts (create)
    - apps/api/src/pipeline/lifecycle/lead-fsm.ts (Wave 2b — transitionLead signature)
    - apps/api/tests/_helpers/dialog-harness.ts (Wave 0 — handleInboundMessage signature this plan must implement)
    - apps/api/tests/fixtures/injection-attempts.json (Wave 0 — 5 entries used by pipeline-injection.test.ts)
  </read_first>
  <action>
    **(a) apps/api/src/pipeline/intake.ts** — Task 1 skeleton (Task 2 extends with extract → clarify → city resolve; Plan 02-04b extends with match → price-lock → confirm → scheduler).

    ```ts
    import { sql } from 'drizzle-orm';
    import type { FastifyBaseLogger } from 'fastify';
    import type { Db } from '../db.js';
    import { config } from '../config.js';
    import { cyrillicHeuristic, type Lang } from '../lib/lang-detect.js';
    import { clientsRepo, leadsRepo, messagesRepo } from '../persistence/repos/index.js';
    import { transitionLead } from './lifecycle/lead-fsm.js';
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
          // else lang stays 'ru' (default per D-13 fallback)
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

        // STEP D — Task 2 of this plan extends here (extract + clarify + city resolve).
        // Plan 02-04b extends after that (match + price-lock + confirm).
        // For Task 1 only: placeholder reply so smoke tests pass.
        const placeholder = lang === 'ua' ? 'Обробка запиту…' : 'Обрабатываю запрос…';
        await messagesRepo.create(tx as Db, { clientId: args.clientId, leadId: lead.id, role: 'ai', text: placeholder });
        exchanges.push({ role: 'assistant', content: placeholder });
        return { leadId: lead.id, exchanges };
      });
    }

    // Helpers
    async function findOpenLead(db: Db, clientId: string) {
      const rows = await db.execute(sql`SELECT * FROM leads WHERE client_id = ${clientId} AND stage NOT IN ('DONE','LOST','ORDER_CREATED','IN_PROGRESS') ORDER BY updated_at DESC LIMIT 1`);
      return rows.rows[0] as any | undefined;
    }
    export async function incrementTokenLedger(db: Db, leadId: string, usage: { input_tokens: number; output_tokens: number }): Promise<void> {
      await db.execute(sql`
        UPDATE leads SET tokens_in = tokens_in + ${usage.input_tokens},
                         tokens_out = tokens_out + ${usage.output_tokens},
                         llm_calls = llm_calls + 1,
                         updated_at = NOW()
        WHERE id = ${leadId}
      `);
    }
    ```

    **(b) apps/api/tests/_helpers/dialog-harness.ts** — REMOVE the `@ts-expect-error` Wave-0 directive. Import statically:
    ```ts
    import { handleInboundMessage, type InboundMessageResult } from '../../src/pipeline/intake.js';
    ```
    Update the result extraction to use the typed `InboundMessageResult` shape.

    **(c) apps/api/tests/integration/token-budget.test.ts** — Pitfall #12 closure:
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

    **(d) apps/api/tests/integration/pipeline-sticky-lang.test.ts** — D-12 sticky verification (3 assertions per checker):
    ```ts
    // Fresh client (NOT from seed) so clients.lang starts null.
    it('sticky lang: "ок" → "Київ-Львів 18т" → ua; subsequent RU message keeps UA reply', async () => {
      const fresh = await db.execute(sql`
        INSERT INTO clients (name, phone, lang) VALUES ('Test', '+380501111111', NULL) RETURNING id
      `);
      const cid = (fresh.rows[0] as { id: string }).id;
      const llm = new MockAnthropicClient();

      // Assertion 1: "ок" (<20 chars) — RU boilerplate, lang NOT saved
      await runScript(db, llm, cid, [{ from: 'client', text: 'ок' }]);
      const after1 = await db.execute(sql`SELECT lang FROM clients WHERE id = ${cid}`);
      expect((after1.rows[0] as { lang: string | null }).lang).toBeNull();

      // Assertion 2: "Київ-Львів 18 тонн тент" (UA markers) — lang='ua' saved + AI reply UA
      await runScript(db, llm, cid, [{ from: 'client', text: 'Київ-Львів 18 тонн тент' }]);
      const after2 = await db.execute(sql`SELECT lang FROM clients WHERE id = ${cid}`);
      expect((after2.rows[0] as { lang: string }).lang).toBe('ua');
      const msgs2 = await db.execute(sql`SELECT text FROM messages WHERE client_id = ${cid} AND role = 'ai' ORDER BY created_at ASC`);
      const aiTexts2 = (msgs2.rows as Array<{ text: string }>).map((r) => r.text);
      // AI reply for UA client must contain UA-shape text (Обробка/Ціна/підтвер/Перевищили/etc.)
      expect(aiTexts2.some((t) => /Обробка|Ціна|підтвер|Перевищили|Зв'яжіться/iu.test(t))).toBe(true);

      // Assertion 3 (CRITICAL — sticky test per CONTEXT D-12): client sends RU message after UA was detected.
      // Expectation: AI reply STAYS UA. clients.lang stays 'ua'. Sticky verified.
      await runScript(db, llm, cid, [{ from: 'client', text: 'Сколько стоит, объясните пожалуйста?' }]);
      const after3 = await db.execute(sql`SELECT lang FROM clients WHERE id = ${cid}`);
      expect((after3.rows[0] as { lang: string }).lang).toBe('ua');  // lang DID NOT flip back to ru
      const msgs3 = await db.execute(sql`SELECT text FROM messages WHERE client_id = ${cid} AND role = 'ai' ORDER BY created_at DESC LIMIT 1`);
      const latestAi = (msgs3.rows[0] as { text: string }).text;
      // Latest AI reply must contain UA-shape text — RU boilerplate would NOT match this pattern.
      expect(/Обробка|Ціна|підтвер|Перевищили|Зв'яжіться/iu.test(latestAi)).toBe(true);
    }, 90_000);
    ```

    **(e) apps/api/tests/integration/pipeline-injection.test.ts** — Pitfall #11 closure (early version; full coverage extends in 02-04b once match/price-lock land):
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

    Sequence:
    1. Write `intake.ts` skeleton (Step 0 + A + B + C + placeholder return).
    2. Update `dialog-harness.ts` (remove @ts-expect-error, static import).
    3. Write `token-budget.test.ts`.
    4. Write `pipeline-sticky-lang.test.ts` (3 assertions — incl. RU-after-UA).
    5. Write `pipeline-injection.test.ts`.
    6. Run typecheck + biome.
  </action>
  <verify>
    <automated>cd apps/api && test -f src/pipeline/intake.ts && grep -q "pg_advisory_xact_lock.*hashtext" src/pipeline/intake.ts && grep -q "LLM_TOKEN_BUDGET_PER_LEAD" src/pipeline/intake.ts && grep -q "RU_BOILERPLATE_SHORT" src/pipeline/intake.ts && grep -q "cyrillicHeuristic" src/pipeline/intake.ts && grep -q "import.*handleInboundMessage" tests/_helpers/dialog-harness.ts && ! grep -q "@ts-expect-error pipeline" tests/_helpers/dialog-harness.ts && grep -q "subsequent RU message keeps UA reply\|lang DID NOT flip back" tests/integration/pipeline-sticky-lang.test.ts && pnpm --filter @ai-logist/api typecheck 2>&1 | tail -10</automated>
  </verify>
  <done>
    intake.ts implements Steps 0+A+B+C; dialog-harness.ts static-imports handleInboundMessage; sticky-lang test has 3 assertions including RU-after-UA stickiness; token-budget test asserts LOST transition; injection test asserts no mutation; tsc passes.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: intake.ts extract + clarify + city resolve (Steps D + E + F) + 2-round budget + flip LOGIC-03 + LOGIC-04 todos</name>
  <files>apps/api/src/pipeline/intake.ts, apps/api/tests/fixtures/llm-responses.json, apps/api/tests/unit/phase-2-stubs.test.ts</files>
  <behavior>
    - Extend intake.ts beyond Task 1's placeholder:
    - Step D (LOGIC-01): call extractRequestHandler. Increment token ledger AFTER the call (before any early-return).
    - Step E (LOGIC-04): clarification budget = 2 rounds. Counter = messages count where role='ai' AND text LIKE '%Уточн%' OR text LIKE '%уточн%'. If confidence.from_city OR confidence.to_city OR confidence.tons < 0.7:
      - counter < 2 → emit clarifying_question_${lang} (from extract result) + persist as AI message + return.
      - counter ≥ 2 → leave lead at NEW + persist manual-triage payload via leadsRepo.update + sorry reply + return.
    - Step F (LOGIC-03): city normalization. For both from_city + to_city:
      1. Local lookup: `SELECT id, ST_X(geom::geometry) AS lon, ST_Y(geom::geometry) AS lat FROM cities WHERE name_ru ILIKE ${name} OR name_ua ILIKE ${name} LIMIT 1`.
      2. Miss → geocode(name, ['ru','ua']) (Wave 1 Nominatim adapter). Parse pointWkt. citiesRepo.upsert.
      3. If both resolve → persist via leadsRepo.update({fromCityId, toCityId, tons, bodyType}). Continue.
      4. If either fails → emit "Не нашёл город. Уточните." (RU) / "Не знайшов місто. Уточніть." (UA) + persist + return.
    - At end of Task 2 (this plan complete): intake.ts returns AFTER successful city resolution with a placeholder reply "Match + price-lock land in 02-04b". Plan 02-04b extends.
    - llm-responses.json gains fixture entries for canon-01 (RU literal Київ-Львів), canon-02 (UA literal), canon-04 (ambiguous tons → clarifying_question), canon-11 (injection — null fields).
    - Flip LOGIC-03 + LOGIC-04 todos in phase-2-stubs.test.ts. These flips are exclusive to this plan; no overlap with 02-04b (which flips FSM-04 + FSM-06) or 02-05 (API-07).
  </behavior>
  <read_first>
    - apps/api/src/pipeline/intake.ts (Task 1 output to extend)
    - apps/api/src/pipeline/llm-tools/extract-request.ts (Wave 2a — extractRequestHandler + ExtractRequestOutput)
    - apps/api/src/lib/geocoding.ts (Wave 1 — geocode adapter)
    - apps/api/src/persistence/repos/cities.ts (findBySlug, upsert)
    - apps/api/tests/fixtures/canonical-inputs.json (Wave 0 — canon-01..04 inputs)
    - apps/api/tests/unit/phase-2-stubs.test.ts (current state after 02-03b — should have 5 todos remaining; this plan flips 2 → 3 remaining for 02-04b + 02-05)
  </read_first>
  <action>
    Extend `apps/api/src/pipeline/intake.ts` with Steps D + E + F. The Task 1 placeholder return is replaced by extract → clarify → city resolve → placeholder for Plan 02-04b.

    Add imports:
    ```ts
    import { geocode } from '../lib/geocoding.js';
    import { citiesRepo } from '../persistence/repos/index.js';
    import { extractRequestHandler } from './llm-tools/extract-request.js';
    import type { ToolContext } from './llm-tools/index.js';
    ```

    Replace the "Task 1 placeholder" section with:
    ```ts
    // STEP D — Extract (LOGIC-01) + token accounting.
    const wrapped = `<client_message>${args.text}</client_message>`;
    const llmResult = await args.llm.runTurn({
      systemPrompt: '/* prompt from extract-request.prompt.ts */',
      userMessages: [{ role: 'user', content: wrapped }],
      toolNames: ['extractRequest'],
    });
    await incrementTokenLedger(tx as Db, lead.id, llmResult.usage);
    const extracted = parseExtractResult(llmResult);

    // STEP E — Clarification budget (LOGIC-04).
    const lowConfidence = extracted.confidence.from_city < 0.7 || extracted.confidence.to_city < 0.7 || extracted.confidence.tons < 0.7;
    if (lowConfidence) {
      const clarifyCount = await countClarificationRounds(tx as Db, lead.id);
      if (clarifyCount >= 2) {
        // Mark for manual triage, leave at NEW.
        await leadsRepo.update(tx as Db, lead.id, { /* annotation via payload elsewhere */ });
        const reply = lang === 'ua' ? 'Не вдалося розпізнати. Менеджер зв\'яжеться.' : 'Не удалось понять. Менеджер свяжется.';
        await messagesRepo.create(tx as Db, { clientId: args.clientId, leadId: lead.id, role: 'ai', text: reply });
        exchanges.push({ role: 'assistant', content: reply });
        return { leadId: lead.id, exchanges };
      }
      const q = lang === 'ua'
        ? (extracted.clarifying_question_ua ?? 'Уточніть місто та тоннаж.')
        : (extracted.clarifying_question_ru ?? 'Уточните город и тоннаж.');
      await messagesRepo.create(tx as Db, { clientId: args.clientId, leadId: lead.id, role: 'ai', text: q });
      exchanges.push({ role: 'assistant', content: q });
      return { leadId: lead.id, exchanges };
    }

    // STEP F — City normalization (LOGIC-03).
    const fromCity = await resolveCity(tx as Db, extracted.from_city!, args.log);
    const toCity = await resolveCity(tx as Db, extracted.to_city!, args.log);
    if (!fromCity || !toCity) {
      const reply = lang === 'ua' ? 'Не знайшов місто. Уточніть.' : 'Не нашёл город. Уточните.';
      await messagesRepo.create(tx as Db, { clientId: args.clientId, leadId: lead.id, role: 'ai', text: reply });
      exchanges.push({ role: 'assistant', content: reply });
      return { leadId: lead.id, exchanges };
    }
    await leadsRepo.update(tx as Db, lead.id, {
      fromCityId: fromCity.id, toCityId: toCity.id,
      tons: String(extracted.tons!), bodyType: extracted.body_type,
    });

    // Placeholder — Plan 02-04b extends with match + price-lock + confirm.
    const placeholder = lang === 'ua' ? 'Обчислюю ціну…' : 'Подбираю машину…';
    await messagesRepo.create(tx as Db, { clientId: args.clientId, leadId: lead.id, role: 'ai', text: placeholder });
    exchanges.push({ role: 'assistant', content: placeholder });
    return { leadId: lead.id, exchanges };
    ```

    Add helpers at the bottom:
    ```ts
    async function countClarificationRounds(db: Db, leadId: string): Promise<number> {
      const rows = await db.execute(sql`SELECT count(*)::int AS c FROM messages WHERE lead_id = ${leadId} AND role = 'ai' AND (text LIKE '%Уточн%' OR text LIKE '%уточн%')`);
      return Number((rows.rows[0] as { c: number }).c);
    }
    async function resolveCity(db: Db, name: string, log: FastifyBaseLogger | undefined): Promise<{ id: string; lonLat: { lon: number; lat: number } } | null> {
      const local = await db.execute(sql`SELECT id, ST_X(geom::geometry) AS lon, ST_Y(geom::geometry) AS lat FROM cities WHERE name_ru ILIKE ${name} OR name_ua ILIKE ${name} LIMIT 1`);
      const hit = local.rows[0] as { id: string; lon: number; lat: number } | undefined;
      if (hit) return { id: hit.id, lonLat: { lon: hit.lon, lat: hit.lat } };
      const geo = await geocode(name, ['ru', 'ua'], log);
      if (!geo) return null;
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
    ```

    **(b) apps/api/tests/fixtures/llm-responses.json** — APPEND fixture entries keyed by `extractRequest::<hash>` for canon-01 (RU literal), canon-02 (UA literal), canon-04 (ambiguous → clarifying_question_ru populated), canon-11 (injection — all null + low confidence). Each entry has shape:
    ```json
    {
      "<hash>": {
        "toolCalls": [{ "name": "extractRequest", "args": { "from_city": "Киев", "to_city": "Львов", "tons": 18, "body_type": "tent", "budget_kopecks": null, "deadline_iso": null, "confidence": { "from_city": 1, "to_city": 1, "tons": 1 }, "clarifying_question_ru": null, "clarifying_question_ua": null } }],
        "finalText": null,
        "usage": { "input_tokens": 50, "output_tokens": 30 }
      }
    }
    ```
    Use deterministic token counts (input=50, output=30) for snapshot stability. Hash key = sha256_prefix(systemPrompt + lastUser).slice(0,16) — generate by running the production hash function on the canonical input string.

    **(c) Flip LOGIC-03 + LOGIC-04 todos in apps/api/tests/unit/phase-2-stubs.test.ts**:
    ```ts
    // LOGIC-03 — city normalization (was: test.todo)
    it('LOGIC-03: cities ILIKE + Nominatim fallback wired in intake.ts', async () => {
      const src = await readFile('src/pipeline/intake.ts', 'utf8');
      expect(src).toMatch(/name_ru ILIKE.*name_ua ILIKE/);
      expect(src).toMatch(/geocode/);
      expect(src).toMatch(/citiesRepo.upsert/);
      // Full coverage: tests/integration/pipeline-sticky-lang.test.ts exercises the path end-to-end.
    });

    // LOGIC-04 — clarification budget = 2 rounds (was: test.todo)
    it('LOGIC-04: clarification budget enforced via countClarificationRounds', async () => {
      const src = await readFile('src/pipeline/intake.ts', 'utf8');
      expect(src).toMatch(/countClarificationRounds/);
      expect(src).toMatch(/clarifyCount >= 2/);
      expect(src).toMatch(/clarifying_question_(ru|ua)/);
    });
    ```

    Verify: `grep -c "test.todo" tests/unit/phase-2-stubs.test.ts` = 3 (FSM-04, FSM-06, API-07 — owned by 02-04b + 02-05).

    Sequence:
    1. Extend intake.ts with Steps D + E + F.
    2. Append fixtures to llm-responses.json.
    3. Flip LOGIC-03 + LOGIC-04 todos.
    4. Run typecheck + biome + sticky-lang/token-budget/injection integration tests.
  </action>
  <verify>
    <automated>cd apps/api && grep -q "extractRequestHandler\|extractRequest" src/pipeline/intake.ts && grep -q "countClarificationRounds" src/pipeline/intake.ts && grep -q "geocode" src/pipeline/intake.ts && grep -q "citiesRepo.upsert" src/pipeline/intake.ts && grep -q "name_ru ILIKE" src/pipeline/intake.ts && grep -q "clarifying_question" src/pipeline/intake.ts && test "$(grep -c "test.todo" tests/unit/phase-2-stubs.test.ts)" = "3" && pnpm --filter @ai-logist/api typecheck 2>&1 | tail -10 && pnpm --filter @ai-logist/api test:unit -- phase-2-stubs 2>&1 | tail -15</automated>
  </verify>
  <done>
    intake.ts extended with Steps D (extract) + E (clarification budget) + F (city resolve); llm-responses.json has fixtures for at least canon-01/02/04/11; LOGIC-03 + LOGIC-04 todos flipped; phase-2-stubs.test.ts has 3 todos remaining (FSM-04, FSM-06, API-07).
  </done>
</task>

</tasks>

<verification>
Plan 02-04a overall gates:
1. `pnpm --filter @ai-logist/api typecheck` — passes
2. `pnpm exec biome check apps/api/src/pipeline apps/api/tests/integration` — passes
3. `pnpm --filter @ai-logist/api test:unit -- phase-2-stubs` — 15 passing, 3 todo
4. `pnpm --filter @ai-logist/api test:integration -- pipeline-sticky-lang token-budget pipeline-injection` — Docker-equipped only; green
5. dialog-harness.ts no longer has `@ts-expect-error` for intake.ts (statically imported)
6. intake.ts has Step 0 + A + B + C + D + E + F (Steps G + H + I + J land in Plan 02-04b)
</verification>

<success_criteria>
- intake.ts is the partial pipeline entry — covers advisory lock, persist, sticky lang, token budget, extract, clarify, city resolve.
- Sticky-lang test has 3 assertions (per checker additional fix): lang=null after short msg, lang=ua after UA-marker msg, lang STAYS ua after subsequent RU msg.
- Token-budget test verifies → LOST transition with payload.reason='token_budget_exhausted'.
- Pipeline-injection test verifies no mutation across 5 injection attempts (orders count = 0; stage ∈ {NEW, LOST}).
- LOGIC-03 + LOGIC-04 todos flipped; phase-2-stubs.test.ts has 3 todos remaining (FSM-04, FSM-06, API-07).
- intake.ts STILL ends in a placeholder reply at Step F end — Plan 02-04b extends to Steps G-J.
- File overlap eliminated: 02-04a writes intake.ts + the 3 integration tests; 02-04b writes follow-up-scheduler.ts + advisory-lock + scheduler integration tests + extends intake.ts.
- Closes Pitfalls #7 (sticky lang) + #12 (token budget) at code level.
</success_criteria>

<output>
After completion, create `.planning/phases/02-llm-pipeline-deterministic-core-high-risk/02-04a-SUMMARY.md` documenting:
- handleInboundMessage current signature (will not change in 02-04b)
- Pipeline step ordering 0-F: advisory lock → persist → lang → budget → extract → clarify → city
- Sticky-lang 3-assertion test as the formal closure of Pitfall #7
- Defensive priceGuard NOT YET applied (lands in 02-04b)
- 2 todos flipped this plan (LOGIC-03, LOGIC-04); 02-04b owns FSM-04, FSM-06; 02-05 owns API-07
- Plan 02-04b consumes this intake.ts skeleton; the contract: extracted/fromCity/toCity persisted to leads before 02-04b's Steps G+ run.
</output>
