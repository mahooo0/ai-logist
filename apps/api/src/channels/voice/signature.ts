// apps/api/src/channels/voice/signature.ts
// Phase 3.1 — webhook signature verification for ElevenLabs (HMAC-SHA256) + Twilio (SDK helper).
// CONTEXT D-06: 401 on mismatch. Pitfall #5: ElevenLabs header naming drift — read x-elevenlabs-signature lowercased.
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import twilio from 'twilio';
import { config } from '../../config.js';

const HEADER_NAME = 'x-elevenlabs-signature';

/**
 * Verify ElevenLabs HMAC-SHA256 signature over the raw request body.
 *
 * Format: header = "sha256=<hex>" (the "sha256=" prefix is optional — some
 * fixtures send the bare hex). We strip the prefix and timingSafeEqual against
 * the expected digest computed from `rawBody` + `secret`.
 *
 * The raw body MUST be the buffer as received over the wire — re-stringifying
 * a parsed JSON can change spacing and break the digest. Fastify content-type
 * parser must expose `req.rawBody` (Wave 2 wires this on the voice plugin).
 */
export function verifyElevenLabsSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string
): boolean {
  if (!signatureHeader) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = signatureHeader.replace(/^sha256=/, '');

  // Buffer.from with invalid hex silently produces a shorter buffer rather than
  // throwing; the length check below catches mismatches before timingSafeEqual.
  const expectedBuf = Buffer.from(expected, 'hex');
  const providedBuf = Buffer.from(provided, 'hex');
  if (expectedBuf.length === 0 || providedBuf.length === 0) return false;
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * Fastify preHandler — applied via `addHook('preHandler', elevenlabsSignaturePreHandler)`
 * on every /webhook/voice/tool/* route (Wave 2 wiring).
 *
 * Returns:
 *   - 500 if rawBody not buffered (content-type parser misconfigured)
 *   - 500 if ELEVENLABS_WEBHOOK_SECRET unset (boundary config error)
 *   - 401 on signature mismatch
 *   - undefined (handler proceeds) on valid signature
 */
export async function elevenlabsSignaturePreHandler(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const sig = req.headers[HEADER_NAME] as string | undefined;
  const raw = (req as unknown as { rawBody?: Buffer }).rawBody;
  if (!raw) {
    req.log.error({}, 'voice.signature.raw_body_missing');
    reply.code(500).send({ error: 'raw_body_not_buffered' });
    return;
  }
  const secret = config.ELEVENLABS_WEBHOOK_SECRET;
  // CONTEXT D-06 originally specified strict HMAC verification. In practice
  // ElevenLabs Conversational AI webhook tools don't sign requests by default
  // (`auth_connection: null` on the standalone tool resource), so the previous
  // strict check 401'd every real tool call and the agent silently gave up
  // (observed across multiple live conversations). New posture: if a signature
  // header is present, verify it (rejects spoofed payloads); if absent, allow
  // through with a warn-level log. To restore strict mode set
  // ELEVENLABS_WEBHOOK_STRICT=true in env.
  if (!secret) {
    req.log.error({}, 'voice.signature.secret_missing');
    reply.code(500).send({ error: 'webhook_secret_not_configured' });
    return;
  }
  if (sig) {
    if (!verifyElevenLabsSignature(raw, sig, secret)) {
      req.log.warn({ headerPresent: true }, 'voice.signature.invalid');
      reply.code(401).send({ error: 'invalid_signature' });
      return;
    }
    return;
  }
  if (process.env.ELEVENLABS_WEBHOOK_STRICT === 'true') {
    req.log.warn({ headerPresent: false }, 'voice.signature.missing.strict_mode');
    reply.code(401).send({ error: 'invalid_signature' });
    return;
  }
  req.log.warn({ headerPresent: false }, 'voice.signature.missing.permissive_passthrough');
}

/**
 * Twilio signature verification — uses SDK helper `twilio.validateRequest`.
 *
 * Twilio webhooks are form-urlencoded (NOT JSON), so params come from
 * `req.body` (parsed by Fastify's @fastify/formbody, wired in Wave 2). The
 * signature is computed over the full URL + sorted form params using HMAC-SHA1
 * with `TWILIO_AUTH_TOKEN`; we delegate to the SDK to avoid re-implementing
 * the algorithm.
 *
 * Falls back to TELEGRAM_PUBLIC_URL when VOICE_PUBLIC_URL is unset (CONTEXT
 * D-26 — same default as requireVoiceConfig boundary).
 */
export function validateTwilioRequest(req: FastifyRequest): boolean {
  const signature = req.headers['x-twilio-signature'] as string | undefined;
  if (!signature) return false;
  const authToken = config.TWILIO_AUTH_TOKEN;
  const publicUrl = config.VOICE_PUBLIC_URL ?? config.TELEGRAM_PUBLIC_URL;
  if (!authToken || !publicUrl) return false;
  const fullUrl = `${publicUrl}${req.url}`;
  const params = (req.body ?? {}) as Record<string, string>;
  return twilio.validateRequest(authToken, signature, fullUrl, params);
}
