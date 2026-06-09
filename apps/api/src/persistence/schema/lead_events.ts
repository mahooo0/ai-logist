// Phase 2 Plan 02-01 Task 1 — lead_events audit table.
// FSM-05 — every lead stage transition writes a row here with actor + payload.
//
// Sources:
//   - 02-RESEARCH.md §7 (verbatim Drizzle schema block)
//   - CONTEXT D-29 (transitionLead writes audit row inside the SELECT-FOR-UPDATE txn)
//   - CONTEXT D-37 (mini-migration 0002 creates the table)
//
// FK to leads with ON DELETE CASCADE — when a lead is removed (demo seed reset), its
// history rows are removed too. Index on lead_id supports listByLead chronological reads.

import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { leadEventActorEnum, leadStageEnum } from './_enums.js';
import { leads } from './leads.js';

export const leadEvents = pgTable(
  'lead_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    fromStage: leadStageEnum('from_stage').notNull(),
    toStage: leadStageEnum('to_stage').notNull(),
    actor: leadEventActorEnum('actor').notNull(),
    payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('lead_events_lead_id_idx').on(t.leadId)]
);

export type LeadEvent = typeof leadEvents.$inferSelect;
export type NewLeadEvent = typeof leadEvents.$inferInsert;
