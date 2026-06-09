// Phase 1, Plan 01-08: 501 stubs for /api/leads
// Routes register their FULL Zod request/response schemas so Swagger UI
// surfaces the contract. Handlers call reply.notImplemented() per D-25 and
// RESEARCH.md Pattern 7. Phase 2 (matching/quoting) and Phase 4 (admin Kanban)
// swap in real handler bodies — schemas remain unchanged.

import {
  LeadListQuerySchema,
  LeadMatchResponseSchema,
  LeadPatchBodySchema,
  LeadQuoteResponseSchema,
} from '@ai-logist/shared-types/api/leads';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

// Canonical shape @fastify/sensible writes for reply.notImplemented()
const NotImpl = z.object({
  statusCode: z.number(),
  error: z.string(),
  message: z.string(),
});

const leadsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/leads',
    {
      schema: {
        tags: ['leads'],
        summary: 'List leads (Phase 4)',
        querystring: LeadListQuerySchema,
        response: { 501: NotImpl },
      },
    },
    async (_req, reply) => reply.notImplemented('Phase 4 — admin web')
  );

  app.patch(
    '/leads/:id',
    {
      schema: {
        tags: ['leads'],
        summary: 'Update lead stage (Phase 4)',
        params: z.object({ id: z.string().uuid() }),
        body: LeadPatchBodySchema,
        response: { 501: NotImpl },
      },
    },
    async (_req, reply) => reply.notImplemented('Phase 4 — admin web')
  );

  app.post(
    '/leads/:id/match',
    {
      schema: {
        tags: ['leads'],
        summary: 'Re-run truck matching (Phase 2)',
        params: z.object({ id: z.string().uuid() }),
        response: { 200: LeadMatchResponseSchema, 501: NotImpl },
      },
    },
    async (_req, reply) => reply.notImplemented('Phase 2 — nearestTruck')
  );

  app.post(
    '/leads/:id/quote',
    {
      schema: {
        tags: ['leads'],
        summary: 'Re-run price calculation (Phase 2)',
        params: z.object({ id: z.string().uuid() }),
        response: { 200: LeadQuoteResponseSchema, 501: NotImpl },
      },
    },
    async (_req, reply) => reply.notImplemented('Phase 2 — calcPrice')
  );
};

export default leadsRoutes;
