// Phase 6 D-18 — Stripe webhook receiver.
//
// Pitfall 1: Stripe signs the LITERAL request bytes. We MUST keep the raw
// body, not the JSON-parsed object. Fastify v5 plugin encapsulation lets us
// scope a raw-body parser to THIS route only — other webhook routes
// (telegram, voice) keep the default JSON parser.

import { sql } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import Stripe from 'stripe';
import { requireStripeConfig } from '../channels/stripe/setup.js';
import { notifyPaymentReceived } from '../channels/telegram/notifications.js';
import { transitionOrder } from '../pipeline/lifecycle/order-fsm.js';

const webhooksStripeRoutes: FastifyPluginAsync = async (app) => {
  // Plugin-encapsulated parser — only routes registered inside this plugin use it.
  // This does NOT leak to Telegram/voice/admin routes (Fastify v5 plugin scoping).
  app.removeAllContentTypeParsers();
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => done(null, body)
  );

  app.post('/stripe', async (req, reply) => {
    const sigHeader = req.headers['stripe-signature'];
    if (typeof sigHeader !== 'string') {
      return reply.code(400).send({ error: 'missing stripe-signature' });
    }

    let cfg: ReturnType<typeof requireStripeConfig>;
    try {
      cfg = requireStripeConfig();
    } catch (err) {
      app.log.error({ err }, 'stripe webhook: config missing');
      return reply.code(503).send({ error: 'stripe not configured' });
    }

    const stripe = new Stripe(cfg.secretKey);

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body as Buffer,
        sigHeader,
        cfg.webhookSecret
      );
    } catch (err) {
      app.log.warn({ err }, 'stripe webhook: signature verification failed');
      return reply.code(400).send({ error: 'invalid signature' });
    }

    // Idempotency via webhook_updates (Phase 3 pattern; webhook_source enum
    // extended to include 'stripe' in migration 0006).
    const inserted = await app.db.execute(sql`
      INSERT INTO webhook_updates (source, external_id, payload)
      VALUES ('stripe', ${event.id}, ${JSON.stringify(event)}::jsonb)
      ON CONFLICT (source, external_id) DO NOTHING
      RETURNING id
    `);

    // Ack immediately. Stripe retries past 5s.
    reply.code(200).send({ received: true });

    if (inserted.rows.length === 0) {
      app.log.info({ eventId: event.id }, 'stripe webhook: duplicate event ignored');
      return;
    }

    // Async post-ack processing (setImmediate so reply already in flight).
    setImmediate(async () => {
      if (event.type !== 'checkout.session.completed') {
        app.log.info({ eventType: event.type }, 'stripe webhook: event type not handled');
        return;
      }
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.order_id;
      if (!orderId) {
        app.log.warn({ eventId: event.id }, 'stripe webhook: no order_id in metadata');
        return;
      }
      try {
        const bot = (app as typeof app & { bot?: import('grammy').Bot }).bot;
        await transitionOrder(app.db, {
          orderId,
          to: 'CLOSED',
          actor: 'system',
          payload: { stripe_session_id: session.id, amount_total: session.amount_total },
          onSuccess: async () => {
            // Write the per-order payment_received event for audit (transitionOrder
            // already writes 'closed' via STATUS_TO_EVENT).
            await app.db.execute(sql`
              INSERT INTO order_events (order_id, type, actor, payload)
              VALUES (${orderId}::uuid, 'payment_received'::order_event_type, 'system',
                      ${JSON.stringify({ stripe_session_id: session.id })}::jsonb)
              ON CONFLICT (order_id, type) DO NOTHING
            `);
            if (bot) {
              await notifyPaymentReceived({ orderId, db: app.db, bot, log: app.log });
            }
          },
        });
      } catch (err) {
        app.log.error(
          { err, orderId, eventId: event.id },
          'stripe webhook: transition to CLOSED failed'
        );
      }
    });
  });
};

export default webhooksStripeRoutes;
