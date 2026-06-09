// apps/api/tests/_helpers/dialog-harness.ts
// CONTEXT D-38. Drives a script-only dialog with no webhook.
// Source: 02-RESEARCH.md §10 (verbatim with adjustments noted in 02-00-PLAN.md Task 1a).
//
// Usage:
//   const result = await runScript(db, mockLlm, clientId, [
//     { from: 'client', text: 'Киев-Львов 18 тонн тент, нужно завтра' },
//   ]);
//   expect(result.finalLead.stage).toBe('ORDER_CREATED');
//   expect(result.finalOrder?.status).toBe('CREATED');
//
// Plan 02-04a Task 1 lands `apps/api/src/pipeline/intake.ts`, so this helper
// now imports `handleInboundMessage` statically — the Wave 0 dynamic-import
// fallback (with its forward-reference TS directive) is removed.

import { sql } from 'drizzle-orm';
import type { Db } from '../../src/db.js';
import { handleInboundMessage, type InboundMessageResult } from '../../src/pipeline/intake.js';
import type { LlmProvider } from './mock-anthropic.js';

export interface ScriptMessage {
  from: 'client';
  text: string;
}

export interface ScriptResult {
  finalLead: { id: string; stage: string; quotedPrice: bigint | null };
  finalOrder?: { id: string; status: string; price: bigint };
  conversation: Array<{ role: 'user' | 'assistant' | 'tool'; content: unknown }>;
}

/**
 * Drive a scripted dialog end-to-end without booting Fastify or hitting a webhook.
 *
 * Calls `handleInboundMessage` once per client message and accumulates the
 * resulting conversation. Returns the final lead row + (optionally) created
 * order row.
 */
export async function runScript(
  db: Db,
  mockLlm: LlmProvider,
  clientId: string,
  messages: ScriptMessage[]
): Promise<ScriptResult> {
  const conversation: ScriptResult['conversation'] = [];
  let lastLeadId: string | undefined;

  for (const msg of messages) {
    const turn: InboundMessageResult = await handleInboundMessage({
      db,
      llm: mockLlm,
      clientId,
      text: msg.text,
      channel: 'test-harness',
    });
    lastLeadId = turn.leadId;
    conversation.push(...turn.exchanges);
  }

  if (!lastLeadId) {
    throw new Error('runScript produced no lead — empty script?');
  }

  const leadRows = await db.execute(sql`
    SELECT id, stage, quoted_price AS "quotedPrice"
    FROM leads
    WHERE id = ${lastLeadId}
  `);
  const orderRows = await db.execute(sql`
    SELECT id, status, price
    FROM orders
    WHERE lead_id = ${lastLeadId}
  `);

  const finalLead = leadRows.rows[0] as
    | { id: string; stage: string; quotedPrice: bigint | null }
    | undefined;
  if (!finalLead) {
    throw new Error(`runScript: lead ${lastLeadId} not found after dialog`);
  }
  const finalOrder = orderRows.rows[0] as { id: string; status: string; price: bigint } | undefined;

  return {
    finalLead,
    finalOrder,
    conversation,
  };
}
