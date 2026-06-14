// Phase 1, Plan 01-08: 501 stub for /api/analytics/kpi
// Phase 4 Plan 04-03 (API-09): flipped to single-query implementation.
// RESEARCH Pattern 5 — uses FILTER (WHERE ...) for conditional aggregation,
// jsonb_build_object for nested response shape, bigint::text for revenue
// precision (kopecks fit in bigint; cast preserves precision via JSON string).
//
// Returns extended KpiResponseSchema per D-44:
//   - avgCallDurationS — average call length for the window (null if no calls)
//   - byChannel — lead count broken down by 'voice' vs 'telegram'
//   - conversionFunnel — funnel counters for the /dashboard/default tiles

import { KpiResponseSchema } from '@ai-logist/shared-types/api/analytics';
import { sql } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

const analyticsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/analytics/kpi',
    {
      schema: {
        tags: ['analytics'],
        summary: 'KPI for dashboards (Phase 4 ADMIN-05 / API-09)',
        querystring: z.object({ window: z.enum(['day', 'week', 'month']).default('week') }),
        response: { 200: KpiResponseSchema },
      },
    },
    async (req) => {
      const { window } = req.query;
      const intervalSql =
        window === 'day'
          ? sql`INTERVAL '1 day'`
          : window === 'week'
            ? sql`INTERVAL '7 days'`
            : sql`INTERVAL '30 days'`;

      const result = await app.db.execute(sql`
        WITH window_bounds AS (
          SELECT NOW() - ${intervalSql} AS since
        ),
        call_stats AS (
          SELECT
            COUNT(*) FILTER (WHERE outcome IS NOT NULL) AS total,
            COUNT(*) FILTER (WHERE outcome IN ('completed','escalated')) AS answered,
            AVG(duration_s) FILTER (WHERE duration_s IS NOT NULL)::int AS avg_duration_s
          FROM calls
          WHERE created_at >= (SELECT since FROM window_bounds)
        ),
        lead_stats AS (
          SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE channel IN ('voice','call')) AS by_voice,
            COUNT(*) FILTER (WHERE channel = 'telegram') AS by_telegram
          FROM leads
          WHERE created_at >= (SELECT since FROM window_bounds)
        ),
        lead_stage_stats AS (
          SELECT COALESCE(
            jsonb_object_agg(stage, n) FILTER (WHERE stage IS NOT NULL),
            '{}'::jsonb
          ) AS by_stage
          FROM (
            SELECT stage::text AS stage, COUNT(*) AS n
            FROM leads
            WHERE created_at >= (SELECT since FROM window_bounds)
            GROUP BY stage
          ) g
        ),
        order_stats AS (
          SELECT
            COUNT(*) AS created,
            COUNT(*) FILTER (WHERE status IN ('DELIVERED','CLOSED')) AS delivered,
            COALESCE(SUM(price), 0)::text AS revenue_kopecks
          FROM orders
          WHERE created_at >= (SELECT since FROM window_bounds)
        )
        SELECT
          ${window}::text AS window,
          jsonb_build_object(
            'total',    (SELECT total FROM call_stats),
            'answered', (SELECT answered FROM call_stats)
          ) AS calls,
          jsonb_build_object(
            'total',   (SELECT total FROM lead_stats),
            'byStage', (SELECT by_stage FROM lead_stage_stats)
          ) AS leads,
          jsonb_build_object(
            'created',   (SELECT created FROM order_stats),
            'delivered', (SELECT delivered FROM order_stats)
          ) AS orders,
          jsonb_build_object(
            'amount',   COALESCE((SELECT revenue_kopecks FROM order_stats), '0'),
            'currency', 'UAH'
          ) AS revenue,
          (SELECT avg_duration_s FROM call_stats) AS "avgCallDurationS",
          jsonb_build_object(
            'voice',    COALESCE((SELECT by_voice FROM lead_stats), 0),
            'telegram', COALESCE((SELECT by_telegram FROM lead_stats), 0)
          ) AS "byChannel",
          jsonb_build_object(
            'calls',           (SELECT total FROM call_stats),
            'answered',        (SELECT answered FROM call_stats),
            'leadsCreated',    (SELECT total FROM lead_stats),
            'ordersConfirmed', (SELECT created FROM order_stats),
            'delivered',       (SELECT delivered FROM order_stats)
          ) AS "conversionFunnel"
      `);
      const row = (result.rows[0] ?? {}) as Record<string, unknown>;
      const callsJ = (row.calls ?? {}) as Record<string, unknown>;
      const leadsJ = (row.leads ?? {}) as Record<string, unknown>;
      const ordersJ = (row.orders ?? {}) as Record<string, unknown>;
      const revenueJ = (row.revenue ?? { amount: '0', currency: 'UAH' }) as Record<string, unknown>;
      const byChannelJ = (row.byChannel ?? {}) as Record<string, unknown>;
      const funnelJ = (row.conversionFunnel ?? {}) as Record<string, unknown>;
      const byStageRaw = (leadsJ.byStage ?? {}) as Record<string, unknown>;
      const byStage: Record<string, number> = {};
      for (const [k, v] of Object.entries(byStageRaw)) byStage[k] = Number(v ?? 0);
      return {
        window: row.window as 'day' | 'week' | 'month',
        calls: {
          total: Number(callsJ.total ?? 0),
          answered: Number(callsJ.answered ?? 0),
        },
        leads: {
          total: Number(leadsJ.total ?? 0),
          byStage,
        },
        orders: {
          created: Number(ordersJ.created ?? 0),
          delivered: Number(ordersJ.delivered ?? 0),
        },
        revenue: {
          amount: String(revenueJ.amount ?? '0'),
          currency: String(revenueJ.currency ?? 'UAH'),
        },
        avgCallDurationS: row.avgCallDurationS != null ? Number(row.avgCallDurationS) : null,
        byChannel: {
          voice: Number(byChannelJ.voice ?? 0),
          telegram: Number(byChannelJ.telegram ?? 0),
        },
        conversionFunnel: {
          calls: Number(funnelJ.calls ?? 0),
          answered: Number(funnelJ.answered ?? 0),
          leadsCreated: Number(funnelJ.leadsCreated ?? 0),
          ordersConfirmed: Number(funnelJ.ordersConfirmed ?? 0),
          delivered: Number(funnelJ.delivered ?? 0),
        },
      };
    }
  );
};

export default analyticsRoutes;
