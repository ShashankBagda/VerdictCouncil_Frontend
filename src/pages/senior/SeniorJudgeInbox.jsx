import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Inbox,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';
import { useAPI } from '../../hooks';
import api, { getErrorMessage } from '../../lib/api';
import { normalizeCaseSummary } from '../../lib/caseWorkspace';
import AuthContentGate from '../../components/auth/AuthContentGate';

function EscalatedCaseCard({ caseItem, onClick }) {
  const date = caseItem.filed_date || caseItem.created_at;
  const formattedDate = date
    ? new Date(date).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl bg-white border border-amber-200/60 shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 flex flex-col"
    >
      <div className="p-5 pb-3 flex-1">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0 bg-amber-400" />
            <span className="text-xs text-gray-400 font-medium">{formattedDate}</span>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border bg-amber-50 text-amber-700 border-amber-200 shrink-0">
            <TriangleAlert className="w-3 h-3" />
            Escalated
          </span>
        </div>

        <h3 className="font-bold text-navy-900 text-sm leading-snug mb-1 line-clamp-2">
          {caseItem.title || caseItem.case_number || `Case ${caseItem.id}`}
        </h3>

        {caseItem.domain && (
          <p className="text-xs text-gray-500 mb-1">Domain: {caseItem.domain}</p>
        )}

        {caseItem.parties && (
          <p className="text-xs text-gray-500 mb-2 line-clamp-1">
            Parties: {caseItem.parties}
          </p>
        )}

        {(caseItem.escalation_reason || caseItem.escalation_notes) && (
          <div className="mt-2 p-2.5 bg-amber-50 border border-amber-100 rounded-lg">
            <p className="text-xs font-semibold text-amber-700 mb-0.5">Escalation reason</p>
            <p className="text-xs text-amber-800 line-clamp-3">
              {caseItem.escalation_reason || caseItem.escalation_notes}
            </p>
          </div>
        )}
      </div>

      <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-1 text-xs font-semibold text-teal-600">
        Review case <ArrowRight className="w-3 h-3" />
      </div>
    </button>
  );
}

export default function SeniorJudgeInbox() {
  const navigate = useNavigate();
  const { showError } = useAPI();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const fetchEscalated = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const data = await api.listEscalatedCases();
      const items = Array.isArray(data) ? data : data?.items || data?.cases || [];
      setCases(items.map(normalizeCaseSummary));
    } catch (err) {
      const msg = getErrorMessage(err, 'Failed to load escalated cases');
      setFetchError(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchEscalated();
  }, [fetchEscalated]);

  return (
    <AuthContentGate>
      <div className="space-y-6">
        {/* Header */}
        <div className="card-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
                <Inbox className="w-6 h-6" />
                Senior Judge Inbox
              </h2>
              <p className="text-gray-600 mt-1">
                Cases escalated for senior judicial review
              </p>
            </div>
            <button
              onClick={fetchEscalated}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2 font-semibold disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Error state */}
        {fetchError && !loading && (
          <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{fetchError}</p>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        )}

        {/* Case grid */}
        {!loading && !fetchError && cases.length > 0 && (
          <>
            <p className="text-sm text-gray-500 font-medium">
              {cases.length} escalated case{cases.length !== 1 ? 's' : ''} awaiting review
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {cases.map((c) => (
                <EscalatedCaseCard
                  key={c.id}
                  caseItem={c}
                  onClick={() => navigate(`/case/${c.id}`)}
                />
              ))}
            </div>
          </>
        )}

        {/* Empty state */}
        {!loading && !fetchError && cases.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Inbox className="w-14 h-14 mb-4 opacity-30" />
            <p className="text-lg font-semibold">No escalated cases</p>
            <p className="text-sm mt-1">All cases are within normal judicial bounds.</p>
          </div>
        )}
      </div>
    </AuthContentGate>
  );
}
