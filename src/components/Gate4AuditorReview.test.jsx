// Sprint 4 4.C5b.2 / 4.C5b.4 — gate4 auditor body contract.

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Gate4AuditorReview from './Gate4AuditorReview';

const sample = {
  fairness_check: {
    audit_passed: false,
    critical_issues_found: true,
    issues: [
      { id: 'fc-1', severity: 'critical', description: 'unsupported claim cited' },
      { id: 'fc-2', severity: 'medium', description: 'tone overly assertive' },
    ],
    recommendations: ['rewrite conclusion'],
  },
  citation_audit: {
    total_citations: 12,
    suppressed_citations: 1,
    unsupported_claims: 2,
  },
  cost_summary: {
    cost_usd: 0.4231,
    tokens_in: 18000,
    tokens_out: 4200,
    duration_seconds: 87.4,
  },
  recommend_send_back: { to_phase: 'synthesis', reason: 'unresolved uncertainty' },
};

describe('<Gate4AuditorReview>', () => {
  it('renders fairness audit verdict and issues with severity icons', () => {
    render(<Gate4AuditorReview phaseOutput={sample} />);
    expect(screen.getByText(/audit passed/i)).toBeInTheDocument();
    expect(screen.getByText('NO')).toBeInTheDocument();
    expect(screen.getByText(/unsupported claim cited/)).toBeInTheDocument();
    expect(screen.getByText(/tone overly assertive/)).toBeInTheDocument();
  });

  it('renders citation audit summary', () => {
    render(<Gate4AuditorReview phaseOutput={sample} />);
    expect(screen.getByText(/12 citations · 1 suppressed · 2 unsupported/)).toBeInTheDocument();
  });

  it('renders cost / tokens / duration footer', () => {
    render(<Gate4AuditorReview phaseOutput={sample} />);
    expect(screen.getByText(/cost: \$0\.4231/)).toBeInTheDocument();
    expect(screen.getByText(/tokens: 18000 in \/ 4200 out/)).toBeInTheDocument();
    expect(screen.getByText(/duration: 87\.4s/)).toBeInTheDocument();
  });

  it('surfaces auditor recommend_send_back when present', () => {
    render(<Gate4AuditorReview phaseOutput={sample} />);
    expect(screen.getByText(/auditor recommends/i)).toBeInTheDocument();
    expect(screen.getByText(/unresolved uncertainty/)).toBeInTheDocument();
  });

  it('skips the send-back banner when auditor has no recommendation', () => {
    const noRec = { ...sample, recommend_send_back: null };
    render(<Gate4AuditorReview phaseOutput={noRec} />);
    expect(screen.queryByText(/auditor recommends/i)).toBeNull();
  });
});
