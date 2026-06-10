import { pgEnum } from 'drizzle-orm/pg-core';

export const leadStageEnum = pgEnum('lead_stage', [
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

export const orderStatusEnum = pgEnum('order_status', [
  'CREATED',
  'DRIVER_ASSIGNED',
  'AT_LOADING',
  'IN_TRANSIT',
  'AT_BORDER',
  'DELIVERED',
  'CLOSED',
]);

export const orderEventTypeEnum = pgEnum('order_event_type', [
  'created',
  'driver_assigned',
  'at_loading',
  'in_transit',
  'at_border',
  'delivered',
]);

export const bodyTypeEnum = pgEnum('body_type_t', ['tent', 'ref', 'iso', 'container']);

export const truckStatusEnum = pgEnum('truck_status', ['available', 'busy', 'maintenance']);

export const clientLangEnum = pgEnum('client_lang', ['ru', 'ua']);

export const webhookSourceEnum = pgEnum('webhook_source', ['telegram', 'voice', 'gps']);

// Phase 2 Plan 02-01 — FSM-05 audit-log actor enum. D-29.
export const leadEventActorEnum = pgEnum('lead_event_actor', ['ai', 'manager', 'system']);

// Phase 3.1 Plan 03.1-01 — voice channel call outcome enum (D-13).
export const callOutcomeEnum = pgEnum('call_outcome', [
  'completed',
  'abandoned',
  'escalated',
  'error',
]);
