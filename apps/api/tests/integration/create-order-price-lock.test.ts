// Phase 2 Plan 02-02 Task 3 — Pitfall #1 closure test (D-06).
//
// Three test classes:
//   1. Schema-level — the LLM cannot supply a `price` field because the strict()
//      schema rejects it. No DB required; pure type-level proof.
//   2. Handler-level — createOrderHandler reads `leads.quoted_price` from the DB
//      inside the transaction, NEVER from the input args. Test inserts a lead
//      with quoted_price = 2 500 000 (25k RUB) and asserts the resulting
//      orders.price equals 2 500 000 — independently of any LLM-supplied input.
//   3. Concurrency — two parallel createOrderHandler calls on the same lead:
//      one succeeds, the other throws "concurrent createOrder ... (version mismatch)".

import { exec as execCb } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  CreateOrderInputSchema,
  createOrderHandler,
} from '../../src/pipeline/llm-tools/create-order.js';
import type { ToolContext } from '../../src/pipeline/llm-tools/index.js';
import { startPostgisContainer, stopPostgisContainer } from '../_helpers/test-db.js';

const exec = promisify(execCb);
const { Pool } = pg;

const RUN_INTEGRATION = process.env.AI_LOGIST_SKIP_INTEGRATION !== '1';
const describeIf = RUN_INTEGRATION ? describe : describe.skip;

describe('CreateOrderInputSchema — Pitfall #1 type-level closure (D-06)', () => {
  it('strict mode rejects any LLM attempt to supply a price field', () => {
    // This is THE pitfall #1 test: even if the model tries to inject `price: 1`,
    // the schema rejects at the SDK boundary. No DB needed.
    const result = CreateOrderInputSchema.safeParse({
      lead_id: '00000000-0000-4000-8000-000000000001',
      confirmed: true,
      price: 1, // ← LLM-attempted injection
    });
    expect(result.success).toBe(false);
  });

  it('accepts the canonical {lead_id, confirmed:true} shape', () => {
    const ok = CreateOrderInputSchema.safeParse({
      lead_id: '00000000-0000-4000-8000-000000000001',
      confirmed: true,
    });
    expect(ok.success).toBe(true);
  });

  it('rejects {confirmed: false} (literal(true) only)', () => {
    const result = CreateOrderInputSchema.safeParse({
      lead_id: '00000000-0000-4000-8000-000000000001',
      confirmed: false,
    });
    expect(result.success).toBe(false);
  });
});

describeIf('createOrderHandler — price-lock + concurrency (D-06, MATCH-06)', () => {
  // biome-ignore lint/suspicious/noExplicitAny: Drizzle's Db type collides with the production schema-decorated one; tests don't need full type narrowing.
  let db: NodePgDatabase<any>;
  let pool: pg.Pool;
  let originalDbUrl: string | undefined;
  let clientId: string;
  let truckId: string;
  let fromCityId: string;
  let toCityId: string;

  beforeAll(async () => {
    const dbUrl = await startPostgisContainer();
    originalDbUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = dbUrl;
    process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

    const cwd = path.resolve(import.meta.dirname, '..', '..');
    await exec('pnpm exec drizzle-kit migrate', {
      cwd,
      env: { ...process.env, DATABASE_URL: dbUrl },
    });
    await exec('pnpm exec tsx src/seed/run.ts', {
      cwd,
      env: { ...process.env, DATABASE_URL: dbUrl },
    });

    pool = new Pool({ connectionString: dbUrl });
    db = drizzle(pool);

    // Pin reference IDs from seed for predictable lead inserts.
    const client = await db.execute(sql`SELECT id FROM clients LIMIT 1`);
    clientId = (client.rows[0] as { id: string }).id;
    const truck = await db.execute(sql`SELECT id FROM trucks LIMIT 1`);
    truckId = (truck.rows[0] as { id: string }).id;
    const fromCity = await db.execute(sql`SELECT id FROM cities ORDER BY slug LIMIT 1`);
    fromCityId = (fromCity.rows[0] as { id: string }).id;
    const toCity = await db.execute(sql`SELECT id FROM cities ORDER BY slug DESC LIMIT 1`);
    toCityId = (toCity.rows[0] as { id: string }).id;
  }, 180_000);

  afterAll(async () => {
    if (pool) await pool.end();
    await stopPostgisContainer();
    if (originalDbUrl !== undefined) process.env.DATABASE_URL = originalDbUrl;
  });

  beforeEach(async () => {
    // Clean slate per test.
    await db.execute(sql`DELETE FROM orders`);
    await db.execute(sql`DELETE FROM leads`);
  });

  async function insertQuotedLead(quotedPriceKopecks: bigint): Promise<string> {
    const insertResult = await db.execute(sql`
      INSERT INTO leads (
        client_id, channel, stage,
        from_city_id, to_city_id, matched_truck_id,
        quoted_price, version
      )
      VALUES (
        ${clientId}, 'test-harness', 'AGREED',
        ${fromCityId}, ${toCityId}, ${truckId},
        ${quotedPriceKopecks.toString()}::bigint, 0
      )
      RETURNING id
    `);
    return (insertResult.rows[0] as { id: string }).id;
  }

  function makeCtx(leadId: string): ToolContext {
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
      // biome-ignore lint/suspicious/noExplicitAny: structural logger only.
      child: () => log as any,
      // biome-ignore lint/suspicious/noExplicitAny: see above.
    } as any;
    return {
      // biome-ignore lint/suspicious/noExplicitAny: integration test uses raw Drizzle.
      db: db as any,
      log,
      // biome-ignore lint/suspicious/noExplicitAny: llm unused in createOrder.
      llm: {} as any,
      leadId,
      clientId,
      clientLang: 'ru',
    };
  }

  it('persists orders.price = leads.quoted_price even when input has no price field', async () => {
    const leadId = await insertQuotedLead(2_500_000n);
    const ctx = makeCtx(leadId);
    const result = await createOrderHandler(ctx, { lead_id: leadId, confirmed: true });
    expect(result.order_id).toBeDefined();
    expect(result.price_kopecks).toBe('2500000');
    expect(result.order_number).toMatch(/^#KU-[A-Z0-9]{8}$/);
    expect(result.public_token).toHaveLength(12);

    // Confirm DB row.
    const orderRow = await db.execute(sql`
      SELECT price FROM orders WHERE id = ${result.order_id}
    `);
    expect((orderRow.rows[0] as { price: string }).price).toBe('2500000');
  });

  it('throws when lead.quoted_price is NULL (not yet quoted)', async () => {
    const insertResult = await db.execute(sql`
      INSERT INTO leads (client_id, channel, stage, version)
      VALUES (${clientId}, 'test-harness', 'NEW', 0)
      RETURNING id
    `);
    const leadId = (insertResult.rows[0] as { id: string }).id;
    const ctx = makeCtx(leadId);
    await expect(createOrderHandler(ctx, { lead_id: leadId, confirmed: true })).rejects.toThrow(
      /no quoted_price/
    );
  });

  it('concurrent createOrder calls: exactly one succeeds, one fails (version CAS)', async () => {
    const leadId = await insertQuotedLead(2_500_000n);
    const ctx = makeCtx(leadId);
    const results = await Promise.allSettled([
      createOrderHandler(ctx, { lead_id: leadId, confirmed: true }),
      createOrderHandler(ctx, { lead_id: leadId, confirmed: true }),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    // Concurrency model: SELECT FOR UPDATE serialises the leads-row read; the
    // CAS UPDATE leads.version detects the second transaction's stale version
    // OR the orders.number/public_token UNIQUE constraint trips. Either way:
    // exactly one fulfilled, exactly one rejected.
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });
});
