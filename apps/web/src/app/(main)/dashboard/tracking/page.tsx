// /dashboard/tracking — live fleet map + active-order panel.
//
// Server Component hands the initial truck + active-order list to the
// client widget; the widget polls /api/trucks + /api/orders every 10s for
// "live" updates. Route geometry per order is fetched lazily on click.

import 'server-only';
import { TruckSchema } from '@ai-logist/shared-types/api/trucks';
import type { Metadata } from 'next';
import { z } from 'zod/v4';
import { apiGet } from '@/lib/api';
import { TrackingMap } from './_components/tracking-map';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Live tracking — AI-Логист',
};

const ACTIVE_STATUSES = ['DRIVER_ASSIGNED', 'AT_LOADING', 'IN_TRANSIT', 'AT_BORDER'] as const;

const ActiveOrderRow = z.object({
  id: z.string(),
  number: z.string(),
  status: z.string(),
  progressPercent: z.number().int(),
  fromCityName: z.string().nullish(),
  toCityName: z.string().nullish(),
  clientName: z.string().nullish(),
  truckId: z.string().nullish(),
});

export default async function TrackingPage() {
  let initialTrucks: z.infer<typeof TruckSchema>[] = [];
  try {
    initialTrucks = await apiGet('/trucks?limit=100', z.array(TruckSchema));
  } catch (err) {
    console.error('[tracking] initial trucks fetch failed', err);
  }
  // Active orders — 4 status buckets fetched in parallel because the list
  // endpoint accepts a single status at a time.
  const initialOrders: z.infer<typeof ActiveOrderRow>[] = [];
  await Promise.all(
    ACTIVE_STATUSES.map(async (s) => {
      try {
        const rows = await apiGet(`/orders?status=${s}&limit=50`, z.array(ActiveOrderRow));
        initialOrders.push(...rows);
      } catch (err) {
        console.error(`[tracking] orders ${s} fetch failed`, err);
      }
    })
  );
  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col gap-3 p-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Парк в реальном времени</h1>
          <p className="text-muted-foreground text-sm">
            {initialTrucks.length} машин · {initialOrders.length} активных заказов · обновление 10
            сек
          </p>
        </div>
      </header>
      <div className="border-border bg-background min-h-0 flex-1 overflow-hidden rounded-lg border">
        <TrackingMap initialTrucks={initialTrucks} initialOrders={initialOrders} />
      </div>
    </div>
  );
}
