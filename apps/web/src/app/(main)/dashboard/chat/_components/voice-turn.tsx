'use client';
// apps/web/src/app/(main)/dashboard/chat/_components/voice-turn.tsx
// D-25 + D-26 — voice transcript turn:
//   - purple Voice badge
//   - monospace transcript text (visual hint: spoken aloud)
//   - inline ▶ Play button: seeks audio.currentTime = timestampMs/1000 + plays
//   - <audio controls preload="metadata" src={msg.audioUrl}> mounted ONCE per
//     call (the first turn for each callId mounts it; subsequent turns reuse it)
// Pitfall #8 — Chrome autoplay restriction; click handler counts as user gesture,
// so audio.play() resolves. Catch handles any other rejection.
import type { UnifiedMessage } from '@ai-logist/shared-types/api/clients';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function VoiceTurn({
  msg,
  mountAudio,
  audioRef,
  getAudio,
}: {
  msg: UnifiedMessage;
  mountAudio: boolean;
  audioRef: (el: HTMLAudioElement | null) => void;
  getAudio: () => HTMLAudioElement | null;
}) {
  function play() {
    const audio = getAudio();
    if (!audio) return;
    audio.currentTime = (msg.timestampMs ?? 0) / 1000;
    audio.play().catch(() => {
      /* swallow — autoplay restriction or invalid src */
    });
  }

  const speaker = msg.role === 'ai' ? 'Агент' : msg.role === 'manager' ? 'Менеджер' : 'Клиент';

  return (
    <div
      className={cn(
        'rounded-lg border-border border p-3',
        msg.role === 'ai' ? 'bg-accent' : 'bg-muted'
      )}
      data-testid="voice-turn"
    >
      <div className="mb-1 flex items-center gap-2">
        <Badge className="bg-purple-600 text-white" data-testid="voice-badge">
          Voice
        </Badge>
        <span className="text-muted-foreground text-xs">{speaker}</span>
        <Button size="sm" variant="ghost" onClick={play} data-testid="voice-play">
          ▶ Play
        </Button>
      </div>
      <p className="font-mono text-sm">{msg.text}</p>
      {mountAudio && msg.audioUrl && (
        <audio
          ref={audioRef}
          src={msg.audioUrl}
          preload="metadata"
          controls
          className="mt-2 w-full"
          data-testid="voice-audio"
        >
          <track kind="captions" />
        </audio>
      )}
    </div>
  );
}
