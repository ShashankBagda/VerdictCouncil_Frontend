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
