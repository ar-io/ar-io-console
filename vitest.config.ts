import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Minimal unit-test runner for pure logic (e.g. deep-link parsing).
// Uses the default node environment — no DOM/component harness is pulled in.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
