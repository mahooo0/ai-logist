// apps/api/tests/integration/voice-fsm-concurrency.test.ts
// Phase 3.1 Wave 2 will flip — asserts pg_advisory_xact_lock per conversation_id
// + idempotency via webhook_updates(source='elevenlabs', external_id) (D-24/D-25).
import { describe, test } from 'vitest';

const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('Phase 3.1 — per-conversation advisory lock', () => {
  test.todo(
    'Wave 2 flip: 100x concurrent create-order on same conversation_id → exactly 1 success + idempotency replay 10x → 1 effect'
  );
});
