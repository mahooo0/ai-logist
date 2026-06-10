// Phase 1, Plan 01-08: 501 stubs for /webhook/*
// Mounted with prefix `/webhook` (not `/api`) per spec §6.
// Phase 3 (Plan 03-02) — /telegram moved to webhooks-telegram.ts (two-stage handler).
//                       /voice flipped from 501 → 200 ack (Phase 3.1 placeholder).
// Phase 5 (GPS API-14) swaps /gps in.

import {
  GpsPushBodySchema,
  VoiceCallbackBodySchema,
  WebhookAckResponseSchema,
} from '@ai-logist/shared-types/api/webhooks';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

const NotImpl = z.object({
  statusCode: z.number(),
  error: z.string(),
  message: z.string(),
});

const webhooksRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/voice',
    {
      schema: {
        tags: ['webhooks'],
        summary: 'Voice callback stub (Phase 3.1 placeholder; returns 200 ack — API-15)',
        body: VoiceCallbackBodySchema,
        response: { 200: WebhookAckResponseSchema },
      },
    },
    async (_req, reply) => reply.code(200).send({ ok: true })
  );

  app.post(
    '/gps',
    {
      schema: {
        tags: ['webhooks'],
        summary: 'GPS position push (Phase 5 API-14)',
        body: GpsPushBodySchema,
        response: { 200: WebhookAckResponseSchema, 501: NotImpl },
      },
    },
    async (_req, reply) => reply.notImplemented('Phase 5 — GPS push')
  );
};

export default webhooksRoutes;
