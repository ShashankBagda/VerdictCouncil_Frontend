/**
 * Pipeline status normalization, polling configuration, and demo helpers.
 *
 * This module is the single source of truth for:
 * - agent ordering and labels
 * - backend → frontend status shape normalization
 * - polling interval / backoff / retry configuration
 * - terminal-state detection (stop conditions)
 * - demo pipeline payloads
 */

// ── Agent topology ──────────────────────────────────────────────────────────

export const PIPELINE_AGENT_ORDER = [
  'case-processing',
  'complexity-routing',
  'evidence-analysis',
  'fact-reconstruction',
  'witness-analysis',
  'legal-knowledge',
  'argument-construction',
  'deliberation',
  'governance-verdict',
];

export const PIPELINE_AGENT_LABELS = {
  'case-processing': 'Case Processing',
  'fact-reconstruction': 'Fact Reconstruction',
  'evidence-analysis': 'Evidence Analysis',
  'witness-analysis': 'Witness Analysis',
  'legal-knowledge': 'Legal Knowledge',
  'argument-construction': 'Argument Construction',
  'complexity-routing': 'Complexity Routing',
  'deliberation': 'Deliberation',
  'governance-verdict': 'Governance & Verdict',
};

const AGENT_ORDER_INDEX = PIPELINE_AGENT_ORDER.reduce((acc, agentId, index) => {
  acc[agentId] = index;
  return acc;
}, {});

// ── Demo helpers ────────────────────────────────────────────────────────────

export const isDemoCaseId = (caseId) =>
  typeof caseId === 'string' && caseId.startsWith('demo-');

// ── Polling / backoff configuration ─────────────────────────────────────────

/** Base polling interval (ms). Configurable via env. */
export function getPipelinePollingInterval() {
  const raw = import.meta.env.VITE_PIPELINE_STATUS_POLL_MS;
  const parsed = Number.parseInt(raw || '3000', 10);
  return Number.isFinite(parsed) && parsed >= 1000 ? parsed : 3000;
}

/** Maximum polling interval after repeated errors (ms). */
const MAX_BACKOFF_MS = 30_000;

/** Maximum consecutive errors before the hook gives up polling. */
export const MAX_POLL_ERRORS = 10;

/** How long (ms) before we consider the last-fetched data "stale". */
export const STALE_THRESHOLD_MS = 15_000;

/**
 * Compute the next polling delay using exponential backoff.
 *
 * @param {number} baseMs       – base interval from getPipelinePollingInterval()
 * @param {number} errorCount   – consecutive error count (0 = no errors)
 * @returns {number} delay in ms, capped at MAX_BACKOFF_MS
 */
export function getBackoffDelay(baseMs, errorCount) {
  if (errorCount <= 0) return baseMs;
  // 2^errorCount * base, capped
  const delay = Math.min(baseMs * 2 ** errorCount, MAX_BACKOFF_MS);
  return delay;
}

// ── Status normalization ────────────────────────────────────────────────────

/** Map any backend agent status string to one of our four canonical values. */
function normalizeAgentStatus(status) {
  switch (status) {
    case 'running':
    case 'in_progress':
    case 'processing':
      return 'running';
    case 'completed':
    case 'done':
    case 'success':
      return 'completed';
    case 'failed':
    case 'error':
      return 'failed';
    default:
      return 'pending';
  }
}

/** Derive the overall pipeline status from the agent list. */
function deriveOverallStatus(agents) {
  if (!agents.length) return 'pending';
  if (agents.some((a) => a.status === 'failed')) return 'failed';
  if (agents.every((a) => a.status === 'completed')) return 'completed';
  if (agents.some((a) => a.status === 'running')) return 'processing';
  return 'pending';
}

/**
 * Normalize any backend pipeline-status payload into the canonical frontend shape:
 *
 * ```
 * {
 *   agents: [{ agent_id, name, status, start_time, end_time, elapsed_seconds, error_message, output_summary }],
 *   overall_progress_percent: number,
 *   overall_status: 'pending' | 'processing' | 'completed' | 'failed',
 *   updated_at: string | null,
 * }
 * ```
 */
export function normalizePipelineStatus(payload) {
  const root = payload?.data || payload || {};
  const rawAgents = root.agents || root.agent_states || root.pipeline || [];

  const agents = rawAgents
    .map((agent) => {
      const agentId = agent.agent_id || agent.id || agent.key;
      if (!agentId) return null;

      return {
        agent_id: agentId,
        name: agent.name || PIPELINE_AGENT_LABELS[agentId] || agentId,
        status: normalizeAgentStatus(agent.status || agent.state),
        start_time: agent.start_time || agent.started_at || null,
        end_time: agent.end_time || agent.finished_at || null,
        elapsed_seconds: agent.elapsed_seconds || agent.duration_seconds || null,
        error_message: agent.error_message || agent.error || null,
        output_summary: agent.output_summary || agent.summary || null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const aIdx = AGENT_ORDER_INDEX[a.agent_id] ?? Number.MAX_SAFE_INTEGER;
      const bIdx = AGENT_ORDER_INDEX[b.agent_id] ?? Number.MAX_SAFE_INTEGER;
      return aIdx - bIdx;
    });

  const progress =
    typeof root.overall_progress_percent === 'number'
      ? root.overall_progress_percent
      : agents.length
        ? Math.round(
            (agents.filter((a) => a.status === 'completed').length / agents.length) * 100,
          )
        : 0;

  return {
    agents,
    overall_progress_percent: progress,
    overall_status: root.overall_status || deriveOverallStatus(agents),
    updated_at: root.updated_at || new Date().toISOString(),
  };
}

// ── Terminal detection (stop conditions) ────────────────────────────────────

/**
 * Returns `true` when every agent has reached a terminal state
 * (completed or failed) — meaning polling should stop.
 */
export function isTerminalPipelineStatus(status) {
  if (!status?.agents?.length) return false;
  return status.agents.every(
    (agent) => agent.status === 'completed' || agent.status === 'failed',
  );
}

/**
 * Returns `true` when the overall pipeline status string itself
 * indicates a terminal state (e.g. backend sends "completed" or "failed"
 * at the top level before all agents report individually).
 */
export function isTerminalOverallStatus(overallStatus) {
  return overallStatus === 'completed' || overallStatus === 'failed';
}

// ── Demo pipeline builder ───────────────────────────────────────────────────

export function buildDemoPipelineStatus(caseId) {
  const agents = PIPELINE_AGENT_ORDER.map((agentId, index) => {
    const isCurrent = index === 2;
    const isDone = index < 2;
    return {
      agent_id: agentId,
      name: PIPELINE_AGENT_LABELS[agentId],
      status: isCurrent ? 'running' : isDone ? 'completed' : 'pending',
      start_time:
        isDone || isCurrent
          ? new Date(Date.now() - (index + 1) * 90_000).toISOString()
          : null,
      end_time: isDone
        ? new Date(Date.now() - index * 45_000).toISOString()
        : null,
      elapsed_seconds: isDone ? 45 : isCurrent ? 18 : null,
      error_message: null,
      output_summary: `${PIPELINE_AGENT_LABELS[agentId]} demo output for ${caseId}`,
    };
  });

  return {
    agents,
    overall_progress_percent: 22,
    overall_status: 'processing',
    updated_at: new Date().toISOString(),
  };
}
