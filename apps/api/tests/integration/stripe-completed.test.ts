// Phase 6 Wave 0 scaffold — flipped to live tests by subsequent waves.
// Decision: D-18
// Plan: 06-03 Wave 3
import { describe, test } from 'vitest';

describe('stripe-completed', () => {
  test.skip('D-18 POST /webhook/stripe with valid checkout.session.completed event transitions order AWAITING_PAYMENT → CLOSED', () => {
    // implementation lands in Plan 06-03
  });
});
