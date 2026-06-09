// CONTEXT D-04 — truck_positions: history table feeding Phase 5 live tracking.
//
// UNIQUE (truck_id, recorded_at) makes the inbound GPS pipeline idempotent:
// resending the same point is a no-op via ON CONFLICT DO NOTHING.
// GiST on geom + CHECK SRID=4326 mirror the trucks/cities geo invariants
// (D-03 / Pitfall #3).

import { sql } from 'drizzle-orm';
import { check, index, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { geographyPoint } from './_columns.js';
import { trucks } from './trucks.js';

export const truckPositions = pgTable(
  'truck_positions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    truckId: uuid('truck_id')
      .notNull()
      .references(() => trucks.id, { onDelete: 'cascade' }),
    geom: geographyPoint('geom').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('truck_positions_truck_recorded_unq').on(t.truckId, t.recordedAt),
    index('truck_positions_geom_gist').using('gist', t.geom),
    index('truck_positions_truck_id_idx').on(t.truckId),
    check('truck_positions_geom_srid_chk', sql`ST_SRID(${t.geom}) = 4326`),
  ]
);

export type TruckPosition = typeof truckPositions.$inferSelect;
export type NewTruckPosition = typeof truckPositions.$inferInsert;
