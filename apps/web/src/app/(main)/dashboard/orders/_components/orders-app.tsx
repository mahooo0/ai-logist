'use client';
import type { OrderListItem } from '@ai-logist/shared-types/api/orders';
// apps/web/src/app/(main)/dashboard/orders/_components/orders-app.tsx
// SOLE 'use client' boundary for /dashboard/orders. SWR refreshInterval=15s (D-56);
// pause when tab hidden (D-57). Filter changes update URL search params via router.push (D-33).
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import useSWR from 'swr';
import { OrdersFilters } from './orders-filters';
import { OrdersTable } from './orders-table';

const fetcher = async <T,>(url: string): Promise<T> => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`API ${r.status}`);
  return r.json() as Promise<T>;
};

export function OrdersApp({
  initialOrders,
  initialQuery,
}: {
  initialOrders: OrderListItem[];
  initialQuery: Record<string, string>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // SWR key built from current search params (browser source of truth post-mount).
  const qs = useMemo(() => {
    const fromUrl = searchParams.toString();
    return fromUrl || new URLSearchParams(initialQuery).toString();
  }, [searchParams, initialQuery]);

  const { data: orders = initialOrders } = useSWR<OrderListItem[]>(`/api/orders?${qs}`, fetcher, {
    fallbackData: initialOrders,
    refreshInterval: 15_000, // D-56
    revalidateOnFocus: true,
    // D-57 — pause polling when tab hidden.
    isPaused: () => typeof document !== 'undefined' && document.visibilityState !== 'visible',
  });

  function onFilterChange(next: Record<string, string>) {
    const cleaned = Object.fromEntries(
      Object.entries(next).filter(([, v]) => v != null && v !== '')
    );
    const p = new URLSearchParams(cleaned);
    router.push(`/dashboard/orders?${p.toString()}`);
  }

  function onRowClick(orderId: string) {
    router.push(`/dashboard/orders/${orderId}`);
  }

  const currentFilters = useMemo(() => Object.fromEntries(searchParams.entries()), [searchParams]);

  return (
    <div className="space-y-4">
      <OrdersFilters value={currentFilters} onChange={onFilterChange} />
      <OrdersTable orders={orders} onRowClick={onRowClick} />
    </div>
  );
}
