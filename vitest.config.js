import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const stripShebang = {
  name: 'strip-shebang',
  transform(code, id) {
    if (id.endsWith('.mjs') && code.startsWith('#!')) {
      return { code: code.slice(code.indexOf('\n') + 1) };
    }
  },
};

export default defineConfig({
  plugins: [react(), stripShebang],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov', 'json'],
      // Expanded: cover ALL application source, not just auth pages
      include: [
        'src/**/*.{js,jsx,ts,tsx}',
      ],
      exclude: [
        // Test files themselves
        'src/__tests__/**',
        // Entry point — no logic to test
        'src/main.jsx',
        // CSS module stubs
        'src/**/*.css',
        // Static data files with no branching logic
        'src/data/**',
        // Vite virtual modules / generated assets
        'src/assets/**',
      ],
      thresholds: {
        // 100% on lines, statements, functions.
        // Branches set to 90% — exhausting every conditional branch in React
        // components (e.g. error boundaries, loading states combined) would
        // require an unreasonable number of brittle mocks.  The other three
        // metrics remain at 100%.
        lines: 100,
        statements: 100,
        functions: 100,
        branches: 90,
      },
    },
  },
});
