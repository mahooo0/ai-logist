// apps/web/src/app/(main)/dashboard/chat/_components/telegram-message.tsx
// D-20 — Telegram message bubble. Green TG badge + plain text.
// Channel value travels as a string literal so the rendered DOM advertises
// channel="telegram" for downstream tests.
import type { UnifiedMessage } from '@ai-logist/shared-types/api/clients';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function TelegramMessage({ msg }: { msg: UnifiedMessage }) {
  const channel = msg.channel; // 'telegram'
  const speaker = msg.role === 'ai' ? 'Бот' : msg.role === 'manager' ? 'Менеджер' : 'Клиент';

  return (
    <div
      data-channel={channel}
      data-testid="telegram-message"
      className={cn(
        'rounded-lg border-border border p-3',
        msg.role === 'ai'
          ? 'bg-accent'
          : msg.role === 'manager'
            ? 'bg-blue-50 dark:bg-blue-950/30'
            : 'bg-muted'
      )}
    >
      <div className="mb-1 flex items-center gap-2">
        <Badge className="bg-green-600 text-white" data-testid="telegram-badge">
          TG
        </Badge>
        <span className="text-muted-foreground text-xs">{speaker}</span>
      </div>
      <p className="text-sm">{msg.text}</p>
    </div>
  );
}
