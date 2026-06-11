// Phase 6 Wave 0 scaffold — flipped to live tests by subsequent waves.
// Decision: D-18
// Plan: 06-03 Wave 3
import { describe, test } from 'vitest';

describe('stripe-webhook-sig', () => {
  test.skip('D-18 valid signature returns Stripe.Event', () => {
    // implementation lands in Plan 06-03
  });

  test.skip('D-18 tampered body → 400', () => {
    // implementation lands in Plan 06-03
  });
});
