// @ai-logist/shared-types — Phase 1, Plan 01-08
// DTO schemas for /api/orders — covers list, detail (with event timeline),
// create, and price override (audit-driven per ADMIN-NEW-06).
//
// Phase 4 (Plan 04-03) extends with OrderListItemSchema (joined denormalised
// fields for /dashboard/orders table, D-35) and OrderDetailExtendedSchema
// (single-shot detail response with all relations, D-39).

import { z } from 'zod/v4';
import { ClientLang, OrderEventType, OrderStatus } from '../domain/enums.js';
import { LeadSchema } from './leads.js';
import { TruckSchema } from './trucks.js';

export const OrderSchema = z.object({
  id: z.string().uuid(),
  number: z.string(),
  leadId: z.string().uuid().nullable(),
  clientId: z.string().uuid(),
  truckId: z.string().uuid().nullable(),
  fromCityId: z.string().uuid().nullable(),
  toCityId: z.string().uuid().nullable(),
  distanceKm: z.string().nullable(),
  price: z.string(), // bigint kopecks serialised as string
  currency: z.string(),
  status: OrderStatus,
  publicToken: z.string(),
  version: z.number().default(0),
  progressPercent: z.number().int().min(0).max(100).default(0),
  // Phase 6 D-21 / W8 — pause flag. Optional so existing API consumers and
  // tests that don't set this field remain valid; backend always populates it.
  autoProgressPaused: z.boolean().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Order = z.infer<typeof OrderSchema>;

export const OrderEventSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  type: OrderEventType,
  actor: z.string(),
  payload: z.record(z.string(), z.unknown()),
  geom: z.object({ lng: z.number(), lat: z.number() }).nullable(),
  createdAt: z.string().datetime(),
});
export type OrderEvent = z.infer<typeof OrderEventSchema>;

export const OrderListQuerySchema = z.object({
  status: OrderStatus.optional(),
  clientId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type OrderListQuery = z.infer<typeof OrderListQuerySchema>;

export const OrderDetailSchema = z.object({
  order: OrderSchema,
  events: z.array(OrderEventSchema),
});
export type OrderDetail = z.infer<typeof OrderDetailSchema>;

export const CreateOrderBodySchema = z.object({
  leadId: z.string().uuid().optional(),
  clientId: z.string().uuid(),
  truckId: z.string().uuid().nullable(),
  fromCityId: z.string().uuid(),
  toCityId: z.string().uuid(),
  price: z.string(), // kopecks
  currency: z.string().default('RUB'),
});
export type CreateOrderBody = z.infer<typeof CreateOrderBodySchema>;

export const PriceOverrideBodySchema = z.object({
  newPrice: z.string(), // kopecks
  reason: z.string().min(3), // mandatory per ADMIN-NEW-06 (audit trail)
  version: z.number().int(), // optimistic concurrency
});
export type PriceOverrideBody = z.infer<typeof PriceOverrideBodySchema>;

// Phase 4 D-35 — joined list response for /dashboard/orders.
// Extends OrderSchema with denormalised city/client/channel fields so the page
// renders without N+1 fetches. 'call' is coerced to 'voice' in the handler so
// the admin only sees a stable 2-value channel.
export const OrderListItemSchema = OrderSchema.extend({
  fromCityName: z.string().nullable(),
  toCityName: z.string().nullable(),
  clientName: z.string().nullable(),
  channel: z.enum(['telegram', 'voice']).nullable(),
});
export type OrderListItem = z.infer<typeof OrderListItemSchema>;

// Phase 4 D-39 — extended detail response (avoid 4 separate fetches in
// /dashboard/orders/[id]). Joined fields are nullable to handle missing
// relations gracefully (truck_id, lead_id can be null on the order).
const CityRefSchema = z.object({
  id: z.string().uuid(),
  nameRu: z.string(),
  nameUa: z.string().nullable(),
});

const ClientRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string().nullable(),
  phone: z.string().nullable(),
  lang: ClientLang.nullable(),
});

export const OrderDetailExtendedSchema = z.object({
  order: OrderSchema,
  events: z.array(OrderEventSchema),
  client: ClientRefSchema.nullable(),
  fromCity: CityRefSchema.nullable(),
  toCity: CityRefSchema.nullable(),
  truck: TruckSchema.nullable(),
  lead: LeadSchema.nullable(), // for channel breadcrumb (D-38)
});
export type OrderDetailExtended = z.infer<typeof OrderDetailExtendedSchema>;

// /api/orders/:id/route — polyline + progress for the tracking page.
export const OrderRouteResponseSchema = z.object({
  geometry: z.array(z.tuple([z.number(), z.number()])), // [[lng, lat], ...]
  distanceKm: z.number(),
  etaSec: z.number(),
  progressPercent: z.number().int().min(0).max(100),
  source: z.enum(['osrm', 'haversine_fallback']),
});
export type OrderRouteResponse = z.infer<typeof OrderRouteResponseSchema>;

// PATCH /api/orders/:id/progress
export const PatchOrderProgressBodySchema = z.object({
  progressPercent: z.number().int().min(0).max(100),
});
export type PatchOrderProgressBody = z.infer<typeof PatchOrderProgressBodySchema>;

export const PatchOrderProgressResponseSchema = z.object({
  progressPercent: z.number().int().min(0).max(100),
});
export type PatchOrderProgressResponse = z.infer<typeof PatchOrderProgressResponseSchema>;
