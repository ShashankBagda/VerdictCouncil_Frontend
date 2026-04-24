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
      reporter: ['text', 'json-summary'],
      include: [
        'src/pages/auth/*.jsx',
        'src/components/auth/*.jsx',
      ],
      thresholds: {
        lines: 98,
        statements: 98,
      },
    },
  },
});
