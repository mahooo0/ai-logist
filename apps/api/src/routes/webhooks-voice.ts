// apps/api/src/routes/webhooks-voice.ts
//
// Phase 3.1 — Fastify router for /webhook/voice/*. Registers a SCOPED raw-body
// content-type parser for HMAC verification (signature.ts reads
// `(req as any).rawBody`), then mounts the two child plugins:
//   - tool-handlers.ts (5 routes — /webhook/voice/tool/{extract-request,
//     nearest-truck, calc-price, create-order, discount})
//   - call-lifecycle.ts (3 routes — /webhook/voice/{call-start, call-end,
//     lang-detected})
//
// Scoped registration via `app.register(async (scope) => { ... })` keeps the
// raw-body parser from colliding with Fastify's default JSON parser used by
// every other route. The scope's content-type parser only applies to routes
// registered INSIDE that scope.
//
// Mounted in app.ts BEFORE the generic webhooks.ts router so the /webhook/voice
// prefix is claimed by the real handlers before the generic plugin sees any
// /webhook/voice request.

import type { FastifyPluginAsync } from 'fastify';
import callLifecyclePlugin from '../channels/voice/call-lifecycle.js';
import voiceToolHandlers from '../channels/voice/tool-handlers.js';

const webhooksVoice: FastifyPluginAsync = async (app) => {
  // Scoped raw-body parser — only routes registered inside this inner scope
  // see the buffer-parseAs override. Outer routes keep the default JSON parser.
  await app.register(async (scope) => {
    scope.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
      (req as unknown as { rawBody: Buffer }).rawBody = body as Buffer;
      try {
        const json =
          (body as Buffer).length === 0 ? {} : JSON.parse((body as Buffer).toString('utf8'));
        done(null, json);
      } catch (e) {
        done(e as Error);
      }
    });

    // Mount the 5 tool handlers (signature preHandler applied inside).
    await scope.register(voiceToolHandlers);

    // Mount call lifecycle (call-start / call-end / lang-detected). The signature
    // preHandler is NOT applied to call-start/call-end/lang-detected by default —
    // RESEARCH notes these may originate from Twilio (not ElevenLabs) in some
    // configurations. v1 leaves them unverified; production with ElevenLabs-only
    // pre-call hooks should apply the preHandler here too. Documented deviation.
    await scope.register(callLifecyclePlugin);
  });
};

export default webhooksVoice;
