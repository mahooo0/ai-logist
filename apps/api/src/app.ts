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
import { dbPlugin } from './plugins/db.js';
import { redisPlugin } from './plugins/redis.js';
import healthRoutes from './routes/health.js';

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

  // Routes — only /api/health implemented in Wave 7; 501 stubs land in Plan 01-08
  await app.register(healthRoutes, { prefix: '/api' });

  return app;
}
