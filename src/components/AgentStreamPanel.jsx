import React, { useEffect, useRef } from 'react';
import { Zap } from 'lucide-react';
import { useAgentStream } from '../hooks/useAgentStream';
import { PIPELINE_AGENT_LABELS } from '../lib/pipelineStatus';
import {
  formatToolCallArgs,
  formatToolResult,
  formatLlmResponse,
} from '../lib/eventFormatters';

function clip(s, max = 160) {
  const str = String(s ?? '');
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

function renderEvent(ev) {
  if (ev.synthetic) {
    return <span className="text-gray-500">~ status: {ev.event}</span>;
  }

  // PipelineProgressEvent (kind: "progress") — lifecycle phases
  if (ev.kind === 'progress' || ev.phase) {
    const phase = ev.phase;
    if (phase === 'started') return <span className="text-blue-400">▶ {ev.agent} started</span>;
    if (phase === 'completed') return <span className="text-emerald-400">✓ {ev.agent} completed</span>;
    if (phase === 'failed') return <span className="text-rose-400">✗ {ev.agent} failed{ev.error ? `: ${clip(ev.error, 80)}` : ''}</span>;
    return <span className="text-gray-400">{phase}: {ev.agent}</span>;
  }

  // AgentEvent (kind: "agent") — fine-grained telemetry
  const evType = ev.event;
  if (evType === 'thinking') {
    return <span className="text-purple-400">💭 {clip(ev.content, 140)}</span>;
  }
  if (evType === 'tool_call') {
    return (
      <span className="text-yellow-400">
        ⚙ {ev.tool_name}
        {ev.args != null && `: ${formatToolCallArgs(ev.tool_name, ev.args)}`}
      </span>
    );
  }
  if (evType === 'tool_result') {
    return (
      <span className="text-cyan-400">
        ↩ {ev.tool_name}: {formatToolResult(ev.tool_name, ev.result)}
      </span>
    );
  }
  if (evType === 'llm_response') {
    const summary = formatLlmResponse(ev.content);
    return <span className="text-emerald-400">◎ {summary || '(response)'}</span>;
  }
  if (evType === 'agent_completed') {
    return <span className="text-emerald-400">✓ {ev.agent} completed</span>;
  }

  // Fallback for unknown event shapes
  return <span className="text-gray-500">{JSON.stringify(ev)}</span>;
}

/**
 * AgentStreamPanel — right panel showing live pipeline events via SSE.
 * All connection logic is delegated to useAgentStream.
 */
export default function AgentStreamPanel({
  caseId,
  selectedAgentId,
  agentStatuses,
  onTerminal,
}) {
  const { events, status } = useAgentStream(caseId, { onTerminal });

  const scrollRef = useRef(null);
  const isManualScrollRef = useRef(false);

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
          {status === 'connected' ? (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          ) : status === 'polling' ? (
            <span className="flex items-center gap-1 text-xs text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Polling
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-full bg-gray-500" />
              {status === 'idle' ? 'Done' : 'Connecting'}
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
          <div key={i} className={`py-0.5 ${ev.synthetic ? 'text-gray-500' : 'text-gray-200'}`}>
            {renderEvent(ev)}
          </div>
        ))}
      </div>
    </div>
  );
}
