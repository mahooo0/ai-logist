import { describe, test } from 'vitest';

// NOTIF-01 scaffold — Wave 3 (Plan 05-03) flips the pending marker to 3
// it() blocks asserting each ORDER_TRANSITION (DRIVER_ASSIGNED + IN_TRANSIT
// + DELIVERED) fires notifyClient post-commit via the order-fsm.ts
// onSuccess hook. Mock bot captures sent messages; payload contract
// asserted against renderNotificationTemplate(transition, row, lang).
// Idempotency confirmed via order_events UNIQUE(order_id, type) gate
// (Phase 1 schema constraint — exactly one notification per transition).
const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)(
  'NOTIF-01: ORDER_TRANSITIONS fire notifyClient post-commit',
  () => {
    test.todo(
      'DRIVER_ASSIGNED + IN_TRANSIT + DELIVERED transitions all fire notifyClient post-commit'
    );
  }
);
