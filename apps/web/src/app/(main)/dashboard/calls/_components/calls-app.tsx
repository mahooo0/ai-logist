'use client';

import type { Call } from '@ai-logist/shared-types/api/calls';
import { useRouter, useSearchParams } from 'next/navigation';
// apps/web/src/app/(main)/dashboard/calls/_components/calls-app.tsx
// Phase 4 ADMIN-NEW-08 — SOLE 'use client' boundary for /dashboard/calls.
// SWR refreshInterval=30 000 per D-56 (calls aren't created fast); tab-visibility
// pause per D-57. Filters update URL params (router.push) — D-29 bookmarkable.
import { useState } from 'react';
import useSWR from 'swr';

import { CallDetailModal } from './call-detail-modal';
import { CallsFilters } from './calls-filters';
import { CallsTable } from './calls-table';

const fetcher = async <T,>(url: string): Promise<T> => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`API ${r.status} for ${url}`);
  return r.json() as Promise<T>;
};

const isPausedByTab = () =>
  typeof document !== 'undefined' && document.visibilityState !== 'visible';

export function CallsApp({
  initialCalls,
  initialQuery,
}: {
  initialCalls: Call[];
  initialQuery: Record<string, string>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const qs = searchParams.toString() || new URLSearchParams(initialQuery).toString();

  const { data: calls = initialCalls } = useSWR<Call[]>(`/api/calls?${qs}`, fetcher, {
    fallbackData: initialCalls,
    refreshInterval: 30_000,
    revalidateOnFocus: true,
    isPaused: isPausedByTab,
  });

  function onFilterChange(next: Record<string, string>) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
    }
    router.push(`/dashboard/calls?${p.toString()}`);
  }

  const currentFilters: Record<string, string> = {};
  for (const [k, v] of searchParams.entries()) currentFilters[k] = v;

  return (
    <div className="space-y-4">
      <CallsFilters value={currentFilters} onChange={onFilterChange} />
      <CallsTable calls={calls} onRowClick={setSelectedId} />
      {selectedId && <CallDetailModal callId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
