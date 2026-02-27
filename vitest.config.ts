import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Path alias strategy:
 *
 * The project has no src/ directory for production code — Next.js files live at
 * the project root (lib/, app/). Tests and test infrastructure live under src/.
 *
 * Aliases are ordered from most-specific to least-specific so Vite matches
 * the right prefix first:
 *
 *   @/__helpers__  → src/__helpers__   (test utilities)
 *   @/__fixtures__ → src/__fixtures__  (test fixtures)
 *   @/__tests__    → src/__tests__     (test files, for cross-test imports)
 *   @/             → ./                (fallback: project root for lib/, app/)
 *
 * This matches the tsconfig.json alias (@/* → ./*) for production code while
 * transparently redirecting test-only paths to src/.
 */
export default defineConfig({
  // react() adds JSX transformation for .tsx test files and all .tsx imports.
  // Required for Steps 1 & 3 (component tests with jsdom environment).
  plugins: [react()],

  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__helpers__/setup.ts'],
    include: [
      'src/__tests__/unit/**/*.test.ts',
      'src/__tests__/unit/**/*.test.tsx',
    ],
    coverage: {
      provider: 'v8',
      include: ['lib/**'],
      thresholds: {
        'lib/engines/': { statements: 90, branches: 85 },
        'lib/auth.ts': { statements: 85 },
      },
    },
  },
  resolve: {
    alias: [
      {
        find: '@/__helpers__',
        replacement: path.resolve(__dirname, 'src/__helpers__'),
      },
      {
        find: '@/__fixtures__',
        replacement: path.resolve(__dirname, 'src/__fixtures__'),
      },
      {
        find: '@/__tests__',
        replacement: path.resolve(__dirname, 'src/__tests__'),
      },
      {
        find: '@',
        replacement: path.resolve(__dirname),
      },
    ],
  },
});
