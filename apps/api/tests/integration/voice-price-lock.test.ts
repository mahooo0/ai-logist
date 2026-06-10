// apps/api/tests/integration/voice-price-lock.test.ts
// Phase 3.1 Wave 2 will flip — asserts create-order ignores caller-supplied
// price arg; reads quoted_price from DB inside transaction (D-23 — Pitfall #1
// deepest layer on voice channel).
import { describe, test } from 'vitest';

const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('Phase 3.1 — price-lock invariant', () => {
  test.todo(
    'Wave 2 flip: create-order ignores caller-supplied price arg; reads quoted_price from DB inside transaction (D-23)'
  );
});
