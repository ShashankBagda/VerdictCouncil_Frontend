/**
 * Lighthouse CI configuration.
 *
 * Performance budgets aligned with VerdictCouncil SLA targets:
 *   - First Contentful Paint (FCP): ≤ 1.8s
 *   - Largest Contentful Paint (LCP): ≤ 2.5s
 *   - Cumulative Layout Shift (CLS): ≤ 0.1
 *   - Total Blocking Time (TBT): ≤ 200ms
 *   - Performance score: ≥ 80
 *   - Accessibility score: ≥ 90 (WCAG 2.1 AA)
 *   - Best Practices: ≥ 90
 *   - SEO: ≥ 80
 *
 * Usage:
 *   npx lhci autorun         — collect + assert + upload
 *   npx lhci collect         — collect only
 *   npx lhci assert          — assert only (from collected data)
 *
 * Requires LHCI_GITHUB_APP_TOKEN env var to post CI status checks.
 */

/** @type {import('@lhci/cli').LhciConfig} */
export default {
  ci: {
    collect: {
      // Build output directory
      staticDistDir: './dist',
      // Pages to audit
      url: [
        '/',
        '/login',
        '/cases',
      ],
      numberOfRuns: 3,
      settings: {
        // Use desktop emulation — the app targets desktop users primarily
        formFactor: 'desktop',
        screenEmulation: {
          mobile: false,
          width: 1350,
          height: 940,
          deviceScaleFactor: 1,
        },
        throttlingMethod: 'simulate',
      },
    },

    assert: {
      assertions: {
        // Core Web Vitals
        'first-contentful-paint': ['warn', { maxNumericValue: 1800 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 200 }],

        // Lighthouse scores (0–1 scale)
        'categories:performance': ['warn', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.8 }],

        // No render-blocking resources
        'render-blocking-resources': ['warn', { maxLength: 0 }],

        // Images
        'uses-optimized-images': 'warn',
        'uses-webp-images': 'warn',

        // JavaScript
        'unused-javascript': ['warn', { maxNumericValue: 20_000 }],

        // HTTPS
        'is-on-https': 'off', // Local build, not HTTPS
      },
    },

    upload: {
      target: 'temporary-public-storage',
      // Uncomment to use LHCI server:
      // target: 'lhci',
      // serverBaseUrl: process.env.LHCI_SERVER_URL,
      // token: process.env.LHCI_BUILD_TOKEN,
    },
  },
};
