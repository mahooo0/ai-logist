import { HealthResponseSchema } from '@ai-logist/shared-types/api/health';
import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { config } from '../config.js';

const startedAt = Date.now();

// Phase 3 Plan 03-05 — Telegram health subcheck per RESEARCH Code Block 12.
// 60s TTL cache prevents Telegram rate-limit hits on /health probes. Module-
// level state survives across requests because Fastify reuses the route
// handler closure.
type TelegramHealth = 'ok' | 'not_configured' | 'error';
const telegramCache: { result: TelegramHealth; expiresAt: number } = {
  result: 'not_configured',
  expiresAt: 0,
};

async function checkTelegram(app: FastifyInstance): Promise<TelegramHealth> {
  const now = Date.now();
  if (telegramCache.expiresAt > now) return telegramCache.result;
  const bot = (app as FastifyInstance & { bot?: { api: { getMe: () => Promise<unknown> } } }).bot;
  if (!config.TELEGRAM_BOT_TOKEN || !bot) {
    telegramCache.result = 'not_configured';
    telegramCache.expiresAt = now + 60_000;
    return 'not_configured';
  }
  try {
    await bot.api.getMe();
    telegramCache.result = 'ok';
  } catch (err) {
    app.log.warn({ err }, 'telegram health check failed');
    telegramCache.result = 'error';
  }
  telegramCache.expiresAt = now + 60_000;
  return telegramCache.result;
}

// Phase 3.1 Plan 03.1-03 — Voice channel health subcheck per CONTEXT D-28.
// Mirrors Telegram pattern: 60s TTL cache prevents ElevenLabs/Twilio rate-
// limit hits on /health scrape loops. 'not_configured' fast-path when any
// of the 4 required voice env vars are missing (no SDK boot, no network).
// Dynamic SDK imports keep apps/api boot light when voice env is absent so
// Phase 2/3 unit-test fixtures don't pull ElevenLabs/Twilio into memory.
type VoiceHealthStatus = 'ok' | 'error' | 'not_configured';
interface VoiceCacheEntry {
  at: number;
  status: VoiceHealthStatus;
  detail?: string;
}
let voiceCache: VoiceCacheEntry | null = null;
const VOICE_TTL_MS = 60_000;

async function checkVoice(
  app: FastifyInstance
): Promise<{ status: VoiceHealthStatus; detail?: string }> {
  const now = Date.now();
  if (voiceCache && now - voiceCache.at < VOICE_TTL_MS) {
    return voiceCache.detail !== undefined
      ? { status: voiceCache.status, detail: voiceCache.detail }
      : { status: voiceCache.status };
  }

  const apiKey = config.ELEVENLABS_API_KEY;
  const agentId = config.ELEVENLABS_AGENT_ID;
  const twSid = config.TWILIO_ACCOUNT_SID;
  const twToken = config.TWILIO_AUTH_TOKEN;
  if (!apiKey || !agentId || !twSid || !twToken) {
    voiceCache = { at: now, status: 'not_configured' };
    return { status: 'not_configured' };
  }

  try {
    const { ElevenLabsClient } = await import('@elevenlabs/elevenlabs-js');
    const twilioMod = await import('twilio');
    const el = new ElevenLabsClient({ apiKey });
    // biome-ignore lint/suspicious/noExplicitAny: SDK 2.30.0 types lag the REST API surface
    await (el.conversationalAi.agents as any).get(agentId);
    const tw = twilioMod.default(twSid, twToken);
    await tw.api.accounts(twSid).fetch();
    voiceCache = { at: now, status: 'ok' };
    return { status: 'ok' };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    app.log.warn({ err }, 'voice health check failed');
    voiceCache = { at: now, status: 'error', detail };
    return { status: 'error', detail };
  }
}

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
      // Phase 3.1 Plan 03.1-03 — voice subcheck runs in parallel with telegram
      // (both are network-dependent + cached for 60s).
      const [telegramStatus, voiceStatus] = await Promise.all([
        checkTelegram(app),
        checkVoice(app),
      ]);
      const checks = {
        db: 'fail' as 'ok' | 'fail',
        postgis: 'fail',
        redis: 'fail' as 'ok' | 'fail',
        // Phase 2 Plan 02-05 — LLM subcheck. 'ok' when ANTHROPIC_API_KEY is
        // configured, 'not_configured' otherwise. No HTTP ping to Anthropic
        // here — rate-limit-safe for /health probes. POLISH-06 (Phase 6) will
        // extend this to a real ping behind a circuit breaker.
        llm: (config.ANTHROPIC_API_KEY ? 'ok' : 'not_configured') as 'ok' | 'not_configured',
        // Phase 3 Plan 03-05 — Telegram subcheck. See checkTelegram() above
        // for cache semantics.
        telegram: telegramStatus,
        // Phase 3.1 Plan 03.1-03 — Voice subcheck. See checkVoice() above for
        // cache semantics + dynamic SDK import rationale.
        voice: voiceStatus,
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
