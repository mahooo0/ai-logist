// Phase 2 Plan 02-02 Task 1 — STUB for calcPrice (replaced by Task 2 with the
// pure-function implementation per 02-RESEARCH.md §5). The barrel `index.ts`
// imports `calcPriceTool` at the end of Task 1 so the API typechecks; Task 2
// swaps the body in-place without changing the export shape.

import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod/v4';
import type { ToolContext } from './index.js';

export const CalcPriceInputSchema = z.object({
  route_km: z.number().positive(),
  tons: z.number().positive(),
  body_type: z.enum(['tent', 'ref', 'iso', 'container']),
  direction: z.enum(['default', 'back_haul']).default('default'),
});

export function calcPriceTool(_ctx: ToolContext) {
  return betaZodTool({
    name: 'calcPrice',
    description: 'STUB — replaced by Wave 2 Task 2.',
    inputSchema: CalcPriceInputSchema,
    run: async () =>
      JSON.stringify({
        ok: false,
        error: { code: 'NOT_IMPLEMENTED', message: 'Wave 2 Task 2/3' },
      }),
  });
}
