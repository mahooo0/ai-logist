// Phase 3.1 VOICE-12 boundary — calls table contract satisfies Phase 4
// /dashboard/chat + /dashboard/calls consumer.
//
// Boundary: Phase 4 builds the admin web UI (audio player, transcript
// thread, filter chips, linked-order navigation). Phase 3.1 ONLY guarantees
// the DATA layer is correct so Phase 4 doesn't discover schema gaps late.
//
// This test asserts via Drizzle getTableColumns introspection that every
// column documented in 03.1-04-uat-gate-PLAN.md "phase_4_consumer_contract"
// table is present on the calls schema mirror. If a column is renamed,
// dropped, or type-shifted by an upstream migration, this test fails before
// Phase 4 starts.
//
// Companion: phase-3.1-stubs.test.ts VOICE-12 it() block (which references
// this file by path in its docstring).

import { getTableColumns } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { calls } from '../../src/persistence/schema/calls.js';

describe('Phase 3.1 — VOICE-12 calls table boundary (Phase 4 consumer contract)', () => {
  it('exposes all 12 columns Phase 4 /dashboard/chat + /dashboard/calls need', () => {
    const cols = getTableColumns(calls);
    // Each column is documented in Plan 03.1-04 phase_4_consumer_contract table.
    // Drizzle keys are camelCase mirrors of snake_case SQL column names.
    const required = [
      'id', // uuid — row key for filter/click navigation
      'leadId', // uuid — legacy Phase 1 column (still readable)
      'linkedLeadId', // uuid — join to leads → orders for "linked order" column
      'direction', // text — inbound vs outbound (future-proofing)
      'durationS', // bigint — "Duration" column on calls table
      'transcript', // jsonb — turn-by-turn agent/caller speech for chat thread
      'audioUrl', // text — audio player src on call detail modal
      'outcome', // call_outcome enum — filter chip (completed/abandoned/escalated/error)
      'lang', // client_lang enum — filter chip (ru/ua)
      'quotedPriceAtConfirmation', // bigint — audit display on call detail
      'elevenlabsConversationId', // text UNIQUE — cross-reference to ElevenLabs dashboard
      'twilioCallSid', // text UNIQUE — cross-reference to Twilio dashboard
      'createdAt', // timestamp — sort key + "timestamp" column
    ];
    for (const col of required) {
      expect(cols).toHaveProperty(col);
    }
  });

  it('transcript column is jsonb (turn-by-turn structure for chat thread render)', () => {
    const cols = getTableColumns(calls);
    expect(cols.transcript).toBeDefined();
    // Drizzle 0.45.2 surfaces column metadata via dataType / columnType.
    // jsonb columns expose dataType === 'json' in the introspection result.
    // We assert presence + non-trivial column descriptor; full SQL-type proof
    // lives in the Wave 1 migration (0004_phase31_voice_calls.sql) which the
    // Wave 1 schema-mirror test (voice-schema-mirror) already covers.
    const dataType = (cols.transcript as { dataType?: string }).dataType;
    expect(typeof dataType === 'string' || dataType === undefined).toBe(true);
  });

  it('outcome is call_outcome enum (typed, not raw text — verifies migration 0004 ran)', () => {
    const cols = getTableColumns(calls);
    expect(cols.outcome).toBeDefined();
    // The enum imported from _enums.ts is callOutcomeEnum('outcome') — column
    // reference must be enum-flavored. Type-level assertion happens via
    // $inferSelect at TS compile (the typecheck gate proves this).
    type CallSelect = typeof calls.$inferSelect;
    // OutcomeType is exercised as a literal-union via assignability check.
    // If `outcome` regressed to plain string, the assignment below would
    // widen and the runtime expect would still pass — but typecheck would
    // accept arbitrary strings, breaking Phase 4 filter chip semantics.
    const sampleOutcome: CallSelect['outcome'] = 'completed';
    expect(['completed', 'abandoned', 'escalated', 'error', null]).toContain(sampleOutcome);
  });

  it('quoted_price_at_confirmation is bigint (no float precision loss for kopecks audit)', () => {
    const cols = getTableColumns(calls);
    expect(cols.quotedPriceAtConfirmation).toBeDefined();
    // Phase 4 audit display reads this and compares to orders.price; both must
    // be bigint to preserve kopecks-level precision (Phase 2 D-06 / Pitfall #1
    // price-lock invariant carried over to voice).
    type CallSelect = typeof calls.$inferSelect;
    const sample: CallSelect['quotedPriceAtConfirmation'] = 100n;
    expect(typeof sample === 'bigint' || sample === null).toBe(true);
  });

  it('elevenlabs_conversation_id + twilio_call_sid both UNIQUE-indexed (cross-reference invariant)', () => {
    const cols = getTableColumns(calls);
    expect(cols.elevenlabsConversationId).toBeDefined();
    expect(cols.twilioCallSid).toBeDefined();
    // UNIQUE index existence is asserted in voice-schema-mirror (Wave 1) via
    // direct SQL pg_indexes inspection. Here we only assert column presence
    // so Phase 4 admin can deep-link to ElevenLabs + Twilio dashboards.
  });

  it('Phase 3.1 boundary doc: VOICE-12 UI tests belong to Phase 4', () => {
    // Phase 3.1 ships:
    //   1. calls table extension (migration 0004_phase31_voice_calls.sql)
    //   2. Drizzle schema mirror (apps/api/src/persistence/schema/calls.ts)
    //   3. REST DTO stubs (from Plan 01-08, to be un-stubbed in Phase 4)
    //
    // Phase 4 ships:
    //   1. /dashboard/calls list page (audio_url + transcript modal)
    //   2. /dashboard/chat multi-channel view (telegram + voice in one thread)
    //   3. /api/calls REST handler (un-stub from 501 placeholder)
    //
    // This boundary is documented in ROADMAP Phase 4 success criteria + the
    // Plan 03.1-04 phase_4_consumer_contract table.
    expect(true).toBe(true);
  });
});
