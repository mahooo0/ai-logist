// Phase 6 D-01 / D-02 / D-03 / D-05 / D-07 — background ticker.
//
// Single-instance setInterval (mirrors follow-up-scheduler.ts). Tick logic:
//   1. SELECT ... FOR UPDATE SKIP LOCKED — orders in {DRIVER_ASSIGNED, IN_TRANSIT}
//      with auto_progress_paused=false.
//   2. For each row: newPct = min(100, old + delta).
//   3. UPDATE orders SET progress_percent=newPct WHERE id=$1 AND status IN (...).
//      The status filter defends against Pitfall 8 — a CANCELED row in flight
//      is a no-op.
//   4. Mutual exclusion (Pitfall 2):
//        - if newPct >= 100 → transition (approach NOT fired).
//        - elif newPct >= 90 → fire approach (per-leg event type per Pitfall 4).
//   5. Truck position interpolation deferred for leg 1 per Pitfall 3 — leg 2 only.

import { sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyBaseLogger } from 'fastify';
import type { Bot } from 'grammy';
import { config as importedConfig } from '../../config.js';
import type { Db } from '../../db.js';
import { transitionOrder } from './order-fsm.js';
import {
  notifyApproach,
  notifyLoadingPrompt,
  notifyDeliveryPrompt,
} from '../../channels/telegram/notifications.js';
import { routeGeometry } from '../../lib/routing.js';
import { interpolateAlongPolyline } from '../../lib/polyline-interpolate.js';

export interface TickerDeps {
  db: Db;
  log: FastifyBaseLogger;
  bot: Bot;
}

interface TickRow {
  id: string;
  status: 'DRIVER_ASSIGNED' | 'IN_TRANSIT';
  progress_percent: number;
  from_lon: number | null;
  from_lat: number | null;
  to_lon: number | null;
  to_lat: number | null;
  truck_id: string | null;
}

export async function tickerLoop(deps: TickerDeps): Promise<void> {
  const { db, log } = deps;
  const delta = importedConfig.DEMO_TICKER_DELTA_PCT;

  const rows = await db.execute(sql`
    SELECT o.id::text AS id,
           o.status,
           o.progress_percent,
           o.truck_id::text AS truck_id,
           ST_X(fc.geom::geometry) AS from_lon,
           ST_Y(fc.geom::geometry) AS from_lat,
           ST_X(tc.geom::geometry) AS to_lon,
           ST_Y(tc.geom::geometry) AS to_lat
    FROM orders o
    LEFT JOIN cities fc ON fc.id = o.from_city_id
    LEFT JOIN cities tc ON tc.id = o.to_city_id
    WHERE o.status IN ('DRIVER_ASSIGNED', 'IN_TRANSIT')
      AND o.auto_progress_paused = false
    FOR UPDATE SKIP LOCKED
  `);

  for (const raw of rows.rows as unknown as TickRow[]) {
    const oldPct = raw.progress_percent;
    const newPct = Math.min(100, oldPct + delta);

    // 1. UPDATE progress, status-filter prevents race with concurrent CANCELED (Pitfall 8).
    await db.execute(sql`
      UPDATE orders
      SET progress_percent = ${newPct}, updated_at = NOW()
      WHERE id = ${raw.id}::uuid
        AND status IN ('DRIVER_ASSIGNED', 'IN_TRANSIT')
    `);

    // 2. Leg-2 truck position interpolation (Pitfall 3 — skip leg 1).
    if (
      raw.status === 'IN_TRANSIT' &&
      raw.truck_id &&
      raw.from_lon != null &&
      raw.to_lon != null
    ) {
      try {
        const geo = await routeGeometry(
          { lon: raw.from_lon, lat: raw.from_lat as number },
          { lon: raw.to_lon, lat: raw.to_lat as number },
          log
        );
        const pos = interpolateAlongPolyline(
          geo.geometry as Array<[number, number]>,
          newPct / 100
        );
        await db.execute(sql`
          UPDATE trucks
          SET geom = ST_GeogFromText('SRID=4326;POINT(' || ${pos[0]} || ' ' || ${pos[1]} || ')')
          WHERE id = ${raw.truck_id}::uuid
        `);
      } catch (err) {
        log.warn({ err, orderId: raw.id }, 'order-ticker: truck position update failed');
      }
    }

    // 3. Mutual exclusion (Pitfall 2).
    if (newPct >= 100) {
      const nextStatus = raw.status === 'DRIVER_ASSIGNED' ? 'AT_LOADING' : 'DELIVERED_PENDING';
      // Reset progress so next leg starts at 0.
      await db.execute(sql`
        UPDATE orders SET progress_percent = 0 WHERE id = ${raw.id}::uuid
      `);
      try {
        await transitionOrder(db, {
          orderId: raw.id,
          to: nextStatus,
          actor: 'system',
          payload: { reason: 'ticker_completed_leg' },
          onSuccess: async () => {
            if (nextStatus === 'AT_LOADING') {
              await notifyLoadingPrompt({ orderId: raw.id, db, bot: deps.bot, log });
            } else {
              await notifyDeliveryPrompt({ orderId: raw.id, db, bot: deps.bot, log });
            }
          },
        });
      } catch (err) {
        log.warn({ err, orderId: raw.id }, 'order-ticker: transition failed (concurrent?)');
      }
    } else if (newPct >= 90) {
      // Distinct event types per leg (Pitfall 4) — per-leg idempotency.
      const eventType =
        raw.status === 'DRIVER_ASSIGNED' ? 'approach_notified' : 'delivery_approach_notified';

      const inserted = await db.execute(sql`
        INSERT INTO order_events (order_id, type, actor, payload)
        VALUES (${raw.id}::uuid, ${eventType}::order_event_type, 'system',
                ${JSON.stringify({ progress_percent: newPct })}::jsonb)
        ON CONFLICT (order_id, type) DO NOTHING
        RETURNING id
      `);
      if (inserted.rows.length > 0) {
        await notifyApproach({ orderId: raw.id, leg: raw.status, db, bot: deps.bot, log });
      }
    }
  }
}

export function registerOrderTicker(
  app: FastifyInstance & { db: Db; bot: Bot }
): void {
  const nodeEnv =
    (app as { config?: { NODE_ENV?: string } }).config?.NODE_ENV ?? importedConfig.NODE_ENV;
  if (nodeEnv === 'test') return;
  if (!importedConfig.DEMO_TICKER_ENABLED) return;

  const intervalMs = importedConfig.DEMO_TICKER_INTERVAL_SEC * 1000;
  const handle = setInterval(() => {
    void (async () => {
      try {
        await tickerLoop({ db: app.db, log: app.log, bot: app.bot });
        const { evaluateTimeouts } = await import('./timeout-escalation.js');
        await evaluateTimeouts({ db: app.db, log: app.log, bot: app.bot });
      } catch (e) {
        app.log.error({ err: e }, 'order-ticker.tick_failed');
      }
    })();
  }, intervalMs);
  app.addHook('onClose', async () => {
    clearInterval(handle);
  });
  app.log.info(
    { intervalMs, delta: importedConfig.DEMO_TICKER_DELTA_PCT },
    'order-ticker registered'
  );
}
