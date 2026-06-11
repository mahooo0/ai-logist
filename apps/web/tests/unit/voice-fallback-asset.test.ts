import { describe, test } from 'vitest';

// POLISH-03 scaffold — Wave 5 (Plan 05-05) flips the pending marker to
// 3 it() blocks asserting the demo-day video fallback assets:
//   1. apps/web/public/demo/voice-fallback.mp4 exists and
//      fs.statSync().size < 15728640 (15 MB hard cap per D-29).
//   2. First 4 bytes of MP4 match an MP4 magic signature (ftyp box —
//      bytes 4-7 read "ftyp" with the 4-byte big-endian box size prefix).
//   3. apps/web/public/demo/voice-fallback.ru.vtt starts with the literal
//      "WEBVTT" 6-byte signature (W3C WebVTT spec section 4).
// Asset is a real recording (~30-60s) per CONTEXT D-28.
describe('POLISH-03: voice-fallback.mp4 + voice-fallback.ru.vtt assets', () => {
  test.todo('MP4 ≤15MB + valid magic bytes; WebVTT starts with WEBVTT signature');
});
