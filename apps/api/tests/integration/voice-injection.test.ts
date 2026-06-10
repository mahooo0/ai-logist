// apps/api/tests/integration/voice-injection.test.ts
// Phase 3.1 Wave 2 will flip — asserts replay of injection_attempt scenario
// from voice-scenarios.json produces no 1-RUB order; price equals
// calcPrice.default (D-12 + Pitfall #11 closure on voice channel).
import { describe, test } from 'vitest';

const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('Phase 3.1 — prompt injection structural defense', () => {
  test.todo(
    'Wave 2 flip: replay injection_attempt scenario → no 1-RUB order created; price = calcPrice.default'
  );
});
