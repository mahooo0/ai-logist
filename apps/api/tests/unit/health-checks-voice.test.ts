// apps/api/tests/unit/health-checks-voice.test.ts
// Phase 3.1 Wave 3 will flip — asserts /api/health.checks.voice returns
// 'not_configured' when env missing + 'ok' when mocked SDKs respond + 60s
// cache (D-28).
import { describe, test } from 'vitest';

describe('Phase 3.1 — /api/health.checks.voice', () => {
  test.todo(
    'Wave 3 flip: not_configured when env vars missing + ok when mocked SDKs respond + 60s cache'
  );
});
