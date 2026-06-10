// apps/web/src/app/(main)/dashboard/default/page.tsx — Phase 4 ADMIN-05 (KPI manager landing)
// Server Component — MAY use 'use cache' per D-13 (KPI aggregated, not realtime).
// Replaces Zenith mock-data page (audit recorded in Plan 04-05 SUMMARY).
import 'server-only';
import { KpiResponseSchema } from '@ai-logist/shared-types/api/analytics';
import { CallSchema } from '@ai-logist/shared-types/api/calls';
import { OrderListItemSchema } from '@ai-logist/shared-types/api/orders';
import type { Metadata } from 'next';
import { z } from 'zod/v4';
import { apiGet } from '@/lib/api';
import { DefaultApp } from './_components/default-app';

export const metadata: Metadata = { title: 'Сводка' };

export default async function DefaultPage() {
  const [kpi, lastCalls, lastOrders] = await Promise.all([
    apiGet('/analytics/kpi?window=week', KpiResponseSchema).catch(() => null),
    apiGet('/calls?limit=5&offset=0', z.array(CallSchema)).catch(() => []),
    apiGet('/orders?limit=5&offset=0', z.array(OrderListItemSchema)).catch(() => []),
  ]);

  return (
    <div className="space-y-6 p-4">
      <header>
        <h1 className="font-bold text-2xl tracking-tight">Сводка</h1>
        <p className="text-muted-foreground text-sm">Ключевые показатели за неделю</p>
      </header>
      <DefaultApp kpi={kpi} lastCalls={lastCalls} lastOrders={lastOrders} />
    </div>
  );
}
