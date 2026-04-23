/**
 * OrchestratorPanel
 *
 * Displays the orchestration metadata stored in `case_metadata.orchestration`
 * by the OrchestratorRunner / pipeline-orchestrator agent.
 *
 * Shows:
 *  - Pipeline lifecycle banner (disposition, duration)
 *  - Gate completion timeline
 *  - Per-agent run log with status / retry count
 *  - Retry log (corrective instructions history)
 *  - Escalation record (if any)
 *  - What-if scenario forks (if any)
 *  - Parallel dispatch results for gate2
 */
import { useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  FlaskConical,
  GitBranch,
  Info,
  Layers,
  RefreshCw,
  Shield,
  XCircle,
  Zap,
} from 'lucide-react';

// ── helpers ─────────────────────────────────────────────────────────────────

function fmtDuration(seconds) {
  if (seconds == null) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function fmtTs(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-SG', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

const GATE_LABELS = {
  gate1: 'Gate 1 — Intake',
  gate2: 'Gate 2 — Evidence & Law (parallel)',
  gate3: 'Gate 3 — Arguments & Hearing',
  gate4: 'Gate 4 — Governance Audit',
};

const DISPOSITION_CONFIG = {
  ready_for_review: {
    icon: CheckCircle2,
    label: 'Ready for Review',
    cls: 'bg-emerald-50 border-emerald-300 text-emerald-800',
    iconCls: 'text-emerald-600',
  },
  escalated: {
    icon: AlertTriangle,
    label: 'Escalated',
    cls: 'bg-amber-50 border-amber-300 text-amber-800',
    iconCls: 'text-amber-600',
  },
  failed: {
    icon: XCircle,
    label: 'Failed',
    cls: 'bg-rose-50 border-rose-300 text-rose-800',
    iconCls: 'text-rose-600',
  },
  in_progress: {
    icon: Zap,
    label: 'In Progress',
    cls: 'bg-blue-50 border-blue-300 text-blue-800',
    iconCls: 'text-blue-600',
  },
};

function gateStatusIcon(status) {
  if (status === 'complete') return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  if (status === 'running') return <Zap className="w-4 h-4 text-blue-500 animate-pulse" />;
  if (status === 'failed') return <XCircle className="w-4 h-4 text-rose-500" />;
  return <Clock className="w-4 h-4 text-gray-400" />;
}

function agentStatusPill(status) {
  const base = 'inline-block px-2 py-0.5 rounded-full text-xs font-semibold';
  if (status === 'success') return `${base} bg-emerald-100 text-emerald-700`;
  if (status === 'failed_max_retries') return `${base} bg-rose-100 text-rose-700`;
  if (status === 'critical_failure') return `${base} bg-rose-200 text-rose-900`;
  if (status === 'failed') return `${base} bg-rose-100 text-rose-700`;
  return `${base} bg-gray-100 text-gray-600`;
}

// ── sub-panels ───────────────────────────────────────────────────────────────

function DispositionBanner({ orch }) {
  const disposition = orch?.final_disposition || 'in_progress';
  const cfg = DISPOSITION_CONFIG[disposition] || DISPOSITION_CONFIG.in_progress;
  const Icon = cfg.icon;
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-5 py-4 ${cfg.cls}`}>
      <Icon className={`w-6 h-6 flex-shrink-0 ${cfg.iconCls}`} />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-base">{cfg.label}</p>
        <p className="text-sm mt-0.5 opacity-80">
          Pipeline v{orch?.pipeline_version || '—'} ·{' '}
          {orch?.pipeline_start_time ? `Started ${fmtTs(orch.pipeline_start_time)}` : 'Not started'}
          {orch?.total_duration_seconds != null && (
            <> · Duration <strong>{fmtDuration(orch.total_duration_seconds)}</strong></>
          )}
        </p>
      </div>
      <div className="text-right text-xs opacity-70 flex-shrink-0">
        {orch?.gates_completed?.length ?? 0} / 4 gates
      </div>
    </div>
  );
}

function GateTimeline({ orch }) {
  const gateStatuses = orch?.gate_statuses || {};
  const parallelResults = orch?.parallel_dispatch_results || {};

  return (
    <div className="card-lg">
      <h3 className="text-base font-bold text-navy-900 mb-4 flex items-center gap-2">
        <Layers className="w-4 h-4 text-teal-600" />
        Gate Pipeline
      </h3>
      <div className="space-y-3">
        {['gate1', 'gate2', 'gate3', 'gate4'].map((gate, idx) => {
          const status = gateStatuses[gate] || 'pending';
          const parallel = parallelResults[gate];
          return (
            <div key={gate} className="flex items-start gap-3">
              {/* Connector line */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div className="mt-0.5">{gateStatusIcon(status)}</div>
                {idx < 3 && <div className="w-px h-6 bg-gray-200 mt-1" />}
              </div>
              <div className="flex-1 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-navy-900">
                    {GATE_LABELS[gate]}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize
                    ${status === 'complete' ? 'bg-emerald-100 text-emerald-700'
                    : status === 'running' ? 'bg-blue-100 text-blue-700'
                    : status === 'failed' ? 'bg-rose-100 text-rose-700'
                    : 'bg-gray-100 text-gray-500'}`}
                  >
                    {status}
                  </span>
                  {parallel && (
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <GitBranch className="w-3 h-3" />
                      Parallel ·{' '}
                      {parallel.agent_failures === 0
                        ? 'all succeeded'
                        : `${parallel.agent_failures} failure(s)`}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgentRunLog({ orch }) {
  const agentsRun = orch?.agents_run || [];
  if (agentsRun.length === 0) {
    return (
      <div className="card-lg">
        <h3 className="text-base font-bold text-navy-900 mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-teal-600" />
          Agent Run Log
        </h3>
        <p className="text-sm text-gray-500">No agents have run yet.</p>
      </div>
    );
  }

  return (
    <div className="card-lg">
      <h3 className="text-base font-bold text-navy-900 mb-4 flex items-center gap-2">
        <Zap className="w-4 h-4 text-teal-600" />
        Agent Run Log
        <span className="ml-auto text-xs text-gray-500 font-normal">
          {agentsRun.length} agent{agentsRun.length !== 1 ? 's' : ''} ran
        </span>
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <th className="pb-2 pr-3 font-semibold">#</th>
              <th className="pb-2 pr-3 font-semibold">Agent</th>
              <th className="pb-2 pr-3 font-semibold">Status</th>
              <th className="pb-2 pr-3 font-semibold">Retries</th>
              <th className="pb-2 font-semibold">Completed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {agentsRun.map((entry, idx) => (
              <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                <td className="py-2 pr-3 text-gray-400 font-mono text-xs">{idx + 1}</td>
                <td className="py-2 pr-3 font-medium text-navy-900 whitespace-nowrap">
                  {entry.agent_name}
                </td>
                <td className="py-2 pr-3">
                  <span className={agentStatusPill(entry.status)}>{entry.status}</span>
                </td>
                <td className="py-2 pr-3 text-center">
                  {entry.retries > 0 ? (
                    <span className="text-amber-600 font-semibold">{entry.retries}</span>
                  ) : (
                    <span className="text-gray-400">0</span>
                  )}
                </td>
                <td className="py-2 text-xs text-gray-500">
                  {fmtTs(entry.end_time)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RetryLog({ orch }) {
  const retryLog = orch?.retry_log || [];
  if (retryLog.length === 0) return null;

  return (
    <div className="card-lg">
      <h3 className="text-base font-bold text-navy-900 mb-4 flex items-center gap-2">
        <RefreshCw className="w-4 h-4 text-amber-600" />
        Retry Log
        <span className="ml-auto text-xs text-gray-500 font-normal">
          {retryLog.length} retr{retryLog.length !== 1 ? 'ies' : 'y'}
        </span>
      </h3>
      <div className="space-y-2">
        {retryLog.map((entry, idx) => (
          <div key={idx} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="font-semibold text-sm text-amber-900">
                {entry.agent_name}
                <span className="text-xs font-normal text-amber-600 ml-2">
                  attempt #{entry.attempt}
                </span>
              </span>
              <span className="text-xs text-amber-600">{fmtTs(entry.timestamp)}</span>
            </div>
            <p className="text-xs text-amber-800">{entry.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function EscalationRecord({ orch }) {
  const record = orch?.escalation_record;
  if (!record) return null;

  return (
    <div className="card-lg border-2 border-rose-300">
      <h3 className="text-base font-bold text-rose-900 mb-4 flex items-center gap-2">
        <Shield className="w-4 h-4 text-rose-600" />
        Escalation Record
      </h3>
      <dl className="space-y-2 text-sm">
        <div className="flex gap-3">
          <dt className="text-gray-500 w-32 flex-shrink-0">Source</dt>
          <dd className="font-semibold text-rose-900 capitalize">{record.source?.replace(/_/g, ' ')}</dd>
        </div>
        {record.trigger_id && (
          <div className="flex gap-3">
            <dt className="text-gray-500 w-32 flex-shrink-0">Trigger</dt>
            <dd className="font-mono text-xs text-rose-700">{record.trigger_id}</dd>
          </div>
        )}
        <div className="flex gap-3">
          <dt className="text-gray-500 w-32 flex-shrink-0">Reason</dt>
          <dd className="text-rose-900">{record.reason}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="text-gray-500 w-32 flex-shrink-0">Time</dt>
          <dd className="text-gray-700">{fmtTs(record.timestamp)}</dd>
        </div>
      </dl>
    </div>
  );
}

function WhatIfRuns({ orch }) {
  const runs = orch?.what_if_runs || [];
  if (runs.length === 0) return null;

  return (
    <div className="card-lg">
      <h3 className="text-base font-bold text-navy-900 mb-4 flex items-center gap-2">
        <FlaskConical className="w-4 h-4 text-violet-600" />
        What-If Scenarios
        <span className="ml-auto text-xs text-gray-500 font-normal">
          {runs.length} scenario{runs.length !== 1 ? 's' : ''}
        </span>
      </h3>
      <div className="space-y-3">
        {runs.map((run, idx) => (
          <div key={idx} className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="font-semibold text-sm text-violet-900 capitalize">
                {run.modification_type?.replace(/_/g, ' ') || `Scenario ${idx + 1}`}
              </span>
              <span className="text-xs text-violet-600">{fmtTs(run.started_at)}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500">Modified fields:</span>
              {(run.modifications || []).map((field) => (
                <span key={field} className="text-xs bg-violet-200 text-violet-800 px-2 py-0.5 rounded-full font-mono">
                  {field}
                </span>
              ))}
            </div>
            {run.scenario_id && (
              <p className="text-[10px] text-gray-400 mt-1.5 font-mono truncate">
                Scenario ID: {run.scenario_id}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyOrchestration() {
  return (
    <div className="card-lg flex flex-col items-center justify-center py-16 text-center">
      <Info className="w-10 h-10 text-gray-300 mb-3" />
      <p className="text-gray-500 font-medium">No orchestration data yet</p>
      <p className="text-sm text-gray-400 mt-1 max-w-sm">
        Orchestration metadata is populated by the Pipeline Orchestrator agent once the
        case has been processed by the OrchestratorRunner. Start the pipeline to see
        real-time gate and agent tracking here.
      </p>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * OrchestratorPanel
 *
 * @param {object} caseData  - The full case detail object from `GET /api/v1/cases/{id}`
 */
export default function OrchestratorPanel({ caseData }) {
  const orch = useMemo(
    () => caseData?.case_metadata?.orchestration || caseData?.orchestration || null,
    [caseData],
  );

  if (!orch) return <EmptyOrchestration />;

  return (
    <div className="space-y-4">
      <DispositionBanner orch={orch} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GateTimeline orch={orch} />
        <AgentRunLog orch={orch} />
      </div>

      <RetryLog orch={orch} />
      <EscalationRecord orch={orch} />
      <WhatIfRuns orch={orch} />

      {/* Raw JSON for power users */}
      <details className="card-lg">
        <summary className="text-sm font-semibold text-gray-600 cursor-pointer select-none flex items-center gap-2">
          <ChevronRight className="w-4 h-4 transition-transform details-arrow" />
          Raw orchestration metadata (JSON)
        </summary>
        <pre className="mt-3 p-3 bg-gray-900 text-gray-100 rounded-lg text-xs overflow-x-auto max-h-96">
          {JSON.stringify(orch, null, 2)}
        </pre>
      </details>
    </div>
  );
}
