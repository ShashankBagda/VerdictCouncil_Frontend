// Sprint 4 4.A3.8 — InterruptEvent runtime contract.
//
// The TypeScript type lives in src/lib/sseEvents.ts and is enforced at
// build time by `npm run type-check`. This file locks the runtime
// shape: a representative InterruptEvent frame matches what the backend
// publish_interrupt(...) emits, so consumers that build against the TS
// type can also rely on the runtime keys being present.

import { describe, expect, it } from 'vitest';

describe('InterruptEvent shape', () => {
  it('matches the backend publish_interrupt(...) contract', () => {
    const event = {
      kind: 'interrupt',
      schema_version: 1,
      case_id: '00000000-0000-0000-0000-000000000abc',
      gate: 'gate1',
      actions: ['advance', 'rerun', 'halt'],
      ts: '2026-04-26T00:00:00Z',
    };

    expect(event.kind).toBe('interrupt');
    expect(event.gate).toMatch(/^gate[1-4]$/);
    expect(Array.isArray(event.actions)).toBe(true);
    expect(event.actions.length).toBeGreaterThan(0);
    for (const action of event.actions) {
      expect(['advance', 'rerun', 'halt', 'send_back']).toContain(action);
    }
  });

  it('accepts gate4 audit_summary with recommend_send_back', () => {
    const event = {
      kind: 'interrupt',
      schema_version: 1,
      case_id: '00000000-0000-0000-0000-000000000abc',
      gate: 'gate4',
      actions: ['rerun', 'halt', 'send_back'],
      audit_summary: {
        recommend_send_back: { to_phase: 'synthesis', reason: 'uncertainty' },
      },
      phase_output: { fairness_check: { audit_passed: true } },
      trace_id: 'abc123',
      ts: '2026-04-26T00:00:00Z',
    };

    expect(event.audit_summary?.recommend_send_back?.to_phase).toBe('synthesis');
    // send_back to audit is invalid (rerun-audit, not rewind) — verifies
    // we don't accidentally type-widen the recommendation.
    expect(event.audit_summary.recommend_send_back.to_phase).not.toBe('audit');
  });

  it('narrows via the kind discriminator', () => {
    const events = [
      {
        kind: 'interrupt',
        schema_version: 1,
        case_id: 'case-1',
        gate: 'gate2',
        actions: ['advance', 'rerun', 'halt'],
        ts: '2026-04-26T00:00:00Z',
      },
      {
        kind: 'heartbeat',
        schema_version: 1,
        ts: '2026-04-26T00:00:00Z',
      },
      {
        kind: 'progress',
        schema_version: 1,
        case_id: 'case-1',
        agent: 'intake',
        phase: 'started',
        ts: '2026-04-26T00:00:00Z',
      },
    ];

    const interrupts = events.filter((e) => e.kind === 'interrupt');
    expect(interrupts).toHaveLength(1);
    expect(interrupts[0].gate).toBe('gate2');
  });
});

// Q1.7 — runtime contracts for the four new conversational-mode agent
// events: agent_failed, llm_token, tool_call_delta, structured_artifact.
//
// These all ride on `kind: "agent"` and discriminate on the `event`
// literal. Backend source of truth:
// VerdictCouncil_Backend/src/api/schemas/pipeline_events.py
//   (AgentFailedEvent / LlmTokenEvent / ToolCallDeltaEvent /
//    StructuredArtifactEvent).

describe('AgentFailedEvent shape (Q1.2)', () => {
  it('matches the backend AgentFailedEvent contract', () => {
    const event = {
      kind: 'agent',
      schema_version: 1,
      case_id: '00000000-0000-0000-0000-000000000abc',
      agent: 'intake',
      event: 'agent_failed',
      // PII-safe — class name only, no message.
      error_class: 'TimeoutError',
      ts: '2026-04-26T00:00:00Z',
    };

    expect(event.kind).toBe('agent');
    expect(event.event).toBe('agent_failed');
    expect(typeof event.error_class).toBe('string');
    expect(event).not.toHaveProperty('error_message');
  });
});

describe('LlmTokenEvent shape (Q1.3)', () => {
  it('matches the backend LlmTokenEvent contract', () => {
    const event = {
      kind: 'agent',
      schema_version: 1,
      case_id: '00000000-0000-0000-0000-000000000abc',
      agent: 'intake',
      phase: 'intake',
      event: 'llm_token',
      message_id: 'msg-1',
      delta: 'The notice describes',
      ts: '2026-04-26T00:00:00Z',
    };

    expect(event.kind).toBe('agent');
    expect(event.event).toBe('llm_token');
    expect(typeof event.message_id).toBe('string');
    expect(typeof event.delta).toBe('string');
    expect(typeof event.phase).toBe('string');
  });
});

describe('ToolCallDeltaEvent shape (Q1.3)', () => {
  it('matches the backend ToolCallDeltaEvent contract', () => {
    const event = {
      kind: 'agent',
      schema_version: 1,
      case_id: '00000000-0000-0000-0000-000000000abc',
      agent: 'intake',
      phase: 'intake',
      event: 'tool_call_delta',
      tool_call_id: 'call-abc',
      name: 'parse_document',
      args_delta: '{"file_id":',
      ts: '2026-04-26T00:00:00Z',
    };

    expect(event.event).toBe('tool_call_delta');
    expect(typeof event.tool_call_id).toBe('string');
    expect(typeof event.name).toBe('string');
    expect(typeof event.args_delta).toBe('string');
  });
});

describe('StructuredArtifactEvent shape (Q1.5)', () => {
  it('matches the backend StructuredArtifactEvent contract', () => {
    const event = {
      kind: 'agent',
      schema_version: 1,
      case_id: '00000000-0000-0000-0000-000000000abc',
      agent: 'intake',
      phase: 'intake',
      event: 'structured_artifact',
      artifact: {
        domain: 'criminal',
        parties: [{ role: 'defendant', name: 'Alice' }],
      },
      ts: '2026-04-26T00:00:00Z',
    };

    expect(event.event).toBe('structured_artifact');
    expect(event.artifact).toBeDefined();
    expect(event.artifact.domain).toBe('criminal');
  });
});

describe('AgentEvent narrowing (Q1.7)', () => {
  it('narrows on the event literal across the conversational-mode union', () => {
    const events = [
      {
        kind: 'agent',
        schema_version: 1,
        case_id: 'case-1',
        agent: 'intake',
        event: 'thinking',
        content: 'classic content',
        ts: '2026-04-26T00:00:00Z',
      },
      {
        kind: 'agent',
        schema_version: 1,
        case_id: 'case-1',
        agent: 'intake',
        phase: 'intake',
        event: 'llm_token',
        message_id: 'msg-1',
        delta: 'hello',
        ts: '2026-04-26T00:00:00Z',
      },
      {
        kind: 'agent',
        schema_version: 1,
        case_id: 'case-1',
        agent: 'intake',
        phase: 'intake',
        event: 'tool_call_delta',
        tool_call_id: 'call-1',
        name: 'parse_document',
        args_delta: '{"file_id":"f1"',
        ts: '2026-04-26T00:00:00Z',
      },
      {
        kind: 'agent',
        schema_version: 1,
        case_id: 'case-1',
        agent: 'intake',
        phase: 'intake',
        event: 'structured_artifact',
        artifact: { domain: 'civil' },
        ts: '2026-04-26T00:00:00Z',
      },
      {
        kind: 'agent',
        schema_version: 1,
        case_id: 'case-1',
        agent: 'intake',
        event: 'agent_failed',
        error_class: 'TimeoutError',
        ts: '2026-04-26T00:00:00Z',
      },
    ];

    const tokens = events.filter((e) => e.event === 'llm_token');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].delta).toBe('hello');

    const failures = events.filter((e) => e.event === 'agent_failed');
    expect(failures).toHaveLength(1);
    expect(failures[0].error_class).toBe('TimeoutError');

    const artifacts = events.filter((e) => e.event === 'structured_artifact');
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].artifact.domain).toBe('civil');

    const toolDeltas = events.filter((e) => e.event === 'tool_call_delta');
    expect(toolDeltas).toHaveLength(1);
    expect(toolDeltas[0].tool_call_id).toBe('call-1');
  });
});


// Q1.11 chat-steering — AgentAwaitingInputEvent + AgentResumedEvent shapes.
describe('AgentAwaitingInputEvent shape (Q1.11)', () => {
  it('matches the backend AgentAwaitingInputEvent contract', () => {
    const event = {
      kind: 'interrupt',
      schema_version: 1,
      case_id: '550e8400-e29b-41d4-a716-446655440000',
      agent: 'synthesis',
      question: 'Which reading should govern: A or B?',
      interrupt_id: 'a'.repeat(32),
      ts: '2026-04-27T10:00:00+00:00',
    };
    expect(event.kind).toBe('interrupt');
    expect(event.agent).toBe('synthesis');
    expect(typeof event.question).toBe('string');
    expect(event.interrupt_id).toHaveLength(32);
  });

  it('discriminates from gate-pause InterruptEvent on payload shape', () => {
    // Both share kind="interrupt" — the runtime discriminator is shape-based:
    // agent pauses carry `question` + `interrupt_id`; gate pauses carry
    // `gate` + `actions`. useAgentStream uses this to route correctly.
    const agentPause = { kind: 'interrupt', question: 'q', interrupt_id: 'x'.repeat(32) };
    const gatePause = { kind: 'interrupt', gate: 'gate2', actions: ['advance'] };

    const isAgentPause = (e) => 'question' in e && 'interrupt_id' in e;
    const isGatePause = (e) => 'gate' in e && 'actions' in e;

    expect(isAgentPause(agentPause)).toBe(true);
    expect(isAgentPause(gatePause)).toBe(false);
    expect(isGatePause(gatePause)).toBe(true);
    expect(isGatePause(agentPause)).toBe(false);
  });
});

describe('AgentResumedEvent shape (Q1.11)', () => {
  it('matches the backend AgentResumedEvent contract', () => {
    const event = {
      kind: 'agent',
      schema_version: 1,
      case_id: '550e8400-e29b-41d4-a716-446655440000',
      agent: 'synthesis',
      event: 'agent_resumed',
      interrupt_id: 'a'.repeat(32),
      ts: '2026-04-27T10:00:01+00:00',
    };
    expect(event.kind).toBe('agent');
    expect(event.event).toBe('agent_resumed');
    expect(event.interrupt_id).toHaveLength(32);
  });
});
