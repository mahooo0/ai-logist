'use client';
// apps/web/src/app/(main)/dashboard/calls/_components/calls-filters.tsx
// D-29 — outcome + lang + date range. Changes call onChange() with the new
// query map; calls-app pushes that into the URL via next/navigation router.
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useT } from '@/lib/i18n/use-t';

const OUTCOMES = ['completed', 'abandoned', 'escalated', 'error'] as const;
const LANGS = ['ru', 'ua'] as const;

const ALL = '__all__';

export function CallsFilters({
  value,
  onChange,
}: {
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const t = useT();

  function update(key: string, v: string) {
    const next = { ...value };
    if (!v || v === ALL) delete next[key];
    else next[key] = v;
    onChange(next);
  }

  return (
    <div className="flex flex-wrap gap-2 border-border border-b pb-3">
      {/* Outcome filter */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs">{t('calls.filter.outcome')}:</span>
        <Select value={value.outcome ?? ALL} onValueChange={(v) => update('outcome', v)}>
          <SelectTrigger className="w-44" data-testid="filter-outcome">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Все</SelectItem>
            {OUTCOMES.map((o) => (
              <SelectItem key={o} value={o}>
                {t(`calls.filter.outcome.${o}` as const)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lang filter */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs">Язык:</span>
        <Select value={value.lang ?? ALL} onValueChange={(v) => update('lang', v)}>
          <SelectTrigger className="w-28" data-testid="filter-lang">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Все</SelectItem>
            {LANGS.map((l) => (
              <SelectItem key={l} value={l}>
                {l.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date range preset — simple from-only for the demo */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs">Период:</span>
        <Select
          value={value._datePreset ?? ALL}
          onValueChange={(v) => {
            const next = { ...value };
            if (v === ALL) {
              delete next._datePreset;
              delete next.from;
            } else {
              next._datePreset = v;
              const now = new Date();
              const days = v === 'd1' ? 1 : v === 'd7' ? 7 : 30;
              const from = new Date(now.getTime() - days * 86400 * 1000);
              next.from = from.toISOString();
            }
            onChange(next);
          }}
        >
          <SelectTrigger className="w-36" data-testid="filter-date">
            <SelectValue placeholder="Все" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Все</SelectItem>
            <SelectItem value="d1">24 часа</SelectItem>
            <SelectItem value="d7">7 дней</SelectItem>
            <SelectItem value="d30">30 дней</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
