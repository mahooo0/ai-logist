// @ai-logist/shared-types — Phase 1, Plan 01-08
// DTO schemas for /api/leads — covers GET list, PATCH update,
// POST /:id/match, POST /:id/quote. All routes ship as 501 stubs in Phase 1
// but the schemas are the contract Phase 2 (matching/quoting) and Phase 4
// (admin Kanban) will consume.

import { z } from 'zod/v4';
import { BodyType, LeadStage } from '../domain/enums.js';

export const LeadSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  // Phase 4 D-60 / Open Question #4: accept all 3 historic channel values for
  // graceful handling. Phase 1 ships 'telegram' | 'call'; Phase 3.1 may have
  // introduced 'voice'. The list handler coerces 'call' → 'voice' on the way
  // out so the admin surface sees a stable 2-value channel.
  channel: z.enum(['telegram', 'voice', 'call']),
  stage: LeadStage,
  fromCityId: z.string().uuid().nullable(),
  toCityId: z.string().uuid().nullable(),
  // numeric / bigint columns come back as strings from node-postgres
  tons: z.string().nullable(),
  bodyType: BodyType.nullable(),
  budget: z.string().nullable(),
  volumeM3: z.string().nullable(),
  dimensionsLxwxh: z.string().nullable(),
  packaging: z.string().nullable(),
  adrClass: z.string().nullable(),
  declaredValue: z.string().nullable(),
  matchedTruckId: z.string().uuid().nullable(),
  quotedPrice: z.string().nullable(),
  orderId: z.string().uuid().nullable(),
  priceOverrides: z.array(z.unknown()).default([]),
  version: z.number().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Lead = z.infer<typeof LeadSchema>;

export const LeadListQuerySchema = z.object({
  stage: LeadStage.optional(),
  clientId: z.string().uuid().optional(),
  // Phase 4 API-03 — D-60 channel filter. Accepts all 3 historic values;
  // handler maps 'voice' to `channel IN ('voice','call')` SQL so legacy rows
  // are included.
  channel: z.enum(['telegram', 'voice', 'call']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type LeadListQuery = z.infer<typeof LeadListQuerySchema>;

export const LeadPatchBodySchema = z.object({
  stage: LeadStage.optional(),
  matchedTruckId: z.string().uuid().nullable().optional(),
  quotedPrice: z.string().nullable().optional(),
  // optimistic concurrency check — Phase 2 FSM compares against current row
  version: z.number().int(),
});
export type LeadPatchBody = z.infer<typeof LeadPatchBodySchema>;

// Phase 2 Plan 02-05 — flattened schema matches nearestTruck row + REST handler.
// Each row carries `meters` (spheroid distance from pickup) and a `source` tag so
// the admin Kanban "re-match" button can show own-fleet vs bourse-stub provenance.
// `id` is a plain string (not uuid) because bourse-stub external_ids are synthetic.
export const LeadMatchResponseSchema = z.object({
  lead_id: z.string().uuid(),
  trucks: z.array(
    z.object({
      id: z.string(),
      driver_phone: z.string(),
      plate_number: z.string(),
      capacity_t: z.string(), // numeric → string via pg
      body_type: z.enum(['tent', 'ref', 'iso', 'container']),
      meters: z.string(), // double precision → string via pg
      source: z.enum(['own-fleet', 'bourse-stub']),
    })
  ),
});
export type LeadMatchResponse = z.infer<typeof LeadMatchResponseSchema>;

// Phase 2 Plan 02-05 — flattened price corridor matches calcPrice output.
// kopecks values are serialized as digit-only strings (bigint → JSON-safe).
export const LeadQuoteResponseSchema = z.object({
  lead_id: z.string().uuid(),
  quoted_price_kopecks: z.string(),
  min_kopecks: z.string(),
  max_kopecks: z.string(),
  route_km: z.number(),
  stage: z.string(),
});
export type LeadQuoteResponse = z.infer<typeof LeadQuoteResponseSchema>;

// Phase 3 Plan 03-05 — TG-06 manager intercept endpoints DTOs.
// POST /api/leads/:id/intercept response — flag flipped to true.
export const LeadInterceptResponseSchema = z.object({
  lead_id: z.string().uuid(),
  manager_active: z.literal(true),
});
export type LeadInterceptResponse = z.infer<typeof LeadInterceptResponseSchema>;

// POST /api/leads/:id/release response — flag flipped back to false.
export const LeadReleaseResponseSchema = z.object({
  lead_id: z.string().uuid(),
  manager_active: z.literal(false),
});
export type LeadReleaseResponse = z.infer<typeof LeadReleaseResponseSchema>;

// POST /api/leads/:id/manager-message body — manager-side outbound text.
// Limit 4000 chars to leave headroom under Telegram's 4096-char hard limit.
export const ManagerMessageBodySchema = z.object({
  text: z.string().min(1).max(4000),
});
export type ManagerMessageBody = z.infer<typeof ManagerMessageBodySchema>;

// POST /api/leads/:id/manager-message response — just the lead id echo.
export const ManagerMessageResponseSchema = z.object({
  lead_id: z.string().uuid(),
});
export type ManagerMessageResponse = z.infer<typeof ManagerMessageResponseSchema>;
