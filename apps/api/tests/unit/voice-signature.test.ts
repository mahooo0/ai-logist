// apps/api/tests/unit/voice-signature.test.ts
// Phase 3.1 Wave 1 — asserts HMAC-SHA256 verify of ElevenLabs callbacks via
// node:crypto timingSafeEqual round-trip, tampered body rejection, missing
// header rejection, and wrong-secret rejection (CONTEXT D-06, Pitfall 5).
import { describe, expect, it } from 'vitest';
import { verifyElevenLabsSignature } from '../../src/channels/voice/signature.js';
import { signElevenLabsBody } from '../_helpers/voice-mock.js';

const SECRET = 'test-secret-xyz';
const BODY = Buffer.from(
  JSON.stringify({ conversation_id: 'conv_test', sequence: 1, parameters: {} })
);

describe('Phase 3.1 — HMAC signature verification', () => {
  it('verifies a valid sha256=<hex> header', () => {
    const sig = signElevenLabsBody(BODY, SECRET);
    expect(verifyElevenLabsSignature(BODY, sig, SECRET)).toBe(true);
  });

  it('rejects a tampered body with the original signature', () => {
    const sig = signElevenLabsBody(BODY, SECRET);
    const tampered = Buffer.from(
      JSON.stringify({ conversation_id: 'conv_test', sequence: 1, parameters: { evil: true } })
    );
    expect(verifyElevenLabsSignature(tampered, sig, SECRET)).toBe(false);
  });

  it('rejects a missing header', () => {
    expect(verifyElevenLabsSignature(BODY, undefined, SECRET)).toBe(false);
  });

  it('rejects a signature computed with a different secret', () => {
    const sig = signElevenLabsBody(BODY, 'other-secret');
    expect(verifyElevenLabsSignature(BODY, sig, SECRET)).toBe(false);
  });

  it('accepts a header without the sha256= prefix (bare hex)', () => {
    const sig = signElevenLabsBody(BODY, SECRET).replace(/^sha256=/, '');
    expect(verifyElevenLabsSignature(BODY, sig, SECRET)).toBe(true);
  });
});
