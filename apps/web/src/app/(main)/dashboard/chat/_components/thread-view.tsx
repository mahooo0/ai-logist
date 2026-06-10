'use client';
import type { UnifiedMessage } from '@ai-logist/shared-types/api/clients';
// apps/web/src/app/(main)/dashboard/chat/_components/thread-view.tsx
// Right pane — mixed-timeline rendering with audio playback + intercept (D-20..D-26 + D-45..D-47).
//
// D-26 — single <audio> element per call. The map of refs lives here so the
// VoiceTurn instances share a single audio source; clicking any turn seeks
// the existing element and resumes playback (Pitfall #8 — user-gesture
// satisfies the autoplay restriction).
//
// D-47 — voice channel threads NEVER expose intercept controls.
import { useRef } from 'react';

import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/use-t';

import { ManagerInput } from './manager-input';
import { TelegramMessage } from './telegram-message';
import { VoiceTurn } from './voice-turn';

type ActiveLead = {
  id: string;
  channel: 'telegram' | 'voice' | 'call';
  managerActive: boolean;
};

export function ThreadView({
  clientId,
  messages,
  activeLead,
  onLeadAction,
}: {
  clientId: string;
  messages: UnifiedMessage[];
  activeLead: ActiveLead | null;
  onLeadAction: () => Promise<void>;
}) {
  const t = useT();

  // Shared map of audio elements keyed by callId. VoiceTurn registers its
  // <audio> ref via the audioRef callback; subsequent turns for the same call
  // do not re-mount the element (renderedCalls.has(callId)).
  const audioRefs = useRef<Map<string, HTMLAudioElement | null>>(new Map());

  // Per-render Set of callIds whose <audio> element has already been mounted
  // by an earlier message in this list (only the first turn of each call mounts
  // the audio). Fresh each render because `messages` is the only input.
  const renderedCalls = new Set<string>();

  async function intercept() {
    if (!activeLead) return;
    await fetch(`/api/leads/${activeLead.id}/intercept`, { method: 'POST' });
    await onLeadAction();
  }

  async function release() {
    if (!activeLead) return;
    await fetch(`/api/leads/${activeLead.id}/release`, { method: 'POST' });
    await onLeadAction();
  }

  async function sendManagerMessage(text: string) {
    if (!activeLead) return;
    await fetch(`/api/leads/${activeLead.id}/manager-message`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    await onLeadAction();
  }

  // D-47 enforcement: voice/call threads NEVER show intercept controls.
  const canIntercept =
    activeLead != null && activeLead.channel !== 'voice' && activeLead.channel !== 'call';
  const showManagerInput = canIntercept && activeLead?.managerActive === true;
  const showInterceptButton = canIntercept && activeLead?.managerActive === false;

  return (
    <div className="flex flex-col overflow-hidden border-border border-l">
      <header className="flex items-center justify-between border-border border-b px-4 py-3">
        <div className="text-muted-foreground text-sm">
          Клиент: <span className="font-mono text-xs">{clientId.slice(0, 8)}…</span>
        </div>
        <div className="flex gap-2">
          {showInterceptButton && (
            <Button size="sm" onClick={intercept} data-testid="intercept-button">
              {t('chat.intercept')}
            </Button>
          )}
          {showManagerInput && (
            <Button size="sm" variant="outline" onClick={release} data-testid="release-button">
              {t('chat.release')}
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto p-4" data-testid="thread-stream">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm">История сообщений пуста</div>
        )}
        {messages.map((m) => {
          if (m.channel === 'telegram') {
            return <TelegramMessage key={m.id} msg={m} />;
          }
          // Voice turn. Decide whether this turn mounts the <audio> element.
          const mountAudio = m.callId != null && !renderedCalls.has(m.callId);
          if (m.callId != null && mountAudio) renderedCalls.add(m.callId);
          return (
            <VoiceTurn
              key={m.id}
              msg={m}
              mountAudio={mountAudio}
              audioRef={(el) => {
                if (m.callId) audioRefs.current.set(m.callId, el);
              }}
              getAudio={() => (m.callId ? (audioRefs.current.get(m.callId) ?? null) : null)}
            />
          );
        })}
      </div>

      {showManagerInput && <ManagerInput onSubmit={sendManagerMessage} />}
    </div>
  );
}
