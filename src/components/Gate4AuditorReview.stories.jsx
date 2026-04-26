/**
 * Storybook stories for Gate4AuditorReview component.
 *
 * Documents fairness audit states:
 *   - PassedClean: audit passed, no issues
 *   - PassedWithWarnings: audit passed but low-severity issues present
 *   - FailedCritical: audit failed with critical issues
 *   - CitationAudit: with citation audit summary
 *   - WithCostSummary: token/cost footer visible
 *   - EmptyPlaceholder: null phaseOutput
 */

import Gate4AuditorReview from './Gate4AuditorReview';

export default {
  title: 'Gate Reviews/Gate4AuditorReview',
  component: Gate4AuditorReview,
  tags: ['autodocs'],
  argTypes: {
    phaseOutput: { control: 'object' },
  },
};

export const PassedClean = {
  args: {
    phaseOutput: {
      fairness_check: {
        audit_passed: true,
        critical_issues_found: false,
        issues: [],
      },
      citation_audit: {
        total_citations: 5,
        verified: 5,
        unverified: 0,
        flagged: [],
      },
      cost_summary: {
        total_tokens: 12400,
        total_cost_usd: 0.18,
        duration_ms: 3200,
      },
    },
  },
};

export const PassedWithWarnings = {
  args: {
    phaseOutput: {
      fairness_check: {
        audit_passed: true,
        critical_issues_found: false,
        issues: [
          { id: 'w1', severity: 'low', description: 'Minor language bias in argument weighting' },
          { id: 'w2', severity: 'info', description: 'Consider adding counter-argument balance' },
        ],
      },
    },
  },
};

export const FailedCritical = {
  args: {
    phaseOutput: {
      fairness_check: {
        audit_passed: false,
        critical_issues_found: true,
        issues: [
          { id: 'c1', severity: 'critical', description: 'Systematic bias detected in evidence weighting' },
          { id: 'c2', severity: 'high', description: 'Unsubstantiated legal citation PP v XYZ' },
        ],
      },
      recommend_send_back: 'research',
    },
  },
};

export const WithCitationAudit = {
  args: {
    phaseOutput: {
      fairness_check: {
        audit_passed: true,
        critical_issues_found: false,
        issues: [],
      },
      citation_audit: {
        total_citations: 8,
        verified: 6,
        unverified: 2,
        flagged: [
          { citation: 'ABC v DEF [2019]', reason: 'Overruled by subsequent CA decision' },
        ],
      },
    },
  },
};

export const WithCostSummary = {
  args: {
    phaseOutput: {
      fairness_check: { audit_passed: true, critical_issues_found: false, issues: [] },
      cost_summary: {
        total_tokens: 47800,
        total_cost_usd: 0.72,
        duration_ms: 18500,
      },
    },
  },
};

export const EmptyPlaceholder = {
  args: {
    phaseOutput: null,
  },
};
