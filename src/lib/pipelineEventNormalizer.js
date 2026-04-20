import { PIPELINE_AGENT_LABELS } from './pipelineStatus';

const STATUS_TO_PHASE = {
  running: 'working',
  in_progress: 'working',
  processing: 'working',
  completed: 'completed',
  done: 'completed',
  success: 'completed',
  failed: 'failed',
  error: 'failed',
  pending: 'waiting',
  blocked: 'waiting',
};

const EVENT_TO_PHASE = {
  agent_started: 'working',
  started: 'working',
  running: 'working',
  agent_completed: 'completed',
  completed: 'completed',
  done: 'completed',
  success: 'completed',
  agent_failed: 'failed',
  failed: 'failed',
  error: 'failed',
  waiting: 'waiting',
  blocked: 'waiting',
  handoff: 'handoff',
  agent_handoff: 'handoff',
};

const nowIso = () => new Date().toISOString();

function normalizePhase(raw) {
  if (!raw) return 'working';
  const key = String(raw).toLowerCase();
  return EVENT_TO_PHASE[key] || STATUS_TO_PHASE[key] || 'working';
}

function synthWorkSummary(agentId, phase) {
  const label = PIPELINE_AGENT_LABELS[agentId] || agentId;
  switch (phase) {
    case 'completed':
      return `${label} completed its current stage output.`;
    case 'failed':
      return `${label} encountered an execution error.`;
    case 'waiting':
      return `${label} is queued and waiting for dependencies.`;
    case 'handoff':
      return `${label} is handing off artifacts to the next stage.`;
    default:
      return `${label} is processing active tasks.`;
  }
}

function synthThoughtSummary(agentId, phase) {
  const label = PIPELINE_AGENT_LABELS[agentId] || agentId;
  switch (phase) {
    case 'completed':
      return `${label} believes the current objective is satisfied.`;
    case 'failed':
      return `${label} needs recovery steps before continuing.`;
    case 'waiting':
      return `${label} is monitoring upstream context before acting.`;
    case 'handoff':
      return `${label} is packaging rationale and evidence for downstream review.`;
    default:
      return `${label} is evaluating evidence and constraints for the next decision.`;
  }
}

function buildEvent(input, source, synthetic = false) {
  const agentId = input.agent || input.agent_id || input.id;
  if (!agentId) return null;

  const phase = normalizePhase(input.phase || input.event || input.status || input.state);
  const ts = input.ts || input.timestamp || input.updated_at || nowIso();
  const workSummary =
    input.work_summary || input.output_summary || input.summary || synthWorkSummary(agentId, phase);
  const thoughtSummary =
    input.thought_summary || input.reasoning_summary || synthThoughtSummary(agentId, phase);

  return {
    agentId,
    phase,
    ts,
    source,
    synthetic,
    workSummary,
    thoughtSummary,
    fromAgentId: input.handoff_from || input.from_agent || null,
    toAgentId: input.handoff_to || input.to_agent || null,
    error: input.error || input.error_message || null,
  };
}

function normalizeSnapshotEvents(root, source, previousStatusByAgent) {
  const nextStatusByAgent = { ...previousStatusByAgent };
  const events = [];
  const agents = Array.isArray(root.agents) ? root.agents : [];

  agents.forEach((agent) => {
    const agentId = agent.agent_id || agent.id || agent.key;
    if (!agentId) return;

    const normalizedStatus = normalizePhase(agent.status || agent.state || 'pending');
    const previousStatus = previousStatusByAgent[agentId];
    nextStatusByAgent[agentId] = normalizedStatus;

    // On initial snapshot, skip idle/pending to reduce noise.
    if (!previousStatus && normalizedStatus === 'waiting') {
      return;
    }

    if (previousStatus !== normalizedStatus) {
      const nextEvent = buildEvent(
        {
          agent: agentId,
          phase: normalizedStatus,
          ts: root.updated_at || nowIso(),
          output_summary: agent.output_summary,
          error: agent.error_message,
        },
        source,
        true,
      );

      if (nextEvent) events.push(nextEvent);
    }
  });

  return { events, nextStatusByAgent, unsupported: false };
}

/**
 * Normalizes SSE/polling payloads into renderable agent timeline events.
 * Supports atomic events, event_delta batches, and aggregate snapshot payloads.
 */
export function normalizePipelineEventPayload(payload, options = {}) {
  const { source = 'sse', previousStatusByAgent = {} } = options;
  const root = payload?.data || payload || {};

  if (Array.isArray(root.event_delta)) {
    const events = root.event_delta
      .map((item) => buildEvent(item, source, false))
      .filter(Boolean);
    return {
      events,
      nextStatusByAgent: { ...previousStatusByAgent },
      unsupported: false,
    };
  }

  if (Array.isArray(root.agents)) {
    return normalizeSnapshotEvents(root, source, previousStatusByAgent);
  }

  if (root.agent || root.agent_id) {
    const nextEvent = buildEvent(root, source, false);
    return {
      events: nextEvent ? [nextEvent] : [],
      nextStatusByAgent: { ...previousStatusByAgent },
      unsupported: false,
    };
  }

  return {
    events: [],
    nextStatusByAgent: { ...previousStatusByAgent },
    unsupported: true,
  };
}
