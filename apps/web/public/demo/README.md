# Voice fallback demo assets

Pre-recorded ElevenLabs call demo for the `/dashboard/calls` page — used as a fallback during the live demo if Twilio or ElevenLabs services have issues.

## Files

- `voice-fallback.mp4` — 30-60s real ElevenLabs call recording (RU happy path)
- `voice-fallback.ru.vtt` — WebVTT captions in Russian (~20 cues)
- `voice-fallback.ua.vtt` — WebVTT captions in Ukrainian (optional but recommended)

## Current state

The shipped `voice-fallback.mp4` is a **placeholder** (silent solid-color 30s clip, ~45 KB). It validates the wiring (modal + button + caption tracks + .gitattributes binary marker + file-size guard). **Before demo day**, re-record per the procedure below.

## Re-recording the video

When ElevenLabs voice tuning changes or the canonical happy-path script is updated:

1. **Record a real call** through the Twilio number → save raw recording.
2. **Trim** to peak conversation moments (30-60 seconds max).
3. **Encode** with ffmpeg to keep size under 15 MB per CONTEXT D-29:
   ```bash
   ffmpeg -i input.mp4 \
     -c:v libx264 -crf 28 -preset slow \
     -c:a aac -b:a 128k \
     -movflags +faststart \
     -t 60 voice-fallback.mp4
   ```
   Result: typically 5-10 MB for a 60-second 720p clip.
4. **Verify size:** `stat -f%z voice-fallback.mp4` must be < 15728640 bytes.
5. **Update captions** if dialog changed:
   - `voice-fallback.ru.vtt` — transcribe the new audio
   - `voice-fallback.ua.vtt` — translate or re-record
6. **Commit** with binary `.gitattributes` entry (already set in apps/web/.gitattributes).

## When to re-record

- ElevenLabs Agent voice changes (new voice_id)
- Price corridors change significantly (e.g., new rate_per_km in pricing_config)
- Demo script evolves (new canonical happy-path narrative)

## File-size guard (CI)

Plan 05-05 ships `apps/web/tests/unit/voice-fallback-asset.test.ts` that fails if MP4 exceeds 15 MB or VTT files lose their WEBVTT header.
