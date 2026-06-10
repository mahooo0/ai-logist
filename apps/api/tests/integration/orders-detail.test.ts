import { describe, it } from 'vitest';

const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('Phase 4 API-04 — GET /api/orders/:id (detail)', () => {
  it.todo(
    'returns order + events + client + fromCity + toCity + truck in ONE response — Wave 3 Plan 04-03'
  );
  it.todo('returns 404 for missing order — Wave 3 Plan 04-03');
  it.todo('events sorted chronologically — Wave 3 Plan 04-03');
});
