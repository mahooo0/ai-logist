// Phase 1, Plan 01-08: 501 stubs for /webhook/*
// Mounted with prefix `/webhook` (not `/api`) per spec §6.
// Phase 3 (Telegram TG-01/TG-02 + voice API-15) and Phase 5 (GPS API-14)
// swap in handlers.

import {
  GpsPushBodySchema,
  TelegramUpdateBodySchema,
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
    '/telegram',
    {
      schema: {
        tags: ['webhooks'],
        summary: 'Telegram webhook (Phase 3 TG-01/TG-02)',
        body: TelegramUpdateBodySchema,
        response: { 200: WebhookAckResponseSchema, 501: NotImpl },
      },
    },
    async (_req, reply) => reply.notImplemented('Phase 3 — Telegram')
  );

  app.post(
    '/voice',
    {
      schema: {
        tags: ['webhooks'],
        summary: 'Voice callback (Phase 3 API-15 stub returns 200)',
        body: VoiceCallbackBodySchema,
        response: { 200: WebhookAckResponseSchema, 501: NotImpl },
      },
    },
    async (_req, reply) => reply.notImplemented('Phase 3 — voice callback stub')
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
