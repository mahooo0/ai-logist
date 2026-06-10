// apps/web/src/app/(main)/dashboard/orders/page.tsx — Phase 4 ADMIN-NEW-02
// Server Component — NO 'use client', NO 'use cache' (D-12 — orders is dynamic).

import {
  type OrderListItem,
  OrderListItemSchema,
  OrderListQuerySchema,
} from '@ai-logist/shared-types/api/orders';
import type { Metadata } from 'next';
import { z } from 'zod/v4';
import { apiGet } from '@/lib/api';
import { OrdersApp } from './_components/orders-app';

export const metadata: Metadata = { title: 'Заказы' };

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  // Flatten possible string[] → first value (URLSearchParams native shape).
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string') flat[k] = v;
    else if (Array.isArray(v) && typeof v[0] === 'string') flat[k] = v[0];
  }
  const parsed = OrderListQuerySchema.safeParse(flat);
  const query: Record<string, string> = parsed.success
    ? Object.fromEntries(Object.entries(parsed.data).map(([k, v]) => [k, String(v)]))
    : { limit: '50', offset: '0' };

  const qs = new URLSearchParams(query).toString();

  let initial: OrderListItem[] = [];
  try {
    initial = await apiGet(`/orders?${qs}`, z.array(OrderListItemSchema));
  } catch {
    initial = [];
  }

  return (
    <div className="space-y-4 p-4">
      <header className="space-y-1">
        <h1 className="font-bold text-2xl tracking-tight">Заказы</h1>
        <p className="text-muted-foreground text-sm">Заказы из голосового и Telegram канала</p>
      </header>
      <OrdersApp initialOrders={initial} initialQuery={flat} />
    </div>
  );
}
