// D-19 EXECUTION NOTE: Live UAT requires user-supplied Stripe TEST keys
//   STRIPE_SECRET_KEY=sk_test_...
//   STRIPE_WEBHOOK_SECRET=whsec_...
//   STRIPE_SUCCESS_URL=https://<your-host>/payment/success
//   STRIPE_CANCEL_URL=https://<your-host>/payment/cancel
// Add to apps/api/.env.local before running `stripe listen --forward-to localhost:3000/webhook/stripe`.
// Plan 06-03's UAT step pauses for these keys before live testing.

// Phase 6 D-17 — Stripe config boundary guard.
// Mirrors apps/api/src/channels/voice/setup.ts requireVoiceConfig() pattern:
// env vars are .optional() in apps/api/src/config.ts ConfigSchema so the API
// boots without keys. This helper throws when the Stripe Checkout / webhook
// route is actually hit without complete config.

import { config } from '../../config.js';

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  priceCurrency: string; // default 'rub' via ConfigSchema
  successUrl: string;
  cancelUrl: string;
}

export function requireStripeConfig(): StripeConfig {
  const missing: string[] = [];
  if (!config.STRIPE_SECRET_KEY) missing.push('STRIPE_SECRET_KEY');
  if (!config.STRIPE_WEBHOOK_SECRET) missing.push('STRIPE_WEBHOOK_SECRET');
  if (!config.STRIPE_SUCCESS_URL) missing.push('STRIPE_SUCCESS_URL');
  if (!config.STRIPE_CANCEL_URL) missing.push('STRIPE_CANCEL_URL');

  if (missing.length > 0) {
    throw new Error(`stripe config missing: ${missing.join(', ')}`);
  }

  return {
    secretKey: config.STRIPE_SECRET_KEY as string,
    webhookSecret: config.STRIPE_WEBHOOK_SECRET as string,
    priceCurrency: config.STRIPE_PRICE_CURRENCY,
    successUrl: config.STRIPE_SUCCESS_URL as string,
    cancelUrl: config.STRIPE_CANCEL_URL as string,
  };
}
