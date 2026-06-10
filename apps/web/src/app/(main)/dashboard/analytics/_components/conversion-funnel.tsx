'use client';
// apps/web/src/app/(main)/dashboard/analytics/_components/conversion-funnel.tsx
// D-41 — vertical conversion funnel bar chart (calls → answered → leads → orders → delivered).
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type Funnel = {
  calls: number;
  answered: number;
  leadsCreated: number;
  ordersConfirmed: number;
  delivered: number;
} | null;

export function ConversionFunnel({ funnel }: { funnel: Funnel }) {
  if (!funnel) {
    return (
      <div className="rounded-lg border-border border bg-card p-4">
        <h2 className="mb-3 font-semibold">Воронка конверсии</h2>
        <p className="text-muted-foreground">—</p>
      </div>
    );
  }
  const data = [
    { stage: 'Звонки', count: funnel.calls },
    { stage: 'Отвечено', count: funnel.answered },
    { stage: 'Лиды', count: funnel.leadsCreated },
    { stage: 'Заказы', count: funnel.ordersConfirmed },
    { stage: 'Доставлено', count: funnel.delivered },
  ];
  return (
    <div className="rounded-lg border-border border bg-card p-4">
      <h2 className="mb-3 font-semibold">Воронка конверсии</h2>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis dataKey="stage" type="category" />
          <Tooltip />
          <Bar dataKey="count" fill="#2563eb" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
