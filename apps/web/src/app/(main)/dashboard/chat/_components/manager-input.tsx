'use client';
// apps/web/src/app/(main)/dashboard/chat/_components/manager-input.tsx
// D-46 — manager-active input. Placeholder via useT('chat.managerMessagePlaceholder').
// Submits to /api/leads/:id/manager-message via the parent's onSubmit handler.
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useT } from '@/lib/i18n/use-t';

export function ManagerInput({ onSubmit }: { onSubmit: (text: string) => Promise<void> }) {
  const t = useT();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await onSubmit(trimmed);
      setText('');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex gap-2 border-border border-t p-3">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('chat.managerMessagePlaceholder')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        data-testid="manager-input"
      />
      <Button onClick={submit} disabled={sending || !text.trim()}>
        Отправить
      </Button>
    </div>
  );
}
