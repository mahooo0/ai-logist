// apps/api/src/channels/voice/outbound.ts
// Phase 3.1 — VoiceOutbound implements Phase 3 OutboundChannel.
//
// sendQuoteKeyboard is a no-op for voice: ElevenLabs Agent voices the price
// itself from the calc-price tool result (CONTEXT 03.1-CONTEXT D-22). The Agent
// never sees a "keyboard" — it speaks. We log the call so observability still
// fires when intake.ts (Phase 2) routes a post-commit quote through the
// channel-agnostic OutboundRegistry on a voice-channel lead (corner case).
//
// sendText is also a no-op during a live call (Agent is the only voice on the
// line). Could be promoted to a Twilio SMS in a v2 polish pass for post-call
// notifications; for v1 we just log.
//
// CONTEXT 03.1-CONTEXT.md D-22 + Phase 3 D-14 (OutboundChannel interface).
//
// ── Outbound confirmation dialer (demo voice-confirmation flow) ──
// dialOrderConfirmation lives at the bottom of this file. It POSTs to
// ElevenLabs `/v1/convai/twilio/outbound-call` with order context as
// dynamic_variables so the confirm-query agent can speak meaningfully on the
// first turn. Invoked from ARRIVAL_HOOKS in pipeline/lifecycle/arrival-hooks.ts.

import { sql } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import { config } from '../../config.js';
import type { Db } from '../../db.js';
import type { OutboundChannel } from '../../pipeline/outbound.js';
import { setVoiceState, type VoiceState } from './state.js';
import type { Redis } from 'ioredis';

export class VoiceOutbound implements OutboundChannel {
  readonly channelName = 'voice';
  constructor(private readonly log: FastifyBaseLogger) {}

  async sendQuoteKeyboard(args: {
    clientId: string;
    leadId: string;
    quotedPriceKop: bigint;
    lang: 'ru' | 'ua';
  }): Promise<void> {
    // No-op: Agent voices the price itself from calc-price tool result.
    this.log.info(
      {
        channel: 'voice',
        leadId: args.leadId,
        clientId: args.clientId,
        quotedPriceKop: args.quotedPriceKop.toString(),
        lang: args.lang,
      },
      'voice.outbound.sendQuoteKeyboard.noop'
    );
  }

  async sendText(args: { clientId: string; text: string }): Promise<void> {
    // No-op during live call. Could enqueue an SMS via Twilio in v2.
    this.log.info(
      { channel: 'voice', clientId: args.clientId, textLength: args.text.length },
      'voice.outbound.sendText.noop'
    );
  }
}

/**
 * Factory — matches the Phase 3 telegram outbound factory shape. Returned value
 * is assignable to OutboundChannel so callers don't depend on the concrete class.
 */
export function createVoiceOutbound(log: FastifyBaseLogger): OutboundChannel {
  return new VoiceOutbound(log);
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo voice-confirmation outbound dialer.
// ─────────────────────────────────────────────────────────────────────────────

export type ConfirmationStage = 'loading' | 'delivery';

interface OrderConfirmationContext {
  orderId: string;
  orderNumber: string;
  clientId: string;
  leadId: string | null;
  clientPhone: string;
  clientLang: 'ru' | 'ua';
  plate: string;
  driverName: string;
  pickupAddress: string;
  deliveryAddress: string;
  cargoSummary: string;
}

/**
 * Resolve which E.164 number to dial for the demo. DEMO_CLIENT_PHONE wins so
 * every test call lands on the same tester device regardless of which seeded
 * client owns the order. Falls back to clients.phone in production.
 *
 * Returns null when phone looks like a synthetic placeholder (`tg:...` /
 * `voice:...`) AND no override is configured — dialing those would 400 at
 * Twilio.
 */
function resolveDialNumber(realPhone: string): string | null {
  if (config.DEMO_CLIENT_PHONE) return config.DEMO_CLIENT_PHONE;
  if (!realPhone) return null;
  if (realPhone.startsWith('tg:') || realPhone.startsWith('voice:')) return null;
  return realPhone;
}

async function loadOrderConfirmationContext(
  db: Db,
  orderId: string
): Promise<OrderConfirmationContext | null> {
  // Single SELECT joining everything the confirmation agent needs in its
  // opening line. LEFT JOINs because lead / truck can in principle be NULL on
  // partially-seeded fixtures; we substitute placeholder strings in the
  // dynamic_variables block rather than 500 on missing rows.
  const res = await db.execute(sql`
    SELECT
      o.id::text            AS order_id,
      o.number              AS order_number,
      o.client_id::text     AS client_id,
      o.lead_id::text       AS lead_id,
      c.phone               AS client_phone,
      c.lang                AS client_lang,
      COALESCE(t.plate_number, '—')           AS plate,
      COALESCE(t.driver_name, '—')            AS driver_name,
      COALESCE(fc.name_ru, fc.name_ua, '—')   AS pickup_address,
      COALESCE(tc.name_ru, tc.name_ua, '—')   AS delivery_address,
      l.tons::text          AS tons,
      l.body_type::text     AS body_type
    FROM orders o
    JOIN clients c ON c.id = o.client_id
    LEFT JOIN trucks t ON t.id = o.truck_id
    LEFT JOIN cities fc ON fc.id = o.from_city_id
    LEFT JOIN cities tc ON tc.id = o.to_city_id
    LEFT JOIN leads  l  ON l.id = o.lead_id
    WHERE o.id = ${orderId}::uuid
    LIMIT 1
  `);
  const row = res.rows[0] as
    | {
        order_id: string;
        order_number: string;
        client_id: string;
        lead_id: string | null;
        client_phone: string;
        client_lang: 'ru' | 'ua';
        plate: string;
        driver_name: string;
        pickup_address: string;
        delivery_address: string;
        tons: string | null;
        body_type: string | null;
      }
    | undefined;
  if (!row) return null;

  const tonsStr = row.tons ? `${Number(row.tons)} т` : '';
  const bodyStr = row.body_type ?? '';
  const cargo = [tonsStr, bodyStr].filter(Boolean).join(', ') || 'груз';

  return {
    orderId: row.order_id,
    orderNumber: row.order_number,
    clientId: row.client_id,
    leadId: row.lead_id,
    clientPhone: row.client_phone,
    clientLang: row.client_lang ?? 'ru',
    plate: row.plate,
    driverName: row.driver_name,
    pickupAddress: row.pickup_address,
    deliveryAddress: row.delivery_address,
    cargoSummary: cargo,
  };
}

/**
 * POST to ElevenLabs `/v1/convai/twilio/outbound-call` and (on 2xx) pre-seed
 * the Redis voice state so the confirmLoading / confirmDelivery tool callbacks
 * already know which order/client this conversation refers to without falling
 * back to lazy-seed.
 *
 * Idempotency is enforced upstream by the FSM: ARRIVAL_HOOKS only fires after
 * a successful AT_LOADING / DELIVERED_PENDING transition, which is itself
 * single-firing (CAS + IllegalTransition reject re-runs). Therefore this
 * function does NOT need its own dedup row.
 *
 * Network/HTTP errors are logged and swallowed. They do not roll back the
 * already-committed FSM transition (Pitfall #3 — never block FSM on outbound).
 */
export async function dialOrderConfirmation(args: {
  db: Db;
  redis: Redis;
  log: FastifyBaseLogger;
  orderId: string;
  stage: ConfirmationStage;
}): Promise<void> {
  const { db, redis, log, orderId, stage } = args;

  const ctx = await loadOrderConfirmationContext(db, orderId);
  if (!ctx) {
    log.warn({ orderId, stage }, 'voice.dialOrderConfirmation.order_not_found');
    return;
  }

  const toNumber = resolveDialNumber(ctx.clientPhone);
  if (!toNumber) {
    log.warn(
      { orderId, stage, phone: ctx.clientPhone },
      'voice.dialOrderConfirmation.no_real_phone — set DEMO_CLIENT_PHONE or back-fill clients.phone'
    );
    return;
  }

  const apiKey = config.ELEVENLABS_API_KEY;
  const agentId = config.ELEVENLABS_AGENT_ID_CONFIRM ?? config.ELEVENLABS_AGENT_ID;
  const phoneNumberId = config.ELEVENLABS_PHONE_NUMBER_ID;
  if (!apiKey || !agentId || !phoneNumberId) {
    log.error(
      {
        orderId,
        stage,
        hasApiKey: !!apiKey,
        hasAgentId: !!agentId,
        hasPhoneId: !!phoneNumberId,
      },
      'voice.dialOrderConfirmation.missing_config'
    );
    return;
  }

  const flow = stage === 'loading' ? 'loading_confirmation' : 'delivery_confirmation';
  const address = stage === 'loading' ? ctx.pickupAddress : ctx.deliveryAddress;

  const dynamicVariables = {
    flow,
    order_id: ctx.orderId,
    order_number: ctx.orderNumber,
    plate: ctx.plate,
    driver_name: ctx.driverName,
    address,
    cargo_summary: ctx.cargoSummary,
    client_lang: ctx.clientLang,
  };

  // Per-call first_message override. Without this, the agent stalls silent
  // until the caller says something — bad on outbound where WE initiated the
  // call and the caller has no context. The same opening lines are duplicated
  // in the system prompt as fallback / for context continuity, but THIS is
  // what actually plays as the very first audio.
  const firstMessage =
    stage === 'loading'
      ? ctx.clientLang === 'ua'
        ? `Доброго дня, це Аліса з АІ-Логіст. Машина ${ctx.plate}, водій ${ctx.driverName}, під'їхала на ${address}. Готові до завантаження?`
        : `Здравствуйте, это Алиса из АИ-Логист. Машина ${ctx.plate}, водитель ${ctx.driverName}, подъехала на ${address}. Готовы к погрузке?`
      : ctx.clientLang === 'ua'
        ? `Доброго дня, це Аліса з АІ-Логіст. Машина ${ctx.plate} з ${ctx.cargoSummary} прибула на розвантаження за ${address}. Приймаєте?`
        : `Здравствуйте, это Алиса из АИ-Логист. Машина ${ctx.plate} с ${ctx.cargoSummary} прибыла на разгрузку по ${address}. Принимаете?`;

  let conversationId: string | null = null;
  try {
    const resp = await fetch('https://api.elevenlabs.io/v1/convai/twilio/outbound-call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
      body: JSON.stringify({
        agent_id: agentId,
        agent_phone_number_id: phoneNumberId,
        to_number: toNumber,
        conversation_initiation_client_data: {
          dynamic_variables: dynamicVariables,
          conversation_config_override: {
            agent: { first_message: firstMessage },
          },
        },
      }),
    });
    const text = await resp.text();
    if (!resp.ok) {
      log.error(
        { orderId, stage, status: resp.status, body: text.slice(0, 400) },
        'voice.dialOrderConfirmation.elevenlabs_failed'
      );
      return;
    }
    try {
      const parsed = JSON.parse(text) as { conversation_id?: string; callSid?: string };
      conversationId = parsed.conversation_id ?? null;
    } catch {
      log.warn({ orderId, body: text.slice(0, 200) }, 'voice.dialOrderConfirmation.unparsable_body');
    }
    log.info(
      { orderId, stage, conversationId, to: toNumber, agentId },
      'voice.dialOrderConfirmation.dispatched'
    );
  } catch (err) {
    log.error({ err: String(err), orderId, stage }, 'voice.dialOrderConfirmation.exception');
    return;
  }

  // Pre-seed voice state so confirmLoading/confirmDelivery callbacks resolve
  // (orderId, clientId, leadId) without lazy-seed creating throwaway records.
  if (conversationId) {
    const state: VoiceState = {
      conversation_id: conversationId,
      client_id: ctx.clientId,
      lead_id: ctx.leadId ?? '',
      lang: ctx.clientLang,
      twilio_call_sid: null,
      created_at: new Date().toISOString(),
      order_id: ctx.orderId,
      flow,
    };
    try {
      await setVoiceState(redis, state);
    } catch (err) {
      log.warn({ err: String(err), conversationId, orderId }, 'voice.dialOrderConfirmation.seed_failed');
    }
  }
}
