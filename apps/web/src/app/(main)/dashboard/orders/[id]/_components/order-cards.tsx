// apps/web/src/app/(main)/dashboard/orders/[id]/_components/order-cards.tsx
// Left column of detail layout (D-36). 4 read-only cards: client / route / truck / cargo.
// NO action buttons in v1 (D-37).
import type { Order, OrderDetailExtended } from '@ai-logist/shared-types/api/orders';
import { formatPhone } from '@/lib/format';

type Detail = OrderDetailExtended;

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 rounded-lg border-border border p-4">
      <h3 className="font-semibold">{title}</h3>
      <dl className="space-y-1 text-sm">{children}</dl>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function safePhone(e164: string | null | undefined): string {
  if (!e164) return '—';
  try {
    return formatPhone(e164);
  } catch {
    return e164;
  }
}

export function OrderCards({
  order,
  client,
  fromCity,
  toCity,
  truck,
}: {
  order: Order;
  client: Detail['client'];
  fromCity: Detail['fromCity'];
  toCity: Detail['toCity'];
  truck: Detail['truck'];
}) {
  return (
    <div className="space-y-4">
      <Card title="Клиент">
        <Row label="Имя" value={client?.name ?? '—'} />
        <Row label="Телефон" value={safePhone(client?.phone)} />
        <Row label="Язык" value={client?.lang ?? '—'} />
      </Card>

      <Card title="Маршрут">
        <Row label="Откуда" value={fromCity?.nameRu ?? '—'} />
        <Row label="Куда" value={toCity?.nameRu ?? '—'} />
        <Row label="Расстояние" value={order.distanceKm != null ? `${order.distanceKm} км` : '—'} />
      </Card>

      <Card title="Машина">
        <Row
          label="ID"
          value={truck?.id ? <span className="font-mono">{truck.id.slice(0, 8)}</span> : '—'}
        />
        <Row label="Гос. номер" value={truck?.plateNumber ?? '—'} />
        <Row label="Тип" value={truck?.bodyType ?? '—'} />
      </Card>

      <Card title="Груз">
        <Row label="Заказ" value={<span className="font-mono">{order.number}</span>} />
        <Row label="Статус" value={order.status} />
        <Row label="Валюта" value={order.currency} />
      </Card>
    </div>
  );
}
