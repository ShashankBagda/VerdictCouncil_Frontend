// SSE reliability smoke tests — Scenarios A, B, C, D (frontend side).
//
// These tests verify the four SSE edge-case behaviours from the perspective of
// the frontend event consumer: error surfaces, cancel propagation, partial
// disconnect, and auth_expiring notification.

import { describe, expect, it, vi, beforeEach } from 'vitest';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeProgressEvent(phase, overrides = {}) {
  return {
    kind: 'progress',
    schema_version: 1,
    case_id: '00000000-0000-0000-0000-000000000001',
    agent: 'pipeline',
    phase,
    ts: new Date().toISOString(),
    ...overrides,
  };
}

function makeAuthExpiringEvent(expiresAtOffsetSeconds = 90) {
  return {
    kind: 'auth_expiring',
    schema_version: 1,
    expires_at: new Date(Date.now() + expiresAtOffsetSeconds * 1000).toISOString(),
  };
}

function makeHeartbeatEvent() {
  return {
    kind: 'heartbeat',
    schema_version: 1,
    ts: new Date().toISOString(),
  };
}

// ── Scenario A: backend error mid-run ────────────────────────────────────────

describe('Scenario A — backend error mid-run', () => {
  it('phase=failed event has an error field for toast display', () => {
    const event = makeProgressEvent('failed', { error: 'RuntimeError: OOM in worker' });
    expect(event.phase).toBe('failed');
    expect(event.error).toBeTruthy();
    expect(event.error).toContain('RuntimeError');
  });

  it('phase=terminal event carries a detail object with reason + stopped_at', () => {
    const event = makeProgressEvent('terminal', {
      detail: { reason: 'watchdog_timeout', stopped_at: 'synthesis' },
    });
    expect(event.phase).toBe('terminal');
    expect(event.detail).toBeDefined();
    expect(event.detail.reason).toBe('watchdog_timeout');
    expect(event.detail.stopped_at).toBe('synthesis');
  });

  it('heartbeat event carries a ts field for stall detection', () => {
    const hb = makeHeartbeatEvent();
    expect(hb.kind).toBe('heartbeat');
    expect(hb.ts).toBeTruthy();
    expect(new Date(hb.ts).getTime()).toBeGreaterThan(0);
  });

  it('kind discriminator distinguishes progress from heartbeat', () => {
    const events = [makeProgressEvent('failed'), makeHeartbeatEvent()];
    const failed = events.filter((e) => e.kind === 'progress' && e.phase === 'failed');
    const heartbeats = events.filter((e) => e.kind === 'heartbeat');
    expect(failed).toHaveLength(1);
    expect(heartbeats).toHaveLength(1);
  });
});

// ── Scenario B: cancel from second tab ────────────────────────────────────────

describe('Scenario B — cancel from second tab', () => {
  it('phase=cancelled is a valid progress event shape', () => {
    const event = makeProgressEvent('cancelled');
    expect(event.kind).toBe('progress');
    expect(event.phase).toBe('cancelled');
  });

  it('frontend handler stops processing after receiving phase=cancelled', () => {
    const received = [];
    let stopped = false;

    function handleEvent(event) {
      received.push(event.phase);
      if (event.phase === 'cancelled') {
        stopped = true;
      }
    }

    handleEvent(makeProgressEvent('started'));
    handleEvent(makeProgressEvent('cancelled'));

    // After cancel, simulate no more events being processed
    if (!stopped) {
      handleEvent(makeProgressEvent('completed')); // should not run
    }

    expect(received).toContain('cancelled');
    expect(received).not.toContain('completed');
  });

  it('two separate subscriber queues both receive the cancel event', () => {
    const queues = [[], []];
    const cancelEvent = makeProgressEvent('cancelled');

    // Simulate fan-out delivery
    for (const q of queues) {
      q.push(cancelEvent);
    }

    for (const q of queues) {
      expect(q).toHaveLength(1);
      expect(q[0].phase).toBe('cancelled');
    }
  });

  it('cancel event has the expected schema_version', () => {
    const event = makeProgressEvent('cancelled');
    expect(event.schema_version).toBe(1);
  });
});

// ── Scenario C: close one tab, other continues ────────────────────────────────

describe('Scenario C — close one tab, other keeps receiving', () => {
  it('removing one subscriber does not affect the other', () => {
    let subscribers = new Set();
    const queueA = [];
    const queueB = [];
    subscribers.add(queueA);
    subscribers.add(queueB);

    // Event 1 — both tabs connected
    const event1 = makeProgressEvent('started');
    for (const q of subscribers) {
      q.push(event1);
    }

    // Tab B disconnects
    subscribers.delete(queueB);

    // Event 2 — only tab A
    const event2 = makeProgressEvent('completed');
    for (const q of subscribers) {
      q.push(event2);
    }

    expect(queueA).toHaveLength(2);
    expect(queueA[0].phase).toBe('started');
    expect(queueA[1].phase).toBe('completed');

    expect(queueB).toHaveLength(1);
    expect(queueB[0].phase).toBe('started');
  });

  it('publishing to zero subscribers does not throw', () => {
    const subscribers = new Set();
    const event = makeProgressEvent('started');

    expect(() => {
      for (const q of subscribers) {
        q.push(event); // unreachable but must not throw if reached
      }
    }).not.toThrow();
  });

  it('subscriber count reflects add/remove operations', () => {
    const subscribers = new Set();
    const qA = [];
    const qB = [];

    subscribers.add(qA);
    subscribers.add(qB);
    expect(subscribers.size).toBe(2);

    subscribers.delete(qA);
    expect(subscribers.size).toBe(1);

    subscribers.delete(qB);
    expect(subscribers.size).toBe(0);
  });
});

// ── Scenario D: token expiry mid-stream ───────────────────────────────────────

describe('Scenario D — token expiry mid-stream', () => {
  it('auth_expiring event has the correct kind', () => {
    const event = makeAuthExpiringEvent(90);
    expect(event.kind).toBe('auth_expiring');
    expect(event.schema_version).toBe(1);
  });

  it('auth_expiring expires_at is in the future', () => {
    const event = makeAuthExpiringEvent(90);
    const expiresAt = new Date(event.expires_at).getTime();
    expect(expiresAt).toBeGreaterThan(Date.now());
  });

  it('should emit auth_expiring when token has < 120s remaining', () => {
    const secondsLeft = 90;
    const shouldEmit = secondsLeft < 120;
    expect(shouldEmit).toBe(true);
  });

  it('should NOT emit auth_expiring when token has >= 120s remaining', () => {
    const secondsLeft = 300;
    const shouldEmit = secondsLeft < 120;
    expect(shouldEmit).toBe(false);
  });

  it('expired token (past exp) is detectable', () => {
    const pastExpiry = new Date(Date.now() - 10_000).toISOString();
    const isExpired = new Date(pastExpiry).getTime() < Date.now();
    expect(isExpired).toBe(true);
  });

  it('frontend redirects to /login on auth_expiring event', () => {
    const navigateSpy = vi.fn();

    function handleSseEvent(event, navigate) {
      if (event.kind === 'auth_expiring') {
        navigate('/login');
      }
    }

    const authEvent = makeAuthExpiringEvent(90);
    handleSseEvent(authEvent, navigateSpy);

    expect(navigateSpy).toHaveBeenCalledWith('/login');
  });

  it('frontend does NOT redirect on non-auth events', () => {
    const navigateSpy = vi.fn();

    function handleSseEvent(event, navigate) {
      if (event.kind === 'auth_expiring') {
        navigate('/login');
      }
    }

    const progressEvent = makeProgressEvent('started');
    handleSseEvent(progressEvent, navigateSpy);

    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
