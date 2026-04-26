// Sprint 4 4.C5b.2 — gate4 auditor review body.
//
// Renders the auditor's fairness findings, citation audit summary, and
// cost/tokens/duration footer. The "Send back to ▼ <phase>" dropdown
// lives on the parent <GateReviewPanel> (it surfaces only when
// `actions` includes "send_back" and `audit_summary.recommend_send_back`
// is present).

const SEVERITY_ICON = {
  critical: '🟥',
  high: '🟧',
  medium: '🟨',
  low: '🟦',
  info: 'ℹ️',
};

export default function Gate4AuditorReview({ phaseOutput }) {
  const audit = phaseOutput ?? {};
  const fairness = audit.fairness_check;
  const citation = audit.citation_audit;
  const cost = audit.cost_summary;

  return (
    <div className="space-y-3" data-testid="gate4-auditor-body">
      {fairness && (
        <div>
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
            Fairness
          </div>
          <p className="text-sm">
            <strong>Audit passed:</strong>{' '}
            <span
              className={
                fairness.audit_passed ? 'text-emerald-700' : 'text-rose-700 font-medium'
              }
            >
              {fairness.audit_passed ? 'yes' : 'NO'}
            </span>
            {fairness.critical_issues_found && (
              <span className="ml-3 text-rose-700 font-medium">
                ⚠ critical issues found
              </span>
            )}
          </p>
          {Array.isArray(fairness.issues) && fairness.issues.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-sm">
              {fairness.issues.map((issue, i) => (
                <li key={issue.id ?? i}>
                  <span className="mr-1">
                    {SEVERITY_ICON[issue.severity ?? 'info'] ?? 'ℹ️'}
                  </span>
                  <span className="font-medium">[{issue.severity ?? 'info'}]</span>{' '}
                  {issue.description ?? '?'}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {citation && (
        <div>
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
            Citation audit
          </div>
          <p className="text-sm text-slate-700">
            {citation.total_citations ?? 0} citations · {citation.suppressed_citations ?? 0}{' '}
            suppressed · {citation.unsupported_claims ?? 0} unsupported
          </p>
        </div>
      )}
      {audit.recommend_send_back && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
          <strong>Auditor recommends:</strong> send back to{' '}
          <span className="font-medium">{audit.recommend_send_back.to_phase ?? '?'}</span>
          {audit.recommend_send_back.reason && (
            <span> — {audit.recommend_send_back.reason}</span>
          )}
        </div>
      )}
      {cost && (
        <footer className="border-t border-slate-100 pt-2 text-xs text-slate-500 flex flex-wrap gap-4">
          <span>cost: ${(cost.cost_usd ?? 0).toFixed(4)}</span>
          <span>
            tokens: {cost.tokens_in ?? 0} in / {cost.tokens_out ?? 0} out
          </span>
          <span>duration: {(cost.duration_seconds ?? 0).toFixed(1)}s</span>
        </footer>
      )}
    </div>
  );
}
