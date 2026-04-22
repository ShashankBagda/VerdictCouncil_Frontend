import React, { useEffect, useMemo, useState } from 'react';
import { Search, Shield } from 'lucide-react';
import { useAuth, useAPI } from '../../hooks';
import api, { getErrorMessage } from '../../lib/api';
import EscalationDetailView from '../../components/escalation/EscalationDetailView';
import { normalizeWorkflowItem } from '../../lib/escalationWorkflow';

const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };

const rankedItems = (items) =>
  [...items].sort((a, b) => {
    const priorityDiff =
      (PRIORITY_ORDER[a.priority] ?? PRIORITY_ORDER.medium) -
      (PRIORITY_ORDER[b.priority] ?? PRIORITY_ORDER.medium);
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(a.submitted_at || 0).getTime() - new Date(b.submitted_at || 0).getTime();
  });

const parseBackendId = (backendId) => {
  const [type, id] = String(backendId || '').split(':');
  return { type, id };
};

const formatLabel = (value) =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());

export default function SeniorJudgeInbox() {
  const { user } = useAuth();
  const { showError, showNotification } = useAPI();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [typeFilter, setTypeFilter] = useState('all');
  const [judgeFilter, setJudgeFilter] = useState('all');
  const [domainFilter, setDomainFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const fetchInbox = async () => {
      try {
        setLoading(true);
        const res = await api.getSeniorInbox();
        const remoteItems = (res?.items || res?.data?.items || []).map(normalizeWorkflowItem);
        const merged = rankedItems(remoteItems);
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
          if (judgeFilter !== 'all' && item.submitter !== judgeFilter) return false;
          if (domainFilter !== 'all' && item.domain !== domainFilter) return false;
          if (
            search.trim() &&
            !`${item.title} ${item.description} ${item.case_id} ${item.submitter} ${item.domain || ''}`
              .toLowerCase()
              .includes(search.trim().toLowerCase())
          ) {
            return false;
          }
          return true;
        }),
      ),
    [domainFilter, items, judgeFilter, search, statusFilter, typeFilter],
  );

  const judgeOptions = useMemo(
    () =>
      [...new Set(items.map((item) => item.submitter).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [items],
  );

  const domainOptions = useMemo(
    () =>
      [...new Set(items.map((item) => item.domain).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [items],
  );

  const selectedItem =
    filteredItems.find((item) => item.id === selectedId) || filteredItems[0] || null;

  useEffect(() => {
    if (selectedItem && selectedItem.id !== selectedId) {
      setSelectedId(selectedItem.id);
    }
  }, [selectedId, selectedItem]);

  const applyLocalUpdate = (itemId, nextStatus, reason, action) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              status: nextStatus,
              history: [
                ...(item.history || []),
                {
                  id: `${item.id}-${Date.now()}`,
                  action,
                  reason,
                  actor: user?.email || 'senior-reviewer',
                  created_at: new Date().toISOString(),
                },
              ],
            }
          : item,
      ),
    );
  };

  const handleAction = async (action, payload = {}) => {
    if (!selectedItem) return;

    const reason = payload.reason?.trim() || '';
    const finalOrder = payload.finalOrder?.trim() || '';

    try {
      setProcessing(true);

      if (selectedItem.item_type === 'escalation') {
        await api.actionOnEscalatedCase(selectedItem.case_id, {
          action,
          notes: reason || undefined,
          final_order: finalOrder || undefined,
        });
        const nextStatus = action === 'add_notes' ? 'pending' : action === 'reject' ? 'rejected' : 'approved';
        applyLocalUpdate(selectedItem.id, nextStatus, reason || action, action);
        showNotification('Escalation updated successfully.', 'success');
        return;
      }

      if (selectedItem.item_type === 'reopen') {
        if (!['approved', 'rejected'].includes(action)) {
          showError('Reopen requests only support approve/reject actions.');
          return;
        }
        const parsed = parseBackendId(selectedItem.backendId);
        if (parsed.type !== 'reopen' || !parsed.id) {
          throw new Error('Invalid reopen request id');
        }
        const approve = action === 'approved';
        if (!approve && !reason) {
          showError('Please provide a reason when rejecting a reopen request.');
          return;
        }
        await api.reviewReopenRequest(selectedItem.case_id, parsed.id, {
          approve,
          review_notes: reason || undefined,
        });
        applyLocalUpdate(selectedItem.id, approve ? 'approved' : 'rejected', reason, action);
        showNotification(`Reopen request ${approve ? 'approved' : 'rejected'}.`, 'success');
        return;
      }

      showError('Decision amendment approvals are not exposed by the backend yet.');
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
            <span className="text-sm font-semibold">{filteredItems.length} backend items</span>
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <select
              value={judgeFilter}
              onChange={(event) => setJudgeFilter(event.target.value)}
              className="input-field"
            >
              <option value="all">All originating judges</option>
              {judgeOptions.map((judge) => (
                <option key={judge} value={judge}>
                  {judge}
                </option>
              ))}
            </select>

            <select
              value={domainFilter}
              onChange={(event) => setDomainFilter(event.target.value)}
              className="input-field"
            >
              <option value="all">All domains</option>
              {domainOptions.map((domain) => (
                <option key={domain} value={domain}>
                  {formatLabel(domain)}
                </option>
              ))}
            </select>
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
                  <span>&bull;</span>
                  <span>{item.item_type}</span>
                  <span>&bull;</span>
                  <span>{item.status}</span>
                  {item.domain && (
                    <>
                      <span>&bull;</span>
                      <span>{formatLabel(item.domain)}</span>
                    </>
                  )}
                </div>
                <div className="mt-1 text-[11px] text-gray-500">
                  Originating judge: {item.submitter}
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
