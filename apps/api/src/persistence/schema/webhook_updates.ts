// DB-09 — webhook_updates idempotency table.
//
// Sources:
//   - CONTEXT D-04 (schema extension over spec §2)
//   - RESEARCH.md §"webhook_updates table" (copied verbatim)
//   - PITFALLS.md #5 (Telegram update_id idempotency)
//
// Every webhook ingress (Telegram update, voice-call event, GPS push) is recorded
// with its source-specific external_id. The UNIQUE(source, external_id) constraint
// lets the handler INSERT … ON CONFLICT DO NOTHING — a duplicate delivery is a
// no-op write, the handler reads the affected-row count, and if zero, acks-200
// without re-running side effects.

import { bigserial, jsonb, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { webhookSourceEnum } from './_enums.js';

export const webhookUpdates = pgTable(
  'webhook_updates',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    source: webhookSourceEnum('source').notNull(),
    externalId: text('external_id').notNull(), // Telegram update_id, voice call id, gps push id
    payload: jsonb('payload').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('webhook_updates_source_ext_unq').on(t.source, t.externalId)]
);

export type WebhookUpdate = typeof webhookUpdates.$inferSelect;
export type NewWebhookUpdate = typeof webhookUpdates.$inferInsert;
