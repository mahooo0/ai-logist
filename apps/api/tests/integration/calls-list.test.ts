import { describe, it } from 'vitest';

const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('Phase 4 NEW endpoint — GET /api/calls + /api/calls/:id', () => {
  it.todo('GET /api/calls returns paginated list sorted by created_at DESC — Wave 3 Plan 04-03');
  it.todo(
    'GET /api/calls filters by outcome (completed|abandoned|escalated|error) — Wave 3 Plan 04-03'
  );
  it.todo('GET /api/calls filters by lang (ru|ua) — Wave 3 Plan 04-03');
  it.todo('GET /api/calls filters by date range (from/to) — Wave 3 Plan 04-03');
  it.todo('GET /api/calls/:id returns call + linkedLead + linkedOrder — Wave 3 Plan 04-03');
  it.todo('GET /api/calls/:id returns 404 for missing — Wave 3 Plan 04-03');
});
