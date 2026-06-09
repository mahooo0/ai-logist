// @ai-logist/shared-types — Phase 1, Plan 01-08
// DTO schema for /api/analytics/kpi — admin KPI dashboard (ADMIN-05).

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
    amount: z.string(), // kopecks as string (bigint)
    currency: z.string(),
  }),
});
export type KpiResponse = z.infer<typeof KpiResponseSchema>;
