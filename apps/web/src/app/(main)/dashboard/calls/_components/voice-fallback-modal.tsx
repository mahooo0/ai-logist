'use client';

// apps/web/src/app/(main)/dashboard/calls/_components/voice-fallback-modal.tsx
// Phase 5 POLISH-03 — modal triggered from /dashboard/calls header.
// Pure demo content: plays pre-recorded ElevenLabs call from public/demo/.
// NO admin DB writes per CONTEXT D-31 (insurance content, not a system action).
//
// preload="metadata" (NOT "auto") per RESEARCH Pattern 8: avoids 15 MB
// download on calls page load; only HTTP headers + first frame fetched.
// border-border explicit per Tailwind v4 (Pitfall #13 — no implicit border color).

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function VoiceFallbackModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border border-border">
        <DialogHeader>
          <DialogTitle>Видео-резерв: реальный звонок ElevenLabs</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          {/* preload="metadata" prevents full 15 MB download on page load —
              only HTTP headers + first frame fetched. See RESEARCH Pattern 8. */}
          <video
            controls
            preload="metadata"
            className="w-full rounded-lg border border-border"
            src="/demo/voice-fallback.mp4"
            data-testid="voice-fallback-video"
          >
            <track
              kind="captions"
              srcLang="ru"
              src="/demo/voice-fallback.ru.vtt"
              label="Русские субтитры"
              default
            />
            <track
              kind="captions"
              srcLang="uk"
              src="/demo/voice-fallback.ua.vtt"
              label="Українські субтитри"
            />
            Ваш браузер не поддерживает HTML5 video.
          </video>
          <p className="mt-3 text-muted-foreground text-sm">
            Реальный звонок через ElevenLabs Agent + Twilio. Используется как резерв, если live-демо
            упадёт.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
