// Sprint 4 4.A5.3 — submit + poll a what-if scenario.
//
// Consumer hands us a case_id and the modification payload built by
// <WhatIfModal>. We POST /cases/{id}/what-if (returns a scenario_id),
// then poll GET /cases/{id}/what-if/{sid} every 2s until the backend
// transitions out of pending/running. Result includes both verdicts
// and a structured diff_view that <WhatIfCompareView> renders.
//
// The hook is deliberately uncoupled from <WhatIfModal> so the same
// poll loop can be reused if a future surface (e.g. an inline panel)
// wants to drive what-if scenarios without the modal.

import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../lib/api';

const POLL_INTERVAL_MS = 2000;
const TERMINAL_STATUSES = new Set(['completed', 'failed']);

/**
 * @typedef {{
 *   modification_type: 'fact_toggle' | 'evidence_exclusion' | 'witness_credibility' | 'legal_interpretation',
 *   modification_payload: Record<string, unknown>,
 *   description?: string,
 * }} WhatIfRequest
 */

/**
 * @param {string|null|undefined} caseId
 * @returns {{
 *   submit: (req: WhatIfRequest) => Promise<void>,
 *   reset: () => void,
 *   status: 'idle' | 'submitting' | 'polling' | 'completed' | 'failed',
 *   scenario: object | null,
 *   error: string | null,
 * }}
 */
export default function useWhatIfScenario(caseId) {
  const [status, setStatus] = useState('idle');
  const [scenario, setScenario] = useState(null);
  const [error, setError] = useState(null);

  const pollRef = useRef(null);
  const abortedRef = useRef(false);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stopPoll();
    abortedRef.current = false;
    setStatus('idle');
    setScenario(null);
    setError(null);
  }, [stopPoll]);

  // Recursive poll wrapped through a ref so the lint rule
  // (react-hooks/immutability) doesn't flag the self-reference. The
  // scheduler calls `pollFnRef.current(...)` so the latest closure
  // always wins on rerenders.
  const pollFnRef = useRef(null);

  const poll = useCallback(
    async (scenarioId) => {
      try {
        const result = await api.getWhatIfScenario(caseId, scenarioId);
        if (abortedRef.current) return;
        setScenario(result);
        if (TERMINAL_STATUSES.has(result?.status)) {
          setStatus(result.status === 'completed' ? 'completed' : 'failed');
          if (result.status === 'failed') {
            setError(result.error || 'What-if scenario failed');
          }
          return;
        }
        pollRef.current = setTimeout(
          () => pollFnRef.current?.(scenarioId),
          POLL_INTERVAL_MS,
        );
      } catch (err) {
        if (abortedRef.current) return;
        setStatus('failed');
        setError(err?.message || 'Failed to load scenario');
      }
    },
    [caseId],
  );

  // Sync the recursive ref outside render — useEffect runs after
  // commit, so the lint rule doesn't trip.
  useEffect(() => {
    pollFnRef.current = poll;
  }, [poll]);

  const submit = useCallback(
    async (req) => {
      if (!caseId) return;
      stopPoll();
      abortedRef.current = false;
      setError(null);
      setScenario(null);
      setStatus('submitting');
      try {
        const ack = await api.createWhatIfScenario(caseId, req);
        if (abortedRef.current) return;
        setStatus('polling');
        // Kick the first poll without delay so the UI sees the scenario row
        // (status: pending) immediately; subsequent rounds back off to 2s.
        await poll(ack.scenario_id);
      } catch (err) {
        if (abortedRef.current) return;
        setStatus('failed');
        setError(err?.message || 'Failed to submit scenario');
      }
    },
    [caseId, poll, stopPoll],
  );

  // Cancel in-flight polls on unmount or caseId change so stale ticks
  // can't write to a torn-down component.
  useEffect(() => {
    return () => {
      abortedRef.current = true;
      stopPoll();
    };
  }, [caseId, stopPoll]);

  return { submit, reset, status, scenario, error };
}
