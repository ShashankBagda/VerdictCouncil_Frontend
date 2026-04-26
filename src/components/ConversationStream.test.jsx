// Q1.10 — ConversationStream renders an agent's conversational-mode
// stream as a chat-style transcript composed from ai-elements primitives
// + Q1.9's ToolCallChip + shadcn Card/Alert for the artifact and failure
// cards. Driven by the per-agent slice from useAgentStream's
// agentStreams (Q1.8): { raw, prose, toolCalls, artifact, failure }.

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// jsdom does not implement ResizeObserver; ai-elements' <Conversation>
// uses use-stick-to-bottom which needs it. Stub the minimum surface.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
}

import ConversationStream from './ConversationStream';

function makeStream(overrides = {}) {
  return {
    raw: [],
    prose: {},
    toolCalls: {},
    artifact: null,
    failure: null,
    ...overrides,
  };
}

describe('<ConversationStream>', () => {
  it('renders a typing indicator when the stream has no prose yet', () => {
    render(
      <ConversationStream agentId="intake" agentLabel="Intake" stream={makeStream()} />,
    );
    expect(screen.getByTestId('conversation-typing-indicator')).toBeInTheDocument();
  });

  it('renders accumulated prose as a message bubble', () => {
    render(
      <ConversationStream
        agentId="intake"
        agentLabel="Intake"
        stream={makeStream({
          prose: {
            'msg-1': 'The notice describes a traffic offence under section 12.',
          },
          raw: [
            {
              event: 'llm_token',
              message_id: 'msg-1',
              delta: 'The notice describes a traffic offence under section 12.',
            },
          ],
        })}
      />,
    );
    expect(
      screen.getByText(/The notice describes a traffic offence under section 12\./i),
    ).toBeInTheDocument();
    // The typing indicator goes away once prose has arrived.
    expect(screen.queryByTestId('conversation-typing-indicator')).not.toBeInTheDocument();
  });

  it('renders a ToolCallChip for each tool_call_delta entry', () => {
    render(
      <ConversationStream
        agentId="intake"
        agentLabel="Intake"
        stream={makeStream({
          prose: { 'msg-1': 'I will fetch the document.' },
          toolCalls: {
            'call-1': { name: 'parse_document', argsDelta: '{"file_id":"f-1"}' },
          },
          raw: [
            { event: 'llm_token', message_id: 'msg-1', delta: 'I will fetch the document.' },
            {
              event: 'tool_call_delta',
              tool_call_id: 'call-1',
              name: 'parse_document',
              args_delta: '{"file_id":"f-1"}',
            },
          ],
        })}
      />,
    );
    expect(screen.getByRole('button', { name: /parse_document/i })).toBeInTheDocument();
  });

  it('renders the structured-artifact result card when artifact is present', () => {
    render(
      <ConversationStream
        agentId="intake"
        agentLabel="Intake"
        stream={makeStream({
          prose: { 'msg-1': 'Done.' },
          artifact: {
            domain: 'criminal',
            parties: [{ role: 'defendant', name: 'Alice' }],
          },
          raw: [
            { event: 'llm_token', message_id: 'msg-1', delta: 'Done.' },
            {
              event: 'structured_artifact',
              artifact: {
                domain: 'criminal',
                parties: [{ role: 'defendant', name: 'Alice' }],
              },
            },
          ],
        })}
      />,
    );
    const card = screen.getByTestId('conversation-artifact-card');
    expect(card).toBeInTheDocument();
    expect(card).toHaveTextContent(/criminal/i);
  });

  it('renders an error alert when failure is present', () => {
    render(
      <ConversationStream
        agentId="intake"
        agentLabel="Intake"
        stream={makeStream({
          failure: { errorClass: 'TimeoutError' },
          raw: [{ event: 'agent_failed', error_class: 'TimeoutError' }],
        })}
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/TimeoutError/i);
  });

  it('renders the agent label as the message header', () => {
    render(
      <ConversationStream
        agentId="intake"
        agentLabel="Intake Agent"
        stream={makeStream({ prose: { 'msg-1': 'hi' }, raw: [] })}
      />,
    );
    expect(screen.getByText(/Intake Agent/i)).toBeInTheDocument();
  });

  it('handles undefined stream gracefully (renders typing indicator)', () => {
    render(<ConversationStream agentId="intake" agentLabel="Intake" stream={undefined} />);
    expect(screen.getByTestId('conversation-typing-indicator')).toBeInTheDocument();
  });
});
