// Phase 6 Plan 06-03 Wave 3 — live tests for createCheckoutSession D-16.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sessionsCreate = vi.fn();

vi.mock('stripe', () => {
  const MockStripe = function (this: unknown) {
    return { checkout: { sessions: { create: sessionsCreate } } };
  };
  return { default: MockStripe };
});

vi.mock('../../src/channels/stripe/setup.js', () => ({
  requireStripeConfig: () => ({
    secretKey: 'sk_test_abc',
    webhookSecret: 'whsec_abc',
    priceCurrency: 'rub',
    successUrl: 'https://demo.app/payment/success',
    cancelUrl: 'https://demo.app/payment/cancel',
  }),
}));

interface CheckoutParams {
  mode: string;
  success_url: string;
  cancel_url: string;
  line_items: Array<{
    quantity: number;
    price_data: {
      currency: string;
      unit_amount: number;
      product_data: { name: string };
    };
  }>;
  metadata: { order_id: string; public_token: string };
}

interface CheckoutOpts {
  idempotencyKey: string;
}

describe('stripe-checkout-payload', () => {
  beforeEach(() => {
    sessionsCreate.mockReset();
  });

  it('D-16 createCheckoutSession builds price_data.unit_amount=kopecks + currency + idempotencyKey=order_<id>_v1', async () => {
    sessionsCreate.mockResolvedValue({
      id: 'cs_test_123',
      url: 'https://checkout.stripe/cs_test_123',
    });
    const { createCheckoutSession } = await import('../../src/channels/stripe/checkout.js');
    const res = await createCheckoutSession({
      orderId: 'order-uuid',
      orderNumber: '#KU-X',
      priceKopecks: 5000000n,
      currency: 'rub',
      publicToken: 'tok',
    });

    expect(res.url).toBe('https://checkout.stripe/cs_test_123');
    expect(res.sessionId).toBe('cs_test_123');
    expect(sessionsCreate).toHaveBeenCalledTimes(1);

    const calls = sessionsCreate.mock.calls as Array<[CheckoutParams, CheckoutOpts]>;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const params = calls[0]![0]!;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const opts = calls[0]![1]!;

    expect(params.mode).toBe('payment');
    expect(params.line_items[0]!.quantity).toBe(1);
    expect(params.line_items[0]!.price_data.currency).toBe('rub');
    expect(params.line_items[0]!.price_data.unit_amount).toBe(5000000);
    expect(params.line_items[0]!.price_data.product_data.name).toBe('Грузоперевозка #KU-X');
    expect(params.success_url).toContain('{CHECKOUT_SESSION_ID}');
    expect(params.metadata).toEqual({ order_id: 'order-uuid', public_token: 'tok' });
    expect(opts.idempotencyKey).toBe('order_order-uuid_v1');
  });

  it('D-16 success_url contains {CHECKOUT_SESSION_ID} template literal', async () => {
    sessionsCreate.mockResolvedValue({
      id: 'cs_test_456',
      url: 'https://checkout.stripe/cs_test_456',
    });
    const { createCheckoutSession } = await import('../../src/channels/stripe/checkout.js');
    await createCheckoutSession({
      orderId: 'order-2',
      orderNumber: '#KU-2',
      priceKopecks: 100n,
      currency: 'rub',
      publicToken: 'tok2',
    });

    const calls = sessionsCreate.mock.calls as Array<[CheckoutParams, CheckoutOpts]>;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const params = calls[0]![0]!;
    expect(params.success_url).toMatch(/\{CHECKOUT_SESSION_ID\}/);
  });

  it('D-16 throws "Stripe Checkout Session returned no url" when session.url is null', async () => {
    sessionsCreate.mockResolvedValue({ id: 'cs_test_123', url: null });
    const { createCheckoutSession } = await import('../../src/channels/stripe/checkout.js');
    await expect(
      createCheckoutSession({
        orderId: 'o',
        orderNumber: '#X',
        priceKopecks: 1n,
        currency: 'rub',
        publicToken: 't',
      })
    ).rejects.toThrow(/no url/);
  });
});
