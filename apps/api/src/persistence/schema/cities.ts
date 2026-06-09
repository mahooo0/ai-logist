// DB-03 + CONTEXT D-02 — cities table with bilingual names and geo point.
// Pitfall #3 (PITFALLS.md): every geography column gets a CHECK ST_SRID = 4326
// constraint and a GiST index — without GiST, `<->` KNN cannot use the index.

import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { geographyPoint } from './_columns.js';

export const cities = pgTable(
  'cities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(), // ASCII Latin canonical, e.g. 'kyiv', 'lviv', 'moscow'
    nameRu: text('name_ru').notNull(),
    nameUa: text('name_ua').notNull(),
    countryCode: text('country_code').notNull(), // 'RU' | 'UA' | 'border'
    geom: geographyPoint('geom').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('cities_slug_unq').on(t.slug),
    index('cities_geom_gist').using('gist', t.geom),
    check('cities_geom_srid_chk', sql`ST_SRID(${t.geom}) = 4326`),
  ]
);

export type City = typeof cities.$inferSelect;
export type NewCity = typeof cities.$inferInsert;
