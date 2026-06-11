// /dashboard/tracking — live fleet map.
// Server Component shell hands the initial truck list to the client widget;
// the widget polls /api/trucks every 10s to fake real-time updates while we
// don't have the WebSocket plumbing on the seed-data demo path.

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

export default async function TrackingPage() {
  let initial: z.infer<typeof TruckSchema>[] = [];
  try {
    initial = await apiGet('/trucks?limit=100', z.array(TruckSchema));
  } catch (err) {
    console.error('[tracking] initial fetch failed', err);
  }
  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col gap-3 p-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Парк в реальном времени</h1>
          <p className="text-muted-foreground text-sm">
            {initial.length} машин · обновление каждые 10 секунд
          </p>
        </div>
      </header>
      <div className="border-border bg-background min-h-0 flex-1 overflow-hidden rounded-lg border">
        <TrackingMap initial={initial} />
      </div>
    </div>
  );
}
