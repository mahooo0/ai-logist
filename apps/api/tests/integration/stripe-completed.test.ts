// Phase 6 Plan 06-03 Wave 3 — integration test for D-18.
// Uses a real Fastify instance with mocked DB (no Docker testcontainer needed
// for unit-level route integration). Full DB integration is deferred to UAT.
//
// For a real testcontainer flow: set DATABASE_URL to a PostGIS container URL.
// This test is designed to run in CI without Docker by mocking the db layer.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import Stripe from 'stripe';

// ---- Stripe SDK mock -------------------------------------------------------
const constructEvent = vi.fn();
const MockStripe = function (this: unknown) {
  return { webhooks: { constructEvent } };
};
vi.mock('stripe', () => ({ default: MockStripe }));

// ---- Strip requireStripeConfig mock ----------------------------------------
vi.mock('../../src/channels/stripe/setup.js', () => ({
  requireStripeConfig: () => ({
    secretKey: 'sk_test_abc',
    webhookSecret: 'whsec_test',
    priceCurrency: 'rub',
    successUrl: 'https://demo.app/payment/success',
    cancelUrl: 'https://demo.app/payment/cancel',
  }),
}));

// ---- transitionOrder mock ---------------------------------------------------
const transitionOrderMock = vi.fn();
vi.mock('../../src/pipeline/lifecycle/order-fsm.js', () => ({
  transitionOrder: transitionOrderMock,
}));

// ---- notifyPaymentReceived mock ---------------------------------------------
const notifyPaymentReceivedMock = vi.fn();
vi.mock('../../src/channels/telegram/notifications.js', () => ({
  notifyPaymentReceived: notifyPaymentReceivedMock,
}));

// ---- Test helpers ----------------------------------------------------------
async function buildApp(dbExecute: ReturnType<typeof vi.fn>): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  // Cast to any to satisfy the strict Drizzle DB type; we only exercise .execute() in tests.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.decorate('db', { execute: dbExecute } as any);
  const { default: webhooksStripeRoutes } = await import(
    '../../src/routes/webhooks-stripe.js'
  );
  await app.register(webhooksStripeRoutes, { prefix: '/webhook' });
  await app.ready();
  return app;
}

// ---- Tests -----------------------------------------------------------------

describe('stripe-completed', () => {
  let app: FastifyInstance;
  let dbExecute: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    constructEvent.mockReset();
    transitionOrderMock.mockReset();
    notifyPaymentReceivedMock.mockReset();

    // dbExecute returns a new row for first call (webhook_updates INSERT),
    // subsequent calls return empty rows (order_events INSERT).
    dbExecute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: 'wu-1' }] }) // webhook_updates INSERT
      .mockResolvedValue({ rows: [] }); // order_events INSERT (in onSuccess)

    app = await buildApp(dbExecute);
  });

  afterEach(async () => {
    await app.close();
  });

  it('D-18 POST /webhook/stripe with valid checkout.session.completed → 200 + order transitions to CLOSED', async () => {
    const event = {
      id: 'evt_completed_001',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_completed',
          metadata: { order_id: 'order-uuid-completed' },
          amount_total: 5000000,
        },
      },
    };

    constructEvent.mockReturnValue(event);
    transitionOrderMock.mockImplementation(
      async (
        _db: unknown,
        args: { onSuccess?: () => Promise<void> }
      ) => {
        // Simulate the onSuccess hook being called post-commit
        if (args.onSuccess) await args.onSuccess();
        return { from: 'AWAITING_PAYMENT', to: 'CLOSED' };
      }
    );

    const res = await app.inject({
      method: 'POST',
      url: '/webhook/stripe',
      payload: Buffer.from(JSON.stringify(event)),
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 't=1749661985,v1=valid',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ received: true });

    // Drain event loop for setImmediate
    await new Promise((r) => setTimeout(r, 100));

    expect(transitionOrderMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        orderId: 'order-uuid-completed',
        to: 'CLOSED',
        actor: 'system',
        payload: {
          stripe_session_id: 'cs_test_completed',
          amount_total: 5000000,
        },
      })
    );

    // Verify webhook_updates INSERT was called (at least once — first call is the INSERT)
    expect(dbExecute).toHaveBeenCalled();
  });

  it('D-18 replay same event id → webhook_updates ON CONFLICT no-op + no transitionOrder call', async () => {
    const event = {
      id: 'evt_duplicate_001',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_duplicate',
          metadata: { order_id: 'order-dup' },
          amount_total: 100,
        },
      },
    };
    constructEvent.mockReturnValue(event);

    // ON CONFLICT DO NOTHING → rows: [] (duplicate)
    dbExecute = vi.fn().mockResolvedValue({ rows: [] });
    // rebuild app with new dbExecute
    await app.close();
    app = await buildApp(dbExecute);

    const res = await app.inject({
      method: 'POST',
      url: '/webhook/stripe',
      payload: Buffer.from(JSON.stringify(event)),
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 't=1749661985,v1=valid',
      },
    });

    expect(res.statusCode).toBe(200);

    await new Promise((r) => setTimeout(r, 100));
    expect(transitionOrderMock).not.toHaveBeenCalled();
  });
});
