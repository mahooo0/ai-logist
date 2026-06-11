// apps/api/src/routes/admin.ts
//
// Phase 5 POLISH-02 — POST /api/admin/simulate-call.
//
// Replays each of 5 voice-scenarios.json fixtures through Phase 3.1 voice tool
// handlers IN-PROCESS via app.inject — no Twilio, no ElevenLabs external calls.
// Each scenario produces a real calls row (audio_url=NULL, transcript = scenario
// transcript) + linked lead + (for happy paths) order.
//
// Pattern 7 from 05-RESEARCH.md: events are dispatched as signed POSTs to the
// existing /webhook/voice/* endpoints inside the same Fastify instance. This
// reuses ALL voice logic byte-identically — no duplication of HMAC, advisory
// locks, idempotency, or DB writes.
//
// Anti-Pitfall #1 invariant preserved: prices come from leads.quoted_price
// (templated, set by calc-price handler before return). The simulate route
// NEVER injects a price into any payload.

import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod/v4';
import { config } from '../config.js';

// Scenarios are bundled with the production build (moved from tests/fixtures/
// to src/fixtures/ in Plan 05-04 per RESEARCH Open Question 2).
const scenariosPath = fileURLToPath(new URL('../fixtures/voice-scenarios.json', import.meta.url));
type ScenarioEvent = { endpoint: string; body: Record<string, unknown> };
const scenarios = JSON.parse(readFileSync(scenariosPath, 'utf8')) as Record<
  string,
  ScenarioEvent[]
>;

const SCENARIO_KEYS = [
  'ru_happy_path',
  'ua_happy_path',
  'injection_attempt',
  'ambiguous_clarification',
  'abandon_mid_call',
] as const;

const SimulateBodySchema = z.object({
  scenarioKey: z.enum(SCENARIO_KEYS),
});

/**
 * Compute the ElevenLabs HMAC signature header for a JSON-encoded body.
 *
 * Mirrors apps/api/src/channels/voice/signature.ts verifyElevenLabsSignature.
 * The simulate route signs each /webhook/voice/tool/* event with the configured
 * ELEVENLABS_WEBHOOK_SECRET so the existing HMAC preHandler accepts it.
 */
function signEvent(rawBody: Buffer, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
}

const adminRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/admin/simulate-call', async (req, reply) => {
    const parsed = SimulateBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid scenarioKey', issues: parsed.error.issues });
    }
    const { scenarioKey } = parsed.data;
    const events = scenarios[scenarioKey];
    if (!events) {
      return reply.code(400).send({ error: `unknown scenarioKey: ${scenarioKey}` });
    }

    const secret = config.ELEVENLABS_WEBHOOK_SECRET;
    if (!secret) {
      return reply.code(500).send({
        error: 'ELEVENLABS_WEBHOOK_SECRET not configured — required for in-process signature',
      });
    }

    // Replay each event in sequence. tool/* routes require HMAC; lifecycle
    // routes (call-start, call-end, lang-detected) do NOT. Sign only what needs
    // signing — the rest get a plain JSON POST.
    const conversationIds = new Set<string>();
    for (const event of events) {
      const rawBody = Buffer.from(JSON.stringify(event.body));
      const isToolRoute = event.endpoint.startsWith('/webhook/voice/tool/');
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (isToolRoute) {
        headers['x-elevenlabs-signature'] = signEvent(rawBody, secret);
      }
      const res = await app.inject({
        method: 'POST',
        url: event.endpoint,
        payload: event.body,
        headers,
      });
      if (res.statusCode >= 500) {
        req.log.error(
          { scenarioKey, endpoint: event.endpoint, status: res.statusCode, body: res.body },
          'simulate-call.event.5xx'
        );
        return reply
          .code(500)
          .send({ error: `event failed: ${event.endpoint} → ${res.statusCode}`, body: res.body });
      }
      const convId = (event.body as { conversation_id?: string }).conversation_id;
      if (convId) conversationIds.add(convId);
    }

    if (conversationIds.size === 0) {
      return reply.code(500).send({ error: 'scenario produced no conversation_id' });
    }
    if (conversationIds.size > 1) {
      // All 5 scenarios use a single conversation_id; defensive.
      return reply.code(500).send({
        error: `scenario spans multiple conversations: ${[...conversationIds].join(',')}`,
      });
    }

    const [conversationId] = conversationIds;

    // Look up the resulting calls + lead + order rows.
    const callRow = await app.db.execute(sql`
      SELECT id::text AS id, lead_id::text AS lead_id, linked_lead_id::text AS linked_lead_id
      FROM calls
      WHERE elevenlabs_conversation_id = ${conversationId}
      LIMIT 1
    `);
    const call = callRow.rows[0] as
      | { id: string; lead_id: string | null; linked_lead_id: string | null }
      | undefined;
    if (!call) {
      return reply.code(500).send({ error: 'no calls row after replay' });
    }

    const effectiveLeadId = call.linked_lead_id ?? call.lead_id;
    let orderId: string | null = null;
    if (effectiveLeadId) {
      const orderRow = await app.db.execute(sql`
        SELECT id::text AS id FROM orders
        WHERE lead_id = ${effectiveLeadId}::uuid
        ORDER BY created_at DESC
        LIMIT 1
      `);
      const o = orderRow.rows[0] as { id: string } | undefined;
      orderId = o?.id ?? null;
    }

    req.log.info(
      { scenarioKey, callId: call.id, leadId: effectiveLeadId, orderId },
      'simulate-call.completed'
    );
    return reply.send({
      callId: call.id,
      leadId: effectiveLeadId,
      orderId,
    });
  });
};

export default adminRoutes;
