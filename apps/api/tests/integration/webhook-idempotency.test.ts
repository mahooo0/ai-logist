import { describe, test } from 'vitest';

const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('telegram webhook idempotency (TG-02)', () => {
  test.todo('10× same update_id → 1 lead row');
});
