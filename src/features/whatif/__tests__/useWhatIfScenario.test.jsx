// Sprint 4 4.A5.3 — useWhatIfScenario hook contract.
//
// Locks: submit POSTs once, then polls until terminal; aborts on
// unmount; status transitions track api responses. Real timers
// throughout — the tests that exercise the multi-poll path patch
// POLL_INTERVAL_MS via a vi.mock-ed module export so test latency
// stays in the millisecond range.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const createMock = vi.fn();
const getMock = vi.fn();

vi.mock('../../../lib/api', () => ({
  default: {
    createWhatIfScenario: (...args) => createMock(...args),
    getWhatIfScenario: (...args) => getMock(...args),
  },
}));

import useWhatIfScenario from '../useWhatIfScenario';

beforeEach(() => {
  createMock.mockReset();
  getMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useWhatIfScenario', () => {
  it('starts idle with no scenario', () => {
    const { result } = renderHook(() => useWhatIfScenario('case-1'));
    expect(result.current.status).toBe('idle');
    expect(result.current.scenario).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('submits and lands on completed when first poll returns terminal', async () => {
    createMock.mockResolvedValue({ scenario_id: 's1' });
    getMock.mockResolvedValueOnce({
      status: 'completed',
      original_verdict: { preliminary_conclusion: 'liable' },
      modified_verdict: { preliminary_conclusion: 'not_liable' },
      diff_view: { analysis_changed: true, confidence_delta: -10 },
    });

    const { result } = renderHook(() => useWhatIfScenario('case-1'));

    await act(async () => {
      await result.current.submit({
        modification_type: 'evidence_exclusion',
        modification_payload: { evidence_id: 'e1' },
      });
    });

    expect(createMock).toHaveBeenCalledWith('case-1', {
      modification_type: 'evidence_exclusion',
      modification_payload: { evidence_id: 'e1' },
    });
    expect(result.current.status).toBe('completed');
    expect(result.current.scenario.modified_verdict.preliminary_conclusion).toBe('not_liable');
  });

  it('keeps polling while backend reports running', async () => {
    createMock.mockResolvedValue({ scenario_id: 's4' });
    // First two polls: running. Third: completed. Real setTimeouts
    // would mean a 6s real wait — instead we let the hook schedule
    // them, then advance via vi.runOnlyPendingTimersAsync after
    // installing fake timers AFTER the first synchronous burst.
    getMock
      .mockResolvedValueOnce({ status: 'running' })
      .mockResolvedValueOnce({ status: 'running' })
      .mockResolvedValueOnce({
        status: 'completed',
        modified_verdict: { preliminary_conclusion: 'not_liable' },
      });

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true });

    const { result } = renderHook(() => useWhatIfScenario('case-1'));

    await act(async () => {
      await result.current.submit({
        modification_type: 'evidence_exclusion',
        modification_payload: { evidence_id: 'x' },
      });
    });
    expect(result.current.status).toBe('polling');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    expect(result.current.status).toBe('polling');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });

    await waitFor(() => expect(result.current.status).toBe('completed'));
    expect(getMock).toHaveBeenCalledTimes(3);
  });

  it('lands on failed when backend returns failed', async () => {
    createMock.mockResolvedValue({ scenario_id: 's2' });
    getMock.mockResolvedValueOnce({ status: 'failed', error: 'fork crashed' });

    const { result } = renderHook(() => useWhatIfScenario('case-1'));

    await act(async () => {
      await result.current.submit({
        modification_type: 'fact_toggle',
        modification_payload: { fact_id: 'f1', new_status: 'disputed' },
      });
    });

    await waitFor(() => expect(result.current.status).toBe('failed'));
    expect(result.current.error).toContain('fork crashed');
  });

  it('reports failed when the create call rejects', async () => {
    createMock.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useWhatIfScenario('case-1'));

    await act(async () => {
      await result.current.submit({
        modification_type: 'evidence_exclusion',
        modification_payload: { evidence_id: 'x' },
      });
    });

    expect(result.current.status).toBe('failed');
    expect(result.current.error).toBe('boom');
  });

  it('reset() clears state and stops the poll loop', async () => {
    createMock.mockResolvedValue({ scenario_id: 's3' });
    getMock.mockResolvedValue({ status: 'running' });

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true });

    const { result } = renderHook(() => useWhatIfScenario('case-1'));

    await act(async () => {
      await result.current.submit({
        modification_type: 'evidence_exclusion',
        modification_payload: { evidence_id: 'x' },
      });
    });
    expect(result.current.status).toBe('polling');

    act(() => {
      result.current.reset();
    });
    expect(result.current.status).toBe('idle');
    expect(result.current.scenario).toBeNull();

    const callsAfterReset = getMock.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(getMock.mock.calls.length).toBe(callsAfterReset);
  });
});
