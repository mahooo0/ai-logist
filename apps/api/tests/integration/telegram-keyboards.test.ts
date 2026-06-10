import { describe, test } from 'vitest';

const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('telegram inline keyboards (TG-03, TG-04)', () => {
  test.todo('quote keyboard sent after QUOTED with RU/UA labels and price from DB');
});
