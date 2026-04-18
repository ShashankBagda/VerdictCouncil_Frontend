import React, { useEffect, useMemo, useState } from 'react';
import { Search, Shield } from 'lucide-react';
import { useAuth, useAPI } from '../../hooks';
import api, { getErrorMessage } from '../../lib/api';
import {
  applyLocalWorkflowAction,
  getStoredWorkflowItems,
  mergeWorkflowItems,
  normalizeWorkflowItem,
  splitWorkflowItemsBySource,
} from '../../lib/escalationWorkflow';
import EscalationDetailView from '../../components/escalation/EscalationDetailView';

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

  const { local: localItems } = useMemo(
    () => splitWorkflowItemsBySource(items),
    [items],
  );
  const remoteFilteredItems = useMemo(
    () => filteredItems.filter((item) => item.source !== 'local'),
    [filteredItems],
  );

  const selectedItem =
    filteredItems.find((item) => item.id === selectedId) || filteredItems[0] || null;

  useEffect(() => {
    if (selectedItem && selectedItem.id !== selectedId) {
      setSelectedId(selectedItem.id);
    }
  }, [selectedId, selectedItem]);

  const handleAction = async (action, payload = {}) => {
    if (!selectedItem) return;

    const nextReason = payload.reason?.trim() || '';
    const nextAssignee = payload.assignee?.trim() || '';
    const finalOrder = payload.finalOrder?.trim() || '';

    if (
      selectedItem.source === 'local' &&
      (action === 'rejected' || action === 'info_requested') &&
      !nextReason
    ) {
      showError('A written reason is required for this action.');
      return;
    }
    if (selectedItem.source === 'local' && action === 'reassign' && !nextAssignee) {
      showError('Enter a target judge email before reassigning.');
      return;
    }
    if (selectedItem.source !== 'local' && action === 'add_notes' && !nextReason) {
      showError('Add notes requires review notes.');
      return;
    }
    if (selectedItem.source !== 'local' && action === 'manual_decision' && !finalOrder) {
      showError('Manual decision requires a final order.');
      return;
    }
    if (selectedItem.source !== 'local' && action === 'reject' && !nextReason) {
      showError('Reject requires review notes.');
      return;
    }

    try {
      setProcessing(true);

      if (selectedItem.source === 'local') {
        const updated = applyLocalWorkflowAction(
          selectedItem.id,
          action,
          nextReason,
          user?.email || 'senior@local',
          nextAssignee || null,
        );
        setItems((prev) => prev.map((item) => (item.id === selectedItem.id ? updated : item)));
      } else {
        const response = await api.actionOnEscalatedCase(selectedItem.id, {
          action,
          notes: nextReason || undefined,
          final_order: finalOrder || undefined,
        });
        setItems((prev) => {
          if (action !== 'add_notes') {
            return prev.filter((item) => item.id !== selectedItem.id);
          }

          return prev.map((item) =>
            item.id === selectedItem.id
              ? {
                  ...item,
                  status: 'pending',
                  history: [
                    ...(item.history || []),
                    {
                      id: `${item.id}-${Date.now()}`,
                      action,
                      reason: nextReason || response?.message || 'Notes added',
                      actor: user?.email || 'senior-reviewer',
                      created_at: new Date().toISOString(),
                    },
                  ],
                }
              : item,
          );
        });
        showNotification(response?.message || 'Escalation updated successfully.', 'success');
        return;
      }

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
            {localItems.length > 0 && (
              <p className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Local-only review items are visible here for demo continuity, but they are not part of the backend senior-review queue.
              </p>
            )}
          </div>
          <div className="px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            <span className="text-sm font-semibold">{remoteFilteredItems.length} backend items</span>
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
                  <div className="flex items-center gap-2">
                    {item.source === 'local' && (
                      <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                        Local
                      </span>
                    )}
                    <span className="text-xs uppercase text-gray-500">{item.priority}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{item.description}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                  <span>Case {item.case_id}</span>
                  <span>&bull;</span>
                  <span>{item.item_type}</span>
                  <span>&bull;</span>
                  <span>{item.status}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="h-[calc(100vh-280px)] xl:h-auto min-h-[600px]">
          <EscalationDetailView item={selectedItem} onAction={handleAction} processing={processing} />
        </section>
      </div>
    </div>
  );
}
