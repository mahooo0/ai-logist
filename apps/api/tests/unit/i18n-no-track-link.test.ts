import { describe, test } from 'vitest';

// NOTIF-02 scaffold — Wave 3 (Plan 05-03) flips the pending marker to it()
// asserting that grep -E "/track/|trackingUrl|public_token" against
// apps/api/src/lib/i18n.ts returns zero matches. Public tracking link is
// deferred to v2 PUBLIC_V2-* and must not leak into notification templates.
describe('NOTIF-02: no /track/ link in i18n.ts', () => {
  test.todo(
    'grep -E "/track/|trackingUrl|public_token" apps/api/src/lib/i18n.ts returns no matches'
  );
});
