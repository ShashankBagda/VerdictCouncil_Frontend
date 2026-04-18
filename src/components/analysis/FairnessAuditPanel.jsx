import React from 'react';
import { ShieldCheck } from 'lucide-react';

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

const isCheckPassing = (check) => {
  const value = String(
    check?.status ?? check?.result ?? check?.outcome ?? check?.state ?? '',
  ).toLowerCase();
  return ['pass', 'passed', 'ok', 'clear', 'compliant', 'complete'].includes(value);
};

export default function FairnessAuditPanel({ summary, checks = [] }) {
  return (
    <div className="space-y-4">
      <div className="card-lg">
        <h2 className="text-2xl font-bold text-navy-900 mb-2 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-violet-600" />
          Fairness Audit Checklist
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          Review parity, procedural fairness, and any automated concerns before the final judicial action.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-violet-700 mb-2">Fairness Score</p>
            <div className="flex items-baseline gap-1">
              <p className="text-4xl font-extrabold text-violet-900">
                {summary?.score ?? '--'}
              </p>
              {summary?.score !== null && summary?.score !== undefined && (
                <p className="text-xl font-bold text-violet-700">%</p>
              )}
            </div>
            {summary?.score !== null && (
              <div className="mt-4 w-full bg-violet-200 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-violet-600 h-full transition-all duration-1000" 
                  style={{ width: `${summary.score}%` }} 
                />
              </div>
            )}
          </div>
          
          <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Total Checks</p>
            <p className="text-4xl font-extrabold text-navy-900">{checks.length}</p>
            <p className="text-xs text-gray-500 mt-4 leading-tight">Automated audits performed across evidence and reasoning.</p>
          </div>

          <div className={`rounded-xl border p-5 shadow-sm ${
            (summary?.flagged ?? 0) > 0 ? 'border-rose-200 bg-rose-50/50' : 'border-emerald-100 bg-emerald-50/50'
          }`}>
            <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${
              (summary?.flagged ?? 0) > 0 ? 'text-rose-700' : 'text-emerald-700'
            }`}>Issues Flagged</p>
            <p className={`text-4xl font-extrabold ${
              (summary?.flagged ?? 0) > 0 ? 'text-rose-900' : 'text-emerald-900'
            }`}>{summary?.flagged ?? 0}</p>
            <p className={`text-xs mt-4 leading-tight ${
              (summary?.flagged ?? 0) > 0 ? 'text-rose-700' : 'text-emerald-700'
            }`}>
              {(summary?.flagged ?? 0) > 0 
                ? 'Review warnings before proceeding to verdict.' 
                : 'No critical fairness violations detected.'}
            </p>
          </div>
        </div>

        {summary?.summary && (
          <div className="mt-6 rounded-lg border border-violet-100 bg-white p-4 text-sm text-gray-700 leading-relaxed shadow-inner">
            <div className="font-semibold text-violet-900 mb-1 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              Audit Summary
            </div>
            {summary.summary}
          </div>
        )}
      </div>

      <div className="card-lg">
        <h3 className="text-lg font-bold text-navy-900 mb-4 px-1">Detailed Verification</h3>
        {checks.length > 0 ? (
          <div className="grid grid-cols-1 gap-3">
            {checks.map((check, idx) => {
              const passing = isCheckPassing(check);
              return (
                <div
                  key={idx}
                  className={`rounded-lg border p-4 transition-all hover:shadow-md ${
                    passing 
                      ? 'border-emerald-100 bg-emerald-50/30' 
                      : 'border-amber-200 bg-amber-50/50 shadow-sm'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-navy-900">
                        {check.title || check.label || check.category || `Check ${idx + 1}`}
                      </h3>
                      <p className="text-sm text-gray-700 mt-1 max-w-2xl">
                        {check.description || check.summary || check.note || 'No additional context provided.'}
                      </p>
                    </div>
                    <MetaBadge tone={passing ? 'emerald' : 'amber'}>
                      {(check.status || check.result || check.outcome || (passing ? 'PASSED' : 'REVIEW REQUIRED')).toUpperCase()}
                    </MetaBadge>
                  </div>

                  {(check.recommendation || check.mitigation || check.action) && (
                    <div className="mt-4 pt-3 border-t border-black/5 flex gap-3">
                      <div className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded h-fit mt-0.5 ${
                        passing ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        Action
                      </div>
                      <p className="text-sm text-gray-800">
                        {check.recommendation || check.mitigation || check.action}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <p className="text-gray-500 italic">No fairness checklist data available for analysis.</p>
          </div>
        )}
      </div>
    </div>
  );
}
