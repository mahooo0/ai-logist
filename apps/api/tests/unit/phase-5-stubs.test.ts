import { describe, test } from 'vitest';

/**
 * Phase 5 acceptance criteria — monotonic verifier baseline.
 *
 * One pending marker per Phase 5 requirement. Each wave flips a deterministic
 * subset to it() blocks that reference the suite proving the claim. The
 * verifier asserts monotonic decrease via naive count of the marker substring.
 *
 * Expected sequence per 05-VALIDATION.md:
 *   W0 (test infra)              : 11 baseline
 *   W1 (NOTIF audit, no flips)   : 11
 *   W2 (i18n core)               :  8  — I18N-01, I18N-03, I18N-05
 *   W3 (snapshot + NOTIF + dates):  4  — POLISH-01, NOTIF-01, NOTIF-02, I18N-04
 *   W4 (simulate + adapter + pre):  1  — POLISH-02, POLISH-05, POLISH-06
 *   W5 (video + UAT)             :  0  — POLISH-03
 *
 * Comment hygiene rule (re-burned seven times now — Phase 1 / 2 / 3 / 3.1 / 4):
 * this docstring NEVER mentions the literal marker function name. The verifier
 * uses naive grep -c so any prose mention inflates the count.
 */
describe('Phase 5 — Demo Polish + Notifications + Final i18n: monotonic verifier baseline', () => {
  test.skip(
    'I18N-01 server-side i18n.ts ships renderBotReply with 11 keys x 2 langs (validated by i18n-dict.test.ts — Plan 05-02 Wave 2)'
  );
  test.skip(
    'I18N-03 ICU MessageFormat plural rules render correctly for n in {0,1,2,5,21,25} (validated by icu-plural.test.ts — Plan 05-02 Wave 2)'
  );
  test.skip(
    'I18N-04 formatDateLocale renders RU "8 июн, ср" + UA "8 чер, ср" (validated by apps/web/tests/unit/format-date-locale.test.ts — Plan 05-03 Wave 3)'
  );
  test.skip(
    'I18N-05 declension-free templates: arrow separator "Маршрут: {from} → {to}" (validated by declension-grep.test.ts — Plan 05-02 Wave 2)'
  );
  test.skip(
    'NOTIF-01 each ORDER_TRANSITION (DRIVER_ASSIGNED + IN_TRANSIT + DELIVERED) fires notifyClient post-commit (validated by apps/api/tests/integration/notif-fsm-transitions.test.ts — Plan 05-01 Wave 1 audit)'
  );
  test.skip(
    'NOTIF-02 no /track/ link in any notification template (validated by apps/api/tests/unit/i18n-no-track-link.test.ts — Plan 05-01 Wave 1 grep guard)'
  );
  test.skip(
    'POLISH-01 snapshot tests on 20 canonical extractRequest + 10 calcPrice inputs are byte-stable across 10 runs (validated by tests/snapshots/*.snap.ts + test:snapshot 10× loop — Plan 05-03 Wave 3)'
  );
  test.skip(
    'POLISH-02 POST /api/admin/simulate-call replays 5 scenarios end-to-end (validated by tests/integration/simulate-call.test.ts — Plan 05-04 Wave 4)'
  );
  test.skip(
    'POLISH-03 voice-fallback.mp4 exists, ≤15MB, valid MP4 magic bytes, WebVTT captions (validated by apps/web/tests/unit/voice-fallback-asset.test.ts — Plan 05-05 Wave 5)'
  );
  test.skip(
    'POLISH-05 preflight.ts script exists and exports 6 sequential checks (validated by tests/unit/preflight-script-shape.test.ts — Plan 05-04 Wave 4)'
  );
  test.skip(
    'POLISH-06 OpenAIAdapter + AnthropicAdapter produce same Zod-validated output for same input (validated by tests/unit/llm-provider-adapter.test.ts — Plan 05-04 Wave 4)'
  );
});
