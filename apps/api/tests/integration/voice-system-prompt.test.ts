// apps/api/tests/integration/voice-system-prompt.test.ts
// Phase 3.1 Wave 3 will flip — asserts apps/api/src/channels/voice/elevenlabs-agent-config.md
// contains ANTI_INJECTION_PREFIX + RU+UA greeting templates + tools registry (D-32).
import { describe, test } from 'vitest';

const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('Phase 3.1 — ElevenLabs Agent system prompt', () => {
  test.todo(
    'Wave 3 flip: elevenlabs-agent-config.md contains ANTI_INJECTION_PREFIX + RU+UA greeting templates + tools registry'
  );
});
