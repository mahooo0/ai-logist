// apps/web/src/app/(main)/dashboard/default/_components/kpi-tile.tsx
// Compact KPI tile used by /dashboard/default (D-40 — landing screen).
export function KpiTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="space-y-1 rounded-lg border-border border bg-card p-4">
      <div className="text-muted-foreground text-sm">{label}</div>
      <div className="font-bold text-2xl">{value}</div>
      {hint && <div className="text-muted-foreground text-xs">{hint}</div>}
    </div>
  );
}
