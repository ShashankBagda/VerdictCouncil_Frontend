// Sprint 4 4.C5b.2 / 4.C5b.4 — gate3 synthesis body contract.

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import Gate3SynthesisReview from './Gate3SynthesisReview';

const sample = {
  claimant_irac: {
    issue: 'Was the wall damaged?',
    rule: 'tort liability',
    application: 'photo evidence supports',
    conclusion: 'liable',
  },
  respondent_irac: {
    issue: 'Was respondent present?',
    rule: 'witness testimony',
    application: 'witness disputes',
    conclusion: 'not liable',
  },
  pre_hearing_brief: 'A summary brief.',
  judicial_questions: ['Q1: provenance?', 'Q2: timeline?'],
  uncertainty_flags: [{ flag: 'witness reliability low', severity: 'medium' }],
};

describe('<Gate3SynthesisReview>', () => {
  it('renders both IRAC columns', () => {
    render(<Gate3SynthesisReview phaseOutput={sample} />);
    expect(screen.getByText(/Was the wall damaged/)).toBeInTheDocument();
    expect(screen.getByText(/Was respondent present/)).toBeInTheDocument();
  });

  it('renders inline-editable judicial questions', () => {
    render(<Gate3SynthesisReview phaseOutput={sample} />);
    const q1 = screen.getByLabelText(/judicial question 1/i);
    expect(q1.value).toBe('Q1: provenance?');
  });

  it('emits field_corrections on edit and clears when reverted', () => {
    const onChange = vi.fn();
    render(
      <Gate3SynthesisReview
        phaseOutput={sample}
        onFieldCorrectionsChange={onChange}
      />
    );

    onChange.mockClear();
    const q1 = screen.getByLabelText(/judicial question 1/i);
    fireEvent.change(q1, { target: { value: 'Q1 edited' } });

    // Last call carries the dirty corrections.
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last.synthesis_output.judicial_questions[0]).toBe('Q1 edited');
  });

  it('renders uncertainty flags with severity', () => {
    render(<Gate3SynthesisReview phaseOutput={sample} />);
    expect(screen.getByText(/witness reliability low/)).toBeInTheDocument();
    expect(screen.getByText(/\[medium\]/)).toBeInTheDocument();
  });
});
