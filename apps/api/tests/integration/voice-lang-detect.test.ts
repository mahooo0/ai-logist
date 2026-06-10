// apps/api/tests/integration/voice-lang-detect.test.ts
// Phase 3.1 Wave 2 will flip — asserts lang-detected webhook sets calls.lang
// AND clients.lang ONCE (skip if clients.lang already set, sticky per D-16/D-17).
import { describe, test } from 'vitest';

const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('Phase 3.1 — sticky language detection via voice', () => {
  test.todo(
    'Wave 2 flip: lang-detected webhook sets calls.lang AND clients.lang ONCE (skip if clients.lang already set)'
  );
});
