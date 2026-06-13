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

import type { FastifyPluginAsync } from 'fastify';
import { config } from '../../config.js';
import { validateTwilioRequest } from './signature.js';

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
        }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        req.log.error(
          { status: resp.status, body: text.slice(0, 300), fromNumber, toNumber },
          'voice.twilio.twiml.register_call_failed'
        );
        return reply
          .type('text/xml')
          .send(sayHangup('Sorry, we cannot connect you right now.'));
      }
      const twiml = await resp.text();
      req.log.info(
        { fromNumber, toNumber, twimlLen: twiml.length },
        'voice.twilio.twiml.register_call_ok'
      );
      return reply.type('text/xml').send(twiml);
    } catch (err) {
      req.log.error({ err: String(err) }, 'voice.twilio.twiml.fetch_error');
      return reply
        .type('text/xml')
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
