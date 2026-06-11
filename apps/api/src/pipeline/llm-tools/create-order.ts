// Phase 2 Plan 02-02 Task 3 — createOrder tool (D-06, Pitfall #1 closure).
//
// CONTEXT D-05, D-06, D-26. Source: 02-RESEARCH.md "Pattern 3" + Anti-Patterns
// (createOrder must NOT accept price) + price-lock §5.5.
//
// CRITICAL INVARIANT: The input schema does NOT have a `price` field. Even if
// the LLM tries to inject one (e.g. via prompt injection), `.strict()` rejects
// it at the SDK boundary. The handler ALSO re-reads `leads.quoted_price` from
// the DB inside the transaction — defense in depth (D-05 "trust nothing").
//
// Transaction shape:
//   1. SELECT id, quoted_price, client_id, matched_truck_id, from_city_id,
//      to_city_id, version FROM leads WHERE id=$lead_id FOR UPDATE.
//   2. Throw if quoted_price is NULL (lead not yet quoted).
//   3. Generate order.number (#KU-XXXXXXXX) + public_token (nanoid 12).
//   4. INSERT INTO orders (..., price=lead.quoted_price, ...).
//   5. CAS UPDATE leads SET order_id, version=version+1 WHERE id AND version=$expected.
//      0 rows updated → concurrent createOrder (someone else got there first).
//   6. Return { order_id, order_number, price_kopecks (string), public_token }.

import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { sql } from 'drizzle-orm';
import { customAlphabet, nanoid } from 'nanoid';
import { z } from 'zod/v4';
import type { ToolContext } from './index.js';

// STRICT: lead_id + confirmed only. No `price` field — D-06 closes Pitfall #1 at
// the type level. The SDK's JSON-Schema strict mode rejects extra fields; the
// handler additionally re-parses through CreateOrderInputSchema.strict().
export const CreateOrderInputSchema = z
  .object({
    lead_id: z.string().uuid(),
    confirmed: z.literal(true),
  })
  .strict();

const orderNumberGen = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 8);

export interface CreateOrderResult {
  order_id: string;
  order_number: string;
  price_kopecks: string; // bigint serialised as string for JSON safety
  public_token: string;
}

export async function createOrderHandler(
  ctx: ToolContext,
  input: z.infer<typeof CreateOrderInputSchema>
): Promise<CreateOrderResult> {
  return await ctx.db.transaction(async (tx) => {
    // 1. Pessimistic row lock on the lead. Re-read EVERYTHING we need.
    //    ANY field the LLM might have tried to supply (price, truck_id, …) is ignored;
    //    we read from the DB row, period.
    const lockResult = await tx.execute(sql`
      SELECT id, quoted_price, client_id, matched_truck_id, from_city_id, to_city_id, version
      FROM leads
      WHERE id = ${input.lead_id}
      FOR UPDATE
    `);
    const lead = lockResult.rows[0] as
      | {
          id: string;
          quoted_price: string | null;
          client_id: string;
          matched_truck_id: string | null;
          from_city_id: string | null;
          to_city_id: string | null;
          version: number;
        }
      | undefined;
    if (!lead) {
      throw new Error(`createOrder: lead ${input.lead_id} not found`);
    }
    if (lead.quoted_price === null || lead.quoted_price === undefined) {
      throw new Error(
        `createOrder: lead ${input.lead_id} has no quoted_price yet — cannot create order`
      );
    }

    // 2. Generate identifiers.
    const orderNumber = `#KU-${orderNumberGen()}`;
    const publicToken = nanoid(12);

    // 3. INSERT order. price is sourced from the locked lead row, NEVER from input.
    const insertResult = await tx.execute(sql`
      INSERT INTO orders (
        number, lead_id, client_id, truck_id,
        from_city_id, to_city_id, price, currency,
        status, public_token, version
      )
      VALUES (
        ${orderNumber}, ${lead.id}, ${lead.client_id}, ${lead.matched_truck_id},
        ${lead.from_city_id}, ${lead.to_city_id}, ${lead.quoted_price}::bigint, 'RUB',
        'CREATED', ${publicToken}, 0
      )
      RETURNING id, price
    `);
    const order = insertResult.rows[0] as { id: string; price: string } | undefined;
    if (!order) {
      throw new Error(`createOrder: insert returned no row (lead ${lead.id})`);
    }

    // 4. CAS update leads.order_id (also defends against concurrent createOrder).
    const updateLead = await tx.execute(sql`
      UPDATE leads
      SET order_id = ${order.id}, updated_at = NOW(), version = version + 1
      WHERE id = ${lead.id} AND version = ${lead.version}
      RETURNING id
    `);
    if (updateLead.rows.length === 0) {
      throw new Error(`createOrder: concurrent createOrder on lead ${lead.id} (version mismatch)`);
    }

    // 5. Mark the matched truck as busy so /dashboard/tracking + the matcher
    // reflect reality. Skip when the lead came off the bourse stub
    // (matched_truck_id is null in that case — see intake.ts STEP G).
    if (lead.matched_truck_id) {
      await tx.execute(sql`
        UPDATE trucks
        SET status = 'busy', updated_at = NOW()
        WHERE id = ${lead.matched_truck_id} AND status = 'available'
      `);
    }

    ctx.log.info(
      {
        tool: 'createOrder',
        leadId: ctx.leadId,
        orderId: order.id,
        price_kopecks: order.price,
      },
      'tool.create_order'
    );

    return {
      order_id: order.id,
      order_number: orderNumber,
      price_kopecks: order.price,
      public_token: publicToken,
    };
  });
}

export function createOrderTool(ctx: ToolContext) {
  return betaZodTool({
    name: 'createOrder',
    description:
      'Create an order from a lead that has been quoted and the client agreed to. Price is read from leads.quoted_price (DB), never from arguments.',
    inputSchema: CreateOrderInputSchema,
    run: async (input) => {
      // Belt-and-suspenders re-validation. If `.strict()` lets anything through,
      // this would still reject extra fields.
      CreateOrderInputSchema.parse(input);
      try {
        const result = await createOrderHandler(ctx, input);
        return JSON.stringify({ ok: true, data: result });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        ctx.log.warn(
          { tool: 'createOrder', leadId: ctx.leadId, err: message },
          'createOrder.failed'
        );
        return JSON.stringify({
          ok: false,
          error: { code: 'create_order_failed', message },
        });
      }
    },
  });
}
