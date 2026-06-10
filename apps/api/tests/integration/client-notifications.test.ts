import { describe, test } from 'vitest';

const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('client status notifications (TG-07)', () => {
  test.todo('transitionOrder DRIVER_ASSIGNED onSuccess hook calls notifyClient with i18n template');
});
