import { describe, expect, it } from 'vitest';
import {
  buildDemoPipelineStatus,
  isDemoCaseId,
  isTerminalPipelineStatus,
  normalizePipelineStatus,
} from '../lib/pipelineStatus';

describe('pipelineStatus helpers', () => {
  it('normalizes backend status payloads to the shared frontend shape', () => {
    const result = normalizePipelineStatus({
      data: {
        agents: [
          { agent_id: 'deliberation', status: 'in_progress' },
          { agent_id: 'case-processing', status: 'completed' },
        ],
      },
    });

    expect(result.agents.map((agent) => agent.agent_id)).toEqual([
      'case-processing',
      'deliberation',
    ]);
    expect(result.agents[1].status).toBe('running');
    expect(result.overall_status).toBe('processing');
  });

  it('detects terminal pipeline status', () => {
    expect(
      isTerminalPipelineStatus({
        agents: [
          { agent_id: 'case-processing', status: 'completed' },
          { agent_id: 'deliberation', status: 'failed' },
        ],
      }),
    ).toBe(true);
  });

  it('creates a demo pipeline payload for demo case ids', () => {
    const caseId = 'demo-refund-delay';
    expect(isDemoCaseId(caseId)).toBe(true);

    const result = buildDemoPipelineStatus(caseId);
    expect(result.agents).toHaveLength(9);
    expect(result.overall_status).toBe('processing');
  });
});
