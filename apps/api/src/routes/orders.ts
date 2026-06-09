// Phase 1, Plan 01-08: 501 stubs for /api/orders
// Includes the price-override route (ADMIN-NEW-06) with mandatory reason field.

import {
  CreateOrderBodySchema,
  OrderDetailSchema,
  OrderListQuerySchema,
  OrderSchema,
  PriceOverrideBodySchema,
} from '@ai-logist/shared-types/api/orders';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

const NotImpl = z.object({
  statusCode: z.number(),
  error: z.string(),
  message: z.string(),
});

const ordersRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/orders',
    {
      schema: {
        tags: ['orders'],
        summary: 'List orders (Phase 4)',
        querystring: OrderListQuerySchema,
        response: { 501: NotImpl },
      },
    },
    async (_req, reply) => reply.notImplemented('Phase 4 — admin web')
  );

  app.get(
    '/orders/:id',
    {
      schema: {
        tags: ['orders'],
        summary: 'Order detail + events timeline (Phase 4)',
        params: z.object({ id: z.string().uuid() }),
        response: { 200: OrderDetailSchema, 501: NotImpl },
      },
    },
    async (_req, reply) => reply.notImplemented('Phase 4 — admin web')
  );

  app.post(
    '/orders',
    {
      schema: {
        tags: ['orders'],
        summary: 'Manual order creation (Phase 4)',
        body: CreateOrderBodySchema,
        response: { 201: OrderSchema, 501: NotImpl },
      },
    },
    async (_req, reply) => reply.notImplemented('Phase 4 — admin web')
  );

  app.post(
    '/orders/:id/price-override',
    {
      schema: {
        tags: ['orders'],
        summary: 'Price override with audit (Phase 4 / ADMIN-NEW-06)',
        params: z.object({ id: z.string().uuid() }),
        body: PriceOverrideBodySchema,
        response: { 200: OrderSchema, 501: NotImpl },
      },
    },
    async (_req, reply) => reply.notImplemented('Phase 4 — ADMIN-NEW-06')
  );
};

export default ordersRoutes;
