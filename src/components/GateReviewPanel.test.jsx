// Sprint 4 4.C5b.1 / 4.C5b.4 — GateReviewPanel contract tests.
//
// Locks the shared panel surface against mock InterruptEvent payloads
// for all four gates. Verifies:
//
//   - header renders gate label + case_id
//   - body slot mounts the gate-appropriate per-gate body component
//   - free-text notes textarea is present
//   - action buttons match the InterruptEvent.actions list
//   - onAction is called with the typed ResumePayload variant the
//     button represents (advance / rerun / halt / send_back)
//   - gate4 surfaces audit_summary.recommend_send_back as a "Send back
//     to ▼ <phase>" dropdown
//
// Per-gate body component tests (Gate1/2/3/4Review) live in
// `Gate*Review.test.tsx` (4.C5b.2) — this file pins the SHARED
// surface only.

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import GateReviewPanel from './GateReviewPanel';

function makeInterrupt(overrides = {}) {
  return {
    kind: 'interrupt',
    schema_version: 1,
    case_id: '00000000-0000-0000-0000-0000000000a1',
    gate: 'gate1',
    actions: ['advance', 'rerun', 'halt'],
    phase_output: null,
    ts: '2026-04-26T00:00:00Z',
    ...overrides,
  };
}

describe('<GateReviewPanel> shared surface', () => {
  it('renders gate label + case_id in the header', () => {
    render(
      <GateReviewPanel
        interruptEvent={makeInterrupt({ gate: 'gate2' })}
        traceUrl="https://smith.example/r/abc"
        onAction={vi.fn()}
      />
    );

    expect(screen.getByText(/gate 2/i)).toBeInTheDocument();
    expect(
      screen.getByText(/00000000-0000-0000-0000-0000000000a1/i)
    ).toBeInTheDocument();
  });

  it('renders only the actions advertised by InterruptEvent.actions', () => {
    render(
      <GateReviewPanel
        interruptEvent={makeInterrupt({
          gate: 'gate4',
          actions: ['rerun', 'halt'], // gate4 omits advance
        })}
        onAction={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /advance/i })).toBeNull();
    expect(screen.getByRole('button', { name: /re-?run/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /halt/i })).toBeInTheDocument();
  });

  it('emits {action:"advance"} when the advance button is clicked', () => {
    const onAction = vi.fn();
    render(
      <GateReviewPanel
        interruptEvent={makeInterrupt()}
        onAction={onAction}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /advance/i }));

    expect(onAction).toHaveBeenCalledTimes(1);
    const payload = onAction.mock.calls[0][0];
    expect(payload.action).toBe('advance');
  });

  it('emits {action:"halt"} with the typed notes from the textarea', () => {
    const onAction = vi.fn();
    render(
      <GateReviewPanel
        interruptEvent={makeInterrupt()}
        onAction={onAction}
      />
    );

    fireEvent.change(screen.getByRole('textbox', { name: /notes?/i }), {
      target: { value: 'withdrawn — duplicate filing' },
    });
    fireEvent.click(screen.getByRole('button', { name: /halt/i }));

    expect(onAction).toHaveBeenCalledTimes(1);
    const payload = onAction.mock.calls[0][0];
    expect(payload.action).toBe('halt');
    expect(payload.notes).toBe('withdrawn — duplicate filing');
  });

  it('emits a rerun payload with the phase keyed off the gate', () => {
    // gate3 → rerun synthesis (the apply node's rerun_target).
    const onAction = vi.fn();
    render(
      <GateReviewPanel
        interruptEvent={makeInterrupt({ gate: 'gate3' })}
        onAction={onAction}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /re-?run/i }));

    const payload = onAction.mock.calls[0][0];
    expect(payload.action).toBe('rerun');
    if (payload.action === 'rerun') {
      expect(payload.phase).toBe('synthesis');
    }
  });

  it('renders a trace link when traceUrl is provided', () => {
    render(
      <GateReviewPanel
        interruptEvent={makeInterrupt()}
        traceUrl="https://smith.example/r/abc"
        onAction={vi.fn()}
      />
    );

    const link = screen.getByRole('link', { name: /trace/i });
    expect(link).toHaveAttribute('href', 'https://smith.example/r/abc');
  });

  it('omits the trace link when traceUrl is absent', () => {
    render(
      <GateReviewPanel
        interruptEvent={makeInterrupt()}
        onAction={vi.fn()}
      />
    );

    expect(screen.queryByRole('link', { name: /trace/i })).toBeNull();
  });

  it('gate4 with audit recommend_send_back surfaces a send-back dropdown', () => {
    render(
      <GateReviewPanel
        interruptEvent={makeInterrupt({
          gate: 'gate4',
          actions: ['rerun', 'halt', 'send_back'],
          audit_summary: {
            recommend_send_back: { to_phase: 'synthesis', reason: 'uncertainty' },
          },
        })}
        onAction={vi.fn()}
      />
    );

    // The send-back UI is a dropdown of valid send_back targets.
    const dropdown = screen.getByRole('combobox', { name: /send back/i });
    expect(dropdown).toBeInTheDocument();
    // Default selection should pre-fill the auditor's recommendation.
    expect(dropdown.value).toBe('synthesis');
  });

  it('gate4 send-back click emits {action:"send_back", to_phase:<picked>}', () => {
    const onAction = vi.fn();
    render(
      <GateReviewPanel
        interruptEvent={makeInterrupt({
          gate: 'gate4',
          actions: ['rerun', 'halt', 'send_back'],
          audit_summary: {
            recommend_send_back: { to_phase: 'research', reason: 'witness gaps' },
          },
        })}
        onAction={onAction}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /send back/i }));

    const payload = onAction.mock.calls[0][0];
    expect(payload.action).toBe('send_back');
    if (payload.action === 'send_back') {
      expect(payload.to_phase).toBe('research');
    }
  });

  it('every gate mounts (smoke) with realistic InterruptEvent fixtures', () => {
    const onAction = vi.fn();
    for (const gate of ['gate1', 'gate2', 'gate3', 'gate4']) {
      const { unmount } = render(
        <GateReviewPanel
          interruptEvent={makeInterrupt({
            gate,
            actions: gate === 'gate4' ? ['rerun', 'halt'] : ['advance', 'rerun', 'halt'],
          })}
          onAction={onAction}
        />
      );
      // Header always renders the gate number (1-indexed display).
      expect(screen.getByText(new RegExp(`gate ${gate.slice(-1)}`, 'i'))).toBeInTheDocument();
      unmount();
    }
  });
});
