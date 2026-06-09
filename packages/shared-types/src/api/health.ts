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
  }),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
