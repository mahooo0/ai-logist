// apps/api/tests/unit/voice-state.test.ts
// Phase 3.1 Wave 1 will flip — asserts Redis voice state CRUD round-trip with
// bigint replacer/reviver + TTL 3600s + mergeVoiceState partial (D-18/D-19).
import { describe, test } from 'vitest';

describe('Phase 3.1 — Redis voice state CRUD', () => {
  test.todo(
    'Wave 1 flip: setVoiceState/getVoiceState round-trip + bigint replacer/reviver + TTL 3600s + mergeVoiceState partial'
  );
});
