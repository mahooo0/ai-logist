// Wraps @testing-library/react render() with a default mock SWR provider.
// Phase 4 Wave 0 ships placeholder helpers; Wave 4 (chat/calls) fleshes them
// out with the real SWRConfig provider once SWR is installed (Wave 1).
import { afterEach, vi } from 'vitest';

// Cleanup after each test (RTL auto-imports cleanup when @testing-library/react is loaded
// — placeholder retained for future custom providers).
afterEach(() => {
  vi.clearAllMocks();
});

// Re-export render() from RTL once installed; consumers import from this helper.
export { fireEvent, render, screen, waitFor } from '@testing-library/react';
