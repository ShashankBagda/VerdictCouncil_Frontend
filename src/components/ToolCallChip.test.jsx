// Q1.9 — ToolCallChip runtime contract.
//
// The chip renders inline within the conversational-mode prose flow at
// the position the model called the tool. It accepts a name, an
// args-delta string (concatenated upstream from `tool_call_delta`
// frames), a status, and an optional result. Default collapsed; click
// toggles. Visual tokens match AgentStreamPanel's existing palette.

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ToolCallChip from './ToolCallChip';

describe('ToolCallChip', () => {
  it('renders the tool name in the trigger', () => {
    render(<ToolCallChip name="parse_document" argsDelta="" status="streaming" />);
    expect(screen.getByRole('button', { name: /parse_document/i })).toBeInTheDocument();
  });

  it('starts collapsed (aria-expanded=false) and shows args on toggle', () => {
    render(
      <ToolCallChip
        name="parse_document"
        argsDelta='{"file_id":"f-123"}'
        status="complete"
        result='{"text":"hello"}'
      />,
    );
    const trigger = screen.getByRole('button', { name: /parse_document/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/file_id/i)).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/file_id/)).toBeInTheDocument();
  });

  it('shows a streaming indicator while status="streaming"', () => {
    render(<ToolCallChip name="parse_document" argsDelta='{"file_id":' status="streaming" />);
    expect(screen.getByLabelText(/streaming/i)).toBeInTheDocument();
  });

  it('renders the result when expanded and status="complete"', () => {
    render(
      <ToolCallChip
        name="parse_document"
        argsDelta='{"file_id":"f-1"}'
        status="complete"
        result="parsed 12 pages"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /parse_document/i }));
    expect(screen.getByText(/parsed 12 pages/i)).toBeInTheDocument();
  });

  it('renders error styling when status="error"', () => {
    render(
      <ToolCallChip
        name="parse_document"
        argsDelta=""
        status="error"
        result="ParseError: corrupt PDF"
      />,
    );
    const trigger = screen.getByRole('button', { name: /parse_document/i });
    // Error chips carry a data-status hook so visual + assistive
    // technology consumers can both pick up the failed state.
    expect(trigger).toHaveAttribute('data-status', 'error');
  });

  it('is keyboard-toggleable via Enter / Space', () => {
    render(<ToolCallChip name="parse_document" argsDelta='{"x":1}' status="complete" />);
    const trigger = screen.getByRole('button', { name: /parse_document/i });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });
});
