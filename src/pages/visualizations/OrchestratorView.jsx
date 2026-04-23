/**
 * OrchestratorView
 *
 * Route: /case/:caseId/orchestrator
 *
 * Fetches the full case detail, extracts orchestration metadata, and renders
 * OrchestratorPanel. Also exposes a restart pipeline button when the case is
 * in a restartable state.
 */
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useAuth, useAPI } from '../../hooks';
import api, { getErrorMessage } from '../../lib/api';
import OrchestratorPanel from '../../components/orchestrator/OrchestratorPanel';

const RESTARTABLE_STATUSES = new Set(['failed', 'failed_retryable', 'escalated']);

export default function OrchestratorView() {
  const { caseId } = useParams();
  useAuth();
  const { showError, showNotification } = useAPI();

  const [loading, setLoading] = useState(true);
  const [caseData, setCaseData] = useState(null);
  const [restarting, setRestarting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getCaseDetail(caseId);
      setCaseData(data);
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to load case data'));
    } finally {
      setLoading(false);
    }
  }, [caseId, showError]);

  useEffect(() => { load(); }, [load]);

  const handleRestart = async () => {
    try {
      setRestarting(true);
      await api.restartPipeline(caseId);
      showNotification('Pipeline restart enqueued', 'success');
      await load();
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to restart pipeline'));
    } finally {
      setRestarting(false);
    }
  };

  const rawStatus = caseData?.raw_status || caseData?.status;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy-900">Pipeline Orchestrator</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Real-time gate progress, agent run log, and pipeline metadata for this case.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {RESTARTABLE_STATUSES.has(rawStatus) && (
            <button
              onClick={handleRestart}
              disabled={restarting}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 transition-colors font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${restarting ? 'animate-spin' : ''}`} />
              {restarting ? 'Restarting…' : 'Restart Pipeline'}
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {loading && !caseData ? (
        <div className="card-lg flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 animate-spin text-teal-500" />
          <span className="ml-3 text-gray-500">Loading orchestration data…</span>
        </div>
      ) : (
        <OrchestratorPanel caseData={caseData} />
      )}
    </div>
  );
}
