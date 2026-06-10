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

import type { FastifyBaseLogger } from 'fastify';
import type { OutboundChannel } from '../../pipeline/outbound.js';

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
