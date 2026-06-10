// @ai-logist/shared-types — Phase 1, Plan 01-08
// DTO schema for /api/analytics/kpi — admin KPI dashboard (ADMIN-05).
//
// Phase 4 (Plan 04-03) extends per D-44 + RESEARCH Pattern 5:
//   - avgCallDurationS — average call length for the window
//   - byChannel — lead breakdown by voice vs telegram
//   - conversionFunnel — funnel counters (calls → answered → leadsCreated →
//     ordersConfirmed → delivered) for the /dashboard/default KPI tiles.
// revenue.amount stays a string (bigint precision preserved end-to-end).

import { z } from 'zod/v4';

export const KpiResponseSchema = z.object({
  window: z.enum(['day', 'week', 'month']).default('week'),
  calls: z.object({
    total: z.number(),
    answered: z.number(),
  }),
  leads: z.object({
    total: z.number(),
    byStage: z.record(z.string(), z.number()),
  }),
  orders: z.object({
    created: z.number(),
    delivered: z.number(),
  }),
  revenue: z.object({
    amount: z.string(), // kopecks as string (bigint precision preserved)
    currency: z.string(),
  }),
  // Phase 4 D-44 extensions
  avgCallDurationS: z.number().nullable(),
  byChannel: z.object({
    voice: z.number(),
    telegram: z.number(),
  }),
  conversionFunnel: z.object({
    calls: z.number(),
    answered: z.number(),
    leadsCreated: z.number(),
    ordersConfirmed: z.number(),
    delivered: z.number(),
  }),
});
export type KpiResponse = z.infer<typeof KpiResponseSchema>;
