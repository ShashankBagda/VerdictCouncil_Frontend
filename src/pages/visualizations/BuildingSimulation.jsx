import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Activity, AlertCircle, ExternalLink, Play, RefreshCw, WifiOff } from 'lucide-react';
import { useAPI, useCase, usePipelineStatus } from '../../hooks';
import GateReviewPanel from '../../components/cases/GateReviewPanel';
import api from '../../lib/api';
import {
  PIPELINE_AGENT_LABELS,
  PIPELINE_AGENT_ORDER,
  isTerminalPipelineSseEvent,
  normalizePipelineStatus,
} from '../../lib/pipelineStatus';

// ── Gate → agent mapping (mirrors backend GATE_AGENTS) ────────────────────
const AGENT_GATE = {
  'case-processing':    'gate1',
  'complexity-routing': 'gate1',
  'evidence-analysis':  'gate2',
  'fact-reconstruction':'gate2',
  'witness-analysis':   'gate2',
  'legal-knowledge':    'gate2',
  'argument-construction': 'gate3',
  'hearing-analysis':   'gate3',
  'hearing-governance': 'gate4',
};

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
  'case-processing': 'Intake',
  'complexity-routing': 'Intake',
  'evidence-analysis': 'Evidence',
  'fact-reconstruction': 'Evidence',
  'witness-analysis': 'Evidence',
  'legal-knowledge': 'Legal',
  'argument-construction': 'Legal',
  'hearing-analysis': 'Decision',
  'hearing-governance': 'Decision',
};

const LAYER_COLORS = {
  Intake:   { bg: 'bg-violet-900/75', border: 'border-violet-500/60', badge: 'bg-violet-700 text-violet-100', dot: 'bg-violet-400' },
  Evidence: { bg: 'bg-teal-900/75',   border: 'border-teal-500/60',   badge: 'bg-teal-700 text-teal-100',   dot: 'bg-teal-400' },
  Legal:    { bg: 'bg-blue-900/75',   border: 'border-blue-500/60',   badge: 'bg-blue-700 text-blue-100',   dot: 'bg-blue-400' },
  Decision: { bg: 'bg-amber-900/75',  border: 'border-amber-500/60',  badge: 'bg-amber-700 text-amber-100', dot: 'bg-amber-400' },
};

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
function AgentCard({ agentId, agentStatus, events, canRun, isActionPending, onRun }) {
  const scrollRef = useRef(null);
  const isManualRef = useRef(false);
  const label = PIPELINE_AGENT_LABELS[agentId] || agentId;
  const layer = AGENT_LAYER[agentId] || 'Intake';
  const colors = LAYER_COLORS[layer];
  const status = agentStatus?.status || 'pending';
  const isRunning = status === 'running';

  // MLflow ids are included in PipelineProgressEvent SSE events emitted
  // by the LangGraph runner. Find the most recent event that carries them
  // so the link works even if the polled /status endpoint has no idea.
  const mlflowEvent = [...events].reverse().find((e) => e?.mlflow_run_id);
  const mlflowRunId = mlflowEvent?.mlflow_run_id ?? agentStatus?.mlflow_run_id;
  const mlflowExperimentId =
    mlflowEvent?.mlflow_experiment_id ?? agentStatus?.mlflow_experiment_id;

  // Auto-scroll to bottom unless user scrolled up
  useEffect(() => {
    if (!isManualRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <div
      className={`flex flex-col rounded-xl border ${colors.border} ${colors.bg} overflow-hidden`}
      style={{ minHeight: '220px' }}
    >
      {/* Card header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-black/35">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`flex-shrink-0 w-2 h-2 rounded-full ${statusDot(status)}`} />
          <span className="text-sm font-semibold text-white truncate">{label}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${colors.badge}`}>
            {layer}
          </span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${statusStyle(status)}`}>
            {status === 'pending' ? 'waiting' : status}
          </span>
          {agentStatus?.elapsed_seconds != null && (
            <span className="text-[10px] text-gray-500">{agentStatus.elapsed_seconds}s</span>
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
              onClick={onRun}
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

      {/* MLflow run link (shown only when the backend reported a real MLflow run_id) */}
      {mlflowRunId && (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-black/10 border-b border-white/5">
          <Activity className="w-3 h-3 text-amber-400 flex-shrink-0" />
          <span className="text-[10px] text-gray-400">MLflow run:</span>
          <a
            href={`${import.meta.env.VITE_MLFLOW_URL || 'http://localhost:5001'}/#/experiments/${mlflowExperimentId ?? 0}/runs/${mlflowRunId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-amber-400 hover:text-amber-300 font-mono flex items-center gap-0.5"
            title="Open in MLflow UI"
          >
            {mlflowRunId.slice(0, 12)}…
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      )}

      {/* Event stream */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-1 font-mono text-[11px] leading-relaxed"
        style={{ maxHeight: '200px' }}
        onScroll={(e) => {
          const el = e.currentTarget;
          isManualRef.current = el.scrollHeight - el.scrollTop - el.clientHeight > 24;
        }}
      >
        {events.length === 0 ? (
          <span className="text-gray-400 italic">
            {status === 'running' ? 'Connecting to stream…' : 'Waiting for pipeline to reach this agent…'}
          </span>
        ) : (
          events.map((ev, i) => <EventLine key={i} ev={ev} />)
        )}
      </div>
    </div>
  );
}

// ── Individual event line ────────────────────────────────────────────────────
// Events come from two sources:
//   1. PipelineProgressEvent (SSE): {agent, phase, step, total, ts, error, detail, mlflow_run_id}
//   2. Synthetic poll-fallback: {agent, event, synthetic: true}
function EventLine({ ev }) {
  if (ev.synthetic) {
    return <span className="text-gray-400">~ status: {ev.event}</span>;
  }
  // Normalise: LangGraph sends ev.phase; legacy Solace events used ev.event.
  const phase = ev.phase || ev.event;
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
    default:
      return (
        <span className="text-gray-300">
          {tsSpan}
          {phase ? <span className="text-gray-400">[{phase}] </span> : null}
          {ev.content || ev.message || (ev.detail ? JSON.stringify(ev.detail).slice(0, 120) : JSON.stringify(ev).slice(0, 120))}
        </span>
      );
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
  const { updatePipelineStatus } = useCase();

  // SSE events keyed by agent_id
  const [events, setEvents] = useState({});
  const [sseConnected, setSseConnected] = useState(false);

  // Per-agent action pending state (run button spinner)
  const [pendingAgents, setPendingAgents] = useState({});

  // Full pipeline start pending
  const [pipelinePending, setPipelinePending] = useState(false);

  const {
    loading,
    pipelineStatus,
    error,
    isStale,
    isGivenUp,
    retry,
  } = usePipelineStatus(caseId, {
    onStatus: updatePipelineStatus,
    onError: showError,
  });

  // SSE connection for live agent streams
  useEffect(() => {
    let es = null;
    let pollInterval = null;
    let terminalReached = false;

    const connect = () => {
      if (es) es.close();
      es = api.streamPipelineStatus(caseId);

      es.onopen = () => {
        setSseConnected(true);
        if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
      };

      es.onmessage = (raw) => {
        let data;
        try { data = JSON.parse(raw.data); } catch { return; }

        if (isTerminalPipelineSseEvent(data)) {
          terminalReached = true;
          setSseConnected(false);
          es?.close(); es = null;
          if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
          if (data.agent === 'pipeline') return;
        }

        if (data.agent) {
          setEvents((prev) => ({
            ...prev,
            [data.agent]: [...(prev[data.agent] || []), data],
          }));
        }
      };

      es.onerror = () => {
        setSseConnected(false);
        if (es) { es.close(); es = null; }
        if (terminalReached) return;
        // Fallback: synthesise events from polling status
        if (!pollInterval) {
          pollInterval = setInterval(async () => {
            try {
              const status = await api.getPipelineStatus(caseId);
              const norm = normalizePipelineStatus(status);
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
            } catch { /* ignore */ }
          }, 5000);
        }
      };
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !terminalReached) {
        connect();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    connect();
    return () => {
      es?.close();
      if (pollInterval) clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [caseId]);

  // Force an immediate status poll when the tab regains focus so that
  // gate-pause transitions aren't missed while the tab was hidden.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') retry();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [retry]);

  const mlflowUrl = import.meta.env.VITE_MLFLOW_URL || 'http://localhost:5001';

  const overallStatus = pipelineStatus?.overall_status || '';
  const currentGate = currentGateFromStatus(overallStatus);
  const isStartable = STARTABLE_STATUSES.has(overallStatus);
  const isRestartable = RESTARTABLE_STATUSES.has(overallStatus);

  // Run the full pipeline (when pending/failed)
  const handleRunPipeline = useCallback(async () => {
    if (pipelinePending) return;
    try {
      setPipelinePending(true);
      await api.runCase(caseId);
      showNotification('Pipeline started', 'success');
    } catch (err) {
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
      await api.rerunGate(caseId, gate, { agentName: agentId });
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
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sseConnected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
              <span className={`text-xs ${sseConnected ? 'text-emerald-400' : 'text-gray-500'}`}>
                {sseConnected ? 'Live' : 'Polling'}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            9-agent pipeline · case {caseId.slice(0, 8)}…
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
            title="Start the 9-agent pipeline for this case"
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

        <a
          href={mlflowUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 border border-amber-700/40 hover:border-amber-500/60 rounded-lg px-3 py-1.5 transition-colors flex-shrink-0"
          title="Open MLflow tracking UI"
        >
          <Activity className="w-3.5 h-3.5" />
          MLflow
          <ExternalLink className="w-3 h-3" />
        </a>
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

      {/* ── Gate review panel ── */}
      {currentGate && (
        <GateReviewPanel
          caseId={caseId}
          gateName={currentGate}
          onAdvanced={retry}
        />
      )}

      {/* ── Agent grid ── */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {PIPELINE_AGENT_ORDER.map((agentId) => {
          const agentStatus = pipelineStatus?.agents?.find((a) => a.agent_id === agentId);
          const agentEvents = events[agentId] || [];
          // Agent can be re-run when case is paused at this agent's gate
          const agentCanRun = currentGate != null && AGENT_GATE[agentId] === currentGate;
          return (
            <AgentCard
              key={agentId}
              agentId={agentId}
              agentStatus={agentStatus}
              events={agentEvents}
              canRun={agentCanRun}
              isActionPending={!!pendingAgents[agentId]}
              onRun={() => handleRunAgent(agentId)}
            />
          );
        })}
      </div>

      {/* ── Layer legend ── */}
      <div className="flex items-center gap-4 px-1">
        <span className="text-xs text-gray-600">Layers:</span>
        {Object.entries(LAYER_COLORS).map(([layer, colors]) => (
          <div key={layer} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
            <span className="text-xs text-gray-500">{layer}</span>
          </div>
        ))}
        <span className="ml-auto text-xs text-gray-600">
          All agent streams are live via SSE · MLflow tracks every run
        </span>
      </div>
    </div>
  );
}
