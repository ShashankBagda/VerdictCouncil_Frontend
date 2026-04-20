import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';

export default function ReopenRequestForm({ onSubmit, submitting = false }) {
  const [reason, setReason] = useState('new_evidence');
  const [justification, setJustification] = useState('');

  const handleSubmit = async () => {
    if (!justification.trim()) return;
    await onSubmit?.({ reason, justification: justification.trim() });
    setJustification('');
  };

  return (
    <div className="card-lg">
      <h3 className="text-lg font-bold text-navy-900 mb-3 flex items-center gap-2">
        <RotateCcw className="w-4 h-4 text-purple-600" />
        Request Case Reopen
      </h3>

      <div className="space-y-3">
        <select value={reason} onChange={(e) => setReason(e.target.value)} className="input-field">
          <option value="new_evidence">New Evidence</option>
          <option value="appeal">Appeal</option>
          <option value="clerical_error">Clerical Error</option>
          <option value="procedural_defect">Procedural Defect</option>
        </select>

        <textarea
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          className="input-field min-h-24"
          placeholder="Provide legal/procedural justification for reopening this case..."
        />

        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={submitting || !justification.trim()}
            className="px-4 py-2 rounded-lg bg-purple-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-purple-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Reopen Request'}
          </button>
        </div>
      </div>
    </div>
  );
}
