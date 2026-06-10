// apps/web/src/app/(main)/dashboard/default/_components/default-app.tsx
// /dashboard/default body — compact KPI tiles + last-5 calls + last-5 orders (D-40).
// No recharts here — those live in /dashboard/analytics.
import type { KpiResponse } from '@ai-logist/shared-types/api/analytics';
import type { Call } from '@ai-logist/shared-types/api/calls';
import type { OrderListItem } from '@ai-logist/shared-types/api/orders';
import { formatDate, formatDuration, formatMoney } from '@/lib/format';
import { KpiTile } from './kpi-tile';

export function DefaultApp({
  kpi,
  lastCalls,
  lastOrders,
}: {
  kpi: KpiResponse | null;
  lastCalls: Call[];
  lastOrders: OrderListItem[];
}) {
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiTile
          label="Звонки"
          value={String(kpi?.calls?.total ?? 0)}
          hint={`${kpi?.calls?.answered ?? 0} отвечено`}
        />
        <KpiTile label="Лиды" value={String(kpi?.leads?.total ?? 0)} />
        <KpiTile
          label="Заказы"
          value={String(kpi?.orders?.created ?? 0)}
          hint={`${kpi?.orders?.delivered ?? 0} доставлено`}
        />
        <KpiTile label="Выручка" value={formatMoney(kpi?.revenue?.amount ?? '0', 'ru')} />
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg border-border border p-4">
          <h2 className="mb-3 font-semibold">Последние звонки</h2>
          {lastCalls.length === 0 ? (
            <p className="text-muted-foreground text-sm">Нет звонков</p>
          ) : (
            <ul className="space-y-2">
              {lastCalls.map((c) => (
                <li
                  key={c.id}
                  className="flex justify-between gap-3 text-sm"
                  data-testid="recent-call"
                >
                  <span>{formatDate(c.createdAt, 'ru')}</span>
                  <span className="font-mono text-xs">{formatDuration(c.durationS)}</span>
                  <span className="text-muted-foreground">{c.outcome ?? '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border-border border p-4">
          <h2 className="mb-3 font-semibold">Последние заказы</h2>
          {lastOrders.length === 0 ? (
            <p className="text-muted-foreground text-sm">Нет заказов</p>
          ) : (
            <ul className="space-y-2">
              {lastOrders.map((o) => (
                <li
                  key={o.id}
                  className="flex justify-between gap-3 text-sm"
                  data-testid="recent-order"
                >
                  <span className="font-mono">{o.number}</span>
                  <span className="text-muted-foreground">{o.status}</span>
                  <span>{formatMoney(o.price, 'ru')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
