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
import { dbPlugin } from './plugins/db.js';
import { redisPlugin } from './plugins/redis.js';
import analyticsRoutes from './routes/analytics.js';
import clientsRoutes from './routes/clients.js';
import healthRoutes from './routes/health.js';
import leadsRoutes from './routes/leads.js';
import ordersRoutes from './routes/orders.js';
import trucksRoutes from './routes/trucks.js';
import webhooksRoutes from './routes/webhooks.js';

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
  await app.register(redisPlugin);

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
  await app.register(webhooksRoutes, { prefix: '/webhook' });

  // Phase 2 Plan 02-04b — auto-follow-up scheduler (FSM-06). Skips in test env;
  // production wires setInterval + onClose-driven clearInterval lifecycle.
  registerFollowUpScheduler(app);

  return app;
}
