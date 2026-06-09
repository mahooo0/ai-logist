// DB-04 — trucks table.
// Sources:
//   - spec §2 (name, plate, driver, capacity, body_type, status, geom)
//   - CONTEXT D-04 (driver_telegram_id added for Phase 3 onboarding)
//   - CONTEXT D-05 (financial-style bigint; tons modelled as bigint mode:number)
//   - RESEARCH.md §Drizzle schema for trucks with GiST + CHECK
//
// Every geography column gets BOTH a GiST index (needed for `<->` KNN per D-03)
// AND a `CHECK ST_SRID(geom) = 4326` constraint (Pitfall #3).

import { sql } from 'drizzle-orm';
import { bigint, check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { geographyPoint } from './_columns.js';
import { bodyTypeEnum, truckStatusEnum } from './_enums.js';

export const trucks = pgTable(
  'trucks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    plateNumber: text('plate_number').notNull().unique(), // ON CONFLICT in seed
    driverName: text('driver_name').notNull(),
    driverPhone: text('driver_phone').notNull(), // E.164
    driverTelegramId: text('driver_telegram_id'), // nullable; set when driver onboarded in Phase 3
    capacityT: bigint('capacity_t', { mode: 'number' }).notNull(), // tonnes (whole numbers OK)
    bodyType: bodyTypeEnum('body_type').notNull(),
    geom: geographyPoint('geom').notNull(),
    status: truckStatusEnum('status').notNull().default('available'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('trucks_geom_gist').using('gist', t.geom),
    index('trucks_status_idx').on(t.status),
    check('trucks_geom_srid_chk', sql`ST_SRID(${t.geom}) = 4326`),
  ]
);

export type Truck = typeof trucks.$inferSelect;
export type NewTruck = typeof trucks.$inferInsert;
