import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  FilePenLine,
  History,
  Lock,
  Send,
} from 'lucide-react';
import { useAuth, useAPI } from '../../hooks';
import {
  createAmendmentRequest,
  createReopenRequest,
  getCaseDecisionHistory,
  getCaseWorkflowItems,
} from '../../lib/escalationWorkflow';

function HistoryBadge({ itemType, status }) {
  const typeTone =
    itemType === 'amendment'
      ? 'bg-blue-100 text-blue-700'
      : itemType === 'reopen'
        ? 'bg-purple-100 text-purple-700'
        : 'bg-gray-100 text-gray-700';

  const statusTone =
    status === 'approved'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'rejected'
        ? 'bg-rose-100 text-rose-700'
        : 'bg-amber-100 text-amber-700';

  return (
    <div className="flex items-center gap-2">
      <span className={`px-2 py-1 rounded text-xs font-semibold ${typeTone}`}>
        {itemType}
      </span>
      <span className={`px-2 py-1 rounded text-xs font-semibold ${statusTone}`}>
        {status}
      </span>
    </div>
  );
}

export default function CaseExceptionPanel({ caseId, caseDetail }) {
  const { user } = useAuth();
  const { showError, showNotification } = useAPI();
  const [amendReason, setAmendReason] = useState('');
  const [amendDecisionType, setAmendDecisionType] = useState('modify');
  const [reopenReason, setReopenReason] = useState('');
  const [, forceRefresh] = React.useReducer((value) => value + 1, 0);

  const workflowItems = getCaseWorkflowItems(caseId);
  const amendmentItems = workflowItems.filter((item) => item.item_type === 'amendment');
  const reopenItems = workflowItems.filter((item) => item.item_type === 'reopen');
  const decisionHistory = useMemo(() => getCaseDecisionHistory(caseDetail), [caseDetail]);
  const isClosed = ['closed', 'completed'].includes(String(caseDetail?.status || '').toLowerCase());

  const submitAmendment = () => {
    if (!amendReason.trim()) {
      showError('Enter a reason for the amendment request.');
      return;
    }

    createAmendmentRequest(
      caseId,
      {
        title: `Amend decision for case ${caseId}`,
        description: amendReason.trim(),
        details: `Requested action: ${amendDecisionType}`,
        requested_change: amendDecisionType,
        decision_snapshot: decisionHistory[0] || null,
      },
      user?.email || 'judge@local',
    );
    setAmendReason('');
    forceRefresh();
    showNotification('Amendment request added to the review queue.', 'success');
  };

  const submitReopen = () => {
    if (!reopenReason.trim()) {
      showError('Enter a reason for reopening the case.');
      return;
    }

    createReopenRequest(
      caseId,
      {
        title: `Reopen request for case ${caseId}`,
        description: reopenReason.trim(),
        context: caseDetail?.case_description || '',
      },
      user?.email || 'judge@local',
    );
    setReopenReason('');
    forceRefresh();
    showNotification('Reopen request routed to the senior review queue.', 'success');
  };

  return (
    <div className="space-y-4">
      <div className="card-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-navy-900">Exception Workflows</h2>
            <p className="text-sm text-gray-600">
              Submit amendments and reopen requests without leaving the case workspace.
            </p>
          </div>
          <AlertCircle className="w-5 h-5 text-amber-600" />
        </div>

        <div className="space-y-5">
          <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FilePenLine className="w-4 h-4 text-blue-700" />
              <h3 className="font-semibold text-blue-900">Amend Decision</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {['modify', 'reject', 'accept'].map((value) => (
                <button
                  key={value}
                  onClick={() => setAmendDecisionType(value)}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold border ${
                    amendDecisionType === value
                      ? 'border-blue-400 bg-white text-blue-700'
                      : 'border-blue-200 text-blue-800'
                  }`}
                >
                  {value.charAt(0).toUpperCase() + value.slice(1)}
                </button>
              ))}
            </div>
            <textarea
              value={amendReason}
              onChange={(event) => setAmendReason(event.target.value)}
              placeholder="Explain why the recorded decision should be amended"
              className="input-field min-h-24"
            />
            <button
              onClick={submitAmendment}
              className="w-full px-4 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              Submit Amendment Request
            </button>
          </div>

          <div className={`rounded-lg border p-4 space-y-3 ${isClosed ? 'border-purple-200 bg-purple-50/60' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center gap-2">
              {isClosed ? (
                <ArrowRight className="w-4 h-4 text-purple-700" />
              ) : (
                <Lock className="w-4 h-4 text-gray-500" />
              )}
              <h3 className="font-semibold text-navy-900">Reopen Case</h3>
            </div>
            <textarea
              value={reopenReason}
              onChange={(event) => setReopenReason(event.target.value)}
              placeholder={
                isClosed
                  ? 'Explain what changed and why this case should be reopened'
                  : 'Reopen requests are only enabled once the case is closed or completed'
              }
              disabled={!isClosed}
              className="input-field min-h-24"
            />
            <button
              onClick={submitReopen}
              disabled={!isClosed}
              className="w-full px-4 py-2.5 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <ArrowRight className="w-4 h-4" />
              Submit Reopen Request
            </button>
          </div>
        </div>
      </div>

      <div className="card-lg">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-5 h-5 text-navy-900" />
          <h2 className="text-lg font-bold text-navy-900">Decision History</h2>
        </div>

        {decisionHistory.length > 0 ? (
          <div className="space-y-3">
            {decisionHistory.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-navy-900 capitalize">
                    {String(entry.decision_type || 'decision').replace(/_/g, ' ')}
                  </p>
                  <span className="text-xs text-gray-500">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </div>
                {entry.reason && (
                  <p className="text-sm text-gray-700 mt-2">{entry.reason}</p>
                )}
                <p className="text-xs text-gray-500 mt-2">Recorded by {entry.actor}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-600">No decision history is available for this case yet.</p>
        )}
      </div>

      <div className="card-lg">
        <h2 className="text-lg font-bold text-navy-900 mb-4">Request History</h2>
        {workflowItems.length > 0 ? (
          <div className="space-y-3">
            {[...amendmentItems, ...reopenItems]
              .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
              .map((item) => (
                <div key={item.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-navy-900">{item.title}</p>
                      <p className="text-sm text-gray-700 mt-1">{item.description}</p>
                    </div>
                    <HistoryBadge itemType={item.item_type} status={item.status} />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Submitted by {item.submitter} on {new Date(item.submitted_at).toLocaleString()}
                  </p>
                  {item.history?.length > 1 && (
                    <div className="mt-3 space-y-2">
                      {item.history.slice(1).map((entry) => (
                        <div key={entry.id} className="rounded bg-gray-50 px-3 py-2 text-xs text-gray-600">
                          <span className="font-semibold capitalize">{entry.action}</span>
                          {entry.reason ? ` • ${entry.reason}` : ''}
                          {entry.assignee ? ` • Assigned to ${entry.assignee}` : ''}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </div>
        ) : (
          <p className="text-sm text-gray-600">No amendment or reopen requests have been created for this case.</p>
        )}
      </div>
    </div>
  );
}
