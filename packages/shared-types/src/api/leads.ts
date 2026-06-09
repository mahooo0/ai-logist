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
  channel: z.enum(['telegram', 'call']),
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

export const LeadMatchResponseSchema = z.object({
  lead: LeadSchema,
  matches: z.array(
    z.object({
      truckId: z.string().uuid(),
      name: z.string(),
      plateNumber: z.string(),
      capacityT: z.number(),
      distanceMeters: z.number(),
    })
  ),
});
export type LeadMatchResponse = z.infer<typeof LeadMatchResponseSchema>;

export const LeadQuoteResponseSchema = z.object({
  lead: LeadSchema,
  quote: z.object({
    min: z.string(), // kopecks as string
    default: z.string(),
    max: z.string(),
    routeKm: z.string(),
  }),
});
export type LeadQuoteResponse = z.infer<typeof LeadQuoteResponseSchema>;
