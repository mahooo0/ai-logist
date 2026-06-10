// apps/api/tests/_helpers/webhook-driver.ts
// Latency-measuring Telegram webhook poster for Phase 3 integration tests.
//
// CONTEXT 03-RESEARCH.md §"Two-Stage Webhook Handler" — TG-02 ack <100ms.
// Tests assert `elapsedMs < 100` via this helper. Uses `process.hrtime.bigint`
// for sub-millisecond precision (Date.now ms granularity would make a sub-100ms
// assertion noisy).
//
// Usage:
//   const { res, elapsedMs } = await postTelegramWebhook(app, payload, {
//     secretToken: config.TELEGRAM_WEBHOOK_SECRET,
//   });
//   expect(res.statusCode).toBe(200);
//   expect(elapsedMs).toBeLessThan(100);

import type { FastifyInstance, InjectOptions } from 'fastify';

export interface WebhookDriverOpts {
  /** If provided, sets the `x-telegram-bot-api-secret-token` header (TG-01 / API-13). */
  secretToken?: string;
  /** Additional headers merged after the defaults; can override. */
  extraHeaders?: Record<string, string>;
  /** Override the webhook URL (default `/webhook/telegram`). */
  url?: string;
}

export interface WebhookDriverResult {
  res: Awaited<ReturnType<FastifyInstance['inject']>>;
  elapsedMs: number;
}

/**
 * POST a Telegram update to the API's webhook route and return the response
 * paired with elapsed wall time in milliseconds.
 *
 * - `Content-Type: application/json` is always set
 * - `x-telegram-bot-api-secret-token` is set iff `opts.secretToken` provided
 *   (omit to test the "missing header" 401 branch)
 * - `extraHeaders` merge LAST, so they win against the defaults — useful for
 *   the "wrong secret" branch
 */
export async function postTelegramWebhook(
  app: FastifyInstance,
  payload: unknown,
  opts: WebhookDriverOpts = {}
): Promise<WebhookDriverResult> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(opts.secretToken ? { 'x-telegram-bot-api-secret-token': opts.secretToken } : {}),
    ...(opts.extraHeaders ?? {}),
  };

  const inject: InjectOptions = {
    method: 'POST',
    url: opts.url ?? '/webhook/telegram',
    payload: payload as never,
    headers,
  };

  const start = process.hrtime.bigint();
  const res = await app.inject(inject);
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;

  return { res, elapsedMs };
}
