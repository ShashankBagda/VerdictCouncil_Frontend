// Sprint 4 4.A5.3 — WhatIfModal contract tests.

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import WhatIfModal from '../WhatIfModal';

function setup(props = {}) {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  render(
    <WhatIfModal open onClose={onClose} onSubmit={onSubmit} {...props} />,
  );
  return { onSubmit, onClose };
}

describe('<WhatIfModal>', () => {
  it('returns null when open=false', () => {
    const { container } = render(
      <WhatIfModal open={false} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('builds an evidence_exclusion payload with optional reason', () => {
    const { onSubmit } = setup();

    // default modification_type is evidence_exclusion
    fireEvent.change(screen.getByLabelText(/evidence id/i), {
      target: { value: 'ev-1' },
    });
    fireEvent.change(screen.getByLabelText(/reason/i), {
      target: { value: 'too prejudicial' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run scenario/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual({
      modification_type: 'evidence_exclusion',
      modification_payload: { evidence_id: 'ev-1', reason: 'too prejudicial' },
      description: 'Exclude evidence ev-1',
    });
  });

  it('builds a fact_toggle payload with new_status', () => {
    const { onSubmit } = setup();
    fireEvent.change(screen.getByLabelText(/modification type/i), {
      target: { value: 'fact_toggle' },
    });
    fireEvent.change(screen.getByLabelText(/fact id/i), {
      target: { value: 'f-2' },
    });
    fireEvent.change(screen.getByLabelText(/new status/i), {
      target: { value: 'agreed' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run scenario/i }));

    expect(onSubmit.mock.calls[0][0].modification_type).toBe('fact_toggle');
    expect(onSubmit.mock.calls[0][0].modification_payload).toEqual({
      fact_id: 'f-2',
      new_status: 'agreed',
    });
  });

  it('builds a witness_credibility payload with numeric score', () => {
    const { onSubmit } = setup();
    fireEvent.change(screen.getByLabelText(/modification type/i), {
      target: { value: 'witness_credibility' },
    });
    fireEvent.change(screen.getByLabelText(/witness id/i), {
      target: { value: 'w-1' },
    });
    fireEvent.change(screen.getByLabelText(/credibility score/i), {
      target: { value: '30' },
    });
    fireEvent.click(screen.getByRole('button', { name: /run scenario/i }));

    expect(onSubmit.mock.calls[0][0].modification_payload).toEqual({
      witness_id: 'w-1',
      new_credibility_score: 30,
    });
  });

  it('disables the submit button while submitting', () => {
    setup({ submitting: true });
    expect(
      screen.getByRole('button', { name: /running/i }),
    ).toBeDisabled();
  });

  it('renders children body and hides the form when children are provided', () => {
    render(
      <WhatIfModal open onClose={vi.fn()} onSubmit={vi.fn()}>
        <div data-testid="result-body">Result here</div>
      </WhatIfModal>,
    );
    expect(screen.getByTestId('result-body')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /run scenario/i })).toBeNull();
  });

  it('calls onClose when the × button is clicked', () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: /close what-if modal/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
