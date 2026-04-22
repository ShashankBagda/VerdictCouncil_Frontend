import { useState, useEffect } from 'react';
import api, { getErrorMessage } from '../../lib/api';

export default function DecisionEntryForm({ caseId, hearingAnalysis, onDecisionRecorded, onCancel }) {
  const [verdictText, setVerdictText] = useState('');
  const [engagements, setEngagements] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const derived = [];
    if (hearingAnalysis?.preliminary_conclusion) {
      derived.push({ conclusion_type: 'verdict_recommendation', conclusion_id: null, agreed: null, reasoning: '' });
    }
    if (Array.isArray(hearingAnalysis?.risks)) {
      hearingAnalysis.risks.forEach(() => {
        derived.push({ conclusion_type: 'fairness_flag', conclusion_id: null, agreed: null, reasoning: '' });
      });
    }
    setEngagements(derived);
  }, [hearingAnalysis]);

  function updateEngagement(idx, field, value) {
    setEngagements(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  }

  async function handleSubmit() {
    if (!verdictText.trim()) {
      setError('Verdict text is required.');
      return;
    }
    const invalid = engagements.find(e => e.agreed === false && !e.reasoning.trim());
    if (invalid) {
      setError('Provide reasoning for every conclusion you disagree with.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.recordDecision(caseId, { verdict_text: verdictText.trim(), ai_engagements: engagements });
      onDecisionRecorded();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card-lg border-2 border-navy-900">
      <h3 className="text-lg font-bold text-navy-900 mb-4">Record Judicial Decision</h3>

      <div className="mb-5">
        <label className="block text-sm font-semibold text-gray-700 mb-1">Verdict Text *</label>
        <textarea
          value={verdictText}
          onChange={e => setVerdictText(e.target.value)}
          placeholder="State your judicial decision..."
          className="input-field w-full h-32 resize-none"
        />
      </div>

      {engagements.length > 0 && (
        <div className="mb-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">AI Conclusion Engagement</p>
          <p className="text-xs text-gray-500 mb-3">You must agree or disagree with each AI conclusion. Provide reasoning when you disagree.</p>
          {engagements.map((eng, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-4 mb-3">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {eng.conclusion_type.replace(/_/g, ' ')}
                  </span>
                  <p className="text-sm text-gray-800 mt-0.5">
                    {idx === 0 && hearingAnalysis?.preliminary_conclusion
                      ? hearingAnalysis.preliminary_conclusion
                      : hearingAnalysis?.risks?.[idx - 1] || 'AI flag'}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => updateEngagement(idx, 'agreed', true)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${eng.agreed === true ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-emerald-50'}`}
                  >Agree</button>
                  <button
                    onClick={() => updateEngagement(idx, 'agreed', false)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${eng.agreed === false ? 'bg-rose-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-rose-50'}`}
                  >Disagree</button>
                </div>
              </div>
              {eng.agreed === false && (
                <textarea
                  value={eng.reasoning}
                  onChange={e => updateEngagement(idx, 'reasoning', e.target.value)}
                  placeholder="Explain your reasoning for disagreeing..."
                  className="input-field w-full h-20 resize-none mt-2"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {error && <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">{error}</div>}

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="btn-secondary">Cancel</button>
        <button onClick={handleSubmit} disabled={submitting} className="btn-primary flex items-center gap-2">
          {submitting ? <div className="spinner-white w-4 h-4" /> : null}
          {submitting ? 'Recording...' : 'Record Decision'}
        </button>
      </div>
    </div>
  );
}
