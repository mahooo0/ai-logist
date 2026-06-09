// DB-06 — order_events table (FSM timeline).
//
// UNIQUE (order_id, type) per DB-06 + TRACK-04 enforces FSM auto-transition
// idempotency: a re-fired geofence event (Phase 5) becomes a no-op via ON CONFLICT
// DO NOTHING, no double events.
//
// geom is nullable: geofence/GPS-triggered events carry a point; manual transitions
// from the admin UI (manager force-status-change) do not. The SRID CHECK is
// nullable-safe — `NULL OR ST_SRID = 4326`.

import { sql } from 'drizzle-orm';
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { geographyPoint } from './_columns.js';
import { orderEventTypeEnum } from './_enums.js';
import { orders } from './orders.js';

export const orderEvents = pgTable(
  'order_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    type: orderEventTypeEnum('type').notNull(),
    actor: text('actor').notNull().default('system'), // 'ai' | 'manager' | 'system' per FSM-05
    payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
    geom: geographyPoint('geom'), // nullable — only geofence events have GPS
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // DB-06 + TRACK-04: UNIQUE prevents double-fire on geofence re-entry (Phase 5)
    uniqueIndex('order_events_order_type_unq').on(t.orderId, t.type),
    index('order_events_order_id_idx').on(t.orderId),
    check('order_events_geom_srid_chk', sql`${t.geom} IS NULL OR ST_SRID(${t.geom}) = 4326`),
  ]
);

export type OrderEvent = typeof orderEvents.$inferSelect;
export type NewOrderEvent = typeof orderEvents.$inferInsert;
