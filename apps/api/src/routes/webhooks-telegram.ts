// Phase 3 D-04 + RESEARCH Pattern 2 — two-stage Telegram webhook handler.
//
// Stage 1 (sync, <100ms budget):
//   - Verify X-Telegram-Bot-Api-Secret-Token header (TG-01, API-13).
//   - INSERT update into webhook_updates with ON CONFLICT DO NOTHING (TG-02).
//   - reply.code(200).send({ok:true}) — fire and forget.
//
// Stage 2 (async, setImmediate):
//   - Fire processTelegramUpdate(payload).catch(log) — never await.
//   - Skipped entirely on duplicate (rowCount=0) so retries are free.
import {
  TelegramUpdateBodySchema,
  WebhookAckResponseSchema,
} from '@ai-logist/shared-types/api/webhooks';
import { sql } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';
import { processTelegramUpdate } from '../channels/telegram/adapter.js';
import { config } from '../config.js';

const ErrorBody = z.object({
  statusCode: z.number(),
  error: z.string(),
  message: z.string(),
});

const webhooksTelegramRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/telegram',
    {
      schema: {
        tags: ['webhooks'],
        summary: 'Telegram webhook (TG-01/TG-02, API-13)',
        body: TelegramUpdateBodySchema,
        response: { 200: WebhookAckResponseSchema, 401: ErrorBody },
      },
    },
    async (req, reply) => {
      // Stage 1a — secret_token verification (TG-01, D-05).
      // Telegram sends X-Telegram-Bot-Api-Secret-Token header iff secret_token
      // was passed to setWebhook. Mismatch = forged request → 401.
      const provided = req.headers['x-telegram-bot-api-secret-token'];
      if (!config.TELEGRAM_WEBHOOK_SECRET || provided !== config.TELEGRAM_WEBHOOK_SECRET) {
        app.log.warn({ ip: req.ip }, 'telegram: bad secret_token');
        return reply.code(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'invalid secret_token',
        });
      }

      // Stage 1b — idempotency persist (TG-02, D-06).
      // Phase 1 created webhook_updates with UNIQUE(source, external_id).
      // ON CONFLICT DO NOTHING → if rowCount = 0, this is a Telegram retry
      // (or a malicious replay) and we ack-200 without re-running.
      const updateId = req.body.update_id;
      const inserted = await app.db.execute(sql`
        INSERT INTO webhook_updates (source, external_id, payload)
        VALUES ('telegram', ${String(updateId)}, ${JSON.stringify(req.body)}::jsonb)
        ON CONFLICT (source, external_id) DO NOTHING
        RETURNING id
      `);

      // Stage 1c — ack immediately. Telegram retries past 5s; we target <100ms.
      reply.code(200).send({ ok: true });

      // Stage 2 — fire-and-forget async worker (D-07). setImmediate guarantees
      // the reply has flushed before processing begins. .catch keeps unhandled
      // rejections from killing the process.
      if (inserted.rows.length > 0) {
        setImmediate(() => {
          processTelegramUpdate({
            app,
            payload: req.body as { update_id: number } & Record<string, unknown>,
          }).catch((err) => {
            app.log.error({ err, updateId }, 'telegram: processTelegramUpdate failed');
          });
        });
      } else {
        app.log.info({ updateId }, 'telegram: duplicate update ignored');
      }
    }
  );
};

export default webhooksTelegramRoutes;
