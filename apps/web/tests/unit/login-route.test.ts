import { describe, it } from 'vitest';

describe('Phase 4 ADMIN-02 — login + logout routes', () => {
  it.todo(
    'POST /auth/v1/login with valid creds sets al_session cookie + returns {ok:true} — Wave 2 Plan 04-02'
  );
  it.todo('POST /auth/v1/login with bad password returns 401 — Wave 2 Plan 04-02');
  it.todo('POST /auth/v1/login with bad username returns 401 — Wave 2 Plan 04-02');
  it.todo('POST /auth/v1/logout clears al_session cookie — Wave 2 Plan 04-02');
});
