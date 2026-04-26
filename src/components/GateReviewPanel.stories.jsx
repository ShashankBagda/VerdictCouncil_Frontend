/**
 * Storybook stories for GateReviewPanel (full HITL panel with action buttons).
 *
 * Documents all four gate configurations and their interactive states:
 *   - Gate1IntakeGate: intake review with full actions
 *   - Gate2ResearchGate: research review
 *   - Gate3SynthesisGate: synthesis review
 *   - Gate4AuditorGate: auditor review with send-back recommendation
 *   - Disabled: panel in disabled state (action already taken)
 *   - WithWhatIfEnabled: Gate 2 with what-if exploration enabled
 */

import { fn } from '@storybook/test';
import { MemoryRouter } from 'react-router-dom';
import GateReviewPanel from './GateReviewPanel';

export default {
  title: 'Gate Reviews/GateReviewPanel',
  component: GateReviewPanel,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
  argTypes: {
    onAction: { action: 'action-emitted' },
    disabled: { control: 'boolean' },
  },
};

const CASE_ID = '550e8400-e29b-41d4-a716-446655440000';

export const Gate1IntakeGate = {
  args: {
    onAction: fn(),
    interruptEvent: {
      interrupt_id: 'int-gate1-001',
      gate: 'gate1',
      case_id: CASE_ID,
      phase_output: {
        domain: 'traffic_violation',
        complexity: 'medium',
        route: 'proceed_with_review',
        parties: [
          { name: 'AG Chambers', role: 'prosecution' },
          { name: 'Ali bin Hassan', role: 'accused' },
        ],
        red_flags: ['Expired driving licence'],
        completeness: { complete: false, missing: ['insurance_proof'] },
      },
      actions: ['advance', 'halt', 'rerun', 'send_back'],
    },
  },
};

export const Gate2ResearchGate = {
  args: {
    onAction: fn(),
    interruptEvent: {
      interrupt_id: 'int-gate2-001',
      gate: 'gate2',
      case_id: CASE_ID,
      phase_output: {
        statutes: [{ title: 'Road Traffic Act s.65', relevance: 'high', excerpt: 'Speed limit...' }],
        case_law: [{ citation: 'PP v Tan [2021] SGHC 45', summary: 'Speeding conviction upheld' }],
        facts: ['Driver was travelling at 95 km/h in a 60 km/h zone'],
        witnesses: [],
      },
      actions: ['advance', 'halt', 'rerun', 'send_back'],
    },
  },
};

export const Gate3SynthesisGate = {
  args: {
    onAction: fn(),
    interruptEvent: {
      interrupt_id: 'int-gate3-001',
      gate: 'gate3',
      case_id: CASE_ID,
      phase_output: {
        arguments_for: [
          { point: 'Clear speed limit violation captured on camera', strength: 'high' },
        ],
        arguments_against: [
          { point: 'Defendant claims speed camera was miscalibrated', strength: 'medium' },
        ],
        confidence_score: 82,
        recommendation: 'proceed_to_verdict',
      },
      actions: ['advance', 'halt', 'rerun', 'send_back'],
    },
  },
};

export const Gate4AuditorGate = {
  args: {
    onAction: fn(),
    interruptEvent: {
      interrupt_id: 'int-gate4-001',
      gate: 'gate4',
      case_id: CASE_ID,
      phase_output: {
        fairness_check: {
          audit_passed: true,
          critical_issues_found: false,
          issues: [
            { id: 'i1', severity: 'low', description: 'Minor tone inconsistency' },
          ],
        },
        citation_audit: { total_citations: 3, verified: 3, unverified: 0, flagged: [] },
        cost_summary: { total_tokens: 32000, total_cost_usd: 0.48, duration_ms: 9800 },
      },
      audit_summary: { recommend_send_back: null },
      actions: ['advance', 'halt', 'send_back'],
    },
  },
};

export const Gate4WithSendBackRecommendation = {
  args: {
    onAction: fn(),
    interruptEvent: {
      interrupt_id: 'int-gate4-002',
      gate: 'gate4',
      case_id: CASE_ID,
      phase_output: {
        fairness_check: {
          audit_passed: false,
          critical_issues_found: true,
          issues: [
            { id: 'c1', severity: 'critical', description: 'Unverified citation detected' },
          ],
        },
      },
      audit_summary: {
        recommend_send_back: { to_phase: 'research' },
      },
      actions: ['halt', 'send_back'],
    },
  },
};

export const DisabledPanel = {
  args: {
    onAction: fn(),
    disabled: true,
    interruptEvent: {
      interrupt_id: 'int-gate1-disabled',
      gate: 'gate1',
      case_id: CASE_ID,
      phase_output: {
        domain: 'civil_dispute',
        complexity: 'high',
        route: 'full_hearing',
        parties: [],
        red_flags: [],
        completeness: { complete: true, missing: [] },
      },
      actions: ['advance', 'halt'],
    },
  },
};
