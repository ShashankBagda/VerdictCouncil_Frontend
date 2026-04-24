import React from 'react';
import { ShieldAlert, Info, CheckCircle2 } from 'lucide-react';

function MetaBadge({ children, tone = 'gray' }) {
  const tones = {
    gray: 'bg-gray-100 text-gray-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    rose: 'bg-rose-100 text-rose-700',
    blue: 'bg-blue-100 text-blue-700',
    violet: 'bg-violet-100 text-violet-700',
  };

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${tones[tone] || tones.gray}`}>
      {children}
    </span>
  );
}

const factLabel = (fact, idx) => fact.statement || fact.text || fact.title || `Fact ${idx + 1}`;

export default function DisputedFactsPanel({
  facts = [],
  disputeReasons = {},
  onReasonChange,
  onDispute,
  submitting = {},
}) {
  return (
    <div className="card-lg">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-rose-600" />
          Disputed Facts
        </h2>
        <div className="flex items-center gap-2">
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
          </span>
          <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">Review Required</span>
        </div>
      </div>
      <p className="text-sm text-gray-600 mb-6">
        Mark contested facts directly in the dossier so the backend can track judicial disputes and adjust the reasoning chain.
      </p>

      {facts.length > 0 ? (
        <div className="space-y-4">
          {facts.map((fact, idx) => {
            const factId = fact?.id || fact?.fact_id || fact?.uuid || idx;
            const isDisputed = Boolean(fact?.disputed) || String(fact?.status || '').toLowerCase() === 'disputed';
            const isSubmitting = submitting[factId];
            
            return (
              <div 
                key={factId} 
                className={`rounded-xl border p-5 transition-all ${
                  isDisputed 
                    ? 'border-rose-200 bg-rose-50/30' 
                    : 'border-gray-100 bg-white hover:border-gray-300 shadow-sm'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-navy-900 leading-tight">{factLabel(fact, idx)}</p>
                    {fact.source && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <Info className="w-3.5 h-3.5 text-gray-400" />
                        <p className="text-xs text-gray-500 font-medium font-mono">Source: {fact.source}</p>
                      </div>
                    )}
                  </div>
                  {isDisputed ? (
                    <MetaBadge tone="rose">DISPUTED</MetaBadge>
                  ) : (
                    <MetaBadge tone="blue">UNDISPUTED</MetaBadge>
                  )}
                </div>

                {(fact.explanation || fact.notes) && (
                  <div className="mb-4 text-sm text-gray-700 bg-black/5 p-3 rounded-lg border border-black/5 italic">
                    "{fact.explanation || fact.notes}"
                  </div>
                )}

                <div className="relative">
                  <textarea
                    value={disputeReasons[factId] ?? fact.dispute_reason ?? ''}
                    onChange={(e) => onReasonChange(factId, e.target.value)}
                    disabled={isDisputed}
                    placeholder="Enter judicial reasoning for contesting this fact..."
                    className={`input-field min-h-24 resize-none transition-all ${
                      isDisputed ? 'bg-white/50 border-rose-100 italic' : 'bg-gray-50 focus:bg-white'
                    }`}
                  />
                </div>

                <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-[11px] text-gray-500">
                    {isDisputed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-gray-300" />
                    )}
                    <span>
                      {isDisputed 
                        ? 'This fact is currently being excluded from automated determinations.' 
                        : 'Submit a reason to trigger an analysis re-run excluding this fact.'}
                    </span>
                  </div>
                  <button
                    onClick={() => onDispute(fact, idx)}
                    disabled={isDisputed || isSubmitting || !(disputeReasons[factId]?.trim())}
                    className={`whitespace-nowrap px-5 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-all ${
                      isDisputed
                        ? 'bg-rose-100 text-rose-700 cursor-default'
                        : 'bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-600/20 active:scale-95 disabled:opacity-50 disabled:shadow-none'
                    }`}
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <div className="spinner-white w-3 h-3" />
                        <span>Processing...</span>
                      </div>
                    ) : isDisputed ? (
                      'Recorded'
                    ) : (
                      'Dispute Fact'
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <p className="text-gray-500 italic">No disputed facts found for this case analysis.</p>
        </div>
      )}
    </div>
  );
}
