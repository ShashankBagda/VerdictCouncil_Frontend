import { describe, expect, it } from 'vitest';
import {
  buildDemoPipelineStatus,
  getBackoffDelay,
  getPipelinePollingInterval,
  isDemoCaseId,
  isTerminalOverallStatus,
  isTerminalPipelineStatus,
  MAX_POLL_ERRORS,
  normalizePipelineStatus,
  PIPELINE_AGENT_ORDER,
} from '../lib/pipelineStatus';

describe('pipelineStatus helpers', () => {
  // ── normalizePipelineStatus ─────────────────────────────────────────────

  it('normalizes backend status payloads to the shared frontend shape', () => {
    const result = normalizePipelineStatus({
      data: {
        agents: [
          { agent_id: 'deliberation', status: 'in_progress' },
          { agent_id: 'case-processing', status: 'completed' },
        ],
      },
    });

    expect(result.agents.map((a) => a.agent_id)).toEqual([
      'case-processing',
      'deliberation',
    ]);
    expect(result.agents[1].status).toBe('running');
    expect(result.overall_status).toBe('processing');
    expect(result.updated_at).toBeTruthy();
  });

  it('normalizes alternative backend field names', () => {
    const result = normalizePipelineStatus({
      agent_states: [
        { id: 'case-processing', state: 'done', started_at: '2025-01-01T00:00:00Z', finished_at: '2025-01-01T00:01:00Z', duration_seconds: 60 },
      ],
    });

    expect(result.agents).toHaveLength(1);
    expect(result.agents[0].status).toBe('completed');
    expect(result.agents[0].start_time).toBe('2025-01-01T00:00:00Z');
    expect(result.agents[0].end_time).toBe('2025-01-01T00:01:00Z');
    expect(result.agents[0].elapsed_seconds).toBe(60);
  });

  it('handles empty / missing agent arrays gracefully', () => {
    expect(normalizePipelineStatus(null).agents).toEqual([]);
    expect(normalizePipelineStatus({}).agents).toEqual([]);
    expect(normalizePipelineStatus({ data: {} }).agents).toEqual([]);
    expect(normalizePipelineStatus({ data: {} }).overall_status).toBe('pending');
    expect(normalizePipelineStatus({ data: {} }).overall_progress_percent).toBe(0);
  });

  it('filters out agents without an id', () => {
    const result = normalizePipelineStatus({
      agents: [
        { agent_id: 'case-processing', status: 'completed' },
        { status: 'running' }, // no id
      ],
    });
    expect(result.agents).toHaveLength(1);
  });

  it('uses backend overall_progress_percent when provided', () => {
    const result = normalizePipelineStatus({
      agents: [{ agent_id: 'case-processing', status: 'completed' }],
      overall_progress_percent: 42,
    });
    expect(result.overall_progress_percent).toBe(42);
  });

  it('computes progress from agent completion when not provided', () => {
    const result = normalizePipelineStatus({
      agents: [
        { agent_id: 'case-processing', status: 'completed' },
        { agent_id: 'deliberation', status: 'running' },
      ],
    });
    expect(result.overall_progress_percent).toBe(50);
  });

  // ── isTerminalPipelineStatus ────────────────────────────────────────────

  it('detects terminal pipeline status (all completed)', () => {
    expect(
      isTerminalPipelineStatus({
        agents: [
          { agent_id: 'case-processing', status: 'completed' },
          { agent_id: 'deliberation', status: 'completed' },
        ],
      }),
    ).toBe(true);
  });

  it('detects terminal pipeline status (mix of completed and failed)', () => {
    expect(
      isTerminalPipelineStatus({
        agents: [
          { agent_id: 'case-processing', status: 'completed' },
          { agent_id: 'deliberation', status: 'failed' },
        ],
      }),
    ).toBe(true);
  });

  it('returns false when agents are still running', () => {
    expect(
      isTerminalPipelineStatus({
        agents: [
          { agent_id: 'case-processing', status: 'completed' },
          { agent_id: 'deliberation', status: 'running' },
        ],
      }),
    ).toBe(false);
  });

  it('returns false for empty agents', () => {
    expect(isTerminalPipelineStatus({ agents: [] })).toBe(false);
    expect(isTerminalPipelineStatus(null)).toBe(false);
  });

  // ── isTerminalOverallStatus ─────────────────────────────────────────────

  it('detects terminal overall status strings', () => {
    expect(isTerminalOverallStatus('completed')).toBe(true);
    expect(isTerminalOverallStatus('failed')).toBe(true);
    expect(isTerminalOverallStatus('processing')).toBe(false);
    expect(isTerminalOverallStatus('pending')).toBe(false);
    expect(isTerminalOverallStatus(undefined)).toBe(false);
  });

  // ── isDemoCaseId ────────────────────────────────────────────────────────

  it('identifies demo case IDs', () => {
    expect(isDemoCaseId('demo-refund-delay')).toBe(true);
    expect(isDemoCaseId('demo-')).toBe(true);
    expect(isDemoCaseId('real-case-123')).toBe(false);
    expect(isDemoCaseId(null)).toBe(false);
    expect(isDemoCaseId(123)).toBe(false);
  });

  // ── buildDemoPipelineStatus ─────────────────────────────────────────────

  it('creates a demo pipeline payload for demo case ids', () => {
    const caseId = 'demo-refund-delay';
    const result = buildDemoPipelineStatus(caseId);

    expect(result.agents).toHaveLength(9);
    expect(result.overall_status).toBe('processing');
    expect(result.updated_at).toBeTruthy();

    // First two agents should be completed, third running, rest pending
    expect(result.agents[0].status).toBe('completed');
    expect(result.agents[1].status).toBe('completed');
    expect(result.agents[2].status).toBe('running');
    expect(result.agents[3].status).toBe('pending');
  });

  // ── Backoff / polling config ────────────────────────────────────────────

  it('returns base interval with zero errors', () => {
    const base = 3000;
    expect(getBackoffDelay(base, 0)).toBe(3000);
  });

  it('doubles delay per error count', () => {
    const base = 3000;
    expect(getBackoffDelay(base, 1)).toBe(6000);
    expect(getBackoffDelay(base, 2)).toBe(12000);
    expect(getBackoffDelay(base, 3)).toBe(24000);
  });

  it('caps backoff at 30 seconds', () => {
    const base = 3000;
    expect(getBackoffDelay(base, 10)).toBe(30000);
    expect(getBackoffDelay(base, 20)).toBe(30000);
  });

  it('exports MAX_POLL_ERRORS as a positive number', () => {
    expect(MAX_POLL_ERRORS).toBeGreaterThan(0);
  });

  it('getPipelinePollingInterval returns a sane default', () => {
    const interval = getPipelinePollingInterval();
    expect(interval).toBeGreaterThanOrEqual(1000);
  });

  // ── Agent order ─────────────────────────────────────────────────────────

  it('defines exactly 9 agents in the pipeline order', () => {
    expect(PIPELINE_AGENT_ORDER).toHaveLength(9);
    expect(PIPELINE_AGENT_ORDER).toEqual([
      'case-processing',
      'complexity-routing',
      'evidence-analysis',
      'fact-reconstruction',
      'witness-analysis',
      'legal-knowledge',
      'argument-construction',
      'deliberation',
      'governance-verdict',
    ]);
  });
});
