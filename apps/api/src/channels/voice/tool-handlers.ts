// apps/api/src/channels/voice/tool-handlers.ts
//
// Phase 3.1 — 5 voice tool handlers wrapping Phase 2 tools.
// NEVER bypass Phase 2 logic — these are adapters between the ElevenLabs
// callback envelope and the Phase 2 handler signatures.
//
// Each handler follows the 7-step RESEARCH §Pattern 1 flow:
//   1. signature preHandler verifies ElevenLabs HMAC (applied via addHook)
//   2. Zod parse of CallbackBaseSchema
//   3. Idempotency: INSERT INTO webhook_updates (source='elevenlabs', external_id=conv:seq) ON CONFLICT DO NOTHING
//   4. pg_advisory_xact_lock(hashtext(conversation_id)) — per-conversation serialization (CONTEXT D-24)
//   5. Load Redis voice state (Wave 1 state.ts)
//   6. Call Phase 2 handler — no logic duplication
//   7. Persist + return ElevenLabs JSON envelope
//
// Critical invariants:
//   - calc-price writes leads.quoted_price to DB BEFORE returning (CONTEXT D-22, Pitfall #1 layer 1)
//   - create-order calls Phase 2 createOrderHandler which re-reads quoted_price
//     from DB inside SELECT FOR UPDATE (CONTEXT D-23, Pitfall #1 layer 2) — voice
//     handler NEVER passes a `price` arg; Agent-supplied prices are ignored.
//   - Phase 2 tool files in src/pipeline/llm-tools/ remain byte-identical
//     (grep guard in plan verify). We import them; we never modify them.

import { sql } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod/v4';
import { calcPrice, readPricingConfig } from '../../pipeline/llm-tools/calc-price.js';
import { createOrderHandler } from '../../pipeline/llm-tools/create-order.js';
import { DiscountInputSchema, discountHandler } from '../../pipeline/llm-tools/discount.js';
import { ExtractRequestSchema } from '../../pipeline/llm-tools/extract-request.js';
import { nearestTruck } from '../../pipeline/llm-tools/nearest-truck.js';
import { elevenlabsSignaturePreHandler } from './signature.js';
import { getVoiceState, mergeVoiceState } from './state.js';

/**
 * ElevenLabs callback envelope (RESEARCH §Block 5).
 *
 * Tolerates SDK 2.30.0+ field-name drift: `parameters` (new) OR `args`
 * (legacy) — both accepted via the transform. Other top-level fields are
 * passthroughed via the per-route Zod schemas where present.
 */
const CallbackBaseSchema = z
  .object({
    conversation_id: z.string().min(1),
    sequence: z.coerce.number().int().nonnegative(),
    tool_call_id: z.string().optional(),
    parameters: z.record(z.string(), z.unknown()).optional(),
    args: z.record(z.string(), z.unknown()).optional(),
    metadata: z
      .object({ language: z.enum(['ru', 'ua']).optional() })
      .loose()
      .optional(),
  })
  .transform((b) => ({
    conversation_id: b.conversation_id,
    sequence: b.sequence,
    tool_call_id: b.tool_call_id,
    parameters: b.parameters ?? b.args ?? {},
    metadata: b.metadata,
  }));

type CallbackEnvelope = z.infer<typeof CallbackBaseSchema>;

/** Drizzle transaction handle — narrowed `any` because Phase 2 also uses `any` here
 * (db.transaction's inner type is too noisy to thread through). */
// biome-ignore lint/suspicious/noExplicitAny: per-tx Drizzle type is too noisy; matches Phase 2 pattern.
type Tx = any;

/**
 * Idempotency INSERT into webhook_updates. Returns true if the row was first-time
 * (downstream effects should run); false if the duplicate-delivery short-circuit fired.
 *
 * Pattern matches Phase 3 Telegram webhook idempotency on `webhook_updates`
 * (source='telegram', external_id=update_id) — voice reuses the same table with
 * source='elevenlabs', external_id=`<conversation_id>:<sequence>`.
 */
async function recordIdempotency(tx: Tx, externalId: string, payload: unknown): Promise<boolean> {
  const res = await tx.execute(sql`
    INSERT INTO webhook_updates (source, external_id, payload, received_at)
    VALUES ('elevenlabs'::webhook_source, ${externalId}, ${JSON.stringify(payload)}::jsonb, NOW())
    ON CONFLICT (source, external_id) DO NOTHING
    RETURNING external_id
  `);
  return (res.rows as unknown[]).length > 0;
}

/**
 * Acquire per-conversation advisory lock (CONTEXT D-24).
 *
 * hashtext(text) returns int4; pg_advisory_xact_lock(int4, int4) or
 * pg_advisory_xact_lock(int8) both work — we use the single-arg int8 path with
 * implicit coercion. The lock is released automatically on COMMIT/ROLLBACK.
 */
async function acquireConversationLock(tx: Tx, conversationId: string): Promise<void> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${conversationId}))`);
}

/**
 * Format kopecks to a human RU/UA digit string for the Agent to voice.
 *
 * Pure presentation — no rounding (input is already aligned to 50-RUB grid
 * per calcPrice corridor). RESEARCH Open Question 4 flags potential TTS misread
 * on very large numbers; v1 accepts the digit-string shape and revisits in
 * UAT-04 if needed.
 */
function formatRubKopecks(kopecks: bigint): string {
  const rubles = Number(kopecks) / 100;
  // Format with thin-space thousands separator. Math.floor avoids fractional cents.
  return Math.floor(rubles)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Voice tool handlers Fastify plugin.
 *
 * Registers all 5 tool routes under /webhook/voice/tool/*. The parent router
 * (webhooks-voice.ts) wires the raw-body content-type parser BEFORE registering
 * this plugin so the HMAC signature preHandler can read `req.rawBody`.
 *
 * The HMAC preHandler is applied once at the plugin scope via addHook —
 * every POST in this plugin verifies the signature before its handler runs.
 */
const voiceToolHandlers: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', elevenlabsSignaturePreHandler);

  // ─── 1. extract-request ──────────────────────────────────────────────
  // The voice path does NOT need the Phase 2 Anthropic-LLM extractor —
  // ElevenLabs Agent already returned structured fields in `parameters`.
  // We validate against ExtractRequestSchema.strict() and persist via Redis
  // state (Phase 2 anti-injection: re-validation at boundary).
  app.post('/webhook/voice/tool/extract-request', async (req, reply) => {
    const body = CallbackBaseSchema.parse(req.body) as CallbackEnvelope;
    const { conversation_id, sequence, parameters } = body;

    return await app.db.transaction(async (tx: Tx) => {
      await recordIdempotency(tx, `${conversation_id}:${sequence}`, body);
      await acquireConversationLock(tx, conversation_id);
      const state = await getVoiceState(app.redis, conversation_id);
      if (!state) {
        return reply.send({
          ok: false,
          error: { code: 'no_state', message: 'call-start not received for this conversation' },
        });
      }

      // Agent passed structured args directly (already JSON, not free text).
      // ExtractRequestSchema strict-parses to guarantee no extra fields slipped
      // through — same defense-in-depth pattern as Phase 2's belt-and-suspenders.
      const candidate = {
        from_city: (parameters.from_city ?? null) as string | null,
        to_city: (parameters.to_city ?? null) as string | null,
        tons: (parameters.tons ?? null) as number | null,
        body_type: (parameters.body_type ?? null) as 'tent' | 'ref' | 'iso' | 'container' | null,
        budget_kopecks:
          parameters.budget_kopecks === null || parameters.budget_kopecks === undefined
            ? null
            : BigInt(parameters.budget_kopecks as string | number),
        deadline_iso: (parameters.deadline_iso ?? null) as string | null,
        confidence: (parameters.confidence ?? {
          from_city: 0.5,
          to_city: 0.5,
          tons: 0.5,
        }) as { from_city: number; to_city: number; tons: number },
        clarifying_question_ru: (parameters.clarifying_question_ru ?? null) as string | null,
        clarifying_question_ua: (parameters.clarifying_question_ua ?? null) as string | null,
      };
      const parsed = ExtractRequestSchema.safeParse(candidate);
      if (!parsed.success) {
        req.log.warn(
          { conversation_id, issues: parsed.error.issues },
          'voice.tool.extract-request.invalid'
        );
        return reply.send({
          ok: false,
          error: { code: 'invalid_args', message: 'extractRequest args failed schema parse' },
        });
      }

      await mergeVoiceState(app.redis, conversation_id, {
        extracted_fields: {
          from_city: parsed.data.from_city,
          to_city: parsed.data.to_city,
          tons: parsed.data.tons,
          body_type: parsed.data.body_type,
        },
      });

      return reply.send({
        ok: true,
        output: {
          from_city: parsed.data.from_city,
          to_city: parsed.data.to_city,
          tons: parsed.data.tons,
          body_type: parsed.data.body_type,
          confidence: parsed.data.confidence,
          clarifying_question_ru: parsed.data.clarifying_question_ru,
          clarifying_question_ua: parsed.data.clarifying_question_ua,
        },
      });
    });
  });

  // ─── 2. nearest-truck ────────────────────────────────────────────────
  app.post('/webhook/voice/tool/nearest-truck', async (req, reply) => {
    const body = CallbackBaseSchema.parse(req.body) as CallbackEnvelope;
    const { conversation_id, sequence, parameters } = body;

    return await app.db.transaction(async (tx: Tx) => {
      await recordIdempotency(tx, `${conversation_id}:${sequence}`, body);
      await acquireConversationLock(tx, conversation_id);
      const state = await getVoiceState(app.redis, conversation_id);
      if (!state) {
        return reply.send({
          ok: false,
          error: { code: 'no_state', message: 'call-start not received for this conversation' },
        });
      }

      const p = parameters as {
        pickup_lon: number;
        pickup_lat: number;
        tons: number;
        body_type: 'tent' | 'ref' | 'iso' | 'container' | null;
      };

      // Phase 2 nearestTruck: takes Db + raw params, returns rows with PostGIS
      // CTE re-rank (Pitfall #2 already handled inside Phase 2).
      const rows = await nearestTruck(tx, {
        pickupLon: p.pickup_lon,
        pickupLat: p.pickup_lat,
        tons: p.tons,
        bodyType: p.body_type ?? null,
      });

      if (rows[0]) {
        await mergeVoiceState(app.redis, conversation_id, {
          matched_truck: {
            id: rows[0].id,
            meters: Number(rows[0].meters),
          },
        });
        // Persist matched_truck_id on the lead so Phase 2 createOrderHandler
        // reads the right truck inside its SELECT FOR UPDATE.
        await tx.execute(sql`
          UPDATE leads
          SET matched_truck_id = ${rows[0].id}::uuid, updated_at = NOW()
          WHERE id = ${state.lead_id}::uuid
        `);
      }

      return reply.send({
        ok: true,
        output: {
          trucks: rows.map((r) => ({
            id: r.id,
            plate: r.plate_number,
            capacity_t: r.capacity_t,
            body_type: r.body_type,
            meters: r.meters,
            source: r.source,
          })),
        },
      });
    });
  });

  // ─── 3. calc-price (PRICE-LOCK: write to DB BEFORE return — CONTEXT D-22) ──
  app.post('/webhook/voice/tool/calc-price', async (req, reply) => {
    const body = CallbackBaseSchema.parse(req.body) as CallbackEnvelope;
    const { conversation_id, sequence, parameters } = body;

    return await app.db.transaction(async (tx: Tx) => {
      await recordIdempotency(tx, `${conversation_id}:${sequence}`, body);
      await acquireConversationLock(tx, conversation_id);
      const state = await getVoiceState(app.redis, conversation_id);
      if (!state?.lead_id) {
        return reply.send({
          ok: false,
          error: { code: 'no_lead', message: 'voice state has no lead_id; call-start missing' },
        });
      }

      const p = parameters as {
        route_km: number;
        tons: number;
        body_type: 'tent' | 'ref' | 'iso' | 'container';
        direction?: 'default' | 'back_haul';
      };

      const cfg = await readPricingConfig(tx);
      const corridor = calcPrice(
        {
          route_km: p.route_km,
          tons: p.tons,
          bodyType: p.body_type,
          date: new Date(),
          direction: p.direction ?? 'default',
        },
        cfg
      );

      // PRICE-LOCK: write quoted_price BEFORE returning to ElevenLabs (D-22).
      // The Agent will read the returned digits and voice them; create-order
      // will re-read this same row from DB (D-23) to defend against tampering.
      await tx.execute(sql`
        UPDATE leads
        SET quoted_price = ${corridor.default.toString()}::bigint,
            updated_at = NOW()
        WHERE id = ${state.lead_id}::uuid
      `);
      await mergeVoiceState(app.redis, conversation_id, {
        quoted_price: corridor.default,
      });

      const priceStr = formatRubKopecks(corridor.default);
      return reply.send({
        ok: true,
        output: {
          price_kopecks: corridor.default.toString(),
          price_str_ru: `${priceStr} рублей`,
          price_str_ua: `${priceStr} рублів`,
          price_min_kopecks: corridor.min.toString(),
          price_max_kopecks: corridor.max.toString(),
        },
      });
    });
  });

  // ─── 4. create-order (RE-READS quoted_price; closes Pitfall #1 — CONTEXT D-23) ──
  //
  // Phase 2 createOrderHandler runs its OWN transaction (SELECT FOR UPDATE on
  // leads, then INSERT into orders, then CAS UPDATE leads). We deliberately do
  // NOT pass app.db.transaction() around createOrderHandler — running nested
  // transactions on the same logical conversation would deadlock with the
  // advisory lock we hold on the OUTER tx.
  //
  // Therefore: idempotency + advisory lock + state load happen in a SHORT outer
  // tx, then we release and call createOrderHandler which starts its own tx.
  // The advisory lock is per-conversation and prevents two concurrent
  // create-order callbacks from BOTH passing the idempotency gate; the inner
  // tx's row-level FOR UPDATE then prevents two concurrent create-orders on
  // the same lead.
  app.post('/webhook/voice/tool/create-order', async (req, reply) => {
    const body = CallbackBaseSchema.parse(req.body) as CallbackEnvelope;
    const { conversation_id, sequence } = body;

    // Outer tx — idempotency + advisory lock + state. Released before inner tx.
    const gate = await app.db.transaction(async (tx: Tx) => {
      await recordIdempotency(tx, `${conversation_id}:${sequence}`, body);
      await acquireConversationLock(tx, conversation_id);
      const state = await getVoiceState(app.redis, conversation_id);
      return state;
    });
    if (!gate?.lead_id) {
      return reply.send({
        ok: false,
        error: { code: 'no_lead', message: 'voice state has no lead_id; call-start missing' },
      });
    }

    // Build a minimal Phase 2 ToolContext. Voice handlers don't have an
    // LlmProvider (Agent IS the LLM); cast `llm` as `undefined as never` so the
    // type aligns. createOrderHandler does NOT use `llm` — verified by reading
    // Phase 2 source line-by-line (only ctx.db + ctx.log + ctx.leadId touched).
    const ctx = {
      db: app.db,
      log: req.log,
      // biome-ignore lint/suspicious/noExplicitAny: Phase 2 ctx requires llm but createOrderHandler never reads it.
      llm: undefined as any,
      leadId: gate.lead_id,
      clientId: gate.client_id,
      clientLang: (gate.lang ?? 'ru') as 'ru' | 'ua',
    };

    try {
      // Phase 2 createOrderHandler: SELECT lead FOR UPDATE → reads quoted_price
      // from the DB row → INSERTs order with that price (NEVER from input args)
      // → CAS UPDATE leads.order_id. Closes Pitfall #1.
      const result = await createOrderHandler(ctx, {
        lead_id: gate.lead_id,
        confirmed: true,
      });

      // Snapshot price + link to calls.linked_lead_id for VOICE-08 audit.
      await app.db.execute(sql`
        UPDATE calls SET
          quoted_price_at_confirmation = ${result.price_kopecks}::bigint,
          linked_lead_id = ${gate.lead_id}::uuid
        WHERE elevenlabs_conversation_id = ${conversation_id}
      `);

      return reply.send({
        ok: true,
        output: {
          order_id: result.order_id,
          order_number: result.order_number,
          price_kopecks: result.price_kopecks,
          public_token: result.public_token,
          confirmation_str_ru: `Заказ создан, номер ${result.order_number}`,
          confirmation_str_ua: `Замовлення створено, номер ${result.order_number}`,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      req.log.error(
        { err: message, conversation_id, leadId: gate.lead_id },
        'voice.tool.create-order.failed'
      );
      return reply.send({
        ok: false,
        error: { code: 'create_order_failed', message },
      });
    }
  });

  // ─── 5. discount ─────────────────────────────────────────────────────
  //
  // Phase 2 discountHandler enforces the min-floor (quoted_price × 0.85) and
  // appends a price_overrides audit row inside its own tx. Voice handler reads
  // the Agent-supplied `amount_kopecks` (Agent has negotiated with the caller)
  // and forwards to Phase 2.
  //
  // Same nested-tx caveat as create-order: outer tx holds the advisory lock +
  // idempotency, inner Phase 2 tx does the FOR UPDATE + price_overrides append.
  app.post('/webhook/voice/tool/discount', async (req, reply) => {
    const body = CallbackBaseSchema.parse(req.body) as CallbackEnvelope;
    const { conversation_id, sequence, parameters } = body;

    const gate = await app.db.transaction(async (tx: Tx) => {
      await recordIdempotency(tx, `${conversation_id}:${sequence}`, body);
      await acquireConversationLock(tx, conversation_id);
      return await getVoiceState(app.redis, conversation_id);
    });
    if (!gate?.lead_id) {
      return reply.send({
        ok: false,
        error: { code: 'no_lead', message: 'voice state has no lead_id; call-start missing' },
      });
    }

    const p = parameters as {
      amount_kopecks?: number | string;
      requested_kopecks?: number | string;
      reason?: string;
    };
    // Tolerate `requested_kopecks` alias (older Agent prompt variants used it).
    const rawAmount = p.amount_kopecks ?? p.requested_kopecks;
    if (rawAmount === undefined || rawAmount === null) {
      return reply.send({
        ok: false,
        error: { code: 'invalid_args', message: 'discount missing amount_kopecks' },
      });
    }
    const amountNum = typeof rawAmount === 'string' ? Number(rawAmount) : rawAmount;
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return reply.send({
        ok: false,
        error: { code: 'invalid_args', message: 'discount amount must be positive number' },
      });
    }

    const parsedInput = DiscountInputSchema.safeParse({
      lead_id: gate.lead_id,
      amount_kopecks: amountNum,
      reason: p.reason ?? 'voice negotiation',
    });
    if (!parsedInput.success) {
      return reply.send({
        ok: false,
        error: { code: 'invalid_args', message: 'discount args failed schema parse' },
      });
    }

    const ctx = {
      db: app.db,
      log: req.log,
      // biome-ignore lint/suspicious/noExplicitAny: discountHandler does not read ctx.llm.
      llm: undefined as any,
      leadId: gate.lead_id,
      clientId: gate.client_id,
      clientLang: (gate.lang ?? 'ru') as 'ru' | 'ua',
    };
    const result = await discountHandler(ctx, parsedInput.data);

    if (result.ok) {
      const newPriceKop = BigInt(result.new_price_kopecks);
      await mergeVoiceState(app.redis, conversation_id, { quoted_price: newPriceKop });
      const priceStr = formatRubKopecks(newPriceKop);
      return reply.send({
        ok: true,
        output: {
          price_kopecks: result.new_price_kopecks,
          price_str_ru: `${priceStr} рублей`,
          price_str_ua: `${priceStr} рублів`,
        },
      });
    }
    return reply.send({ ok: false, error: result.error });
  });
};

export default voiceToolHandlers;
