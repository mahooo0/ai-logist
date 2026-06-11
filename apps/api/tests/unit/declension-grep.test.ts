import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// I18N-05 (Plan 05-02 — Wave 2). Asserts that `apps/api/src/lib/i18n.ts`
// uses arrow-separator templates only — no Russian/Ukrainian genitive
// patterns like "из {from}", "в {to}", "у {to}", "з {from}". Cities are
// stored nominative-only; runtime declension is out of scope for v1.
//
// File path is resolved via `fileURLToPath(new URL(...))` so vitest's cwd
// does not change the test outcome (Plan 05-01 NOTIF-02 audit pattern).

describe('I18N-05: declension-free templates (no genitive city forms)', () => {
  it('apps/api/src/lib/i18n.ts contains no "из {from}", "в {to}", "у {to}", or "з {from}" patterns', () => {
    const i18nPath = fileURLToPath(new URL('../../src/lib/i18n.ts', import.meta.url));
    const content = readFileSync(i18nPath, 'utf8');

    // Negative checks — none of these genitive patterns may appear.
    expect(content).not.toMatch(/из \{from\}/);
    expect(content).not.toMatch(/в \{to\}/);
    expect(content).not.toMatch(/у \{to\}/);
    expect(content).not.toMatch(/з \{from\}/);

    // Positive check — the declension-free arrow separator MUST be present
    // in the `quote-present` template for both RU and UA.
    expect(content).toMatch(/Маршрут: \{from\} → \{to\}/);
  });
});
