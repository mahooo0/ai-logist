'use client';
// apps/web/src/app/(main)/dashboard/analytics/_components/window-selector.tsx
// D-43 — day/week/month toggle, updates URL ?window= via router.push.
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

const WINDOWS = ['day', 'week', 'month'] as const;
type Window = (typeof WINDOWS)[number];

const LABELS: Record<Window, string> = {
  day: 'День',
  week: 'Неделя',
  month: 'Месяц',
};

export function WindowSelector({ value }: { value: Window }) {
  const router = useRouter();
  return (
    <div className="flex gap-1" data-testid="window-selector">
      {WINDOWS.map((w) => (
        <Button
          key={w}
          variant={value === w ? 'default' : 'outline'}
          size="sm"
          onClick={() => router.push(`/dashboard/analytics?window=${w}`)}
          data-window={w}
        >
          {LABELS[w]}
        </Button>
      ))}
    </div>
  );
}
