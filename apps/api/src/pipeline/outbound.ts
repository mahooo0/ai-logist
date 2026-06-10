// Phase 3 D-14 + 03-RESEARCH.md Pattern 3 — channel-agnostic outbound surface.
//
// intake.ts (Phase 2) takes `channel: string` and returns exchanges[]. Phase 3
// adds proactive sends (quote keyboard, manager messages) that require
// channel-specific APIs (Telegram InlineKeyboard, future voice TTS).
// The OutboundChannel interface keeps intake channel-blind: it calls
// `outbound.get(channel)?.sendQuoteKeyboard(...)` AFTER db.transaction commits
// and never depends on grammY types.
//
// Wave 3 (this plan) wires the 'telegram' entry. Wave 3.1 voice will add 'voice'
// as a no-op for proactive sends (voice initiates outbound calls separately).

export interface OutboundChannel {
  /** Send the QUOTED-stage inline keyboard (TG-03 / TG-04). */
  sendQuoteKeyboard(args: {
    clientId: string;
    leadId: string;
    quotedPriceKop: bigint;
    lang: 'ru' | 'ua';
  }): Promise<void>;

  /** Send a plain text message (manager intercept, follow-up, handover). */
  sendText(args: { clientId: string; text: string }): Promise<void>;
}

/**
 * Per-channel registry. Phase 3 wires the 'telegram' entry; Phase 3.1 voice
 * adds 'voice' as a no-op for proactive sends (voice initiates outbound calls).
 */
export class OutboundRegistry {
  private impls = new Map<string, OutboundChannel>();

  register(channel: string, impl: OutboundChannel): void {
    this.impls.set(channel, impl);
  }

  get(channel: string): OutboundChannel | null {
    return this.impls.get(channel) ?? null;
  }
}
