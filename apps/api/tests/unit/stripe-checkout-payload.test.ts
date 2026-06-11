// Phase 6 Wave 0 scaffold — flipped to live tests by subsequent waves.
// Decision: D-16
// Plan: 06-03 Wave 3
import { describe, test } from 'vitest';

describe('stripe-checkout-payload', () => {
  test.skip('D-16 createCheckoutSession builds price_data.unit_amount=kopecks + currency from config + idempotencyKey=order_<id>_v1', () => {
    // implementation lands in Plan 06-03
  });
});
