import { useState } from 'react';
import { CheckCircle, RefreshCw, ChevronRight } from 'lucide-react';
import api, { getErrorMessage } from '../../lib/api';
import AgentRerunDialog from './AgentRerunDialog';

const GATE_AGENTS = {
  gate1: ['case-processing', 'complexity-routing'],
  gate2: ['evidence-analysis', 'fact-reconstruction', 'witness-analysis', 'legal-knowledge'],
  gate3: ['argument-construction', 'hearing-analysis'],
  gate4: ['hearing-governance'],
};

const GATE_LABELS = {
  gate1: 'Gate 1 — Intake Review',
  gate2: 'Gate 2 — Dossier Review',
  gate3: 'Gate 3 — Arguments Review',
  gate4: 'Gate 4 — Verdict Review',
};

const GATE_DESCRIPTIONS = {
  gate1: 'Review jurisdiction assessment and complexity routing before proceeding to full analysis.',
  gate2: 'Review the evidence analysis, facts, witnesses, and legal knowledge before argument construction.',
  gate3: 'Review argument construction and hearing analysis before final verdict preparation.',
  gate4: 'Review the hearing governance output and record your judicial decision.',
};


export default function GateReviewPanel({ caseId, gateName, onAdvanced }) {
  const [advancing, setAdvancing] = useState(false);
  const [showRerun, setShowRerun] = useState(false);
  const [advanceError, setAdvanceError] = useState(null);

  async function handleAdvance() {
    setAdvancing(true);
    setAdvanceError(null);
    try {
      await api.advanceGate(caseId, gateName);
      onAdvanced();
    } catch (err) {
      setAdvanceError(getErrorMessage(err));
    } finally {
      setAdvancing(false);
    }
  }

  return (
    <div className="card-lg border-2 border-teal-400 bg-teal-50">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-5 h-5 text-teal-600" />
            <span className="text-xs font-semibold uppercase tracking-widest text-teal-700">Gate Ready for Review</span>
          </div>
          <h2 className="text-xl font-bold text-navy-900">{GATE_LABELS[gateName]}</h2>
          <p className="text-sm text-gray-600 mt-1">{GATE_DESCRIPTIONS[gateName]}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setShowRerun(true)} className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Re-run Agent
          </button>
          <button onClick={handleAdvance} disabled={advancing} className="btn-primary flex items-center gap-2">
            {advancing ? <div className="spinner-white w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            {gateName === 'gate4' ? 'Proceed to Decision' : 'Approve & Advance'}
          </button>
        </div>
      </div>
      {advanceError && (
        <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">{advanceError}</div>
      )}
      <div className="mt-3 pt-3 border-t border-teal-200">
        <p className="text-xs text-teal-700 font-medium">Agents in this gate:</p>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {(GATE_AGENTS[gateName] || []).map(agent => (
            <span key={agent} className="px-2 py-0.5 text-xs bg-white border border-teal-300 text-teal-800 rounded-full">{agent}</span>
          ))}
        </div>
      </div>
      {showRerun && (
        <AgentRerunDialog
          caseId={caseId}
          gateName={gateName}
          agents={GATE_AGENTS[gateName] || []}
          onClose={() => setShowRerun(false)}
          onRerun={() => { setShowRerun(false); onAdvanced(); }}
        />
      )}
    </div>
  );
}
