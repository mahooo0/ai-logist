// Wraps @testing-library/react render() with a default mock SWR provider.
// Phase 4 Wave 0 ships placeholder helpers; Wave 4 (chat/calls) fleshes them
// out with the real SWRConfig provider once SWR is installed (Wave 1).
// Phase 6 D-22: @testing-library/jest-dom matchers wired via vitest/expect extend.
import { expect, afterEach, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';

// Extend vitest's expect with jest-dom matchers (toBeInTheDocument, etc.)
expect.extend(matchers);

// Cleanup DOM after each test to prevent stale element issues.
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Re-export render() from RTL once installed; consumers import from this helper.
export { fireEvent, render, screen, waitFor } from '@testing-library/react';
