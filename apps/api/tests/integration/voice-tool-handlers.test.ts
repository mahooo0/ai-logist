// apps/api/tests/integration/voice-tool-handlers.test.ts
// Phase 3.1 Wave 2 will flip — asserts 5 voice tool handlers wrap Phase 2
// tools (NO duplication), verify HMAC, enforce price-lock + advisory lock,
// and complete in <500ms (Pitfall #3 ElevenLabs filler-cliff latency budget).
import { describe, test } from 'vitest';

const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('Phase 3.1 — voice tool handlers integration', () => {
  test.todo('Wave 2 flip: 5 voice tools wrap Phase 2 + HMAC verify + price-lock + <500ms');
});
