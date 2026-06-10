import { describe, it } from 'vitest';

// Docker gate — testcontainers requires Docker daemon.
const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('Phase 4 API-03 — GET /api/leads', () => {
  it.todo(
    'returns filtered list by stage (NEW/QUALIFIED/MATCHED/QUOTED/AGREED/ORDER_CREATED/IN_PROGRESS/DONE/LOST) — Wave 3 Plan 04-03'
  );
  it.todo('returns filtered list by channel (telegram|voice|call) — Wave 3 Plan 04-03');
  it.todo('paginates with limit/offset defaults 50/0 — Wave 3 Plan 04-03');
});
