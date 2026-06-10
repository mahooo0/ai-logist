import { describe, test } from 'vitest';

/**
 * Phase 3.1 acceptance criteria stub markers — one per VOICE-* requirement.
 * Each marker becomes an it() block during the wave that flips it (see
 * tests/PHASE-3.1.md for the wave-by-wave schedule).
 *
 * Verifier grep gate: the literal token count in this file decreases
 * monotonically across Waves 0 → 4:
 *   12 (Wave 0) → 3 (after Wave 2 flips VOICE-03..11) → 1 (after Wave 3
 *   flips VOICE-01, VOICE-02) → 0 (after Wave 4 closes VOICE-12).
 *
 * Comment-hygiene rule: this docstring NEVER mentions the literal marker
 * function name. Phase 1 + Phase 2 + Phase 3 each burned this lesson — the
 * verifier uses naive `grep -c` so any prose mention inflates the count.
 */
describe('Phase 3.1 — Voice Channel acceptance criteria', () => {
  test.todo(
    'VOICE-01: ElevenLabs Conversational AI Agent (Turbo, RU+UA) registered + Twilio SIP-trunk configured'
  );
  test.todo('VOICE-02: Twilio number + webhook configured → Fastify /webhook/voice routing');
  test.todo(
    'VOICE-03: ElevenLabs Agent tools = Phase 2 registry (extractRequest, nearestTruck, calcPrice, createOrder, discount) — no duplication'
  );
  test.todo(
    'VOICE-04: Conversation FSM GREETING → COLLECT_REQUEST → MATCH → QUOTE → NEGOTIATE → CONFIRM → CREATE_ORDER → GOODBYE'
  );
  test.todo('VOICE-05: Inbound-only — no outbound voice endpoint registered');
  test.todo(
    'VOICE-06: Auto-detect RU/UA from first phrase, switch agent voice, sticky in clients.lang'
  );
  test.todo('VOICE-07: Call recording (audio_url) + transcript (jsonb) persisted to calls table');
  test.todo('VOICE-08: calls.outcome enum + linked_lead_id populated for completed call');
  test.todo(
    'VOICE-09: Price-lock — voice calc-price writes leads.quoted_price BEFORE return; create-order re-reads from DB'
  );
  test.todo(
    'VOICE-10: Anti-injection — system prompt ANTI_INJECTION_PREFIX present + tools-as-security-boundary structural defense'
  );
  test.todo(
    'VOICE-11: FSM-race protection — pg_advisory_xact_lock per conversation_id + idempotency via webhook_updates'
  );
  test.todo(
    'VOICE-12: calls table contract satisfies /dashboard/chat (Phase 4) consumer — audio_url + transcript + outcome + lang + linked_lead_id readable'
  );
});
