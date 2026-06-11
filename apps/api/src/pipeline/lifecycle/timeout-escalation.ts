// Phase 6 D-12 + D-13 — confirmation timeout reminders + manager escalation.
//
// Pure: takes a TickerDeps (db + log + bot) and queries Postgres for stale
// prompts. Idempotent: ON CONFLICT DO NOTHING on order_events (reminder_sent
// + operator_escalated have UNIQUE(order_id, type) so each can fire only
// once per order).
//
// Called from the same setInterval as tickerLoop — registerOrderTicker
// invokes BOTH tickerLoop AND evaluateTimeouts per tick.

import { sql } from 'drizzle-orm';
import type { TickerDeps } from './order-ticker.js';
import {
  notifyLoadingPrompt,
  notifyDeliveryPrompt,
} from '../../channels/telegram/notifications.js';

export async function evaluateTimeouts(deps: TickerDeps): Promise<void> {
  const { db, log, bot } = deps;

  // 10-min reminder.
  const remind = await db.execute(sql`
    SELECT DISTINCT o.id::text AS order_id, o.status::text AS status
    FROM orders o
    JOIN order_events e_prompt
      ON e_prompt.order_id = o.id
     AND e_prompt.type IN ('loading_prompted', 'delivery_prompted')
     AND e_prompt.created_at < NOW() - INTERVAL '10 minutes'
    LEFT JOIN order_events e_remind
      ON e_remind.order_id = o.id
     AND e_remind.type = 'reminder_sent'
    WHERE o.status IN ('AT_LOADING', 'DELIVERED_PENDING')
      AND e_remind.id IS NULL
  `);

  for (const row of remind.rows as Array<{ order_id: string; status: string }>) {
    const inserted = await db.execute(sql`
      INSERT INTO order_events (order_id, type, actor, payload)
      VALUES (${row.order_id}::uuid, 'reminder_sent'::order_event_type, 'system', '{}'::jsonb)
      ON CONFLICT (order_id, type) DO NOTHING
      RETURNING id
    `);
    if (inserted.rows.length === 0) continue;
    try {
      if (row.status === 'AT_LOADING') {
        await notifyLoadingPrompt({ orderId: row.order_id, db, bot, log });
      } else {
        await notifyDeliveryPrompt({ orderId: row.order_id, db, bot, log });
      }
    } catch (err) {
      log.warn({ err, orderId: row.order_id }, 'evaluateTimeouts: reminder send failed');
    }
  }

  // 30-min escalation.
  const escalate = await db.execute(sql`
    SELECT DISTINCT o.id::text AS order_id, o.lead_id::text AS lead_id
    FROM orders o
    JOIN order_events e_prompt
      ON e_prompt.order_id = o.id
     AND e_prompt.type IN ('loading_prompted', 'delivery_prompted')
     AND e_prompt.created_at < NOW() - INTERVAL '30 minutes'
    LEFT JOIN order_events e_esc
      ON e_esc.order_id = o.id
     AND e_esc.type = 'operator_escalated'
    WHERE o.status IN ('AT_LOADING', 'DELIVERED_PENDING')
      AND e_esc.id IS NULL
  `);

  for (const row of escalate.rows as Array<{ order_id: string; lead_id: string | null }>) {
    await db.transaction(async (tx) => {
      const inserted = await tx.execute(sql`
        INSERT INTO order_events (order_id, type, actor, payload)
        VALUES (${row.order_id}::uuid, 'operator_escalated'::order_event_type, 'system', '{}'::jsonb)
        ON CONFLICT (order_id, type) DO NOTHING
        RETURNING id
      `);
      if (inserted.rows.length === 0) return;
      if (row.lead_id) {
        await tx.execute(sql`
          UPDATE leads SET manager_active = true, updated_at = NOW(), version = version + 1
          WHERE id = ${row.lead_id}::uuid
        `);
      }
    });
  }
}
