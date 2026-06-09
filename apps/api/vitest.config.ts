import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    testTimeout: 15_000,
    hookTimeout: 30_000,
    // Vitest 4: projects replace deprecated 'projects' workspace config
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts', 'src/**/*.test.ts'],
          environment: 'node',
          // Phase 2 Wave 0: centralized fake-timers preset for snapshot stability.
          // Loaded only by the `unit` project; integration suites manage their own clocks
          // (testcontainers + real DB cannot use frozen Date).
          setupFiles: ['./tests/_helpers/fake-timers.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
          // Phase 2 Wave 0: bumped from 60s → 90s — testcontainers PostGIS 17-3.5 cold-start
          // plus migration apply plus seed run can exceed 60s on cold Docker pulls.
          testTimeout: 90_000,
        },
      },
      {
        test: {
          name: 'smoke',
          include: ['tests/smoke/**/*.test.ts'],
          environment: 'node',
          testTimeout: 60_000,
        },
      },
    ],
  },
});
