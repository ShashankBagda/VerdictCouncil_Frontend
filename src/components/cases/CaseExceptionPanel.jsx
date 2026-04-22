import React, { useEffect, useMemo, useState } from 'react';
import {
  FilePenLine,
  History,
  ShieldCheck,
  History as HistoryIcon,
  CircleAlert,
  Gavel,
} from 'lucide-react';
import { useAPI } from '../../hooks';
import api, { getErrorMessage } from '../../lib/api';
import { getCaseDecisionHistory } from '../../lib/escalationWorkflow';
import ReopenRequestForm from '../judge/ReopenRequestForm';

function ReopenStatusBadge({ status }) {
  const tone =
    status === 'approved'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'rejected'
        ? 'bg-rose-100 text-rose-700'
        : 'bg-amber-100 text-amber-700';

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${tone}`}>
      {status}
    </span>
  );
}

export default function CaseExceptionPanel({ caseId, caseDetail }) {
  const { showError, showNotification } = useAPI();
  const [reopenItems, setReopenItems] = useState([]);
  const [reopenSubmitting, setReopenSubmitting] = useState(false);
  const decisionHistory = useMemo(() => getCaseDecisionHistory(caseDetail), [caseDetail]);
  const normalizedStatus = String(caseDetail?.status || '').toLowerCase();
  const isClosed = ['closed', 'completed', 'decided', 'rejected'].includes(normalizedStatus);

  useEffect(() => {
    let cancelled = false;

    const loadReopenRequests = async () => {
      try {
        const response = await api.listReopenRequests(caseId);
        if (!cancelled) {
          setReopenItems(response?.items || response?.data?.items || []);
        }
      } catch (error) {
        if (!cancelled) {
          showError(getErrorMessage(error, 'Failed to load reopen requests'));
        }
      }
    };

    loadReopenRequests();

    return () => {
      cancelled = true;
    };
  }, [caseId, showError]);

  const submitReopen = async (payload) => {
    try {
      setReopenSubmitting(true);
      const response = await api.requestCaseReopen(caseId, payload);
      const item = response?.data || response;
      setReopenItems((prev) => [item, ...prev]);
      showNotification('Reopen request submitted for senior review.', 'success');
    } catch (error) {
      showError(getErrorMessage(error, 'Failed to submit reopen request'));
    } finally {
      setReopenSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card-lg bg-white/50 backdrop-blur-md border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/30">
          <h2 className="text-sm font-black text-navy-900 uppercase tracking-[0.2em] flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-600" />
            Exceptions & Appeals
          </h2>
          <p className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Reopen requests now use the backend senior-review workflow. Decision amendments remain
            read-only here until the amendment endpoint is implemented.
          </p>
        </div>

        <div className="p-6 space-y-8">
          <div className="group relative">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                <FilePenLine className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-black text-navy-900 uppercase tracking-widest">
                Amend Active Determination
              </h3>
            </div>

            <div className="space-y-3 ml-2 pl-6 border-l-2 border-blue-100">
              <p className="text-xs text-gray-600">
                User story `US-036` requires typed amendment records with a preserved amendment
                trail. The current backend exposes amendment history in the dossier and report, but
                it does not yet expose a submission endpoint for new amendments.
              </p>
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-900">
                New amendment submissions stay disabled here so the frontend does not invent
                workflow records that the backend cannot persist or route to the senior inbox.
              </div>
            </div>
          </div>

          <div className="group relative">
            {isClosed ? (
              <ReopenRequestForm onSubmit={submitReopen} submitting={reopenSubmitting} />
            ) : (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-500">
                Reopen requests are available only after a case has reached a decided, rejected, or
                closed state.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card-lg bg-navy-900 border-navy-800 text-white overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-navy-800 flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
            <Gavel className="w-5 h-5 text-emerald-400" />
            Decision History
          </h2>
          <HistoryIcon className="w-4 h-4 text-navy-400" />
        </div>

        <div className="p-6">
          {decisionHistory.length > 0 ? (
            <div className="space-y-4">
              {decisionHistory.map((entry) => (
                <div key={entry.id} className="relative pl-6 pb-2 border-l border-navy-700 last:pb-0">
                  <div className="absolute left-[-5px] top-0 w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <p className="text-[11px] font-black uppercase tracking-widest text-emerald-400">
                      {String(entry.decision_type || 'recorded').replace(/_/g, ' ')}
                    </p>
                    <span className="text-[9px] font-bold text-navy-400 uppercase">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {entry.reason && (
                    <p className="text-xs text-navy-100 font-medium leading-relaxed bg-navy-800/50 p-2.5 rounded-lg border border-navy-800">
                      {entry.reason}
                    </p>
                  )}
                  <p className="text-[9px] text-navy-400 font-bold uppercase tracking-wider mt-2 flex items-center gap-1.5 px-2">
                    <span className="w-1 h-1 rounded-full bg-navy-600" />
                    {entry.actor}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center bg-navy-800/20 rounded-2xl border border-navy-800 border-dashed">
              <CircleAlert className="w-8 h-8 text-navy-700 mx-auto mb-3" />
              <p className="text-xs text-navy-400 font-black uppercase tracking-widest">
                Order Pending
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="card-lg bg-white border-gray-200">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h2 className="text-[10px] font-black text-navy-900 uppercase tracking-widest flex items-center gap-2">
            <History className="w-4 h-4 text-gray-400" />
            Reopen Workflow
          </h2>
        </div>

        <div className="divide-y divide-gray-50">
          {reopenItems.length > 0 ? (
            [...reopenItems]
              .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
              .map((item) => (
                <div key={item.id} className="p-5 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="space-y-1">
                      <p className="text-xs font-black text-navy-900 tracking-tight">
                        {String(item.reason || 'reopen_request').replace(/_/g, ' ')}
                      </p>
                      <p className="text-[11px] font-medium text-gray-500 line-clamp-2">
                        {item.justification}
                      </p>
                    </div>
                    <ReopenStatusBadge status={item.status} />
                  </div>
                  <div className="flex items-center justify-between text-[9px] font-black text-gray-400 uppercase tracking-tighter">
                    <span>Requested by {item.requested_by}</span>
                    <span>{new Date(item.created_at).toLocaleString()}</span>
                  </div>
                  {(item.review_notes || item.reviewed_at) && (
                    <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3 text-[10px] text-gray-600">
                      <p className="font-black uppercase text-navy-400">Review</p>
                      {item.review_notes && (
                        <p className="mt-1 font-medium italic">"{item.review_notes}"</p>
                      )}
                      {item.reviewed_at && (
                        <p className="mt-1 text-gray-400">
                          Reviewed at {new Date(item.reviewed_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))
          ) : (
            <div className="p-10 text-center">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                No reopen requests recorded
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
