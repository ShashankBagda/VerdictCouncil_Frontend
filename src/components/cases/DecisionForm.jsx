import React, { useState } from 'react';
import { CheckCircle, AlertCircle, Scale, ShieldAlert, MessageSquare, Send } from 'lucide-react';

export default function DecisionForm({
  verdict,
  decisionType,
  setDecisionType,
  decisionReason,
  setDecisionReason,
  onSubmit,
  onAmendmentRequest,
  submitting = false,
  locked = false,
  caseId = '',
}) {
  const [showAmendmentForm, setShowAmendmentForm] = useState(false);
  const [amendmentReason, setAmendmentReason] = useState('');
  const [amendmentSubmitting, setAmendmentSubmitting] = useState(false);

  if (!verdict && !locked) return null;

  const requiresReason = decisionType === 'modify' || decisionType === 'reject';
  const isSubmitDisabled = locked || submitting || (requiresReason && !decisionReason.trim());

  return (
    <div className="card-lg overflow-hidden border-2 border-transparent transition-all hover:border-navy-100">
      <div className="bg-navy-900 -mx-6 -mt-6 p-6 mb-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Scale className="w-5 h-5 text-emerald-400" />
              Judicial Determination
            </h2>
            <p className="text-navy-200 text-sm mt-1">
              Finalize the case outcome based on recommendation and evidence analysis.
            </p>
          </div>
          {locked && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <CheckCircle className="w-3.5 h-3.5" />
              Recorded
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-navy-900 mb-3">Select Disposition</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { 
                value: 'accept', 
                label: 'Accept', 
                desc: 'Adopt recommendation',
                activeClass: 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-4 ring-emerald-500/10',
                icon: CheckCircle
              },
              { 
                value: 'modify', 
                label: 'Modify', 
                desc: 'Adjust specific terms',
                activeClass: 'border-amber-500 bg-amber-50 text-amber-800 ring-4 ring-amber-500/10',
                icon: AlertCircle
              },
              { 
                value: 'reject', 
                label: 'Reject', 
                desc: 'Dismiss recommendation',
                activeClass: 'border-rose-500 bg-rose-50 text-rose-800 ring-4 ring-rose-500/10',
                icon: ShieldAlert
              },
            ].map((option) => {
              const Icon = option.icon;
              const isActive = decisionType === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => setDecisionType(option.value)}
                  disabled={locked}
                  className={`relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all group ${
                    isActive
                      ? option.activeClass
                      : 'border-gray-100 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Icon className={`w-6 h-6 mb-2 ${isActive ? '' : 'text-gray-300 group-hover:text-gray-400'}`} />
                  <span className="font-bold text-sm uppercase tracking-wide">{option.label}</span>
                  <span className="text-[10px] mt-1 opacity-70 font-medium">{option.desc}</span>
                  {isActive && (
                    <div className="absolute top-2 right-2">
                      <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-end">
            <label className="block text-sm font-bold text-navy-900">
              Judicial Reasoning / Remarks
            </label>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${requiresReason ? 'text-rose-600' : 'text-gray-400'}`}>
              {requiresReason ? 'Required for this action' : 'Optional documentation'}
            </span>
          </div>
          <textarea
            value={decisionReason}
            onChange={(e) => setDecisionReason(e.target.value)}
            disabled={locked}
            placeholder={
              decisionType === 'accept'
                ? 'Optional: provide context for the acceptance...'
                : `Mandatory: explain why the recommendation is being ${decisionType}ed...`
            }
            className={`input-field min-h-32 transition-all focus:ring-4 ${
              requiresReason && !decisionReason.trim() && !locked ? 'border-amber-300 bg-amber-50/20' : ''
            }`}
          />
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-start gap-2 max-w-sm">
            <AlertCircle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-gray-500 leading-tight">
              Submitting this form executes a definitive judicial record. This action is immutable and will trigger downstream enforcement or notification workflows.
            </p>
          </div>
          <button
            onClick={onSubmit}
            disabled={isSubmitDisabled}
            className={`w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-sm uppercase tracking-widest transition-all shadow-lg active:scale-95 ${
              locked 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none' 
                : 'bg-navy-900 text-white hover:bg-navy-800 hover:-translate-y-0.5 shadow-navy-900/20'
            } disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none`}
          >
            {submitting ? (
              <div className="flex items-center gap-2">
                <div className="spinner-white w-4 h-4" />
                <span>Recording...</span>
              </div>
            ) : locked ? (
              'Action Recorded'
            ) : (
              'Finalize Order'
            )}
          </button>
        </div>

        {locked && !showAmendmentForm && (
          <div className="pt-6 border-t border-gray-100 flex justify-center">
            <button
              onClick={() => setShowAmendmentForm(true)}
              className="group flex items-center gap-2 text-xs font-black text-navy-400 uppercase tracking-widest hover:text-navy-900 transition-colors"
            >
              <MessageSquare className="w-4 h-4 group-hover:scale-110 transition-transform" />
              Request Amendment to this order
            </button>
          </div>
        )}

        {locked && showAmendmentForm && (
          <div className="pt-6 border-t border-gray-200 space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-navy-900 uppercase tracking-widest flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-500" />
                Amendment Request
              </h3>
              <button 
                onClick={() => setShowAmendmentForm(false)}
                className="text-[10px] font-bold text-gray-400 hover:text-gray-600 uppercase"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed font-medium">
              Significant corrections or post-verdict modifications must be reviewed by the Senior Judge. Provide a detailed justification for the requested change.
            </p>
            <textarea
              value={amendmentReason}
              onChange={(e) => setAmendmentReason(e.target.value)}
              placeholder="State the specific sections to be amended and the reason for modification..."
              className="input-field min-h-[100px] border-blue-100 bg-blue-50/20"
            />
            <div className="flex justify-end">
              <button
                onClick={async () => {
                  if (!amendmentReason.trim()) return;
                  setAmendmentSubmitting(true);
                  try {
                    await onAmendmentRequest(amendmentReason);
                    setShowAmendmentForm(false);
                    setAmendmentReason('');
                  } finally {
                    setAmendmentSubmitting(false);
                  }
                }}
                disabled={amendmentSubmitting || !amendmentReason.trim()}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {amendmentSubmitting ? <div className="spinner-white w-3 h-3" /> : <Send className="w-3 h-3" />}
                Submit for Review
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
