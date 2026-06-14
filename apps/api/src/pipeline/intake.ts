// Phase 2 Plan 02-04a + 02-04b — Wave 3 intake pipeline FULL (Steps 0..J).
//
// Plan 02-04a implemented Steps 0 + A + B + C + D + E + F (advisory lock,
// persist + lang + budget + extract + clarify + city). Plan 02-04b extends with
// Step D-pre (confirmation shortcut) and Steps G + H + I + J (match + price-lock
// + templated reply + create-order chain).
//
//   STEP 0     — Per-client serialization via pg_advisory_xact_lock(hashtext(client_id))
//                (CONTEXT D-30, FSM-04).
//   STEP A     — Persist incoming message + find-or-create open lead.
//   STEP B     — Sticky language detection (CONTEXT D-12..D-15, LOGIC-02). Sticky =
//                detection runs ONCE on first message ≥ 20 chars; clients.lang never
//                auto-flips on later messages.
//   STEP C     — Token-budget check (CONTEXT D-36, Pitfall #12). If
//                leads.tokens_in + tokens_out > LLM_TOKEN_BUDGET_PER_LEAD →
//                transitionLead → LOST with reason='token_budget_exhausted'.
//   STEP D-pre — Confirmation shortcut (Plan 02-04b). If lead is in QUOTED stage and
//                text matches CONFIRM_PATTERNS → transitionLead → AGREED → createOrder
//                → ORDER_CREATED. Skips Steps D..J. createOrder re-reads quoted_price
//                from DB inside its own SELECT FOR UPDATE (D-06 — Pitfall #1 closure).
//   STEP D     — extractRequest tool call + token-ledger UPDATE (LOGIC-01).
//   STEP E     — Clarification budget = 2 rounds (LOGIC-04). After 2 empty rounds the
//                lead stays NEW with manual-triage payload + sorry reply.
//   STEP F     — City normalization (LOGIC-03). cities ILIKE on name_ru / name_ua first,
//                then Nominatim fallback via geocoding lib; result cached in cities.
//   STEP G     — Match (MATCH-01). transitionLead → QUALIFIED; call nearestTruck
//                with CTE re-rank (sphere → spheroid); pick best; transitionLead → MATCHED.
//                If 0 trucks → transitionLead → LOST (reason='no_trucks').
//   STEP H     — Route + Price + Price-lock (MATCH-03/04/05/06). routeKm via OSRM
//                with haversine × 1.3 fallback; calcPrice (pure); WRITE leads.quoted_price
//                BEFORE rendering the reply (D-25 price-lock); transitionLead → QUOTED.
//   STEP I     — Templated reply: read quoted_price from DB (paranoia), format,
//                build template, apply defensive priceGuard (future-proofs against
//                LLM-rendered numbers); persist + return.
//   STEP J     — On client confirmation message (handled by STEP D-pre) → createOrder.

import { sql } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import { config } from '../config.js';
import type { Db } from '../db.js';
import { geocode } from '../lib/geocoding.js';
import { renderBotReply } from '../lib/i18n.js';
import { cyrillicHeuristic, type Lang } from '../lib/lang-detect.js';
import { formatPriceKop } from '../lib/money.js';
import { priceGuard } from '../lib/price-guard.js';
import { routeKm } from '../lib/routing.js';
import { citiesRepo, clientsRepo, leadsRepo, messagesRepo } from '../persistence/repos/index.js';
import { transitionLead } from './lifecycle/lead-fsm.js';
import type { LlmProvider } from './llm-client.js';
import { calcPrice, readPricingConfig } from './llm-tools/calc-price.js';
import { createOrderHandler } from './llm-tools/create-order.js';
import { type ExtractRequestOutput, ExtractRequestSchema } from './llm-tools/extract-request.js';
import { EXTRACT_REQUEST_SYSTEM_PROMPT } from './llm-tools/extract-request.prompt.js';
import type { ToolContext } from './llm-tools/index.js';
import { nearestTruck } from './llm-tools/nearest-truck.js';
import type { OutboundRegistry } from './outbound.js';

export interface InboundMessageArgs {
  db: Db;
  llm: LlmProvider;
  log?: FastifyBaseLogger;
  clientId: string;
  text: string;
  channel: string;
  /** Phase 3 D-14 — optional channel-agnostic outbound. Called AFTER tx commits. */
  outbound?: OutboundRegistry;
}

export interface InboundMessageExchange {
  role: 'user' | 'assistant' | 'tool';
  content: unknown;
}

export interface InboundMessageResult {
  leadId: string;
  exchanges: InboundMessageExchange[];
}

// Phase 5 Plan 05-02 — Wave 2: customer-facing replies migrated to
// `renderBotReply` (D-07 dictionary). The constants below cover the few
// pipeline-internal fallback strings that do NOT map cleanly onto a D-07
// dictionary key:
//   - RU_BOILERPLATE_SHORT: D-14 path — client lang still NULL, message
//     < 20 chars; ambiguous-lang fallback. Not in D-07.
//   - CITY_NOT_FOUND_*: city normalization miss. Not in D-07.
//   - NO_TRUCKS_*: own-fleet + bourse-stub both empty. Not in D-07.
//   - MANUAL_TRIAGE_*: low-confidence + 2 rounds spent. Mapped to
//     `escalate` in D-07.
//
// All four customer-facing D-07 keys flow through `renderBotReply` below:
//   `budget-exceeded`, `quote-present`, `order-confirmed`, `escalate`.

/**
 * D-14 boilerplate sent to a client whose lang is still NULL and who wrote a
 * message shorter than 20 chars — too short to reliably detect language.
 */
const RU_BOILERPLATE_SHORT = 'Здравствуйте! Расскажите подробнее: откуда, куда, сколько тонн?';

const CITY_NOT_FOUND_RU = 'Не нашёл город. Уточните.';
const CITY_NOT_FOUND_UA = 'Не знайшов місто. Уточніть.';

// Step G — no own-fleet trucks AND bourse-stub empty.
const NO_TRUCKS_RU = 'К сожалению, свободных машин нет. Менеджер свяжется.';
const NO_TRUCKS_UA = "На жаль, вільних машин немає. Менеджер зв'яжеться.";

/**
 * STEP D-pre — confirmation regex.
 *
 * Matches RU + UA confirm tokens; word boundary makes "ок" + "да" stand-alone,
 * but also accepts "подтверждаю", "согласен", "погоджуюсь", "підтверджую",
 * "так". Case-insensitive + Unicode flag for Cyrillic boundaries.
 */
// \b in JavaScript regex (even with /u) defines word boundary via ASCII \w,
// so Cyrillic 'да' / 'оформляй' / 'підтверджую' would NEVER match. Use
// Unicode property escape \P{L} (not-a-letter) instead so the word boundary
// works across alphabets.
const CONFIRM_PATTERNS =
  /(?:^|\P{L})(да|ок|окей|ага|угу|подтверждаю|согласен|согласна|согласны|так|погоджуюсь|підтверджую|погоджуюся|оформля(й|йте|ем|ю)|оформи(те)?|давай(те)?|беру|берём|берем|готов(а|ы)?|хорошо|годиться|годится|підтверджую\s*замовлення)(?:\P{L}|$)/iu;

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
  // Phase 3 D-14 — capture post-commit outbound payload from inside the tx so
  // the proactive quote-keyboard send fires AFTER the FSM transition commits.
  type PostCommitQuote = { leadId: string; quotedPriceKop: bigint; lang: Lang };
  let postCommitQuote: PostCommitQuote | null = null as PostCommitQuote | null;
  const result = await args.db.transaction(async (txRaw) => {
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
      // D-07 — `budget-exceeded` template covers this customer-facing
      // sorry message. No params.
      const sorry = renderBotReply('budget-exceeded', {}, lang);
      await messagesRepo.create(tx, {
        clientId: args.clientId,
        leadId: lead.id,
        role: 'ai',
        text: sorry,
      });
      exchanges.push({ role: 'assistant', content: sorry });
      return { leadId: lead.id, exchanges };
    }

    // STEP D-pre — Confirmation shortcut (Plan 02-04b).
    //
    // If the lead is already in QUOTED and the client typed a confirm token, we
    // skip the LLM pass entirely:
    //   QUOTED → AGREED → createOrderHandler → ORDER_CREATED.
    //
    // createOrderHandler re-reads `quoted_price` from the DB inside its own
    // SELECT FOR UPDATE transaction (D-06 — Pitfall #1 closure). Pricing here
    // never originates from the LLM's in-memory state. We pass `tx` into
    // createOrderHandler's ToolContext; createOrderHandler opens its own
    // db.transaction internally, which is safe because the inner tx is shorthand
    // for a savepoint when called on an already-active connection.
    if (lead.stage === 'QUOTED' && CONFIRM_PATTERNS.test(args.text)) {
      await transitionLead(tx, {
        leadId: lead.id,
        to: 'AGREED',
        actor: 'ai',
        payload: { confirm_text: args.text },
      });
      const ctx: ToolContext = {
        db: tx,
        log: args.log ?? noopLogger(),
        llm: args.llm,
        leadId: lead.id,
        clientId: args.clientId,
        clientLang: lang,
      };
      const order = await createOrderHandler(ctx, { lead_id: lead.id, confirmed: true });
      await transitionLead(tx, {
        leadId: lead.id,
        to: 'ORDER_CREATED',
        actor: 'ai',
        payload: { order_id: order.order_id, order_number: order.order_number },
      });
      // D-07 — `order-confirmed` template; takes `{number}` only. The
      // previous /track/ URL surface is dropped per Phase 5 NOTIF-02
      // (tracking links removed from bot replies; admin UI is the SoT
      // for live tracking).
      const reply = renderBotReply('order-confirmed', { number: order.order_number }, lang);
      await messagesRepo.create(tx, {
        clientId: args.clientId,
        leadId: lead.id,
        role: 'ai',
        text: reply,
      });
      exchanges.push({ role: 'tool', content: { name: 'createOrder', result: order } });
      exchanges.push({ role: 'assistant', content: reply });
      return { leadId: lead.id, exchanges };
    }

    // STEP D — extractRequest (LOGIC-01, D-42 anti-injection wrap).
    //
    // CRITICAL: client text is wrapped in <client_message>...</client_message>
    // BEFORE being sent to the LLM. The system prompt instructs the model that
    // anything inside these tags is data, not instructions (D-42).
    //
    // Conversation history: replay up to the last 12 messages on this lead so
    // Claude treats follow-ups as the SAME conversation (no amnesia between
    // "10 тонн" and the prior "Киев → Астана"). Filter out manager-role
    // messages — those originate from the admin and aren't part of the AI's
    // own dialog memory.
    const history = await messagesRepo.listByLead(tx, lead.id, 12);
    const userMessages: Array<{ role: 'user' | 'assistant'; content: string }> = history
      .filter((m) => m.role === 'client' || m.role === 'ai')
      .map((m) => ({
        role: m.role === 'client' ? ('user' as const) : ('assistant' as const),
        content: m.role === 'client' ? `<client_message>${m.text}</client_message>` : m.text,
      }));
    // The current inbound message was just inserted into the DB above, so it
    // already lives in `history`. Don't append it again.
    const llmResult = await args.llm.runTurn({
      systemPrompt: EXTRACT_REQUEST_SYSTEM_PROMPT,
      userMessages,
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

    // STEP D-post — Follow-up reply for already-quoted leads.
    //
    // When the lead is past NEW (QUOTED, etc.) and the user typed something
    // that didn't match CONFIRM_PATTERNS — they're asking a follow-up question
    // ("а почему такая цена?", "какая машина?", "а вы бот?"). The prompt tells
    // Claude to put Артём's free-form answer into clarifying_question_ru on
    // exactly these turns. Deliver that line and stop — re-running STEP F/G
    // would try to transition QUOTED → QUALIFIED and throw IllegalTransition.
    if (lead.stage !== 'NEW' && extracted) {
      const followUp =
        lang === 'ua'
          ? (extracted.clarifying_question_ua ?? extracted.clarifying_question_ru)
          : (extracted.clarifying_question_ru ?? extracted.clarifying_question_ua);
      if (followUp) {
        await messagesRepo.create(tx, {
          clientId: args.clientId,
          leadId: lead.id,
          role: 'ai',
          text: followUp,
        });
        exchanges.push({ role: 'assistant', content: followUp });
        return { leadId: lead.id, exchanges };
      }
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
        // Marker for Phase 4 admin: AI message body contains "менеджеру" + the
        // lead's own state stays NEW so the admin can pick it up from the funnel.
        // D-07 — `escalate` template covers this customer-facing handover.
        const reply = renderBotReply('escalate', {}, lang);
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

    // Persist extraction result on the lead before the match step.
    // numeric columns accept strings via Drizzle; bigint columns accept bigint.
    await leadsRepo.update(tx, lead.id, {
      fromCityId: fromCity.id,
      toCityId: toCity.id,
      tons: String(extracted.tons),
      bodyType: extracted.body_type,
      budget: extracted.budget_kopecks,
    });

    // STEP G — Match (MATCH-01).
    //
    // Promote NEW → QUALIFIED (we have all extracted fields now), then call
    // nearestTruck (CTE re-rank: sphere overfetch → spheroid re-rank). If 0 own-fleet
    // rows the tool already falls back to the bourse stub; if still 0 → → LOST.
    await transitionLead(tx, {
      leadId: lead.id,
      to: 'QUALIFIED',
      actor: 'ai',
      payload: { extracted: true },
    });
    const trucks = await nearestTruck(tx, {
      pickupLon: fromCity.lon,
      pickupLat: fromCity.lat,
      tons: extracted.tons,
      bodyType: extracted.body_type,
    });
    if (trucks.length === 0) {
      await transitionLead(tx, {
        leadId: lead.id,
        to: 'LOST',
        actor: 'system',
        payload: { reason: 'no_trucks' },
      });
      const sorry = lang === 'ua' ? NO_TRUCKS_UA : NO_TRUCKS_RU;
      await messagesRepo.create(tx, {
        clientId: args.clientId,
        leadId: lead.id,
        role: 'ai',
        text: sorry,
      });
      exchanges.push({ role: 'assistant', content: sorry });
      return { leadId: lead.id, exchanges };
    }
    const best = trucks[0];
    if (!best) {
      throw new Error('handleInboundMessage: nearestTruck returned empty after length-check');
    }
    // matched_truck_id references own fleet only; bourse-stub rows have synthetic
    // external_ids that won't resolve to trucks.id, so we leave matched_truck_id null
    // when source='bourse-stub' and stash the external id in lead_events.payload below.
    await leadsRepo.update(tx, lead.id, {
      matchedTruckId: best.source === 'own-fleet' ? best.id : null,
    });
    await transitionLead(tx, {
      leadId: lead.id,
      to: 'MATCHED',
      actor: 'ai',
      payload: {
        trucks_found: trucks.length,
        best_id: best.id,
        source: best.source,
      },
    });

    // STEP H — Route + Price (MATCH-03/04/05).
    const { route_km, source: routeSource } = await routeKm(
      { lon: fromCity.lon, lat: fromCity.lat },
      { lon: toCity.lon, lat: toCity.lat },
      args.log
    );
    const cfg = await readPricingConfig(tx);
    const priceOut = calcPrice(
      {
        route_km,
        tons: extracted.tons,
        bodyType: extracted.body_type ?? 'tent',
        date: new Date(),
        direction: 'default',
      },
      cfg
    );

    // STEP I — PRICE-LOCK (MATCH-06): write FIRST, read SECOND, render THIRD.
    //
    // (1) Persist quoted_price to the lead row BEFORE any reply text is built —
    //     this is the audit-log proof that pricing is sourced from the DB, not
    //     the LLM. The QUOTED stage transition then carries the same value in
    //     lead_events.payload for off-line auditing (closes ROADMAP success
    //     criterion #1: "quoted_price written BEFORE reply").
    await leadsRepo.update(tx, lead.id, { quotedPrice: priceOut.default });
    await transitionLead(tx, {
      leadId: lead.id,
      to: 'QUOTED',
      actor: 'ai',
      payload: {
        quoted_price: priceOut.default.toString(),
        min: priceOut.min.toString(),
        max: priceOut.max.toString(),
        route_km,
        route_source: routeSource,
      },
    });

    // (2) Paranoid re-fetch — never trust the in-memory bigint we just wrote.
    //     If the row says no quoted_price after our UPDATE the write silently
    //     failed (FK / null-cast oddity) and we MUST NOT render a reply.
    const refreshed = await leadsRepo.findById(tx, lead.id);
    if (refreshed?.quotedPrice === null || refreshed?.quotedPrice === undefined) {
      throw new Error('price-lock: quoted_price missing after leadsRepo.update');
    }
    const quotedPriceKop = BigInt(refreshed.quotedPrice as unknown as string);

    // (3) Render templated reply by substitution. No LLM call here — the only
    //     numeric content is the formatted quoted_price (DB-sourced; Pitfall #1).
    //     D-07 — `quote-present` carries route + tons + bodyType + price; followed
    //     by `confirm-ask` for the confirmation prompt. City display names come
    //     from `extracted.{from_city,to_city}` (LLM-extracted, nominative — D-09).
    const priceStr = formatPriceKop(quotedPriceKop, lang);
    // `'тент'` here is a domain-level body-type identifier (the canonical
    // RU label that matches our pricing-config `body_type_multipliers` map
    // — Phase 2 LOGIC-05). It is intentionally a domain value, not a
    // translatable customer-facing string.
    const quoteReply = renderBotReply(
      'quote-present',
      {
        from: extracted.from_city,
        to: extracted.to_city,
        tons: extracted.tons,
        bodyType: extracted.body_type ?? 'тент',
        price: priceStr,
        currency: '₴',
      },
      lang
    );
    const confirmAsk = renderBotReply('confirm-ask', {}, lang);
    const reply = `${quoteReply} ${confirmAsk}`;

    // (4) Defensive priceGuard. Templated text passes by construction; this
    //     gate fires the moment a future plan switches to an LLM-rendered reply
    //     and the model emits an off-corridor number.
    const guard = priceGuard({
      llmText: reply,
      quotedPriceKop,
      minKop: priceOut.min,
      maxKop: priceOut.max,
    });
    if (!guard.ok) {
      args.log?.warn(
        { leadId: lead.id, badNumbers: guard.badNumbers, found: guard.found },
        'price-guard: anomaly in templated reply'
      );
    }

    await messagesRepo.create(tx, {
      clientId: args.clientId,
      leadId: lead.id,
      role: 'ai',
      text: reply,
    });
    exchanges.push({
      role: 'tool',
      content: { name: 'calcPrice', result: { default: priceOut.default.toString() } },
    });
    exchanges.push({ role: 'assistant', content: reply });
    postCommitQuote = { leadId: lead.id, quotedPriceKop, lang };
    return { leadId: lead.id, exchanges };
  });

  // Phase 3 D-14 — fire-and-forget outbound after tx commits. Failure must not
  // bubble to the caller; the textual reply already shipped via exchanges[].
  const payload: PostCommitQuote | null = postCommitQuote;
  if (payload && args.outbound) {
    const impl = args.outbound.get(args.channel);
    if (impl) {
      impl
        .sendQuoteKeyboard({ clientId: args.clientId, ...payload })
        .catch((err) =>
          args.log?.warn({ err, leadId: payload.leadId }, 'outbound.sendQuoteKeyboard failed')
        );
    }
  }
  return result;
}

// ---------- helpers ----------

/**
 * Minimal pino-shaped logger used when the caller (e.g. `dialog-harness.ts`)
 * invokes handleInboundMessage without a Fastify request logger. Tool handlers
 * inside `ToolContext` expect a non-null logger; this satisfies the contract
 * with zero-cost no-op methods.
 */
function noopLogger(): FastifyBaseLogger {
  const fn = () => {};
  const stub = {
    info: fn,
    warn: fn,
    error: fn,
    debug: fn,
    trace: fn,
    fatal: fn,
    level: 'silent' as const,
    silent: fn,
    bindings: () => ({}),
  };
  // child returns itself — fine for off-Fastify callers (no per-request scope).
  const withChild = { ...stub, child: () => withChild };
  return withChild as unknown as FastifyBaseLogger;
}

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
export async function resolveCity(
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
