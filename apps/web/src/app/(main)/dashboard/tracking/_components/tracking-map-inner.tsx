'use client';

// MapInner — react-leaflet only. Module loads `leaflet` CSS + binds DOM, so
// it is never imported during SSR (see tracking-map.tsx dynamic import).

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useMemo } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';

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

const STATUS_LABEL: Record<Truck['status'], string> = {
  available: 'Свободна',
  busy: 'В рейсе',
  maintenance: 'На ремонте',
};

const BODY_LABEL: Record<Truck['bodyType'], string> = {
  tent: 'Тент',
  ref: 'Рефрижератор',
  iso: 'Изотерм',
  container: 'Контейнер',
};

const STATUS_COLOR: Record<Truck['status'], string> = {
  available: '#16a34a',
  busy: '#2563eb',
  maintenance: '#dc2626',
};

function makeIcon(color: string) {
  return L.divIcon({
    className: 'ailogist-truck-marker',
    html: `<div style="
      width:18px;height:18px;border-radius:50%;
      background:${color};
      border:2px solid #fff;
      box-shadow:0 0 0 1px rgba(0,0,0,0.25), 0 2px 4px rgba(0,0,0,0.25);
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

export function MapInner({ trucks }: { trucks: Truck[] }) {
  // Center the map roughly around the seeded fleet (Eastern Europe).
  const center = useMemo<[number, number]>(() => {
    if (trucks.length === 0) return [50.45, 30.52]; // Kyiv default
    const sumLat = trucks.reduce((acc, t) => acc + t.geom.lat, 0);
    const sumLng = trucks.reduce((acc, t) => acc + t.geom.lng, 0);
    return [sumLat / trucks.length, sumLng / trucks.length];
  }, [trucks]);

  return (
    <MapContainer
      center={center}
      zoom={5}
      scrollWheelZoom
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {trucks.map((t) => (
        <Marker
          key={t.id}
          position={[t.geom.lat, t.geom.lng]}
          icon={makeIcon(STATUS_COLOR[t.status])}
        >
          <Popup>
            <div style={{ minWidth: 200, fontSize: 13 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                {t.name} · {t.plateNumber}
              </div>
              <div style={{ color: '#666', marginBottom: 6 }}>
                {t.capacityT}т · {BODY_LABEL[t.bodyType]}
              </div>
              <div style={{ marginBottom: 4 }}>
                Статус:{' '}
                <span style={{ color: STATUS_COLOR[t.status], fontWeight: 600 }}>
                  {STATUS_LABEL[t.status]}
                </span>
              </div>
              <div>Водитель: {t.driverName}</div>
              <div style={{ color: '#666' }}>{t.driverPhone}</div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
