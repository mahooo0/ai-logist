import { describe, test } from 'vitest';

const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('voice webhook stub (API-15)', () => {
  test.todo('POST /webhook/voice returns 200 ack');
});
