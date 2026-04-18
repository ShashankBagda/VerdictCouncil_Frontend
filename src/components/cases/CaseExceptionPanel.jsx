import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  FilePenLine,
  History,
  Lock,
  Send,
  ShieldCheck,
  History as HistoryIcon,
  CircleAlert,
  Gavel
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
      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${typeTone}`}>
        {itemType}
      </span>
      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${statusTone}`}>
        {status}
      </span>
    </div>
  );
}

function SourceBadge({ source }) {
  if (source !== 'local') return null;

  return (
    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800">
      Local Only
    </span>
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
        priority: 'high'
      },
      user?.email || 'judge@local',
    );
    setAmendReason('');
    forceRefresh();
    showNotification('Amendment request saved to the local review queue only.', 'success');
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
        priority: 'urgent'
      },
      user?.email || 'judge@local',
    );
    setReopenReason('');
    forceRefresh();
    showNotification('Reopen request saved to the local senior-review queue only.', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Workflow Actions */}
      <div className="card-lg bg-white/50 backdrop-blur-md border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/30">
          <h2 className="text-sm font-black text-navy-900 uppercase tracking-[0.2em] flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-600" />
            Exceptions & Appeals
          </h2>
          <p className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Amendment and reopen requests created here are stored locally for demo flow continuity until backend workflow endpoints are available.
          </p>
        </div>

        <div className="p-6 space-y-8">
          {/* Amendment Flow */}
          <div className="group relative">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                <FilePenLine className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-black text-navy-900 uppercase tracking-widest">Amend Active Determination</h3>
            </div>
            
            <div className="space-y-4 ml-2 pl-6 border-l-2 border-blue-100 group-focus-within:border-blue-400 transition-colors">
              <div className="flex flex-wrap gap-2">
                {['modify', 'reject', 'accept'].map((value) => (
                  <button
                    key={value}
                    onClick={() => setAmendDecisionType(value)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border-2 transition-all ${
                      amendDecisionType === value
                        ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                        : 'border-transparent bg-gray-50 text-gray-400 hover:bg-gray-100'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <textarea
                value={amendReason}
                onChange={(event) => setAmendReason(event.target.value)}
                placeholder="Formal justification for post-verdict correction..."
                className="input-field min-h-[100px] text-xs bg-gray-50 group-focus-within:bg-white border-transparent focus:border-blue-200"
              />
              <button
                onClick={submitAmendment}
                className="w-full px-4 py-2.5 rounded-xl bg-blue-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                Submit Amendment
              </button>
            </div>
          </div>

          {/* Reopen Flow */}
          <div className="group relative">
            <div className="flex items-center gap-2 mb-4">
              <div className={`p-2 rounded-lg border transition-colors ${isClosed ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>
                {isClosed ? <ArrowRight className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              </div>
              <h3 className={`text-xs font-black uppercase tracking-widest ${isClosed ? 'text-navy-900' : 'text-gray-400'}`}>Request Case Reopening</h3>
            </div>
            
            <div className={`space-y-4 ml-2 pl-6 border-l-2 transition-colors ${isClosed ? 'border-purple-100 group-focus-within:border-purple-400' : 'border-gray-50 opacity-40'}`}>
              <textarea
                value={reopenReason}
                onChange={(event) => setReopenReason(event.target.value)}
                placeholder={isClosed ? "Provide credible grounds or new evidence discovered..." : "System locked - decision must be finalized."}
                disabled={!isClosed}
                className="input-field min-h-[100px] text-xs bg-gray-50 group-focus-within:bg-white border-transparent focus:border-purple-200"
              />
              <button
                onClick={submitReopen}
                disabled={!isClosed}
                className="w-full px-4 py-2.5 rounded-xl bg-purple-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20 active:scale-[0.98] transition-all"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                Initiate Reopen
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Decision Analytics / History */}
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
                   <div className="w-1 h-1 rounded-full bg-navy-600" />
                   {entry.actor}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center bg-navy-800/20 rounded-2xl border border-navy-800 border-dashed">
              <CircleAlert className="w-8 h-8 text-navy-700 mx-auto mb-3" />
              <p className="text-xs text-navy-400 font-black uppercase tracking-widest">Order Pending</p>
            </div>
          )}
        </div>
      </div>

      {/* Request Log */}
      <div className="card-lg bg-white border-gray-200">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h2 className="text-[10px] font-black text-navy-900 uppercase tracking-widest flex items-center gap-2">
            <History className="w-4 h-4 text-gray-400" />
            Workflow Lifecycle
          </h2>
        </div>
        
        <div className="divide-y divide-gray-50">
          {workflowItems.length > 0 ? (
            [...amendmentItems, ...reopenItems]
              .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
              .map((item) => (
                <div key={item.id} className="p-5 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="space-y-1">
                      <p className="text-xs font-black text-navy-900 tracking-tight">{item.title}</p>
                      <p className="text-[11px] font-medium text-gray-500 line-clamp-1">{item.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <SourceBadge source={item.source} />
                      <HistoryBadge itemType={item.item_type} status={item.status} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[9px] font-black text-gray-400 uppercase tracking-tighter">
                    <span>{item.submitter}</span>
                    <span>{new Date(item.submitted_at).toLocaleString()}</span>
                  </div>
                  {item.history?.length > 1 && (
                    <div className="mt-3 pl-3 border-l-2 border-gray-100 space-y-2">
                      {item.history.slice(1).map((entry) => (
                        <div key={entry.id} className="text-[10px] text-gray-600">
                          <span className="font-black uppercase text-navy-400 mr-2">{entry.action}</span>
                          <span className="font-medium italic">"{entry.reason}"</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
          ) : (
            <div className="p-10 text-center">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Synchronized</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
