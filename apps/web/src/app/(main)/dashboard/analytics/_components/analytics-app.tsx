'use client';
// apps/web/src/app/(main)/dashboard/analytics/_components/analytics-app.tsx
// Recharts requires 'use client' — Pitfall #6.
// D-41 — 5 charts: big-number avg call duration, summary tiles, conversion
// funnel, channel split donut, revenue line chart. Window selector at top (D-43).
import type { KpiResponse } from '@ai-logist/shared-types/api/analytics';
import { formatMoney } from '@/lib/format';
import { ChannelSplit } from './channel-split';
import { ConversionFunnel } from './conversion-funnel';
import { RevenueTrend } from './revenue-trend';
import { WindowSelector } from './window-selector';

function formatDurationMmSs(s: number | null): string {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function AnalyticsApp({
  kpi,
  window,
}: {
  kpi: KpiResponse | null;
  window: 'day' | 'week' | 'month';
}) {
  if (!kpi) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground text-sm">Период:</div>
          <WindowSelector value={window} />
        </div>
        <div className="text-muted-foreground">Нет данных</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-muted-foreground text-sm">Период:</div>
        <WindowSelector value={window} />
      </div>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg border-border border bg-card p-4">
          <div className="text-muted-foreground text-sm">Ср. длительность звонка</div>
          <div className="font-bold text-2xl">{formatDurationMmSs(kpi.avgCallDurationS)}</div>
        </div>
        <div className="rounded-lg border-border border bg-card p-4">
          <div className="text-muted-foreground text-sm">Выручка</div>
          <div className="font-bold text-2xl">{formatMoney(kpi.revenue.amount, 'ru')}</div>
        </div>
        <div className="rounded-lg border-border border bg-card p-4">
          <div className="text-muted-foreground text-sm">Заказы</div>
          <div className="font-bold text-2xl">{kpi.orders.created}</div>
        </div>
        <div className="rounded-lg border-border border bg-card p-4">
          <div className="text-muted-foreground text-sm">Доставлено</div>
          <div className="font-bold text-2xl">{kpi.orders.delivered}</div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <ConversionFunnel funnel={kpi.conversionFunnel} />
        <ChannelSplit byChannel={kpi.byChannel} />
      </div>

      <RevenueTrend amount={kpi.revenue.amount} window={window} />
    </div>
  );
}
