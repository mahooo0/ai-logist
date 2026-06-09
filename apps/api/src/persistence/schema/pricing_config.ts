// CONTEXT D-19 — pricing_config key/value store.
//
// Single-row-per-key store used by Phase 2's calcPrice(): rate_per_km,
// dir_coef (object keyed by 'from->to' direction with fallback default),
// season_coef. value is jsonb so each key can hold whatever shape its calc
// step needs (scalar, object, array). Plan 01-09 (seed) populates the three
// canonical keys; Phase 2 reads them at the start of each price computation.

import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const pricingConfig = pgTable('pricing_config', {
  key: text('key').primaryKey(), // 'rate_per_km' | 'dir_coef' | 'season_coef'
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type PricingConfig = typeof pricingConfig.$inferSelect;
export type NewPricingConfig = typeof pricingConfig.$inferInsert;
