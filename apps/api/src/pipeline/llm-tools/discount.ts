// Phase 2 Plan 02-02 Task 3 — discount tool (D-26).
//
// LLM may grant a discount inside the [min, default] corridor by calling this
// tool. The handler enforces the floor: amount_kopecks >= min → ok, lower →
// returns {ok:false, error:{code:'escalation_needed'}}.
//
// Min floor is `quoted_price × 0.85` (matches `calcPrice` corridor in D-24/D-27);
// the lead's existing quoted_price is the contract anchor. If a future Phase 2
// plan exposes the price_overrides ledger more richly we will read the stored
// `min_kopecks` instead — for Wave 2 the 0.85 multiplier is sufficient.

import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { sql } from 'drizzle-orm';
import { z } from 'zod/v4';
import type { ToolContext } from './index.js';

export const DiscountInputSchema = z
  .object({
    lead_id: z.string().uuid(),
    amount_kopecks: z.number().positive(),
    reason: z.string().min(3),
  })
  .strict();

export type DiscountSuccess = { ok: true; new_price_kopecks: string };
export type DiscountError = {
  ok: false;
  error: { code: 'escalation_needed' | 'lead_not_quoted'; message: string };
};
export type DiscountResult = DiscountSuccess | DiscountError;

export async function discountHandler(
  ctx: ToolContext,
  input: z.infer<typeof DiscountInputSchema>
): Promise<DiscountResult> {
  return await ctx.db.transaction(async (tx) => {
    const lockResult = await tx.execute(sql`
      SELECT id, quoted_price, price_overrides
      FROM leads
      WHERE id = ${input.lead_id}
      FOR UPDATE
    `);
    const lead = lockResult.rows[0] as
      | { id: string; quoted_price: string | null; price_overrides: unknown[] }
      | undefined;
    if (!lead || lead.quoted_price === null) {
      return {
        ok: false,
        error: {
          code: 'lead_not_quoted',
          message: 'lead has no quoted_price yet — cannot apply discount',
        },
      };
    }

    const requested = BigInt(Math.round(input.amount_kopecks));
    const quoted = BigInt(lead.quoted_price);
    // Min floor mirrors the calcPrice corridor (D-24): default × 0.85.
    const minFloor = BigInt(Math.round(Number(quoted) * 0.85));

    if (requested < minFloor) {
      ctx.log.warn(
        {
          tool: 'discount',
          leadId: lead.id,
          requested: requested.toString(),
          minFloor: minFloor.toString(),
        },
        'discount.below_floor'
      );
      return {
        ok: false,
        error: {
          code: 'escalation_needed',
          message: `discount ${requested.toString()} kopecks below min floor ${minFloor.toString()} kopecks`,
        },
      };
    }

    const override = {
      from: quoted.toString(),
      to: requested.toString(),
      reason: input.reason,
      at: new Date().toISOString(),
      actor: 'ai' as const,
    };

    // jsonb[] append via PG `||` operator. Drizzle interpolates the JSON.stringify
    // payload as a parameter; the explicit `::jsonb` cast is required because
    // template literals always bind as text. ARRAY[]::jsonb[] wraps the single
    // value so the `||` operator stays in jsonb[]-domain.
    await tx.execute(sql`
      UPDATE leads
      SET quoted_price = ${requested.toString()}::bigint,
          price_overrides = price_overrides || ARRAY[${JSON.stringify(override)}::jsonb],
          updated_at = NOW()
      WHERE id = ${lead.id}
    `);

    ctx.log.info(
      {
        tool: 'discount',
        leadId: lead.id,
        new_price_kopecks: requested.toString(),
        reason: input.reason,
      },
      'discount.applied'
    );

    return { ok: true, new_price_kopecks: requested.toString() };
  });
}

export function discountTool(ctx: ToolContext) {
  return betaZodTool({
    name: 'discount',
    description:
      'Apply a discount within the allowed corridor [min, default]. Returns {ok:false, error:{code:"escalation_needed"}} if below the min floor.',
    inputSchema: DiscountInputSchema,
    run: async (input) => {
      DiscountInputSchema.parse(input);
      const result = await discountHandler(ctx, input);
      return JSON.stringify(
        result.ok
          ? { ok: true, data: { new_price_kopecks: result.new_price_kopecks } }
          : { ok: false, error: result.error }
      );
    },
  });
}
