// Phase 2 Plan 02-02 Task 1 — STUB for nearestTruck (replaced by Task 2 with real
// PostGIS CTE re-rank SQL per 02-RESEARCH.md §4). The barrel `index.ts` imports
// `nearestTruckTool` at the end of Task 1 so the API typechecks; Task 2 swaps the
// body in-place without changing the export shape.

import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod/v4';
import type { ToolContext } from './index.js';

export const NearestTruckInputSchema = z.object({
  pickup_lon: z.number(),
  pickup_lat: z.number(),
  tons: z.number().positive(),
  body_type: z.enum(['tent', 'ref', 'iso', 'container']).nullable(),
});

export function nearestTruckTool(_ctx: ToolContext) {
  return betaZodTool({
    name: 'nearestTruck',
    description: 'STUB — replaced by Wave 2 Task 2.',
    inputSchema: NearestTruckInputSchema,
    run: async () =>
      JSON.stringify({
        ok: false,
        error: { code: 'NOT_IMPLEMENTED', message: 'Wave 2 Task 2/3' },
      }),
  });
}
