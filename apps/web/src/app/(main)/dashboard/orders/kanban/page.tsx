// /dashboard/orders/kanban — order-funnel kanban view.
//
// Server Component pulls leads + orders, hands a flat task list to the
// client board. Reuses the visual language of /dashboard/kanban (the
// template demo) without sharing its data layer.

import 'server-only';
import Link from 'next/link';
import { z } from 'zod/v4';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { apiGet } from '@/lib/api';
import { OrderKanbanBoard, type OrderKanbanItem } from './_components/order-kanban-board';

export const dynamic = 'force-dynamic';

const OrderRow = z.object({
  id: z.string(),
  number: z.string(),
  status: z.string(),
  price: z.string().or(z.number()),
  currency: z.string().default('UAH'),
  fromCityName: z.string().nullish(),
  toCityName: z.string().nullish(),
  clientName: z.string().nullish(),
  channel: z.string().nullish(),
  createdAt: z.string(),
});

const LeadRow = z.object({
  id: z.string(),
  stage: z.string(),
  tons: z.string().nullish(),
  bodyType: z.string().nullish(),
  fromCityId: z.string().nullish(),
  toCityId: z.string().nullish(),
  quotedPrice: z.string().nullish(),
  orderId: z.string().nullish(),
  channel: z.string().nullish(),
  createdAt: z.string(),
});

export default async function OrdersKanbanPage() {
  let orders: z.infer<typeof OrderRow>[] = [];
  let leads: z.infer<typeof LeadRow>[] = [];
  try {
    orders = await apiGet('/orders?limit=200', z.array(OrderRow));
  } catch (err) {
    console.error('[orders-kanban] orders fetch failed', err);
  }
  try {
    leads = await apiGet('/leads?limit=200', z.array(LeadRow));
  } catch (err) {
    console.error('[orders-kanban] leads fetch failed', err);
  }

  const tasks: OrderKanbanItem[] = [];
  for (const lead of leads) {
    if (lead.orderId) continue; // already has order, skip — will appear under order columns
    if (lead.stage === 'LOST' || lead.stage === 'WON') continue;
    tasks.push({
      id: `lead:${lead.id}`,
      kind: 'lead',
      title: lead.bodyType
        ? `Лид · ${Number(lead.tons ?? 0)} т, ${lead.bodyType}`
        : `Лид · ${lead.stage}`,
      subtitle: lead.stage,
      price: lead.quotedPrice ? Number(lead.quotedPrice) / 100 : null,
      currency: 'UAH',
      channel: lead.channel ?? null,
      sourceStatus: lead.stage,
      createdAt: lead.createdAt,
    });
  }
  for (const o of orders) {
    tasks.push({
      id: `order:${o.id}`,
      kind: 'order',
      title: o.number,
      subtitle: `${o.fromCityName ?? '—'} → ${o.toCityName ?? '—'}`,
      client: o.clientName ?? null,
      price: Number(o.price) / 100,
      currency: o.currency,
      channel: o.channel ?? null,
      sourceStatus: o.status,
      createdAt: o.createdAt,
    });
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="space-y-1">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/dashboard/default">Dashboard</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Воронка заказов</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="font-bold text-2xl text-foreground tracking-tight">Воронка заказов</h1>
        <p className="text-muted-foreground text-sm">
          {tasks.length} карточек · обновление при перезагрузке
        </p>
      </div>

      <OrderKanbanBoard initial={tasks} />
    </div>
  );
}
