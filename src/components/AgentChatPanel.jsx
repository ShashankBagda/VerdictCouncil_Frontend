// Q1.11 chat-steering — chat surface inside FocusDrawer for the focused
// agent. Renders the agent's pending question (if any) and an input
// field for the judge's reply. On send, posts /respond with
// action="message"; the backend fires `agent_resumed` which clears the
// interrupt and returns the card to its `running` UI.
//
// Spec: tasks/spec-2026-04-27-chat-steering.md
//
// Boundary calls baked into v1:
//  - Pattern B (agent-initiated only). The Judge cannot post unsolicited
//    messages — the input is disabled when no interrupt is pending.
//  - Synthesis is the only phase that registers `human_input` today
//    (PHASE_TOOL_NAMES["synthesis"]); rendering the panel for other
//    agents is harmless (it stays disabled) but visually noisy. The
//    drawer integration in T10 only mounts this for the synthesis card.
//  - Multi-turn within a phase is allowed: each `human_input` call
//    mints a fresh interrupt_id, so a fresh question + input replaces
//    the resolved one without explicit clearing.
//
// Open question deferred to a follow-up: persistent multi-message
// chat history (list of prior Q+A pairs visible in the drawer). v1
// shows only the current pending question; resolved Q+As are not
// re-rendered in this panel.

import { useCallback, useState } from 'react';
import { Send } from 'lucide-react';
import api from '../lib/api';

export default function AgentChatPanel({ caseId, agentId, interrupt, onError }) {
  const awaiting =
    interrupt
    && interrupt.kind === 'interrupt'
    && interrupt.case_id === caseId
    && interrupt.agent === agentId
    && typeof interrupt.question === 'string'
    && typeof interrupt.interrupt_id === 'string';

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  // Optimistic record of the most recent judge reply, kept locally so
  // the user sees their message rendered before the SSE round-trip.
  // Cleared whenever a fresh `awaiting` state appears (new question).
  const [lastSent, setLastSent] = useState(null);
  const [lastInterruptId, setLastInterruptId] = useState(null);

  // When a new interrupt arrives, reset the optimistic display.
  if (awaiting && interrupt.interrupt_id !== lastInterruptId) {
    setLastInterruptId(interrupt.interrupt_id);
    setLastSent(null);
  }

  const send = useCallback(async () => {
    if (!awaiting) return;
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    try {
      await api.sendJudgeMessage(caseId, {
        text,
        interruptId: interrupt.interrupt_id,
      });
      setLastSent(text);
      setDraft('');
    } catch (err) {
      onError?.(err?.detail || err?.message || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  }, [awaiting, draft, caseId, interrupt, onError]);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        send();
      }
    },
    [send],
  );

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border border-violet-500/40 bg-violet-950/30 px-3 py-2"
      data-testid="agent-chat-panel"
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-violet-300">
        Agent ↔ Judge
      </div>

      {awaiting ? (
        <div className="flex flex-col gap-2">
          <div className="rounded bg-slate-900/60 px-2 py-1.5 text-sm text-violet-100">
            <span className="text-violet-400">▸ </span>
            {interrupt.question}
          </div>
          {lastSent && (
            <div className="rounded bg-emerald-950/40 px-2 py-1.5 text-sm text-emerald-200">
              <span className="text-emerald-400">↩ </span>
              {lastSent}
              <span className="ml-2 text-[10px] text-emerald-400/70">delivered</span>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Reply to the agent…"
              rows={2}
              disabled={sending}
              className="flex-1 resize-none rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none disabled:opacity-50"
              data-testid="agent-chat-input"
            />
            <button
              type="button"
              onClick={send}
              disabled={sending || !draft.trim()}
              className="flex h-9 items-center gap-1 rounded bg-violet-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              title="Send reply (Enter)"
            >
              <Send className="h-3.5 w-3.5" />
              Send
            </button>
          </div>
        </div>
      ) : (
        <div className="text-xs italic text-slate-500">
          {lastSent
            ? 'Reply delivered — agent resuming…'
            : 'Idle — the agent will surface a question here when it needs your input.'}
        </div>
      )}
    </div>
  );
}
