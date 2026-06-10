'use client';
import type { UnifiedMessage } from '@ai-logist/shared-types/api/clients';
// apps/web/src/app/(main)/dashboard/chat/_components/chat-app.tsx
// Phase 4 ADMIN-03 — Pitfall #9 mitigation: near-total rewrite of Zenith's
// chat-app. Zenith shipped a Zustand store + mock channels (WA/IG/email/SMS);
// we drop that entirely and consume our UNION API + manager intercept routes.
//
// Polling intervals per D-56:
//   - active thread messages: 5 000ms
//   - thread list (leads index): 15 000ms
// Tab-visibility pause per D-57 keeps background tabs from burning Postgres.
import { useState } from 'react';
import useSWR from 'swr';

import { ThreadList } from './thread-list';
import { ThreadView } from './thread-view';

const fetcher = async <T,>(url: string): Promise<T> => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`API ${r.status} for ${url}`);
  return r.json() as Promise<T>;
};

// Minimal lead shape consumed by the chat — full LeadSchema lives in
// @ai-logist/shared-types but we only need 4 fields here.
type ActiveLead = {
  id: string;
  channel: 'telegram' | 'voice' | 'call';
  managerActive: boolean;
};

const isPausedByTab = () =>
  typeof document !== 'undefined' && document.visibilityState !== 'visible';

export function ChatApp({
  initialClientId,
  initialMessages,
}: {
  initialClientId: string | null;
  initialMessages: UnifiedMessage[];
}) {
  const [activeClientId, setActiveClientId] = useState<string | null>(initialClientId);

  // Active-thread messages — SWR refresh per D-56 (5s).
  const { data: messages = initialMessages, mutate: mutateMessages } = useSWR<UnifiedMessage[]>(
    activeClientId ? `/api/clients/${activeClientId}/messages?limit=100&offset=0` : null,
    fetcher,
    {
      fallbackData: initialMessages,
      refreshInterval: 5000,
      revalidateOnFocus: true,
      isPaused: isPausedByTab,
    }
  );

  // Most recent lead for the active client — drives intercept controls.
  const { data: leads, mutate: mutateLeads } = useSWR<ActiveLead[]>(
    activeClientId ? `/api/leads?clientId=${activeClientId}&limit=1` : null,
    fetcher,
    {
      refreshInterval: 15000,
      revalidateOnFocus: true,
      isPaused: isPausedByTab,
    }
  );
  const activeLead: ActiveLead | null = leads && leads.length > 0 ? (leads[0] ?? null) : null;

  async function refreshAfterAction() {
    await Promise.all([mutateLeads(), mutateMessages()]);
  }

  return (
    <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-[1fr_2fr]">
      <ThreadList activeClientId={activeClientId} onSelect={(id) => setActiveClientId(id)} />
      {activeClientId ? (
        <ThreadView
          clientId={activeClientId}
          messages={messages}
          activeLead={activeLead}
          onLeadAction={refreshAfterAction}
        />
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center border-border border-l text-muted-foreground text-sm">
      Выберите диалог слева
    </div>
  );
}
