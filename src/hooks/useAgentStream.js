import { useEffect, useRef, useState, useCallback } from 'react';
import api from '../lib/api';
import {
  isTerminalPipelineSseEvent,
  normalizePipelineStatus,
} from '../lib/pipelineStatus';
import { clearSessionTags, tagSession } from '../sentry';

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
 * @returns {{ events, status, retry, lastError }}
 *   events    – dict keyed by agent_id, each value is an array of raw SSE event objects
 *   status    – 'connecting' | 'connected' | 'polling' | 'idle'
 *   retry     – function to force a reconnect
 *   lastError – last polling error message, or null
 */
export function useAgentStream(caseId, options = {}) {
  const { onTerminal = null } = options;

  const [events, setEvents] = useState({});
  const [status, setStatus] = useState('connecting');
  const [lastError, setLastError] = useState(null);

  const esRef = useRef(null);
  const pollRef = useRef(null);
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

  const connect = useCallback(() => {
    if (!caseId) return;
    if (esRef.current) esRef.current.close();

    const es = api.streamPipelineStatus(caseId);
    esRef.current = es;

    es.onopen = () => {
      if (!mountedRef.current) return;
      setStatus('connected');
      setLastError(null);
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
      }
    };

    es.addEventListener('progress', handleSseEvent);
    es.addEventListener('agent', handleSseEvent);
    es.addEventListener('narration', handleSseEvent);
    es.addEventListener('heartbeat', () => {});
    es.addEventListener('auth_expiring', () => {
      window.location.href = '/login';
    });

    es.onerror = () => {
      if (!mountedRef.current) return;
      setStatus(terminalRef.current ? 'idle' : 'polling');
      esRef.current?.close();
      esRef.current = null;
      if (terminalRef.current) return;

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
  }, [caseId, stopPoll]);

  // Manual retry — re-arm SSE regardless of terminal state
  const retry = useCallback(() => {
    terminalRef.current = false;
    stopPoll();
    connect();
  }, [connect, stopPoll]);

  // Main effect: connect on mount / caseId change; re-arm on tab visibility restore.
  // No setState here — all state transitions happen inside SSE event callbacks.
  useEffect(() => {
    mountedRef.current = true;
    terminalRef.current = false;

    if (!caseId) {
      return () => {
        mountedRef.current = false;
        esRef.current?.close();
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
      stopPoll();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Drop the previous case's backend_trace_id tag so it cannot
      // misattribute a late error from the prior session to the next
      // caseId. The next case's first SSE frame will re-stamp.
      clearSessionTags();
    };
  }, [caseId, connect, stopPoll]);

  return { events, status, retry, lastError };
}

export default useAgentStream;
