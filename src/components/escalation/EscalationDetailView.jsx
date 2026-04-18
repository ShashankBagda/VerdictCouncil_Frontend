import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle,
  Clock,
  FileText,
  History,
  Info,
  MessageSquare,
  ShieldAlert,
  User,
  XCircle,
} from 'lucide-react';
import CaseContextSection from './CaseContextSection';

const TABS = [
  { id: 'details', label: 'Details', icon: FileText },
  { id: 'history', label: 'Review History', icon: History },
];

export default function EscalationDetailView({
  item,
  onAction,
  processing = false,
}) {
  const [activeTab, setActiveTab] = useState('details');
  const [reason, setReason] = useState('');
  const [assignee, setAssignee] = useState('');
  const [finalOrder, setFinalOrder] = useState('');

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
        <div className="p-6 rounded-full bg-gray-50 border border-gray-100">
          <ShieldAlert className="w-12 h-12 text-gray-200" />
        </div>
        <p className="font-medium">Select an item from the queue to review</p>
      </div>
    );
  }

  const isPending = item.status === 'pending';
  const isLocalItem = item.source === 'local';

  const handleAction = (action) => {
    onAction(action, {
      reason,
      assignee,
      finalOrder,
    });
    setReason('');
    setAssignee('');
    setFinalOrder('');
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                  item.item_type === 'escalation'
                    ? 'bg-rose-100 text-rose-700'
                    : item.item_type === 'amendment'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-purple-100 text-purple-700'
                }`}
              >
                {item.item_type}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                  item.status === 'pending'
                    ? 'bg-amber-100 text-amber-700'
                    : item.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-700'
                      : item.status === 'rejected'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-violet-100 text-violet-700'
                }`}
              >
                {item.status}
              </span>
              {isLocalItem && (
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800">
                  Local Only
                </span>
              )}
            </div>
            <h2 className="text-2xl font-black text-navy-900 tracking-tight">{item.title}</h2>
            <div className="flex items-center gap-3 text-xs text-gray-500 font-medium">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" /> {item.submitter}
              </span>
              <span className="w-1 h-1 rounded-full bg-gray-300" />
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> {new Date(item.submitted_at).toLocaleDateString()}
              </span>
            </div>
          </div>
          <div
            className={`px-3 py-1.5 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest ${
              item.priority === 'urgent'
                ? 'border-rose-400 bg-rose-50 text-rose-700 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
                : item.priority === 'high'
                  ? 'border-amber-400 bg-amber-50 text-amber-700'
                  : 'border-gray-200 bg-white text-gray-500'
            }`}
          >
            {item.priority} Priority
          </div>
        </div>
      </div>

      <div className="flex border-b border-gray-100">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-4 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${
              activeTab === tab.id
                ? 'border-navy-900 text-navy-900 bg-white'
                : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {activeTab === 'details' && (
          <>
            <CaseContextSection caseId={item.case_id} />

            <section className="space-y-3">
              <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Info className="w-4 h-4" />
                Context & Description
              </h3>
              {isLocalItem && (
                <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-3 rounded-xl">
                  This workflow item exists only in local demo storage. Actions taken here do not update the backend queue.
                </div>
              )}
              <div className="prose prose-sm max-w-none text-gray-700 font-medium leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100">
                {item.description}
              </div>
              {(item.context || item.details) && (
                <div className="text-sm text-gray-600 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                  {item.context || item.details}
                </div>
              )}
            </section>

            {item.requested_change && (
              <section className="space-y-3">
                <h3 className="text-[11px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
                  <ArrowRight className="w-4 h-4" />
                  Proposed Amendment
                </h3>
                <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl text-sm font-medium text-blue-900 whitespace-pre-wrap italic">
                  "{item.requested_change}"
                </div>
              </section>
            )}

            {isPending && (
              <section className="space-y-4 pt-4 border-t border-gray-100">
                <h3 className="text-[11px] font-black text-navy-900 uppercase tracking-widest">
                  Decision Actions
                </h3>

                <div className="space-y-3">
                  <div className="group">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                      {isLocalItem ? 'Notes / Rationale' : 'Notes'}
                    </label>
                    <textarea
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder={
                        isLocalItem
                          ? 'Detail the reasoning for this review outcome...'
                          : 'Record review notes for the escalation action...'
                      }
                      className="input-field min-h-[120px] bg-gray-50 group-focus-within:bg-white transition-colors"
                    />
                  </div>

                  {isLocalItem ? (
                    <div className="group">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                        Reassignment (Optional)
                      </label>
                      <input
                        value={assignee}
                        onChange={(event) => setAssignee(event.target.value)}
                        placeholder="Assignee email address..."
                        className="input-field bg-gray-50 group-focus-within:bg-white transition-colors"
                      />
                    </div>
                  ) : (
                    <div className="group">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                        Final Order (Required for Manual Decision)
                      </label>
                      <textarea
                        value={finalOrder}
                        onChange={(event) => setFinalOrder(event.target.value)}
                        placeholder="Enter the final order text if you are recording a manual decision..."
                        className="input-field min-h-[120px] bg-gray-50 group-focus-within:bg-white transition-colors"
                      />
                    </div>
                  )}

                  {isLocalItem ? (
                    <>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                        <button
                          onClick={() => handleAction('approved')}
                          disabled={processing}
                          className="flex flex-col items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-all group disabled:opacity-50"
                        >
                          <CheckCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Approve</span>
                        </button>

                        <button
                          onClick={() => handleAction('rejected')}
                          disabled={processing || !reason.trim()}
                          className="flex flex-col items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 hover:bg-rose-600 hover:text-white transition-all group disabled:opacity-50"
                        >
                          <XCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Reject</span>
                        </button>

                        <button
                          onClick={() => handleAction('info_requested')}
                          disabled={processing || !reason.trim()}
                          className="flex flex-col items-center gap-2 p-3 rounded-xl bg-violet-50 border border-violet-100 text-violet-700 hover:bg-violet-600 hover:text-white transition-all group disabled:opacity-50"
                        >
                          <MessageSquare className="w-5 h-5 group-hover:scale-110 transition-transform" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Info Req</span>
                        </button>

                        <button
                          onClick={() => handleAction('reassign')}
                          disabled={processing || !assignee.trim()}
                          className="flex flex-col items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white transition-all group disabled:opacity-50"
                        >
                          <ArrowRight className="w-5 h-5 group-hover:scale-110 transition-transform" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Reassign</span>
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-400 italic text-center">
                        Rationale is required for rejections and information requests.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                        <button
                          onClick={() => handleAction('add_notes')}
                          disabled={processing || !reason.trim()}
                          className="flex flex-col items-center gap-2 p-3 rounded-xl bg-violet-50 border border-violet-100 text-violet-700 hover:bg-violet-600 hover:text-white transition-all group disabled:opacity-50"
                        >
                          <MessageSquare className="w-5 h-5 group-hover:scale-110 transition-transform" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Add Notes</span>
                        </button>

                        <button
                          onClick={() => handleAction('return_to_pipeline')}
                          disabled={processing}
                          className="flex flex-col items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white transition-all group disabled:opacity-50"
                        >
                          <ArrowRight className="w-5 h-5 group-hover:scale-110 transition-transform" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Return</span>
                        </button>

                        <button
                          onClick={() => handleAction('manual_decision')}
                          disabled={processing || !finalOrder.trim()}
                          className="flex flex-col items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-all group disabled:opacity-50"
                        >
                          <CheckCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                          <span className="text-[10px] font-black uppercase tracking-widest">
                            Manual Decision
                          </span>
                        </button>

                        <button
                          onClick={() => handleAction('reject')}
                          disabled={processing || !reason.trim()}
                          className="flex flex-col items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 hover:bg-rose-600 hover:text-white transition-all group disabled:opacity-50"
                        >
                          <XCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Reject</span>
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-400 italic text-center">
                        Notes are required for note entries and rejections. Manual decisions require a final order.
                      </p>
                    </>
                  )}
                </div>
              </section>
            )}
          </>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            {item.history?.length > 0 ? (
              <div className="relative border-l-2 border-gray-100 ml-4 pl-8 space-y-8 py-4">
                {item.history.map((entry, idx) => (
                  <div key={entry.id} className="relative">
                    <div className="absolute -left-[41px] top-0 w-6 h-6 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          idx === item.history.length - 1 ? 'bg-navy-900 animate-pulse' : 'bg-gray-300'
                        }`}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-[11px] font-black text-navy-900 uppercase tracking-widest">
                          {entry.action.replace(/_/g, ' ')}
                        </p>
                        <span className="text-[10px] font-medium text-gray-400">
                          {new Date(entry.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-gray-600">{entry.actor}</p>
                      {entry.reason && (
                        <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-100 text-xs text-gray-700 leading-relaxed font-medium">
                          {entry.reason}
                        </div>
                      )}
                      {entry.assignee && (
                        <p className="text-[10px] text-teal-600 font-black uppercase tracking-tight mt-2">
                          {'->'} Assigned to {entry.assignee}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <History className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                <p className="text-sm text-gray-400 font-medium">
                  No previous review history for this request.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            Source:
          </span>
          <span
            className={`text-[10px] font-black uppercase ${
              isLocalItem ? 'text-amber-600' : 'text-blue-600'
            }`}
          >
            {item.source}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            Case ID:
          </span>
          <span className="text-[10px] font-black text-navy-900 uppercase">{item.case_id}</span>
        </div>
      </div>
    </div>
  );
}
