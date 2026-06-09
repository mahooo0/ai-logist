// Phase 2 Plan 02-02 Task 1 — STUB for discount (replaced by Task 3 with the
// min-floor validator per 02-RESEARCH.md / CONTEXT D-26). The barrel `index.ts`
// imports `discountTool` at the end of Task 1 so the API typechecks; Task 3
// swaps the body in-place without changing the export shape.
//
// LLM may give discounts only inside [min, default] corridor; below min → returns
// {ok:false, error:{code:'escalation_needed'}}.

import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod/v4';
import type { ToolContext } from './index.js';

export const DiscountInputSchema = z
  .object({
    lead_id: z.string().uuid(),
    amount_kopecks: z.number().positive(),
    reason: z.string().min(3),
  })
  .strict();

export function discountTool(_ctx: ToolContext) {
  return betaZodTool({
    name: 'discount',
    description: 'STUB — replaced by Wave 2 Task 3.',
    inputSchema: DiscountInputSchema,
    run: async () =>
      JSON.stringify({
        ok: false,
        error: { code: 'NOT_IMPLEMENTED', message: 'Wave 2 Task 2/3' },
      }),
  });
}
