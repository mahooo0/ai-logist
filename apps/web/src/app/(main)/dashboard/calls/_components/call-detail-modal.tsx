'use client';

import type { CallDetail, TranscriptTurn } from '@ai-logist/shared-types/api/calls';
// apps/web/src/app/(main)/dashboard/calls/_components/call-detail-modal.tsx
// D-30 — shadcn Dialog. Top = audio player + linked-lead/order quick info;
// below = scrollable transcript with click-to-seek (D-26: audio.currentTime
// = turn.timestamp_ms / 1000 + play()).
import { useRef } from 'react';
import useSWR from 'swr';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDate, formatDuration } from '@/lib/format';

const fetcher = async <T,>(url: string): Promise<T> => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`API ${r.status} for ${url}`);
  return r.json() as Promise<T>;
};

export function CallDetailModal({ callId, onClose }: { callId: string; onClose: () => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { data } = useSWR<CallDetail>(`/api/calls/${callId}`, fetcher);

  function seek(turn: TranscriptTurn) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = (turn.timestamp_ms ?? 0) / 1000;
    audio.play().catch(() => {
      /* swallow — autoplay restriction satisfied by click */
    });
  }

  const linkedLead = data?.linkedLead;
  const linkedOrder = data?.linkedOrder;

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent
        className="max-h-[80vh] max-w-2xl overflow-hidden border-border sm:max-w-2xl"
        data-testid="call-detail-modal"
      >
        <DialogHeader>
          <DialogTitle>Звонок · {data?.call.id.slice(0, 8) ?? '—'}…</DialogTitle>
        </DialogHeader>
        {!data && <div className="text-muted-foreground text-sm">Загрузка…</div>}
        {data && (
          <div className="space-y-4 overflow-y-auto">
            <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
              <div>Время: {formatDate(data.call.createdAt, 'ru')}</div>
              <div>Длительность: {formatDuration(data.call.durationS)}</div>
              <div>Исход: {data.call.outcome ?? '—'}</div>
              <div>Язык: {data.call.lang?.toUpperCase() ?? '—'}</div>
            </div>

            {data.call.audioUrl && (
              <audio
                ref={audioRef}
                src={data.call.audioUrl}
                controls
                preload="metadata"
                className="w-full"
                data-testid="modal-audio"
              >
                <track kind="captions" />
              </audio>
            )}

            <div
              className="max-h-64 space-y-1 overflow-y-auto rounded-lg border-border border p-3"
              data-testid="modal-transcript"
            >
              {data.call.transcript.length === 0 && (
                <div className="text-muted-foreground text-sm">Транскрипт пуст</div>
              )}
              {data.call.transcript.map((turn, idx) => (
                <button
                  type="button"
                  // biome-ignore lint/suspicious/noArrayIndexKey: transcript has no stable id
                  key={idx}
                  onClick={() => seek(turn)}
                  className="block w-full rounded text-left hover:bg-accent"
                  data-testid="transcript-turn"
                >
                  <span className="text-muted-foreground text-xs">
                    [{((turn.timestamp_ms ?? idx * 1000) / 1000).toFixed(1)}s] {turn.speaker ?? '—'}
                  </span>
                  <span className="ml-2 font-mono text-sm">{turn.text ?? ''}</span>
                </button>
              ))}
            </div>

            <div className="flex gap-2 border-border border-t pt-3">
              {linkedLead && (
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`/dashboard/chat?clientId=${linkedLead.clientId}`}
                    data-testid="open-chat"
                  >
                    Открыть диалог
                  </a>
                </Button>
              )}
              {linkedOrder && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`/dashboard/orders/${linkedOrder.id}`} data-testid="open-order">
                    Открыть заказ
                  </a>
                </Button>
              )}
              {!linkedLead && !linkedOrder && (
                <span className="text-muted-foreground text-xs">Связанных лидов и заказов нет</span>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
