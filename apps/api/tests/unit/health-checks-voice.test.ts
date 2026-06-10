// apps/api/tests/unit/health-checks-voice.test.ts
// Phase 3.1 Plan 03.1-03 — structural assertions on the checkVoice() helper
// in apps/api/src/routes/health.ts. Asserts module-level cache + 60s TTL
// constant + 3 states (not_configured / ok / error) + dynamic SDK imports
// (so Phase 2/3 unit-test fixtures don't pull ElevenLabs/Twilio into memory).
// The full ok / error behavioral proof lives in Docker-gated integration
// tests because vitest can't ergonomically mock dynamic imports.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Resolve relative to this test file (vitest cwd is apps/api when invoked via
// pnpm --filter; this works from any caller).
const healthPath = fileURLToPath(new URL('../../src/routes/health.ts', import.meta.url));
const healthSrc = readFileSync(healthPath, 'utf8');

describe('Phase 3.1 — /api/health.checks.voice', () => {
  it('exposes a 60_000ms TTL cache constant (VOICE_TTL_MS)', () => {
    expect(healthSrc).toMatch(/VOICE_TTL_MS\s*=\s*60_000|VOICE_TTL_MS\s*=\s*60000/);
  });

  it('declares a module-level voiceCache variable', () => {
    expect(healthSrc).toMatch(/let\s+voiceCache/);
  });

  it('returns not_configured branch when env vars missing', () => {
    expect(healthSrc).toMatch(/'not_configured'/);
    // Fast-path check for missing env (no SDK boot, no network)
    expect(healthSrc).toMatch(
      /!apiKey\s*\|\|\s*!agentId\s*\|\|\s*!twSid\s*\|\|\s*!twToken|!config\.ELEVENLABS_API_KEY/
    );
  });

  it('pings ElevenLabs agents.get + Twilio accounts.fetch on ok path', () => {
    expect(healthSrc).toMatch(/ElevenLabsClient/);
    expect(healthSrc).toMatch(/agents.*get|conversationalAi/);
    expect(healthSrc).toMatch(/twilio/i);
    expect(healthSrc).toMatch(/accounts\(.*?\)\.fetch/);
  });

  it('captures error message into voiceCache.detail on error branch', () => {
    expect(healthSrc).toMatch(/status:\s*'error'/);
    expect(healthSrc).toMatch(/detail/);
  });

  it('uses dynamic imports for ElevenLabs + twilio SDKs (boot-light)', () => {
    // Dynamic import keeps Phase 2/3 unit-test fixtures from pulling the
    // voice SDKs into memory when not configured.
    expect(healthSrc).toMatch(/await import\(['"]@elevenlabs\/elevenlabs-js['"]\)/);
    expect(healthSrc).toMatch(/await import\(['"]twilio['"]\)/);
  });

  it('plumbs voice into the /api/health response checks object', () => {
    expect(healthSrc).toMatch(/voice:\s*voiceStatus|voice:\s*await checkVoice/);
  });
});
