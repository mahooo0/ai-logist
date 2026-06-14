'use client';

// Tracking client widget: polls trucks + active orders, lazily loads route
// geometry per order on click, owns the progress state (debounced PATCH
// to /api/orders/:id/progress for both slider and drag-on-map writers).

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LngLat } from '../_lib/polyline-utils';

export interface Truck {
  id: string;
  name: string;
  plateNumber: string;
  driverName: string;
  driverPhone: string;
  capacityT: number;
  bodyType: 'tent' | 'ref' | 'iso' | 'container';
  status: 'available' | 'busy' | 'maintenance';
  geom: { lng: number; lat: number };
}

export interface ActiveOrder {
  id: string;
  number: string;
  status: string;
  progressPercent: number;
  fromCityName?: string | null;
  toCityName?: string | null;
  clientName?: string | null;
  truckId?: string | null;
}

export interface RouteData {
  geometry: LngLat[];
  distanceKm: number;
  etaSec: number;
  source: 'osrm' | 'haversine_fallback';
  // Leg-0: truck origin → pickup. Present when orders.pickup_origin_geom was
  // snapshot'd at DRIVER_ASSIGNED (migration 0007). Drives the dashed grey
  // polyline + truck animation during the truck-approaching-pickup phase.
  status?: string;
  leg0Geometry?: LngLat[];
  leg0DistanceKm?: number;
  leg0EtaSec?: number;
}

// AWAITING_PAYMENT included so payment-pending orders stay visible on the map
// until the manager confirms the order is paid (closes to CLOSED).
const ACTIVE_STATUSES = [
  'DRIVER_ASSIGNED',
  'AT_LOADING',
  'IN_TRANSIT',
  'AT_BORDER',
  'DELIVERED_PENDING',
  'AWAITING_PAYMENT',
];

const MapInner = dynamic(() => import('./tracking-map-inner').then((m) => m.MapInner), {
  ssr: false,
  loading: () => (
    <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
      Загрузка карты…
    </div>
  ),
});

async function fetchActiveOrders(): Promise<ActiveOrder[]> {
  const all: ActiveOrder[] = [];
  await Promise.all(
    ACTIVE_STATUSES.map(async (s) => {
      try {
        const res = await fetch(`/api/orders?status=${s}&limit=50`, { cache: 'no-store' });
        if (!res.ok) return;
        const rows = (await res.json()) as ActiveOrder[];
        all.push(...rows);
      } catch (err) {
        console.error(`[tracking] poll orders ${s} failed`, err);
      }
    })
  );
  return all;
}

export function TrackingMap({
  initialTrucks,
  initialOrders,
}: {
  initialTrucks: Truck[];
  initialOrders: ActiveOrder[];
}) {
  const [trucks, setTrucks] = useState<Truck[]>(initialTrucks);
  const [orders, setOrders] = useState<ActiveOrder[]>(initialOrders);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [routeCache, setRouteCache] = useState<Map<string, RouteData>>(new Map());
  // Local progress override: while the user is dragging slider/marker we don't
  // want the 10-second poll to clobber their in-flight edit. The server is
  // still the source of truth on fresh load.
  const [progressOverride, setProgressOverride] = useState<Map<string, number>>(new Map());
  const patchTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Polling.
  useEffect(() => {
    const tick = async () => {
      try {
        const res = await fetch('/api/trucks?limit=100', { cache: 'no-store' });
        if (res.ok) setTrucks((await res.json()) as Truck[]);
      } catch (err) {
        console.error('[tracking] poll trucks failed', err);
      }
      try {
        setOrders(await fetchActiveOrders());
      } catch (err) {
        console.error('[tracking] poll orders failed', err);
      }
    };
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, []);

  // Load route for selected order if not cached yet.
  useEffect(() => {
    if (!selectedOrderId) return;
    if (routeCache.has(selectedOrderId)) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/orders/${selectedOrderId}/route`, { cache: 'no-store' });
        if (!res.ok) {
          console.warn(`[tracking] route ${selectedOrderId} HTTP ${res.status}`);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setRouteCache((prev) => {
          const next = new Map(prev);
          next.set(selectedOrderId, {
            geometry: data.geometry,
            distanceKm: data.distanceKm,
            etaSec: data.etaSec,
            source: data.source,
            status: data.status,
            leg0Geometry: data.leg0Geometry,
            leg0DistanceKm: data.leg0DistanceKm,
            leg0EtaSec: data.leg0EtaSec,
          });
          return next;
        });
        // Server-supplied progress wins on initial load.
        setProgressOverride((prev) => {
          const next = new Map(prev);
          if (!next.has(selectedOrderId)) next.set(selectedOrderId, data.progressPercent);
          return next;
        });
      } catch (err) {
        console.error(`[tracking] route ${selectedOrderId} fetch failed`, err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedOrderId, routeCache]);

  const setOrderProgress = useCallback((orderId: string, value: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    setProgressOverride((prev) => {
      const next = new Map(prev);
      next.set(orderId, clamped);
      return next;
    });
    // Debounced PATCH so high-frequency slider events don't hammer the API.
    const existing = patchTimers.current.get(orderId);
    if (existing) clearTimeout(existing);
    patchTimers.current.set(
      orderId,
      setTimeout(async () => {
        try {
          await fetch(`/api/orders/${orderId}/progress`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ progressPercent: clamped }),
          });
        } catch (err) {
          console.error(`[tracking] PATCH progress ${orderId} failed`, err);
        }
      }, 250)
    );
  }, []);

  const progressMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) map.set(o.id, o.progressPercent);
    for (const [id, override] of progressOverride.entries()) map.set(id, override);
    return map;
  }, [orders, progressOverride]);

  return (
    <MapInner
      trucks={trucks}
      orders={orders}
      selectedOrderId={selectedOrderId}
      onSelectOrder={setSelectedOrderId}
      routeCache={routeCache}
      progressMap={progressMap}
      onProgressChange={setOrderProgress}
    />
  );
}
