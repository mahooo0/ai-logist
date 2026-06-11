// Phase 6 Wave 0 scaffold — flipped to live tests by subsequent waves.
// Decision: D-10
// Plan: 06-00 Wave 0 (requires manual migration apply before flip)
import { describe, test } from 'vitest';

describe('schema-introspect-phase6', () => {
  test.skip('D-10 pg_enum has DELIVERED_PENDING/AWAITING_PAYMENT/CANCELED in order_status; 14 new order_event_type values; stripe in webhook_source; orders.auto_progress_paused column exists', () => {
    // implementation lands in Plan 06-00 after psql migration apply
  });
});
