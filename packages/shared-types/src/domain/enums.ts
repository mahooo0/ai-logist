// @ai-logist/shared-types — Phase 1, Plan 01-08
// Zod enums mirroring DB pgEnums (apps/api/src/persistence/schema/_enums.ts).
// KEEP IN SYNC with the schema enums whenever either side changes.
//
// Per CONTEXT D-27: these are published in shared-types so both apps/api (validation)
// and apps/web (Phase 4 typed UI) consume the same enum source of truth.

import { z } from 'zod/v4';

export const LeadStage = z.enum([
  'NEW',
  'QUALIFIED',
  'MATCHED',
  'QUOTED',
  'AGREED',
  'ORDER_CREATED',
  'IN_PROGRESS',
  'DONE',
  'LOST',
]);
export type LeadStage = z.infer<typeof LeadStage>;

export const OrderStatus = z.enum([
  'CREATED',
  'DRIVER_ASSIGNED',
  'AT_LOADING',
  'IN_TRANSIT',
  'AT_BORDER',
  'DELIVERED',
  'CLOSED',
]);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const OrderEventType = z.enum([
  'created',
  'driver_assigned',
  'at_loading',
  'in_transit',
  'at_border',
  'delivered',
]);
export type OrderEventType = z.infer<typeof OrderEventType>;

export const BodyType = z.enum(['tent', 'ref', 'iso', 'container']);
export type BodyType = z.infer<typeof BodyType>;

export const TruckStatus = z.enum(['available', 'busy', 'maintenance']);
export type TruckStatus = z.infer<typeof TruckStatus>;

export const ClientLang = z.enum(['ru', 'ua']);
export type ClientLang = z.infer<typeof ClientLang>;

export const WebhookSource = z.enum(['telegram', 'voice', 'gps']);
export type WebhookSource = z.infer<typeof WebhookSource>;
