import { useEffect, useRef, useState } from 'react';
import api, { getErrorMessage } from '../lib/api';
import {
  buildDemoPipelineStatus,
  getPipelinePollingInterval,
  isDemoCaseId,
  isTerminalPipelineStatus,
  normalizePipelineStatus,
} from '../lib/pipelineStatus';

export function usePipelineStatus(caseId, options = {}) {
  const {
    enabled = true,
    onStatus = null,
    onError = null,
  } = options;

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!enabled || !caseId) {
      setLoading(false);
      return undefined;
    }

    let isMounted = true;

    const stopPolling = () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const applyStatus = (nextStatus) => {
      if (!isMounted) return;
      setStatus(nextStatus);
      onStatus?.(nextStatus);

      if (isTerminalPipelineStatus(nextStatus)) {
        stopPolling();
      }
    };

    const fetchStatus = async () => {
      try {
        if (isDemoCaseId(caseId)) {
          applyStatus(buildDemoPipelineStatus(caseId));
          setLoading(false);
          stopPolling();
          return;
        }

        const payload = await api.getPipelineStatus(caseId);
        applyStatus(normalizePipelineStatus(payload));
      } catch (error) {
        if (isMounted) {
          onError?.(getErrorMessage(error, 'Failed to fetch pipeline status'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    setLoading(true);
    fetchStatus();

    intervalRef.current = window.setInterval(fetchStatus, getPipelinePollingInterval());

    return () => {
      isMounted = false;
      stopPolling();
    };
  }, [caseId, enabled, onError, onStatus]);

  return {
    loading,
    pipelineStatus: status,
  };
}

export default usePipelineStatus;
