# Phase 3 Test Harness — Usage

Wave 0 shipped the Telegram channel test infrastructure: an in-memory bot mock,
a latency-measuring webhook driver, canonical Telegram Update fixtures, and 9
`test.todo()` markers covering every Phase 3 requirement (API-13, API-15,
TG-01..07). Waves 1-5 flip those todos to real `it(...)` assertions.

## Helpers (`apps/api/tests/_helpers/`)

| File                 | Provides                                                                       |
| -------------------- | ------------------------------------------------------------------------------ |
| `telegram-mock.ts`   | `createMockBot()` → `{ bot, sent, callbackQueries }` — records sends + answers |
| `webhook-driver.ts`  | `postTelegramWebhook(app, payload, opts)` → `{ res, elapsedMs }`               |
| `test-db.ts`         | (Phase 1) testcontainers PostGIS 17-3.5 boot/teardown                          |
| `integration-env.ts` | (Phase 2) DATABASE_URL/REDIS_URL localhost defaults for static imports         |

## MockTelegramBot

`createMockBot()` returns a structural mock of the grammY 1.43 Bot surface
used by Phase 3 — `bot.api.sendMessage`, `bot.api.getMe`, `bot.api.setWebhook`,
`bot.api.answerCallbackQuery`, `bot.api.editMessageReplyMarkup`, plus
`botInfo`, `init()`, `handleUpdate()`, `stop()`. NEVER hits the network.

**When to use:**

- Unit tests that assert keyboard payload structure (`replyMarkup`)
- Integration tests that assert "did the bot try to send X to chat Y?"
- Driver-confirmation tests where `truck.driver_telegram_id` may be null
- Manager-intercept tests where the bot should stay silent

**Example — wire into a Fastify app via decorator:**

```ts
import { createMockBot } from '../_helpers/telegram-mock.js';

const mock = createMockBot();
app.decorate('bot', mock.bot);
// ... exercise route ...
expect(mock.sent).toHaveLength(1);
expect(mock.sent[0].chatId).toBe('555000001');
expect(mock.sent[0].replyMarkup).toBeDefined();
expect(mock.callbackQueries).toHaveLength(1);
```

**Real bot is reserved for the `test:tg` smoke project** (Wave 5 adds), gated
on `TELEGRAM_BOT_TOKEN`. In CI we never make a real API call.

## webhook-driver

`postTelegramWebhook(app, payload, opts)` wraps `app.inject({ method: 'POST',
url: '/webhook/telegram', payload, headers })` with `process.hrtime.bigint()`
timing — sub-millisecond precision lets the TG-02 `expect(elapsedMs <
100)` assertion be tight without flakes.

**When to use:**

- Latency assertion (TG-02): "ack within 100ms"
- Idempotency (TG-02): "10× same `update_id` → exactly 1 lead row"
- Secret-token verification (TG-01 / API-13): no header / wrong header → 401

**Example — latency assertion:**

```ts
import { postTelegramWebhook } from '../_helpers/webhook-driver.js';
import fixtures from '../fixtures/telegram-updates.json' with { type: 'json' };

const { res, elapsedMs } = await postTelegramWebhook(
  app,
  fixtures.textKyivLviv,
  { secretToken: config.TELEGRAM_WEBHOOK_SECRET }
);

expect(res.statusCode).toBe(200);
expect(elapsedMs).toBeLessThan(100);
```

**Example — auth assertion:**

```ts
// Missing header → 401
const noAuth = await postTelegramWebhook(app, fixtures.textKyivLviv);
expect(noAuth.res.statusCode).toBe(401);

// Wrong secret → 401
const badAuth = await postTelegramWebhook(app, fixtures.textKyivLviv, {
  secretToken: 'wrong-secret',
});
expect(badAuth.res.statusCode).toBe(401);

// Correct secret → 200
const ok = await postTelegramWebhook(app, fixtures.textKyivLviv, {
  secretToken: config.TELEGRAM_WEBHOOK_SECRET,
});
expect(ok.res.statusCode).toBe(200);
```

## telegram-updates fixtures

`apps/api/tests/fixtures/telegram-updates.json` ships 11 canonical Telegram
[Update](https://core.telegram.org/bots/api#update) payloads. All
`callback_query.data` follow the D-13 format `<action>:<id>`. The placeholder
lead UUID is `00000000-0000-4000-8000-000000000001` and the placeholder order
UUID is `00000000-0000-4000-8000-0000000000a1`.

| Key                    | Shape                                       | Purpose                                                                |
| ---------------------- | ------------------------------------------- | ---------------------------------------------------------------------- |
| `textKyivLviv`         | `message.text = "Киев-Львов, 18 тонн, тент"` | Canonical client first message → triggers extract+match+price-lock     |
| `textConfirm`          | `message.text = "да, подтверждаю"`            | Confirmation shortcut from QUOTED → AGREED → ORDER_CREATED            |
| `textShortOk`          | `message.text = "ок"`                         | <20-char path — sticky-lang detection NO-OP                            |
| `callbackConfirm`      | `callback_query.data = "confirm:<leadId>"`  | Inline keyboard tap → synthetic "да" inbound                          |
| `callbackReject`       | `callback_query.data = "reject:<leadId>"`   | Inline keyboard tap → synthetic "нет" inbound                         |
| `callbackChange`       | `callback_query.data = "change:<leadId>"`   | Inline keyboard tap → "изменить" / clarification                      |
| `callbackDriverAccept` | `callback_query.data = "driver_accept:<id>"` | TG-05 driver Принять — order DRIVER_ASSIGNED confirmation              |
| `callbackDriverDecline`| `callback_query.data = "driver_decline:<id>"`| TG-05 driver Отказаться — order CLOSED + lead LOST                     |
| `commandStart`         | `message.text = "/start"`                    | Bot command — RU greeting                                              |
| `commandHelp`          | `message.text = "/help"` (language_code=uk) | Bot command — UA help (or both if lang unknown)                        |
| `sticker`              | `message.sticker = {...}`                    | Non-text — polite refusal: "Я понимаю только текстовые сообщения..."   |

**Import pattern (Node 22 native ESM with-attributes):**

```ts
import fixtures from '../fixtures/telegram-updates.json' with { type: 'json' };
const payload = fixtures.textKyivLviv;
```

## Real bot smoke (TELEGRAM_BOT_TOKEN gated)

A future Wave 5 task adds `pnpm --filter @ai-logist/api test:tg` — a smoke
suite that boots a real grammY `Bot` and validates `bot.api.getMe()`. Skipped
unless `TELEGRAM_BOT_TOKEN` env is present. CI never runs it; developers run it
locally before merging the foundation plan.

```bash
TELEGRAM_BOT_TOKEN=... pnpm --filter @ai-logist/api test:tg
```

This is the ONLY place a real Telegram API call lives. Every other test uses
`createMockBot()`.

## Flipping a `test.todo()` to a real assertion

`apps/api/tests/unit/phase-3-stubs.test.ts` carries exactly **9**
`test.todo()` markers — one per Phase 3 requirement. The flip schedule:

| Wave | Plan | Flips                                       |
| ---- | ---- | ------------------------------------------- |
| 1    | 03-01 | (none — foundation only)                   |
| 2    | 03-02 | TG-01, TG-02, API-13, API-15               |
| 3    | 03-03 | TG-03, TG-04                                |
| 4    | 03-04 | TG-05, TG-07                                |
| 5    | 03-05 | TG-06 (and final stub-count gate → 0)      |

Counting protocol: the verifier greps for the literal substring `test.todo` in
phase-3-stubs.test.ts; this file MUST contain exactly 9 such call-sites after
Wave 0, and exactly 0 after Wave 5. Comments and docstrings that mention the
marker by name break the gate — keep prose hygienic.

## Integration scaffolds

Wave 0 also ships 9 integration test scaffolds (8 + voice-stub) under
`apps/api/tests/integration/` — each carries a `describe.skipIf(!dockerAvailable)`
guard and one `test.todo()` placeholder. Wave 2..5 flip them in:

- `webhook-idempotency.test.ts`  — TG-02 (10× → 1 lead)
- `webhook-latency.test.ts`      — TG-02 (<100ms ack)
- `webhook-auth.test.ts`         — TG-01 / API-13 (secret_token)
- `webhook-voice-stub.test.ts`   — API-15 (200 ack for /webhook/voice)
- `telegram-adapter.test.ts`     — TG-01 / TG-02 (synthetic phone, non-text)
- `telegram-keyboards.test.ts`   — TG-03 / TG-04 (RU/UA inline keyboard)
- `driver-confirmation.test.ts`  — TG-05 (real send vs stub)
- `client-notifications.test.ts` — TG-07 (FSM post-commit notify)
- `manager-intercept.test.ts`    — TG-06 (intercept / release flow)

Skipping is automatic on Docker-less runners; Phase 1 set up `dockerAvailable`
in `tests/_helpers/test-db.ts`.
