import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Plan 04-05 (Rule 3 deviation): React plugin required to compile JSX in
  // dynamic imports from component-render smoke tests (pages-smoke.test.ts).
  // Plan 04-00 envisioned smoke tests but didn't install the plugin.
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: false,
    setupFiles: ['./tests/_helpers/render.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx', 'tests/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
