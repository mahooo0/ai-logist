// DB-08 + CONTEXT D-04 — pod_artifacts (Proof of Delivery).
//
// Captures the closing artefacts of a delivered order: signature image URL,
// photo URL, and the GPS point where the driver tapped "delivered". All three
// are nullable for demo flexibility — a driver might capture only signature, or
// only photo, depending on the workflow.
//
// gps follows the geo-column invariant (CHECK SRID = 4326, nullable-safe).
// No GiST is needed here — POD points are written once per order and never queried
// by KNN/radius. If Phase 6 adds delivery-area analytics, add the index then.

import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { geographyPoint } from './_columns.js';
import { orders } from './orders.js';

export const podArtifacts = pgTable(
  'pod_artifacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    signatureUrl: text('signature_url'), // S3-style URL — nullable; demo stub
    photoUrl: text('photo_url'), // nullable
    gps: geographyPoint('gps'), // nullable — set when driver captures location
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('pod_artifacts_order_id_idx').on(t.orderId),
    check('pod_artifacts_gps_srid_chk', sql`${t.gps} IS NULL OR ST_SRID(${t.gps}) = 4326`),
  ]
);

export type PodArtifact = typeof podArtifacts.$inferSelect;
export type NewPodArtifact = typeof podArtifacts.$inferInsert;
