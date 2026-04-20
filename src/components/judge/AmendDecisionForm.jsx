import React, { useState } from 'react';
import { Edit3 } from 'lucide-react';

export default function AmendDecisionForm({ onSubmit, submitting = false }) {
  const [recommendationType, setRecommendationType] = useState('manual_decision');
  const [recommendedOutcome, setRecommendedOutcome] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = async () => {
    if (!recommendedOutcome.trim() || !reason.trim()) return;
    await onSubmit?.({
      recommendation_type: recommendationType,
      recommended_outcome: recommendedOutcome.trim(),
      amendment_reason: reason.trim(),
    });
    setRecommendedOutcome('');
    setReason('');
  };

  return (
    <div className="card-lg">
      <h3 className="text-lg font-bold text-navy-900 mb-3 flex items-center gap-2">
        <Edit3 className="w-4 h-4 text-blue-600" />
        Decision Amendment
      </h3>
      <div className="space-y-3">
        <select
          value={recommendationType}
          onChange={(e) => setRecommendationType(e.target.value)}
          className="input-field"
        >
          <option value="manual_decision">Manual Decision</option>
          <option value="compensation">Compensation</option>
          <option value="repair">Repair</option>
          <option value="dismiss">Dismiss</option>
          <option value="guilty">Guilty</option>
          <option value="not_guilty">Not Guilty</option>
          <option value="reduced">Reduced</option>
        </select>

        <textarea
          value={recommendedOutcome}
          onChange={(e) => setRecommendedOutcome(e.target.value)}
          className="input-field min-h-24"
          placeholder="Enter updated outcome text..."
        />

        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="input-field min-h-24"
          placeholder="Describe why this amendment is needed..."
        />

        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={submitting || !recommendedOutcome.trim() || !reason.trim()}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Amendment'}
          </button>
        </div>
      </div>
    </div>
  );
}
