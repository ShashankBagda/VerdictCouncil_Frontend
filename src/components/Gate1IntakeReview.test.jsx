// Sprint 4 4.C5b.2 / 4.C5b.4 — gate1 intake body contract.

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Gate1IntakeReview from './Gate1IntakeReview';

describe('<Gate1IntakeReview>', () => {
  it('renders the empty fallback when phase_output is null', () => {
    render(<Gate1IntakeReview phaseOutput={null} />);
    expect(screen.getByTestId('gate1-empty')).toBeInTheDocument();
  });

  it('renders domain / complexity / route fields', () => {
    render(
      <Gate1IntakeReview
        phaseOutput={{
          domain: 'small_claims',
          complexity: 'standard',
          route: 'fast_track',
        }}
      />
    );
    expect(screen.getByText(/small_claims/)).toBeInTheDocument();
    expect(screen.getByText(/standard/)).toBeInTheDocument();
    expect(screen.getByText(/fast_track/)).toBeInTheDocument();
  });

  it('renders parties and red flags', () => {
    render(
      <Gate1IntakeReview
        phaseOutput={{
          parties: [
            { name: 'Alice', role: 'claimant' },
            { name: 'Bob', role: 'respondent' },
          ],
          red_flags: ['statute of limitations may have expired'],
        }}
      />
    );
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
    expect(screen.getByText(/statute of limitations/)).toBeInTheDocument();
  });

  it('renders document list with sanitized indicator', () => {
    render(
      <Gate1IntakeReview
        phaseOutput={{
          documents: [
            { id: 'd1', filename: 'complaint.pdf', sanitized: true },
            { id: 'd2', filename: 'response.pdf', sanitized: false },
          ],
        }}
      />
    );
    expect(screen.getByText('complaint.pdf')).toBeInTheDocument();
    expect(screen.getByText('response.pdf')).toBeInTheDocument();
    // Only the sanitized doc should show the marker.
    const sanitizedMarkers = screen.getAllByText('sanitized');
    expect(sanitizedMarkers).toHaveLength(1);
  });
});
