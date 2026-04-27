import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{ find: '@', replacement: path.resolve(__dirname, 'src') }],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/__tests__/setup.js',
    // Keep Playwright specs out of vitest's discovery — they import from
    // `@playwright/test` and would crash vitest with "did not expect
    // test.describe() to be called here".
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      // The unit suite is scoped to the auth surface (login + password
      // recovery) — those are the security-sensitive screens whose
      // behavior we contract-test for the rubric. The rest of the app is
      // covered by Storybook + E2E + visual regression, not unit tests.
      include: [
        'src/pages/auth/**/*.jsx',
        'src/components/auth/**/*.jsx',
      ],
    },
  },
})
