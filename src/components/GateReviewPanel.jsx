// Sprint 4 4.C5b.1 — shared <GateReviewPanel> for the four HITL gates.
//
// Mounted by the case-detail page on receipt of an `InterruptEvent` SSE
// frame (4.A3.7). Renders a header (gate label + case_id), the per-gate
// body slot (4.C5b.2), a free-text notes textarea, and the action
// buttons advertised by `InterruptEvent.actions`. On click, calls
// `onAction(payload)` with a typed `ResumePayload` that the consumer
// POSTs to `/cases/{id}/respond` (4.A3.15). The typed contract lives in
// `src/types/resumePayload.ts`; this component is .jsx (project-wide
// convention) but consumes the contract via JSDoc imports for IDEs.
//
// @typedef {import('../lib/sseEvents').InterruptEvent} InterruptEvent
// @typedef {import('../lib/sseEvents').GateName} GateName
// @typedef {import('../types/resumePayload').ResumePayload} ResumePayload
// @typedef {import('../types/resumePayload').Phase} Phase
// @typedef {import('../types/resumePayload').SendBackPhase} SendBackPhase

import { useMemo, useState } from 'react';
import Gate1IntakeReview from './Gate1IntakeReview';
import Gate2ResearchReview from './Gate2ResearchReview';
import Gate3SynthesisReview from './Gate3SynthesisReview';
import Gate4AuditorReview from './Gate4AuditorReview';

// Gate label / description metadata. Mirrors the four-phase topology
// (intake / research / synthesis / audit) that 1.A1.7 introduced.
const GATE_LABEL = {
  gate1: 'Gate 1 — Intake Review',
  gate2: 'Gate 2 — Research Review',
  gate3: 'Gate 3 — Synthesis Review',
  gate4: 'Gate 4 — Auditor Review',
};

// Each gate's apply node has a fixed `rerun_target` phase (builder.py).
// Surfacing that mapping here lets the rerun button construct the right
// `{action: "rerun", phase: <X>}` payload without the consumer having to
// know the topology. If a future gate gets a configurable rerun target,
// flip this to a prop.
const GATE_RERUN_PHASE = {
  gate1: 'intake',
  gate2: 'research',
  gate3: 'synthesis',
  gate4: 'audit',
};

const SEND_BACK_OPTIONS = ['intake', 'research', 'synthesis'];

function GateBody({ gate, phaseOutput }) {
  switch (gate) {
    case 'gate1':
      return <Gate1IntakeReview phaseOutput={phaseOutput} />;
    case 'gate2':
      return <Gate2ResearchReview phaseOutput={phaseOutput} />;
    case 'gate3':
      return <Gate3SynthesisReview phaseOutput={phaseOutput} />;
    case 'gate4':
      return <Gate4AuditorReview phaseOutput={phaseOutput} />;
    default:
      return null;
  }
}

/**
 * @param {{
 *   interruptEvent: InterruptEvent,
 *   traceUrl?: string,
 *   auditLogUrl?: string,
 *   onAction: (payload: ResumePayload) => void,
 *   disabled?: boolean,
 * }} props
 */
export default function GateReviewPanel({
  interruptEvent,
  traceUrl,
  auditLogUrl,
  onAction,
  disabled = false,
}) {
  const { gate, case_id, actions, audit_summary, phase_output } = interruptEvent;
  const [notes, setNotes] = useState('');

  // Pre-fill send-back target with the auditor's recommendation when
  // present; fall back to "synthesis" (the most common rewind target).
  const recommendedSendBack = audit_summary?.recommend_send_back?.to_phase;
  const [sendBackTarget, setSendBackTarget] = useState(
    SEND_BACK_OPTIONS.includes(recommendedSendBack) ? recommendedSendBack : 'synthesis'
  );

  const allowedActions = useMemo(() => new Set(actions), [actions]);

  function emit(payload) {
    if (disabled) return;
    onAction(payload);
  }

  function handleAdvance() {
    emit({ action: 'advance', notes: notes || undefined });
  }
  function handleRerun() {
    emit({
      action: 'rerun',
      phase: GATE_RERUN_PHASE[gate],
      notes: notes || undefined,
    });
  }
  function handleHalt() {
    emit({ action: 'halt', notes: notes || undefined });
  }
  function handleSendBack() {
    emit({
      action: 'send_back',
      to_phase: sendBackTarget,
      notes: notes || undefined,
    });
  }

  return (
    <section
      className="rounded-lg border border-slate-200 bg-white shadow-sm p-6 space-y-4"
      aria-label={`${GATE_LABEL[gate]} review panel`}
    >
      {/* Header */}
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">{GATE_LABEL[gate]}</h2>
        <div className="text-xs text-slate-500 font-mono">case {case_id}</div>
      </header>

      {/* Per-gate body */}
      <div className="border-t border-slate-100 pt-4">
        <GateBody gate={gate} phaseOutput={phase_output} />
      </div>

      {/* Free-text notes — audit-logged on every action */}
      <div className="border-t border-slate-100 pt-4">
        <label
          htmlFor="gate-review-notes"
          className="block text-sm font-medium text-slate-700 mb-1"
        >
          Notes
        </label>
        <textarea
          id="gate-review-notes"
          aria-label="Notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={disabled}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
          placeholder="Add a note (optional). Recorded against the gate decision in the audit log."
        />
      </div>

      {/* Action buttons */}
      <div className="border-t border-slate-100 pt-4 flex flex-wrap items-center gap-2">
        {allowedActions.has('advance') && (
          <button
            type="button"
            onClick={handleAdvance}
            disabled={disabled}
            className="inline-flex items-center px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            Advance
          </button>
        )}
        {allowedActions.has('rerun') && (
          <button
            type="button"
            onClick={handleRerun}
            disabled={disabled}
            className="inline-flex items-center px-4 py-2 rounded-md bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
          >
            Re-run
          </button>
        )}
        {allowedActions.has('halt') && (
          <button
            type="button"
            onClick={handleHalt}
            disabled={disabled}
            className="inline-flex items-center px-4 py-2 rounded-md bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 disabled:opacity-50"
          >
            Halt
          </button>
        )}
        {allowedActions.has('send_back') && (
          <div className="flex items-center gap-2 ml-auto">
            <label htmlFor="send-back-target" className="text-sm text-slate-600">
              Send back to
            </label>
            <select
              id="send-back-target"
              aria-label="Send back to phase"
              value={sendBackTarget}
              onChange={(e) => setSendBackTarget(e.target.value)}
              disabled={disabled}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm"
            >
              {SEND_BACK_OPTIONS.map((phase) => (
                <option key={phase} value={phase}>
                  {phase}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleSendBack}
              disabled={disabled}
              className="inline-flex items-center px-3 py-1.5 rounded-md bg-slate-700 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
            >
              Send back
            </button>
          </div>
        )}
      </div>

      {/* Trace + audit links */}
      {(traceUrl || auditLogUrl) && (
        <footer className="border-t border-slate-100 pt-3 text-xs text-slate-500 flex items-center gap-4">
          {traceUrl && (
            <a
              href={traceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:underline"
            >
              View trace
            </a>
          )}
          {auditLogUrl && (
            <a
              href={auditLogUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:underline"
            >
              Audit log
            </a>
          )}
        </footer>
      )}
    </section>
  );
}
