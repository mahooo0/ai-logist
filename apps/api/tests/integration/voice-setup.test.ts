// apps/api/tests/integration/voice-setup.test.ts
// Phase 3.1 Wave 3 will flip — asserts apps/api/scripts/voice-setup.ts is
// idempotent (agent upsert + twilio number config) using MockElevenLabsClient
// + MockTwilioClient from tests/_helpers/voice-mock.ts (D-33).
import { describe, test } from 'vitest';

const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('Phase 3.1 — voice:setup bootstrap script', () => {
  test.todo(
    'Wave 3 flip: voice-setup.ts idempotent agent upsert + twilio number config (mocked SDKs)'
  );
});
