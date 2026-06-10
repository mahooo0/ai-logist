import { describe, test } from 'vitest';

const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('manager intercept endpoints (TG-06)', () => {
  test.todo(
    'intercept flips manager_active; subsequent inbound persists but skips intake; release returns control to bot'
  );
});
