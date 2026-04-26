import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { Activity, AlertCircle, Play, RefreshCw, WifiOff } from 'lucide-react';
import { Streamdown } from 'streamdown';
import { code } from '@streamdown/code';
import { useAPI } from '../../hooks';
import api from '../../lib/api';
import AgentChatPanel from '../../components/AgentChatPanel';
import {
  pickCurrentGate,
  PIPELINE_AGENT_LABELS,
  PIPELINE_AGENT_ORDER,
} from '../../lib/pipelineStatus';
import {
  formatToolCallArgs,
  formatToolResult,
  formatLlmResponse,
  formatNarration,
} from '../../lib/eventFormatters';

// Plugin set for Streamdown — only `code` is needed for streamed agent
// reasoning (syntax-highlighted ``` blocks). Mermaid/math/cjk can be added
// later if model output starts emitting them.
const STREAMDOWN_PLUGINS = { code };

// ── Gate → agent mapping (mirrors backend builder.py topology) ────────────
// Gate 1 follows intake; Gate 2 follows the parallel research fan-in;
// Gate 3 follows synthesis; Gate 4 follows audit.
const AGENT_GATE = {
  intake:               'gate1',
  'research-evidence':  'gate2',
  'research-facts':     'gate2',
  'research-witnesses': 'gate2',
  'research-law':       'gate2',
  synthesis:            'gate3',
  audit:                'gate4',
};

// Only gate2 supports per-subagent rerun (one of the 4 research scopes);
// other gates re-run the whole phase, so we omit agent_name for them.
const PER_SUBAGENT_RERUN_GATES = new Set(['gate2']);

// Statuses from which the full pipeline can be (re-)started
const STARTABLE_STATUSES = new Set(['pending', 'ready_for_review', 'failed_retryable']);

// Statuses from which a failed/escalated pipeline can be restarted
const RESTARTABLE_STATUSES = new Set(['failed', 'failed_retryable', 'escalated']);

// Map overall_status → gate name
function currentGateFromStatus(overallStatus) {
  const m = String(overallStatus || '').match(/^awaiting_review_(gate\d)$/);
  return m ? m[1] : null;
}

// ── Agent metadata (layer grouping for the header label) ────────────────────
const AGENT_LAYER = {
  intake: 'Intake',
  'research-evidence': 'Research',
  'research-facts': 'Research',
  'research-witnesses': 'Research',
  'research-law': 'Research',
  synthesis: 'Synthesis',
  audit: 'Audit',
};

// Cards use a uniform dark neutral background so streamed agent text always
// reads with the same contrast. The per-layer colour shows up only as the
// border, the header accent stripe, the legend dot, and the layer badge —
// none of which sit behind body text.
const LAYER_COLORS = {
  Intake:    { bg: 'bg-slate-900', border: 'border-violet-500/70', stripe: 'bg-violet-500', badge: 'bg-violet-700 text-violet-50', dot: 'bg-violet-400' },
  Research:  { bg: 'bg-slate-900', border: 'border-teal-500/70',   stripe: 'bg-teal-500',   badge: 'bg-teal-700 text-teal-50',     dot: 'bg-teal-400' },
  Synthesis: { bg: 'bg-slate-900', border: 'border-sky-500/70',    stripe: 'bg-sky-500',    badge: 'bg-sky-700 text-sky-50',       dot: 'bg-sky-400' },
  Audit:     { bg: 'bg-slate-900', border: 'border-amber-500/70',  stripe: 'bg-amber-500',  badge: 'bg-amber-700 text-amber-50',   dot: 'bg-amber-400' },
};

// Tool calls that hit a vector store / external RAG corpus. Surfacing
// these in the stream makes it obvious when an agent is grounding its
// answer in retrieved evidence vs. reasoning over what's already in
// state. Mirrors the backend tools in src/tools/ that take a
// vector_store_id parameter or call vector_store_search internally.
const RAG_TOOLS = new Set([
  'search_precedents',       // PAIR API + OpenAI vector_store fallback
  'search_domain_guidance',  // OpenAI vector_store query
  'search_legal_rules',      // alias for search_domain_guidance
]);

// Resolve the event type from a SSE frame. Backend agent-event schemas
// (`LlmTokenEvent`, `ToolCallDeltaEvent`, `StructuredArtifactEvent`)
// overload `phase` to mean "the agent's scope name" (e.g. "intake")
// and put the actual event type in `event`. The older `PipelineProgress`
// envelope only carries `phase` (the lifecycle stage). So `event` wins
// when present; otherwise fall back to `phase`. Without this, every
// `llm_token` frame from intake gets misclassified as phase="intake"
// and falls through the EventLine switch into the "no payload" default.
function frameType(ev) {
  return ev.event || ev.phase;
}

// Backend emits per-token model events at ~30-100 tok/s — `llm_chunk`
// from non-conversational phases (factory.py `astream(stream_mode=
// "messages")`) and `llm_token` from conversational phases (intake,
// research, …) where StreamCoalescer batches deltas under a stable
// `message_id`. Both kinds get folded into a single rolling
// `llm_stream` event so the UI renders one growing markdown bubble
// per assistant turn instead of hundreds of DOM nodes. A change in
// `message_id` flushes the current bubble so a follow-up turn after
// a tool result starts fresh. `tool_call_delta` frames are dropped
// here — the wrapping `tool_call`/`tool_result` events from
// `sse_tool_emitter` already render the full call once.
function coalesceLlmChunks(events) {
  const out = [];
  let buffer = null;
  let bufferMessageId = null;
  for (const ev of events) {
    const phase = frameType(ev);
    if (phase === 'tool_call_delta') continue;
    if (phase === 'llm_chunk' || phase === 'llm_token') {
      const delta = ev.delta || ev.content || '';
      const msgId = ev.message_id || null;
      if (buffer && msgId && bufferMessageId && msgId !== bufferMessageId) {
        buffer.streaming = false;
        out.push(buffer);
        buffer = null;
        bufferMessageId = null;
      }
      if (buffer) {
        buffer.delta += delta;
        buffer.ts = ev.ts || buffer.ts;
        buffer.streaming = true;
      } else {
        buffer = { event: 'llm_stream', delta, ts: ev.ts, streaming: true };
        bufferMessageId = msgId;
      }
    } else {
      if (buffer) {
        buffer.streaming = false;
        out.push(buffer);
        buffer = null;
        bufferMessageId = null;
      }
      out.push(ev);
    }
  }
  if (buffer) out.push(buffer);
  return out;
}

// ── Status colours ──────────────────────────────────────────────────────────
function statusStyle(status) {
  switch (status) {
    case 'running':   return 'bg-blue-500/20 text-blue-300 border border-blue-500/30';
    case 'completed': return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    case 'failed':    return 'bg-rose-500/20 text-rose-300 border border-rose-500/30';
    default:          return 'bg-gray-700/40 text-gray-400 border border-gray-600/30';
  }
}

function statusDot(status) {
  switch (status) {
    case 'running':   return 'bg-blue-400 animate-pulse';
    case 'completed': return 'bg-emerald-400';
    case 'failed':    return 'bg-rose-400';
    default:          return 'bg-gray-600';
  }
}

// ── Single agent card ───────────────────────────────────────────────────────
function AgentCard({ agentId, agentStatus, events, canRun, isActionPending, onRun, isFocused, onFocus, awaitingInput }) {
  const scrollRef = useRef(null);
  const isManualRef = useRef(false);
  const label = PIPELINE_AGENT_LABELS[agentId] || agentId;
  const layer = AGENT_LAYER[agentId] || 'Intake';
  const colors = LAYER_COLORS[layer];
  const status = agentStatus?.status || 'pending';
  const isRunning = status === 'running';
  const renderedEvents = useMemo(() => coalesceLlmChunks(events), [events]);

  // Auto-scroll to bottom unless user scrolled up
  useEffect(() => {
    if (!isManualRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [renderedEvents]);

  return (
    <div
      className={`flex flex-col rounded-xl border ${colors.border} ${colors.bg} overflow-hidden transition-all ${
        isFocused ? 'ring-2 ring-teal-400/70 shadow-lg shadow-teal-500/10' : ''
      }`}
      style={{ minHeight: '220px' }}
    >
      {/* Top accent stripe — keeps the layer colour visible without
          tinting the body text background. */}
      <div className={`h-1 ${colors.stripe}`} />

      {/* Card header — clicking anywhere except the inner Run button focuses the card */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onFocus?.(agentId)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onFocus?.(agentId);
          }
        }}
        className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10 bg-slate-950/80 hover:bg-slate-950 transition-colors cursor-pointer"
        title={isFocused ? 'Click to close detail view' : 'Click to open detail view'}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className={`flex-shrink-0 w-2 h-2 rounded-full ${statusDot(status)}`} />
          <span className="text-sm font-semibold text-white truncate" title={label}>{label}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Q1.11 chat-steering — pulse the card header when this agent
              is paused on a `human_input` interrupt waiting for the
              judge. The drawer is the only place the judge can reply,
              so the badge doubles as an affordance to click into it. */}
          {awaitingInput && (
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-700/60 border border-violet-400/60 text-violet-50 animate-pulse"
              title="Agent is waiting for your reply — click to open the chat panel"
            >
              awaiting reply
            </span>
          )}
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${statusStyle(status)}`}>
            {status === 'pending' ? 'waiting' : status}
          </span>
          {agentStatus?.elapsed_seconds != null && (
            <span className="text-[10px] text-slate-400 tabular-nums">{agentStatus.elapsed_seconds}s</span>
          )}

          {/* ── Agent action button (single) ── */}
          {isRunning ? (
            <span
              className="flex items-center justify-center w-5 h-5 rounded bg-blue-600/30 border border-blue-500/40 text-blue-300"
              title="Agent is currently running"
            >
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            </span>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onRun?.(); }}
              disabled={!canRun || isActionPending}
              title={
                canRun
                  ? `Re-run ${label} from this agent`
                  : 'Available when pipeline is paused at this gate for review'
              }
              className={`flex items-center justify-center w-5 h-5 rounded transition-colors ${
                canRun && !isActionPending
                  ? 'bg-emerald-600/30 hover:bg-emerald-500/50 text-emerald-300 border border-emerald-600/40'
                  : 'bg-gray-700/30 text-gray-600 border border-gray-700/30 cursor-not-allowed'
              }`}
            >
              {isActionPending
                ? <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                : <Play className="w-2.5 h-2.5" fill="currentColor" />}
            </button>
          )}
        </div>
      </div>

      {/* Event stream */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-1 font-mono text-[11px] leading-relaxed text-slate-200"
        style={{ maxHeight: '200px' }}
        onScroll={(e) => {
          const el = e.currentTarget;
          isManualRef.current = el.scrollHeight - el.scrollTop - el.clientHeight > 24;
        }}
      >
        {renderedEvents.length === 0 ? (
          <span className="text-slate-400 italic">
            {status === 'running' ? 'Connecting to stream…' : 'Waiting for pipeline to reach this agent…'}
          </span>
        ) : (
          renderedEvents.map((ev, i) => <EventLine key={i} ev={ev} />)
        )}
      </div>
    </div>
  );
}

// ── Focus drawer ────────────────────────────────────────────────────────────
// Expanded detail view for a single agent. Renders beneath the grid when a
// card is clicked. Gives each event far more room than the 200px card pane —
// larger font, no height cap on the pane (scroll inside the drawer instead).
function FocusDrawer({ agentId, agentStatus, events, onClose, caseId, interrupt, onChatError }) {
  const scrollRef = useRef(null);
  const isManualRef = useRef(false);
  const label = PIPELINE_AGENT_LABELS[agentId] || agentId;
  const layer = AGENT_LAYER[agentId] || 'Intake';
  const colors = LAYER_COLORS[layer];
  const status = agentStatus?.status || 'pending';
  const renderedEvents = useMemo(() => coalesceLlmChunks(events), [events]);

  // Auto-scroll the drawer stream to the newest event unless the user
  // scrolled up — same behaviour as the small card pane.
  useEffect(() => {
    if (!isManualRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [renderedEvents]);

  // Count events by type for the header summary — useful at-a-glance context.
  // Use the coalesced view so a 200-token streaming response counts as one
  // "llm response", not 200 individual chunks.
  const counts = renderedEvents.reduce((acc, ev) => {
    const k = ev.event || 'other';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  return (
    <div
      className={`rounded-xl border ${colors.border} ${colors.bg} overflow-hidden flex flex-col`}
      style={{ minHeight: '420px' }}
    >
      <div className={`h-1 ${colors.stripe}`} />
      {/* Drawer header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-950/80">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`flex-shrink-0 w-2.5 h-2.5 rounded-full ${statusDot(status)}`} />
          <div className="flex flex-col min-w-0">
            <span className="text-base font-semibold text-white truncate">{label}</span>
            <div className="flex items-center gap-2 text-[11px] text-gray-400">
              <span className={`px-1.5 py-0.5 rounded ${colors.badge}`}>{layer}</span>
              <span className={`px-2 py-0.5 rounded-full capitalize ${statusStyle(status)}`}>
                {status === 'pending' ? 'waiting' : status}
              </span>
              {agentStatus?.elapsed_seconds != null && (
                <span>{agentStatus.elapsed_seconds}s elapsed</span>
              )}
              <span className="text-gray-500">·</span>
              <span>
                {events.length} event{events.length === 1 ? '' : 's'}
                {counts.tool_call ? ` · ${counts.tool_call} tool call${counts.tool_call === 1 ? '' : 's'}` : ''}
                {counts.llm_response ? ` · ${counts.llm_response} LLM response${counts.llm_response === 1 ? '' : 's'}` : ''}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 text-xs text-gray-400 hover:text-white border border-white/20 hover:border-white/40 rounded-md px-2.5 py-1 transition-colors"
          title="Close detail view"
        >
          Close ✕
        </button>
      </div>

      {/* Event stream — larger font, taller pane than the card */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5 font-mono text-[13px] leading-relaxed text-slate-200 bg-slate-950/40"
        style={{ maxHeight: '520px' }}
        onScroll={(e) => {
          const el = e.currentTarget;
          isManualRef.current = el.scrollHeight - el.scrollTop - el.clientHeight > 24;
        }}
      >
        {renderedEvents.length === 0 ? (
          <span className="text-slate-400 italic">
            {status === 'running' ? 'Connecting to stream…' : 'Waiting for pipeline to reach this agent…'}
          </span>
        ) : (
          renderedEvents.map((ev, i) => (
            <div key={i} className="py-0.5">
              <EventLine ev={ev} />
            </div>
          ))
        )}
      </div>

      {/* Q1.11 chat-steering — only synthesis is wired with the
          `human_input` tool today (PHASE_TOOL_NAMES["synthesis"]). Other
          agents render the panel in idle state if mounted, which is just
          noise — gate by agentId here. */}
      {agentId === 'synthesis' && (
        <div className="border-t border-white/10 px-4 py-3 bg-slate-950/40">
          <AgentChatPanel
            caseId={caseId}
            agentId={agentId}
            interrupt={interrupt}
            onError={onChatError}
          />
        </div>
      )}
    </div>
  );
}

// ── Individual event line ────────────────────────────────────────────────────
// Events come from two sources:
//   1. PipelineProgressEvent (SSE): {agent, phase, step, total, ts, error, detail, trace_id}
//   2. Synthetic poll-fallback: {agent, event, synthetic: true}
function EventLine({ ev }) {
  if (ev.synthetic) {
    return <span className="text-gray-400">~ status: {ev.event}</span>;
  }
  const phase = frameType(ev);
  const ts = ev.ts ? new Date(ev.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null;
  const tsSpan = ts ? <span className="text-gray-600 mr-1">[{ts}]</span> : null;

  switch (phase) {
    case 'started':
    case 'agent_started':
      return (
        <span className="text-blue-400">
          {tsSpan}▶ Agent started
          {ev.step != null ? <span className="text-gray-500 ml-1">(step {ev.step}/{ev.total})</span> : null}
        </span>
      );
    case 'completed':
    case 'agent_completed':
      return (
        <span className="text-emerald-400">
          {tsSpan}✓ Completed
          {ev.detail?.output_summary ? (
            <span className="text-gray-300 ml-2">{String(ev.detail.output_summary).slice(0, 120)}</span>
          ) : ev.output_summary ? (
            <span className="text-gray-300 ml-2">{String(ev.output_summary).slice(0, 120)}</span>
          ) : null}
        </span>
      );
    case 'failed':
    case 'agent_failed':
      return (
        <span className="text-rose-400">
          {tsSpan}✗ Failed
          {ev.error ? <span className="text-rose-300 ml-1">— {String(ev.error).slice(0, 160)}</span> : null}
        </span>
      );
    case 'awaiting_review':
      return (
        <span className="text-amber-400">
          {tsSpan}⏸ Paused for gate review
          {ev.detail?.stopped_at ? (
            <span className="text-gray-400 ml-1">({ev.detail.stopped_at})</span>
          ) : null}
        </span>
      );
    case 'terminal':
      return (
        <span className="text-gray-400 italic">
          {tsSpan}■ Pipeline halted
          {ev.detail?.reason ? <span className="ml-1">({ev.detail.reason})</span> : null}
        </span>
      );
    case 'tool_call': {
      const summary = formatToolCallArgs(ev.tool_name, ev.args);
      const isRag = RAG_TOOLS.has(ev.tool_name);
      return (
        <span className={isRag ? 'text-fuchsia-200' : 'text-cyan-300'}>
          {isRag ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 mr-1.5 rounded bg-fuchsia-700/40 border border-fuchsia-500/50 text-fuchsia-100 text-[10px] font-bold uppercase tracking-wider">
              📚 Vector store
            </span>
          ) : '⚙ '}
          <span className="font-semibold">{ev.tool_name || 'tool'}</span>
          {summary ? <span className="text-slate-300 ml-1.5">{summary}</span> : null}
        </span>
      );
    }
    case 'tool_result': {
      const summary = formatToolResult(ev.tool_name, ev.result);
      const isRag = RAG_TOOLS.has(ev.tool_name);
      return (
        <span className={isRag ? 'text-fuchsia-100' : 'text-cyan-200'}>
          {isRag ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 mr-1.5 rounded bg-fuchsia-700/40 border border-fuchsia-500/50 text-fuchsia-100 text-[10px] font-bold uppercase tracking-wider">
              📚 RAG hit
            </span>
          ) : '↩ '}
          <span className="font-semibold">{ev.tool_name || 'result'}</span>
          {summary ? <span className="text-slate-300 ml-1.5">{summary}</span> : null}
        </span>
      );
    }
    case 'narration':
      return (
        <span className="text-amber-200 italic">
          {tsSpan}
          <span className="text-amber-400 not-italic">💬 </span>
          {formatNarration(ev.content || '')}
        </span>
      );
    case 'llm_stream':
      // Coalesced run of `llm_chunk` events — render the accumulated
      // delta as live markdown via Streamdown. Streamdown handles
      // partial fences gracefully, owns the typing-cursor (`caret`),
      // and disables copy-button controls while `isAnimating` is true
      // so the user can't grab a half-formed response.
      return (
        <div className="flex gap-1.5 text-slate-100 leading-relaxed">
          <span className="text-teal-400 select-none flex-shrink-0">◆</span>
          <Streamdown
            plugins={STREAMDOWN_PLUGINS}
            isAnimating={!!ev.streaming}
            caret="block"
            controls={!ev.streaming}
            className="prose prose-invert prose-sm max-w-none flex-1 prose-pre:bg-slate-950 prose-pre:border prose-pre:border-slate-800 prose-code:text-teal-200 prose-headings:text-slate-100 prose-strong:text-white prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5"
          >
            {ev.delta || ''}
          </Streamdown>
        </div>
      );
    case 'llm_response':
    case 'response': {
      // Final, non-streaming model response. Render in static mode so
      // copy buttons + link-safety modals are active.
      const content = formatLlmResponse(ev.content || ev.message || '');
      const text = typeof content === 'string' ? content : String(content ?? '');
      return (
        <div className="flex gap-1.5 text-white leading-relaxed">
          <span className="text-teal-400 select-none flex-shrink-0">◆</span>
          <Streamdown
            mode="static"
            plugins={STREAMDOWN_PLUGINS}
            className="prose prose-invert prose-sm max-w-none flex-1 prose-pre:bg-slate-950 prose-pre:border prose-pre:border-slate-800 prose-code:text-teal-200 prose-headings:text-slate-100 prose-strong:text-white prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5"
          >
            {text}
          </Streamdown>
        </div>
      );
    }
    case 'token_usage': {
      const usage = ev.usage || {};
      return (
        <span className="text-slate-500 text-[10px]">
          {tsSpan}
          <span className="opacity-70">↯ tokens</span>
          <span className="ml-1 tabular-nums">
            in {usage.prompt_tokens ?? '?'} · out {usage.completion_tokens ?? '?'}
            {usage.total_tokens != null ? ` · total ${usage.total_tokens}` : ''}
          </span>
        </span>
      );
    }
    case 'thinking':
    case 'agent_thinking':
      return (
        <span className="text-violet-300 italic">
          {tsSpan}
          <span className="text-violet-400 not-italic">… </span>
          {ev.content || ev.message || ev.detail?.summary || ''}
        </span>
      );
    default: {
      // Avoid dumping the whole SSE envelope (kind, schema_version,
      // case_id, agent, …) — it's noisy and exposes internal IDs.
      // Show just the salient bits in a tag-only line.
      const summary = ev.content || ev.message
        || (ev.detail ? JSON.stringify(ev.detail).slice(0, 120) : null);
      return (
        <span className="text-slate-400">
          {tsSpan}
          {phase ? <span className="text-slate-500">[{phase}] </span> : null}
          {summary || <span className="opacity-60 italic">no payload</span>}
        </span>
      );
    }
  }
}

// ── Overall progress bar ─────────────────────────────────────────────────────
function OverallProgressBar({ pipelineStatus, isStale, isGivenUp, error: _error, retry }) {
  if (!pipelineStatus) return null;
  const pct = pipelineStatus.overall_progress_percent || 0;
  const overallStatus = pipelineStatus.overall_status || 'pending';

  const statusColour =
    overallStatus === 'processing' ? 'bg-blue-600'
    : overallStatus === 'ready_for_review' || overallStatus === 'completed' ? 'bg-emerald-500'
    : overallStatus === 'failed' ? 'bg-rose-500'
    : 'bg-gray-500';

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${statusColour} rounded-full transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-gray-300 tabular-nums w-9 text-right">{pct}%</span>
      <span className={`text-xs font-semibold capitalize px-2 py-0.5 rounded ${
        overallStatus === 'processing' ? 'bg-blue-900/60 text-blue-300'
        : overallStatus === 'ready_for_review' || overallStatus === 'completed' ? 'bg-emerald-900/60 text-emerald-300'
        : overallStatus === 'failed' ? 'bg-rose-900/60 text-rose-300'
        : 'bg-gray-700 text-gray-400'
      }`}>
        {overallStatus.replace(/_/g, ' ')}
      </span>
      {isStale && !isGivenUp && (
        <span className="flex items-center gap-1 text-xs text-amber-500" title="Data may be stale">
          <WifiOff className="w-3 h-3" /> Stale
        </span>
      )}
      {isGivenUp && (
        <button
          onClick={retry}
          className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300"
        >
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function BuildingSimulation() {
  const { caseId } = useParams();
  const { showError, showNotification } = useAPI();

  // Live state for the workspace lives at the CaseDetail route — both
  // the SSE stream and the /status polling open network connections, so
  // they're hoisted to the parent and shared via Outlet context. Reading
  // them here avoids a second EventSource + a second polling loop.
  const { stream, pipeline } = useOutletContext();
  const { events, status: sseStatus, interrupt } = stream;
  const {
    loading,
    pipelineStatus,
    error,
    isStale,
    isGivenUp,
    retry,
  } = pipeline;

  // Which agent card is currently expanded in the detail drawer. Clicking
  // the same card again closes the drawer.
  const [focusedAgentId, setFocusedAgentId] = useState(null);
  const toggleFocus = useCallback((agentId) => {
    setFocusedAgentId((prev) => (prev === agentId ? null : agentId));
  }, []);

  // Per-agent action pending state (run button spinner)
  const [pendingAgents, setPendingAgents] = useState({});

  // Full pipeline start pending
  const [pipelinePending, setPipelinePending] = useState(false);

  const overallStatus = pipelineStatus?.overall_status || '';
  const polledGate = currentGateFromStatus(overallStatus);
  // Reconcile the polled gate with the SSE-pushed interrupt: SSE wins
  // while polled is still pre-gate AND when it announces a strictly
  // later gate (back-to-back transition where polling missed the brief
  // processing window). Polled wins on tie or stale replay. See
  // pickCurrentGate() in lib/pipelineStatus.js for the full rule.
  const interruptGate = interrupt?.case_id === caseId ? interrupt.gate : null;
  const currentGate = pickCurrentGate(polledGate, interruptGate, overallStatus);
  const isStartable = STARTABLE_STATUSES.has(overallStatus);
  const isRestartable = RESTARTABLE_STATUSES.has(overallStatus);

  // CaseDetail owns clearing the sticky SSE interrupt frame once the
  // resolved gate has moved on — no per-tab cleanup needed here.

  // Run the full pipeline (when pending/failed)
  const handleRunPipeline = useCallback(async () => {
    if (pipelinePending) return;
    try {
      setPipelinePending(true);
      await api.runCase(caseId);
      showNotification('Pipeline started', 'success');
    } catch (err) {
      console.error('Run Pipeline failed', { status: err?.status, detail: err?.detail, payload: err?.payload });
      showError(err?.detail || err?.message || 'Failed to start pipeline');
    } finally {
      setPipelinePending(false);
    }
  }, [caseId, pipelinePending, showError, showNotification]);

  // Restart the pipeline after a failure/escalation
  const handleRestartPipeline = useCallback(async () => {
    if (pipelinePending) return;
    try {
      setPipelinePending(true);
      await api.restartPipeline(caseId);
      showNotification('Pipeline restart enqueued', 'success');
    } catch (err) {
      showError(err?.detail || err?.message || 'Failed to restart pipeline');
    } finally {
      setPipelinePending(false);
    }
  }, [caseId, pipelinePending, showError, showNotification]);

  // Re-run a specific agent (only when case is paused at that agent's gate)
  const handleRunAgent = useCallback(async (agentId) => {
    if (pendingAgents[agentId]) return;
    const gate = AGENT_GATE[agentId];
    try {
      setPendingAgents((prev) => ({ ...prev, [agentId]: true }));
      await api.rerunGate(
        caseId,
        gate,
        PER_SUBAGENT_RERUN_GATES.has(gate) ? { agentName: agentId } : {},
      );
      showNotification(`Re-running ${PIPELINE_AGENT_LABELS[agentId] || agentId}…`, 'success');
    } catch (err) {
      showError(err?.detail || err?.message || `Failed to re-run agent`);
    } finally {
      setPendingAgents((prev) => ({ ...prev, [agentId]: false }));
    }
  }, [caseId, pendingAgents, showError, showNotification]);

  if (loading && !pipelineStatus) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="spinner w-8 h-8 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Connecting to pipeline…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between bg-gray-900/80 rounded-xl border border-gray-700/50 px-5 py-3 gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-400 flex-shrink-0" />
            <h2 className="text-base font-bold text-white truncate">Agent Workspace</h2>
            <div className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sseStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
              <span className={`text-xs ${sseStatus === 'connected' ? 'text-emerald-400' : 'text-gray-500'}`}>
                {sseStatus === 'connected' ? 'Live' : sseStatus === 'polling' ? 'Polling' : 'Connecting'}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            7-agent pipeline · case {caseId.slice(0, 8)}…
          </p>
        </div>

        <div className="flex-1 max-w-md">
          <OverallProgressBar
            pipelineStatus={pipelineStatus}
            isStale={isStale}
            isGivenUp={isGivenUp}
            error={error}
            retry={retry}
          />
        </div>

        {/* ── Run Pipeline button (only when startable) ── */}
        {isStartable && (
          <button
            onClick={handleRunPipeline}
            disabled={pipelinePending}
            className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300 hover:text-emerald-200 border border-emerald-700/50 hover:border-emerald-500/60 bg-emerald-900/20 hover:bg-emerald-800/30 rounded-lg px-3 py-1.5 transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Start the 7-agent pipeline for this case"
          >
            {pipelinePending
              ? <span className="w-3 h-3 rounded-full border border-emerald-400 border-t-transparent animate-spin" />
              : <Play className="w-3.5 h-3.5" fill="currentColor" />}
            Run Pipeline
          </button>
        )}

        {/* ── Restart Pipeline button (only when failed/escalated) ── */}
        {isRestartable && (
          <button
            onClick={handleRestartPipeline}
            disabled={pipelinePending}
            className="flex items-center gap-1.5 text-xs font-semibold text-rose-300 hover:text-rose-200 border border-rose-700/50 hover:border-rose-500/60 bg-rose-900/20 hover:bg-rose-800/30 rounded-lg px-3 py-1.5 transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Restart the pipeline from the beginning"
          >
            {pipelinePending
              ? <span className="w-3 h-3 rounded-full border border-rose-400 border-t-transparent animate-spin" />
              : <RefreshCw className="w-3.5 h-3.5" />}
            Restart Pipeline
          </button>
        )}
      </div>

      {/* ── Error / stale banners ── */}
      {isGivenUp && (
        <div className="flex items-center justify-between bg-rose-950/60 border border-rose-700/40 rounded-xl px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm text-rose-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Pipeline polling stopped.
            {error && <span className="text-rose-400 text-xs ml-1">({error})</span>}
          </div>
          <button onClick={retry} className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 font-semibold">
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}
      {isStale && !isGivenUp && (
        <div className="flex items-center gap-2 bg-amber-950/40 border border-amber-700/30 rounded-xl px-4 py-2 text-sm text-amber-400">
          <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
          Pipeline data may be stale — waiting for next server update.
        </div>
      )}

      {/* Gate review panel is rendered once at the CaseDetail route
          level (above the tab strip), so it appears for every tab
          without each tab re-mounting it. */}

      {/* ── Agent grid (one row per LangGraph layer) ── */}
      <div className="flex flex-col gap-3">
        {Object.keys(LAYER_COLORS).map((layer) => {
          const layerAgents = PIPELINE_AGENT_ORDER.filter((id) => AGENT_LAYER[id] === layer);
          if (layerAgents.length === 0) return null;
          // Cap at 2 columns so cards stay wide enough to show the agent
          // name unclipped — Research has 4 agents, so they stack 2×2.
          const cols = Math.min(layerAgents.length, 2);
          return (
            <div key={layer} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 px-1">
                <span className={`w-1.5 h-1.5 rounded-full ${LAYER_COLORS[layer].dot}`} />
                <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                  {layer}
                </span>
                <span className="text-[10px] text-slate-500">
                  · gate {AGENT_GATE[layerAgents[0]]?.replace('gate', '')}
                </span>
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                {layerAgents.map((agentId) => {
                  const agentStatus = pipelineStatus?.agents?.find((a) => a.agent_id === agentId);
                  const agentEvents = events[agentId] || [];
                  const agentCanRun = currentGate != null && AGENT_GATE[agentId] === currentGate;
                  // Q1.11 — agent is paused on a human_input interrupt
                  // targeting this card. Surfaces the "awaiting reply"
                  // badge in the header.
                  const awaitingInput =
                    !!interrupt
                    && interrupt.kind === 'interrupt'
                    && interrupt.case_id === caseId
                    && interrupt.agent === agentId
                    && typeof interrupt.question === 'string';
                  return (
                    <AgentCard
                      key={agentId}
                      agentId={agentId}
                      agentStatus={agentStatus}
                      events={agentEvents}
                      canRun={agentCanRun}
                      isActionPending={!!pendingAgents[agentId]}
                      onRun={() => handleRunAgent(agentId)}
                      isFocused={focusedAgentId === agentId}
                      onFocus={toggleFocus}
                      awaitingInput={awaitingInput}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Detail drawer (opens when an agent card is clicked) ── */}
      {focusedAgentId && (
        <FocusDrawer
          agentId={focusedAgentId}
          agentStatus={pipelineStatus?.agents?.find((a) => a.agent_id === focusedAgentId)}
          events={events[focusedAgentId] || []}
          onClose={() => setFocusedAgentId(null)}
          caseId={caseId}
          interrupt={interrupt}
          onChatError={showError}
        />
      )}

      {/* ── Layer legend ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1">
        <span className="text-xs font-semibold text-slate-400">Layers:</span>
        {Object.entries(LAYER_COLORS).map(([layer, colors]) => (
          <div key={layer} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
            <span className="text-xs text-slate-300">{layer}</span>
          </div>
        ))}
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-fuchsia-700/30 border border-fuchsia-500/40 text-fuchsia-200 text-[10px] font-bold uppercase tracking-wider">
          📚 RAG
        </span>
        <span className="text-[11px] text-slate-400">
          marks tool calls that fetch from a vector store
        </span>
        <span className="ml-auto text-xs text-slate-400">
          All agent streams are live via SSE
        </span>
      </div>
    </div>
  );
}
