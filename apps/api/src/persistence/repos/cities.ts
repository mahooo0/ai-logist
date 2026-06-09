// D-07 — thin cities repository.
//
// Cities are read-heavy and seeded once. upsert() honours the slug UNIQUE
// constraint so the Plan 01-09 seed can run idempotently.

import { eq } from 'drizzle-orm';
import type { Db } from '../../db.js';
import { type City, cities, type NewCity } from '../schema/cities.js';

export async function findBySlug(db: Db, slug: string): Promise<City | undefined> {
  const rows = await db.select().from(cities).where(eq(cities.slug, slug)).limit(1);
  return rows[0];
}

export async function upsert(db: Db, input: NewCity): Promise<City> {
  const rows = await db
    .insert(cities)
    .values(input)
    .onConflictDoNothing({ target: cities.slug })
    .returning();
  if (rows[0]) return rows[0];
  const existing = await findBySlug(db, input.slug);
  if (!existing)
    throw new Error(`citiesRepo.upsert: slug ${input.slug} neither inserted nor found`);
  return existing;
}

export async function list(db: Db): Promise<City[]> {
  return db.select().from(cities);
}
