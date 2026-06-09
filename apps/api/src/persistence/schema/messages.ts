// DB-07 — messages table (spec §2).
//
// Holds the chat-history record per client (Telegram + voice transcript turns).
// role indicates {client | ai | manager} per spec §2 — kept as text (not ENUM)
// because future channels (operator-on-mobile, system-broadcast) may extend the
// set; validation lives in the producing code paths (Phase 3 telegram pipeline,
// Phase 4 manager takeover).
//
// lead_id is nullable: a message can be a free-form client touchpoint before
// any lead exists. On lead deletion we 'set null' so chat history survives.

import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { clients } from './clients.js';
import { leads } from './leads.js';

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    role: text('role').notNull(), // 'client' | 'ai' | 'manager' per spec §2
    text: text('text').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('messages_client_id_idx').on(t.clientId),
    index('messages_lead_id_idx').on(t.leadId),
    index('messages_created_at_idx').on(t.createdAt),
  ]
);

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
