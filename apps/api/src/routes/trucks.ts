// Phase 1, Plan 01-08: 501 stubs for /api/trucks
// Phase 4 ADMIN-NEW-01 (fleet CRUD) swaps in handlers; schemas remain.

import {
  CreateTruckBodySchema,
  PatchTruckBodySchema,
  TruckListQuerySchema,
  TruckSchema,
} from '@ai-logist/shared-types/api/trucks';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

const NotImpl = z.object({
  statusCode: z.number(),
  error: z.string(),
  message: z.string(),
});

const trucksRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/trucks',
    {
      schema: {
        tags: ['trucks'],
        summary: 'List fleet (Phase 4 ADMIN-NEW-01)',
        querystring: TruckListQuerySchema,
        response: { 501: NotImpl },
      },
    },
    async (_req, reply) => reply.notImplemented('Phase 4 — admin web')
  );

  app.post(
    '/trucks',
    {
      schema: {
        tags: ['trucks'],
        summary: 'Add truck (Phase 4)',
        body: CreateTruckBodySchema,
        response: { 201: TruckSchema, 501: NotImpl },
      },
    },
    async (_req, reply) => reply.notImplemented('Phase 4 — admin web')
  );

  app.patch(
    '/trucks/:id',
    {
      schema: {
        tags: ['trucks'],
        summary: 'Update truck (Phase 4)',
        params: z.object({ id: z.string().uuid() }),
        body: PatchTruckBodySchema,
        response: { 200: TruckSchema, 501: NotImpl },
      },
    },
    async (_req, reply) => reply.notImplemented('Phase 4 — admin web')
  );
};

export default trucksRoutes;
