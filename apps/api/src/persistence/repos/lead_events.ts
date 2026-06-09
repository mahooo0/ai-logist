// Phase 2 Plan 02-01 Task 1 — lead_events thin repo (D-07 pattern).
// FSM-05 — append-only audit log for lead stage transitions.
//
// Used by:
//   - Wave 2 transitionLead (D-29) — appends after compare-and-set succeeds, inside the txn.
//   - Wave 4 admin routes — listByLead for the lead detail timeline.

import { asc, eq } from 'drizzle-orm';
import type { Db } from '../../db.js';
import { type LeadEvent, leadEvents, type NewLeadEvent } from '../schema/lead_events.js';

export async function appendEvent(db: Db, input: NewLeadEvent): Promise<LeadEvent> {
  const rows = await db.insert(leadEvents).values(input).returning();
  const created = rows[0];
  if (!created) throw new Error('leadEventsRepo.appendEvent returned no row');
  return created;
}

export async function listByLead(db: Db, leadId: string): Promise<LeadEvent[]> {
  return db
    .select()
    .from(leadEvents)
    .where(eq(leadEvents.leadId, leadId))
    .orderBy(asc(leadEvents.createdAt));
}
