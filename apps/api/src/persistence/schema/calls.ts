// DB-07 — calls table (spec §2).
//
// Phase 1 ship: id, lead_id, direction, duration_s, transcript (jsonb array of
// {speaker, text, ts} segments per §5.2), recording_url, outcome (text).
//
// Phase 3.1 extension (migration 0004_phase31_voice_calls) — CONTEXT D-13:
//   - audio_url TEXT (Twilio recording URL, parallel to legacy recording_url)
//   - lang client_lang (RU/UA detected from voice; sticky via clients.lang)
//   - linked_lead_id uuid → leads(id) (lead the call created/updated)
//   - quoted_price_at_confirmation BIGINT (snapshot of price when caller confirmed)
//   - elevenlabs_conversation_id TEXT UNIQUE (external id from ElevenLabs)
//   - twilio_call_sid TEXT UNIQUE (external id from Twilio)
//   - outcome promoted from TEXT → call_outcome ENUM (completed/abandoned/escalated/error)
//
// recording_url retained (nullable, unused for v1 voice) for Phase 1 backward
// compat — voice writes audio_url instead.

import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { callOutcomeEnum, clientLangEnum } from './_enums.js';
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
    outcome: callOutcomeEnum('outcome'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

    // Phase 3.1 additions (D-13)
    audioUrl: text('audio_url'),
    lang: clientLangEnum('lang'),
    linkedLeadId: uuid('linked_lead_id').references(() => leads.id, { onDelete: 'set null' }),
    quotedPriceAtConfirmation: bigint('quoted_price_at_confirmation', { mode: 'bigint' }),
    elevenlabsConversationId: text('elevenlabs_conversation_id'),
    twilioCallSid: text('twilio_call_sid'),
  },
  (t) => [
    index('calls_lead_id_idx').on(t.leadId),
    index('calls_created_at_idx').on(t.createdAt),
    uniqueIndex('calls_elevenlabs_conversation_id_uq').on(t.elevenlabsConversationId),
    uniqueIndex('calls_twilio_call_sid_uq').on(t.twilioCallSid),
    index('calls_outcome_idx').on(t.outcome),
    index('calls_lang_idx').on(t.lang),
    index('calls_linked_lead_idx').on(t.linkedLeadId),
  ]
);

export type Call = typeof calls.$inferSelect;
export type NewCall = typeof calls.$inferInsert;
