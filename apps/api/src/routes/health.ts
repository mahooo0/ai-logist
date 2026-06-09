import { HealthResponseSchema } from '@ai-logist/shared-types/api/health';
import { sql } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { config } from '../config.js';

const startedAt = Date.now();

/**
 * GET /api/health — D-16 health JSON shape.
 * Returns 200 + status='ok' when db + postgis + redis are all up.
 * Returns 503 + status='degraded' if any subsystem fails.
 *
 * PostGIS version comes from PostGIS_Version() — closes API-01.
 * HealthResponseSchema is imported from @ai-logist/shared-types per D-27.
 */
const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/health',
    {
      schema: {
        tags: ['system'],
        summary: 'Health check',
        response: { 200: HealthResponseSchema, 503: HealthResponseSchema },
      },
    },
    async (_req, reply) => {
      const checks = {
        db: 'fail' as 'ok' | 'fail',
        postgis: 'fail',
        redis: 'fail' as 'ok' | 'fail',
        // Phase 2 Plan 02-05 — LLM subcheck. 'ok' when ANTHROPIC_API_KEY is
        // configured, 'not_configured' otherwise. No HTTP ping to Anthropic
        // here — rate-limit-safe for /health probes. POLISH-06 (Phase 6) will
        // extend this to a real ping behind a circuit breaker.
        llm: (config.ANTHROPIC_API_KEY ? 'ok' : 'not_configured') as 'ok' | 'not_configured',
      };

      try {
        await app.db.execute(sql`SELECT 1`);
        checks.db = 'ok';
      } catch (err) {
        app.log.error(err, 'db health check failed');
      }

      try {
        const r = await app.db.execute<{ postgis_version: string }>(
          sql`SELECT PostGIS_Version() AS postgis_version`
        );
        checks.postgis = r.rows[0]?.postgis_version ?? 'fail';
      } catch (err) {
        app.log.error(err, 'postgis health check failed');
      }

      try {
        const pong = await app.redis.ping();
        if (pong === 'PONG') checks.redis = 'ok';
      } catch (err) {
        app.log.error(err, 'redis health check failed');
      }

      const allOk = checks.db === 'ok' && checks.postgis !== 'fail' && checks.redis === 'ok';
      const body = {
        status: allOk ? ('ok' as const) : ('degraded' as const),
        version: config.VERSION,
        uptime_s: Math.floor((Date.now() - startedAt) / 1000),
        checks,
      };

      return reply.status(allOk ? 200 : 503).send(body);
    }
  );
};

export default healthRoutes;
