'use client';

// TrackingMap — Leaflet client component.
//
// Dynamic import of react-leaflet is required because Leaflet touches
// `window` at module load time and would crash the Next.js Server Component
// render pipeline otherwise. The dynamic() wrapper with ssr:false defers
// everything until the browser owns the document.

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

interface Truck {
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

const MapInner = dynamic(() => import('./tracking-map-inner').then((m) => m.MapInner), {
  ssr: false,
  loading: () => (
    <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
      Загрузка карты…
    </div>
  ),
});

export function TrackingMap({ initial }: { initial: Truck[] }) {
  const [trucks, setTrucks] = useState<Truck[]>(initial);

  useEffect(() => {
    const tick = async () => {
      try {
        const res = await fetch('/api/trucks?limit=100', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as Truck[];
        setTrucks(data);
      } catch (err) {
        console.error('[tracking] poll failed', err);
      }
    };
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, []);

  return <MapInner trucks={trucks} />;
}
