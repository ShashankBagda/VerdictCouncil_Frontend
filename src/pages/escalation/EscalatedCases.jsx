import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, Filter } from 'lucide-react';
import { useAuth, useAPI } from '../../hooks';
import api, { getErrorMessage } from '../../lib/api';
import {
  buildWorkflowCounts,
  normalizeWorkflowItem,
} from '../../lib/escalationWorkflow';
import EscalationDetailView from '../../components/escalation/EscalationDetailView';

const TYPE_META = {
  escalation: { label: 'Escalation', tone: 'bg-rose-100 text-rose-700', icon: AlertCircle },
  reopen: { label: 'Reopen', tone: 'bg-purple-100 text-purple-700', icon: ArrowRight },
};

const STATUS_META = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
  info_requested: 'bg-violet-100 text-violet-700',
};

function ItemCard({ item, onAction, processingId }) {
  const [expanded, setExpanded] = useState(false);
  const typeMeta = TYPE_META[item.item_type] || TYPE_META.escalation;
  const TypeIcon = typeMeta.icon;

  return (
    <div className={`group relative transition-all ${expanded ? 'bg-white shadow-xl ring-1 ring-gray-100' : 'bg-transparent'} rounded-2xl`}>
      <div 
        onClick={() => setExpanded(!expanded)}
        className="card-lg cursor-pointer border-gray-200 hover:border-teal-300 transition-colors flex items-center justify-between gap-4"
      >
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl bg-white border border-gray-100 group-hover:bg-teal-50 group-hover:border-teal-100 transition-colors`}>
            <TypeIcon className="w-5 h-5 text-navy-900" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${typeMeta.tone}`}>
                {typeMeta.label}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${STATUS_META[item.status] || STATUS_META.pending}`}>
                {item.status}
              </span>
              {item.source === 'local' && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800">
                  Local Only
                </span>
              )}
            </div>
            <h3 className="text-base font-black text-navy-900 tracking-tight">{item.title || `Case ${item.case_id}`}</h3>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{new Date(item.submitted_at).toLocaleDateString()}</p>
            <p className="text-xs font-bold text-gray-500">{item.submitter}</p>
          </div>
          <div className={`px-2 py-1 rounded-lg border text-[9px] font-black uppercase tracking-tighter ${
            item.priority === 'urgent' ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-gray-100 bg-gray-50 text-gray-400'
          }`}>
            {item.priority}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-6 pb-6 animate-in slide-in-from-top-2 duration-200">
           <div className="pt-4 border-t border-gray-100">
              <EscalationDetailView 
                item={item}
                onAction={(action, payload) => onAction(item, action, payload)}
                processing={processingId === item.id}
              />
           </div>
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
        setItems(remoteItems);
      } catch (err) {
        showError(getErrorMessage(err, 'Failed to fetch escalated cases'));
      } finally {
        setLoading(false);
      }
    };

    fetchInbox();
  }, [showError]);

  const remoteCounts = useMemo(() => buildWorkflowCounts(items), [items]);
  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (filters.type !== 'all' && item.item_type !== filters.type) return false;
        if (filters.status !== 'all' && item.status !== filters.status) return false;
        return true;
      }),
    [filters, items],
  );

  const handleAction = async (item, action, payload = {}) => {
    const reason = payload.reason?.trim() || '';
    const finalOrder = payload.finalOrder?.trim() || '';

    if (item.source !== 'local' && action === 'add_notes' && !reason) {
      showError('Add notes requires review notes.');
      return;
    }
    if (item.source !== 'local' && action === 'manual_decision' && !finalOrder) {
      showError('Manual decision requires a final order.');
      return;
    }
    if (item.source !== 'local' && action === 'reject' && !reason) {
      showError('Reject requires review notes.');
      return;
    }

    try {
      setProcessingId(item.id);

      const response = await api.actionOnEscalatedCase(item.case_id, {
        action,
        notes: reason || undefined,
        final_order: finalOrder || undefined,
      });
      setItems((prev) => {
        if (action !== 'add_notes') {
          return prev.filter((entry) => entry.id !== item.id);
        }

        return prev.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                status: 'pending',
                history: [
                  ...(entry.history || []),
                  {
                    id: `${entry.id}-${Date.now()}`,
                    action,
                    reason: reason || response?.message || 'Notes added',
                    actor: user?.email || 'reviewer',
                    created_at: new Date().toISOString(),
                  },
                ],
              }
            : entry,
        );
      });
      showNotification(response?.message || 'Escalation updated successfully.', 'success');
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
          Review the backend escalation queue raised by routing or governance concerns.
        </p>
      </div>

      <div className="card-lg space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-600" />
          <h2 className="font-semibold text-navy-900">Filters</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: `All (${remoteCounts.all})` },
            { key: 'escalation', label: `Escalations (${remoteCounts.escalation})` },
            { key: 'reopen', label: `Reopen (${remoteCounts.reopen})` },
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
