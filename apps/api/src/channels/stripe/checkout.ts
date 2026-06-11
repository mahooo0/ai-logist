// Phase 6 D-16 — Stripe Checkout Session creator.
//
// INVARIANT: orders.price (bigint kopecks) is the single source of truth
// for unit_amount. LLM-generated price strings never reach this function.
// Same posture as Phase 2 createOrderHandler (Pitfall #1 closure).

import Stripe from 'stripe';
import { requireStripeConfig } from './setup.js';

export interface CreateCheckoutArgs {
  orderId: string;
  orderNumber: string; // '#KU-XXXX' for product_data.name
  priceKopecks: bigint; // from orders.price
  currency: string; // from requireStripeConfig().priceCurrency
  publicToken: string; // existing orders.public_token, used in metadata
}

export interface CreateCheckoutResult {
  url: string;
  sessionId: string;
}

export async function createCheckoutSession(
  args: CreateCheckoutArgs
): Promise<CreateCheckoutResult> {
  const cfg = requireStripeConfig();
  const stripe = new Stripe(cfg.secretKey);

  // unit_amount must be integer-kopecks. orders.price is bigint kopecks
  // (safe to Number() for amounts < 2^53; demo orders well under).
  const unitAmount = Number(args.priceKopecks);

  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      success_url: `${cfg.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cfg.cancelUrl,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: args.currency,
            unit_amount: unitAmount,
            product_data: {
              name: `Грузоперевозка ${args.orderNumber}`,
            },
          },
        },
      ],
      metadata: {
        order_id: args.orderId,
        public_token: args.publicToken,
      },
    },
    {
      // Idempotent — re-running with the same key returns the same session.
      idempotencyKey: `order_${args.orderId}_v1`,
    }
  );

  if (!session.url) {
    throw new Error('Stripe Checkout Session returned no url');
  }
  return { url: session.url, sessionId: session.id };
}
