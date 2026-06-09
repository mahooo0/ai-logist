import fp from 'fastify-plugin';
import { Redis } from 'ioredis';
import { config } from '../config.js';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

/**
 * Fastify plugin: registers an ioredis client on the app.
 * `maxRetriesPerRequest: null` is required for BullMQ workers in Phase 5.
 * Smoke-tests with PING on boot — fails fast if Redis is unreachable.
 */
export const redisPlugin = fp(
  async (app) => {
    const redis = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: null, // required for BullMQ in Phase 5
      enableReadyCheck: true,
      lazyConnect: false,
    });

    await redis.ping();

    app.decorate('redis', redis);

    app.addHook('onClose', async () => {
      redis.disconnect();
    });
  },
  { name: 'redis' }
);
