import React, { useEffect, useRef, useState } from 'react';
import { Zap } from 'lucide-react';
import api from '../lib/api';
import {
  PIPELINE_AGENT_LABELS,
  isTerminalPipelineSseEvent,
  normalizePipelineStatus,
} from '../lib/pipelineStatus';

/**
 * AgentStreamPanel — right panel showing live pipeline events via SSE.
 * Falls back to polling GET /status every 5s if SSE fails or disconnects
 * *before* the pipeline has sent a terminal close event.
 */
export default function AgentStreamPanel({
  caseId,
  selectedAgentId,
  agentStatuses,
  onTerminal,
}) {
  const [events, setEvents] = useState({}); // keyed by agent_id
  const [sseConnected, setSseConnected] = useState(false);
  const [sseError, setSseError] = useState(false);
  const eventSourceRef = useRef(null);
  const scrollRef = useRef(null);
  const isManualScrollRef = useRef(false);
  const onTerminalRef = useRef(onTerminal);
  useEffect(() => {
    onTerminalRef.current = onTerminal;
  }, [onTerminal]);

  // Connect SSE on mount, reconnect on caseId change
  useEffect(() => {
    let pollInterval = null;
    let es = null;
    // The backend closes the stream after emitting a terminal event; any
    // subsequent `onerror` the browser fires is the spec-mandated retry
    // signal, not a real failure. Suppress the polling fallback in that
    // case so we don't keep querying /status for a finished case.
    let terminalReached = false;

    const connectSSE = () => {
      if (es) es.close();
      es = api.streamPipelineStatus(caseId);
      eventSourceRef.current = es;

      es.onopen = () => {
        setSseConnected(true);
        setSseError(false);
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      };

      const handleSseEvent = (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }

        if (isTerminalPipelineSseEvent(data)) {
          terminalReached = true;
          setSseConnected(false);
          setSseError(false);
          if (es) {
            es.close();
            es = null;
          }
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
          onTerminalRef.current?.(data);
          // Per-agent terminal phases (governance-verdict completed/failed)
          // are still useful UI state, so let them fall through to the
          // append below. The synthetic `pipeline` event has no per-agent
          // bucket and would just clutter an empty pane, so drop it.
          if (data.agent === 'pipeline') return;
        }

        if (data.agent) {
          setEvents((prev) => ({
            ...prev,
            [data.agent]: [...(prev[data.agent] || []), data],
          }));
        }
      };
      // Backend emits named SSE event types (`event: progress` / `event: agent`)
      // so EventSource.addEventListener fires correctly; onmessage only fires
      // for un-typed frames, which is now just the intake stream.
      es.addEventListener('progress', handleSseEvent);
      es.addEventListener('agent', handleSseEvent);
      // Heartbeat keeps the connection alive — no action needed beyond
      // confirming the EventSource is still healthy.
      es.addEventListener('heartbeat', () => {});
      // Session cookie is about to expire — redirect to login so the next
      // request doesn't hit a 401 mid-pipeline.
      es.addEventListener('auth_expiring', () => {
        window.location.href = '/login';
      });

      es.onerror = () => {
        setSseConnected(false);
        if (es) es.close();
        if (terminalReached) {
          // Clean post-terminal close — not an error worth surfacing or
          // backfilling with polling.
          return;
        }
        setSseError(true);
        // Fall back to polling
        if (!pollInterval) {
          pollInterval = setInterval(async () => {
            try {
              const status = await api.getPipelineStatus(caseId);
              const normalizedStatus = normalizePipelineStatus(status);
              // Synthesize events from status changes (for display continuity)
              if (normalizedStatus?.agents) {
                const synth = {};
                normalizedStatus.agents.forEach((a) => {
                  synth[a.agent_id] = [{ event: a.status, agent: a.agent_id, synthetic: true }];
                });
                setEvents((prev) => ({ ...synth, ...prev }));
              }
            } catch {
              // ignore
            }
          }, 5000);
        }
      };
    };

    connectSSE();

    return () => {
      if (es) es.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [caseId]);

  // Auto-scroll to bottom when new events arrive, unless user scrolled up
  useEffect(() => {
    if (!isManualScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events, selectedAgentId]);

  const agentEvents = selectedAgentId ? (events[selectedAgentId] || []) : [];
  const selectedAgent = agentStatuses?.find((a) => a.agent_id === selectedAgentId);

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-teal-400" />
          <span className="text-sm font-semibold text-white">
            {selectedAgentId ? PIPELINE_AGENT_LABELS[selectedAgentId] || selectedAgentId : 'Agent Stream'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {sseConnected ? (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          ) : sseError ? (
            <span className="flex items-center gap-1 text-xs text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Polling
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-full bg-gray-500" />
              Connecting
            </span>
          )}
        </div>
      </div>

      {/* Agent status badge */}
      {selectedAgent && (
        <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700/50">
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                selectedAgent.status === 'completed'
                  ? 'bg-emerald-900 text-emerald-300'
                  : selectedAgent.status === 'running'
                  ? 'bg-blue-900 text-blue-300 animate-pulse'
                  : selectedAgent.status === 'failed'
                  ? 'bg-rose-900 text-rose-300'
                  : 'bg-gray-700 text-gray-400'
              }`}
            >
              {selectedAgent.status}
            </span>
            {selectedAgent.elapsed_seconds && (
              <span className="text-xs text-gray-500">{selectedAgent.elapsed_seconds}s</span>
            )}
          </div>
        </div>
      )}

      {/* Event stream */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-xs text-gray-300 space-y-1"
        onScroll={(e) => {
          const el = e.currentTarget;
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
          isManualScrollRef.current = !atBottom;
        }}
      >
        {!selectedAgentId && (
          <p className="text-gray-500 italic">Click a room in the building to view its stream</p>
        )}
        {selectedAgentId && agentEvents.length === 0 && (
          <p className="text-gray-500 italic">No events yet for this agent</p>
        )}
        {agentEvents.map((ev, i) => (
          <div
            key={i}
            className={`py-0.5 ${ev.synthetic ? 'text-gray-500' : 'text-gray-200'}`}
          >
            {ev.synthetic ? (
              <span className="text-gray-500">~ status: {ev.event}</span>
            ) : ev.event === 'agent_started' ? (
              <span className="text-blue-400">▶ {ev.agent} started</span>
            ) : ev.event === 'agent_completed' ? (
              <span className="text-emerald-400">✓ {ev.agent} completed</span>
            ) : ev.event === 'agent_failed' ? (
              <span className="text-rose-400">✗ {ev.agent} failed: {ev.error}</span>
            ) : (
              <span>{JSON.stringify(ev)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
