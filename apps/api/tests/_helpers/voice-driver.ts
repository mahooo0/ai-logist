// apps/api/tests/_helpers/voice-driver.ts
// Phase 3.1 helper: app.inject wrapper for /webhook/voice/* with HMAC signature
// header injection + latency measurement.
//
// Latency measured via process.hrtime.bigint() / 1_000_000 (sub-ms precision)
// for Pitfall #3 budget (<500ms per voice tool handler — the ElevenLabs filler
// cliff). Mirrors Phase 3 webhook-driver.ts pattern.
//
// Usage:
//   const { res, elapsedMs } = await injectVoiceWebhook(app, {
//     endpoint: '/webhook/voice/tool/extract-request',
//     body: { conversation_id: 'conv_x', parameters: { text: 'Киев Львов' } },
//     secret: process.env.ELEVENLABS_WEBHOOK_SECRET!,
//   });
//   expect(res.statusCode).toBe(200);
//   expect(elapsedMs).toBeLessThan(500);

import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { signElevenLabsBody } from './voice-mock.js';

export interface VoiceWebhookResult {
  res: LightMyRequestResponse;
  elapsedMs: number;
}

export interface VoiceWebhookArgs {
  endpoint: string;
  body: object;
  secret: string;
  /**
   * Override the computed HMAC signature — useful for testing tamper/401
   * paths. If omitted, signature is computed via signElevenLabsBody().
   */
  rawSignatureOverride?: string;
  /** Optional extra headers merged after defaults; can override. */
  extraHeaders?: Record<string, string>;
}

export async function injectVoiceWebhook(
  app: FastifyInstance,
  args: VoiceWebhookArgs
): Promise<VoiceWebhookResult> {
  const raw = Buffer.from(JSON.stringify(args.body));
  const sig = args.rawSignatureOverride ?? signElevenLabsBody(raw, args.secret);

  const headers: Record<string, string> = {
    'x-elevenlabs-signature': sig,
    'content-type': 'application/json',
    ...(args.extraHeaders ?? {}),
  };

  const t0 = process.hrtime.bigint();
  const res = await app.inject({
    method: 'POST',
    url: args.endpoint,
    payload: args.body,
    headers,
  });
  const elapsedMs = Number(process.hrtime.bigint() - t0) / 1_000_000;

  return { res, elapsedMs };
}
