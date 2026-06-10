import { describe, it } from 'vitest';

const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('Phase 4 API-09 — GET /api/analytics/kpi (extended)', () => {
  it.todo('returns calls.total + calls.answered for window=week — Wave 3 Plan 04-03');
  it.todo(
    'returns extended fields: avgCallDurationS + byChannel{voice,telegram} + conversionFunnel — Wave 3 Plan 04-03'
  );
  it.todo(
    'conversionFunnel values are monotonically non-increasing (calls >= answered >= leadsCreated >= ordersConfirmed >= delivered) — Wave 3 Plan 04-03'
  );
  it.todo(
    'revenue.amount is bigint serialized as string (precision preserved) — Wave 3 Plan 04-03'
  );
  it.todo('window=day|week|month adjusts SINCE bound correctly — Wave 3 Plan 04-03');
});
