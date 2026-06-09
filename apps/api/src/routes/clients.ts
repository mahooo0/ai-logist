// Phase 1, Plan 01-08: 501 stub for /api/clients/:id/messages
// Phase 4 ADMIN-03 (multi-channel chat) swaps in the handler.

import { ListMessagesQuerySchema, MessageSchema } from '@ai-logist/shared-types/api/clients';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

const NotImpl = z.object({
  statusCode: z.number(),
  error: z.string(),
  message: z.string(),
});

const clientsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/clients/:id/messages',
    {
      schema: {
        tags: ['clients'],
        summary: 'Client message history (Phase 4 ADMIN-03)',
        params: z.object({ id: z.string().uuid() }),
        querystring: ListMessagesQuerySchema,
        response: { 200: z.array(MessageSchema), 501: NotImpl },
      },
    },
    async (_req, reply) => reply.notImplemented('Phase 4 — admin chat')
  );
};

export default clientsRoutes;
