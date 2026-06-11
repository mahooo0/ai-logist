import { describe, test } from 'vitest';

// POLISH-02 scaffold — Wave 4 (Plan 05-04) flips the pending marker to 5
// it() blocks asserting POST /api/admin/simulate-call replays each of the
// 5 voice-scenarios.json fixtures (ru_happy_path, ua_happy_path,
// injection_attempt, ambiguous_clarification, abandon_mid_call) end-to-end
// through Phase 3.1 voice tool handlers IN-PROCESS — no Twilio + no
// ElevenLabs external calls. Each scenario produces a fake calls row +
// linked lead + (for happy paths) an order row.
const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)(
  'POLISH-02: POST /api/admin/simulate-call replays scenarios',
  () => {
    test.todo('all 5 voice-scenarios produce call+lead+order via in-process tool handlers');
  }
);
