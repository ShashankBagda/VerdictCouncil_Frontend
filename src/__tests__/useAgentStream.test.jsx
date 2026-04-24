import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAgentStream } from '../hooks/useAgentStream';

// ── EventSource mock ─────────────────────────────────────────────────────────

class MockEventSource {
  constructor() {
    this.listeners = {};
    this.onopen = null;
    this.onerror = null;
    this.close = vi.fn();
    MockEventSource.instances.push(this);
  }

  addEventListener(type, handler) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(handler);
  }

  /** Simulate a named SSE event frame */
  emit(type, data) {
    (this.listeners[type] || []).forEach((h) => h({ data: JSON.stringify(data) }));
  }

  /** Simulate SSE connection open */
  open() { this.onopen?.(); }

  /** Simulate SSE error / disconnect */
  fail() { this.onerror?.(); }
}
MockEventSource.instances = [];

// ── API mock ─────────────────────────────────────────────────────────────────

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    streamPipelineStatus: vi.fn(),
    getPipelineStatus: vi.fn(),
  },
}));

vi.mock('../lib/api', () => ({ default: mockApi }));

vi.mock('../lib/pipelineStatus', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    // Mark progress events with agent==="pipeline" and phase==="terminal" as terminal
    isTerminalPipelineSseEvent: (data) =>
      data?.kind === 'progress' && data?.phase === 'terminal' && data?.agent === 'pipeline',
  };
});

// ── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  MockEventSource.instances = [];
  mockApi.streamPipelineStatus.mockImplementation(() => new MockEventSource());
  mockApi.getPipelineStatus.mockResolvedValue({ agents: [], overall_status: 'processing' });
  // shouldAdvanceTime: true lets real time pass (so waitFor works) while
  // still intercepting setInterval/setTimeout for polling control.
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function latestEs() {
  return MockEventSource.instances[MockEventSource.instances.length - 1];
}

/** Wait for the first EventSource to be created (effect has run). */
async function waitForConnect() {
  await waitFor(() => expect(MockEventSource.instances.length).toBeGreaterThan(0));
  return latestEs();
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useAgentStream', () => {
  it('starts in connecting status and opens an EventSource', async () => {
    const { result } = renderHook(() => useAgentStream('case-1'));
    expect(result.current.status).toBe('connecting');
    await waitForConnect();
    expect(mockApi.streamPipelineStatus).toHaveBeenCalledWith('case-1');
  });

  it('transitions to connected when SSE opens', async () => {
    const { result } = renderHook(() => useAgentStream('case-1'));
    const es = await waitForConnect();
    act(() => es.open());
    await waitFor(() => expect(result.current.status).toBe('connected'));
  });

  it('accumulates progress events keyed by agent', async () => {
    const { result } = renderHook(() => useAgentStream('case-1'));
    const es = await waitForConnect();
    act(() => es.open());
    await waitFor(() => expect(result.current.status).toBe('connected'));

    act(() => {
      es.emit('progress', {
        kind: 'progress',
        schema_version: 1,
        agent: 'evidence-analysis',
        phase: 'started',
        case_id: 'case-1',
        ts: '2026-04-24T00:00:00Z',
      });
    });
    await waitFor(() =>
      expect(result.current.events['evidence-analysis']).toHaveLength(1),
    );
    expect(result.current.events['evidence-analysis'][0].phase).toBe('started');
  });

  it('accumulates agent telemetry events (tool_call, llm_response)', async () => {
    const { result } = renderHook(() => useAgentStream('case-1'));
    const es = await waitForConnect();
    act(() => es.open());
    await waitFor(() => expect(result.current.status).toBe('connected'));

    act(() => {
      es.emit('agent', {
        kind: 'agent',
        schema_version: 1,
        agent: 'evidence-analysis',
        event: 'tool_call',
        tool_name: 'parse_document',
        args: { file_id: 'f-123' },
        ts: '2026-04-24T00:00:00Z',
        case_id: 'case-1',
      });
      es.emit('agent', {
        kind: 'agent',
        schema_version: 1,
        agent: 'evidence-analysis',
        event: 'llm_response',
        content: '{"evidence_analysis":{"evidence_items":[]}}',
        ts: '2026-04-24T00:00:01Z',
        case_id: 'case-1',
      });
    });
    await waitFor(() =>
      expect(result.current.events['evidence-analysis']).toHaveLength(2),
    );
  });

  it('calls onTerminal and sets status to idle on pipeline terminal event', async () => {
    const onTerminal = vi.fn();
    const { result } = renderHook(() => useAgentStream('case-1', { onTerminal }));
    const es = await waitForConnect();
    act(() => es.open());
    await waitFor(() => expect(result.current.status).toBe('connected'));

    act(() => {
      es.emit('progress', {
        kind: 'progress',
        agent: 'pipeline',
        phase: 'terminal',
        case_id: 'case-1',
        ts: '2026-04-24T00:00:00Z',
      });
    });
    await waitFor(() => expect(result.current.status).toBe('idle'));
    expect(onTerminal).toHaveBeenCalledOnce();
    expect(es.close).toHaveBeenCalled();
  });

  it('does not accumulate the pipeline-level terminal event as an agent event', async () => {
    const { result } = renderHook(() => useAgentStream('case-1'));
    const es = await waitForConnect();
    act(() => es.open());
    await waitFor(() => expect(result.current.status).toBe('connected'));

    act(() => {
      es.emit('progress', {
        kind: 'progress',
        agent: 'pipeline',
        phase: 'terminal',
        case_id: 'case-1',
        ts: '2026-04-24T00:00:00Z',
      });
    });
    await waitFor(() => expect(result.current.status).toBe('idle'));
    // Pipeline-level terminal should NOT appear in the events dict
    expect(result.current.events['pipeline']).toBeUndefined();
  });

  it('falls back to polling when SSE errors before terminal', async () => {
    const { result } = renderHook(() => useAgentStream('case-1'));
    const es = await waitForConnect();
    act(() => es.open());
    await waitFor(() => expect(result.current.status).toBe('connected'));

    act(() => es.fail());
    await waitFor(() => expect(result.current.status).toBe('polling'));

    // Advance past the 5 s polling interval
    await act(async () => { vi.advanceTimersByTime(5100); });
    expect(mockApi.getPipelineStatus).toHaveBeenCalledWith('case-1');
  });

  it('does not start polling when SSE errors after terminal', async () => {
    renderHook(() => useAgentStream('case-1'));
    const es = await waitForConnect();
    act(() => es.open());
    await waitFor(() => expect(mockApi.streamPipelineStatus).toHaveBeenCalledTimes(1));

    // Deliver terminal event first
    act(() => {
      es.emit('progress', {
        kind: 'progress',
        agent: 'pipeline',
        phase: 'terminal',
        case_id: 'case-1',
        ts: '2026-04-24T00:00:00Z',
      });
    });

    // Simulate the browser-fired onerror after the backend closes the stream
    act(() => es.fail());
    await act(async () => { vi.advanceTimersByTime(5100); });
    // Polling should NOT start after a clean terminal
    expect(mockApi.getPipelineStatus).not.toHaveBeenCalled();
  });

  it('re-arms SSE when tab becomes visible', async () => {
    renderHook(() => useAgentStream('case-1'));
    await waitForConnect();
    expect(mockApi.streamPipelineStatus).toHaveBeenCalledTimes(1);

    // Hide tab → show tab
    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() =>
      expect(mockApi.streamPipelineStatus).toHaveBeenCalledTimes(2),
    );
  });

  it('does not re-arm after a terminal event', async () => {
    renderHook(() => useAgentStream('case-1'));
    const es = await waitForConnect();
    act(() => es.open());
    await waitFor(() => expect(mockApi.streamPipelineStatus).toHaveBeenCalledTimes(1));

    // Deliver terminal
    act(() => {
      es.emit('progress', {
        kind: 'progress',
        agent: 'pipeline',
        phase: 'terminal',
        case_id: 'case-1',
        ts: '2026-04-24T00:00:00Z',
      });
    });

    // Bring tab to visible — should NOT reconnect
    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    // Small delay to ensure no re-arm happened
    await act(async () => { vi.advanceTimersByTime(100); });
    expect(mockApi.streamPipelineStatus).toHaveBeenCalledTimes(1);
  });

  it('redirects to /login on auth_expiring event', async () => {
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      configurable: true,
    });
    renderHook(() => useAgentStream('case-1'));
    const es = await waitForConnect();
    act(() => es.open());
    await waitFor(() => expect(es.onopen).not.toBeNull());

    act(() => {
      es.emit('auth_expiring', {
        kind: 'auth_expiring',
        schema_version: 1,
        expires_at: new Date(Date.now() + 30000).toISOString(),
      });
    });
    expect(window.location.href).toBe('/login');
  });

  it('cleanup closes the EventSource on unmount', async () => {
    const { unmount } = renderHook(() => useAgentStream('case-1'));
    const es = await waitForConnect();
    unmount();
    expect(es.close).toHaveBeenCalled();
  });
});
