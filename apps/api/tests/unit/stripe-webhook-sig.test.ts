// Phase 6 Plan 06-03 Wave 3 — live unit tests for webhooksStripeRoutes D-18.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

// ---- Stripe SDK mock -------------------------------------------------------
// constructEvent is the critical surface: it takes (rawBody, sig, secret) and
// either returns a Stripe.Event or throws. We mock it per-test via mockReturnValueOnce.
const constructEvent = vi.fn();
const MockStripe = function (this: unknown) {
  return { webhooks: { constructEvent } };
};
vi.mock('stripe', () => ({ default: MockStripe }));

// ---- requireStripeConfig mock ----------------------------------------
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
const transitionOrder = vi.fn();
vi.mock('../../src/pipeline/lifecycle/order-fsm.js', () => ({ transitionOrder }));

// ---- notifyPaymentReceived mock ---------------------------------------------
vi.mock('../../src/channels/telegram/notifications.js', () => ({
  notifyPaymentReceived: vi.fn(),
}));

// ---- Single app instance shared across all tests ---------------------------
// db.execute mock — records the first INSERT (webhook_updates) and returns row.
const dbExecute = vi.fn().mockResolvedValue({ rows: [{ id: 1 }] });

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });
  // Cast to any to satisfy the strict Drizzle DB type; we only exercise .execute() in tests.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.decorate('db', { execute: dbExecute } as any);
  const { default: webhooksStripeRoutes } = await import(
    '../../src/routes/webhooks-stripe.js'
  );
  await app.register(webhooksStripeRoutes, { prefix: '/webhook' });
  await app.ready();
});

afterAll(async () => {
  await app.close().catch(() => {});
});

// ---- Tests -----------------------------------------------------------------

describe('stripe-webhook-sig', () => {
  it('D-18 missing stripe-signature header → 400 with "missing stripe-signature"', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhook/stripe',
      payload: Buffer.from('{"type":"test"}'),
      headers: { 'content-type': 'application/json' },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toMatchObject({ error: 'missing stripe-signature' });
  });

  it('D-18 tampered body / bad signature → constructEvent throws → 400 "invalid signature"', async () => {
    constructEvent.mockImplementationOnce(() => {
      throw new Error('No signatures found matching the expected signature for payload');
    });

    const res = await app.inject({
      method: 'POST',
      url: '/webhook/stripe',
      payload: Buffer.from('{"tampered":"body"}'),
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 't=1,v1=badSig',
      },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toMatchObject({ error: 'invalid signature' });
  });

  it('D-18 valid signature + checkout.session.completed → 200 + transitionOrder called with CLOSED', async () => {
    const event = {
      id: 'evt_test_001',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_001',
          metadata: { order_id: 'order-uuid-abc' },
          amount_total: 5000000,
        },
      },
    };
    constructEvent.mockReturnValueOnce(event);
    transitionOrder.mockResolvedValueOnce({ from: 'AWAITING_PAYMENT', to: 'CLOSED' });

    const res = await app.inject({
      method: 'POST',
      url: '/webhook/stripe',
      payload: Buffer.from(JSON.stringify(event)),
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 't=1749661985,v1=validSig',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ received: true });

    // setImmediate fires async — drain the event loop
    await new Promise<void>((r) => setImmediate(r));

    expect(transitionOrder).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orderId: 'order-uuid-abc', to: 'CLOSED', actor: 'system' })
    );
    transitionOrder.mockReset();
  });

  it('D-18 non-checkout.session.completed event is ignored (200, no transitionOrder call)', async () => {
    const event = {
      id: 'evt_test_002',
      type: 'payment_intent.succeeded',
      data: { object: {} },
    };
    constructEvent.mockReturnValueOnce(event);
    transitionOrder.mockReset();

    const res = await app.inject({
      method: 'POST',
      url: '/webhook/stripe',
      payload: Buffer.from(JSON.stringify(event)),
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 't=1749661985,v1=validSig',
      },
    });
    expect(res.statusCode).toBe(200);

    await new Promise<void>((r) => setImmediate(r));
    // Let setImmediate fire and finish
    await new Promise<void>((r) => setImmediate(r));
    expect(transitionOrder).not.toHaveBeenCalled();
  });

  it('D-18 plugin uses removeAllContentTypeParsers + parseAs buffer pattern', async () => {
    // The plugin source contains both markers — verified by reading the file.
    const fs = await import('fs/promises');
    const src = await fs.readFile(
      new URL('../../src/routes/webhooks-stripe.ts', import.meta.url).pathname,
      'utf8'
    );
    expect(src).toContain('removeAllContentTypeParsers');
    expect(src).toContain("parseAs: 'buffer'");
    expect(src).toContain('done(null, body)');
    expect(src).toContain('req.body as Buffer');
  });
});
