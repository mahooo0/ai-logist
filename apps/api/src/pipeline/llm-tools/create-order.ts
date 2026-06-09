// Phase 2 Plan 02-02 Task 1 — STUB for createOrder (replaced by Task 3 with
// the transactional price-lock implementation per 02-RESEARCH.md §5.5). The
// barrel `index.ts` imports `createOrderTool` at the end of Task 1 so the API
// typechecks; Task 3 swaps the body in-place without changing the export shape.
//
// CRITICAL: the input schema does NOT contain a `price` field — D-06 closes
// Pitfall #1 at the type level. The real handler re-reads `leads.quoted_price`
// inside the transaction.

import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod/v4';
import type { ToolContext } from './index.js';

export const CreateOrderInputSchema = z
  .object({
    lead_id: z.string().uuid(),
    confirmed: z.literal(true),
  })
  .strict();

export function createOrderTool(_ctx: ToolContext) {
  return betaZodTool({
    name: 'createOrder',
    description: 'STUB — replaced by Wave 2 Task 3.',
    inputSchema: CreateOrderInputSchema,
    run: async () =>
      JSON.stringify({
        ok: false,
        error: { code: 'NOT_IMPLEMENTED', message: 'Wave 2 Task 2/3' },
      }),
  });
}
