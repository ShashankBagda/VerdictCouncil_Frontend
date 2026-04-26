import { useEffect, useRef, useState, useCallback } from 'react';
import api from '../lib/api';
import {
  isTerminalPipelineSseEvent,
  normalizePipelineStatus,
} from '../lib/pipelineStatus';
import { clearSessionTags, tagSession } from '../sentry';

// Q1.8 — fold a single conversational-mode agent frame into the per-agent
// accumulator. Mutates a shallow copy of the supplied state via setter.
//
// Shape per agent:
//   { raw: Event[],
//     prose: Record<message_id, string>,
//     toolCalls: Record<tool_call_id, { name, argsDelta }>,
//     artifact: Artifact | null,
//     failure: { errorClass: string } | null }
//
// `raw` keeps every frame in arrival order so consumers can reconstruct
// the prose/tool-call interleave that Q1.10 needs for inline chip
// placement; the structured fields are pre-derived for the common case.
function emptyAgentStreamSlot() {
  return { raw: [], prose: {}, toolCalls: {}, artifact: null, failure: null };
}

function accumulateAgentStream(setter, frame) {
  setter((prev) => {
    const slot = { ...(prev[frame.agent] || emptyAgentStreamSlot()) };
    slot.raw = [...slot.raw, frame];

    if (frame.event === 'llm_token' && frame.message_id) {
      const existing = slot.prose[frame.message_id] || '';
      slot.prose = { ...slot.prose, [frame.message_id]: existing + (frame.delta || '') };
    } else if (frame.event === 'tool_call_delta' && frame.tool_call_id) {
      const existing = slot.toolCalls[frame.tool_call_id];
      slot.toolCalls = {
        ...slot.toolCalls,
        [frame.tool_call_id]: {
          name: frame.name || existing?.name || '',
          argsDelta: (existing?.argsDelta || '') + (frame.args_delta || ''),
        },
      };
    } else if (frame.event === 'structured_artifact') {
      slot.artifact = frame.artifact || null;
    } else if (frame.event === 'agent_failed') {
      slot.failure = { errorClass: frame.error_class || '' };
    }

    return { ...prev, [frame.agent]: slot };
  });
}

/**
 * useAgentStream — live agent event stream over SSE with polling fallback.
 *
 * Opens a pipeline SSE connection and accumulates per-agent events.
 * Falls back to polling GET /status every 5 s if SSE fails before a
 * terminal event.  Re-arms the connection on tab visibility restore.
 *
 * @param {string} caseId
 * @param {object} options
 * @param {function} options.onTerminal  – called once with the terminal event data
 *
 * @returns {{ events, status, retry, lastError, interrupt, clearInterrupt }}
 *   events         – dict keyed by agent_id, each value is an array of raw SSE event objects
 *   agentStreams   – Q1.8 conversational-mode accumulator keyed by agent_id.
 *                    Each value: { raw: Event[], prose: Record<message_id,
 *                    string>, toolCalls: Record<tool_call_id, { name,
 *                    argsDelta }>, artifact: Artifact|null,
 *                    failure: { errorClass: string }|null }. Consumed by
 *                    Q1.10 ConversationStream; legacy consumers keep
 *                    reading the flat `events` dict.
 *   status         – 'connecting' | 'connected' | 'polling' | 'idle'
 *   retry          – function to force a reconnect
 *   lastError      – last polling error message, or null
 *   interrupt      – latest InterruptEvent frame for this caseId (or null).
 *                    Lets consumers mount <GateReviewPanel> on SSE arrival
 *                    without waiting for the next /status poll tick. Stays
 *                    sticky across renders; consumers must call
 *                    clearInterrupt() once polled overall_status catches up
 *                    or moves past the gate, otherwise the panel will linger
 *                    after the judge resumes.
 *   clearInterrupt – drop the stored interrupt frame.
 */
export function useAgentStream(caseId, options = {}) {
  const { onTerminal = null } = options;

  const [events, setEvents] = useState({});
  const [agentStreams, setAgentStreams] = useState({});
  const [status, setStatus] = useState('connecting');
  const [lastError, setLastError] = useState(null);
  const [interrupt, setInterrupt] = useState(null);

  // Drop any interrupt carried over from a prior caseId — using React's
  // recommended "store-previous-prop-in-state and reset during render"
  // pattern so the panel never renders the previous case's gate while
  // the new caseId is still loading.
  const [prevCaseId, setPrevCaseId] = useState(caseId);
  if (prevCaseId !== caseId) {
    setPrevCaseId(caseId);
    if (interrupt !== null) setInterrupt(null);
    setAgentStreams({});
  }

  const esRef = useRef(null);
  const pollRef = useRef(null);
  const reconnectRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  // Self-ref so the cold-start retry's setTimeout can re-enter `connect`
  // without referring to it before its useCallback declaration completes
  // (see effect below that keeps the ref in sync with each render).
  const connectRef = useRef(null);
  const terminalRef = useRef(false);
  const mountedRef = useRef(true);
  const onTerminalRef = useRef(onTerminal);
  // Keep onTerminalRef in sync with the latest callback value
  useEffect(() => { onTerminalRef.current = onTerminal; }, [onTerminal]);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const cancelReconnect = useCallback(() => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!caseId) return;
    if (esRef.current) esRef.current.close();

    const es = api.streamPipelineStatus(caseId);
    esRef.current = es;

    es.onopen = () => {
      if (!mountedRef.current) return;
      setStatus('connected');
      setLastError(null);
      reconnectAttemptRef.current = 0;
      cancelReconnect();
      stopPoll();
    };

    const handleSseEvent = (raw) => {
      if (!mountedRef.current) return;
      let data;
      try { data = JSON.parse(raw.data); } catch { return; }

      // Sprint 4 4.C5.2 — every frame that carries a backend trace_id
      // updates the Sentry scope so a subsequent frontend error attaches
      // the LangSmith trace URL of the most recent backend activity.
      // tagSession() is a no-op when Sentry isn't initialised (no DSN).
      if (data && data.trace_id) {
        tagSession(data.trace_id);
      }

      if (isTerminalPipelineSseEvent(data)) {
        terminalRef.current = true;
        setStatus('idle');
        esRef.current?.close();
        esRef.current = null;
        stopPoll();
        onTerminalRef.current?.(data);
        if (data.agent === 'pipeline') return;
      }

      if (data.agent) {
        setEvents((prev) => ({
          ...prev,
          [data.agent]: [...(prev[data.agent] || []), data],
        }));
        accumulateAgentStream(setAgentStreams, data);
      }
    };

    const handleInterrupt = (raw) => {
      if (!mountedRef.current) return;
      let data;
      try { data = JSON.parse(raw.data); } catch { return; }
      // Drop frames for any other case (defensive against reconnect replay
      // landing after caseId changed). The consumer still gates the panel
      // mount on polled overall_status, so a stale frame is harmless if it
      // sneaks through, but filtering at the seam keeps state honest.
      if (data?.case_id && caseId && String(data.case_id) !== String(caseId)) return;
      if (data?.trace_id) tagSession(data.trace_id);
      setInterrupt(data);
    };

    es.addEventListener('progress', handleSseEvent);
    es.addEventListener('agent', handleSseEvent);
    es.addEventListener('narration', handleSseEvent);
    es.addEventListener('interrupt', handleInterrupt);
    es.addEventListener('heartbeat', () => {});
    es.addEventListener('auth_expiring', () => {
      window.location.href = '/login';
    });

    es.onerror = () => {
      if (!mountedRef.current) return;
      esRef.current?.close();
      esRef.current = null;
      if (terminalRef.current) {
        setStatus('idle');
        return;
      }

      // Backend cold-start can return a transient 503 on the first SSE
      // open before Redis is reachable. Retry twice with backoff before
      // dropping to polling so the UI stays on the live "connected" path
      // instead of flipping to "polling" on the very first frame.
      const attempt = reconnectAttemptRef.current;
      if (attempt < 2) {
        reconnectAttemptRef.current = attempt + 1;
        setStatus('connecting');
        cancelReconnect();
        reconnectRef.current = setTimeout(() => {
          reconnectRef.current = null;
          if (mountedRef.current && !terminalRef.current) connectRef.current?.();
        }, 500 * (attempt + 1));
        return;
      }

      setStatus('polling');

      // Polling fallback: synthesise events from /status while SSE is down
      if (!pollRef.current) {
        pollRef.current = setInterval(async () => {
          try {
            const raw = await api.getPipelineStatus(caseId);
            const norm = normalizePipelineStatus(raw);
            if (norm?.agents) {
              setEvents((prev) => {
                const synth = {};
                norm.agents.forEach((a) => {
                  if (!prev[a.agent_id]?.length) {
                    synth[a.agent_id] = [{ event: a.status, agent: a.agent_id, synthetic: true }];
                  }
                });
                return { ...prev, ...synth };
              });
            }
            setLastError(null);
          } catch (err) {
            setLastError(err?.message || 'Polling error');
          }
        }, 5000);
      }
    };
  }, [caseId, stopPoll, cancelReconnect]);

  // Keep connectRef pointing at the latest `connect` so the cold-start
  // retry's setTimeout always invokes the current closure rather than a
  // stale one captured at the moment the timeout was scheduled.
  useEffect(() => { connectRef.current = connect; }, [connect]);

  const clearInterrupt = useCallback(() => setInterrupt(null), []);

  // Manual retry — re-arm SSE regardless of terminal state
  const retry = useCallback(() => {
    terminalRef.current = false;
    reconnectAttemptRef.current = 0;
    cancelReconnect();
    stopPoll();
    connect();
  }, [connect, stopPoll, cancelReconnect]);

  // Main effect: connect on mount / caseId change; re-arm on tab visibility restore.
  // No setState here — all state transitions happen inside SSE event callbacks.
  useEffect(() => {
    mountedRef.current = true;
    terminalRef.current = false;

    reconnectAttemptRef.current = 0;
    cancelReconnect();

    if (!caseId) {
      return () => {
        mountedRef.current = false;
        esRef.current?.close();
        cancelReconnect();
        stopPoll();
        // Drop any tags carried over from a prior caseId — without this,
        // a late frontend error would still attach the previous case's
        // backend_trace_id (Sprint 3 review finding).
        clearSessionTags();
      };
    }

    connect();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !terminalRef.current) {
        connect();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      esRef.current?.close();
      cancelReconnect();
      stopPoll();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Drop the previous case's backend_trace_id tag so it cannot
      // misattribute a late error from the prior session to the next
      // caseId. The next case's first SSE frame will re-stamp.
      clearSessionTags();
    };
  }, [caseId, connect, stopPoll, cancelReconnect]);

  return { events, agentStreams, status, retry, lastError, interrupt, clearInterrupt };
}

export default useAgentStream;
