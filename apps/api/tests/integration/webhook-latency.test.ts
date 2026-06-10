import { describe, test } from 'vitest';

const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('telegram webhook latency (TG-02)', () => {
  test.todo('ack within 100ms via postTelegramWebhook elapsedMs');
});
