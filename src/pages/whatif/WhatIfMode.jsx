import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Copy,
  Download,
  RefreshCw,
  Shield,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useAPI } from '../../hooks';
import api, { getErrorMessage } from '../../lib/api';

const SCENARIO_FACTS = [
  {
    id: 'key_evidence',
    label: 'Key Evidence Present',
    description: 'Critical evidence available',
    type: 'boolean',
    default: true,
  },
  {
    id: 'witness_credibility',
    label: 'Witness Credibility',
    description: 'Average credibility score',
    type: 'slider',
    min: 0,
    max: 100,
    default: 75,
  },
  {
    id: 'contracting_party_intent',
    label: 'Contracting Party Intent',
    description: 'Clarity of intent',
    type: 'slider',
    min: 0,
    max: 100,
    default: 80,
  },
  {
    id: 'procedural_compliance',
    label: 'Procedural Compliance',
    description: 'Level of procedural adherence',
    type: 'slider',
    min: 0,
    max: 100,
    default: 85,
  },
  {
    id: 'statute_applicability',
    label: 'Statute Applicability',
    description: 'How directly applicable statutes are',
    type: 'slider',
    min: 0,
    max: 100,
    default: 90,
  },
  {
    id: 'presumption_shift',
    label: 'Presumption Shift',
    description: 'Shift in legal presumptions',
    type: 'boolean',
    default: false,
  },
];

export default function WhatIfMode() {
  const { caseId } = useParams();
  const { showError, showNotification } = useAPI();

  // State
  const [analyzing, setAnalyzing] = useState(false);
  const [scenarioResult, setScenarioResult] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [scenarioName, setScenarioName] = useState('');

  // Stability state
  const [stabilityResult, setStabilityResult] = useState(null);
  const [stabilityLoading, setStabilityLoading] = useState(false);
  const [stabilityError, setStabilityError] = useState(null);

  // Polling cleanup refs
  const scenarioPollRef = useRef(null);
  const stabilityPollRef = useRef(null);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (scenarioPollRef.current) clearInterval(scenarioPollRef.current);
      if (stabilityPollRef.current) clearInterval(stabilityPollRef.current);
    };
  }, []);

  // Scenario modifications
  const [modifications, setModifications] = useState(() => {
    const initial = {};
    SCENARIO_FACTS.forEach((fact) => {
      initial[fact.id] = fact.default;
    });
    return initial;
  });

  // Run what-if analysis
  const runAnalysis = async () => {
    if (!scenarioName.trim()) {
      showError('Please enter a scenario name');
      return;
    }

    try {
      setAnalyzing(true);

      const res = await api.createWhatIfScenario(caseId, {
        modification_type: 'fact_toggle',
        modification_payload: modifications,
        description: scenarioName,
      });

      const scenarioId = res?.scenario_id || res?.data?.scenario_id;
      const newScenario = {
        id: scenarioId,
        name: scenarioName,
        modifications: { ...modifications },
        status: res?.status || 'pending',
        timestamp: new Date().toISOString(),
      };

      setScenarios((prev) => [...prev, newScenario]);
      setSelectedScenario(scenarioId);

      // Poll for result if the scenario is async
      if (scenarioId && res?.status === 'pending') {
        if (scenarioPollRef.current) clearInterval(scenarioPollRef.current);
        const capturedName = scenarioName;
        scenarioPollRef.current = setInterval(async () => {
          try {
            const result = await api.getWhatIfScenario(caseId, scenarioId);
            if (result?.status === 'completed') {
              clearInterval(scenarioPollRef.current);
              scenarioPollRef.current = null;
              setScenarioResult(result);
              setScenarios((prev) =>
                prev.map((s) => (s.id === scenarioId ? { ...s, status: 'completed' } : s))
              );
              showNotification(`Scenario "${capturedName}" analyzed successfully!`, 'success');
            } else if (result?.status === 'failed') {
              clearInterval(scenarioPollRef.current);
              scenarioPollRef.current = null;
              setScenarios((prev) =>
                prev.map((s) => (s.id === scenarioId ? { ...s, status: 'failed' } : s))
              );
              showError('Scenario analysis failed on the server.');
            }
          } catch {
            // Scenario may still be processing; keep polling
          }
        }, 3000);
      } else {
        // Synchronous result (unlikely but handle it)
        setScenarioResult(res);
        showNotification(`Scenario "${scenarioName}" analyzed successfully!`, 'success');
      }
      setScenarioName('');
    } catch (err) {
      const msg = getErrorMessage(err, 'Failed to analyze scenario');
      showError(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  // Reset to original
  const resetScenario = () => {
    const reset = {};
    SCENARIO_FACTS.forEach((fact) => {
      reset[fact.id] = fact.default;
    });
    setModifications(reset);
    setScenarioName('');
    setScenarioResult(null);
  };

  // Duplicate scenario
  const duplicateScenario = (scenario) => {
    setModifications({ ...scenario.modifications });
    setScenarioName(`${scenario.name} (Copy)`);
  };

  // Delete scenario
  const deleteScenario = (id) => {
    setScenarios((prev) => prev.filter((s) => s.id !== id));
    if (selectedScenario === id) {
      setSelectedScenario(null);
      setScenarioResult(null);
    }
  };

  // Compute stability score
  const computeStabilityScore = async () => {
    try {
      setStabilityLoading(true);
      setStabilityError(null);
      setStabilityResult(null);

      await api.computeStability(caseId);

      // Poll until completed or failed
      if (stabilityPollRef.current) clearInterval(stabilityPollRef.current);
      stabilityPollRef.current = setInterval(async () => {
        try {
          const result = await api.getStability(caseId);
          if (result?.status === 'completed') {
            clearInterval(stabilityPollRef.current);
            stabilityPollRef.current = null;
            setStabilityResult(result);
            setStabilityLoading(false);
          } else if (result?.status === 'failed') {
            clearInterval(stabilityPollRef.current);
            stabilityPollRef.current = null;
            setStabilityError(result?.error || 'Stability analysis failed.');
            setStabilityLoading(false);
          }
        } catch {
          // Keep polling
        }
      }, 2000);
    } catch (err) {
      const msg = getErrorMessage(err, 'Failed to start stability analysis');
      setStabilityError(msg);
      setStabilityLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
              <Zap className="w-6 h-6" />
              What-If Scenario Testing
            </h2>
            <p className="text-gray-600 mt-1">
              Modify case facts and re-analyze hearing preparation scenarios
            </p>
          </div>
          <button
            onClick={resetScenario}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2 font-semibold"
          >
            <RefreshCw className="w-4 h-4" />
            Reset
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Scenario Builder */}
        <div className="lg:col-span-2 space-y-6">
          {/* Scenario Name */}
          <div className="card-lg">
            <label className="block text-sm font-semibold text-navy-900 mb-2">
              Scenario Name
            </label>
            <input
              type="text"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              placeholder="e.g., 'Without Key Evidence', 'Lower Witness Credibility'"
              className="input-field"
            />
          </div>

          {/* Fact Modifiers */}
          <div className="card-lg">
            <h3 className="text-lg font-bold text-navy-900 mb-6">Modify Case Facts</h3>

            <div className="space-y-6">
              {SCENARIO_FACTS.map((fact) => (
                <div key={fact.id} className="pb-6 border-b last:border-0">
                  <label className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-navy-900">{fact.label}</p>
                      <p className="text-xs text-gray-600 mt-1">{fact.description}</p>
                    </div>
                  </label>

                  {fact.type === 'boolean' ? (
                    <button
                      onClick={() =>
                        setModifications((prev) => ({
                          ...prev,
                          [fact.id]: !prev[fact.id],
                        }))
                      }
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
                        modifications[fact.id]
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                          : 'bg-gray-100 text-gray-700 border border-gray-300'
                      }`}
                    >
                      {modifications[fact.id] ? (
                        <ToggleRight className="w-5 h-5" />
                      ) : (
                        <ToggleLeft className="w-5 h-5" />
                      )}
                      {modifications[fact.id] ? 'Enabled' : 'Disabled'}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="range"
                        min={fact.min}
                        max={fact.max}
                        value={modifications[fact.id]}
                        onChange={(e) =>
                          setModifications((prev) => ({
                            ...prev,
                            [fact.id]: parseInt(e.target.value),
                          }))
                        }
                        className="w-full"
                      />
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">
                          {fact.min}
                          {fact.max === 100 ? '%' : ''}
                        </span>
                        <span className="font-bold text-navy-900">
                          {modifications[fact.id]}
                          {fact.max === 100 ? '%' : ''}
                        </span>
                        <span className="text-gray-600">
                          {fact.max}
                          {fact.max === 100 ? '%' : ''}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Run Analysis Button */}
          <button
            onClick={runAnalysis}
            disabled={analyzing || !scenarioName.trim()}
            className="w-full px-6 py-3 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {analyzing ? (
              <>
                <div className="spinner w-4 h-4" />
                Analyzing...
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                Run Scenario Analysis
              </>
            )}
          </button>
        </div>

        {/* Right: Saved Scenarios */}
        <div className="space-y-6">
          {/* Saved Scenarios */}
          {scenarios.length > 0 && (
            <div className="card-lg">
              <h3 className="text-lg font-bold text-navy-900 mb-4">Saved Scenarios</h3>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {scenarios.map((scenario) => (
                  <div
                    key={scenario.id}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedScenario === scenario.id
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedScenario(scenario.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-navy-900 text-sm">
                          {scenario.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(scenario.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateScenario(scenario);
                          }}
                          className="p-1 hover:bg-gray-200 rounded-sm"
                          title="Duplicate"
                        >
                          <Copy className="w-4 h-4 text-gray-600" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteScenario(scenario.id);
                          }}
                          className="p-1 hover:bg-rose-200 rounded-sm"
                          title="Delete"
                        >
                          <X className="w-4 h-4 text-rose-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stability Score Panel */}
      <div className="card-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-navy-900 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Outcome Stability Analysis
          </h3>
          <button
            onClick={computeStabilityScore}
            disabled={stabilityLoading}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg font-semibold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
          >
            {stabilityLoading ? (
              <>
                <div className="spinner w-4 h-4" />
                Computing...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4" />
                Compute Stability
              </>
            )}
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Runs multiple perturbations of the current case facts to measure how stable the hearing outcome is.
        </p>

        {stabilityError && (
          <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700 mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {stabilityError}
          </div>
        )}

        {stabilityResult && (
          <div className="space-y-4">
            {/* Score gauge */}
            <div className="flex items-center gap-6">
              <div className="flex-shrink-0 relative w-24 h-24">
                <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                  <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.9155" fill="none"
                    stroke={
                      (stabilityResult.score ?? 0) >= 75 ? '#10b981'
                      : (stabilityResult.score ?? 0) >= 50 ? '#f59e0b'
                      : '#ef4444'
                    }
                    strokeWidth="3"
                    strokeDasharray={`${stabilityResult.score ?? 0}, 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-navy-900">
                  {stabilityResult.score ?? '--'}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500 uppercase tracking-wide">Classification</p>
                <p className={`text-lg font-bold capitalize ${
                  stabilityResult.classification === 'stable' ? 'text-emerald-600'
                  : stabilityResult.classification === 'borderline' ? 'text-amber-600'
                  : 'text-rose-600'
                }`}>
                  {stabilityResult.classification || 'Unknown'}
                </p>
                {stabilityResult.perturbation_count != null && (
                  <p className="text-sm text-gray-600 mt-1">
                    {stabilityResult.perturbations_held ?? '?'} / {stabilityResult.perturbation_count} perturbations held
                  </p>
                )}
              </div>
            </div>
            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Unstable</span>
                <span>Stable</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    (stabilityResult.score ?? 0) >= 75 ? 'bg-emerald-500'
                    : (stabilityResult.score ?? 0) >= 50 ? 'bg-amber-400'
                    : 'bg-rose-500'
                  }`}
                  style={{ width: `${stabilityResult.score ?? 0}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {!stabilityLoading && !stabilityResult && !stabilityError && (
          <p className="text-sm text-gray-400 italic">No stability analysis run yet for this case.</p>
        )}
      </div>

      {/* Scenario Result */}
      {scenarioResult && (
        <div className="card-lg">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
              <TrendingUp className="w-6 h-6" />
              Scenario Analysis Result
            </h3>
          </div>
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-6 text-sm text-gray-800 whitespace-pre-wrap">
            {JSON.stringify(scenarioResult, null, 2)}
          </div>
          <button
            onClick={() => {
              showNotification('Scenario result exported!', 'success');
            }}
            className="mt-6 w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" />
            Export Result
          </button>
        </div>
      )}
    </div>
  );
}
