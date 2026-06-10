// Phase 3 D-09 — Telegram → Pipeline adapter.
// Wave 2 ships a STUB so the webhook route compiles + can call into it.
// Wave 3 (Plan 03-03) replaces the function body with the real adapter
// per RESEARCH Pattern 5 (Telegram update → InboundArgs → handleInboundMessage).
import type { FastifyInstance } from 'fastify';

export interface ProcessTelegramUpdateArgs {
  app: FastifyInstance;
  payload: { update_id: number } & Record<string, unknown>;
}

export async function processTelegramUpdate(args: ProcessTelegramUpdateArgs): Promise<void> {
  args.app.log.info(
    { update_id: args.payload.update_id },
    'telegram: stub processTelegramUpdate (Wave 3 wires adapter)'
  );
  // Wave 3 implementation lands here.
}
