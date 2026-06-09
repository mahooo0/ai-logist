// @ai-logist/shared-types — Phase 1, Plan 01-07
// HealthResponseSchema per CONTEXT D-16 + D-27.
// Shared between apps/api (route serializer + validator) and apps/web (typed fetch in
// future phases). Lives in shared-types so the contract is one source of truth.

import { z } from 'zod/v4';

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
  }),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
