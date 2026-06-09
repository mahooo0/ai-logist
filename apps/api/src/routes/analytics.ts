// Phase 1, Plan 01-08: 501 stub for /api/analytics/kpi
// Phase 4 ADMIN-05 (KPI dashboard) swaps in the handler.

import { KpiResponseSchema } from '@ai-logist/shared-types/api/analytics';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

const NotImpl = z.object({
  statusCode: z.number(),
  error: z.string(),
  message: z.string(),
});

const analyticsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/analytics/kpi',
    {
      schema: {
        tags: ['analytics'],
        summary: 'KPI for dashboards (Phase 4 ADMIN-05)',
        querystring: z.object({ window: z.enum(['day', 'week', 'month']).default('week') }),
        response: { 200: KpiResponseSchema, 501: NotImpl },
      },
    },
    async (_req, reply) => reply.notImplemented('Phase 4 — admin analytics')
  );
};

export default analyticsRoutes;
