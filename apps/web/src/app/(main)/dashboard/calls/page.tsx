// apps/web/src/app/(main)/dashboard/calls/page.tsx — Phase 4 ADMIN-NEW-08.
// SERVER COMPONENT — no 'use client', no 'use cache' (D-12 + D-59).
// Phase 4 implicit prerequisite: /api/calls + /api/calls/:id from Plan 04-03.
// Server-fetches the initial list; the Client Component takes over for
// SWR polling (refreshInterval=30 000 per D-56) and filter URL sync.

import { type Call, CallListQuerySchema, CallSchema } from '@ai-logist/shared-types/api/calls';
import type { Metadata } from 'next';
import { z } from 'zod/v4';
import { apiGet } from '@/lib/api';

import { CallsApp } from './_components/calls-app';

export const metadata: Metadata = {
  title: 'Звонки',
  description: 'Голосовые звонки через ElevenLabs + Twilio.',
};

export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // Coerce array values down to first string for safeParse — Next 16 search
  // params can be string | string[] | undefined; CallListQuerySchema expects
  // single values.
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string') flat[k] = v;
    else if (Array.isArray(v) && typeof v[0] === 'string') flat[k] = v[0];
  }

  const parsed = CallListQuerySchema.safeParse(flat);
  const query = parsed.success ? parsed.data : { limit: 50, offset: 0 };
  // URLSearchParams accepts string values only.
  const queryStringParts: Record<string, string> = {};
  for (const [k, v] of Object.entries(query)) {
    if (v != null) queryStringParts[k] = String(v);
  }
  const qs = new URLSearchParams(queryStringParts).toString();

  let initialCalls: Call[] = [];
  try {
    initialCalls = await apiGet(`/calls?${qs}`, z.array(CallSchema));
  } catch {
    initialCalls = [];
  }

  return (
    <div className="space-y-4 border-border p-4">
      <header className="space-y-1">
        <h1 className="font-bold text-2xl tracking-tight">Звонки</h1>
        <p className="text-muted-foreground text-sm">Голосовые звонки через ElevenLabs + Twilio.</p>
      </header>
      <CallsApp initialCalls={initialCalls} initialQuery={flat} />
    </div>
  );
}
