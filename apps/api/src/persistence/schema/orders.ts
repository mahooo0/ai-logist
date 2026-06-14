// DB-06 + CONTEXT D-04 + D-05 — orders table.
//
// Sources:
//   - spec §2 (lead_id, client_id, truck_id, from/to cities, distance_km, price, status)
//   - CONTEXT D-04 (public_token TEXT UNIQUE for Phase 5 /track/[token] page)
//   - CONTEXT D-05 (price stored as bigint kopecks; rounding lives in calcPrice, Phase 2)
//   - FSM-03 (version column for optimistic concurrency; Phase 2 SELECT FOR UPDATE)
//
// Note: leads.order_id forward-references this table. Drizzle resolves circular
// FKs at runtime via the references(() => orders.id) lazy callback.

import {
  bigint,
  boolean,
  index,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { geographyPoint } from './_columns.js';
import { orderStatusEnum } from './_enums.js';
import { cities } from './cities.js';
import { clients } from './clients.js';
import { trucks } from './trucks.js';

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    number: text('number').notNull().unique(), // human-readable '#KU-4471'
    leadId: uuid('lead_id'), // FK to leads (set later — circular ref, no .references() here)
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),
    truckId: uuid('truck_id').references(() => trucks.id, { onDelete: 'set null' }),
    fromCityId: uuid('from_city_id').references(() => cities.id),
    toCityId: uuid('to_city_id').references(() => cities.id),

    distanceKm: numeric('distance_km', { precision: 10, scale: 2 }), // road km
    price: bigint('price', { mode: 'bigint' }).notNull(), // kopecks per D-05
    currency: text('currency').notNull().default('UAH'), // 'UAH' | 'RUB'

    status: orderStatusEnum('status').notNull().default('CREATED'),

    // CONTEXT D-04 — public_token for /track/[token] (Phase 5 PUBLIC-01/02)
    publicToken: text('public_token').notNull().unique(),

    // CONTEXT FSM-03 — optimistic concurrency (Phase 2)
    version: bigint('version', { mode: 'number' }).notNull().default(0),

    // Free-form 0..100 progress driven by /dashboard/tracking (slider + draggable
    // marker). Independent of `status` — status moves through the FSM at its own
    // cadence (DRIVER_ASSIGNED → AT_LOADING → ...), while progress_percent is
    // visual state the dispatcher edits manually.
    progressPercent: smallint('progress_percent').notNull().default(0),

    // Phase 6 D-21 — pause/resume auto-progress ticker per order.
    // Added via migration 0006_order_lifecycle.sql (manual apply required).
    autoProgressPaused: boolean('auto_progress_paused').notNull().default(false),

    // Leg-0 snapshot (migration 0007). The truck's GPS position at the moment
    // of DRIVER_ASSIGNED — fixed source point for the truck→pickup animation.
    // Nullable because existing rows pre-0007 won't have it; the frontend
    // simply hides the leg-0 polyline when null.
    pickupOriginGeom: geographyPoint('pickup_origin_geom'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('orders_status_idx').on(t.status),
    index('orders_client_id_idx').on(t.clientId),
    index('orders_lead_id_idx').on(t.leadId),
  ]
);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
