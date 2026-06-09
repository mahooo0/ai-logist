// DB-02 + CONTEXT D-04 — clients table
// Spec §2 baseline (name/phone/telegram_id/lang) extended with tax_id +
// tax_id_country for demo-credibility (EDRPOU UA / ИНН RU).

import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { clientLangEnum } from './_enums.js';

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  phone: text('phone').notNull().unique(), // E.164; used by seed onConflictDoNothing
  telegramId: text('telegram_id'), // nullable — set when client first writes to bot
  lang: clientLangEnum('lang').notNull().default('ru'),

  // CONTEXT D-04 — demo-credibility extension for legal entity hint
  taxId: text('tax_id'), // ИНН (RU) / EDRPOU (UA), nullable
  taxIdCountry: text('tax_id_country'), // 'RU' | 'UA', nullable

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
