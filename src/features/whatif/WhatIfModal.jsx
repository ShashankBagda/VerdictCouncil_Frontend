// Sprint 4 4.A5.3 — judge-facing what-if modal.
//
// Mounted from <GateReviewPanel> (gates 2/3/4) when the judge clicks
// "What if...". Collects one of three modifications:
//
//   - evidence_exclusion: { evidence_id, reason? }
//   - fact_toggle:        { fact_id, new_status: 'agreed' | 'disputed' }
//   - witness_credibility:{ witness_id, new_credibility_score }
//
// On submit, defers to the consumer's onSubmit({ modification_type,
// modification_payload, description }) — useWhatIfScenario does the
// network round-trip. The modal stays mounted while the scenario
// polls so the consumer can swap its body for <WhatIfCompareView>
// when a result lands (via the children slot).

import { useState } from 'react';

const MOD_TYPES = [
  { value: 'evidence_exclusion', label: 'Exclude evidence' },
  { value: 'fact_toggle', label: 'Toggle fact (agreed ↔ disputed)' },
  { value: 'witness_credibility', label: 'Override witness credibility' },
];

function buildPayload(modType, fields) {
  if (modType === 'evidence_exclusion') {
    const payload = { evidence_id: fields.evidenceId };
    if (fields.reason) payload.reason = fields.reason;
    return payload;
  }
  if (modType === 'fact_toggle') {
    return { fact_id: fields.factId, new_status: fields.newStatus };
  }
  if (modType === 'witness_credibility') {
    return {
      witness_id: fields.witnessId,
      new_credibility_score: Number(fields.credibilityScore),
    };
  }
  return {};
}

function buildDescription(modType, fields) {
  if (modType === 'evidence_exclusion') return `Exclude evidence ${fields.evidenceId}`;
  if (modType === 'fact_toggle') {
    return `Toggle fact ${fields.factId} → ${fields.newStatus}`;
  }
  if (modType === 'witness_credibility') {
    return `Set witness ${fields.witnessId} credibility = ${fields.credibilityScore}`;
  }
  return '';
}

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   onSubmit: (req: {modification_type: string, modification_payload: object, description?: string}) => void,
 *   submitting?: boolean,
 *   children?: import('react').ReactNode,
 * }} props
 */
export default function WhatIfModal({
  open,
  onClose,
  onSubmit,
  submitting = false,
  children,
}) {
  const [modType, setModType] = useState('evidence_exclusion');
  const [evidenceId, setEvidenceId] = useState('');
  const [reason, setReason] = useState('');
  const [factId, setFactId] = useState('');
  const [newStatus, setNewStatus] = useState('disputed');
  const [witnessId, setWitnessId] = useState('');
  const [credibilityScore, setCredibilityScore] = useState('50');

  if (!open) return null;

  const fields = { evidenceId, reason, factId, newStatus, witnessId, credibilityScore };

  function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    onSubmit({
      modification_type: modType,
      modification_payload: buildPayload(modType, fields),
      description: buildDescription(modType, fields),
    });
  }

  // When the consumer passes children (e.g. compare view, in-flight
  // spinner), swap the form body for them. The form returns when
  // children is reset to null (typical: judge clicks "Run another").
  const showForm = !children;
  const formDisabled = submitting;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="What-if scenario"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40"
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <header className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">What-if scenario</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close what-if modal"
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
          >
            ×
          </button>
        </header>

        {!showForm ? (
          <div className="px-6 py-4">{children}</div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
            <div>
              <label htmlFor="whatif-mod-type" className="block text-sm font-medium text-slate-700 mb-1">
                Modification type
              </label>
              <select
                id="whatif-mod-type"
                value={modType}
                onChange={(e) => setModType(e.target.value)}
                disabled={formDisabled}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                {MOD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {modType === 'evidence_exclusion' && (
              <>
                <div>
                  <label htmlFor="whatif-evidence-id" className="block text-sm font-medium text-slate-700 mb-1">
                    Evidence id
                  </label>
                  <input
                    id="whatif-evidence-id"
                    value={evidenceId}
                    onChange={(e) => setEvidenceId(e.target.value)}
                    disabled={formDisabled}
                    required
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="e.g. ev-1"
                  />
                </div>
                <div>
                  <label htmlFor="whatif-reason" className="block text-sm font-medium text-slate-700 mb-1">
                    Reason (optional)
                  </label>
                  <input
                    id="whatif-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={formDisabled}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </>
            )}

            {modType === 'fact_toggle' && (
              <>
                <div>
                  <label htmlFor="whatif-fact-id" className="block text-sm font-medium text-slate-700 mb-1">
                    Fact id
                  </label>
                  <input
                    id="whatif-fact-id"
                    value={factId}
                    onChange={(e) => setFactId(e.target.value)}
                    disabled={formDisabled}
                    required
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="e.g. f-2"
                  />
                </div>
                <div>
                  <label htmlFor="whatif-new-status" className="block text-sm font-medium text-slate-700 mb-1">
                    New status
                  </label>
                  <select
                    id="whatif-new-status"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    disabled={formDisabled}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="agreed">agreed</option>
                    <option value="disputed">disputed</option>
                  </select>
                </div>
              </>
            )}

            {modType === 'witness_credibility' && (
              <>
                <div>
                  <label htmlFor="whatif-witness-id" className="block text-sm font-medium text-slate-700 mb-1">
                    Witness id
                  </label>
                  <input
                    id="whatif-witness-id"
                    value={witnessId}
                    onChange={(e) => setWitnessId(e.target.value)}
                    disabled={formDisabled}
                    required
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="e.g. w-1"
                  />
                </div>
                <div>
                  <label htmlFor="whatif-credibility" className="block text-sm font-medium text-slate-700 mb-1">
                    Credibility score (0–100)
                  </label>
                  <input
                    id="whatif-credibility"
                    type="number"
                    min={0}
                    max={100}
                    value={credibilityScore}
                    onChange={(e) => setCredibilityScore(e.target.value)}
                    disabled={formDisabled}
                    required
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </>
            )}

            <footer className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={formDisabled}
                className="px-4 py-2 rounded-md border border-slate-300 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formDisabled}
                className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting ? 'Running…' : 'Run scenario'}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
}
