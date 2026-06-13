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

// ─── Per-state arrival hooks ────────────────────────────────────────────────
// Modules outside the FSM (voice dialer, payment-link sender) register a hook
// keyed by target OrderStatus. transitionOrder fires the registered hook AFTER
// COMMIT and BEFORE caller-supplied onSuccess, fire-and-forget. This lets us
// have a single source of truth for "what happens when an order enters state X"
// regardless of who triggered the transition (ticker, manual admin slider,
// TG callback, voice tool). Hooks must not throw — failures are logged via
// console.error and never roll back the FSM transition (RESEARCH Pitfall #3).
//
// Decoupling rationale: the FSM file is shared by tests and many callers; we
// don't want a static import of telegram/voice/stripe code here. Registration
// happens once at app bootstrap (lifecycle/arrival-hooks.ts initOrderArrivalHooks).
export type ArrivalHook = (orderId: string, db: Db) => Promise<void> | void;
const arrivalHooks: Partial<Record<OrderStatus, ArrivalHook>> = {};

/** Register the side-effect hook for a particular order state. Overwrites if
 *  the slot was already registered (boot is the only caller). */
export function registerOrderArrivalHook(status: OrderStatus, hook: ArrivalHook): void {
  arrivalHooks[status] = hook;
}

/** Test-only: clear all registered hooks between Vitest cases so a hook
 *  registered by one test doesn't leak into the next. */
export function clearOrderArrivalHooks(): void {
  for (const k of Object.keys(arrivalHooks) as OrderStatus[]) {
    delete arrivalHooks[k];
  }
}

export type OrderStatus =
  | 'CREATED'
  | 'DRIVER_ASSIGNED'
  | 'AT_LOADING'
  | 'IN_TRANSIT'
  | 'AT_BORDER'
  | 'DELIVERED'
  | 'CLOSED'
  | 'DELIVERED_PENDING'
  | 'AWAITING_PAYMENT'
  | 'CANCELED';

/**
 * Allowed order lifecycle transitions per CONTEXT D-32 + Phase 6 D-11.
 *
 *   CREATED → DRIVER_ASSIGNED → AT_LOADING → IN_TRANSIT → AT_BORDER ⇄ IN_TRANSIT
 *                                                    └→ DELIVERED_PENDING → AWAITING_PAYMENT → CLOSED
 *                                         └→ CANCELED
 *
 * Phase 6 D-11 adds 8 new edges:
 *   AT_LOADING → CANCELED (client declines loading)
 *   IN_TRANSIT → DELIVERED_PENDING (ticker hits 100% on leg 2)
 *   DELIVERED_PENDING → AWAITING_PAYMENT (client confirms delivery)
 *   DELIVERED_PENDING → CANCELED (client declines delivery)
 *   AWAITING_PAYMENT → CLOSED (Stripe webhook checkout.session.completed)
 *
 * AT_BORDER can re-emerge to IN_TRANSIT (cleared customs); IN_TRANSIT can branch
 * to AT_BORDER (international leg) or DELIVERED (domestic leg for backwards compat).
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  CREATED: ['DRIVER_ASSIGNED'],
  // CLOSED edge added 2026-06-10 (Phase 3) for driver_decline path —
  // RESEARCH Pitfall #5 simplification per CONTEXT D-19. Skips the
  // AT_LOADING → IN_TRANSIT → DELIVERED → CLOSED full lifecycle when the
  // driver explicitly refuses the assignment; lead is independently
  // transitioned to LOST by the callback handler.
  DRIVER_ASSIGNED: ['AT_LOADING', 'CLOSED'],
  // Phase 6 D-11: CANCELED added for client decline path.
  AT_LOADING: ['IN_TRANSIT', 'CANCELED'],
  // Phase 6 D-11: DELIVERED_PENDING added for auto-progress ticker (leg 2 at 100%).
  // DELIVERED kept for backwards compat (existing orders on legacy path).
  IN_TRANSIT: ['AT_BORDER', 'DELIVERED', 'DELIVERED_PENDING'],
  AT_BORDER: ['IN_TRANSIT'],
  DELIVERED: ['CLOSED'],
  // Phase 6 D-11: new statuses.
  DELIVERED_PENDING: ['AWAITING_PAYMENT', 'CANCELED'],
  AWAITING_PAYMENT: ['CLOSED'],
  CANCELED: [],
  CLOSED: [],
};

/**
 * Bridge between order_status (uppercase) and order_event_type (lowercase).
 *
 * Phase 1 declared order_event_type as
 *   'created'|'driver_assigned'|'at_loading'|'in_transit'|'at_border'|'delivered'
 * — six values. Phase 6 D-11 (B5 Path A) extends this:
 *   AT_LOADING → 'loading_prompted' (NOT the legacy 'at_loading' — B5 Path A chosen).
 *     This is the single source of truth the timeout SQL queries in Plan 06-02 Task 3
 *     use (WHERE type IN ('loading_prompted', 'delivery_prompted')).
 *   CLOSED → 'closed' (now has an event type; was null pre-Phase-6).
 *   CANCELED → null (terminal failure; no event inserted via this map).
 */
export const STATUS_TO_EVENT: Record<OrderStatus, string | null> = {
  CREATED: 'created',
  DRIVER_ASSIGNED: 'driver_assigned',
  // Phase 6 B5 Path A: 'loading_prompted' (NOT legacy 'at_loading').
  AT_LOADING: 'loading_prompted',
  IN_TRANSIT: 'in_transit',
  AT_BORDER: 'at_border',
  DELIVERED: 'delivered',
  // Phase 6: CLOSED now has an event type.
  CLOSED: 'closed',
  // Phase 6 D-11 new statuses.
  DELIVERED_PENDING: 'delivery_prompted',
  AWAITING_PAYMENT: 'payment_link_sent',
  // CANCELED is a terminal failure state; no dedicated event type in STATUS_TO_EVENT
  // (decline/escalation events are written explicitly by the handler, not via this map).
  CANCELED: null,
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
  /**
   * Phase 3 D-25: optional callback fired AFTER db.transaction commits.
   * Used by Telegram to notify the client (and driver) on DRIVER_ASSIGNED /
   * IN_TRANSIT / DELIVERED transitions. Errors are caught and logged — they
   * MUST NOT roll back the FSM transition (RESEARCH Pitfall #3).
   */
  onSuccess?: (result: TransitionOrderResult) => Promise<void> | void;
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
  // Phase 3 D-25 refactor — wrap the existing transaction body byte-identically
  // and add a post-commit onSuccess hook AFTER the tx returns. The body inside
  // `db.transaction` is UNCHANGED; only the outer return is split so the hook
  // can fire after COMMIT (RESEARCH Pitfall #3 — never run notifications inside
  // the FSM transaction).
  const result = await db.transaction(async (tx) => {
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

  // Per-state arrival hook (e.g. AT_LOADING → dial client; AWAITING_PAYMENT →
  // sendPaymentLink). Fires for every successful transition into the target
  // state, regardless of caller (ticker, manual admin, TG callback, voice tool).
  // Fire-and-forget; failures never roll back the FSM.
  const arrivalHook = arrivalHooks[args.to];
  if (arrivalHook) {
    Promise.resolve(arrivalHook(args.orderId, db)).catch((err) => {
      console.error(`ARRIVAL_HOOKS[${args.to}] failed for order ${args.orderId}`, err);
    });
  }

  // Post-commit caller-supplied hook (D-25). Fire-and-forget — failures MUST
  // NOT roll back the already-committed transition. The caller is responsible
  // for logging at call-site; we fall back to console.error if onSuccess
  // throws synchronously.
  if (args.onSuccess) {
    Promise.resolve(args.onSuccess(result)).catch((err) => {
      console.error('transitionOrder.onSuccess failed', err);
    });
  }
  return result;
}
