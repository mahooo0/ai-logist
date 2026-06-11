// Phase 2 Plan 02-03 Task 2 — order-fsm table-driven unit tests.
//
// Docker-less assertions on the ORDER_TRANSITIONS table shape + STATUS_TO_EVENT map.
// SQL execution path (FOR UPDATE + CAS + ON CONFLICT DO NOTHING audit) covered by
// integration tests (Task 3, gated on testcontainers).
//
// Source: 02-PLAN.md Task 2, 02-CONTEXT.md D-32..D-34.

import { describe, expect, it } from 'vitest';
import {
  ORDER_TRANSITIONS,
  type OrderStatus,
  STATUS_TO_EVENT,
} from '../../src/pipeline/lifecycle/order-fsm.js';

describe('order-fsm — ORDER_TRANSITIONS table', () => {
  // Phase 6 D-11: updated from 7 to 10 (added DELIVERED_PENDING, AWAITING_PAYMENT, CANCELED).
  it('ORDER_TRANSITIONS has exactly 10 statuses', () => {
    expect(Object.keys(ORDER_TRANSITIONS)).toHaveLength(10);
  });

  it.each<[OrderStatus, OrderStatus[]]>([
    ['CREATED', ['DRIVER_ASSIGNED']],
    // Phase 3 D-19 — DRIVER_ASSIGNED → CLOSED edge added for driver-decline
    // shortcut path. Standard happy-path still goes via AT_LOADING.
    ['DRIVER_ASSIGNED', ['AT_LOADING', 'CLOSED']],
    // Phase 6 D-11: CANCELED added for client decline path.
    ['AT_LOADING', ['IN_TRANSIT', 'CANCELED']],
    // Phase 6 D-11: DELIVERED_PENDING added for auto-progress ticker leg 2.
    ['IN_TRANSIT', ['AT_BORDER', 'DELIVERED', 'DELIVERED_PENDING']],
    ['AT_BORDER', ['IN_TRANSIT']],
    ['DELIVERED', ['CLOSED']],
    ['CLOSED', []],
    // Phase 6 new statuses.
    ['DELIVERED_PENDING', ['AWAITING_PAYMENT', 'CANCELED']],
    ['AWAITING_PAYMENT', ['CLOSED']],
    ['CANCELED', []],
  ])('status %s allows exactly %j', (status, allowed) => {
    expect(ORDER_TRANSITIONS[status]).toEqual(allowed);
  });

  it('CREATED → IN_TRANSIT illegal (must go through DRIVER_ASSIGNED + AT_LOADING)', () => {
    expect(ORDER_TRANSITIONS.CREATED).not.toContain('IN_TRANSIT');
  });

  it('CLOSED is terminal — no outgoing edges', () => {
    expect(ORDER_TRANSITIONS.CLOSED).toEqual([]);
  });

  it('CANCELED is terminal — no outgoing edges', () => {
    expect(ORDER_TRANSITIONS.CANCELED).toEqual([]);
  });

  it('IN_TRANSIT branches to AT_BORDER, DELIVERED, and DELIVERED_PENDING', () => {
    // International (via border), domestic legacy (DELIVERED), or Phase 6 auto path (DELIVERED_PENDING).
    expect(ORDER_TRANSITIONS.IN_TRANSIT).toContain('AT_BORDER');
    expect(ORDER_TRANSITIONS.IN_TRANSIT).toContain('DELIVERED');
    expect(ORDER_TRANSITIONS.IN_TRANSIT).toContain('DELIVERED_PENDING');
  });

  it('AT_BORDER → IN_TRANSIT (cleared customs), no direct DELIVERED', () => {
    expect(ORDER_TRANSITIONS.AT_BORDER).toEqual(['IN_TRANSIT']);
  });
});

describe('order-fsm — STATUS_TO_EVENT mapping', () => {
  it('all non-terminal statuses map to lowercase event type', () => {
    // order_event_type enum is lowercase (Phase 1); order_status is uppercase.
    expect(STATUS_TO_EVENT.CREATED).toBe('created');
    expect(STATUS_TO_EVENT.DRIVER_ASSIGNED).toBe('driver_assigned');
    // Phase 6 B5 Path A: AT_LOADING maps to 'loading_prompted' (NOT legacy 'at_loading').
    expect(STATUS_TO_EVENT.AT_LOADING).toBe('loading_prompted');
    expect(STATUS_TO_EVENT.IN_TRANSIT).toBe('in_transit');
    expect(STATUS_TO_EVENT.AT_BORDER).toBe('at_border');
    expect(STATUS_TO_EVENT.DELIVERED).toBe('delivered');
  });

  it('CLOSED maps to "closed" (Phase 6: now has an event type)', () => {
    expect(STATUS_TO_EVENT.CLOSED).toBe('closed');
  });

  it('CANCELED maps to null (terminal failure; events written explicitly by handler)', () => {
    expect(STATUS_TO_EVENT.CANCELED).toBeNull();
  });

  it('Phase 6 new statuses map to correct event types', () => {
    expect(STATUS_TO_EVENT.DELIVERED_PENDING).toBe('delivery_prompted');
    expect(STATUS_TO_EVENT.AWAITING_PAYMENT).toBe('payment_link_sent');
  });

  // Phase 6 D-11: updated from 7 to 10 (added DELIVERED_PENDING, AWAITING_PAYMENT, CANCELED).
  it('STATUS_TO_EVENT covers all 10 order statuses', () => {
    expect(Object.keys(STATUS_TO_EVENT)).toHaveLength(10);
  });
});
