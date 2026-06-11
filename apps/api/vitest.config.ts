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
          // Phase 5 Plan 05-03: extend include glob to pick up tests/snapshots/*.snap.ts
          // for POLISH-01 byte-stability snapshot tests. Same setup (fake-timers) and
          // same project name so `vitest run --project unit -t snapshot` still selects them.
          include: [
            'tests/unit/**/*.test.ts',
            'src/**/*.test.ts',
            'tests/snapshots/**/*.snap.ts',
          ],
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
          // Plan 02-04a Task 1: pre-populate DATABASE_URL + REDIS_URL defaults so config.ts
          // doesn't process.exit(1) when integration tests statically import production
          // modules (e.g. dialog-harness → intake.ts → config.LLM_TOKEN_BUDGET_PER_LEAD).
          // Tests that need real container URLs override inside beforeAll() via testcontainers.
          setupFiles: ['./tests/_helpers/integration-env.ts'],
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
