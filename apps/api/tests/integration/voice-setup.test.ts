// apps/api/tests/integration/voice-setup.test.ts
// Phase 3.1 Plan 03.1-03 — structural assertions on apps/api/scripts/voice-
// setup.ts. Does NOT execute the script (would dial real APIs). Asserts the
// source code reaches into the right SDKs, validates the right env vars,
// falls back from VOICE_PUBLIC_URL → TELEGRAM_PUBLIC_URL per CONTEXT D-26,
// upserts the Agent idempotently, and configures the Twilio number webhook.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const scriptPath = fileURLToPath(new URL('../../scripts/voice-setup.ts', import.meta.url));
const src = readFileSync(scriptPath, 'utf8');

describe('Phase 3.1 — voice-setup CLI', () => {
  it('imports ElevenLabsClient and twilio SDK', () => {
    expect(src).toMatch(/@elevenlabs\/elevenlabs-js/);
    expect(src).toMatch(/from ['"]twilio['"]/);
  });

  it('validates 5+ required env vars', () => {
    for (const v of [
      'ELEVENLABS_API_KEY',
      'ELEVENLABS_WEBHOOK_SECRET',
      'TWILIO_ACCOUNT_SID',
      'TWILIO_AUTH_TOKEN',
      'TWILIO_PHONE_NUMBER',
    ]) {
      expect(src).toContain(v);
    }
  });

  it('falls back to TELEGRAM_PUBLIC_URL when VOICE_PUBLIC_URL absent', () => {
    expect(src).toMatch(
      /VOICE_PUBLIC_URL[\s\S]*TELEGRAM_PUBLIC_URL|TELEGRAM_PUBLIC_URL[\s\S]*VOICE_PUBLIC_URL/
    );
  });

  it('upserts Agent — update path when ELEVENLABS_AGENT_ID set, create otherwise', () => {
    expect(src).toMatch(/agentsApi\.update|agents\.update/);
    expect(src).toMatch(/agentsApi\.create|agents\.create/);
    expect(src).toContain('ELEVENLABS_AGENT_ID');
  });

  it('configures Twilio number voiceUrl + statusCallback', () => {
    expect(src).toMatch(/voiceUrl[\s\S]*webhook\/voice\/twilio/);
    expect(src).toMatch(/statusCallback[\s\S]*webhook\/voice\/twilio/);
  });

  it('reads elevenlabs-agent-config.md from disk', () => {
    expect(src).toMatch(/readFileSync[\s\S]*elevenlabs-agent-config/);
  });

  it('prints manual checklist for items Claude cannot automate', () => {
    expect(src).toMatch(/Manual Steps Required/);
    expect(src).toMatch(/SIP|sip\.elevenlabs\.io/);
  });

  it('exits 1 on missing env (not throws — CLI UX)', () => {
    expect(src).toMatch(/process\.exit\(1\)/);
  });

  it('caps conversation duration at 600s (10-min cost guard)', () => {
    expect(src).toMatch(/max_duration_seconds:\s*600/);
  });
});
