// Phase 6 Plan 06-03 Wave 3 — live tests for requireStripeConfig D-17.
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('stripe-config-guard', () => {
  beforeEach(() => vi.resetModules());

  it('D-17 returns typed config when all keys present', async () => {
    vi.doMock('../../src/config.js', () => ({
      config: {
        STRIPE_SECRET_KEY: 'sk_test_abc',
        STRIPE_WEBHOOK_SECRET: 'whsec_abc',
        STRIPE_PRICE_CURRENCY: 'rub',
        STRIPE_SUCCESS_URL: 'https://demo.app/payment/success',
        STRIPE_CANCEL_URL: 'https://demo.app/payment/cancel',
      },
    }));
    const { requireStripeConfig } = await import('../../src/channels/stripe/setup.js');
    const cfg = requireStripeConfig();
    expect(cfg.secretKey).toBe('sk_test_abc');
    expect(cfg.webhookSecret).toBe('whsec_abc');
    expect(cfg.priceCurrency).toBe('rub');
    expect(cfg.successUrl).toBe('https://demo.app/payment/success');
    expect(cfg.cancelUrl).toBe('https://demo.app/payment/cancel');
  });

  it('D-17 requireStripeConfig throws "stripe config missing: STRIPE_SECRET_KEY" when secret key absent', async () => {
    vi.doMock('../../src/config.js', () => ({
      config: {
        STRIPE_WEBHOOK_SECRET: 'whsec_abc',
        STRIPE_PRICE_CURRENCY: 'rub',
        STRIPE_SUCCESS_URL: 'https://demo.app/payment/success',
        STRIPE_CANCEL_URL: 'https://demo.app/payment/cancel',
      },
    }));
    const { requireStripeConfig } = await import('../../src/channels/stripe/setup.js');
    expect(() => requireStripeConfig()).toThrow(/STRIPE_SECRET_KEY/);
  });

  it('D-17 requireStripeConfig throws "stripe config missing: ..." listing all missing fields', async () => {
    vi.doMock('../../src/config.js', () => ({
      config: {
        STRIPE_PRICE_CURRENCY: 'rub',
      },
    }));
    const { requireStripeConfig } = await import('../../src/channels/stripe/setup.js');
    expect(() => requireStripeConfig()).toThrow(/STRIPE_SECRET_KEY/);
    expect(() => requireStripeConfig()).toThrow(/STRIPE_WEBHOOK_SECRET/);
    expect(() => requireStripeConfig()).toThrow(/STRIPE_SUCCESS_URL/);
    expect(() => requireStripeConfig()).toThrow(/STRIPE_CANCEL_URL/);
  });

  it('D-17 priceCurrency defaults to rub when not overridden', async () => {
    vi.doMock('../../src/config.js', () => ({
      config: {
        STRIPE_SECRET_KEY: 'sk_test_x',
        STRIPE_WEBHOOK_SECRET: 'whsec_x',
        STRIPE_PRICE_CURRENCY: 'rub', // default value from ConfigSchema
        STRIPE_SUCCESS_URL: 'https://demo.app/payment/success',
        STRIPE_CANCEL_URL: 'https://demo.app/payment/cancel',
      },
    }));
    const { requireStripeConfig } = await import('../../src/channels/stripe/setup.js');
    const cfg = requireStripeConfig();
    expect(cfg.priceCurrency).toBe('rub');
  });
});
