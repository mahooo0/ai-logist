// Phase 3 D-02 — grammY 1.43 bot factory. createBot is called by
// plugins/telegram.ts at app boot. Token validation is enforced both here
// (defensive) and at the plugin (early-skip path).
import { Bot, type Context } from 'grammy';
import type { AppConfig } from '../../config.js';

// Phase 3 uses the default Context — no flavors yet. Future plugins
// (sessions, conversations) would extend this.
export type TelegramContext = Context;

export function createBot(cfg: AppConfig): Bot<TelegramContext> {
  if (!cfg.TELEGRAM_BOT_TOKEN) {
    throw new Error('createBot: TELEGRAM_BOT_TOKEN is required');
  }
  // grammY 1.43 — default Bot constructor takes token + optional config.
  // botInfo: undefined forces bot.init() to fetch identity + validate token.
  const bot = new Bot<TelegramContext>(cfg.TELEGRAM_BOT_TOKEN, {
    botInfo: undefined,
  });
  return bot;
}
