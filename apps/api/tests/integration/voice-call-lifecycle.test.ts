// apps/api/tests/integration/voice-call-lifecycle.test.ts
// Phase 3.1 Wave 2 will flip — asserts call-start inserts calls row + call-end
// UPDATE idempotent + transcript persisted (D-14/D-15).
import { describe, test } from 'vitest';

const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('Phase 3.1 — call-start/call-end/lang-detected lifecycle', () => {
  test.todo(
    'Wave 2 flip: call-start inserts calls row + call-end UPDATE idempotent + transcript persisted'
  );
});
