import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

// POLISH-03 — Wave 5 (Plan 05-05) flips Wave 0 scaffold to real assertions.
// Validates demo-day voice fallback assets per CONTEXT D-28..D-32:
//   1. apps/web/public/demo/voice-fallback.mp4 exists
//   2. statSync().size < 15728640 (15 MB hard cap per D-29)
//   3. Bytes 4-8 of MP4 read "ftyp" (ISO BMFF box signature)
//   4. apps/web/public/demo/voice-fallback.ru.vtt starts with literal "WEBVTT"
//   5. apps/web/public/demo/voice-fallback.ua.vtt starts with literal "WEBVTT"
//      (UA captions per Open Question 4 recommendation — 5-min add)

// Vitest config does not preserve file:// URL on import.meta — resolve from cwd
// (apps/web) which is set by the workspace runner.
const PUBLIC_DEMO = path.resolve(process.cwd(), 'public/demo');
const MP4_PATH = path.join(PUBLIC_DEMO, 'voice-fallback.mp4');
const VTT_RU_PATH = path.join(PUBLIC_DEMO, 'voice-fallback.ru.vtt');
const VTT_UA_PATH = path.join(PUBLIC_DEMO, 'voice-fallback.ua.vtt');

describe('POLISH-03: voice-fallback assets exist + valid + within size budget', () => {
  it('voice-fallback.mp4 exists', () => {
    expect(() => statSync(MP4_PATH)).not.toThrow();
  });

  it('voice-fallback.mp4 size < 15728640 bytes (15 MB per D-29)', () => {
    const size = statSync(MP4_PATH).size;
    expect(size).toBeLessThan(15728640);
    expect(size).toBeGreaterThan(0);
  });

  it('voice-fallback.mp4 has valid ftyp magic bytes (ISO BMFF)', () => {
    const buf = readFileSync(MP4_PATH);
    // ftyp is at bytes 4-8 (after the 4-byte size prefix per ISO BMFF spec)
    const ftyp = buf.subarray(4, 8).toString('ascii');
    expect(ftyp).toBe('ftyp');
  });

  it('voice-fallback.ru.vtt starts with WEBVTT signature', () => {
    const content = readFileSync(VTT_RU_PATH, 'utf8');
    expect(content.substring(0, 6)).toBe('WEBVTT');
  });

  it('voice-fallback.ua.vtt starts with WEBVTT signature', () => {
    const content = readFileSync(VTT_UA_PATH, 'utf8');
    expect(content.substring(0, 6)).toBe('WEBVTT');
  });
});
