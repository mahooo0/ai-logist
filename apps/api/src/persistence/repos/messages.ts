// D-07 — thin messages repository.
//
// listByClient returns chat history newest-first, capped — Phase 3's Telegram
// pipeline reads the recent window to seed the LLM context. Phase 4's inbox
// admin will paginate via createdAt cursors.

import { desc, eq } from 'drizzle-orm';
import type { Db } from '../../db.js';
import { type Message, messages, type NewMessage } from '../schema/messages.js';

export async function listByClient(db: Db, clientId: string, limit = 100): Promise<Message[]> {
  return db
    .select()
    .from(messages)
    .where(eq(messages.clientId, clientId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
}

export async function create(db: Db, input: NewMessage): Promise<Message> {
  const rows = await db.insert(messages).values(input).returning();
  const created = rows[0];
  if (!created) throw new Error('messagesRepo.create returned no row');
  return created;
}
