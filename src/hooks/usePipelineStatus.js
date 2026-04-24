import { useEffect, useRef, useState, useCallback } from 'react';
import api, { getErrorMessage } from '../lib/api';
import {
  buildDemoPipelineStatus,
  getBackoffDelay,
  getPipelinePollingInterval,
  isDemoCaseId,
  isGatePauseStatus,
  isTerminalPipelineStatus,
  isTerminalOverallStatus,
  MAX_POLL_ERRORS,
  STALE_THRESHOLD_MS,
  normalizePipelineStatus,
} from '../lib/pipelineStatus';

/**
 * usePipelineStatus — production-grade polling hook for pipeline status.
 *
 * Features:
 * - Immediate fetch on mount / caseId change
 * - Configurable base polling interval (env or default 3 s)
 * - Exponential backoff on consecutive errors (up to 30 s)
 * - Stops polling after MAX_POLL_ERRORS consecutive failures
 * - Stops polling when pipeline reaches a terminal state
 * - Stale-data detection (isStale flag)
 * - Manual retry callback to restart polling after it gave up
 * - Demo-case short-circuit (no network)
 *
 * @param {string}   caseId              – case to poll
 * @param {object}   options
 * @param {boolean}  options.enabled     – master on/off (default true)
 * @param {function} options.onStatus    – called with every normalized status
 * @param {function} options.onError     – called with error message strings
 * @param {function} options.onTerminal  – called once when pipeline finishes
 *
 * @returns {{ loading, pipelineStatus, error, errorCount, isStale, isGivenUp, retry }}
 */
export function usePipelineStatus(caseId, options = {}) {
  const {
    enabled = true,
    onStatus = null,
    onError = null,
    onTerminal = null,
  } = options;

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const [errorCount, setErrorCount] = useState(0);
  const [isStale, setIsStale] = useState(false);
  const [isGivenUp, setIsGivenUp] = useState(false);

  const timerRef = useRef(null);
  const lastFetchRef = useRef(null);
  const staleTimerRef = useRef(null);
  const mountedRef = useRef(true);
  const terminalFiredRef = useRef(false);

  // Keep callback refs stable to avoid re-triggering the effect
  const onStatusRef = useRef(onStatus);
  const onErrorRef = useRef(onError);
  const onTerminalRef = useRef(onTerminal);
  onStatusRef.current = onStatus;
  onErrorRef.current = onError;
  onTerminalRef.current = onTerminal;

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** Full stop — clears both the poll timer and the stale timer. */
  const stopAll = useCallback(() => {
    stopPolling();
    if (staleTimerRef.current) {
      window.clearTimeout(staleTimerRef.current);
      staleTimerRef.current = null;
    }
  }, [stopPolling]);

  const scheduleNext = useCallback((delayMs) => {
    // Only clear the poll timer, not the stale timer — stale detection
    // should persist across retries until a successful fetch resets it.
    stopPolling();
    timerRef.current = window.setTimeout(() => {
      fetchStatusRef.current?.();
    }, delayMs);
  }, [stopPolling]);

  const applyStatus = useCallback((nextStatus) => {
    if (!mountedRef.current) return;

    setStatus(nextStatus);
    setError(null);
    setErrorCount(0);
    setIsStale(false);
    setIsGivenUp(false);
    lastFetchRef.current = Date.now();
    onStatusRef.current?.(nextStatus);

    // Reset stale timer
    if (staleTimerRef.current) window.clearTimeout(staleTimerRef.current);
    staleTimerRef.current = window.setTimeout(() => {
      if (mountedRef.current) setIsStale(true);
    }, STALE_THRESHOLD_MS);

    // Terminal detection — gate pauses are not terminal (pipeline resumes after judge approval)
    const isTerminal =
      !isGatePauseStatus(nextStatus?.overall_status) &&
      (isTerminalPipelineStatus(nextStatus) ||
        isTerminalOverallStatus(nextStatus?.overall_status));

    if (isTerminal) {
      stopAll();
      if (!terminalFiredRef.current) {
        terminalFiredRef.current = true;
        onTerminalRef.current?.(nextStatus);
      }
    }
  }, [stopAll]);

  // Core fetch function — stored in a ref so scheduleNext can call it
  // without a stale closure.
  const fetchStatusRef = useRef(null);

  fetchStatusRef.current = async () => {
    if (!mountedRef.current) return;

    try {
      // Demo short-circuit
      if (isDemoCaseId(caseId)) {
        applyStatus(buildDemoPipelineStatus(caseId));
        setLoading(false);
        return; // terminal by design — no further polling
      }

      const payload = await api.getPipelineStatus(caseId);
      const normalized = normalizePipelineStatus(payload);
      applyStatus(normalized);

      // If not terminal, schedule next poll at base interval
      if (
        isGatePauseStatus(normalized?.overall_status) ||
        (!isTerminalPipelineStatus(normalized) &&
          !isTerminalOverallStatus(normalized?.overall_status))
      ) {
        scheduleNext(getPipelinePollingInterval());
      }
    } catch (err) {
      if (!mountedRef.current) return;

      const msg = getErrorMessage(err, 'Failed to fetch pipeline status');
      setError(msg);

      setErrorCount((prev) => {
        const next = prev + 1;

        if (next >= MAX_POLL_ERRORS) {
          // Give up — stop polling, surface the error
          setIsGivenUp(true);
          stopAll();
          onErrorRef.current?.(`Pipeline polling stopped after ${next} consecutive errors: ${msg}`);
        } else {
          // Backoff and retry
          const delay = getBackoffDelay(getPipelinePollingInterval(), next);
          scheduleNext(delay);
          onErrorRef.current?.(msg);
        }

        return next;
      });
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  // Wire scheduleNext to use the ref
  // (we override scheduleNext's inner call via the ref)
  const fetchStatus = useCallback(() => {
    fetchStatusRef.current?.();
  }, []);

  // Patch scheduleNext to use fetchStatus via ref
  useEffect(() => {
    // This is intentionally a no-op effect — the ref pattern above
    // ensures scheduleNext always calls the latest fetchStatus.
  }, [fetchStatus]);

  // ── Main effect: start polling when caseId / enabled changes ──────────
  useEffect(() => {
    mountedRef.current = true;
    terminalFiredRef.current = false;

    if (!enabled || !caseId) {
      setLoading(false);
      setStatus(null);
      setError(null);
      setErrorCount(0);
      setIsStale(false);
      setIsGivenUp(false);
      return () => {
        mountedRef.current = false;
        stopAll();
      };
    }

    setLoading(true);
    setError(null);
    setErrorCount(0);
    setIsStale(false);
    setIsGivenUp(false);

    // Immediate first fetch
    fetchStatusRef.current?.();

    return () => {
      mountedRef.current = false;
      stopAll();
    };
  }, [caseId, enabled, stopAll]);

  // ── Manual retry (restarts polling from scratch) ──────────────────────
  const retry = useCallback(() => {
    if (!caseId || !enabled) return;
    setError(null);
    setErrorCount(0);
    setIsStale(false);
    setIsGivenUp(false);
    setLoading(true);
    terminalFiredRef.current = false;
    fetchStatusRef.current?.();
  }, [caseId, enabled]);

  return {
    loading,
    pipelineStatus: status,
    error,
    errorCount,
    isStale,
    isGivenUp,
    retry,
  };
}

export default usePipelineStatus;
