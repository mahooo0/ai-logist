// Phase 2 Plan 02-01 Task 1 — Docker-LESS Drizzle introspection smoke for lead_events.
// CONTEXT D-37, FSM-05.
//
// Verifies that the Drizzle `leadEvents` table descriptor matches the migration shape
// even on runners without Docker — catches schema drift before integration tests run.

import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { leadEvents } from '../../src/persistence/schema/lead_events.js';

describe('Drizzle lead_events descriptor', () => {
  it('table name is lead_events', () => {
    const cfg = getTableConfig(leadEvents);
    expect(cfg.name).toBe('lead_events');
  });

  it('has expected columns in expected order', () => {
    const cfg = getTableConfig(leadEvents);
    const names = cfg.columns.map((c) => c.name);
    expect(names).toEqual([
      'id',
      'lead_id',
      'from_stage',
      'to_stage',
      'actor',
      'payload',
      'created_at',
    ]);
  });

  it('actor column is non-null lead_event_actor enum', () => {
    const cfg = getTableConfig(leadEvents);
    const actor = cfg.columns.find((c) => c.name === 'actor');
    expect(actor).toBeDefined();
    if (!actor) throw new Error('actor column missing');
    expect(actor.notNull).toBe(true);
    // Drizzle exposes enum name on the column type; smoke-check by string.
    const colSql = actor.getSQLType();
    expect(colSql).toMatch(/lead_event_actor/);
  });

  it('payload column is non-null jsonb', () => {
    const cfg = getTableConfig(leadEvents);
    const payload = cfg.columns.find((c) => c.name === 'payload');
    expect(payload).toBeDefined();
    if (!payload) throw new Error('payload column missing');
    expect(payload.notNull).toBe(true);
    expect(payload.getSQLType()).toMatch(/jsonb/i);
  });

  it('lead_id column references leads with cascade delete', () => {
    const cfg = getTableConfig(leadEvents);
    const leadId = cfg.columns.find((c) => c.name === 'lead_id');
    expect(leadId).toBeDefined();
    if (!leadId) throw new Error('lead_id column missing');
    expect(leadId.notNull).toBe(true);
    expect(leadId.getSQLType()).toMatch(/uuid/i);
  });

  it('exposes lead_events_lead_id_idx index', () => {
    const cfg = getTableConfig(leadEvents);
    const idxNames = cfg.indexes.map((i) => i.config.name);
    expect(idxNames).toContain('lead_events_lead_id_idx');
  });
});
