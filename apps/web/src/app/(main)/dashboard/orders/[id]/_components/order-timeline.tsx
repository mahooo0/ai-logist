// apps/web/src/app/(main)/dashboard/orders/[id]/_components/order-timeline.tsx
// Vertical timeline of order_events (D-36).
// Each entry = type + actor pill + Intl timestamp + payload <details> JSON pretty-print.
import type { OrderEvent } from '@ai-logist/shared-types/api/orders';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/format';

const actorColor: Record<string, string> = {
  ai: 'bg-blue-600',
  manager: 'bg-purple-600',
  system: 'bg-zinc-600',
};

export function OrderTimeline({ events }: { events: OrderEvent[] }) {
  return (
    <div className="space-y-3 rounded-lg border-border border p-4">
      <h2 className="font-semibold text-lg">События</h2>
      {events.length === 0 ? (
        <p className="text-muted-foreground text-sm">Нет событий</p>
      ) : (
        <ol className="space-y-3">
          {events.map((ev) => (
            <li key={ev.id} className="border-border border-l-2 pl-3" data-testid="timeline-event">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm">{ev.type}</span>
                <Badge className={`${actorColor[ev.actor] ?? ''} text-white text-xs`}>
                  {ev.actor}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  {formatDate(ev.createdAt, 'ru')}
                </span>
              </div>
              {ev.payload && Object.keys(ev.payload).length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-muted-foreground text-xs">
                    payload
                  </summary>
                  <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-xs">
                    {JSON.stringify(ev.payload, null, 2)}
                  </pre>
                </details>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
