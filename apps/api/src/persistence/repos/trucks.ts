// D-07 — thin trucks repository.
//
// Plain functions take a Db (or transaction) as the first argument. No classes,
// no DI. PostGIS-heavy reads (nearestTruck KNN with CTE re-rank per D-08) ship
// in Phase 2 via raw `db.execute(sql\`…\`)`; this file is CRUD only.

import { eq } from 'drizzle-orm';
import type { Db } from '../../db.js';
import { type NewTruck, type Truck, trucks } from '../schema/trucks.js';

export async function findById(db: Db, id: string): Promise<Truck | undefined> {
  const rows = await db.select().from(trucks).where(eq(trucks.id, id)).limit(1);
  return rows[0];
}

export async function findByPlate(db: Db, plate: string): Promise<Truck | undefined> {
  const rows = await db.select().from(trucks).where(eq(trucks.plateNumber, plate)).limit(1);
  return rows[0];
}

export async function list(
  db: Db,
  opts: { status?: 'available' | 'busy' | 'maintenance' } = {}
): Promise<Truck[]> {
  if (opts.status) {
    return db.select().from(trucks).where(eq(trucks.status, opts.status));
  }
  return db.select().from(trucks);
}

export async function create(db: Db, input: NewTruck): Promise<Truck> {
  const rows = await db.insert(trucks).values(input).returning();
  const created = rows[0];
  if (!created) throw new Error('trucksRepo.create returned no row');
  return created;
}

export async function update(
  db: Db,
  id: string,
  patch: Partial<NewTruck>
): Promise<Truck | undefined> {
  const rows = await db
    .update(trucks)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(trucks.id, id))
    .returning();
  return rows[0];
}
