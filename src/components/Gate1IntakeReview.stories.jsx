/**
 * Storybook stories for Gate1IntakeReview component.
 *
 * Documents all visual states:
 *   - Default: full intake output with parties and red flags
 *   - Incomplete: missing documents flagged
 *   - Complete: no missing items
 *   - Empty: no phase output (placeholder state)
 *   - NoRedFlags: clean case with no flags
 *   - ManyParties: many parties edge case
 */

import Gate1IntakeReview from './Gate1IntakeReview';

export default {
  title: 'Gate Reviews/Gate1IntakeReview',
  component: Gate1IntakeReview,
  tags: ['autodocs'],
  argTypes: {
    phaseOutput: { control: 'object' },
  },
};

export const Default = {
  args: {
    phaseOutput: {
      domain: 'traffic_violation',
      complexity: 'medium',
      route: 'proceed_with_review',
      parties: [
        { name: 'Singapore Public Prosecutor', role: 'prosecution' },
        { name: 'Ahmad bin Abdullah', role: 'accused' },
      ],
      red_flags: ['Missing insurance certificate', 'Expired driving licence at time of offence'],
      completeness: {
        complete: false,
        missing: ['insurance_proof', 'licence_validity_confirmation'],
      },
    },
  },
};

export const Complete = {
  args: {
    phaseOutput: {
      domain: 'traffic_violation',
      complexity: 'low',
      route: 'proceed_with_review',
      parties: [
        { name: 'AG Chambers', role: 'prosecution' },
        { name: 'Jane Tan', role: 'accused' },
      ],
      red_flags: [],
      completeness: { complete: true, missing: [] },
    },
  },
};

export const NoRedFlags = {
  args: {
    phaseOutput: {
      domain: 'contract_dispute',
      complexity: 'high',
      route: 'fast_track',
      parties: [
        { name: 'Acme Corp', role: 'claimant' },
        { name: 'Beta Ltd', role: 'respondent' },
      ],
      red_flags: [],
      completeness: { complete: true, missing: [] },
    },
  },
};

export const ManyParties = {
  args: {
    phaseOutput: {
      domain: 'civil_dispute',
      complexity: 'high',
      route: 'full_hearing',
      parties: [
        { name: 'Party A', role: 'claimant' },
        { name: 'Party B', role: 'respondent' },
        { name: 'Party C', role: 'third_party' },
        { name: 'Party D', role: 'intervener' },
        { name: 'Party E', role: 'amicus_curiae' },
      ],
      red_flags: ['Multiple conflicting accounts'],
      completeness: { complete: false, missing: ['statutory_declaration'] },
    },
  },
};

export const EmptyPlaceholder = {
  args: {
    phaseOutput: null,
  },
};
