// Sprint 4 4.A5.3 — WhatIfCompareView contract.

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import WhatIfCompareView from '../WhatIfCompareView';

describe('<WhatIfCompareView>', () => {
  it('renders nothing when scenario is null', () => {
    const { container } = render(<WhatIfCompareView scenario={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows both verdicts side-by-side with the diff summary', () => {
    render(
      <WhatIfCompareView
        scenario={{
          status: 'completed',
          original_verdict: { preliminary_conclusion: 'liable', confidence_score: 80 },
          modified_verdict: { preliminary_conclusion: 'not_liable', confidence_score: 65 },
          diff_view: {
            analysis_changed: true,
            confidence_delta: -15,
            fact_changes: [{ fact_id: 'f-1' }],
            evidence_changes: [],
          },
        }}
      />,
    );

    expect(screen.getByText(/original verdict/i)).toBeInTheDocument();
    expect(screen.getByText(/what-if verdict/i)).toBeInTheDocument();
    expect(screen.getByText('liable')).toBeInTheDocument();
    expect(screen.getByText('not_liable')).toBeInTheDocument();
    expect(screen.getByText(/verdict changed:/i).parentElement.textContent).toContain('yes');
    expect(screen.getByText(/confidence delta:/i).parentElement.textContent).toContain('-15');
    expect(screen.getByText(/1 fact change/i)).toBeInTheDocument();
  });

  it('renders a fork trace link when forkTraceUrl is provided', () => {
    render(
      <WhatIfCompareView
        scenario={{ status: 'completed', original_verdict: null, modified_verdict: null }}
        forkTraceUrl="https://smith.example/r/abc"
      />,
    );

    const link = screen.getByRole('link', { name: /view fork trace/i });
    expect(link).toHaveAttribute('href', 'https://smith.example/r/abc');
  });
});
