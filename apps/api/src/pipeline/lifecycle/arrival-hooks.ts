// apps/api/src/pipeline/lifecycle/arrival-hooks.ts
//
// Voice-confirmation demo flow (post-Phase 6) — register per-state arrival
// hooks on the order FSM. Hooks are wired once at app bootstrap by
// `initOrderArrivalHooks(app, bot)`.
//
//   AT_LOADING        → dialOrderConfirmation(orderId, 'loading')
//   DELIVERED_PENDING → dialOrderConfirmation(orderId, 'delivery')
//   AWAITING_PAYMENT  → sendPaymentLink(orderId)
//
// The FSM fires these AFTER the COMMIT of `transitionOrder` regardless of who
// triggered the transition — auto-progress ticker, manual admin slider, TG
// callback, or voice tool — so the behaviour stays uniform.
//
// Failures inside a hook are caught + logged; they never roll back the FSM
// (Pitfall #3 in PHASE 3 RESEARCH).

import type { FastifyInstance } from 'fastify';
import type { Bot } from 'grammy';
import { sendPaymentLink } from '../../channels/telegram/handlers.js';
import { dialOrderConfirmation } from '../../channels/voice/outbound.js';
import { registerOrderArrivalHook } from './order-fsm.js';

let initialized = false;

/**
 * Wire arrival hooks for the demo voice-confirmation flow. Idempotent — safe
 * to call multiple times from bootstrap variants (test harnesses, scripts).
 */
export function initOrderArrivalHooks(app: FastifyInstance, bot: Bot): void {
  if (initialized) {
    app.log.debug('arrival-hooks already initialized; skipping re-registration');
    return;
  }
  initialized = true;

  registerOrderArrivalHook('AT_LOADING', async (orderId, db) => {
    await dialOrderConfirmation({
      db,
      redis: app.redis,
      log: app.log,
      orderId,
      stage: 'loading',
    });
  });

  registerOrderArrivalHook('DELIVERED_PENDING', async (orderId, db) => {
    await dialOrderConfirmation({
      db,
      redis: app.redis,
      log: app.log,
      orderId,
      stage: 'delivery',
    });
  });

  registerOrderArrivalHook('AWAITING_PAYMENT', async (orderId) => {
    // sendPaymentLink owns its own DB access via app.db; we pass app + bot.
    await sendPaymentLink({ orderId, app, bot });
  });

  app.log.info('arrival-hooks: registered AT_LOADING / DELIVERED_PENDING / AWAITING_PAYMENT');
}
