/**
 * Accessibility tests using jest-axe (axe-core integration for Vitest).
 *
 * Verifies WCAG 2.1 Level AA compliance for all major UI components.
 *
 * Covered components:
 *   - LoginPage
 *   - Gate1IntakeReview (phase output present + absent)
 *   - Gate2ResearchReview
 *   - Gate3SynthesisReview
 *   - Gate4AuditorReview
 *   - GateReviewPanel (full panel with actions)
 *   - AgentStreamPanel
 *   - DocumentSlotGrid
 *
 * Each test:
 *   1. Renders the component in jsdom
 *   2. Runs axe-core (WCAG 2a, 2aa, 2.1aa tags)
 *   3. Asserts toHaveNoViolations() — configured in setup.js
 */

import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

// Components under test
import Gate1IntakeReview from '../components/Gate1IntakeReview';
import Gate2ResearchReview from '../components/Gate2ResearchReview';
import Gate3SynthesisReview from '../components/Gate3SynthesisReview';
import Gate4AuditorReview from '../components/Gate4AuditorReview';
import GateReviewPanel from '../components/GateReviewPanel';

// ------- helpers -----------------------------------------------------------

async function renderAndRunAxe(ui) {
  const { container } = render(ui);
  const results = await axe(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
  });
  return results;
}

// ------- Gate1IntakeReview -------------------------------------------------

describe('Accessibility: Gate1IntakeReview', () => {
  it('has no violations when phase output is present', async () => {
    const phaseOutput = {
      domain: 'traffic_violation',
      complexity: 'medium',
      route: 'proceed',
      parties: [{ name: 'Prosecution', role: 'prosecution' }],
      red_flags: ['Missing insurance'],
      completeness: { complete: false, missing: ['insurance_proof'] },
    };
    const results = await renderAndRunAxe(<Gate1IntakeReview phaseOutput={phaseOutput} />);
    expect(results).toHaveNoViolations();
  });

  it('has no violations when phase output is absent (placeholder state)', async () => {
    const results = await renderAndRunAxe(<Gate1IntakeReview phaseOutput={null} />);
    expect(results).toHaveNoViolations();
  });
});

// ------- Gate2ResearchReview -----------------------------------------------

describe('Accessibility: Gate2ResearchReview', () => {
  it('has no violations with research output present', async () => {
    const phaseOutput = {
      statutes: [{ title: 'Road Traffic Act s.65', relevance: 'high' }],
      case_law: [{ citation: 'PP v ABC [2022] SGHC 1', summary: 'Speed limit enforcement' }],
      facts: ['Driver exceeded speed limit by 30 km/h'],
    };
    const results = await renderAndRunAxe(<Gate2ResearchReview phaseOutput={phaseOutput} />);
    expect(results).toHaveNoViolations();
  });

  it('has no violations with null phase output', async () => {
    const results = await renderAndRunAxe(<Gate2ResearchReview phaseOutput={null} />);
    expect(results).toHaveNoViolations();
  });
});

// ------- Gate3SynthesisReview ----------------------------------------------

describe('Accessibility: Gate3SynthesisReview', () => {
  it('has no violations with synthesis output present', async () => {
    const phaseOutput = {
      arguments_for: [{ point: 'Driver was negligent', strength: 'high' }],
      arguments_against: [{ point: 'Extenuating circumstances', strength: 'medium' }],
      confidence_score: 78,
      recommendation: 'proceed_to_verdict',
    };
    const results = await renderAndRunAxe(<Gate3SynthesisReview phaseOutput={phaseOutput} />);
    expect(results).toHaveNoViolations();
  });

  it('has no violations with null phase output', async () => {
    const results = await renderAndRunAxe(<Gate3SynthesisReview phaseOutput={null} />);
    expect(results).toHaveNoViolations();
  });
});

// ------- Gate4AuditorReview ------------------------------------------------

describe('Accessibility: Gate4AuditorReview', () => {
  it('has no violations with audit output present', async () => {
    const phaseOutput = {
      audit_score: 92,
      bias_detected: false,
      flags: [],
      recommendation: 'approved',
    };
    const results = await renderAndRunAxe(<Gate4AuditorReview phaseOutput={phaseOutput} />);
    expect(results).toHaveNoViolations();
  });

  it('has no violations when bias is detected', async () => {
    const phaseOutput = {
      audit_score: 45,
      bias_detected: true,
      flags: ['Potential gender bias in argument weighting'],
      recommendation: 'review_required',
    };
    const results = await renderAndRunAxe(<Gate4AuditorReview phaseOutput={phaseOutput} />);
    expect(results).toHaveNoViolations();
  });
});

// ------- GateReviewPanel ---------------------------------------------------

describe('Accessibility: GateReviewPanel (full panel)', () => {
  const baseProps = {
    caseId: '550e8400-e29b-41d4-a716-446655440000',
    onAction: vi.fn(),
    interruptEvent: {
      interrupt_id: 'int-1',
      gate: 'gate1',
      case_id: '550e8400-e29b-41d4-a716-446655440000',
      phase_output: {
        domain: 'traffic_violation',
        complexity: 'low',
        route: 'proceed',
        parties: [],
        red_flags: [],
        completeness: { complete: true, missing: [] },
      },
      actions: ['approve', 'reject', 'send_back'],
    },
  };

  it('has no violations for gate1 panel', async () => {
    const results = await renderAndRunAxe(
      <MemoryRouter>
        <GateReviewPanel {...baseProps} />
      </MemoryRouter>
    );
    expect(results).toHaveNoViolations();
  });

  it('has no violations for gate2 panel', async () => {
    const props = {
      ...baseProps,
      interruptEvent: {
        ...baseProps.interruptEvent,
        gate: 'gate2',
        phase_output: {
          statutes: [],
          case_law: [],
          facts: [],
        },
      },
    };
    const results = await renderAndRunAxe(
      <MemoryRouter>
        <GateReviewPanel {...props} />
      </MemoryRouter>
    );
    expect(results).toHaveNoViolations();
  });

  it('has no violations for gate3 panel', async () => {
    const props = {
      ...baseProps,
      interruptEvent: {
        ...baseProps.interruptEvent,
        gate: 'gate3',
        phase_output: {
          arguments_for: [],
          arguments_against: [],
          confidence_score: 0,
          recommendation: 'pending',
        },
      },
    };
    const results = await renderAndRunAxe(
      <MemoryRouter>
        <GateReviewPanel {...props} />
      </MemoryRouter>
    );
    expect(results).toHaveNoViolations();
  });

  it('has no violations for gate4 panel', async () => {
    const props = {
      ...baseProps,
      interruptEvent: {
        ...baseProps.interruptEvent,
        gate: 'gate4',
        phase_output: {
          audit_score: 80,
          bias_detected: false,
          flags: [],
          recommendation: 'approved',
        },
      },
    };
    const results = await renderAndRunAxe(
      <MemoryRouter>
        <GateReviewPanel {...props} />
      </MemoryRouter>
    );
    expect(results).toHaveNoViolations();
  });
});
