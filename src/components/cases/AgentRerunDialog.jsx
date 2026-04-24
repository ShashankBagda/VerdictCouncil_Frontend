import { useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import api, { getErrorMessage } from '../../lib/api';

export default function AgentRerunDialog({ caseId, gateName, agents, onClose, onRerun }) {
  const [selectedAgent, setSelectedAgent] = useState(agents[0] || '');
  const [instructions, setInstructions] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await api.rerunGate(caseId, gateName, { agentName: selectedAgent, instructions: instructions.trim() || undefined });
      onRerun();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-navy-900">Re-run Agent</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-sm"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Select an agent to re-run from the current gate. The gate will re-execute from that agent through completion, then pause again for review.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Agent</label>
            <select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)} className="input-field w-full">
              {agents.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Additional Instructions (optional)</label>
            <textarea
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              placeholder="Provide specific guidance for this re-run, e.g. 'Focus on the financial records submitted today'"
              className="input-field w-full h-24 resize-none"
            />
          </div>
          {error && <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">{error}</div>}
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={handleSubmit} disabled={submitting} className="btn-primary flex items-center gap-2">
              {submitting ? <div className="spinner-white w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
              {submitting ? 'Submitting...' : 'Re-run'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
