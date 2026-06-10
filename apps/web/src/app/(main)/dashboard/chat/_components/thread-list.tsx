'use client';
import { MessageSquareIcon, PhoneIcon } from 'lucide-react';
// apps/web/src/app/(main)/dashboard/chat/_components/thread-list.tsx
// Left rail — unified thread list (D-21). One row per client, derived from
// the recent leads index. SWR refreshInterval=15000 per D-56. Channel icon
// reflects the lead.channel; sorted by most recent updatedAt DESC.
import useSWR from 'swr';

import { cn } from '@/lib/utils';

type LeadRow = {
  id: string;
  clientId: string;
  channel: 'telegram' | 'voice' | 'call';
  stage: string;
  updatedAt: string;
};

const fetcher = async <T,>(url: string): Promise<T> => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`API ${r.status} for ${url}`);
  return r.json() as Promise<T>;
};

const isPausedByTab = () =>
  typeof document !== 'undefined' && document.visibilityState !== 'visible';

export function ThreadList({
  activeClientId,
  onSelect,
}: {
  activeClientId: string | null;
  onSelect: (clientId: string) => void;
}) {
  const { data: leads = [] } = useSWR<LeadRow[]>('/api/leads?limit=50', fetcher, {
    refreshInterval: 15000,
    revalidateOnFocus: true,
    isPaused: isPausedByTab,
  });

  // Dedupe to one row per clientId — keep the most recent lead.
  const seen = new Set<string>();
  const threads = leads.filter((l) => {
    if (seen.has(l.clientId)) return false;
    seen.add(l.clientId);
    return true;
  });

  return (
    <aside className="flex flex-col overflow-hidden">
      <header className="border-border border-b px-3 py-2 text-muted-foreground text-xs uppercase tracking-wide">
        Диалоги ({threads.length})
      </header>
      <div className="flex-1 overflow-y-auto" data-testid="thread-list">
        {threads.length === 0 && (
          <div className="p-4 text-muted-foreground text-sm">Нет активных диалогов</div>
        )}
        {threads.map((lead) => {
          const isActive = lead.clientId === activeClientId;
          const isVoice = lead.channel === 'voice' || lead.channel === 'call';
          return (
            <button
              key={lead.id}
              type="button"
              onClick={() => onSelect(lead.clientId)}
              className={cn(
                'flex w-full items-center gap-3 border-border border-b px-3 py-2 text-left hover:bg-accent',
                isActive && 'bg-accent'
              )}
              data-testid="thread-row"
            >
              <div className="shrink-0">
                {isVoice ? (
                  <PhoneIcon className="size-4 text-purple-600" />
                ) : (
                  <MessageSquareIcon className="size-4 text-green-600" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-sm">{lead.clientId.slice(0, 8)}…</div>
                <div className="truncate text-muted-foreground text-xs">{lead.stage}</div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
