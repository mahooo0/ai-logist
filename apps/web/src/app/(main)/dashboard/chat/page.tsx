// apps/web/src/app/(main)/dashboard/chat/page.tsx — Phase 4 ADMIN-03.
// SERVER COMPONENT — no 'use client', no 'use cache' (D-12 + D-59).
// Fetches initial active-thread messages via apiGet so the page renders
// without a client-side spinner on first paint. The Client Component
// `_components/chat-app.tsx` takes over for SWR polling + interactions.

import { type UnifiedMessage, UnifiedMessageSchema } from '@ai-logist/shared-types/api/clients';
import type { Metadata } from 'next';
import { z } from 'zod/v4';
import { apiGet } from '@/lib/api';

import { ChatApp } from './_components/chat-app';

export const metadata: Metadata = {
  title: 'Чат',
  description: 'Чат с клиентами — Telegram + голос в едином таймлайне.',
};

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const params = await searchParams;
  const clientId = params.clientId ?? null;

  // Initial active-thread fetch (only when ?clientId= is set). Failures are
  // swallowed — the client will retry via SWR's first revalidate.
  let initialMessages: UnifiedMessage[] = [];
  if (clientId) {
    try {
      initialMessages = await apiGet(
        `/clients/${clientId}/messages?limit=100&offset=0`,
        z.array(UnifiedMessageSchema)
      );
    } catch {
      initialMessages = [];
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <header className="border-border border-b px-4 py-3">
        <h1 className="font-semibold text-xl tracking-tight">Чат</h1>
        <p className="text-muted-foreground text-xs">
          Telegram + голосовые звонки в едином таймлайне.
        </p>
      </header>
      <ChatApp initialClientId={clientId} initialMessages={initialMessages} />
    </div>
  );
}
