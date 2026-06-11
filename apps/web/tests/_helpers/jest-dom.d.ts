// Phase 6 D-22 — Type augmentation for @testing-library/jest-dom matchers.
// Extends vitest's Assertion with jest-dom custom matchers.
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare module 'vitest' {
  interface Assertion<T = unknown> extends TestingLibraryMatchers<T, void> {}
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<unknown, void> {}
}
