// apps/web/src/app/(main)/dashboard/orders/[id]/page.tsx — Phase 4 ADMIN-NEW-03
// Server Component — Next.js 16 async params + NO 'use cache' (D-12 — order detail
// can flip status from voice/telegram callbacks).

import {
  type OrderDetailExtended,
  OrderDetailExtendedSchema,
} from '@ai-logist/shared-types/api/orders';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { OrderDetailApp } from './_components/order-detail-app';

export const metadata: Metadata = { title: 'Заказ' };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // Next.js 16 async params (RESEARCH Pattern 5)

  let detail: OrderDetailExtended;
  try {
    detail = await apiGet(`/orders/${id}`, OrderDetailExtendedSchema);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-4 p-4">
      {/* biome-ignore lint/style/noNonNullAssertion: notFound() above ensures detail is defined */}
      <OrderDetailApp detail={detail!} />
    </div>
  );
}
