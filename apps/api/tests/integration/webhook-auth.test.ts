import { describe, test } from 'vitest';

const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)(
  'telegram webhook secret_token verification (TG-01, API-13)',
  () => {
    test.todo('401 on missing header; 401 on mismatch; 200 on match');
  }
);
