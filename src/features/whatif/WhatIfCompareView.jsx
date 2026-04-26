// Sprint 4 4.A5.3 — side-by-side comparison of original vs fork verdicts.
//
// Renders the result of a what-if scenario once the backend marks it
// completed. Reads `original_verdict`, `modified_verdict`, and
// `diff_view` directly from the scenario payload (shape defined by
// WhatIfResultResponse + diff.generate_diff in the backend).

function VerdictColumn({ title, verdict }) {
  if (!verdict) {
    return (
      <div className="flex-1 border border-slate-200 rounded-md p-4 bg-slate-50">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <p className="text-sm text-slate-500 mt-2">No verdict on record.</p>
      </div>
    );
  }

  const conclusion = verdict.preliminary_conclusion ?? verdict.conclusion ?? '—';
  const confidence = verdict.confidence_score ?? verdict.confidence;

  return (
    <div className="flex-1 border border-slate-200 rounded-md p-4 bg-white">
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      <dl className="mt-2 text-sm space-y-1">
        <div>
          <dt className="text-slate-500">Conclusion</dt>
          <dd className="font-medium text-slate-900">{String(conclusion)}</dd>
        </div>
        {confidence !== undefined && confidence !== null && (
          <div>
            <dt className="text-slate-500">Confidence</dt>
            <dd className="font-medium text-slate-900">{confidence}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function DiffSummary({ diff }) {
  if (!diff) return null;
  const factChanges = Array.isArray(diff.fact_changes) ? diff.fact_changes : [];
  const evidenceChanges = Array.isArray(diff.evidence_changes) ? diff.evidence_changes : [];
  const confidenceDelta = diff.confidence_delta;
  const analysisChanged = diff.analysis_changed;

  return (
    <section className="mt-4 border-t border-slate-200 pt-3 text-sm space-y-1">
      <div>
        <span className="text-slate-500">Verdict changed:</span>{' '}
        <span className="font-medium text-slate-900">{analysisChanged ? 'yes' : 'no'}</span>
      </div>
      {typeof confidenceDelta === 'number' && (
        <div>
          <span className="text-slate-500">Confidence delta:</span>{' '}
          <span className="font-medium text-slate-900">
            {confidenceDelta > 0 ? `+${confidenceDelta}` : confidenceDelta}
          </span>
        </div>
      )}
      {(factChanges.length > 0 || evidenceChanges.length > 0) && (
        <div className="text-slate-500">
          {factChanges.length} fact change(s), {evidenceChanges.length} evidence change(s)
        </div>
      )}
    </section>
  );
}

/**
 * @param {{
 *   scenario: {
 *     status: string,
 *     original_verdict?: object|null,
 *     modified_verdict?: object|null,
 *     diff_view?: object|null,
 *     verdict_changed?: boolean|null,
 *     scenario_run_id?: string|null,
 *   } | null,
 *   forkTraceUrl?: string,
 * }} props
 */
export default function WhatIfCompareView({ scenario, forkTraceUrl }) {
  if (!scenario) return null;

  return (
    <section aria-label="What-if comparison" className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-3">
        <VerdictColumn title="Original verdict" verdict={scenario.original_verdict} />
        <VerdictColumn title="What-if verdict" verdict={scenario.modified_verdict} />
      </div>
      <DiffSummary diff={scenario.diff_view} />
      {forkTraceUrl && (
        <a
          href={forkTraceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-indigo-600 hover:underline"
        >
          View fork trace in LangSmith
        </a>
      )}
    </section>
  );
}
