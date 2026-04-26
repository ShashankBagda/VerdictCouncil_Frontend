// Sprint 4 4.C5b.2 — gate3 synthesis review body.
//
// Side-by-side claimant / respondent IRAC summary. Judicial questions
// are inline-editable; on Re-run, <GateReviewPanel> reads the edits
// via `onFieldCorrectionsChange` and folds them into
// `{action: "rerun", phase: "synthesis", field_corrections: {synthesis_output: {judicial_questions: [...]}}}`.

import { useEffect, useState } from 'react';

export default function Gate3SynthesisReview({ phaseOutput, onFieldCorrectionsChange }) {
  const synth = phaseOutput ?? {};
  const [questions, setQuestions] = useState(synth.judicial_questions ?? []);
  const [showBrief, setShowBrief] = useState(false);
  const [showQuestions, setShowQuestions] = useState(true);

  const original = JSON.stringify(synth.judicial_questions ?? []);

  useEffect(() => {
    const dirty = JSON.stringify(questions) !== original;
    onFieldCorrectionsChange?.(
      dirty ? { synthesis_output: { judicial_questions: questions } } : null
    );
  }, [questions, original, onFieldCorrectionsChange]);

  return (
    <div className="space-y-3" data-testid="gate3-synthesis-body">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <IracColumn label="Claimant" irac={synth.claimant_irac} />
        <IracColumn label="Respondent" irac={synth.respondent_irac} />
      </div>
      <Collapsible
        label="Pre-hearing brief"
        open={showBrief}
        onToggle={() => setShowBrief(!showBrief)}
      >
        <p className="text-sm text-slate-700 whitespace-pre-wrap">
          {synth.pre_hearing_brief ?? '—'}
        </p>
      </Collapsible>
      <Collapsible
        label="Judicial questions"
        open={showQuestions}
        onToggle={() => setShowQuestions(!showQuestions)}
      >
        <ol className="space-y-1 list-decimal list-inside">
          {questions.map((q, i) => (
            <li key={i} className="text-sm">
              <input
                type="text"
                aria-label={`Judicial question ${i + 1}`}
                value={q}
                onChange={(e) => {
                  const next = [...questions];
                  next[i] = e.target.value;
                  setQuestions(next);
                }}
                className="ml-2 inline-block w-[calc(100%-2rem)] rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
            </li>
          ))}
        </ol>
        {questions.length === 0 && (
          <p className="text-sm text-slate-500">No questions.</p>
        )}
      </Collapsible>
      {Array.isArray(synth.uncertainty_flags) && synth.uncertainty_flags.length > 0 && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
          <div className="text-xs font-medium text-amber-700 uppercase tracking-wide">
            Uncertainty flags
          </div>
          <ul className="mt-1 text-sm text-amber-900 list-disc list-inside space-y-0.5">
            {synth.uncertainty_flags.map((f, i) => (
              <li key={i}>
                <span className="font-medium">[{f.severity ?? '?'}]</span> {f.flag ?? '?'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function IracColumn({ label, irac }) {
  return (
    <div className="rounded-md border border-slate-200 p-3 text-sm">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
        {label}
      </div>
      <Field label="Issue" value={irac?.issue ?? '—'} />
      <Field label="Rule" value={irac?.rule ?? '—'} />
      <Field label="Application" value={irac?.application ?? '—'} />
      <Field label="Conclusion" value={irac?.conclusion ?? '—'} />
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="mb-1.5">
      <span className="text-xs font-medium text-slate-500">{label}: </span>
      <span className="text-slate-800">{value}</span>
    </div>
  );
}

function Collapsible({ label, open, onToggle, children }) {
  return (
    <div className="border-t border-slate-100 pt-2">
      <button
        type="button"
        onClick={onToggle}
        className="text-sm font-medium text-slate-700 hover:text-slate-900"
        aria-expanded={open}
      >
        {open ? '▾' : '▸'} {label}
      </button>
      {open && <div className="mt-1.5">{children}</div>}
    </div>
  );
}
