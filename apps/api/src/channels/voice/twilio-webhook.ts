// apps/api/src/channels/voice/twilio-webhook.ts
//
// Phase 3.1 — Twilio inbound voice webhook. Closes the gap that left
// /webhook/voice/twilio/twiml returning 404 (caller hears "application error").
//
// Architecture: Twilio dials the trial number → POSTs application/x-www-form-
// urlencoded to /webhook/voice/twilio/twiml → we fetch a signed WebSocket URL
// from ElevenLabs (private agents require signature) → respond with TwiML
// `<Connect><Stream url="..."/>` which streams Twilio media to the agent.
//
// Why our backend sits in the middle (vs pointing Twilio straight at ElevenLabs'
// native inbound URL): keeps the call-start / call-end / lang-detected hooks
// reachable so each call still becomes a lead (CONTEXT 03.1-CONTEXT D-13).
//
// Signature: verifies x-twilio-signature via validateTwilioRequest. Skipped
// when TWILIO_WEBHOOK_SIGNATURE_SECRET is unset (boundary log + warn so a misset
// env doesn't silently 401 the only inbound path).

import { sql } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { config } from '../../config.js';
import { validateTwilioRequest } from './signature.js';
import { setVoiceState } from './state.js';

function parseFormBody(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of raw.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const k =
      eq === -1
        ? decodeURIComponent(pair.replace(/\+/g, ' '))
        : decodeURIComponent(pair.slice(0, eq).replace(/\+/g, ' '));
    const v =
      eq === -1 ? '' : decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, ' '));
    out[k] = v;
  }
  return out;
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sayHangup(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${xmlEscape(message)}</Say>
  <Hangup/>
</Response>`;
}

const twilioWebhookPlugin: FastifyPluginAsync = async (app) => {
  // Twilio posts application/x-www-form-urlencoded; parse to a Record<string,string>
  // so validateTwilioRequest (and req.log fields) can read CallSid, From, To, …
  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_req, body, done) => {
      try {
        done(null, parseFormBody(body as string));
      } catch (e) {
        done(e as Error);
      }
    }
  );

  // POST /webhook/voice/twilio/twiml — caller dialed Twilio number. We forward
  // From/To to ElevenLabs `register-call` which returns ready TwiML that bridges
  // the call into the agent. Direct <Connect><Stream> to ElevenLabs WS fails
  // (Twilio error 31921) because Twilio Media Streams protocol ≠ Convai WS
  // protocol; register-call gives us TwiML wired to ElevenLabs' own MS bridge.
  app.post('/voice/twilio/twiml', async (req, reply) => {
    if (config.TWILIO_WEBHOOK_SIGNATURE_SECRET && !validateTwilioRequest(req)) {
      req.log.warn(
        { url: req.url, hasSig: !!req.headers['x-twilio-signature'] },
        'voice.twilio.twiml.invalid_signature'
      );
      return reply.code(401).send('invalid signature');
    }

    const agentId = config.ELEVENLABS_AGENT_ID;
    const apiKey = config.ELEVENLABS_API_KEY;
    if (!agentId || !apiKey) {
      req.log.error(
        { hasAgentId: !!agentId, hasApiKey: !!apiKey },
        'voice.twilio.twiml.not_configured'
      );
      return reply
        .type('text/xml')
        .send(sayHangup('The service is not configured. Please try again later.'));
    }

    const body = (req.body ?? {}) as Record<string, string>;
    const fromNumber = body.From ?? '';
    const toNumber = body.To ?? '';
    if (!fromNumber || !toNumber) {
      req.log.error({ fromNumber, toNumber }, 'voice.twilio.twiml.missing_call_params');
      return reply
        .type('text/xml')
        .send(sayHangup('Sorry, we cannot connect you right now.'));
    }

    try {
      const resp = await fetch('https://api.elevenlabs.io/v1/convai/twilio/register-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          agent_id: agentId,
          from_number: fromNumber,
          to_number: toNumber,
          direction: 'inbound',
          // Optional: surface the caller's number to the agent as a dynamic var
          // so the prompt can reference it. Matches the official ElevenLabs
          // sample shape; the agent ignores keys it doesn't use.
          conversation_initiation_client_data: {
            dynamic_variables: { caller_number: fromNumber },
          },
        }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        req.log.error(
          { status: resp.status, body: text.slice(0, 300), fromNumber, toNumber },
          'voice.twilio.twiml.register_call_failed'
        );
        return reply
          .type('application/xml')
          .send(sayHangup('Sorry, we cannot connect you right now.'));
      }
      const twiml = await resp.text();
      req.log.info(
        { fromNumber, toNumber, twimlLen: twiml.length },
        'voice.twilio.twiml.register_call_ok'
      );

      // Inline call-start: register-call architecture bypasses the
      // /webhook/voice/call-start route, so we seed calls + client + lead +
      // Redis voice state here. Without this, every tool handler reads a
      // null state and returns {ok:false, code:'no_state'} — observed making
      // the agent stall at "секундочку, ищу машину" forever.
      const convoIdMatch = /name="conversation_id"\s+value="(conv_[a-zA-Z0-9_-]+)"/.exec(twiml);
      const conversationId = convoIdMatch?.[1];
      const callSid = body.CallSid ?? null;
      if (conversationId) {
        try {
          // 1. Upsert calls row.
          const insert = await req.server.db.execute(sql`
            INSERT INTO calls (
              elevenlabs_conversation_id, twilio_call_sid, direction, created_at
            ) VALUES (
              ${conversationId}, ${callSid}, 'inbound', NOW()
            )
            ON CONFLICT (elevenlabs_conversation_id)
              DO UPDATE SET
                twilio_call_sid = COALESCE(calls.twilio_call_sid, EXCLUDED.twilio_call_sid)
            RETURNING id::text AS id
          `);
          const callId = (insert.rows[0] as { id: string } | undefined)?.id;

          // 2. Find or create client by E.164 phone (the Twilio From header).
          let clientId: string;
          let stickyLang: 'ru' | 'ua' = 'ru';
          const found = await req.server.db.execute(sql`
            SELECT id::text AS id, lang FROM clients WHERE phone = ${fromNumber} LIMIT 1
          `);
          if (found.rows.length > 0) {
            const row = found.rows[0] as { id: string; lang: 'ru' | 'ua' };
            clientId = row.id;
            stickyLang = row.lang;
          } else {
            const created = await req.server.db.execute(sql`
              INSERT INTO clients (name, phone, lang)
              VALUES (${`voice:${conversationId}`}, ${fromNumber}, 'ru'::client_lang)
              ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
              RETURNING id::text AS id, lang
            `);
            const row = created.rows[0] as { id: string; lang: 'ru' | 'ua' };
            clientId = row.id;
            stickyLang = row.lang;
          }

          // 3. Create lead skeleton (channel='voice').
          const leadIns = await req.server.db.execute(sql`
            INSERT INTO leads (client_id, channel, stage, version)
            VALUES (${clientId}::uuid, 'voice', 'NEW', 0)
            RETURNING id::text AS id
          `);
          const leadId = (leadIns.rows[0] as { id: string }).id;

          // 4. Link calls → lead.
          if (callId) {
            await req.server.db.execute(sql`
              UPDATE calls SET lead_id = ${leadId}::uuid WHERE id = ${callId}::uuid
            `);
          }

          // 5. Seed Redis voice state so tool handlers can read it.
          await setVoiceState(req.server.redis, {
            conversation_id: conversationId,
            client_id: clientId,
            lead_id: leadId,
            lang: stickyLang,
            twilio_call_sid: callSid,
            created_at: new Date().toISOString(),
          });
          req.log.info(
            { conversationId, clientId, leadId, lang: stickyLang },
            'voice.twilio.twiml.state_seeded'
          );
        } catch (err) {
          // State seeding failure shouldn't block the call — the caller still
          // hears Alisa. Tool handlers will return {ok:false, no_state} which
          // surfaces as an agent stall, but at least the audio bridge works.
          req.log.error(
            { err: String(err), conversationId },
            'voice.twilio.twiml.state_seed_failed'
          );
        }
      } else {
        req.log.warn(
          { twimlPreview: twiml.slice(0, 200) },
          'voice.twilio.twiml.no_conversation_id_in_twiml'
        );
      }

      return reply.type('application/xml').send(twiml);
    } catch (err) {
      req.log.error({ err: String(err) }, 'voice.twilio.twiml.fetch_error');
      return reply
        .type('application/xml')
        .send(sayHangup('Sorry, we cannot connect you right now.'));
    }
  });

  // POST /webhook/voice/twilio/status — Twilio call lifecycle pings (ringing,
  // in-progress, completed, …). We just log + 200 — call-end gets persisted
  // by ElevenLabs through /webhook/voice/call-end which has the conversation_id
  // we actually key off of.
  app.post('/voice/twilio/status', async (req, reply) => {
    if (config.TWILIO_WEBHOOK_SIGNATURE_SECRET && !validateTwilioRequest(req)) {
      req.log.warn(
        { url: req.url, hasSig: !!req.headers['x-twilio-signature'] },
        'voice.twilio.status.invalid_signature'
      );
      return reply.code(401).send('invalid signature');
    }
    const body = req.body as Record<string, string> | undefined;
    req.log.info(
      {
        CallSid: body?.CallSid,
        CallStatus: body?.CallStatus,
        From: body?.From,
        To: body?.To,
        Duration: body?.CallDuration,
      },
      'voice.twilio.status'
    );
    return reply.code(200).send('');
  });
};

export default twilioWebhookPlugin;
