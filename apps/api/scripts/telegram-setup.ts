// Phase 3 Plan 03-05 — `pnpm --filter @ai-logist/api telegram:setup` entry.
//
// Idempotent webhook registration with Telegram. Pre-conditions:
//   - TELEGRAM_BOT_TOKEN
//   - TELEGRAM_WEBHOOK_SECRET
//   - TELEGRAM_BOT_USERNAME
//   - TELEGRAM_PUBLIC_URL (e.g. https://xxx.ngrok.io)
//
// Boots the full Fastify app (so app.bot is decorated by telegramPlugin),
// calls setupWebhook, prints the registered URL as JSON, then closes the app
// cleanly. Exits 1 with a stack trace on any failure.
import { buildApp } from '../src/app.js';
import { setupWebhook } from '../src/channels/telegram/setup.js';
import { config, requireTelegramConfig } from '../src/config.js';

async function main(): Promise<void> {
  requireTelegramConfig();
  if (!config.TELEGRAM_PUBLIC_URL) {
    throw new Error('TELEGRAM_PUBLIC_URL required (e.g. https://xxx.ngrok.io)');
  }
  const app = await buildApp();
  const bot = (app as typeof app & { bot?: import('grammy').Bot }).bot;
  if (!bot) {
    throw new Error('app.bot not decorated — check telegram plugin logs');
  }
  await setupWebhook({
    bot,
    publicUrl: config.TELEGRAM_PUBLIC_URL,
    secretToken: config.TELEGRAM_WEBHOOK_SECRET as string,
  });
  console.log(
    JSON.stringify(
      {
        ok: true,
        url: `${config.TELEGRAM_PUBLIC_URL.replace(/\/$/, '')}/webhook/telegram`,
      },
      null,
      2
    )
  );
  await app.close();
}

main().catch((err) => {
  console.error('telegram-setup failed', err);
  process.exit(1);
});
