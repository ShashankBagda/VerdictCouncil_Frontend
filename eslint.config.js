import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import reactPlugin from 'eslint-plugin-react'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    '.vite',
    'coverage',
    'storybook-static',
    'playwright-report',
    'test-results',
  ]),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: {
      react: reactPlugin,
    },
    settings: {
      react: { version: 'detect' },
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'off',
    },
  },
  {
    files: [
      'vite.config.js',
      'vitest.config.js',
      'postcss.config.js',
      'playwright.config.js',
      'stryker.config.js',
      'e2e/**/*.{js,jsx}',
      'scripts/**/*.{js,mjs}',
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ['src/__tests__/**/*.{js,jsx}', 'src/**/*.test.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest, vi: 'readonly' },
    },
  },
  {
    files: ['src/components/ui/**/*.{js,jsx}', 'src/components/ai-elements/**/*.{js,jsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
