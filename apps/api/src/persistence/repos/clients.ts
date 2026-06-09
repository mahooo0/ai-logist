// D-07 — thin clients repository.

import { eq } from 'drizzle-orm';
import type { Db } from '../../db.js';
import { type Client, clients, type NewClient } from '../schema/clients.js';

export async function findById(db: Db, id: string): Promise<Client | undefined> {
  const rows = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return rows[0];
}

export async function findByPhone(db: Db, phone: string): Promise<Client | undefined> {
  const rows = await db.select().from(clients).where(eq(clients.phone, phone)).limit(1);
  return rows[0];
}

export async function findByTelegramId(db: Db, telegramId: string): Promise<Client | undefined> {
  const rows = await db.select().from(clients).where(eq(clients.telegramId, telegramId)).limit(1);
  return rows[0];
}

export async function create(db: Db, input: NewClient): Promise<Client> {
  const rows = await db.insert(clients).values(input).returning();
  const created = rows[0];
  if (!created) throw new Error('clientsRepo.create returned no row');
  return created;
}

export async function update(
  db: Db,
  id: string,
  patch: Partial<NewClient>
): Promise<Client | undefined> {
  const rows = await db
    .update(clients)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(clients.id, id))
    .returning();
  return rows[0];
}
