// apps/web/src/app/(main)/dashboard/analytics/page.tsx — Phase 4 ADMIN-05
// Server Component — MAY use 'use cache' per D-13 (KPI aggregated).
// Replaces Zenith mock-data analytics page (audit recorded in Plan 04-05 SUMMARY).
import 'server-only';
import { KpiResponseSchema } from '@ai-logist/shared-types/api/analytics';
import type { Metadata } from 'next';
import { apiGet } from '@/lib/api';
import { AnalyticsApp } from './_components/analytics-app';

export const metadata: Metadata = { title: 'Аналитика' };

type Window = 'day' | 'week' | 'month';

function isWindow(v: unknown): v is Window {
  return v === 'day' || v === 'week' || v === 'month';
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const w = Array.isArray(params.window) ? params.window[0] : params.window;
  const window: Window = isWindow(w) ? w : 'week';

  const kpi = await apiGet(`/analytics/kpi?window=${window}`, KpiResponseSchema).catch(() => null);

  return (
    <div className="space-y-6 p-4">
      <header>
        <h1 className="font-bold text-2xl tracking-tight">Аналитика</h1>
        <p className="text-muted-foreground text-sm">Воронка конверсии, выручка, по каналам</p>
      </header>
      <AnalyticsApp kpi={kpi} window={window} />
    </div>
  );
}
