'use client';
// apps/web/src/app/(main)/dashboard/analytics/_components/channel-split.tsx
// D-41 — donut chart of leads by channel (voice vs telegram).
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS: Record<string, string> = {
  voice: '#9333ea',
  telegram: '#16a34a',
};

export function ChannelSplit({
  byChannel,
}: {
  byChannel: { voice: number; telegram: number } | null;
}) {
  if (!byChannel) {
    return (
      <div className="rounded-lg border-border border bg-card p-4">
        <h2 className="mb-3 font-semibold">Каналы</h2>
        <p className="text-muted-foreground">—</p>
      </div>
    );
  }
  const data = [
    { name: 'Голос', key: 'voice', value: byChannel.voice },
    { name: 'Telegram', key: 'telegram', value: byChannel.telegram },
  ].filter((d) => d.value > 0);

  return (
    <div className="rounded-lg border-border border bg-card p-4">
      <h2 className="mb-3 font-semibold">Каналы</h2>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={4}
          >
            {data.map((d) => (
              <Cell key={d.key} fill={COLORS[d.key] ?? '#64748b'} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
