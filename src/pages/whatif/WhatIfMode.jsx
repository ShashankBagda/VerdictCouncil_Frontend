import React, { useState, useEffect } from 'react';
import {
  ToggleLeft,
  ToggleRight,
  Zap,
  TrendingUp,
  Download,
  RefreshCw,
  Copy,
  X,
  AlertCircle,
  CheckCircle,
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

const STABILITY_THRESHOLDS = [
  { range: [0, 33], label: 'Low Stability', color: 'rose', bgColor: 'bg-rose-100' },
  { range: [34, 66], label: 'Moderate Stability', color: 'amber', bgColor: 'bg-amber-100' },
  { range: [67, 100], label: 'High Stability', color: 'emerald', bgColor: 'bg-emerald-100' },
];

export default function WhatIfMode() {
  const { caseId } = useParams();
  const { showError, showNotification } = useAPI();

  // State
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [originalVerdict, setOriginalVerdict] = useState(null);
  const [modifiedVerdict, setModifiedVerdict] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [stability, setStability] = useState(null);
  const [scenarioName, setScenarioName] = useState('');
  const [showCompare, setShowCompare] = useState(false);
  const [viewMode, setViewMode] = useState('original'); // 'original' or 'modified'

  // Scenario modifications
  const [modifications, setModifications] = useState(() => {
    const initial = {};
    SCENARIO_FACTS.forEach((fact) => {
      initial[fact.id] = fact.default;
    });
    return initial;
  });

  // Fetch original verdict on mount
  useEffect(() => {
    const fetchOriginalVerdict = async () => {
      try {
        setLoading(true);
        const res = await api.getVerdict(caseId);
        setOriginalVerdict(res.data);
      } catch (err) {
        const msg = getErrorMessage(err, 'Failed to fetch verdict');
        showError(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchOriginalVerdict();
  }, [caseId, showError]);

  // Calculate stability score
  const calculateStability = (original, modified) => {
    if (!original || !modified) return null;

    let differences = 0;

    // Compare key metrics
    if (original.confidence !== modified.confidence) {
      differences += Math.abs(original.confidence - modified.confidence) / 100;
    }
    if ((original.recommendation || '') !== (modified.recommendation || '')) {
      differences += 1;
    }
    if ((original.remedy || '') !== (modified.remedy || '')) {
      differences += 1;
    }

    const stability = Math.max(0, 100 - differences * 20);
    return Math.round(stability);
  };

  // Run what-if analysis
  const runAnalysis = async () => {
    if (!scenarioName.trim()) {
      showError('Please enter a scenario name');
      return;
    }

    try {
      setAnalyzing(true);

      const res = await api.createWhatIfScenario(caseId, {
        scenario_name: scenarioName,
        modifications,
      });

      const newScenario = {
        id: res.data.scenario_id,
        name: scenarioName,
        modifications: { ...modifications },
        verdict: res.data.verdict,
        timestamp: new Date().toISOString(),
      };

      setModifiedVerdict(res.data.verdict);
      setScenarios((prev) => [...prev, newScenario]);
      setSelectedScenario(newScenario.id);

      const stabilityScore = calculateStability(originalVerdict, res.data.verdict);
      setStability(stabilityScore);
      setViewMode('modified');
      setShowCompare(true);

      showNotification(`Scenario "${scenarioName}" analyzed successfully!`, 'success');
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
    setModifiedVerdict(null);
    setStability(null);
    setShowCompare(false);
    setViewMode('original');
  };

  // Duplicate scenario
  const duplicateScenario = (scenario) => {
    setModifications({ ...scenario.modifications });
    setScenarioName(`${scenario.name} (Copy)`);
    setModifiedVerdict(scenario.verdict);
    setViewMode('modified');
  };

  // Delete scenario
  const deleteScenario = (id) => {
    setScenarios((prev) => prev.filter((s) => s.id !== id));
    if (selectedScenario === id) {
      setSelectedScenario(null);
      setModifiedVerdict(null);
      setShowCompare(false);
    }
  };

  // Get stability label
  const getStabilityLabel = (score) => {
    if (score === null) return null;
    return STABILITY_THRESHOLDS.find((t) => score >= t.range[0] && score <= t.range[1]);
  };

  const stabilityLabel = getStabilityLabel(stability);

  if (loading) {
    return (
      <div className="card-lg flex items-center justify-center h-96">
        <div className="text-center">
          <div className="spinner w-8 h-8 mx-auto mb-4" />
          <p className="text-gray-600">Loading verdict for scenario testing...</p>
        </div>
      </div>
    );
  }

  if (!originalVerdict) {
    return (
      <div className="card-lg text-center py-12">
        <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-4" />
        <p className="text-gray-600">No verdict available for scenario testing</p>
      </div>
    );
  }

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
              Modify case facts and re-analyze to test verdict stability
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

        {/* Right: Stability Score & Saved Scenarios */}
        <div className="space-y-6">
          {/* Stability Gauge */}
          {stability !== null && (
            <div className={`card-lg ${stabilityLabel?.bgColor}`}>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-700 uppercase mb-2">
                  Verdict Stability
                </p>
                <div className="mb-4">
                  <div className="relative w-32 h-32 mx-auto">
                    <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="8"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke={`currentColor`}
                        strokeWidth="8"
                        strokeDasharray={`${(stability / 100) * 282.6} 282.6`}
                        className={`text-${stabilityLabel?.color}-600`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-4xl font-bold text-${stabilityLabel?.color}-700`}>
                        {stability}%
                      </span>
                    </div>
                  </div>
                  <p className={`text-sm font-bold text-center mt-4 text-${stabilityLabel?.color}-700`}>
                    {stabilityLabel?.label}
                  </p>
                </div>
                <p className="text-xs text-gray-600">
                  {stability > 66
                    ? 'Verdict is robust to fact changes'
                    : stability > 33
                      ? 'Verdict moderately sensitive to changes'
                      : 'Verdict highly sensitive to changes'}
                </p>
              </div>
            </div>
          )}

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
                          className="p-1 hover:bg-gray-200 rounded"
                          title="Duplicate"
                        >
                          <Copy className="w-4 h-4 text-gray-600" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteScenario(scenario.id);
                          }}
                          className="p-1 hover:bg-rose-200 rounded"
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

      {/* Comparison View */}
      {showCompare && modifiedVerdict && (
        <div className="card-lg">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
              <TrendingUp className="w-6 h-6" />
              Verdict Comparison
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('original')}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  viewMode === 'original'
                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Original
              </button>
              <button
                onClick={() => setViewMode('modified')}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  viewMode === 'modified'
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Modified Scenario
              </button>
              <button
                onClick={() => setViewMode('both')}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  viewMode === 'both'
                    ? 'bg-purple-100 text-purple-700 border border-purple-300'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Side-by-Side
              </button>
            </div>
          </div>

          {viewMode === 'both' ? (
            <div className="grid grid-cols-2 gap-6">
              {/* Original Verdict */}
              <div className="border border-blue-200 rounded-lg p-6 bg-blue-50">
                <h4 className="font-bold text-navy-900 mb-4 text-lg">Original Verdict</h4>

                <div className="space-y-4">
                  {originalVerdict.recommendation && (
                    <div>
                      <p className="text-sm text-gray-600 font-semibold mb-1">
                        Recommendation
                      </p>
                      <p className="text-lg font-bold text-navy-900">
                        {originalVerdict.recommendation}
                      </p>
                    </div>
                  )}

                  {originalVerdict.confidence !== undefined && (
                    <div>
                      <p className="text-sm text-gray-600 font-semibold mb-1">
                        Confidence
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-gray-300 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${originalVerdict.confidence}%` }}
                          />
                        </div>
                        <span className="font-bold text-blue-700">
                          {originalVerdict.confidence}%
                        </span>
                      </div>
                    </div>
                  )}

                  {originalVerdict.remedy && (
                    <div>
                      <p className="text-sm text-gray-600 font-semibold mb-1">Remedy</p>
                      <p className="text-sm text-gray-800">
                        {originalVerdict.remedy}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Modified Verdict */}
              <div className="border border-emerald-200 rounded-lg p-6 bg-emerald-50">
                <h4 className="font-bold text-navy-900 mb-4 text-lg">
                  Modified Scenario
                </h4>

                <div className="space-y-4">
                  {modifiedVerdict.recommendation && (
                    <div>
                      <p className="text-sm text-gray-600 font-semibold mb-1">
                        Recommendation
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-bold text-navy-900">
                          {modifiedVerdict.recommendation}
                        </p>
                        {modifiedVerdict.recommendation !==
                        originalVerdict.recommendation ? (
                          <AlertCircle className="w-5 h-5 text-rose-600" />
                        ) : (
                          <CheckCircle className="w-5 h-5 text-emerald-600" />
                        )}
                      </div>
                    </div>
                  )}

                  {modifiedVerdict.confidence !== undefined && (
                    <div>
                      <p className="text-sm text-gray-600 font-semibold mb-1">
                        Confidence
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-gray-300 rounded-full h-2">
                          <div
                            className="bg-emerald-600 h-2 rounded-full"
                            style={{ width: `${modifiedVerdict.confidence}%` }}
                          />
                        </div>
                        <span className="font-bold text-emerald-700">
                          {modifiedVerdict.confidence}%
                        </span>
                        {modifiedVerdict.confidence <
                        originalVerdict.confidence && (
                          <span className="text-xs text-rose-600 font-semibold">
                            -
                            {originalVerdict.confidence -
                              modifiedVerdict.confidence}
                            %
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {modifiedVerdict.remedy && (
                    <div>
                      <p className="text-sm text-gray-600 font-semibold mb-1">
                        Remedy
                      </p>
                      <p className="text-sm text-gray-800">
                        {modifiedVerdict.remedy}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : viewMode === 'modified' ? (
            <div className="border border-emerald-200 rounded-lg p-6 bg-emerald-50">
              <h4 className="font-bold text-navy-900 mb-4 text-lg">
                Modified Scenario
              </h4>

              <div className="space-y-4">
                {modifiedVerdict.recommendation && (
                  <div>
                    <p className="text-sm text-gray-600 font-semibold mb-1">
                      Recommendation
                    </p>
                    <p className="text-2xl font-bold text-navy-900">
                      {modifiedVerdict.recommendation}
                    </p>
                  </div>
                )}

                {modifiedVerdict.confidence !== undefined && (
                  <div>
                    <p className="text-sm text-gray-600 font-semibold mb-1">
                      Confidence
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-gray-300 rounded-full h-3">
                        <div
                          className="bg-emerald-600 h-3 rounded-full"
                          style={{ width: `${modifiedVerdict.confidence}%` }}
                        />
                      </div>
                      <span className="text-2xl font-bold text-emerald-700">
                        {modifiedVerdict.confidence}%
                      </span>
                    </div>
                  </div>
                )}

                {modifiedVerdict.remedy && (
                  <div>
                    <p className="text-sm text-gray-600 font-semibold mb-1">
                      Remedy
                    </p>
                    <p className="text-gray-800 whitespace-pre-wrap">
                      {modifiedVerdict.remedy}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="border border-blue-200 rounded-lg p-6 bg-blue-50">
              <h4 className="font-bold text-navy-900 mb-4 text-lg">Original Verdict</h4>

              <div className="space-y-4">
                {originalVerdict.recommendation && (
                  <div>
                    <p className="text-sm text-gray-600 font-semibold mb-1">
                      Recommendation
                    </p>
                    <p className="text-2xl font-bold text-navy-900">
                      {originalVerdict.recommendation}
                    </p>
                  </div>
                )}

                {originalVerdict.confidence !== undefined && (
                  <div>
                    <p className="text-sm text-gray-600 font-semibold mb-1">
                      Confidence
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-gray-300 rounded-full h-3">
                        <div
                          className="bg-blue-600 h-3 rounded-full"
                          style={{ width: `${originalVerdict.confidence}%` }}
                        />
                      </div>
                      <span className="text-2xl font-bold text-blue-700">
                        {originalVerdict.confidence}%
                      </span>
                    </div>
                  </div>
                )}

                {originalVerdict.remedy && (
                  <div>
                    <p className="text-sm text-gray-600 font-semibold mb-1">
                      Remedy
                    </p>
                    <p className="text-gray-800 whitespace-pre-wrap">
                      {originalVerdict.remedy}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Export Button */}
          <button
            onClick={() => {
              showNotification('Scenario comparison exported!', 'success');
            }}
            className="mt-6 w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" />
            Export Comparison
          </button>
        </div>
      )}
    </div>
  );
}
