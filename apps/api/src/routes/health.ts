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

  // Debug endpoint — surfaces a few config flags that gate runtime behavior
  // (ticker, voice outbound, demo phone redirect) so we can verify env
  // propagation from Dokploy compose without container shell access. Boolean
  // ONLY — no secrets, no values.
  app.get('/debug/config', async () => ({
    nodeEnv: config.NODE_ENV,
    tickerEnabled: config.DEMO_TICKER_ENABLED,
    tickerIntervalSec: config.DEMO_TICKER_INTERVAL_SEC,
    tickerDeltaPct: config.DEMO_TICKER_DELTA_PCT,
    demoClientPhoneSet: !!config.DEMO_CLIENT_PHONE,
    confirmAgentSet: !!config.ELEVENLABS_AGENT_ID_CONFIRM,
    phoneNumberIdSet: !!config.ELEVENLABS_PHONE_NUMBER_ID,
    stripeSet: !!config.STRIPE_SECRET_KEY,
  }));

  // Diagnostic — force one tickerLoop synchronously and report success/error.
  // Lets us prove whether the loop body crashes vs. just isn't being invoked
  // by setInterval. SELECT echoes the candidate rows (id + status + pct) so
  // we can verify the row our test order is in actually matches the WHERE.
  app.post('/debug/ticker/force', async () => {
    const out: Record<string, unknown> = {};
    try {
      const sel = await app.db.execute(sql`
        SELECT id::text AS id, status, progress_percent, auto_progress_paused
        FROM orders
        WHERE status IN ('DRIVER_ASSIGNED', 'IN_TRANSIT')
          AND auto_progress_paused = false
      `);
      out.candidates = sel.rows;
    } catch (e) {
      out.selectError = String(e);
    }
    try {
      const { tickerLoop } = await import('../pipeline/lifecycle/order-ticker.js');
      const appWithBot = app as FastifyInstance & { bot?: unknown };
      // biome-ignore lint/suspicious/noExplicitAny: ad-hoc debug, types not load-bearing
      await tickerLoop({ db: app.db, log: app.log, bot: appWithBot.bot as any });
      out.tickResult = 'ok';
    } catch (e) {
      out.tickError = String(e);
    }
    return out;
  });

  // Demo-data wipe — clears all conversation/order state so we can start the
  // demo from a blank slate. Keeps the fleet/cities/pricing config intact so
  // the AI can still match trucks and quote prices.
  //
  // Also resets:
  //   - trucks.status back to 'available' (busy trucks would refuse new leads)
  //   - trucks.geom to the seeded depot positions (preserves the map look)
  //   - order_number_seq back to 1000 so the next order is #1000 again
  //
  // Returns row counts deleted per table. Guarded by ?confirm=yes — call with
  // ?confirm=yes to actually run.
  app.post('/debug/reset-demo', async (req) => {
    const q = req.query as Record<string, string | undefined>;
    if (q.confirm !== 'yes') {
      return { ok: false, message: 'append ?confirm=yes to confirm — this will wipe orders/leads/calls/clients' };
    }
    const counts: Record<string, number> = {};
    await app.db.transaction(async (tx) => {
      // Order matters: child rows first to satisfy FK constraints.
      for (const t of [
        'order_events',
        'pod_artifacts',
        'orders',
        'messages',
        'calls',
        'webhook_updates',
        'leads',
        'clients',
        'truck_positions',
        'bourse_cache',
      ]) {
        const r = await tx.execute(sql.raw(`DELETE FROM ${t} RETURNING id`));
        counts[t] = r.rows.length;
      }
      // Reset all trucks to available; clear driver-tg-id is NOT cleared (seed).
      await tx.execute(sql`UPDATE trucks SET status = 'available', updated_at = NOW()`);
      // Restart the sequence so the next order is #1000 again. Idempotent.
      await tx.execute(sql`ALTER SEQUENCE order_number_seq RESTART WITH 1000`);
    });
    // Wipe Redis (FSM state, voice state, dialog locks) — best-effort.
    try {
      const redis = (app as FastifyInstance & { redis?: { flushdb: () => Promise<unknown> } })
        .redis;
      if (redis) await redis.flushdb();
      counts.redis = 1;
    } catch (e) {
      counts.redisError = -1;
      app.log.warn({ err: String(e) }, 'reset-demo: redis flushdb failed');
    }
    return { ok: true, counts };
  });
};

export default healthRoutes;
