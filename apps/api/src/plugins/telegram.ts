// Phase 3 D-02 — Fastify plugin decorating app.bot when TELEGRAM_BOT_TOKEN is
// configured. Boot-with-bot-disabled is intentional (RESEARCH Open Question §1):
// the API still comes up for non-Telegram routes if the token is missing, but
// any webhook hit returns 503 / 401 via guards at the route handler.
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { Bot } from 'grammy';
import { createBot } from '../channels/telegram/bot.js';
import { config } from '../config.js';

declare module 'fastify' {
  interface FastifyInstance {
    bot: Bot;
  }
}

export const telegramPlugin = fp(
  async (app: FastifyInstance) => {
    if (!config.TELEGRAM_BOT_TOKEN) {
      app.log.warn('telegram: TELEGRAM_BOT_TOKEN missing — bot disabled');
      return;
    }
    const bot = createBot(config);
    // grammY needs init() before processing updates outside of bot.start().
    // init() fetches bot info (id, username) and validates the token.
    await bot.init();
    app.log.info({ username: bot.botInfo.username }, 'telegram: bot initialized');
    app.decorate('bot', bot);

    // Phase 3 Plan 03-03 — wire bot.command + bot.callbackQuery handlers AFTER
    // bot.init() so botInfo is populated when handlers fire.
    await import('../channels/telegram/handlers.js').then(({ registerTelegramHandlers }) =>
      registerTelegramHandlers(bot, app)
    );

    // Voice-confirmation demo flow — register per-state FSM arrival hooks
    // (dial outbound on AT_LOADING / DELIVERED_PENDING; sendPaymentLink on
    // AWAITING_PAYMENT) once the bot decorator is available.
    await import('../pipeline/lifecycle/arrival-hooks.js').then(
      ({ initOrderArrivalHooks }) => initOrderArrivalHooks(app, bot)
    );

    app.addHook('onClose', async () => {
      await bot.stop();
    });
  },
  { name: 'telegram', dependencies: ['db'] }
);

export default telegramPlugin;
