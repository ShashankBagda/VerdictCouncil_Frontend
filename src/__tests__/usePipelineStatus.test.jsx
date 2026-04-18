import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { usePipelineStatus } from '../hooks/usePipelineStatus';

// ── Mocks ───────────────────────────────────────────────────────────────────

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    getPipelineStatus: vi.fn(),
  },
}));

vi.mock('../lib/api', () => ({
  default: mockApi,
  getErrorMessage: (err, fallback) => err?.message || err?.detail || fallback,
  APIError: class APIError extends Error {
    constructor(status, detail) {
      super(detail);
      this.status = status;
      this.detail = detail;
    }
  },
}));

// Pin the polling interval to 100 ms, MAX_POLL_ERRORS to 3, and
// STALE_THRESHOLD_MS to 500ms for fast tests.
vi.mock('../lib/pipelineStatus', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    getPipelinePollingInterval: () => 100,
    MAX_POLL_ERRORS: 3,
    STALE_THRESHOLD_MS: 500,
    getBackoffDelay: (base, count) => {
      // Tiny backoff for tests: 50ms * 2^count, capped at 400ms
      if (count <= 0) return 50;
      return Math.min(50 * 2 ** count, 400);
    },
  };
});

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Build a "processing" status payload the hook will normalize. */
function processingPayload(agentOverrides = {}) {
  return {
    agents: [
      { agent_id: 'case-processing', status: 'completed', ...agentOverrides['case-processing'] },
      { agent_id: 'deliberation', status: 'running', ...agentOverrides['deliberation'] },
    ],
    overall_progress_percent: 50,
  };
}

/** Build a fully-terminal payload (all agents completed). */
function terminalPayload() {
  return {
    agents: [
      { agent_id: 'case-processing', status: 'completed' },
      { agent_id: 'deliberation', status: 'completed' },
    ],
    overall_progress_percent: 100,
    overall_status: 'completed',
  };
}

/** Build a terminal-failed payload. */
function failedPayload() {
  return {
    agents: [
      { agent_id: 'case-processing', status: 'completed' },
      { agent_id: 'deliberation', status: 'failed' },
    ],
    overall_progress_percent: 50,
    overall_status: 'failed',
  };
}

// ── Test suite ──────────────────────────────────────────────────────────────

describe('usePipelineStatus hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Basic lifecycle ───────────────────────────────────────────────────

  it('fetches status immediately on mount and exposes normalized data', async () => {
    mockApi.getPipelineStatus.mockResolvedValueOnce(processingPayload());

    const { result } = renderHook(() => usePipelineStatus('case-123'));

    // Initially loading
    expect(result.current.loading).toBe(true);
    expect(result.current.pipelineStatus).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.pipelineStatus).not.toBeNull();
    expect(result.current.pipelineStatus.agents).toHaveLength(2);
    expect(result.current.pipelineStatus.overall_progress_percent).toBe(50);
    expect(result.current.error).toBeNull();
    expect(result.current.errorCount).toBe(0);
    expect(result.current.isGivenUp).toBe(false);
  });

  it('returns idle state when caseId is null', async () => {
    const { result } = renderHook(() => usePipelineStatus(null));

    expect(result.current.loading).toBe(false);
    expect(result.current.pipelineStatus).toBeNull();
    expect(mockApi.getPipelineStatus).not.toHaveBeenCalled();
  });

  it('returns idle state when enabled is false', async () => {
    const { result } = renderHook(() =>
      usePipelineStatus('case-123', { enabled: false }),
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.pipelineStatus).toBeNull();
    expect(mockApi.getPipelineStatus).not.toHaveBeenCalled();
  });

  it('calls onStatus callback with each successful fetch', async () => {
    const onStatus = vi.fn();
    mockApi.getPipelineStatus.mockResolvedValue(processingPayload());

    renderHook(() => usePipelineStatus('case-123', { onStatus }));

    await waitFor(() => {
      expect(onStatus).toHaveBeenCalledTimes(1);
    });

    expect(onStatus).toHaveBeenCalledWith(
      expect.objectContaining({ agents: expect.any(Array) }),
    );
  });

  // ── Polling continuation ──────────────────────────────────────────────

  it('continues polling while pipeline is non-terminal', async () => {
    mockApi.getPipelineStatus.mockResolvedValue(processingPayload());

    const { result } = renderHook(() => usePipelineStatus('case-123'));

    // Wait for first fetch
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(mockApi.getPipelineStatus).toHaveBeenCalledTimes(1);

    // Advance past the polling interval to trigger second fetch
    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    await waitFor(() => {
      expect(mockApi.getPipelineStatus).toHaveBeenCalledTimes(2);
    });
  });

  // ── Terminal stop ─────────────────────────────────────────────────────

  it('stops polling when all agents reach terminal state', async () => {
    mockApi.getPipelineStatus.mockResolvedValueOnce(terminalPayload());

    const onTerminal = vi.fn();
    const { result } = renderHook(() =>
      usePipelineStatus('case-123', { onTerminal }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.pipelineStatus.overall_status).toBe('completed');
    expect(onTerminal).toHaveBeenCalledTimes(1);

    // Advance well past polling interval — should NOT fetch again
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(mockApi.getPipelineStatus).toHaveBeenCalledTimes(1);
  });

  it('stops polling when overall_status is "failed"', async () => {
    mockApi.getPipelineStatus.mockResolvedValueOnce(failedPayload());

    const onTerminal = vi.fn();
    const { result } = renderHook(() =>
      usePipelineStatus('case-123', { onTerminal }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.pipelineStatus.overall_status).toBe('failed');
    expect(onTerminal).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(mockApi.getPipelineStatus).toHaveBeenCalledTimes(1);
  });

  it('fires onTerminal only once even if status is re-applied', async () => {
    // First call: terminal. Second call (if any): also terminal.
    mockApi.getPipelineStatus.mockResolvedValue(terminalPayload());

    const onTerminal = vi.fn();
    renderHook(() => usePipelineStatus('case-123', { onTerminal }));

    await waitFor(() => {
      expect(onTerminal).toHaveBeenCalledTimes(1);
    });

    // Even if we somehow trigger another fetch, onTerminal should not fire again
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(onTerminal).toHaveBeenCalledTimes(1);
  });

  // ── Error handling & backoff ──────────────────────────────────────────

  it('sets error state on fetch failure and backs off', async () => {
    mockApi.getPipelineStatus.mockRejectedValue(new Error('Network error'));

    const onError = vi.fn();
    const { result } = renderHook(() =>
      usePipelineStatus('case-123', { onError }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.errorCount).toBe(1);
    expect(result.current.isGivenUp).toBe(false);
    expect(onError).toHaveBeenCalledWith('Network error');
  });

  it('resets error count on a successful fetch after errors', async () => {
    // First call fails, second succeeds
    mockApi.getPipelineStatus
      .mockRejectedValueOnce(new Error('Temporary failure'))
      .mockResolvedValueOnce(processingPayload());

    const { result } = renderHook(() => usePipelineStatus('case-123'));

    // Wait for first (failed) fetch
    await waitFor(() => {
      expect(result.current.errorCount).toBe(1);
    });

    // Advance past backoff delay to trigger retry
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    await waitFor(() => {
      expect(result.current.errorCount).toBe(0);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.pipelineStatus).not.toBeNull();
  });

  it('uses increasing backoff delays between error retries', async () => {
    mockApi.getPipelineStatus.mockRejectedValue(new Error('Server down'));

    renderHook(() => usePipelineStatus('case-123'));

    // First fetch is immediate
    await waitFor(() => {
      expect(mockApi.getPipelineStatus).toHaveBeenCalledTimes(1);
    });

    // After error 1, backoff = 100ms (50 * 2^1)
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    await waitFor(() => {
      expect(mockApi.getPipelineStatus).toHaveBeenCalledTimes(2);
    });

    // After error 2, backoff = 200ms (50 * 2^2)
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    await waitFor(() => {
      expect(mockApi.getPipelineStatus).toHaveBeenCalledTimes(3);
    });
  });

  // ── Give-up after MAX_POLL_ERRORS ─────────────────────────────────────

  it('gives up after MAX_POLL_ERRORS consecutive failures', async () => {
    mockApi.getPipelineStatus.mockRejectedValue(new Error('Persistent failure'));

    const onError = vi.fn();
    const { result } = renderHook(() =>
      usePipelineStatus('case-123', { onError }),
    );

    // Drain all 3 errors (our mock MAX_POLL_ERRORS = 3)
    // Error 1: immediate fetch
    await waitFor(() => {
      expect(result.current.errorCount).toBe(1);
    });

    // Error 2: advance past backoff
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    await waitFor(() => {
      expect(result.current.errorCount).toBe(2);
    });

    // Error 3: advance past backoff — this should trigger give-up
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    await waitFor(() => {
      expect(result.current.errorCount).toBe(3);
    });

    expect(result.current.isGivenUp).toBe(true);
    expect(result.current.error).toBe('Persistent failure');

    // The final onError call should mention "stopped"
    const lastCall = onError.mock.calls[onError.mock.calls.length - 1][0];
    expect(lastCall).toContain('stopped');

    // No more fetches should happen
    const callCount = mockApi.getPipelineStatus.mock.calls.length;
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(mockApi.getPipelineStatus).toHaveBeenCalledTimes(callCount);
  });

  // ── Manual retry ──────────────────────────────────────────────────────

  it('retry() restarts polling after give-up', async () => {
    mockApi.getPipelineStatus
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockRejectedValueOnce(new Error('fail 3'))
      // After retry, succeed
      .mockResolvedValueOnce(processingPayload());

    const { result } = renderHook(() => usePipelineStatus('case-123'));

    // Drain to give-up
    await waitFor(() => {
      expect(result.current.errorCount).toBeGreaterThanOrEqual(1);
    });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    await waitFor(() => {
      expect(result.current.isGivenUp).toBe(true);
    });

    // Now call retry
    await act(async () => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.isGivenUp).toBe(false);
      expect(result.current.pipelineStatus).not.toBeNull();
    });

    expect(result.current.errorCount).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('retry() is a no-op when caseId is null', async () => {
    const { result } = renderHook(() => usePipelineStatus(null));

    act(() => {
      result.current.retry();
    });

    expect(mockApi.getPipelineStatus).not.toHaveBeenCalled();
  });

  // ── Stale detection ───────────────────────────────────────────────────

  it('marks data as stale after STALE_THRESHOLD_MS without a new fetch', async () => {
    // First fetch succeeds, then all subsequent fetches fail so no
    // successful applyStatus resets the stale timer.
    // With MAX_POLL_ERRORS=3, give-up happens quickly (~400ms).
    // But give-up calls stopAll which clears the stale timer.
    // So we need the stale timer (500ms) to fire BEFORE give-up.
    // Timeline: success@0 → error@100ms → error@200ms → error@400ms (give-up)
    // Stale timer fires at 500ms, but stopAll at 400ms clears it.
    //
    // To test stale properly, we need errors that DON'T reach give-up.
    // Use only 1 error then succeed — the stale timer from the first
    // success fires at 500ms if no new success arrives before then.
    // But with 100ms polling, the second fetch at 100ms fails, backoff
    // schedules retry at 200ms, which succeeds — that's at 200ms, before 500ms.
    //
    // Simplest approach: succeed once, then make the next fetch take a long
    // time (never resolve) so no new applyStatus happens.
    let resolveSecond;
    mockApi.getPipelineStatus
      .mockResolvedValueOnce(processingPayload())
      .mockImplementation(() => new Promise((resolve) => { resolveSecond = resolve; }));

    const { result, unmount } = renderHook(() => usePipelineStatus('case-123'));

    // Wait for first success
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(result.current.isStale).toBe(false);

    // Advance past stale threshold (500ms mocked). The second fetch is
    // still pending (hanging promise), so no applyStatus resets the timer.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(result.current.isStale).toBe(true);
    expect(result.current.pipelineStatus).not.toBeNull();

    // Clean up the hanging promise inside act so React observes the final state transition.
    await act(async () => {
      resolveSecond?.(processingPayload());
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
    unmount();
  });

  it('clears stale flag when a successful fetch arrives after stale', async () => {
    // Same hanging-promise approach: succeed, hang, stale fires, then
    // resolve the hanging fetch → applyStatus clears stale.
    let resolveHanging;
    mockApi.getPipelineStatus
      .mockResolvedValueOnce(processingPayload())
      .mockImplementation(() => new Promise((resolve) => { resolveHanging = resolve; }));

    const { result, unmount } = renderHook(() => usePipelineStatus('case-123'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(result.current.isStale).toBe(false);

    // Let stale fire
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(result.current.isStale).toBe(true);

    // Now resolve the hanging fetch — applyStatus should clear stale
    await act(async () => {
      resolveHanging(processingPayload());
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(result.current.isStale).toBe(false);
    expect(result.current.pipelineStatus).not.toBeNull();
    unmount();
  });

  // ── Demo case short-circuit ───────────────────────────────────────────

  it('returns demo data immediately for demo case IDs without network', async () => {
    const { result } = renderHook(() => usePipelineStatus('demo-refund-delay'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockApi.getPipelineStatus).not.toHaveBeenCalled();
    expect(result.current.pipelineStatus).not.toBeNull();
    expect(result.current.pipelineStatus.agents).toHaveLength(9);
    expect(result.current.pipelineStatus.overall_status).toBe('processing');
  });

  // ── Cleanup on unmount ────────────────────────────────────────────────

  it('stops polling on unmount', async () => {
    mockApi.getPipelineStatus.mockResolvedValue(processingPayload());

    const { result, unmount } = renderHook(() => usePipelineStatus('case-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const callsBefore = mockApi.getPipelineStatus.mock.calls.length;
    unmount();

    // Advance timers — no new fetches should happen
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(mockApi.getPipelineStatus).toHaveBeenCalledTimes(callsBefore);
  });

  // ── caseId change ─────────────────────────────────────────────────────

  it('resets state and re-fetches when caseId changes', async () => {
    mockApi.getPipelineStatus
      .mockResolvedValueOnce(processingPayload())
      .mockResolvedValueOnce(terminalPayload());

    const { result, rerender } = renderHook(
      ({ caseId }) => usePipelineStatus(caseId),
      { initialProps: { caseId: 'case-A' } },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.pipelineStatus.overall_progress_percent).toBe(50);

    // Change caseId
    rerender({ caseId: 'case-B' });

    await waitFor(() => {
      expect(result.current.pipelineStatus.overall_progress_percent).toBe(100);
    });

    expect(mockApi.getPipelineStatus).toHaveBeenCalledTimes(2);
  });
});
