// Phase 2 Plan 02-04a — Wave 3 intake pipeline FIRST HALF.
//
// TASK 1 SCOPE (this commit): Steps 0 + A + B + C + placeholder.
//   STEP 0 — Per-client serialization via pg_advisory_xact_lock(hashtext(client_id))
//            (CONTEXT D-30, FSM-04).
//   STEP A — Persist incoming message + find-or-create open lead.
//   STEP B — Sticky language detection (CONTEXT D-12..D-15, LOGIC-02). Sticky =
//            detection runs ONCE on first message ≥ 20 chars; clients.lang never
//            auto-flips on later messages.
//   STEP C — Token-budget check (CONTEXT D-36, Pitfall #12). If
//            leads.tokens_in + tokens_out > LLM_TOKEN_BUDGET_PER_LEAD →
//            transitionLead → LOST with reason='token_budget_exhausted'.
//   PLACEHOLDER — Step D extract / Step E clarify / Step F city land in Task 2 of
//                 this same plan (committed separately).
//
// TASK 2 will extend with:
//   STEP D — extractRequest tool call + token-ledger UPDATE (LOGIC-01).
//   STEP E — Clarification budget = 2 rounds (LOGIC-04).
//   STEP F — City normalization (LOGIC-03).
//
// Steps G..J (match → price-lock → confirm → scheduler) land in Plan 02-04b.
//
// Test surface — this file is consumed by:
//   - apps/api/tests/_helpers/dialog-harness.ts via static `import { handleInboundMessage }`.
//   - apps/api/tests/integration/{token-budget,pipeline-sticky-lang,pipeline-injection}.test.ts.

import { sql } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import { config } from '../config.js';
import type { Db } from '../db.js';
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

export interface InboundMessageExchange {
  role: 'user' | 'assistant' | 'tool';
  content: unknown;
}

export interface InboundMessageResult {
  leadId: string;
  exchanges: InboundMessageExchange[];
}

/**
 * D-14 boilerplate sent to a client whose lang is still NULL and who wrote a
 * message shorter than 20 chars — too short to reliably detect language.
 */
const RU_BOILERPLATE_SHORT = 'Здравствуйте! Расскажите подробнее: откуда, куда, сколько тонн?';

const TOKEN_BUDGET_SORRY_RU = 'Превышен бюджет диалога. Свяжитесь с менеджером.';
const TOKEN_BUDGET_SORRY_UA = "Перевищили бюджет. Будь ласка, зв'яжіться з менеджером.";

// Task 1 placeholder — Task 2 of this plan replaces with extract → clarify →
// city resolve. The placeholder lets the dialog-harness compile and the sticky-
// lang / injection / token-budget tests exercise Steps 0-C deterministically.
const PLACEHOLDER_PROCESSING_RU = 'Обрабатываю запрос…';
const PLACEHOLDER_PROCESSING_UA = 'Обробка запиту…';

/**
 * Pipeline entry-point for an inbound client message.
 *
 * Wave 0 dialog-harness calls this; Plan 02-04b extends past Step F; Phase 3
 * Telegram webhook wires it behind grammY's update handler.
 *
 * Contract:
 *   - Wraps the WHOLE turn in `db.transaction(...)` so the advisory xact lock,
 *     the row-level FOR UPDATE inside transitionLead, AND the token-ledger
 *     UPDATE all share a single rollback boundary.
 *   - Acquires `pg_advisory_xact_lock(hashtext(client_id))` FIRST (CONTEXT D-30)
 *     — every other transaction touching the same client blocks here.
 *   - Returns `{leadId, exchanges[]}`; exchanges feed dialog-harness.runScript
 *     for snapshot tests + Phase 3's Telegram reply sender.
 */
export async function handleInboundMessage(
  args: InboundMessageArgs
): Promise<InboundMessageResult> {
  return await args.db.transaction(async (txRaw) => {
    const tx = txRaw as unknown as Db;

    // STEP 0 — Per-client serialization (CONTEXT D-30, FSM-04).
    // hashtext(text) returns int4; implicit cast to bigint satisfies the
    // single-arg pg_advisory_xact_lock signature. Released at COMMIT/ROLLBACK.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${args.clientId}))`);

    const exchanges: InboundMessageExchange[] = [];

    // STEP A — Persist message + find-or-create open lead.
    const client = await clientsRepo.findById(tx, args.clientId);
    if (!client) {
      throw new Error(`handleInboundMessage: client ${args.clientId} not found`);
    }

    let lead = await findOpenLead(tx, args.clientId);
    if (!lead) {
      const created = await leadsRepo.create(tx, {
        clientId: args.clientId,
        channel: args.channel,
        stage: 'NEW',
        version: 0,
      });
      lead = {
        id: created.id,
        stage: created.stage,
        tokensIn: created.tokensIn,
        tokensOut: created.tokensOut,
        version: created.version,
      };
    }

    // Inbound message goes into the chat history first so the audit log captures
    // even the messages that subsequently trip the token budget / injection guard.
    await messagesRepo.create(tx, {
      clientId: args.clientId,
      leadId: lead.id,
      role: 'client',
      text: args.text,
    });
    exchanges.push({ role: 'user', content: args.text });

    // STEP B — Sticky language detection (CONTEXT D-12..D-15, LOGIC-02).
    //
    // Sticky-ness is enforced by ONLY running detection when `client.lang` is
    // null. Fresh clients created with `lang = NULL` go through the
    // `if (!client.lang)` branch below; clients with a saved lang skip
    // detection entirely (the value is "sticky" for the rest of the dialog).
    let lang: Lang = ((client.lang as Lang | null) ?? 'ru') as Lang;
    if (!client.lang) {
      if (args.text.length < 20) {
        // D-14 — too short to detect; reply with RU boilerplate WITHOUT
        // saving clients.lang. Subsequent messages will retry detection.
        await messagesRepo.create(tx, {
          clientId: args.clientId,
          leadId: lead.id,
          role: 'ai',
          text: RU_BOILERPLATE_SHORT,
        });
        exchanges.push({ role: 'assistant', content: RU_BOILERPLATE_SHORT });
        return { leadId: lead.id, exchanges };
      }
      // ≥20 chars — two-detector vote: Cyrillic heuristic first; LLM-based
      // detector is deferred (D-13 step 2) — for the demo we fall back to RU
      // when no UA marker is found, since the corpus is overwhelmingly RU/UA.
      const heuristic = cyrillicHeuristic(args.text);
      lang = heuristic?.lang ?? 'ru';
      await clientsRepo.update(tx, args.clientId, { lang });
    }

    // STEP C — Token-budget check (CONTEXT D-36, Pitfall #12).
    //
    // Read CURRENT lead row state before issuing the LLM call. If we are already
    // over budget, transition → LOST with a structured payload and bail.
    const tokensIn = Number(lead.tokensIn ?? 0);
    const tokensOut = Number(lead.tokensOut ?? 0);
    if (tokensIn + tokensOut > config.LLM_TOKEN_BUDGET_PER_LEAD) {
      await transitionLead(tx, {
        leadId: lead.id,
        to: 'LOST',
        actor: 'system',
        payload: { reason: 'token_budget_exhausted', tokens_in: tokensIn, tokens_out: tokensOut },
      });
      const sorry = lang === 'ua' ? TOKEN_BUDGET_SORRY_UA : TOKEN_BUDGET_SORRY_RU;
      await messagesRepo.create(tx, {
        clientId: args.clientId,
        leadId: lead.id,
        role: 'ai',
        text: sorry,
      });
      exchanges.push({ role: 'assistant', content: sorry });
      return { leadId: lead.id, exchanges };
    }

    // TASK 1 PLACEHOLDER RETURN — Steps D + E + F land in Task 2 of this plan.
    // Until then, send a localized "processing" placeholder so unrelated tests
    // (sticky-lang, injection) can verify Steps 0..C without depending on the
    // extract / clarify / city-resolve plumbing.
    const placeholder = lang === 'ua' ? PLACEHOLDER_PROCESSING_UA : PLACEHOLDER_PROCESSING_RU;
    await messagesRepo.create(tx, {
      clientId: args.clientId,
      leadId: lead.id,
      role: 'ai',
      text: placeholder,
    });
    exchanges.push({ role: 'assistant', content: placeholder });
    return { leadId: lead.id, exchanges };
  });
}

// ---------- helpers ----------

/**
 * Find the most recent OPEN lead for a client. "Open" excludes terminal +
 * order-bound stages — those leads should not absorb new chat turns.
 */
async function findOpenLead(
  db: Db,
  clientId: string
): Promise<
  | {
      id: string;
      stage: string;
      tokensIn: number | string | null;
      tokensOut: number | string | null;
      version: number;
    }
  | undefined
> {
  const result = await db.execute(sql`
    SELECT id, stage, tokens_in AS "tokensIn", tokens_out AS "tokensOut", version
    FROM leads
    WHERE client_id = ${clientId}
      AND stage NOT IN ('DONE', 'LOST', 'ORDER_CREATED', 'IN_PROGRESS')
    ORDER BY updated_at DESC
    LIMIT 1
  `);
  return result.rows[0] as
    | {
        id: string;
        stage: string;
        tokensIn: number | string | null;
        tokensOut: number | string | null;
        version: number;
      }
    | undefined;
}

/**
 * Atomic token-ledger UPDATE (CONTEXT D-36). Called inside the same transaction
 * as the LLM-driven mutation so a rollback rolls back the ledger too.
 *
 * Exported because Task 2 of this plan (Steps D+E+F) calls it once per LLM
 * call, and Plan 02-04b reuses it for the match / price / confirm steps.
 */
export async function incrementTokenLedger(
  db: Db,
  leadId: string,
  usage: { input_tokens: number; output_tokens: number }
): Promise<void> {
  await db.execute(sql`
    UPDATE leads
    SET tokens_in = tokens_in + ${usage.input_tokens},
        tokens_out = tokens_out + ${usage.output_tokens},
        llm_calls = llm_calls + 1,
        updated_at = NOW()
    WHERE id = ${leadId}
  `);
}
