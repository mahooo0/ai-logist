// Phase 6 Wave 0 scaffold — flipped to live tests by subsequent waves.
// Decisions: D-15, D-20
// Plan: 06-04 Wave 4
import { describe, test } from 'vitest';

describe('admin-override', () => {
  test.skip('D-15+D-20 PATCH /api/orders/:id/status bypasses FSM and writes admin_override event with reason', () => {
    // implementation lands in Plan 06-04
  });

  test.skip('D-15 unauthorized request without X-Admin-Secret returns 401 when ADMIN_API_SECRET is configured', () => {
    // implementation lands in Plan 06-04
  });
});
