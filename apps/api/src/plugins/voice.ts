// apps/api/src/plugins/voice.ts
//
// Phase 3.1 — Voice Fastify plugin.
//
// Decorates the app with a VoiceOutbound instance via the OutboundChannel
// contract so callers that hold an OutboundRegistry can register the 'voice'
// channel without depending on the concrete class.
//
// Phase 3 wires OutboundRegistry per-call (apps/api/src/channels/telegram/
// handlers.ts + adapter.ts) — there is no app-wide singleton registry. The
// voice plugin therefore just exposes the factory via app.voiceOutbound so the
// Phase 3.1 Wave 3 bootstrap (or future Phase 4 admin code) can fetch the
// channel implementation without re-importing the concrete file.
//
// CONTEXT: Phase 3 D-14 (OutboundChannel) + Phase 3.1 03.1-CONTEXT D-22 (voice
// no-op for quote keyboard).

import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { createVoiceOutbound } from '../channels/voice/outbound.js';
import type { OutboundChannel } from '../pipeline/outbound.js';

declare module 'fastify' {
  interface FastifyInstance {
    voiceOutbound: OutboundChannel;
  }
}

export const voicePlugin = fp(
  async (app: FastifyInstance) => {
    const voiceOutbound = createVoiceOutbound(app.log);
    app.decorate('voiceOutbound', voiceOutbound);
    app.log.info({ channel: 'voice' }, 'voice.outbound.decorated');
  },
  { name: 'voice', dependencies: [] }
);

export default voicePlugin;
