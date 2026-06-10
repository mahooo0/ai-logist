import { describe, test } from 'vitest';

const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('telegram update→inbound adapter (TG-01, TG-02)', () => {
  test.todo(
    'find-or-create client by telegram_id; synthetic phone tg:<id>; non-text returns polite refusal'
  );
});
