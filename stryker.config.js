/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  packageManager: 'npm',
  testRunner: 'vitest',
  testRunnerNodeArgs: [],
  reporters: ['html', 'clear-text', 'progress'],
  htmlReporter: {
    fileName: 'reports/mutation/mutation.html',
  },
  coverageAnalysis: 'perTest',

  // Only mutate application source — skip stories, tests, and config files
  mutate: [
    'src/**/*.{js,jsx}',
    '!src/**/*.test.{js,jsx}',
    '!src/**/*.stories.{js,jsx}',
    '!src/**/*.spec.{js,jsx}',
    '!src/__tests__/**',
    '!src/main.jsx',
    '!src/index.css',
  ],

  // Mutation score threshold: CI fails if < 70% of mutants are killed
  thresholds: {
    high: 80,
    low: 70,
    break: 60,
  },

  // Vitest test runner configuration
  vitest: {
    configFile: 'vitest.config.js',
  },

  // Run in process for speed; isolate each mutation
  concurrency: 4,

  // Timeout multiplier — mutations may be slower than regular tests
  timeoutFactor: 1.5,
  timeoutMS: 30_000,

  // Discard mutations on type annotations and comments
  ignorePatterns: [
    'node_modules',
    'dist',
    'coverage',
    'e2e',
    'reports',
    '.storybook',
  ],
};

export default config;
