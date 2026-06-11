// NOTIF-02 grep guard — Wave 1 (Plan 05-01) flip.
//
// Public tracking link is deferred to v2 PUBLIC_V2-* (per ROADMAP §scope and
// Phase 5 CONTEXT D-03). Notification templates MUST NOT leak `/track/`
// substrings, `trackingUrl` props, or `public_token` field references. This
// guard runs as a unit test (no DB, no network) by reading the file from
// disk and asserting three forbidden substrings remain absent.
//
// Wave 1 flip rationale: the substrings are NOT present in v1 i18n.ts
// (audited in 05-01-NOTIF-AUDIT.md Check 3). This flip locks the contract
// so any future v2 / PUBLIC_V2 work that re-adds tracking links must do so
// in a new module rather than poisoning the i18n template surface.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('NOTIF-02: no /track/ link in i18n.ts', () => {
  it('apps/api/src/lib/i18n.ts contains no /track/, trackingUrl, or public_token substrings', () => {
    const i18nPath = fileURLToPath(new URL('../../src/lib/i18n.ts', import.meta.url));
    const content = readFileSync(i18nPath, 'utf8');
    expect(content).not.toMatch(/\/track\//);
    expect(content).not.toMatch(/trackingUrl/);
    expect(content).not.toMatch(/public_token/);
  });
});
