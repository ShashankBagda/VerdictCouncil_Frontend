import React from 'react';
import { ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react';

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

function StatusBanner({ summary, checksCount }) {
  const auditRan = summary?.has_data ?? checksCount > 0;
  const auditPassed = summary?.audit_passed;
  const critical = summary?.severity_counts?.critical ?? 0;
  const major = summary?.severity_counts?.major ?? 0;
  const minor = summary?.severity_counts?.minor ?? 0;

  let tone, label, sublabel, Icon;
  if (!auditRan) {
    tone = 'border-gray-200 bg-gray-50/60 text-gray-700';
    label = 'Audit Pending';
    sublabel = 'The auditor has not produced a fairness check for this case yet.';
    Icon = ShieldQuestion;
  } else if (auditPassed === true && critical === 0) {
    tone = 'border-emerald-300 bg-emerald-50/70 text-emerald-900';
    label = 'Audit Passed';
    sublabel = 'No critical fairness issues identified.';
    Icon = ShieldCheck;
  } else {
    tone = 'border-rose-300 bg-rose-50/70 text-rose-900';
    label = 'Audit Failed — Review Required';
    sublabel = critical > 0
      ? `${critical} critical${major ? `, ${major} major` : ''}${minor ? `, ${minor} minor` : ''} issue${critical + major + minor === 1 ? '' : 's'} flagged.`
      : 'Auditor flagged issues before verdict can be recorded.';
    Icon = ShieldAlert;
  }

  return (
    <div className={`rounded-xl border-2 p-5 shadow-sm ${tone}`}>
      <div className="flex items-start gap-4">
        <Icon className="w-10 h-10 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-2xl font-extrabold leading-tight">{label}</p>
          <p className="text-sm mt-1 opacity-90">{sublabel}</p>
          {auditRan && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="px-2.5 py-1 rounded-full bg-white/70 border border-current/20">
                Total checks: {checksCount}
              </span>
              {critical > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-rose-200 text-rose-900">
                  Critical: {critical}
                </span>
              )}
              {major > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-amber-200 text-amber-900">
                  Major: {major}
                </span>
              )}
              {minor > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-sky-200 text-sky-900">
                  Minor: {minor}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FairnessAuditPanel({ summary, checks = [] }) {
  const recommendations = Array.isArray(summary?.recommendations) ? summary.recommendations : [];
  const sendBack = summary?.recommend_send_back;

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

        <StatusBanner summary={summary} checksCount={checks.length} />

        {sendBack?.reason && (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold mb-1">
              Auditor recommends sending back to{' '}
              <span className="capitalize">{sendBack.to_phase || 'a prior phase'}</span>
            </p>
            <p className="leading-relaxed">{sendBack.reason}</p>
          </div>
        )}

        {summary?.summary && (
          <div className="mt-4 rounded-lg border border-violet-100 bg-white p-4 text-sm text-gray-700 leading-relaxed shadow-inner">
            <div className="font-semibold text-violet-900 mb-1 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              Auditor Verdict
            </div>
            {summary.summary}
          </div>
        )}

        {recommendations.length > 0 && (
          <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50/50 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-violet-800 mb-2">
              Recommendations ({recommendations.length})
            </p>
            <ul className="space-y-2 list-decimal list-inside text-sm text-gray-800">
              {recommendations.map((rec, idx) => (
                <li key={idx} className="leading-relaxed">{rec}</li>
              ))}
            </ul>
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
