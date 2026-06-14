'use client';

// Leaflet rendering: side panel (active orders + slider) + map (markers +
// optional Polyline + draggable truck marker). react-leaflet here only;
// the outer tracking-map.tsx dynamic-imports this file with ssr:false.

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useMemo } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  closestPointOnPolyline,
  interpolateAlongPolyline,
  type LngLat,
} from '../_lib/polyline-utils';
import type { ActiveOrder, RouteData, Truck } from './tracking-map';

interface MapInnerProps {
  trucks: Truck[];
  orders: ActiveOrder[];
  selectedOrderId: string | null;
  onSelectOrder: (id: string | null) => void;
  routeCache: Map<string, RouteData>;
  progressMap: Map<string, number>;
  onProgressChange: (orderId: string, value: number) => void;
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

const ORDER_STATUS_LABEL: Record<string, string> = {
  DRIVER_ASSIGNED: 'Водитель назначен',
  AT_LOADING: 'Загрузка',
  IN_TRANSIT: 'В пути',
  AT_BORDER: 'На границе',
};

function dotIcon(color: string, size = 18) {
  return L.divIcon({
    className: 'ailogist-marker',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};
      border:2px solid #fff;
      box-shadow:0 0 0 1px rgba(0,0,0,0.25), 0 2px 4px rgba(0,0,0,0.25);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function endpointIcon(label: string, color: string) {
  return L.divIcon({
    className: 'ailogist-endpoint',
    html: `<div style="
      width:22px;height:22px;border-radius:50%;
      background:${color};color:#fff;
      border:2px solid #fff;
      box-shadow:0 0 0 1px rgba(0,0,0,0.25), 0 2px 4px rgba(0,0,0,0.25);
      display:flex;align-items:center;justify-content:center;
      font-size:11px;font-weight:700;line-height:1;
    ">${label}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function truckRouteIcon() {
  return L.divIcon({
    className: 'ailogist-route-truck',
    html: `<div style="
      width:28px;height:28px;border-radius:8px;
      background:#0f172a;color:#fde68a;
      border:2px solid #fff;
      box-shadow:0 0 0 1px rgba(0,0,0,0.35), 0 3px 8px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;
      font-size:14px;line-height:1;
    ">🚚</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function FitBounds({ geometry }: { geometry: LngLat[] }) {
  const map = useMap();
  useMemo(() => {
    if (geometry.length < 2) return;
    const bounds = L.latLngBounds(geometry.map(([lng, lat]) => [lat, lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 9 });
  }, [map, geometry]);
  return null;
}

export function MapInner({
  trucks,
  orders,
  selectedOrderId,
  onSelectOrder,
  routeCache,
  progressMap,
  onProgressChange,
}: MapInnerProps) {
  const fleetCenter = useMemo<[number, number]>(() => {
    if (trucks.length === 0) return [50.45, 30.52];
    const sumLat = trucks.reduce((acc, t) => acc + t.geom.lat, 0);
    const sumLng = trucks.reduce((acc, t) => acc + t.geom.lng, 0);
    return [sumLat / trucks.length, sumLng / trucks.length];
  }, [trucks]);

  const selectedOrder = useMemo(
    () => (selectedOrderId ? orders.find((o) => o.id === selectedOrderId) ?? null : null),
    [orders, selectedOrderId]
  );
  const selectedRoute = selectedOrderId ? routeCache.get(selectedOrderId) ?? null : null;
  const selectedProgress =
    selectedOrderId !== null ? progressMap.get(selectedOrderId) ?? 0 : 0;

  // Pick the geometry the truck is currently animating along:
  //   - DRIVER_ASSIGNED with leg-0 snapshot present → animate truck-origin → pickup
  //   - everything else (IN_TRANSIT, AT_LOADING, ...) → animate pickup → delivery
  // Falls back to leg-1 if leg-0 is missing so we never lose the marker.
  const activeLegGeometry: LngLat[] | null = useMemo(() => {
    if (!selectedRoute) return null;
    const status = selectedOrder?.status;
    if (
      status === 'DRIVER_ASSIGNED' &&
      selectedRoute.leg0Geometry &&
      selectedRoute.leg0Geometry.length >= 2
    ) {
      return selectedRoute.leg0Geometry;
    }
    return selectedRoute.geometry.length >= 2 ? selectedRoute.geometry : null;
  }, [selectedRoute, selectedOrder]);

  const truckPosition: LngLat | null = useMemo(() => {
    if (!activeLegGeometry) return null;
    return interpolateAlongPolyline(activeLegGeometry, selectedProgress / 100);
  }, [activeLegGeometry, selectedProgress]);

  // Combined bounds: include leg-0 if present so the map fits both segments.
  const fitGeometry: LngLat[] = useMemo(() => {
    if (!selectedRoute) return [];
    return selectedRoute.leg0Geometry && selectedRoute.leg0Geometry.length >= 2
      ? [...selectedRoute.leg0Geometry, ...selectedRoute.geometry]
      : selectedRoute.geometry;
  }, [selectedRoute]);

  return (
    <div className="flex h-full">
      {/* Side panel */}
      <aside className="border-border bg-card flex w-80 shrink-0 flex-col border-r">
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Активные заказы</h2>
          <Badge variant="secondary" className="h-6 rounded-md px-2 text-[11px]">
            {orders.length}
          </Badge>
        </div>
        <div className="flex-1 overflow-y-auto">
          {orders.length === 0 ? (
            <div className="text-muted-foreground/80 px-4 py-6 text-center text-xs">
              Нет активных заказов
            </div>
          ) : (
            <ul className="divide-border divide-y">
              {orders.map((o) => {
                const progress = progressMap.get(o.id) ?? o.progressPercent;
                const selected = o.id === selectedOrderId;
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => onSelectOrder(selected ? null : o.id)}
                      className={cn(
                        'hover:bg-muted/60 w-full px-4 py-3 text-left transition-colors',
                        selected && 'bg-muted'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-foreground text-sm font-semibold">{o.number}</span>
                        <Badge variant="outline" className="h-5 rounded-md px-1.5 text-[10px]">
                          {ORDER_STATUS_LABEL[o.status] ?? o.status}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground mt-1 text-xs">
                        {o.fromCityName ?? '—'} → {o.toCityName ?? '—'}
                      </div>
                      {o.clientName ? (
                        <div className="text-muted-foreground/80 mt-0.5 text-[11px]">
                          Клиент: {o.clientName}
                        </div>
                      ) : null}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="bg-muted relative h-1.5 flex-1 overflow-hidden rounded-full">
                          <div
                            className="bg-sky-500 h-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-foreground text-[11px] tabular-nums">{progress}%</span>
                      </div>
                    </button>
                    {selected ? (
                      <div className="bg-muted/40 border-border border-t px-4 py-3">
                        <label className="flex flex-col gap-2 text-[11px]">
                          <span className="text-muted-foreground">Прогресс пути</span>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={1}
                            value={progress}
                            onChange={(e) => onProgressChange(o.id, Number(e.target.value))}
                            className="w-full"
                          />
                          {selectedRoute ? (
                            <div className="text-muted-foreground text-[11px]">
                              {Math.round(selectedRoute.distanceKm)} км ·{' '}
                              {Math.round(selectedRoute.etaSec / 3600)} ч (план)
                              {selectedRoute.source === 'haversine_fallback' ? (
                                <span className="text-amber-600"> · прямая линия</span>
                              ) : null}
                            </div>
                          ) : (
                            <div className="text-muted-foreground text-[11px]">
                              Загрузка маршрута…
                            </div>
                          )}
                        </label>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Map */}
      <div className="relative flex-1">
        <MapContainer
          center={fleetCenter}
          zoom={5}
          scrollWheelZoom
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {/* Fleet markers when no order selected; faded when selected. */}
          {trucks.map((t) => (
            <Marker
              key={t.id}
              position={[t.geom.lat, t.geom.lng]}
              icon={dotIcon(STATUS_COLOR[t.status], selectedOrderId ? 12 : 18)}
              opacity={selectedOrderId ? 0.45 : 1}
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

          {/* Selected order: leg-0 (dashed grey — truck→pickup) + leg-1 (solid
              blue — pickup→delivery) + endpoint markers + draggable truck on
              whichever leg is currently active. */}
          {selectedRoute && selectedRoute.geometry.length >= 2 && selectedOrder ? (
            <>
              <FitBounds geometry={fitGeometry} />
              {/* Leg-0: truck origin → pickup, dashed grey. Only when present. */}
              {selectedRoute.leg0Geometry && selectedRoute.leg0Geometry.length >= 2 ? (
                <>
                  <Polyline
                    positions={selectedRoute.leg0Geometry.map(
                      ([lng, lat]) => [lat, lng] as [number, number]
                    )}
                    pathOptions={{
                      color: '#64748b',
                      weight: 3,
                      opacity: 0.7,
                      dashArray: '8 8',
                    }}
                  />
                  <Marker
                    position={[
                      selectedRoute.leg0Geometry[0][1],
                      selectedRoute.leg0Geometry[0][0],
                    ]}
                    icon={endpointIcon('S', '#475569')}
                  >
                    <Popup>Стартовая позиция машины</Popup>
                  </Marker>
                </>
              ) : null}
              {/* Leg-1: pickup → delivery, solid blue. Always present. */}
              <Polyline
                positions={selectedRoute.geometry.map(
                  ([lng, lat]) => [lat, lng] as [number, number]
                )}
                pathOptions={{ color: '#0ea5e9', weight: 4, opacity: 0.85 }}
              />
              <Marker
                position={[
                  selectedRoute.geometry[0][1],
                  selectedRoute.geometry[0][0],
                ]}
                icon={endpointIcon('A', '#16a34a')}
              >
                <Popup>{selectedOrder.fromCityName ?? 'Точка загрузки'}</Popup>
              </Marker>
              <Marker
                position={[
                  selectedRoute.geometry[selectedRoute.geometry.length - 1][1],
                  selectedRoute.geometry[selectedRoute.geometry.length - 1][0],
                ]}
                icon={endpointIcon('B', '#dc2626')}
              >
                <Popup>{selectedOrder.toCityName ?? 'Точка разгрузки'}</Popup>
              </Marker>
              {truckPosition && activeLegGeometry ? (
                <Marker
                  position={[truckPosition[1], truckPosition[0]]}
                  icon={truckRouteIcon()}
                  draggable
                  eventHandlers={{
                    dragend: (e) => {
                      const target = e.target as L.Marker;
                      const ll = target.getLatLng();
                      // Snap to the leg the truck is currently animating along —
                      // leg-0 if status DRIVER_ASSIGNED with snapshot, else leg-1.
                      const snap = closestPointOnPolyline(
                        activeLegGeometry,
                        [ll.lng, ll.lat]
                      );
                      target.setLatLng([snap.point[1], snap.point[0]]);
                      onProgressChange(selectedOrder.id, snap.progress * 100);
                    },
                  }}
                >
                  <Popup>
                    {selectedOrder.number} · {selectedProgress}%
                  </Popup>
                </Marker>
              ) : null}
            </>
          ) : null}
        </MapContainer>
        {selectedOrderId ? (
          <button
            type="button"
            onClick={() => onSelectOrder(null)}
            className="bg-card text-foreground border-border absolute right-3 top-3 z-[1000] rounded-md border px-3 py-1.5 text-xs shadow-md hover:bg-muted"
          >
            Сбросить выбор
          </button>
        ) : null}
      </div>
    </div>
  );
}
