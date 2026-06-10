import { describe, it } from 'vitest';

const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('Phase 4 API-04 — GET /api/orders (joined list)', () => {
  it.todo(
    'returns OrderListItem[] with fromCityName + toCityName + clientName + channel joined — Wave 3 Plan 04-03'
  );
  it.todo('filters by status + channel — Wave 3 Plan 04-03');
  it.todo('sorts by createdAt DESC — Wave 3 Plan 04-03');
});
