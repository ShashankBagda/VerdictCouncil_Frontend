import { describe, it, expect } from 'vitest';
import {
  extractFrontendPaths,
  normalizeFrontendPath,
  buildSpecMatcher,
} from '../../scripts/check-api-contract.mjs';

describe('check-api-contract helpers', () => {
  describe('extractFrontendPaths', () => {
    it('finds literal /api/v1 paths in single, double, and template quotes', () => {
      const source = `
        fetch('/api/v1/cases/');
        fetch("/api/v1/escalated-cases/");
        fetch(\`/api/v1/auth/login\`);
      `;
      const paths = extractFrontendPaths(source);
      expect(paths).toEqual(
        expect.arrayContaining([
          '/api/v1/cases/',
          '/api/v1/escalated-cases/',
          '/api/v1/auth/login',
        ]),
      );
      expect(paths).toHaveLength(3);
    });

    it('preserves interpolation placeholders in the extracted literal', () => {
      const source = "fetch(`/api/v1/cases/${caseId}/process`)";
      expect(extractFrontendPaths(source)).toEqual(['/api/v1/cases/${caseId}/process']);
    });

    it('deduplicates repeated paths', () => {
      const source = "fetch('/api/v1/auth/me'); fetch('/api/v1/auth/me')";
      expect(extractFrontendPaths(source)).toEqual(['/api/v1/auth/me']);
    });

    it('ignores non-/api/v1 strings', () => {
      const source = "fetch('/healthz'); fetch('/api/v2/cases/')";
      expect(extractFrontendPaths(source)).toEqual([]);
    });
  });

  describe('normalizeFrontendPath', () => {
    it('strips query strings', () => {
      expect(normalizeFrontendPath('/api/v1/cases/?page=1&size=10')).toBe('/api/v1/cases/');
    });

    it('replaces ${var} interpolations with {param}', () => {
      expect(normalizeFrontendPath('/api/v1/cases/${caseId}/process')).toBe(
        '/api/v1/cases/{param}/process',
      );
    });

    it('normalizes multiple interpolations in one path', () => {
      expect(normalizeFrontendPath('/api/v1/${a}/x/${b}')).toBe('/api/v1/{param}/x/{param}');
    });
  });

  describe('buildSpecMatcher', () => {
    const spec = {
      paths: {
        '/api/v1/cases/': {},
        '/api/v1/cases/{case_id}/process': {},
        '/api/v1/auth/me': {},
      },
    };

    it('matches static paths', () => {
      const matches = buildSpecMatcher(spec);
      expect(matches('/api/v1/cases/')).toBe(true);
      expect(matches('/api/v1/auth/me')).toBe(true);
    });

    it('matches parameterized paths after {param} → x substitution', () => {
      const matches = buildSpecMatcher(spec);
      expect(matches('/api/v1/cases/{param}/process')).toBe(true);
    });

    it('rejects paths the spec does not declare', () => {
      const matches = buildSpecMatcher(spec);
      expect(matches('/api/v1/knowledge-base/upload')).toBe(false);
      expect(matches('/api/v1/cases/')).toBe(true);
      expect(matches('/api/v1/cases')).toBe(false);
    });

    it('throws when the spec is missing paths', () => {
      expect(() => buildSpecMatcher(null)).toThrow(/paths/);
      expect(() => buildSpecMatcher({})).toThrow(/paths/);
      expect(() => buildSpecMatcher({ paths: null })).toThrow(/paths/);
    });
  });
});
