'use client';

// Order-funnel kanban board — six fixed columns mirror the operational
// states the dispatcher cares about. We reuse the look of the project
// template's KanbanColumn/KanbanCard (rounded muted columns + soft cards)
// but render orders + leads instead of mock tasks and disable drag —
// the order status FSM owns transitions, not the UI.

import { Calendar, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type OrderKanbanColumnId =
  | 'lead'
  | 'processing'
  | 'pickup'
  | 'in-transit'
  | 'unloading-payment'
  | 'paid';

export interface OrderKanbanItem {
  id: string;
  kind: 'lead' | 'order';
  title: string;
  subtitle: string;
  client?: string | null;
  price: number | null;
  currency: string;
  channel?: string | null;
  sourceStatus: string;
  createdAt: string;
}

interface ColumnDef {
  id: OrderKanbanColumnId;
  title: string;
  description: string;
  match: (item: OrderKanbanItem) => boolean;
  tone: string;
}

const COLUMNS: ColumnDef[] = [
  {
    id: 'lead',
    title: 'Лид',
    description: 'Диалог с клиентом, ещё не оформлен',
    tone: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
    match: (i) => i.kind === 'lead',
  },
  {
    id: 'processing',
    title: 'В обработке',
    description: 'Заказ создан, ждёт назначения водителя',
    tone: 'bg-amber-200 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    match: (i) => i.kind === 'order' && i.sourceStatus === 'CREATED',
  },
  {
    id: 'pickup',
    title: 'В пути к клиенту · загрузка',
    description: 'Водитель назначен или едет на загрузку',
    tone: 'bg-sky-200 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
    match: (i) =>
      i.kind === 'order' && (i.sourceStatus === 'DRIVER_ASSIGNED' || i.sourceStatus === 'AT_LOADING'),
  },
  {
    id: 'in-transit',
    title: 'В пути к точке назначения',
    description: 'Груз в пути или на границе',
    tone: 'bg-blue-200 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
    match: (i) =>
      i.kind === 'order' && (i.sourceStatus === 'IN_TRANSIT' || i.sourceStatus === 'AT_BORDER'),
  },
  {
    id: 'unloading-payment',
    title: 'Разгрузка · ожидание оплаты',
    description: 'Груз доставлен, ждём оплату',
    tone: 'bg-violet-200 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
    match: (i) => i.kind === 'order' && i.sourceStatus === 'DELIVERED',
  },
  {
    id: 'paid',
    title: 'Оплачен',
    description: 'Заказ закрыт',
    tone: 'bg-emerald-200 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
    match: (i) => i.kind === 'order' && i.sourceStatus === 'CLOSED',
  },
];

function formatPrice(price: number | null, currency: string): string {
  if (price === null) return '';
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(price) + ' ' + currency;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
  } catch {
    return '';
  }
}

export function OrderKanbanBoard({ initial }: { initial: OrderKanbanItem[] }) {
  const buckets = new Map<OrderKanbanColumnId, OrderKanbanItem[]>(
    COLUMNS.map((c) => [c.id, []])
  );
  for (const item of initial) {
    for (const col of COLUMNS) {
      if (col.match(item)) {
        buckets.get(col.id)?.push(item);
        break;
      }
    }
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-3">
        {COLUMNS.map((col) => {
          const items = buckets.get(col.id) ?? [];
          return (
            <div
              key={col.id}
              className="bg-muted/50 flex w-[300px] min-w-[300px] flex-col rounded-xl p-3"
            >
              <div className="mb-3 flex items-start justify-between gap-2 px-1">
                <div>
                  <h3 className="text-foreground text-sm font-semibold">{col.title}</h3>
                  <p className="text-muted-foreground mt-0.5 text-[11px] leading-tight">
                    {col.description}
                  </p>
                </div>
                <Badge variant="secondary" className="h-6 shrink-0 rounded-md px-2 text-[11px]">
                  {items.length}
                </Badge>
              </div>
              <div className="flex min-h-[120px] flex-1 flex-col gap-2 rounded-lg p-1">
                {items.length === 0 ? (
                  <div className="text-muted-foreground/70 px-3 py-6 text-center text-[12px]">
                    Нет карточек
                  </div>
                ) : (
                  items.map((item) => (
                    <Card
                      key={item.id}
                      className="group relative gap-0 rounded-xl p-3 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            'inline-block rounded px-1.5 py-0.5 text-[10px] font-medium',
                            col.tone
                          )}
                        >
                          {col.title}
                        </span>
                        {item.channel ? (
                          <span className="text-muted-foreground text-[10px]">{item.channel}</span>
                        ) : null}
                      </div>
                      <p className="text-foreground mt-2 pr-2 text-sm font-medium leading-snug">
                        {item.title}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">{item.subtitle}</p>
                      {item.client ? (
                        <p className="text-muted-foreground mt-0.5 text-[11px]">
                          Клиент: {item.client}
                        </p>
                      ) : null}
                      <div className="text-muted-foreground mt-3 flex items-center gap-3 text-[11px]">
                        {item.price !== null ? (
                          <span className="text-foreground font-semibold">
                            {formatPrice(item.price, item.currency)}
                          </span>
                        ) : null}
                        <span className="ml-auto flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(item.createdAt)}
                        </span>
                        {item.kind === 'order' ? <Truck className="h-3 w-3" /> : null}
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
