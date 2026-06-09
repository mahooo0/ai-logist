// Phase 2 Plan 02-02 Task 3 — discount unit tests (D-26).
//
// Schema-level tests: input must be strict (no extra fields, no missing fields).
// Floor-logic tests: mock the minimum surface of ctx.db (transaction + execute)
// to assert the three handler branches without a real DB:
//   1. quoted_price NULL → lead_not_quoted.
//   2. amount_kopecks >= min floor (0.85 × quoted) → ok, new_price_kopecks returned.
//   3. amount_kopecks < min floor → escalation_needed.
//
// The full transactional path (FOR UPDATE + jsonb[] append) is exercised by the
// Wave 4 integration tests; this file proves the math.

import { describe, expect, it, vi } from 'vitest';
import { DiscountInputSchema, discountHandler } from '../../src/pipeline/llm-tools/discount.js';
import type { ToolContext } from '../../src/pipeline/llm-tools/index.js';

const LEAD_ID = '00000000-0000-4000-8000-000000000001';

function makeMockCtx(
  leadRow: { quoted_price: string | null; price_overrides: unknown[] } | undefined,
  executeSpy?: (sqlChunk: unknown) => unknown
): ToolContext {
  const fakeTx = {
    execute: vi.fn(async (chunk: unknown) => {
      executeSpy?.(chunk);
      return { rows: leadRow ? [{ id: LEAD_ID, ...leadRow }] : [] };
    }),
  };
  const fakeDb = {
    transaction: async <T>(fn: (tx: typeof fakeTx) => Promise<T>) => fn(fakeTx),
  };
  const noop = () => {};
  const log = {
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
    fatal: noop,
    trace: noop,
    silent: noop,
    level: 'info',
    // biome-ignore lint/suspicious/noExplicitAny: tests only need a structural logger; FastifyBaseLogger details are irrelevant here.
    child: () => log as any,
    // biome-ignore lint/suspicious/noExplicitAny: see above.
  } as any;
  return {
    // biome-ignore lint/suspicious/noExplicitAny: mock Db only needs `transaction(fn)`.
    db: fakeDb as any,
    log,
    // biome-ignore lint/suspicious/noExplicitAny: llm provider unused in discount handler.
    llm: {} as any,
    leadId: LEAD_ID,
    clientId: '00000000-0000-4000-8000-000000000099',
    clientLang: 'ru',
  };
}

describe('DiscountInputSchema (strict)', () => {
  it('accepts the canonical shape', () => {
    const ok = DiscountInputSchema.safeParse({
      lead_id: LEAD_ID,
      amount_kopecks: 1_500_000,
      reason: 'first-time client retention',
    });
    expect(ok.success).toBe(true);
  });

  it('rejects extra fields (strict)', () => {
    const result = DiscountInputSchema.safeParse({
      lead_id: LEAD_ID,
      amount_kopecks: 1_500_000,
      reason: 'good faith',
      override_manager: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative amount_kopecks', () => {
    const result = DiscountInputSchema.safeParse({
      lead_id: LEAD_ID,
      amount_kopecks: -500_000,
      reason: 'good faith',
    });
    expect(result.success).toBe(false);
  });

  it('rejects too-short reason', () => {
    const result = DiscountInputSchema.safeParse({
      lead_id: LEAD_ID,
      amount_kopecks: 1_500_000,
      reason: 'ok',
    });
    expect(result.success).toBe(false);
  });
});

describe('discountHandler floor logic (D-26)', () => {
  it('returns lead_not_quoted when quoted_price is null', async () => {
    const ctx = makeMockCtx({ quoted_price: null, price_overrides: [] });
    const result = await discountHandler(ctx, {
      lead_id: LEAD_ID,
      amount_kopecks: 1_500_000,
      reason: 'goodwill credit',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('lead_not_quoted');
    }
  });

  it('returns lead_not_quoted when the lead row is missing', async () => {
    const ctx = makeMockCtx(undefined);
    const result = await discountHandler(ctx, {
      lead_id: LEAD_ID,
      amount_kopecks: 1_500_000,
      reason: 'goodwill credit',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('lead_not_quoted');
    }
  });

  it('returns escalation_needed when amount is below min floor (quoted × 0.85)', async () => {
    // quoted_price = 2 000 000 kopecks (20k RUB). Min floor = 1 700 000.
    const ctx = makeMockCtx({ quoted_price: '2000000', price_overrides: [] });
    const result = await discountHandler(ctx, {
      lead_id: LEAD_ID,
      amount_kopecks: 1_500_000, // 15k RUB — under 17k floor
      reason: 'requested big discount',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('escalation_needed');
    }
  });

  it('returns ok when amount equals or exceeds min floor', async () => {
    const ctx = makeMockCtx({ quoted_price: '2000000', price_overrides: [] });
    const result = await discountHandler(ctx, {
      lead_id: LEAD_ID,
      amount_kopecks: 1_700_000, // exactly the floor (0.85 × 2 000 000)
      reason: 'first-time discount',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.new_price_kopecks).toBe('1700000');
    }
  });

  it('returns ok when amount equals quoted_price (no discount)', async () => {
    const ctx = makeMockCtx({ quoted_price: '2000000', price_overrides: [] });
    const result = await discountHandler(ctx, {
      lead_id: LEAD_ID,
      amount_kopecks: 2_000_000,
      reason: 'audit confirmation',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.new_price_kopecks).toBe('2000000');
    }
  });
});
