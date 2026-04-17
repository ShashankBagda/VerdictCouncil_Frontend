import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  MessageSquare,
  Search,
  Shield,
  XCircle,
} from 'lucide-react';
import { useAuth, useAPI } from '../../hooks';
import api, { getErrorMessage } from '../../lib/api';
import {
  applyLocalWorkflowAction,
  getStoredWorkflowItems,
  mergeWorkflowItems,
  normalizeWorkflowItem,
} from '../../lib/escalationWorkflow';

const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };

const rankedItems = (items) =>
  [...items].sort((a, b) => {
    const priorityDiff =
      (PRIORITY_ORDER[a.priority] ?? PRIORITY_ORDER.medium) -
      (PRIORITY_ORDER[b.priority] ?? PRIORITY_ORDER.medium);
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime();
  });

export default function SeniorJudgeInbox() {
  const { user } = useAuth();
  const { showError, showNotification } = useAPI();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [reason, setReason] = useState('');
  const [assignee, setAssignee] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const fetchInbox = async () => {
      try {
        setLoading(true);
        const res = await api.getEscalatedCases();
        const remoteItems = (res?.data?.items || res?.items || []).map(normalizeWorkflowItem);
        const localItems = getStoredWorkflowItems();
        const merged = rankedItems(mergeWorkflowItems(remoteItems, localItems));
        setItems(merged);
        setSelectedId(merged[0]?.id || null);
      } catch (error) {
        showError(getErrorMessage(error, 'Failed to load senior judge inbox'));
      } finally {
        setLoading(false);
      }
    };

    fetchInbox();
  }, [showError]);

  const filteredItems = useMemo(
    () =>
      rankedItems(
        items.filter((item) => {
          if (statusFilter !== 'all' && item.status !== statusFilter) return false;
          if (typeFilter !== 'all' && item.item_type !== typeFilter) return false;
          if (
            search.trim() &&
            !`${item.title} ${item.description} ${item.case_id}`.toLowerCase().includes(search.trim().toLowerCase())
          ) {
            return false;
          }
          return true;
        }),
      ),
    [items, search, statusFilter, typeFilter],
  );

  const selectedItem = filteredItems.find((item) => item.id === selectedId) || filteredItems[0] || null;

  useEffect(() => {
    if (selectedItem && selectedItem.id !== selectedId) {
      setSelectedId(selectedItem.id);
    }
  }, [selectedId, selectedItem]);

  const handleAction = async (action) => {
    if (!selectedItem) return;
    if ((action === 'rejected' || action === 'info_requested') && !reason.trim()) {
      showError('A written reason is required for this action.');
      return;
    }
    if (action === 'reassign' && !assignee.trim()) {
      showError('Enter a target judge email before reassigning.');
      return;
    }

    try {
      setProcessing(true);
      if (selectedItem.source === 'local') {
        const updated = applyLocalWorkflowAction(
          selectedItem.id,
          action,
          reason.trim(),
          user?.email || 'senior@local',
          assignee.trim() || null,
        );
        setItems((prev) => prev.map((item) => (item.id === selectedItem.id ? updated : item)));
      } else {
        await api.actionOnEscalatedCase(selectedItem.id, action, reason.trim());
        setItems((prev) =>
          prev.map((item) =>
            item.id === selectedItem.id
              ? {
                  ...item,
                  status: action === 'reassign' || action === 'info_requested' ? 'pending' : action,
                  assignee: assignee.trim() || item.assignee || null,
                  history: [
                    ...(item.history || []),
                    {
                      id: `${item.id}-${Date.now()}`,
                      action,
                      reason: reason.trim(),
                      actor: user?.email || 'senior-reviewer',
                      assignee: assignee.trim() || null,
                      created_at: new Date().toISOString(),
                    },
                  ],
                }
              : item,
          ),
        );
      }

      setReason('');
      setAssignee('');
      showNotification(`Request ${action.replace(/_/g, ' ')} successfully.`, 'success');
    } catch (error) {
      showError(getErrorMessage(error, `Failed to ${action.replace(/_/g, ' ')} request`));
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="card-lg flex items-center justify-center h-96">
        <div className="spinner w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-navy-900">Senior Judge Inbox</h1>
            <p className="text-gray-600 mt-2">
              Ranked senior-review queue for escalations, amendments, and reopen requests.
            </p>
          </div>
          <div className="px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            <span className="text-sm font-semibold">{filteredItems.length} active items</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-6">
        <aside className="card-lg space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search case or request"
              className="input-field pl-10"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {['all', 'pending', 'approved', 'rejected'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                  statusFilter === status ? 'bg-navy-900 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {['all', 'escalation', 'amendment', 'reopen'].map((type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                  typeFilter === type ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`w-full text-left rounded-lg border p-3 transition-colors ${
                  selectedItem?.id === item.id
                    ? 'border-teal-300 bg-teal-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-navy-900 truncate">{item.title}</p>
                  <span className="text-xs uppercase text-gray-500">{item.priority}</span>
                </div>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{item.description}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                  <span>Case {item.case_id}</span>
                  <span>•</span>
                  <span>{item.item_type}</span>
                  <span>•</span>
                  <span>{item.status}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="card-lg">
          {selectedItem ? (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs font-semibold">
                    Case {selectedItem.case_id}
                  </span>
                  <span className="px-2 py-1 rounded bg-amber-100 text-amber-700 text-xs font-semibold capitalize">
                    {selectedItem.priority}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-navy-900">{selectedItem.title}</h2>
                <p className="text-gray-700 mt-2">{selectedItem.description}</p>
              </div>

              {(selectedItem.context || selectedItem.details) && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                  {selectedItem.context && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Context</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedItem.context}</p>
                    </div>
                  )}
                  {selectedItem.details && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Details</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedItem.details}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-lg border border-gray-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Submitted by</p>
                  <p className="text-sm text-navy-900">{selectedItem.submitter}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(selectedItem.submitted_at).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Assigned reviewer</p>
                  <p className="text-sm text-navy-900">{selectedItem.assignee || 'Unassigned'}</p>
                  <p className="text-xs text-gray-500 mt-2">Source: {selectedItem.source}</p>
                </div>
              </div>

              <div className="space-y-3">
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Reason for reject or request-info actions"
                  className="input-field min-h-28"
                />
                <input
                  value={assignee}
                  onChange={(event) => setAssignee(event.target.value)}
                  placeholder="Judge email for reassignment"
                  className="input-field"
                />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <button
                    onClick={() => handleAction('approved')}
                    disabled={processing}
                    className="px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => handleAction('rejected')}
                    disabled={processing}
                    className="px-4 py-2.5 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                  <button
                    onClick={() => handleAction('info_requested')}
                    disabled={processing}
                    className="px-4 py-2.5 rounded-lg bg-violet-600 text-white font-semibold hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Request Info
                  </button>
                  <button
                    onClick={() => handleAction('reassign')}
                    disabled={processing}
                    className="px-4 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <ArrowRight className="w-4 h-4" />
                    Reassign
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-navy-900 mb-3">Review History</h3>
                {selectedItem.history?.length ? (
                  <div className="space-y-2">
                    {selectedItem.history.map((entry) => (
                      <div key={entry.id} className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                        <p className="text-sm font-semibold text-navy-900 capitalize">
                          {entry.action.replace(/_/g, ' ')}
                        </p>
                        {entry.reason && <p className="text-sm text-gray-700 mt-1">{entry.reason}</p>}
                        <p className="text-xs text-gray-500 mt-2">
                          {entry.actor} • {new Date(entry.created_at).toLocaleString()}
                          {entry.assignee ? ` • Assigned to ${entry.assignee}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-gray-500">
                    No review history yet.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-center text-gray-500">
              <div>
                <AlertCircle className="w-8 h-8 mx-auto mb-3" />
                <p>No inbox item matches the current filters.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
