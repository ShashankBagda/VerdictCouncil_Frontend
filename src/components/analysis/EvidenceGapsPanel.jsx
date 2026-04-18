import React from 'react';
import { TriangleAlert } from 'lucide-react';

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

const gapLabel = (item, idx) => item.title || item.label || item.category || `Gap ${idx + 1}`;

export default function EvidenceGapsPanel({ items = [] }) {
  if (items.length === 0) {
    return (
      <div className="card-lg">
        <h2 className="text-2xl font-bold text-navy-900 mb-2 flex items-center gap-2">
          <TriangleAlert className="w-6 h-6 text-amber-600" />
          Evidence Gaps
        </h2>
        <p className="text-gray-600 text-center py-6">No evidence gaps flagged yet</p>
      </div>
    );
  }

  return (
    <div className="card-lg">
      <h2 className="text-2xl font-bold text-navy-900 mb-2 flex items-center gap-2">
        <TriangleAlert className="w-6 h-6 text-amber-600" />
        Evidence Gaps
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        Missing proof, unresolved contradictions, and factual records that need judicial review.
      </p>

      <div className="space-y-3">
        {items.map((item, idx) => {
          const severityTone = 
            item.severity?.toLowerCase() === 'high' || item.severity?.toLowerCase() === 'critical' 
              ? 'rose' 
              : item.severity?.toLowerCase() === 'medium' || item.severity?.toLowerCase() === 'warning'
                ? 'amber'
                : 'blue';

          return (
            <div key={idx} className={`rounded-lg border p-4 ${
              severityTone === 'rose' ? 'border-rose-200 bg-rose-50/60' : 
              severityTone === 'amber' ? 'border-amber-200 bg-amber-50/60' : 
              'border-blue-200 bg-blue-50/60'
            }`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-navy-900">{gapLabel(item, idx)}</h3>
                  <p className="text-sm text-gray-700 mt-1">
                    {item.description || item.summary || item.reason || 'No description provided.'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {item.severity && <MetaBadge tone={severityTone}>{item.severity}</MetaBadge>}
                  {item.status && <MetaBadge tone="gray">{item.status}</MetaBadge>}
                </div>
              </div>
              {(item.recommended_action || item.next_step) && (
                <div className="mt-3 flex items-start gap-2 text-sm">
                  <span className="font-semibold text-navy-900 whitespace-nowrap">Next step:</span>
                  <span className={severityTone === 'rose' ? 'text-rose-900' : severityTone === 'amber' ? 'text-amber-900' : 'text-blue-900'}>
                    {item.recommended_action || item.next_step}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
