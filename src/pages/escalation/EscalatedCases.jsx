import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  Clock,
  Filter,
  MessageSquare,
  User,
  XCircle,
} from 'lucide-react';
import { useAuth, useAPI } from '../../hooks';
import api, { getErrorMessage } from '../../lib/api';
import {
  applyLocalWorkflowAction,
  buildWorkflowCounts,
  getStoredWorkflowItems,
  mergeWorkflowItems,
  normalizeWorkflowItem,
} from '../../lib/escalationWorkflow';

const TYPE_META = {
  escalation: { label: 'Escalation', tone: 'bg-rose-100 text-rose-700', icon: AlertCircle },
  amendment: { label: 'Amendment', tone: 'bg-blue-100 text-blue-700', icon: MessageSquare },
  reopen: { label: 'Reopen', tone: 'bg-purple-100 text-purple-700', icon: ArrowRight },
};

const STATUS_META = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
  info_requested: 'bg-violet-100 text-violet-700',
};

function ItemCard({ item, onAction, processingId }) {
  const [reason, setReason] = useState('');
  const [assignee, setAssignee] = useState('');
  const typeMeta = TYPE_META[item.item_type] || TYPE_META.escalation;
  const TypeIcon = typeMeta.icon;

  return (
    <div className="card-lg border border-gray-200">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <TypeIcon className="w-5 h-5 mt-1 text-navy-900" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-navy-900">{item.title || `Case ${item.case_id}`}</h3>
              <span className={`px-2 py-1 rounded text-xs font-semibold ${typeMeta.tone}`}>
                {typeMeta.label}
              </span>
              <span className={`px-2 py-1 rounded text-xs font-semibold ${STATUS_META[item.status] || STATUS_META.pending}`}>
                {item.status}
              </span>
            </div>
            <p className="text-sm text-gray-700 mt-2">{item.description}</p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-3">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {item.submitter}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(item.submitted_at).toLocaleString()}
              </span>
              {item.assignee && <span>Assigned to {item.assignee}</span>}
            </div>
          </div>
        </div>
      </div>

      {(item.context || item.details) && (
        <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm text-gray-700 space-y-2">
          {item.context && <p>{item.context}</p>}
          {item.details && <p>{item.details}</p>}
        </div>
      )}

      {item.status === 'pending' && (
        <div className="mt-4 space-y-3">
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason or note for this action"
            className="input-field min-h-24"
          />
          <input
            value={assignee}
            onChange={(event) => setAssignee(event.target.value)}
            placeholder="Optional assignee email for reassign"
            className="input-field"
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <button
              onClick={() => onAction(item, 'approved', reason)}
              disabled={processingId === item.id}
              className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Approve
            </button>
            <button
              onClick={() => onAction(item, 'rejected', reason)}
              disabled={processingId === item.id || !reason.trim()}
              className="px-3 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <XCircle className="w-4 h-4" />
              Reject
            </button>
            <button
              onClick={() => onAction(item, 'info_requested', reason)}
              disabled={processingId === item.id || !reason.trim()}
              className="px-3 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              Request Info
            </button>
            <button
              onClick={() => onAction(item, 'reassign', reason, assignee)}
              disabled={processingId === item.id || !assignee.trim()}
              className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <ArrowRight className="w-4 h-4" />
              Reassign
            </button>
          </div>
        </div>
      )}

      {item.history?.length > 1 && (
        <div className="mt-4 border-t pt-3 space-y-2">
          {item.history.slice(1).map((entry) => (
            <div key={entry.id} className="text-xs text-gray-600 bg-gray-50 rounded px-3 py-2">
              <span className="font-semibold capitalize">{entry.action}</span>
              {entry.reason ? ` • ${entry.reason}` : ''}
              {entry.assignee ? ` • Assigned to ${entry.assignee}` : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EscalatedCases() {
  const { showError, showNotification } = useAPI();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [filters, setFilters] = useState({ type: 'all', status: 'all' });

  useEffect(() => {
    const fetchInbox = async () => {
      try {
        setLoading(true);
        const res = await api.getEscalatedCases();
        const remoteItems = (res?.data?.items || res?.items || []).map(normalizeWorkflowItem);
        const localItems = getStoredWorkflowItems();
        setItems(mergeWorkflowItems(remoteItems, localItems));
      } catch (err) {
        showError(getErrorMessage(err, 'Failed to fetch escalated cases'));
      } finally {
        setLoading(false);
      }
    };

    fetchInbox();
  }, [showError]);

  const counts = useMemo(() => buildWorkflowCounts(items), [items]);
  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (filters.type !== 'all' && item.item_type !== filters.type) return false;
        if (filters.status !== 'all' && item.status !== filters.status) return false;
        return true;
      }),
    [filters, items],
  );

  const handleAction = async (item, action, reason = '', assignee = '') => {
    try {
      setProcessingId(item.id);

      if (item.source === 'local') {
        const updated = applyLocalWorkflowAction(item.id, action, reason, user?.email || 'senior@local', assignee);
        setItems((prev) => prev.map((entry) => (entry.id === item.id ? updated : entry)));
      } else {
        await api.actionOnEscalatedCase(item.id, action, reason);
        setItems((prev) =>
          prev.map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  status: action === 'reassign' || action === 'info_requested' ? 'pending' : action,
                  assignee: assignee || entry.assignee || null,
                  history: [
                    ...(entry.history || []),
                    {
                      id: `${entry.id}-${Date.now()}`,
                      action,
                      reason,
                      actor: user?.email || 'reviewer',
                      assignee: assignee || null,
                      created_at: new Date().toISOString(),
                    },
                  ],
                }
              : entry,
          ),
        );
      }

      showNotification(`Request ${action.replace(/_/g, ' ')} successfully.`, 'success');
    } catch (err) {
      showError(getErrorMessage(err, `Failed to ${action.replace(/_/g, ' ')} request`));
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="card-lg flex items-center justify-center h-96">
        <div className="text-center">
          <div className="spinner w-8 h-8 mx-auto mb-4" />
          <p className="text-gray-600">Loading escalated cases...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card-lg">
        <h1 className="text-3xl font-bold text-navy-900 mb-2">Escalated Cases</h1>
        <p className="text-gray-600">
          Review escalations, amendment requests, and reopen requests across the current queue.
        </p>
      </div>

      <div className="card-lg space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-600" />
          <h2 className="font-semibold text-navy-900">Filters</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: `All (${counts.all})` },
            { key: 'escalation', label: `Escalations (${counts.escalation})` },
            { key: 'amendment', label: `Amendments (${counts.amendment})` },
            { key: 'reopen', label: `Reopen (${counts.reopen})` },
          ].map((option) => (
            <button
              key={option.key}
              onClick={() => setFilters((prev) => ({ ...prev, type: option.key }))}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                filters.type === option.key ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {['all', 'pending', 'approved', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setFilters((prev) => ({ ...prev, status }))}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                filters.status === status ? 'bg-navy-900 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onAction={handleAction}
              processingId={processingId}
            />
          ))
        ) : (
          <div className="card-lg text-center py-12">
            <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No escalation items match the current filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
