'use client';
import type { OrderDetailExtended } from '@ai-logist/shared-types/api/orders';
// apps/web/src/app/(main)/dashboard/orders/[id]/_components/order-detail-app.tsx
// Read-only detail layout (D-37 — NO actions in v1).
// Header (number + status + price) + channel breadcrumb (D-38) + 2-col grid
// (Left: client/route/truck/cargo cards; Right: vertical timeline).
import useSWR from 'swr';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/format';
import { OrderActionBar } from './order-action-bar';
import { OrderCards } from './order-cards';
import { OrderTimeline } from './order-timeline';

const fetcher = async <T,>(url: string): Promise<T> => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`API ${r.status}`);
  return r.json() as Promise<T>;
};

export function OrderDetailApp({ detail }: { detail: OrderDetailExtended }) {
  const { data = detail } = useSWR<OrderDetailExtended>(`/api/orders/${detail.order.id}`, fetcher, {
    fallbackData: detail,
    refreshInterval: 10_000, // D-56 — order detail polls a touch faster
    revalidateOnFocus: true,
    isPaused: () => typeof document !== 'undefined' && document.visibilityState !== 'visible',
  });

  const { order, client, fromCity, toCity, truck, events, lead } = data;

  // D-38 — Channel breadcrumb
  const channel = lead?.channel ?? null;
  const linkedCallId = events.find(
    (e) => e.payload && (e.payload as Record<string, unknown>).call_id
  )?.payload?.call_id as string | undefined;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <h1 className="font-bold text-2xl tracking-tight">{order.number}</h1>
          <Badge>{order.status}</Badge>
          <span className="font-mono text-lg">{formatMoney(order.price, 'ru')}</span>
        </div>
        {channel === 'voice' || channel === 'call' ? (
          <Button asChild variant="outline" size="sm" data-testid="open-call">
            <a
              href={linkedCallId ? `/dashboard/calls?openCall=${linkedCallId}` : '/dashboard/calls'}
            >
              Прослушать звонок
            </a>
          </Button>
        ) : channel === 'telegram' ? (
          <Button asChild variant="outline" size="sm" data-testid="open-chat">
            <a href={`/dashboard/chat?clientId=${client?.id ?? order.clientId}`}>Открыть диалог</a>
          </Button>
        ) : null}
      </header>

      {/* Phase 6 D-22 — admin action bar: status override + pause/resume + reset */}
      <OrderActionBar
        orderId={order.id}
        currentStatus={order.status}
        autoProgressPaused={order.autoProgressPaused ?? false}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <OrderCards
          order={order}
          client={client}
          fromCity={fromCity}
          toCity={toCity}
          truck={truck}
        />
        <OrderTimeline events={events} />
      </div>
    </div>
  );
}
