import React, { useEffect, useRef, useState } from 'react';
import { Zap } from 'lucide-react';
import api from '../lib/api';
import { PIPELINE_AGENT_LABELS, normalizePipelineStatus } from '../lib/pipelineStatus';
import { normalizePipelineEventPayload } from '../lib/pipelineEventNormalizer';

function phaseStyles(phase) {
  switch (phase) {
    case 'completed':
      return {
        badge: 'bg-emerald-900 text-emerald-300 border border-emerald-700/60',
        card: 'border-emerald-700/40 bg-emerald-950/20',
      };
    case 'failed':
      return {
        badge: 'bg-rose-900 text-rose-300 border border-rose-700/60',
        card: 'border-rose-700/40 bg-rose-950/20',
      };
    case 'waiting':
      return {
        badge: 'bg-amber-900 text-amber-300 border border-amber-700/60',
        card: 'border-amber-700/40 bg-amber-950/20',
      };
    case 'handoff':
      return {
        badge: 'bg-fuchsia-900 text-fuchsia-300 border border-fuchsia-700/60',
        card: 'border-fuchsia-700/40 bg-fuchsia-950/20',
      };
    default:
      return {
        badge: 'bg-blue-900 text-blue-300 border border-blue-700/60',
        card: 'border-blue-700/40 bg-blue-950/20',
      };
  }
}

function formatTs(ts) {
  if (!ts) return 'now';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return 'now';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * AgentStreamPanel — right panel showing live pipeline events via SSE.
 * Falls back to polling GET /status every 5s if SSE fails or disconnects.
 */
export default function AgentStreamPanel({ caseId, selectedAgentId, agentStatuses }) {
  const [events, setEvents] = useState({}); // keyed by agent_id
  const [sseConnected, setSseConnected] = useState(false);
  const [sseError, setSseError] = useState(false);
  const [unsupportedStreamPayload, setUnsupportedStreamPayload] = useState(false);
  const [lastUpdateTs, setLastUpdateTs] = useState(null);
  const eventSourceRef = useRef(null);
  const scrollRef = useRef(null);
  const isManualScrollRef = useRef(false);
  const statusByAgentRef = useRef({});

  // Connect SSE on mount, reconnect on caseId change
  useEffect(() => {
    let pollInterval = null;
    let es = null;

    statusByAgentRef.current = {};
    setEvents({});
    setUnsupportedStreamPayload(false);

    const appendNormalizedEvents = (payload, source) => {
      const normalized = normalizePipelineEventPayload(payload, {
        source,
        previousStatusByAgent: statusByAgentRef.current,
      });

      statusByAgentRef.current = normalized.nextStatusByAgent;
      setUnsupportedStreamPayload(normalized.unsupported);

      if (!normalized.events.length) {
        return;
      }

      setLastUpdateTs(normalized.events[normalized.events.length - 1]?.ts || new Date().toISOString());

      setEvents((prev) => {
        const next = { ...prev };
        normalized.events.forEach((evt) => {
          next[evt.agentId] = [...(next[evt.agentId] || []), evt].slice(-120);
        });
        return next;
      });
    };

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

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          appendNormalizedEvents(data, 'sse');
        } catch {
          // ignore parse errors
        }
      };

      es.onerror = () => {
        setSseConnected(false);
        setSseError(true);
        es.close();
        // Fall back to polling
        if (!pollInterval) {
          pollInterval = setInterval(async () => {
            try {
              const status = await api.getPipelineStatus(caseId);
              const normalizedStatus = normalizePipelineStatus(status);
              appendNormalizedEvents(normalizedStatus, 'polling');
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
              <span className="w-2 h-2 rounded-full bg-emerald-400 motion-safe:animate-pulse" />
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
                  ? 'bg-blue-900 text-blue-300 motion-safe:animate-pulse'
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

      {unsupportedStreamPayload && (
        <div className="px-4 py-2 bg-amber-950/60 border-b border-amber-700/50">
          <p className="text-xs text-amber-200">
            Stream payload format is unsupported. Waiting for next compatible update.
          </p>
        </div>
      )}

      <div className="px-4 py-1.5 border-b border-gray-800 bg-gray-950/40">
        <p className="text-[10px] text-gray-500">
          last update: {lastUpdateTs ? formatTs(lastUpdateTs) : 'none'}
        </p>
      </div>

      {/* Event stream */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 text-xs text-gray-300 space-y-2"
        aria-live="polite"
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
            key={`${ev.ts || 't'}-${ev.phase || 'phase'}-${i}`}
            className={`rounded-lg border px-3 py-2 ${phaseStyles(ev.phase).card}`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className={`uppercase text-[10px] font-semibold px-2 py-0.5 rounded ${phaseStyles(ev.phase).badge}`}>
                {ev.phase}
              </span>
              <span className="text-[10px] text-gray-500">
                {formatTs(ev.ts)} {ev.synthetic ? '• snapshot' : ''}
              </span>
            </div>

            <p className="text-[11px] text-gray-100 leading-relaxed">
              <span className="text-gray-400">work:</span> {ev.workSummary}
            </p>
            <p className="text-[11px] text-gray-300 leading-relaxed mt-1">
              <span className="text-gray-500">thought:</span> {ev.thoughtSummary}
            </p>

            {(ev.fromAgentId || ev.toAgentId) && (
              <p className="text-[10px] text-fuchsia-300 mt-1.5">
                handoff: {ev.fromAgentId || 'upstream'} → {ev.toAgentId || 'downstream'}
              </p>
            )}

            {ev.error && (
              <p className="text-[10px] text-rose-300 mt-1.5">error: {ev.error}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
