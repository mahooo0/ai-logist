# Phase 3: Telegram Channel — Discussion Log

> **Audit trail only.** Decisions captured in 03-CONTEXT.md.

**Date:** 2026-06-09
**Phase:** 03-telegram-channel
**Mode:** auto (recommended option selected for every question)
**Areas auto-resolved (12):** grammY setup, webhook auth, idempotency strategy, async processing pattern, adapter pattern, client identification, inline keyboards, callback handler, driver confirmation, manager intercept, notifications, bot commands

---

## grammY Setup
**Auto:** grammY 1.43 via Fastify plugin, Bot factory in `apps/api/src/channels/telegram/bot.ts`, injected into app context.

## Webhook Authentication
**Auto:** Secret-token via `X-Telegram-Bot-Api-Secret-Token` header, env `TELEGRAM_WEBHOOK_SECRET` (openssl rand -hex 32), 401 on mismatch.

## Idempotency Strategy
**Auto:** Reuse existing `webhook_updates` table (UNIQUE(source, external_id)) — `ON CONFLICT DO NOTHING` → if rowCount=0, return 200 silently.

## Async Processing
**Auto:** Inline fire-and-forget (`processTelegramUpdate(payload).catch(logError)` without await) → return 200 in <100ms. BullMQ deferred to v2.

## Adapter Pattern
**Auto:** `telegramUpdateToInbound` maps `update → InboundArgs`. Synthetic phone `tg:${from.id}` if no shared contact. Routes through existing `handleInboundMessage` from Phase 2 unchanged.

## Client Identification
**Auto:** Telegram `from.id` is primary key. Phone optional via "Поделиться контактом" button. `clientsRepo.findByTelegramId` added.

## Inline Keyboards (QUOTED stage)
**Auto:** 3 buttons RU/UA-aware: «Подтвердить рейс ✅ / Изменить условия / Отказаться». callback_data format: `<action>:<leadId>`.

## Callback Query Handler
**Auto:** Maps button presses to synthetic inbound messages ('да', 'нет', 'изменить'). Strips keyboard after press via `editMessageReplyMarkup`.

## Driver Confirmation (TG-05)
**Auto:** Hook on `transitionOrder → DRIVER_ASSIGNED` triggers `notifyDriver`. Real Telegram send if `truck.driver_telegram_id`, else simulated auto-accept with warning log.

## Manager Intercept (TG-06)
**Auto:** New column `leads.manager_active BOOLEAN DEFAULT FALSE` via migration 0003. `POST /api/leads/:id/intercept` flips flag + sends welcome. Manager messages via `POST /api/leads/:id/manager-message`. Release via `POST /api/leads/:id/release`.

## Notifications (TG-07 / NOTIF-01)
**Auto:** `notifyClient` hook on order FSM transitions (DRIVER_ASSIGNED, IN_TRANSIT, DELIVERED). Templates in `lib/i18n.ts` (RU/UA). Skip if no `telegram_id`.

## Bot Commands
**Auto:** `/start` (RU default greeting), `/help` (lang-aware). Non-text messages → "Я понимаю только текстовые сообщения".

---

## Claude's Discretion

- Error handling structure for grammY exceptions in callbacks
- Pino log severity per event type
- Exact wording of system messages (drafts now, polish during execution)
- File layout within `channels/telegram/` (single file vs split)

## Deferred Ideas

- BullMQ queue for webhook processing → v2 PROD-01
- WS push for FSM transitions → Phase 4
- Voice driver confirmation → Phase 3.1 + v2 outbound voice
- SMS fallback → v2 PROD-04
- File/document attachments via Telegram → v2
- PII encryption in messages.text → v2 PROD-03
- Manager Telegram bot for approvals → v2
- Rate limiting per-client → v2 PROD-05
