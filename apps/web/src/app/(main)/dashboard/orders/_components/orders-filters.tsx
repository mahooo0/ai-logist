'use client';
// apps/web/src/app/(main)/dashboard/orders/_components/orders-filters.tsx
// URL-bookmarkable filters per D-33. status + channel + date range presets.
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STATUS_OPTIONS = [
  { value: '', label: 'Все статусы' },
  { value: 'CREATED', label: 'Создан' },
  { value: 'DRIVER_ASSIGNED', label: 'Водитель назначен' },
  { value: 'AT_LOADING', label: 'На загрузке' },
  { value: 'IN_TRANSIT', label: 'В пути' },
  { value: 'AT_BORDER', label: 'На границе' },
  { value: 'DELIVERED', label: 'Доставлен' },
  // Phase 6 statuses — were missing from the dropdown so orders that reached
  // payment looked "lost".
  { value: 'DELIVERED_PENDING', label: 'Ожидает подтверждения' },
  { value: 'AWAITING_PAYMENT', label: 'Ожидает оплаты' },
  { value: 'CANCELED', label: 'Отменён' },
  { value: 'CLOSED', label: 'Закрыт' },
];

const CHANNEL_OPTIONS = [
  { value: '', label: 'Все каналы' },
  { value: 'voice', label: 'Голос' },
  { value: 'telegram', label: 'Telegram' },
];

function isoFromDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export function OrdersFilters({
  value,
  onChange,
}: {
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const status = value.status ?? '';
  const channel = value.channel ?? '';

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border-border border p-3">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-sm">Статус:</span>
        <Select
          value={status || 'all'}
          onValueChange={(v) => onChange({ ...value, status: v === 'all' ? '' : v })}
        >
          <SelectTrigger size="sm" className="min-w-[160px]">
            <SelectValue placeholder="Все статусы" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value || 'all'} value={opt.value || 'all'}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-sm">Канал:</span>
        <Select
          value={channel || 'all'}
          onValueChange={(v) => onChange({ ...value, channel: v === 'all' ? '' : v })}
        >
          <SelectTrigger size="sm" className="min-w-[140px]">
            <SelectValue placeholder="Все каналы" />
          </SelectTrigger>
          <SelectContent>
            {CHANNEL_OPTIONS.map((opt) => (
              <SelectItem key={opt.value || 'all'} value={opt.value || 'all'}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-1" data-testid="date-presets">
        <span className="text-muted-foreground text-sm">Период:</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange({ ...value, from: isoFromDaysAgo(1) })}
        >
          24ч
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange({ ...value, from: isoFromDaysAgo(7) })}
        >
          7д
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange({ ...value, from: isoFromDaysAgo(30) })}
        >
          30д
        </Button>
      </div>

      {(status || channel || value.from || value.to) && (
        <Button variant="ghost" size="sm" onClick={() => onChange({})} data-testid="clear-filters">
          Сбросить
        </Button>
      )}
    </div>
  );
}
