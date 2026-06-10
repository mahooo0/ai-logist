import { describe, it } from 'vitest';

const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

// API-06 UNION query — MOST IMPORTANT Phase 4 backend test.
// Seeds 2 messages (telegram) + 1 call with 3 transcript turns → asserts 5 rows
// sorted by created_at ASC, with voice turns carrying callId + timestampMs + audioUrl.
describe.skipIf(!dockerAvailable)('Phase 4 API-06 — clients/:id/messages UNION', () => {
  it.todo(
    'UNION returns telegram messages + voice transcript turns chronologically — Wave 3 Plan 04-03'
  );
  it.todo(
    'voice turn role mapping: speaker=agent → role=ai, speaker=caller → role=client — Wave 3 Plan 04-03'
  );
  it.todo('voice turn carries callId + timestampMs (offset in ms) + audioUrl — Wave 3 Plan 04-03');
  it.todo('returns empty array for client with no msgs and no calls — Wave 3 Plan 04-03');
  it.todo(
    'defensive: handles transcript turns with missing timestamp_ms via idx-based fallback — Wave 3 Plan 04-03'
  );
});
