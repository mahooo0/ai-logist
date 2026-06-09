// DB-07 — bourse_cache table.
//
// Sources:
//   - spec §2 (cache for ATI.SU / Lardi-Trans lookups)
//   - CONTEXT D-07 / Phase 2 MATCH-02 (fallback when own fleet is unavailable)
//
// query_hash is SHA-256 of the normalized query (from→to→tons→body_type) and
// is UNIQUE so Phase 2 can ON CONFLICT DO UPDATE for TTL refresh.
// fetched_at drives the TTL — the matcher discards rows older than the configured
// freshness window.

import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const bourseCache = pgTable(
  'bourse_cache',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    queryHash: text('query_hash').notNull(), // SHA-256 of normalized query (from→to→tons→body)
    source: text('source').notNull(), // 'ati.su' | 'lardi-trans' | 'mock'
    payload: jsonb('payload').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('bourse_cache_query_hash_unq').on(t.queryHash),
    index('bourse_cache_source_idx').on(t.source),
  ]
);

export type BourseCache = typeof bourseCache.$inferSelect;
export type NewBourseCache = typeof bourseCache.$inferInsert;
