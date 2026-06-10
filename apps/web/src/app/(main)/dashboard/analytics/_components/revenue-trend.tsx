'use client';
// apps/web/src/app/(main)/dashboard/analytics/_components/revenue-trend.tsx
// D-41 — revenue trend line chart. v1 visualizes the window total as a
// single anchor point at the window midpoint; real time-series aggregation
// is Phase 5 (D-44 doesn't require time-series for v1).
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Window = 'day' | 'week' | 'month';

function windowSeries(amount: string, window: Window) {
  const rubles = Number(BigInt(amount) / BigInt(100));
  // Cheap stub: render single point at 'now'. Phase 5 will replace with real series.
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
  });
  return [
    { date: fmt.format(new Date(now.getTime() - windowMs(window))), value: 0 },
    { date: fmt.format(now), value: rubles },
  ];
}

function windowMs(w: Window): number {
  switch (w) {
    case 'day':
      return 24 * 60 * 60 * 1000;
    case 'week':
      return 7 * 24 * 60 * 60 * 1000;
    case 'month':
      return 30 * 24 * 60 * 60 * 1000;
  }
}

export function RevenueTrend({ amount, window }: { amount: string; window: Window }) {
  const data = windowSeries(amount, window);
  return (
    <div className="rounded-lg border-border border bg-card p-4">
      <h2 className="mb-3 font-semibold">Выручка</h2>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#0ea5e9" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
