// DB-07 — calls table (spec §2).
//
// Holds the voice-call record per lead. transcript is jsonb (array of segments
// shaped as {speaker, text, ts}) per spec §5.2. duration_s is nullable while
// the call is in-progress; outcome is text (not ENUM) because the domain
// evolves through Phase 3 (no-answer / busy / completed / dropped / voicemail).

import { sql } from 'drizzle-orm';
import { bigint, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { leads } from './leads.js';

export const calls = pgTable(
  'calls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    direction: text('direction').notNull(), // 'inbound' | 'outbound'
    durationS: bigint('duration_s', { mode: 'number' }), // seconds, nullable while in-progress
    transcript: jsonb('transcript').notNull().default(sql`'[]'::jsonb`),
    recordingUrl: text('recording_url'),
    outcome: text('outcome'), // 'completed' | 'no-answer' | 'busy' | 'voicemail' | …
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('calls_lead_id_idx').on(t.leadId), index('calls_created_at_idx').on(t.createdAt)]
);

export type Call = typeof calls.$inferSelect;
export type NewCall = typeof calls.$inferInsert;
