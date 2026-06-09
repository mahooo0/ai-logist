// Phase 2 Plan 02-03 Task 1 — Lead FSM.
// CONTEXT D-28, D-29, D-30, D-34. RESEARCH.md §6 (verbatim transitionLead).
// Requirements: FSM-01 (table-driven), FSM-03 (FOR UPDATE + version CAS), FSM-05 (audit).
//
// Wave 3 (intake.ts) acquires per-client pg_advisory_xact_lock around the whole
// dialog turn; transitionLead is the inner row-level atomic step.

import { sql } from 'drizzle-orm';
import type { Db } from '../../db.js';
import { IllegalTransition, VersionMismatch } from './errors.js';

/**
 * Lead funnel stages — exact mirror of the lead_stage Postgres enum (Phase 1
 * apps/api/src/persistence/schema/_enums.ts). Order of values is irrelevant for
 * the FSM table but mirrors the enum order for readability.
 */
export type LeadStage =
  | 'NEW'
  | 'QUALIFIED'
  | 'MATCHED'
  | 'QUOTED'
  | 'AGREED'
  | 'ORDER_CREATED'
  | 'IN_PROGRESS'
  | 'DONE'
  | 'LOST';

/**
 * Allowed transitions per CONTEXT D-28.
 *
 * Forward path (happy):  NEW → QUALIFIED → MATCHED → QUOTED → AGREED → ORDER_CREATED
 *                        → IN_PROGRESS → DONE
 * Drop-out paths (LOST): from any stage NEW..AGREED.
 * Terminal:              DONE, LOST.
 *
 * Any attempt to transition to a target not present in this list throws
 * IllegalTransition.
 */
export const LEAD_TRANSITIONS: Record<LeadStage, LeadStage[]> = {
  NEW: ['QUALIFIED', 'LOST'],
  QUALIFIED: ['MATCHED', 'LOST'],
  MATCHED: ['QUOTED', 'LOST'],
  QUOTED: ['AGREED', 'LOST'],
  AGREED: ['ORDER_CREATED', 'LOST'],
  ORDER_CREATED: ['IN_PROGRESS'],
  IN_PROGRESS: ['DONE'],
  DONE: [],
  LOST: [],
};

/**
 * Audit actor classification — mirrors the lead_event_actor enum (Plan 02-01).
 *   'ai'      → LLM-driven transition (extractRequest, agreed reply, etc.)
 *   'manager' → Phase 4 admin UI override
 *   'system'  → background scheduler (auto-follow-up → LOST)
 */
export type LeadActor = 'ai' | 'manager' | 'system';

export interface TransitionLeadArgs {
  leadId: string;
  to: LeadStage;
  actor: LeadActor;
  /** Free-form metadata appended to lead_events.payload for the timeline UI. */
  payload?: Record<string, unknown>;
}

export interface TransitionLeadResult {
  from: LeadStage;
  to: LeadStage;
  version: number;
}

/**
 * Atomic lead stage transition.
 *
 * Three layers of defense against concurrent writes (closes Pitfall #6):
 *   1. Pessimistic row lock — `SELECT ... FOR UPDATE` holds the row until COMMIT.
 *   2. Optimistic CAS — `UPDATE ... WHERE version = $expected`. If a parallel
 *      transaction already incremented version, RETURNING returns 0 rows.
 *   3. Outer wrapper — Wave 3 intake.ts wraps the whole turn in
 *      `pg_advisory_xact_lock(hashtext(client_id))` so two messages from the
 *      same client are strictly serialized at the connection level.
 *
 * Throws:
 *   - IllegalTransition: target is not in LEAD_TRANSITIONS[currentStage], OR
 *                        the lead row does not exist.
 *   - VersionMismatch:   parallel transaction won the compare-and-set race.
 */
export async function transitionLead(
  db: Db,
  args: TransitionLeadArgs
): Promise<TransitionLeadResult> {
  return await db.transaction(async (tx) => {
    // 1. Pessimistic row lock — blocks any other tx attempting to lock the same row.
    const lockResult = await tx.execute(sql`
      SELECT id, stage, version
      FROM leads
      WHERE id = ${args.leadId}
      FOR UPDATE
    `);
    const row = lockResult.rows[0] as { id: string; stage: LeadStage; version: number } | undefined;
    if (!row) {
      throw new IllegalTransition(
        `lead ${args.leadId} not found (cannot transition to ${args.to})`
      );
    }

    // 2. Validate transition is in the table.
    const allowed = LEAD_TRANSITIONS[row.stage];
    if (!allowed.includes(args.to)) {
      throw new IllegalTransition(
        `cannot transition ${row.stage} → ${args.to} (allowed: ${
          allowed.length > 0 ? allowed.join(', ') : '<terminal>'
        })`
      );
    }

    // 3. Compare-and-set. The FOR UPDATE above means *this connection* now owns
    //    the row, but the optimistic version check is belt-and-suspenders against
    //    any direct UPDATE outside transitionLead() that may have happened between
    //    the prior commit and our SELECT.
    const updated = await tx.execute(sql`
      UPDATE leads
      SET stage = ${args.to}::lead_stage,
          version = version + 1,
          updated_at = NOW()
      WHERE id = ${args.leadId}
        AND version = ${row.version}
      RETURNING version
    `);
    const newVersionRaw = (updated.rows[0] as { version: number | string } | undefined)?.version;
    if (newVersionRaw === undefined) {
      throw new VersionMismatch(
        `lead ${args.leadId} version ${row.version} stale (concurrent write)`
      );
    }
    // bigint columns can surface as string via node-postgres; normalise.
    const newVersion = typeof newVersionRaw === 'string' ? Number(newVersionRaw) : newVersionRaw;

    // 4. Audit log (FSM-05). lead_events FK ON DELETE CASCADE keeps this clean
    //    if a manager hard-deletes the lead.
    await tx.execute(sql`
      INSERT INTO lead_events (lead_id, from_stage, to_stage, actor, payload)
      VALUES (
        ${args.leadId},
        ${row.stage}::lead_stage,
        ${args.to}::lead_stage,
        ${args.actor}::lead_event_actor,
        ${JSON.stringify(args.payload ?? {})}::jsonb
      )
    `);

    return { from: row.stage, to: args.to, version: newVersion };
  });
}
