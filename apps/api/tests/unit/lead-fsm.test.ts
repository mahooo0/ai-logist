// Phase 2 Plan 02-03 Task 1 — lead-fsm table-driven unit tests.
//
// Docker-less: asserts the LEAD_TRANSITIONS table shape + error class semantics.
// The SQL execution path (FOR UPDATE + CAS + audit-log INSERT) is exercised by
// tests/integration/fsm-concurrency.test.ts and tests/integration/fsm-events-audit.test.ts
// (Task 3 — gated on testcontainers).
//
// Source: 02-PLAN.md Task 1, 02-CONTEXT.md D-28, 02-RESEARCH.md §6.

import { describe, expect, it } from 'vitest';
import { IllegalTransition, VersionMismatch } from '../../src/pipeline/lifecycle/errors.js';
import { LEAD_TRANSITIONS, type LeadStage } from '../../src/pipeline/lifecycle/lead-fsm.js';

describe('lead-fsm — LEAD_TRANSITIONS table', () => {
  it('LEAD_TRANSITIONS has exactly 9 stages', () => {
    expect(Object.keys(LEAD_TRANSITIONS)).toHaveLength(9);
  });

  it('NEW → QUALIFIED is allowed', () => {
    expect(LEAD_TRANSITIONS.NEW).toContain('QUALIFIED');
  });

  it('NEW → MATCHED is rejected (must go QUALIFIED first)', () => {
    expect(LEAD_TRANSITIONS.NEW).not.toContain('MATCHED');
  });

  it('DONE and LOST are terminal (no outgoing edges)', () => {
    expect(LEAD_TRANSITIONS.DONE).toEqual([]);
    expect(LEAD_TRANSITIONS.LOST).toEqual([]);
  });

  it.each<[LeadStage, LeadStage[]]>([
    ['NEW', ['QUALIFIED', 'LOST']],
    ['QUALIFIED', ['MATCHED', 'LOST']],
    ['MATCHED', ['QUOTED', 'LOST']],
    ['QUOTED', ['AGREED', 'LOST']],
    ['AGREED', ['ORDER_CREATED', 'LOST']],
    ['ORDER_CREATED', ['IN_PROGRESS']],
    ['IN_PROGRESS', ['DONE']],
    ['DONE', []],
    ['LOST', []],
  ])('stage %s allows exactly %j', (stage, allowed) => {
    expect(LEAD_TRANSITIONS[stage]).toEqual(allowed);
  });

  it('every stage in LEAD_TRANSITIONS exists in lead_stage enum (typecheck spot-check)', () => {
    // Implicit by typing — Record<LeadStage, ...>. Listing here documents intent.
    const stages: LeadStage[] = [
      'NEW',
      'QUALIFIED',
      'MATCHED',
      'QUOTED',
      'AGREED',
      'ORDER_CREATED',
      'IN_PROGRESS',
      'DONE',
      'LOST',
    ];
    for (const s of stages) {
      expect(LEAD_TRANSITIONS[s]).toBeInstanceOf(Array);
    }
  });
});

describe('lead-fsm — error classes', () => {
  it('IllegalTransition carries code "illegal_transition" + includes target in message', () => {
    const err = new IllegalTransition('lead X cannot transition NEW → MATCHED');
    expect(err.code).toBe('illegal_transition');
    expect(err.name).toBe('IllegalTransition');
    expect(err.message).toContain('MATCHED');
    expect(err).toBeInstanceOf(Error);
  });

  it('VersionMismatch carries code "version_mismatch" + is distinct from IllegalTransition', () => {
    const v = new VersionMismatch('stale version');
    const i = new IllegalTransition('illegal');
    expect(v.code).toBe('version_mismatch');
    expect(v.name).toBe('VersionMismatch');
    expect(i.code).toBe('illegal_transition');
    expect(v).toBeInstanceOf(Error);
    // instanceof discriminates between error types.
    expect(v instanceof VersionMismatch).toBe(true);
    expect(v instanceof IllegalTransition).toBe(false);
    expect(i instanceof IllegalTransition).toBe(true);
    expect(i instanceof VersionMismatch).toBe(false);
  });
});
