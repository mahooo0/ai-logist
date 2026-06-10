import { describe, test } from 'vitest';

const dockerAvailable = process.env.AI_LOGIST_NO_DOCKER !== '1';

describe.skipIf(!dockerAvailable)('driver Telegram notification (TG-05)', () => {
  test.todo(
    'driver_telegram_id present → bot.api.sendMessage with driverKeyboard; null → stub auto-accept log'
  );
});
