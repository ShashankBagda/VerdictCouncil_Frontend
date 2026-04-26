// Sprint 4 4.C5b.2 — gate1 intake review body.
// Mounted inside <GateReviewPanel> when gate==='gate1'. Renders the
// IntakeOutput snapshot the backend ships in InterruptEvent.phase_output.

function isIntake(po) {
  return typeof po === 'object' && po !== null;
}

export default function Gate1IntakeReview({ phaseOutput }) {
  if (!isIntake(phaseOutput)) {
    return (
      <p className="text-sm text-slate-500" data-testid="gate1-empty">
        No intake output yet — the panel mounted before phase data arrived.
      </p>
    );
  }
  const intake = phaseOutput;

  return (
    <div className="space-y-3" data-testid="gate1-intake-body">
      <Field label="Domain" value={intake.domain ?? '—'} />
      <Field label="Complexity" value={intake.complexity ?? '—'} />
      <Field label="Route" value={intake.route ?? '—'} />
      {Array.isArray(intake.parties) && intake.parties.length > 0 && (
        <div>
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Parties
          </div>
          <ul className="mt-1 text-sm text-slate-700 space-y-0.5">
            {intake.parties.map((p, i) => (
              <li key={`${p?.name ?? '?'}-${i}`}>
                <span className="font-medium">{p?.name ?? '?'}</span>{' '}
                <span className="text-slate-500">— {p?.role ?? '?'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {Array.isArray(intake.red_flags) && intake.red_flags.length > 0 && (
        <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2">
          <div className="text-xs font-medium text-rose-700 uppercase tracking-wide">
            Red flags
          </div>
          <ul className="mt-1 text-sm text-rose-900 list-disc list-inside space-y-0.5">
            {intake.red_flags.map((flag, i) => (
              <li key={i}>{flag}</li>
            ))}
          </ul>
        </div>
      )}
      {intake.completeness && (
        <Field
          label="Completeness"
          value={
            intake.completeness.complete
              ? 'Complete'
              : `Missing: ${(intake.completeness.missing ?? []).join(', ') || '—'}`
          }
        />
      )}
      {Array.isArray(intake.documents) && intake.documents.length > 0 && (
        <div>
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Documents
          </div>
          <ul className="mt-1 text-sm text-slate-700 space-y-0.5">
            {intake.documents.map((d) => (
              <li key={d.id ?? d.filename}>
                {d.filename ?? d.id}
                {d.sanitized && (
                  <span className="ml-2 text-xs text-emerald-700">sanitized</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        {label}:{' '}
      </span>
      <span className="text-sm text-slate-800">{value}</span>
    </div>
  );
}
