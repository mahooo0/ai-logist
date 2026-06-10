// apps/api/tests/unit/voice-signature.test.ts
// Phase 3.1 Wave 1 will flip — asserts HMAC-SHA256 verify of ElevenLabs
// callbacks via timingSafeEqual (D-06, Pitfall 5 lowercase header name).
import { describe, test } from 'vitest';

describe('Phase 3.1 — HMAC signature verification', () => {
  test.todo(
    'Wave 1 flip: verifyElevenLabsSignature(valid) → true; (tampered) → false; (missing header) → false'
  );
});
