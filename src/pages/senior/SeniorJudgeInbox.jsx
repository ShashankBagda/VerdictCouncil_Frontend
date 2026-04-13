import React, { useState, useEffect } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Send,
  ArrowRight,
  MessageSquare,
  Clock,
  User,
} from 'lucide-react';
import { useAPI } from '../../hooks';
import api from '../../lib/api';

const STATUS_COLORS = {
  pending: { badge: 'bg-amber-100 text-amber-700', icon: 'text-amber-600' },
  approved: { badge: 'bg-emerald-100 text-emerald-700', icon: 'text-emerald-600' },
  rejected: { badge: 'bg-rose-100 text-rose-700', icon: 'text-rose-600' },
};

const ITEM_TYPE_ICONS = {
  escalation: { icon: AlertCircle, color: 'text-rose-600', label: 'Escalation' },
  amendment: { icon: MessageSquare, color: 'text-blue-600', label: 'Amendment' },
  reopen: { icon: ArrowRight, color: 'text-purple-600', label: 'Reopen Request' },
};

export default function SeniorJudgeInbox() {
  const { showError, showNotification } = useAPI();

  // State
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [actionForm, setActionForm] = useState({});
  const [processingId, setProcessingId] = useState(null);
  const [filters, setFilters] = useState({
    type: 'all', // all, escalation, amendment, reopen
    status: 'all', // all, pending, approved, rejected
  });

  // Fetch inbox on mount
  useEffect(() => {
    const fetchInbox = async () => {
      try {
        setLoading(true);
        const res = await api.getSeniorInbox();
        setItems(res.data.items || []);
      } catch (err) {
        const msg = err.response?.data?.detail || 'failed to fetch inbox';
        showError(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchInbox();
  }, [showError]);

  // Toggle expansion
  const toggleExpand = (id) => {
    setExpanded((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Handle action submission
  const handleAction = async (itemId, action, reason = '') => {
    try {
      setProcessingId(itemId);
      await api.actionOnInbox(itemId, action, reason);

      // Update local state
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, status: action === 'reject' ? 'rejected' : action } : item
        )
      );

      setActionForm({}); // Clear form
      showNotification(`Item ${action}ed successfully`, 'success');
    } catch (err) {
      const msg = err.response?.data?.detail || `failed to ${action} item`;
      showError(msg);
    } finally {
      setProcessingId(null);
    }
  };

  // Filter items
  const filteredItems = items.filter((item) => {
    if (filters.type !== 'all' && item.item_type !== filters.type) return false;
    if (filters.status !== 'all' && item.status !== filters.status) return false;
    return true;
  });

  // Filter counts
  const counts = {
    all: items.length,
    escalation: items.filter((i) => i.item_type === 'escalation').length,
    amendment: items.filter((i) => i.item_type === 'amendment').length,
    reopen: items.filter((i) => i.item_type === 'reopen').length,
  };

  if (loading) {
    return (
      <div className="card-lg flex items-center justify-center h-96">
        <div className="text-center">
          <div className="spinner w-8 h-8 mx-auto mb-4" />
          <p className="text-gray-600">Loading inbox items...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card-lg">
        <h1 className="text-3xl font-bold text-navy-900 mb-2">Senior Judge Inbox</h1>
        <p className="text-gray-600">Review escalations, amendments, and reopen requests</p>
      </div>

      {/* Filter Tabs */}
      <div className="card-lg space-y-4">
        <h3 className="font-bold text-navy-900">Filter by Type</h3>

        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'All Items', count: counts.all },
            { key: 'escalation', label: 'Escalations', count: counts.escalation },
            { key: 'amendment', label: 'Amendments', count: counts.amendment },
            { key: 'reopen', label: 'Reopen Requests', count: counts.reopen },
          ].map((filterOption) => (
            <button
              key={filterOption.key}
              onClick={() => setFilters((prev) => ({ ...prev, type: filterOption.key }))}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                filters.type === filterOption.key
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filterOption.label} ({filterOption.count})
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 border-t pt-4">
          <h3 className="w-full font-bold text-navy-900">Filter by Status</h3>
          {[
            { key: 'all', label: 'All Statuses' },
            { key: 'pending', label: 'Pending' },
            { key: 'approved', label: 'Approved' },
            { key: 'rejected', label: 'Rejected' },
          ].map((statusOption) => (
            <button
              key={statusOption.key}
              onClick={() => setFilters((prev) => ({ ...prev, status: statusOption.key }))}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                filters.status === statusOption.key
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {statusOption.label}
            </button>
          ))}
        </div>
      </div>

      {/* Items List */}
      <div className="space-y-4">
        {filteredItems.length === 0 ? (
          <div className="card-lg text-center py-12">
            <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No items match your filters</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isExpanded = expanded[item.id];
            const TypeIcon = ITEM_TYPE_ICONS[item.item_type]?.icon || AlertCircle;
            const typeConfig = ITEM_TYPE_ICONS[item.item_type] || { color: 'text-gray-600', label: 'Item' };
            const statusConfig = STATUS_COLORS[item.status] || STATUS_COLORS.pending;

            return (
              <div key={item.id} className="card-lg border border-gray-200">
                {/* Header */}
                <button
                  onClick={() => toggleExpand(item.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <TypeIcon className={`w-5 h-5 ${typeConfig.color} flex-shrink-0 mt-1`} />

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-navy-900">{item.title || item.case_id}</h3>
                          <span className={`px-2 py-1 text-xs font-semibold rounded ${statusConfig.badge}`}>
                            {item.status?.toUpperCase() || 'PENDING'}
                          </span>
                          <span className="px-2 py-1 text-xs font-semibold rounded bg-gray-200 text-gray-700">
                            {typeConfig.label}
                          </span>
                        </div>

                        <p className="text-sm text-gray-600 mb-2">{item.description}</p>

                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          {item.submitter && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {item.submitter}
                            </span>
                          )}
                          {item.submitted_at && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(item.submitted_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button className="p-2 hover:bg-gray-100 rounded flex-shrink-0">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-600" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-600" />
                      )}
                    </button>
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t pt-4 mt-4 space-y-4">
                    {/* Context Information */}
                    {item.context && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-semibold text-navy-900 mb-2 text-sm">Context</h4>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.context}</p>
                      </div>
                    )}

                    {/* Evidence/Details */}
                    {item.details && (
                      <div>
                        <h4 className="font-semibold text-navy-900 mb-2 text-sm">Details</h4>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.details}</p>
                      </div>
                    )}

                    {/* Action Form */}
                    {item.status === 'pending' && (
                      <div className="border-t pt-4 space-y-3">
                        <h4 className="font-semibold text-navy-900 text-sm">Actions</h4>

                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => handleAction(item.id, 'approved')}
                            disabled={processingId === item.id}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 text-sm"
                          >
                            {processingId === item.id ? (
                              <div className="spinner w-4 h-4" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                            Approve
                          </button>

                          <button
                            onClick={() => {
                              setActionForm((prev) => ({
                                ...prev,
                                [item.id]: { ...prev[item.id], showRejectForm: true },
                              }));
                            }}
                            className="px-4 py-2 bg-rose-600 text-white rounded-lg font-semibold hover:bg-rose-700 flex items-center gap-2 text-sm"
                          >
                            <XCircle className="w-4 h-4" />
                            Reject
                          </button>

                          <button
                            onClick={() => {
                              setActionForm((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...prev[item.id],
                                  showReassignForm: true,
                                },
                              }));
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 flex items-center gap-2 text-sm"
                          >
                            <ArrowRight className="w-4 h-4" />
                            Reassign
                          </button>

                          <button
                            onClick={() => {
                              setActionForm((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...prev[item.id],
                                  showInfoForm: true,
                                },
                              }));
                            }}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 flex items-center gap-2 text-sm"
                          >
                            <MessageSquare className="w-4 h-4" />
                            Request Info
                          </button>
                        </div>

                        {/* Reject Form */}
                        {actionForm[item.id]?.showRejectForm && (
                          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 space-y-2">
                            <label className="block text-sm font-semibold text-rose-900">
                              Rejection Reason
                            </label>
                            <textarea
                              value={actionForm[item.id]?.rejectReason || ''}
                              onChange={(e) =>
                                setActionForm((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    ...prev[item.id],
                                    rejectReason: e.target.value,
                                  },
                                }))
                              }
                              placeholder="Explain why this request is being rejected..."
                              className="input-field min-h-20"
                            />

                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  handleAction(
                                    item.id,
                                    'rejected',
                                    actionForm[item.id]?.rejectReason || ''
                                  )
                                }
                                disabled={processingId === item.id}
                                className="flex-1 px-4 py-2 bg-rose-600 text-white rounded-lg font-semibold hover:bg-rose-700 disabled:opacity-50 text-sm"
                              >
                                Confirm Rejection
                              </button>
                              <button
                                onClick={() =>
                                  setActionForm((prev) => ({
                                    ...prev,
                                    [item.id]: { ...prev[item.id], showRejectForm: false },
                                  }))
                                }
                                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-400 text-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Request Info Form */}
                        {actionForm[item.id]?.showInfoForm && (
                          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-2">
                            <label className="block text-sm font-semibold text-purple-900">
                              Information Request
                            </label>
                            <textarea
                              value={actionForm[item.id]?.infoRequest || ''}
                              onChange={(e) =>
                                setActionForm((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    ...prev[item.id],
                                    infoRequest: e.target.value,
                                  },
                                }))
                              }
                              placeholder="What additional information is needed?"
                              className="input-field min-h-20"
                            />

                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  handleAction(
                                    item.id,
                                    'info_requested',
                                    actionForm[item.id]?.infoRequest || ''
                                  )
                                }
                                disabled={processingId === item.id}
                                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 text-sm"
                              >
                                Send Request
                              </button>
                              <button
                                onClick={() =>
                                  setActionForm((prev) => ({
                                    ...prev,
                                    [item.id]: { ...prev[item.id], showInfoForm: false },
                                  }))
                                }
                                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-400 text-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Completed Status Message */}
                    {item.status !== 'pending' && (
                      <div
                        className={`p-3 rounded-lg text-center ${
                          item.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        <p className="font-semibold text-sm">
                          {item.status === 'approved'
                            ? 'This request has been approved'
                            : 'This request has been rejected'}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
