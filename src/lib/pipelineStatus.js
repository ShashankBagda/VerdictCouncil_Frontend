export const PIPELINE_AGENT_ORDER = [
  'case-processing',
  'fact-reconstruction',
  'evidence-analysis',
  'witness-analysis',
  'legal-knowledge',
  'argument-construction',
  'complexity-routing',
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

export const isDemoCaseId = (caseId) => typeof caseId === 'string' && caseId.startsWith('demo-');

export function getPipelinePollingInterval() {
  const raw = import.meta.env.VITE_PIPELINE_STATUS_POLL_MS;
  const parsed = Number.parseInt(raw || '3000', 10);
  return Number.isFinite(parsed) && parsed >= 1000 ? parsed : 3000;
}

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

function deriveOverallStatus(agents) {
  if (!agents.length) return 'pending';
  if (agents.some((agent) => agent.status === 'failed')) return 'failed';
  if (agents.every((agent) => agent.status === 'completed')) return 'completed';
  if (agents.some((agent) => agent.status === 'running')) return 'processing';
  return 'pending';
}

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
      const aIndex = AGENT_ORDER_INDEX[a.agent_id] ?? Number.MAX_SAFE_INTEGER;
      const bIndex = AGENT_ORDER_INDEX[b.agent_id] ?? Number.MAX_SAFE_INTEGER;
      return aIndex - bIndex;
    });

  const progress =
    typeof root.overall_progress_percent === 'number'
      ? root.overall_progress_percent
      : agents.length
        ? Math.round(
            (agents.filter((agent) => agent.status === 'completed').length / agents.length) * 100,
          )
        : 0;

  return {
    agents,
    overall_progress_percent: progress,
    overall_status: root.overall_status || deriveOverallStatus(agents),
  };
}

export function buildDemoPipelineStatus(caseId) {
  const agents = PIPELINE_AGENT_ORDER.map((agentId, index) => {
    const isCurrent = index === 2;
    const isDone = index < 2;
    return {
      agent_id: agentId,
      name: PIPELINE_AGENT_LABELS[agentId],
      status: isCurrent ? 'running' : isDone ? 'completed' : 'pending',
      start_time: isDone || isCurrent ? new Date(Date.now() - (index + 1) * 90_000).toISOString() : null,
      end_time: isDone ? new Date(Date.now() - index * 45_000).toISOString() : null,
      elapsed_seconds: isDone ? 45 : isCurrent ? 18 : null,
      error_message: null,
      output_summary: `${PIPELINE_AGENT_LABELS[agentId]} demo output for ${caseId}`,
    };
  });

  return {
    agents,
    overall_progress_percent: 22,
    overall_status: 'processing',
  };
}

export function isTerminalPipelineStatus(status) {
  if (!status?.agents?.length) return false;
  return status.agents.every((agent) =>
    agent.status === 'completed' || agent.status === 'failed',
  );
}
