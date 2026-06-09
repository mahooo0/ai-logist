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
  it('ORDER_TRANSITIONS has exactly 7 statuses', () => {
    expect(Object.keys(ORDER_TRANSITIONS)).toHaveLength(7);
  });

  it.each<[OrderStatus, OrderStatus[]]>([
    ['CREATED', ['DRIVER_ASSIGNED']],
    ['DRIVER_ASSIGNED', ['AT_LOADING']],
    ['AT_LOADING', ['IN_TRANSIT']],
    ['IN_TRANSIT', ['AT_BORDER', 'DELIVERED']],
    ['AT_BORDER', ['IN_TRANSIT']],
    ['DELIVERED', ['CLOSED']],
    ['CLOSED', []],
  ])('status %s allows exactly %j', (status, allowed) => {
    expect(ORDER_TRANSITIONS[status]).toEqual(allowed);
  });

  it('CREATED → IN_TRANSIT illegal (must go through DRIVER_ASSIGNED + AT_LOADING)', () => {
    expect(ORDER_TRANSITIONS.CREATED).not.toContain('IN_TRANSIT');
  });

  it('CLOSED is terminal — no outgoing edges', () => {
    expect(ORDER_TRANSITIONS.CLOSED).toEqual([]);
  });

  it('IN_TRANSIT branches to both AT_BORDER and DELIVERED', () => {
    // Either international (via border) or domestic (straight to delivered).
    expect(ORDER_TRANSITIONS.IN_TRANSIT).toContain('AT_BORDER');
    expect(ORDER_TRANSITIONS.IN_TRANSIT).toContain('DELIVERED');
  });

  it('AT_BORDER → IN_TRANSIT (cleared customs), no direct DELIVERED', () => {
    expect(ORDER_TRANSITIONS.AT_BORDER).toEqual(['IN_TRANSIT']);
  });
});

describe('order-fsm — STATUS_TO_EVENT mapping', () => {
  it('all 6 non-terminal statuses map to lowercase event type', () => {
    // order_event_type enum is lowercase (Phase 1); order_status is uppercase.
    expect(STATUS_TO_EVENT.CREATED).toBe('created');
    expect(STATUS_TO_EVENT.DRIVER_ASSIGNED).toBe('driver_assigned');
    expect(STATUS_TO_EVENT.AT_LOADING).toBe('at_loading');
    expect(STATUS_TO_EVENT.IN_TRANSIT).toBe('in_transit');
    expect(STATUS_TO_EVENT.AT_BORDER).toBe('at_border');
    expect(STATUS_TO_EVENT.DELIVERED).toBe('delivered');
  });

  it('CLOSED maps to null (no event type — terminal admin action)', () => {
    expect(STATUS_TO_EVENT.CLOSED).toBeNull();
  });

  it('STATUS_TO_EVENT covers all 7 order statuses', () => {
    expect(Object.keys(STATUS_TO_EVENT)).toHaveLength(7);
  });
});
