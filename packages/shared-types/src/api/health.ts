// @ai-logist/shared-types — Phase 1, Plan 01-07
// HealthResponseSchema per CONTEXT D-16 + D-27.
// Shared between apps/api (route serializer + validator) and apps/web (typed fetch in
// future phases). Lives in shared-types so the contract is one source of truth.

import { z } from 'zod/v4';

// Phase 3.1 Plan 03.1-03 — voice channel health subcheck per CONTEXT D-28.
// 'not_configured' = required env vars missing; 'ok' = ElevenLabs + Twilio
// API pings succeed; 'error' = at least one ping failed (`detail` carries
// the error message). Cached 60s in /api/health handler.
export const VoiceHealthSchema = z.object({
  status: z.enum(['ok', 'error', 'not_configured']),
  detail: z.string().optional(),
});

export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  version: z.string(),
  uptime_s: z.number(),
  checks: z.object({
    db: z.enum(['ok', 'fail']),
    postgis: z.string(), // version string (e.g. '3.5.0 ...'), or 'fail'
    redis: z.enum(['ok', 'fail']),
    // Phase 2 Plan 02-05 — LLM subcheck. 'ok' when ANTHROPIC_API_KEY is set;
    // 'not_configured' otherwise. Phase 6 POLISH-06 will extend this to a real
    // Anthropic ping; for Phase 2 we keep it cheap to avoid rate-limit risk on
    // /health probes.
    llm: z.enum(['ok', 'not_configured']),
    // Phase 3 Plan 03-05 — Telegram subcheck. 'not_configured' when token
    // missing; 'ok' after bot.api.getMe() succeeds; 'error' on failure. Cached
    // 60s in-process to avoid Telegram rate-limit risk on /health probes.
    // Optional so existing clients (Phase 2 fixtures, admin web stub) don't
    // break when the field is absent.
    telegram: z.enum(['ok', 'not_configured', 'error']).optional(),
    // Phase 3.1 Plan 03.1-03 — Voice subcheck (ElevenLabs Agent + Twilio
    // number reachability). 'not_configured' when any voice env var is unset;
    // 'ok' after ElevenLabsClient.conversationalAi.agents.get() AND
    // twilio.api.accounts(sid).fetch() both succeed; 'error' on failure.
    // Cached 60s in-process to avoid ElevenLabs/Twilio rate-limit risk on
    // /health probes (mirrors telegram subcheck semantics). Optional for
    // Phase 2/3 fixture compatibility.
    voice: VoiceHealthSchema.optional(),
  }),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
