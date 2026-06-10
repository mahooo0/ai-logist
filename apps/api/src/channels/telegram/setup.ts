// Phase 3 Plan 03-05 D-08 / RESEARCH Code Block 14 — webhook setup helper.
//
// Idempotent: running twice is safe (Telegram returns true the second time and
// drops any pending updates again). Called from:
//   1. apps/api/scripts/telegram-setup.ts (pnpm telegram:setup CLI entry)
//   2. apps/api/src/app.ts at boot when TELEGRAM_SET_WEBHOOK_ON_BOOT=true
//
// The trailing slash on publicUrl is normalised so callers can pass either
// "https://x.ngrok.io" or "https://x.ngrok.io/" — the final URL is always
// `<base>/webhook/telegram`.
import type { Bot } from 'grammy';

export interface SetupWebhookArgs {
  bot: Bot;
  publicUrl: string;
  secretToken: string;
}

export async function setupWebhook(args: SetupWebhookArgs): Promise<void> {
  const url = `${args.publicUrl.replace(/\/$/, '')}/webhook/telegram`;
  await args.bot.api.setWebhook(url, {
    secret_token: args.secretToken,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true,
    max_connections: 40,
  });
}
