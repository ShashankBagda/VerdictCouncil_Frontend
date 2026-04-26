// Q1.11 chat-steering — AgentChatPanel contract tests.
//
// What this locks in:
//  - When no `interrupt` is active for this caseId+agentId, the input
//    is hidden and an idle hint is shown. Send button must not be
//    reachable; the only way to send is via an active question.
//  - When an interrupt arrives that targets this card, the question is
//    rendered verbatim and the input becomes editable.
//  - On send, api.sendJudgeMessage is called with the right payload
//    (text + interruptId), the optimistic "delivered" line appears,
//    and the input clears.
//  - Enter (without shift) sends; Shift+Enter inserts a newline.
//  - A subsequent interrupt with a fresh interrupt_id resets the
//    optimistic state — the prior reply is no longer rendered as
//    "delivered" because it belongs to a resolved turn.

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AgentChatPanel from './AgentChatPanel';
import api from '../lib/api';

vi.mock('../lib/api', () => ({
  default: { sendJudgeMessage: vi.fn() },
}));

const baseProps = {
  caseId: 'case-1',
  agentId: 'synthesis',
  onError: vi.fn(),
};

const awaitingFrame = {
  kind: 'interrupt',
  case_id: 'case-1',
  agent: 'synthesis',
  question: 'Reading A or B should govern?',
  interrupt_id: 'a'.repeat(32),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('<AgentChatPanel> idle state', () => {
  it('renders idle hint when no interrupt is active', () => {
    render(<AgentChatPanel {...baseProps} interrupt={null} />);
    expect(screen.queryByTestId('agent-chat-input')).toBeNull();
    expect(screen.getByText(/idle/i)).toBeInTheDocument();
  });

  it('stays idle when interrupt targets a different agent', () => {
    render(
      <AgentChatPanel
        {...baseProps}
        interrupt={{ ...awaitingFrame, agent: 'audit' }}
      />,
    );
    expect(screen.queryByTestId('agent-chat-input')).toBeNull();
  });

  it('stays idle when interrupt is for a different case', () => {
    render(
      <AgentChatPanel
        {...baseProps}
        interrupt={{ ...awaitingFrame, case_id: 'case-other' }}
      />,
    );
    expect(screen.queryByTestId('agent-chat-input')).toBeNull();
  });

  it('stays idle for gate-pause InterruptEvent (no question field)', () => {
    // Gate pauses share kind="interrupt" but carry `gate`+`actions`,
    // not `question`+`interrupt_id`. The panel must not activate.
    render(
      <AgentChatPanel
        {...baseProps}
        interrupt={{
          kind: 'interrupt',
          case_id: 'case-1',
          gate: 'gate2',
          actions: ['advance'],
        }}
      />,
    );
    expect(screen.queryByTestId('agent-chat-input')).toBeNull();
  });
});

describe('<AgentChatPanel> awaiting state', () => {
  it('renders the agent question and editable input', () => {
    render(<AgentChatPanel {...baseProps} interrupt={awaitingFrame} />);
    expect(screen.getByText(awaitingFrame.question)).toBeInTheDocument();
    const input = screen.getByTestId('agent-chat-input');
    expect(input).not.toBeDisabled();
  });

  it('disables send when draft is empty', () => {
    render(<AgentChatPanel {...baseProps} interrupt={awaitingFrame} />);
    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).toBeDisabled();
  });

  it('posts to api.sendJudgeMessage with the right payload', async () => {
    api.sendJudgeMessage.mockResolvedValue({});
    render(<AgentChatPanel {...baseProps} interrupt={awaitingFrame} />);
    const input = screen.getByTestId('agent-chat-input');
    fireEvent.change(input, { target: { value: 'go with B' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(api.sendJudgeMessage).toHaveBeenCalledWith('case-1', {
        text: 'go with B',
        interruptId: 'a'.repeat(32),
      });
    });
  });

  it('clears input and shows optimistic delivered state after send', async () => {
    api.sendJudgeMessage.mockResolvedValue({});
    render(<AgentChatPanel {...baseProps} interrupt={awaitingFrame} />);
    const input = screen.getByTestId('agent-chat-input');
    fireEvent.change(input, { target: { value: 'go with B' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(input.value).toBe(''));
    expect(screen.getByText(/go with B/i)).toBeInTheDocument();
    expect(screen.getByText(/delivered/i)).toBeInTheDocument();
  });

  it('Enter sends; Shift+Enter inserts a newline', async () => {
    api.sendJudgeMessage.mockResolvedValue({});
    render(<AgentChatPanel {...baseProps} interrupt={awaitingFrame} />);
    const input = screen.getByTestId('agent-chat-input');
    fireEvent.change(input, { target: { value: 'reply' } });

    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(api.sendJudgeMessage).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(api.sendJudgeMessage).toHaveBeenCalledTimes(1));
  });

  it('surfaces api errors via onError', async () => {
    const onError = vi.fn();
    api.sendJudgeMessage.mockRejectedValue({ detail: 'stale interrupt_id' });
    render(<AgentChatPanel {...baseProps} interrupt={awaitingFrame} onError={onError} />);
    const input = screen.getByTestId('agent-chat-input');
    fireEvent.change(input, { target: { value: 'reply' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith('stale interrupt_id'));
  });

  it('resets optimistic state when a fresh interrupt arrives', async () => {
    api.sendJudgeMessage.mockResolvedValue({});
    const { rerender } = render(
      <AgentChatPanel {...baseProps} interrupt={awaitingFrame} />,
    );
    fireEvent.change(screen.getByTestId('agent-chat-input'), {
      target: { value: 'first reply' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(screen.getByText(/delivered/i)).toBeInTheDocument());

    // New interrupt comes in (fresh question, fresh interrupt_id).
    const next = {
      ...awaitingFrame,
      question: 'Second question?',
      interrupt_id: 'b'.repeat(32),
    };
    rerender(<AgentChatPanel {...baseProps} interrupt={next} />);
    expect(screen.queryByText(/first reply/i)).toBeNull();
    expect(screen.getByText(/Second question/i)).toBeInTheDocument();
  });
});
