// Sprint 4 4.C5b.2 / 4.C5b.4 — gate2 research body contract.

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import Gate2ResearchReview from './Gate2ResearchReview';

const sample = {
  evidence: { evidence_items: [{ id: 'e1', description: 'photo' }] },
  facts: { facts: [{ id: 'f1', text: 'fact one', status: 'agreed' }] },
  witnesses: { witnesses: [{ name: 'Charlie', credibility_score: 75 }] },
  law: { legal_rules: [{ statute: 'SCA s12', relevance: 'high' }] },
};

describe('<Gate2ResearchReview>', () => {
  it('renders all four subagent tabs', () => {
    render(<Gate2ResearchReview phaseOutput={sample} />);
    expect(screen.getByRole('tab', { name: /evidence/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /facts/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /witnesses/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /law/i })).toBeInTheDocument();
  });

  it('switches the visible tabpanel on tab click', () => {
    render(<Gate2ResearchReview phaseOutput={sample} />);
    // default tab is evidence
    expect(screen.getByText(/photo/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /witnesses/i }));
    expect(screen.getByText(/Charlie/)).toBeInTheDocument();
  });

  it('emits the picked subagent via onSelectSubagent', () => {
    const onSelectSubagent = vi.fn();
    render(
      <Gate2ResearchReview
        phaseOutput={sample}
        onSelectSubagent={onSelectSubagent}
      />
    );
    fireEvent.click(screen.getByRole('checkbox', { name: /rerun facts/i }));
    expect(onSelectSubagent).toHaveBeenCalledWith('facts');

    // Toggling off clears.
    fireEvent.click(screen.getByRole('checkbox', { name: /rerun facts/i }));
    expect(onSelectSubagent).toHaveBeenLastCalledWith(null);
  });

  it('handles missing scopes gracefully', () => {
    render(<Gate2ResearchReview phaseOutput={{}} />);
    expect(screen.getByText(/no evidence items/i)).toBeInTheDocument();
  });
});
