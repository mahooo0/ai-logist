// apps/api/tests/integration/voice-system-prompt.test.ts
// Phase 3.1 Plan 03.1-03 — structural assertions on the version-controlled
// ElevenLabs Agent system prompt (apps/api/src/channels/voice/elevenlabs-
// agent-config.md). Does NOT call ElevenLabs API; pure file-content grep.
// Confirms that what voice-setup.ts sends to ElevenLabs contains the
// non-negotiable structure: anti-injection prefix, 8-state FSM, 5-tool
// registry, RU+UA greetings, and cost-guard reference.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const promptPath = fileURLToPath(
  new URL('../../src/channels/voice/elevenlabs-agent-config.md', import.meta.url)
);
const prompt = readFileSync(promptPath, 'utf8');

describe('Phase 3.1 — ElevenLabs Agent system prompt', () => {
  it('contains an ANTI_INJECTION preamble section', () => {
    // Phase 2's ANTI_INJECTION_PREFIX literal label appears verbatim.
    expect(prompt).toMatch(/ANTI_INJECTION/);
    // Plus the canonical phrasing from Phase 2 system-prompt.ts (verbatim).
    expect(prompt).toContain(
      'You ONLY translate user requests into structured data via the registered tools'
    );
    expect(prompt).toContain('<client_message>...</client_message>');
  });

  it('declares all 8 FSM states', () => {
    expect(prompt).toMatch(/GREETING/);
    expect(prompt).toMatch(/COLLECT_REQUEST/);
    expect(prompt).toMatch(/MATCH/);
    expect(prompt).toMatch(/QUOTE/);
    expect(prompt).toMatch(/NEGOTIATE/);
    expect(prompt).toMatch(/CONFIRM/);
    expect(prompt).toMatch(/CREATE_ORDER/);
    expect(prompt).toMatch(/GOODBYE/);
  });

  it('lists the 5 tool registry endpoints', () => {
    for (const tool of [
      'extract-request',
      'nearest-truck',
      'calc-price',
      'create-order',
      'discount',
    ]) {
      expect(prompt).toContain(tool);
    }
  });

  it('contains RU greeting AND UA greeting templates', () => {
    // RU greeting variants
    expect(prompt).toMatch(/Здравствуйте/);
    // UA greeting variants (one of these MUST be present)
    expect(prompt).toMatch(/Доброго дня|Добрий день|Вітаю/);
  });

  it('explicitly forbids voicing prices that did not come from calc-price tool', () => {
    expect(prompt).toMatch(/calc-price|tool result/i);
    expect(prompt).toMatch(/NEVER voice numerical prices|never voice|не озвучивай|do not voice/i);
  });

  it('budget cap (max_duration_seconds) referenced', () => {
    expect(prompt).toMatch(/max_duration_seconds|10 min|600/);
  });

  it('lists Open Questions deferred to UAT-04', () => {
    expect(prompt).toMatch(/Open Questions/);
    // Open Question 1 — parameters vs args
    expect(prompt).toMatch(/parameters.*args|args.*parameters/);
    // Open Question 2 — HMAC signature header
    expect(prompt).toMatch(/HMAC|X-ElevenLabs-Signature|x-elevenlabs-signature/);
  });
});
