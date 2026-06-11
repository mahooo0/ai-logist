// Phase 6 Wave 0 scaffold — flipped to live tests by subsequent waves.
// Decision: D-21
// Plan: 06-04 Wave 4
import { describe, test } from 'vitest';

describe('ticker-pause', () => {
  test.skip('D-21 POST /api/orders/:id/ticker {paused:true} sets orders.auto_progress_paused=true; ticker SKIPs the row', () => {
    // implementation lands in Plan 06-04
  });
});
