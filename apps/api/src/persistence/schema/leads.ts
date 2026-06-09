// DB-05 + CONTEXT D-04 + D-05 — leads table.
//
// Sources:
//   - spec §2 (client_id, channel, stage, from/to cities, tons, body_type, budget,
//     matched_truck_id, quoted_price, order_id)
//   - CONTEXT D-04 (extended cargo: volume_m3, dimensions_lxwxh, packaging, adr_class,
//     declared_value; price_overrides jsonb[] audit log)
//   - CONTEXT D-05 (budget, declared_value, quoted_price as bigint kopecks)
//   - FSM-03 (version column for optimistic concurrency; Phase 2 SELECT FOR UPDATE)
//
// order_id is a forward reference to orders.id — both tables declare FK lazily so
// Drizzle resolves at runtime. The init migration emits ALTER TABLE … ADD CONSTRAINT
// in the correct order automatically.

import { sql } from 'drizzle-orm';
import { bigint, index, jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { bodyTypeEnum, leadStageEnum } from './_enums.js';
import { cities } from './cities.js';
import { clients } from './clients.js';
import { orders } from './orders.js';
import { trucks } from './trucks.js';

export const leads = pgTable(
  'leads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),
    channel: text('channel').notNull(), // 'telegram' | 'call'
    stage: leadStageEnum('stage').notNull().default('NEW'),
    fromCityId: uuid('from_city_id').references(() => cities.id),
    toCityId: uuid('to_city_id').references(() => cities.id),
    tons: numeric('tons', { precision: 10, scale: 2 }),
    bodyType: bodyTypeEnum('body_type'),
    budget: bigint('budget', { mode: 'bigint' }), // kopecks per D-05

    // CONTEXT D-04 — extended cargo fields (demo-credibility)
    volumeM3: numeric('volume_m3', { precision: 10, scale: 2 }),
    dimensionsLxwxh: text('dimensions_lxwxh'), // 'LxWxH' string per CONTEXT D-04
    packaging: text('packaging'),
    adrClass: text('adr_class'),
    declaredValue: bigint('declared_value', { mode: 'bigint' }), // kopecks

    matchedTruckId: uuid('matched_truck_id').references(() => trucks.id),
    quotedPrice: bigint('quoted_price', { mode: 'bigint' }), // kopecks
    orderId: uuid('order_id').references(() => orders.id),

    // CONTEXT D-04 — price override audit log
    priceOverrides: jsonb('price_overrides').array().notNull().default(sql`'{}'::jsonb[]`),

    // CONTEXT FSM-03 — optimistic concurrency (Phase 2)
    version: bigint('version', { mode: 'number' }).notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('leads_stage_idx').on(t.stage), index('leads_client_id_idx').on(t.clientId)]
);

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
