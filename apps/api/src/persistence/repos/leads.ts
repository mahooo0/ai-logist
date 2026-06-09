// D-07 — thin leads repository.
//
// Phase 2's FSM transitions will UPDATE … WHERE version = $expected RETURNING
// version via raw sql for optimistic concurrency (FSM-03); this CRUD layer
// covers the non-FSM access paths used by the admin dashboard (Phase 4).

import { eq } from 'drizzle-orm';
import type { Db } from '../../db.js';
import { type Lead, leads, type NewLead } from '../schema/leads.js';

export async function findById(db: Db, id: string): Promise<Lead | undefined> {
  const rows = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  return rows[0];
}

export async function listByStage(db: Db, stage: Lead['stage']): Promise<Lead[]> {
  return db.select().from(leads).where(eq(leads.stage, stage));
}

export async function create(db: Db, input: NewLead): Promise<Lead> {
  const rows = await db.insert(leads).values(input).returning();
  const created = rows[0];
  if (!created) throw new Error('leadsRepo.create returned no row');
  return created;
}

export async function update(
  db: Db,
  id: string,
  patch: Partial<NewLead>
): Promise<Lead | undefined> {
  const rows = await db
    .update(leads)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(leads.id, id))
    .returning();
  return rows[0];
}
