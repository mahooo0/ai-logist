// D-07 — thin orders repository.
//
// findByPublicToken backs the Phase 5 `/track/[token]` route. Like leads, the
// FSM-driven status transitions (with version concurrency) ship in Phase 2 via
// raw sql; this layer is plain CRUD.

import { eq } from 'drizzle-orm';
import type { Db } from '../../db.js';
import { type NewOrder, type Order, orders } from '../schema/orders.js';

export async function findById(db: Db, id: string): Promise<Order | undefined> {
  const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return rows[0];
}

export async function findByPublicToken(db: Db, token: string): Promise<Order | undefined> {
  const rows = await db.select().from(orders).where(eq(orders.publicToken, token)).limit(1);
  return rows[0];
}

export async function listByStatus(db: Db, status: Order['status']): Promise<Order[]> {
  return db.select().from(orders).where(eq(orders.status, status));
}

export async function create(db: Db, input: NewOrder): Promise<Order> {
  const rows = await db.insert(orders).values(input).returning();
  const created = rows[0];
  if (!created) throw new Error('ordersRepo.create returned no row');
  return created;
}

export async function update(
  db: Db,
  id: string,
  patch: Partial<NewOrder>
): Promise<Order | undefined> {
  const rows = await db
    .update(orders)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(orders.id, id))
    .returning();
  return rows[0];
}
