// @ai-logist/shared-types — Phase 1, Plan 01-08
// DTO schemas for /api/orders — covers list, detail (with event timeline),
// create, and price override (audit-driven per ADMIN-NEW-06).

import { z } from 'zod/v4';
import { OrderEventType, OrderStatus } from '../domain/enums.js';

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
