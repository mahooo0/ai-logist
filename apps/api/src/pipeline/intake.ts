// Phase 2 Plan 02-04a — Wave 3 intake pipeline FIRST HALF (complete after Task 2).
//
// Implements steps 0 + A + B + C + D + E + F of the dialog turn (per 02-CONTEXT.md
// "Pipeline step ordering"):
//
//   STEP 0 — Per-client serialization via pg_advisory_xact_lock(hashtext(client_id))
//            (CONTEXT D-30, FSM-04).
//   STEP A — Persist incoming message + find-or-create open lead.
//   STEP B — Sticky language detection (CONTEXT D-12..D-15, LOGIC-02). Sticky =
//            detection runs ONCE on first message ≥ 20 chars; clients.lang never
//            auto-flips on later messages.
//   STEP C — Token-budget check (CONTEXT D-36, Pitfall #12). If
//            leads.tokens_in + tokens_out > LLM_TOKEN_BUDGET_PER_LEAD →
//            transitionLead → LOST with reason='token_budget_exhausted'.
//   STEP D — extractRequest tool call + token-ledger UPDATE (LOGIC-01).
//   STEP E — Clarification budget = 2 rounds (LOGIC-04). After 2 empty rounds the
//            lead stays NEW with manual-triage payload + sorry reply.
//   STEP F — City normalization (LOGIC-03). cities ILIKE on name_ru / name_ua first,
//            then Nominatim fallback via geocoding lib; result cached in cities.
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
import { geocode } from '../lib/geocoding.js';
import { cyrillicHeuristic, type Lang } from '../lib/lang-detect.js';
import { citiesRepo, clientsRepo, leadsRepo, messagesRepo } from '../persistence/repos/index.js';
import { transitionLead } from './lifecycle/lead-fsm.js';
import type { LlmProvider } from './llm-client.js';
import { type ExtractRequestOutput, ExtractRequestSchema } from './llm-tools/extract-request.js';
import { EXTRACT_REQUEST_SYSTEM_PROMPT } from './llm-tools/extract-request.prompt.js';

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

// Plan 02-04b extends past Step F with match + price-lock + confirm. Until then
// the post-city-resolve reply is a localized placeholder so smoke tests pass.
const PLACEHOLDER_MATCHING_RU = 'Подбираю машину…';
const PLACEHOLDER_MATCHING_UA = 'Обчислюю ціну…';

const CITY_NOT_FOUND_RU = 'Не нашёл город. Уточните.';
const CITY_NOT_FOUND_UA = 'Не знайшов місто. Уточніть.';

const MANUAL_TRIAGE_RU = 'Не удалось понять. Менеджер свяжется.';
const MANUAL_TRIAGE_UA = "Не вдалося розпізнати. Менеджер зв'яжеться.";

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

    // STEP D — extractRequest (LOGIC-01, D-42 anti-injection wrap).
    //
    // CRITICAL: client text is wrapped in <client_message>...</client_message>
    // BEFORE being sent to the LLM. The system prompt instructs the model that
    // anything inside these tags is data, not instructions (D-42).
    const wrapped = `<client_message>${args.text}</client_message>`;
    const llmResult = await args.llm.runTurn({
      systemPrompt: EXTRACT_REQUEST_SYSTEM_PROMPT,
      userMessages: [{ role: 'user', content: wrapped }],
      toolNames: ['extractRequest'],
    });

    // Token-ledger UPDATE — atomic increment per D-36. Run AFTER the LLM call
    // so a fixture miss / network error does NOT charge tokens that did not
    // actually flow.
    await incrementTokenLedger(tx, lead.id, llmResult.usage);

    let extracted: ExtractRequestOutput | null = null;
    const extractCall = llmResult.toolCalls.find((c) => c.name === 'extractRequest');
    if (extractCall) {
      const parseResult = ExtractRequestSchema.strict().safeParse(extractCall.args);
      if (parseResult.success) {
        extracted = parseResult.data;
        exchanges.push({
          role: 'tool',
          content: { name: 'extractRequest', args: parseResult.data },
        });
      } else {
        args.log?.warn(
          { tool: 'extractRequest', leadId: lead.id, issues: parseResult.error.issues },
          'extractRequest.parse_failed'
        );
      }
    } else {
      args.log?.warn({ leadId: lead.id }, 'extractRequest.missing_tool_call');
    }

    // STEP E — Clarification budget (LOGIC-04, D-08).
    //
    // Counter is the count of existing AI messages that LOOK like clarifying
    // questions (text contains a "уточн" / "Уточн" stem in RU or UA). Once it
    // reaches 2, we stop asking and leave the lead at NEW with manual-triage
    // payload + a sorry reply.
    const lowConfidence =
      !extracted ||
      extracted.confidence.from_city < 0.7 ||
      extracted.confidence.to_city < 0.7 ||
      extracted.confidence.tons < 0.7 ||
      extracted.from_city === null ||
      extracted.to_city === null ||
      extracted.tons === null;

    if (lowConfidence) {
      const clarifyCount = await countClarificationRounds(tx, lead.id);
      if (clarifyCount >= 2) {
        // 2 rounds spent — annotate lead and tell the client a manager will help.
        // Marker for Phase 4 admin: AI message body contains "Менеджер" + the
        // lead's own state stays NEW so the admin can pick it up from the funnel.
        const reply = lang === 'ua' ? MANUAL_TRIAGE_UA : MANUAL_TRIAGE_RU;
        await messagesRepo.create(tx, {
          clientId: args.clientId,
          leadId: lead.id,
          role: 'ai',
          text: reply,
        });
        exchanges.push({ role: 'assistant', content: reply });
        return { leadId: lead.id, exchanges };
      }
      const question = pickClarifyingQuestion(extracted, lang);
      await messagesRepo.create(tx, {
        clientId: args.clientId,
        leadId: lead.id,
        role: 'ai',
        text: question,
      });
      exchanges.push({ role: 'assistant', content: question });
      return { leadId: lead.id, exchanges };
    }

    // Past this point extracted is non-null and high-confidence on from_city,
    // to_city, and tons. The lowConfidence guard above already verified.
    if (
      !extracted ||
      extracted.from_city === null ||
      extracted.to_city === null ||
      extracted.tons === null
    ) {
      throw new Error('handleInboundMessage: extracted null after confidence gate');
    }

    // STEP F — City normalization (LOGIC-03, D-16..D-18).
    //
    // Two stages per city: (1) local cities ILIKE on name_ru / name_ua;
    // (2) Nominatim geocode + cache upsert. Miss on both → ask clarification
    // (counter shared with Step E).
    const fromCity = await resolveCity(tx, extracted.from_city, args.log);
    const toCity = await resolveCity(tx, extracted.to_city, args.log);
    if (!fromCity || !toCity) {
      const reply = lang === 'ua' ? CITY_NOT_FOUND_UA : CITY_NOT_FOUND_RU;
      await messagesRepo.create(tx, {
        clientId: args.clientId,
        leadId: lead.id,
        role: 'ai',
        text: reply,
      });
      exchanges.push({ role: 'assistant', content: reply });
      return { leadId: lead.id, exchanges };
    }

    // Persist extraction result on the lead before Plan 02-04b's match step.
    // numeric columns accept strings via Drizzle; bigint columns accept bigint.
    await leadsRepo.update(tx, lead.id, {
      fromCityId: fromCity.id,
      toCityId: toCity.id,
      tons: String(extracted.tons),
      bodyType: extracted.body_type,
      budget: extracted.budget_kopecks,
    });

    // Placeholder — Plan 02-04b extends past this point with match + price-lock
    // + confirm + scheduler. The placeholder lets unrelated tests (sticky lang,
    // injection) verify the upstream behaviour without depending on price logic.
    const placeholder = lang === 'ua' ? PLACEHOLDER_MATCHING_UA : PLACEHOLDER_MATCHING_RU;
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
 * Exported because Plan 02-04b calls it once per `runTurn` for the match /
 * price / confirm steps.
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

/**
 * Count how many AI clarification questions we've already sent on this lead.
 *
 * Pattern detection — anything with a `уточн` / `Уточн` Cyrillic stem.
 * Russian: "Уточните...", "уточнение", "уточняем".
 * Ukrainian: "Уточніть...", "уточнюю", "уточнення".
 *
 * If the extractRequest tool returned a `clarifying_question_{ru,ua}` it almost
 * always contains the stem; the few-shot examples in extract-request.prompt.ts
 * confirm this convention.
 */
async function countClarificationRounds(db: Db, leadId: string): Promise<number> {
  const result = await db.execute(sql`
    SELECT count(*)::int AS c
    FROM messages
    WHERE lead_id = ${leadId}
      AND role = 'ai'
      AND (text LIKE '%Уточн%' OR text LIKE '%уточн%')
  `);
  const row = result.rows[0] as { c: number | string } | undefined;
  return Number(row?.c ?? 0);
}

/**
 * Pick the clarifying question text to render to the user. Falls back to
 * generic prompts when the model omitted them. Both fallbacks contain the
 * `уточн` / `Уточн` stem so countClarificationRounds counts them too.
 */
function pickClarifyingQuestion(extracted: ExtractRequestOutput | null, lang: Lang): string {
  if (extracted) {
    if (lang === 'ua' && extracted.clarifying_question_ua) {
      return extracted.clarifying_question_ua;
    }
    if (lang === 'ru' && extracted.clarifying_question_ru) {
      return extracted.clarifying_question_ru;
    }
    // Lang says UA but model only filled RU (or vice versa) — fall through to
    // whichever was filled.
    if (extracted.clarifying_question_ua) return extracted.clarifying_question_ua;
    if (extracted.clarifying_question_ru) return extracted.clarifying_question_ru;
  }
  return lang === 'ua' ? 'Уточніть місто та тоннаж.' : 'Уточните город и тоннаж.';
}

/**
 * Two-stage city resolution (LOGIC-03):
 *   1. Local cities ILIKE on both name_ru and name_ua. ~30 seeded cities cover
 *      the vast majority of demo prompts.
 *   2. Nominatim geocode fallback for unknown names; result cached in cities
 *      so subsequent turns hit the local path.
 *
 * Returns null when both stages miss — caller asks a clarification.
 */
async function resolveCity(
  db: Db,
  name: string,
  log: FastifyBaseLogger | undefined
): Promise<{ id: string; lon: number; lat: number } | null> {
  const local = await db.execute(sql`
    SELECT id, ST_X(geom::geometry) AS lon, ST_Y(geom::geometry) AS lat
    FROM cities
    WHERE name_ru ILIKE ${name} OR name_ua ILIKE ${name}
    LIMIT 1
  `);
  const hit = local.rows[0] as
    | { id: string; lon: number | string; lat: number | string }
    | undefined;
  if (hit) {
    return { id: hit.id, lon: Number(hit.lon), lat: Number(hit.lat) };
  }

  // Miss — try Nominatim. If log is undefined geocode() silently swallows
  // errors; that's the test-friendly default.
  const geo = await geocode(name, ['ru', 'ua'], log);
  if (!geo) return null;

  const match = /POINT\(([-\d.]+) ([-\d.]+)\)/.exec(geo.pointWkt);
  if (!match) return null;
  const lon = Number(match[1]);
  const lat = Number(match[2]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;

  const slug = name
    .toLowerCase()
    .replace(/[^a-zа-яёіїєґ]+/giu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  if (!slug) return null;

  const upserted = await citiesRepo.upsert(db, {
    slug,
    nameRu: name,
    nameUa: name,
    countryCode: geo.country_code.toUpperCase(),
    geom: sql`ST_GeogFromText(${`SRID=4326;${geo.pointWkt}`})` as unknown as never,
  });
  return { id: upserted.id, lon, lat };
}
