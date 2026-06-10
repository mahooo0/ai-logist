// apps/api/tests/_helpers/telegram-mock.ts
// CONTEXT 03-RESEARCH.md Code Block 13 — verbatim mock + callback recorder extension.
//
// In-memory bot mock for unit + integration tests. Records sends and callback
// responses; NEVER hits the network. Use createMockBot() in tests that
// exercise Phase 3 outbound paths (keyboard sends, driver notifications,
// client notifications, manager-message). Wire it into app via
// `app.decorate('bot', bot)` from the test setup.
//
// Wave 1 will install grammy and add a real Bot — this mock implements the
// structural surface required by Phase 3 routes WITHOUT importing grammy.

export interface SentMessage {
  chatId: string | number;
  text: string;
  replyMarkup?: unknown;
  parseMode?: string;
}

export interface CallbackQueryRecord {
  callbackQueryId: string;
  text?: string;
  showAlert?: boolean;
}

export interface MockBotApi {
  sendMessage(
    chatId: string | number,
    text: string,
    opts?: { reply_markup?: unknown; parse_mode?: string }
  ): Promise<{
    message_id: number;
    chat: { id: string | number };
    text: string;
    date: number;
  }>;
  getMe(): Promise<{ id: number; is_bot: true; first_name: string; username: string }>;
  setWebhook(...args: unknown[]): Promise<true>;
  answerCallbackQuery(
    callbackQueryId: string,
    opts?: { text?: string; show_alert?: boolean }
  ): Promise<true>;
  editMessageReplyMarkup(...args: unknown[]): Promise<true>;
}

export interface MockBot {
  api: MockBotApi;
  botInfo: { id: number; is_bot: true; first_name: string; username: string };
  init(): Promise<void>;
  handleUpdate(update: unknown): Promise<void>;
  stop(): Promise<void>;
}

export interface MockBotHandle {
  bot: MockBot;
  sent: SentMessage[];
  callbackQueries: CallbackQueryRecord[];
}

/**
 * Factory for an in-memory Telegram bot suitable for Phase 3 tests.
 *
 * The returned `bot` exposes `bot.api.*` matching grammY 1.43's surface used
 * by Phase 3 production code. All sends are recorded on `sent[]` and all
 * `answerCallbackQuery` invocations are recorded on `callbackQueries[]`.
 *
 * NEVER hits the network. Safe to use in unit and integration tests; the
 * `test:tg` smoke project boots a real grammY Bot under a TELEGRAM_BOT_TOKEN gate.
 */
export function createMockBot(): MockBotHandle {
  const sent: SentMessage[] = [];
  const callbackQueries: CallbackQueryRecord[] = [];
  const botInfo = {
    id: 999,
    is_bot: true as const,
    first_name: 'TestBot',
    username: 'test_bot',
  };

  const api: MockBotApi = {
    async sendMessage(chatId, text, opts) {
      sent.push({
        chatId,
        text,
        replyMarkup: opts?.reply_markup,
        parseMode: opts?.parse_mode,
      });
      return {
        message_id: sent.length,
        chat: { id: chatId },
        text,
        date: Math.floor(Date.now() / 1000),
      };
    },
    async getMe() {
      return { ...botInfo };
    },
    async setWebhook() {
      return true;
    },
    async answerCallbackQuery(callbackQueryId, opts) {
      callbackQueries.push({
        callbackQueryId,
        text: opts?.text,
        showAlert: opts?.show_alert,
      });
      return true;
    },
    async editMessageReplyMarkup() {
      return true;
    },
  };

  const bot: MockBot = {
    api,
    botInfo,
    init: async () => {
      /* no-op */
    },
    handleUpdate: async (_update: unknown) => {
      /* no-op — production tests should call adapter directly */
    },
    stop: async () => {
      /* no-op */
    },
  };

  return { bot, sent, callbackQueries };
}
