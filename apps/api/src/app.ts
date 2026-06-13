import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { config } from './config.js';
import { registerFollowUpScheduler } from './pipeline/follow-up-scheduler.js';
import { registerOrderTicker } from './pipeline/lifecycle/order-ticker.js';
import { adminAuthPlugin } from './plugins/admin-auth.js';
import { dbPlugin } from './plugins/db.js';
import { redisPlugin } from './plugins/redis.js';
import { telegramPlugin } from './plugins/telegram.js';
import { voicePlugin } from './plugins/voice.js';
import adminRoutes from './routes/admin.js';
import analyticsRoutes from './routes/analytics.js';
import callsRoutes from './routes/calls.js';
import clientsRoutes from './routes/clients.js';
import healthRoutes from './routes/health.js';
import leadsRoutes from './routes/leads.js';
import ordersRoutes from './routes/orders.js';
import trucksRoutes from './routes/trucks.js';
import webhooksRoutes from './routes/webhooks.js';
import webhooksTelegramRoutes from './routes/webhooks-telegram.js';
import webhooksVoiceRoutes from './routes/webhooks-voice.js';
import webhooksStripeRoutes from './routes/webhooks-stripe.js';

/**
 * Build the Fastify v5 app with all plugins wired:
 *  - pino logger (json prod / pino-pretty dev per D-17)
 *  - Zod type provider (Pitfall #4: zod/v4 imports)
 *  - @fastify/sensible (reply.notImplemented for 501 stubs in Plan 01-08)
 *  - db plugin (Drizzle + pg.Pool decorator)
 *  - redis plugin (ioredis decorator)
 *  - swagger + swagger-ui at /api/docs (D-26)
 *  - healthRoutes at /api/health (D-16; Plan 01-08 adds the 501 stubs)
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      ...(config.NODE_ENV === 'development'
        ? {
            transport: {
              target: 'pino-pretty',
              options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
            },
          }
        : {}),
    },
    disableRequestLogging: false,
    requestIdHeader: 'x-request-id',
  }).withTypeProvider<ZodTypeProvider>();

  // Zod ↔ Fastify wiring
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Core plugins
  await app.register(sensible);
  await app.register(dbPlugin);

  // Apply hand-rolled migrations (e.g. ALTER TYPE ADD VALUE — forbidden inside
  // drizzle-kit's BEGIN/COMMIT wrapper). Idempotent on every boot. Runs AFTER
  // dbPlugin so the pool is ready, BEFORE any route that may query the new
  // columns/enums.
  const { applyHandRolledMigrations } = await import('./lib/apply-hand-rolled-migrations.js');
  await applyHandRolledMigrations(app.pgPool, app.log);

  await app.register(redisPlugin);
  // Phase 6 Pitfall 6 — admin shared-secret preHandler. Registered BEFORE
  // route plugins so the decorator is available when ordersRoutes loads.
  await app.register(adminAuthPlugin);
  // Phase 3 — must run BEFORE routes that touch app.bot.
  await app.register(telegramPlugin);
  // Phase 3.1 — decorates app.voiceOutbound (no-op channel). Independent of voice
  // env vars (the outbound is a logging-only no-op even without ElevenLabs).
  await app.register(voicePlugin);

  // OpenAPI
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'AI-Логист API',
        description: 'Logistics dispatching backend — Phase 1 skeleton',
        version: config.VERSION,
      },
      servers: [{ url: '/' }],
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/api/docs' });

  // Routes — /api/health is the real implementation; all other API-* + webhook
  // endpoints are 501 stubs (Plan 01-08, RESEARCH.md Pattern 7).
  // Schemas come from packages/shared-types (D-27); Phase 2/3/4/5 swap handler bodies.
  await app.register(healthRoutes, { prefix: '/api' });
  await app.register(leadsRoutes, { prefix: '/api' });
  await app.register(ordersRoutes, { prefix: '/api' });
  await app.register(trucksRoutes, { prefix: '/api' });
  await app.register(clientsRoutes, { prefix: '/api' });
  await app.register(analyticsRoutes, { prefix: '/api' });
  // Phase 4 Plan 04-03 — NEW endpoint family /api/calls (ADMIN-NEW-08).
  await app.register(callsRoutes, { prefix: '/api' });
  // Phase 5 Plan 05-04 POLISH-02 — POST /api/admin/simulate-call replays
  // voice-scenarios.json fixtures through Phase 3.1 tool handlers in-process.
  await app.register(adminRoutes);
  // Phase 3 Plan 03-02 — webhooks-telegram MUST register BEFORE webhooksRoutes
  // under /webhook prefix to claim the /telegram path before the generic stub plugin.
  await app.register(webhooksTelegramRoutes, { prefix: '/webhook' });
  // Phase 3.1 Plan 03.1-02 — webhooks-voice claims /webhook/voice/* (5 tool
  // routes + 3 lifecycle routes) BEFORE the generic webhooks plugin sees them.
  await app.register(webhooksVoiceRoutes, { prefix: '/webhook' });
  // Phase 6 D-18 — Stripe webhook. Encapsulated raw-body parser; must
  // register BEFORE the generic webhooksRoutes stub plugin so /stripe
  // claims the path.
  await app.register(webhooksStripeRoutes, { prefix: '/webhook' });
  await app.register(webhooksRoutes, { prefix: '/webhook' });

  // Phase 2 Plan 02-04b — auto-follow-up scheduler (FSM-06). Skips in test env;
  // production wires setInterval + onClose-driven clearInterval lifecycle.
  registerFollowUpScheduler(app);

  // Phase 6 D-01 — background ticker. Skips in NODE_ENV=test; gated by
  // DEMO_TICKER_ENABLED. Inside the setInterval callback runs both the
  // progress ticker AND the timeout-escalation evaluator.
  registerOrderTicker(app as Parameters<typeof registerOrderTicker>[0]);

  // Phase 3 Plan 03-05 D-08 — optional auto-register webhook at boot.
  // Skipped in test env (no bot decorator) and when the flag is off. The
  // standalone `pnpm telegram:setup` script remains the canonical entry; this
  // is a convenience for production VPS boots where the public URL is stable.
  if (
    config.TELEGRAM_SET_WEBHOOK_ON_BOOT &&
    config.TELEGRAM_PUBLIC_URL &&
    config.TELEGRAM_WEBHOOK_SECRET
  ) {
    const bot = (app as typeof app & { bot?: import('grammy').Bot }).bot;
    if (bot) {
      const { setupWebhook } = await import('./channels/telegram/setup.js');
      await setupWebhook({
        bot,
        publicUrl: config.TELEGRAM_PUBLIC_URL,
        secretToken: config.TELEGRAM_WEBHOOK_SECRET,
      });
      app.log.info(
        { publicUrl: config.TELEGRAM_PUBLIC_URL },
        'telegram: webhook registered at boot'
      );
    }
  }

  return app;
}
