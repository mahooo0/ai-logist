// apps/api/tests/unit/preflight-script-shape.test.ts
//
// POLISH-05 — Wave 4 (Plan 05-04). preflight.ts script shape verification.
//
// Per D-50 + 05-VALIDATION.md: this test verifies SHAPE only (script exists +
// declares the 6 D-34 checks + uses fail-fast + supports --json) WITHOUT
// calling any real APIs. Real-API behaviour is covered by manual pre-demo run.

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const preflightPath = fileURLToPath(new URL('../../scripts/preflight.ts', import.meta.url));

describe('POLISH-05: preflight.ts script shape', () => {
  const source = existsSync(preflightPath) ? readFileSync(preflightPath, 'utf8') : '';

  it('script file exists at apps/api/scripts/preflight.ts and is non-empty', () => {
    expect(existsSync(preflightPath)).toBe(true);
    expect(source.length).toBeGreaterThan(0);
  });

  it('declares all 6 D-34 checks verbatim (Telegram / Twilio / DB / health / LLM / E2E)', () => {
    expect(source).toContain('Telegram bot alive');
    expect(source).toContain('Twilio number registered');
    expect(source).toContain('DB seeded');
    expect(source).toContain('/api/health');
    expect(source).toContain('LLM key check');
    expect(source).toContain('E2E smoke');
  });

  it('check 1 uses Bot.api.getMe() for Telegram check (grammy)', () => {
    expect(source).toMatch(/bot\.api\.getMe\(\)|getMe\(\)/);
    expect(source).toContain("from 'grammy'");
  });

  it('check 2 uses twilio.incomingPhoneNumbers.list for Twilio check', () => {
    expect(source).toContain('incomingPhoneNumbers');
  });

  it("check 3 queries trucks with status='available' + >= 10 threshold", () => {
    expect(source).toContain("status='available'");
    expect(source).toMatch(/10/);
  });

  it('check 4 asserts /api/health checks.postgis matches /^3\\.5/', () => {
    expect(source).toMatch(/\/\^3\\\.5\//);
  });

  it('check 5 uses anthropic.messages.create with max_tokens=1', () => {
    expect(source).toContain('messages.create');
    expect(source).toMatch(/max_tokens:\s*1/);
  });

  it('check 6 POSTs to /api/admin/simulate-call for ru_happy_path + ua_happy_path', () => {
    expect(source).toContain('/api/admin/simulate-call');
    expect(source).toContain('ru_happy_path');
    expect(source).toContain('ua_happy_path');
  });

  it('fail-fast: breaks loop on first error (D-34)', () => {
    expect(source).toMatch(/break;/);
  });

  it('supports --json flag for machine-readable output', () => {
    expect(source).toContain('--json');
  });

  it('exits with code 0 on all-pass, 1 on any-fail (process.exit + exitCode)', () => {
    expect(source).toMatch(/process\.exit\(exitCode\)/);
  });
});
