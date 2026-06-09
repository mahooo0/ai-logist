// Phase 2 Plan 02-03 Task 2 — Order FSM.
// CONTEXT D-32, D-33, D-34. RESEARCH.md §6 (transitionLead is the template).
// Requirements: FSM-02 (table-driven), FSM-03 (FOR UPDATE + version CAS), FSM-05 (audit).
//
// Differences from lead-fsm:
//   - order_status enum is uppercase; order_event_type enum is lowercase. STATUS_TO_EVENT
//     bridges them.
//   - order_events has UNIQUE(order_id, type) (Phase 1) → audit insert uses
//     ON CONFLICT DO NOTHING so a Phase 5 geofence re-fire is a no-op without
//     breaking the status update + version bump.
//   - order_events.geom is geography(Point,4326) nullable — only geofence-triggered
//     transitions carry a point; manual admin transitions do not. We pass a
//     SRID-prefixed WKT via ST_GeogFromText.

import { sql } from 'drizzle-orm';
import type { Db } from '../../db.js';
import { IllegalTransition, VersionMismatch } from './errors.js';

export type OrderStatus =
  | 'CREATED'
  | 'DRIVER_ASSIGNED'
  | 'AT_LOADING'
  | 'IN_TRANSIT'
  | 'AT_BORDER'
  | 'DELIVERED'
  | 'CLOSED';

/**
 * Allowed order lifecycle transitions per CONTEXT D-32.
 *
 *   CREATED → DRIVER_ASSIGNED → AT_LOADING → IN_TRANSIT → AT_BORDER ⇄ IN_TRANSIT
 *                                                    └→ DELIVERED → CLOSED
 *
 * AT_BORDER can re-emerge to IN_TRANSIT (cleared customs); IN_TRANSIT can branch
 * to AT_BORDER (international leg) or DELIVERED (domestic leg).
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  CREATED: ['DRIVER_ASSIGNED'],
  DRIVER_ASSIGNED: ['AT_LOADING'],
  AT_LOADING: ['IN_TRANSIT'],
  IN_TRANSIT: ['AT_BORDER', 'DELIVERED'],
  AT_BORDER: ['IN_TRANSIT'],
  DELIVERED: ['CLOSED'],
  CLOSED: [],
};

/**
 * Bridge between order_status (uppercase) and order_event_type (lowercase).
 *
 * Phase 1 declared order_event_type as
 *   'created'|'driver_assigned'|'at_loading'|'in_transit'|'at_border'|'delivered'
 * — six values, no 'closed'. CLOSED is a terminal admin status without a
 * corresponding geofence/timeline event, so audit-log writes for CLOSED transitions
 * are skipped (audit_row_inserted = false).
 */
export const STATUS_TO_EVENT: Record<OrderStatus, string | null> = {
  CREATED: 'created',
  DRIVER_ASSIGNED: 'driver_assigned',
  AT_LOADING: 'at_loading',
  IN_TRANSIT: 'in_transit',
  AT_BORDER: 'at_border',
  DELIVERED: 'delivered',
  CLOSED: null,
};

/**
 * Actor classification — note that Phase 1's order_events.actor is plain TEXT
 * (NOT the lead_event_actor enum). The value set is the same convention.
 */
export type OrderActor = 'ai' | 'manager' | 'system';

export interface TransitionOrderArgs {
  orderId: string;
  to: OrderStatus;
  actor: OrderActor;
  payload?: Record<string, unknown>;
  /**
   * Optional WKT point for geofence-driven events (Phase 5).
   * Format: 'POINT(lon lat)' — the SRID=4326 prefix is added internally.
   */
  geomWkt?: string;
}

export interface TransitionOrderResult {
  from: OrderStatus;
  to: OrderStatus;
  version: number;
  /**
   * False when CLOSED (STATUS_TO_EVENT=null) OR when ON CONFLICT DO NOTHING
   * suppressed the insert because an earlier event with the same (order_id, type)
   * already exists (Phase 5 idempotency for re-fired geofence events).
   */
  audit_row_inserted: boolean;
}

/**
 * Atomic order status transition.
 *
 * Same three-layer concurrency defense as transitionLead (FSM-03):
 *   1. SELECT ... FOR UPDATE — row-level lock.
 *   2. UPDATE ... WHERE version = $expected RETURNING — compare-and-set.
 *   3. INSERT INTO order_events ON CONFLICT (order_id, type) DO NOTHING — audit
 *      with Phase 5 idempotency preserved.
 *
 * Throws:
 *   - IllegalTransition: target not in ORDER_TRANSITIONS[currentStatus], or order missing.
 *   - VersionMismatch:   parallel transaction won the compare-and-set race.
 */
export async function transitionOrder(
  db: Db,
  args: TransitionOrderArgs
): Promise<TransitionOrderResult> {
  return await db.transaction(async (tx) => {
    // 1. Pessimistic row lock.
    const lockResult = await tx.execute(sql`
      SELECT id, status, version
      FROM orders
      WHERE id = ${args.orderId}
      FOR UPDATE
    `);
    const row = lockResult.rows[0] as
      | { id: string; status: OrderStatus; version: number }
      | undefined;
    if (!row) {
      throw new IllegalTransition(
        `order ${args.orderId} not found (cannot transition to ${args.to})`
      );
    }

    // 2. Validate transition is allowed.
    const allowed = ORDER_TRANSITIONS[row.status];
    if (!allowed.includes(args.to)) {
      throw new IllegalTransition(
        `cannot transition order ${row.status} → ${args.to} (allowed: ${
          allowed.length > 0 ? allowed.join(', ') : '<terminal>'
        })`
      );
    }

    // 3. Compare-and-set the version.
    const updated = await tx.execute(sql`
      UPDATE orders
      SET status = ${args.to}::order_status,
          version = version + 1,
          updated_at = NOW()
      WHERE id = ${args.orderId}
        AND version = ${row.version}
      RETURNING version
    `);
    const newVersionRaw = (updated.rows[0] as { version: number | string } | undefined)?.version;
    if (newVersionRaw === undefined) {
      throw new VersionMismatch(
        `order ${args.orderId} version ${row.version} stale (concurrent write)`
      );
    }
    const newVersion = typeof newVersionRaw === 'string' ? Number(newVersionRaw) : newVersionRaw;

    // 4. Audit log into order_events. Skip when status has no event type (CLOSED).
    //    UNIQUE(order_id, type) makes geofence re-fires idempotent (Phase 5).
    const eventType = STATUS_TO_EVENT[args.to];
    let auditRowInserted = false;
    if (eventType !== null) {
      // Conditional geom: pass NULL or ST_GeogFromText('SRID=4326;POINT(lon lat)').
      // Concatenating the SRID prefix inside the SQL keeps the parameter binding
      // a plain text value (geomWkt is e.g. 'POINT(30.5 50.4)').
      const geomFragment = args.geomWkt
        ? sql`ST_GeogFromText('SRID=4326;' || ${args.geomWkt})`
        : sql`NULL`;
      const insertResult = await tx.execute(sql`
        INSERT INTO order_events (order_id, type, actor, payload, geom)
        VALUES (
          ${args.orderId},
          ${eventType}::order_event_type,
          ${args.actor},
          ${JSON.stringify(args.payload ?? {})}::jsonb,
          ${geomFragment}
        )
        ON CONFLICT (order_id, type) DO NOTHING
        RETURNING id
      `);
      auditRowInserted = insertResult.rows.length > 0;
    }

    return {
      from: row.status,
      to: args.to,
      version: newVersion,
      audit_row_inserted: auditRowInserted,
    };
  });
}
