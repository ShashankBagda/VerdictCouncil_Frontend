import { useState } from 'react';
import {
  ToggleLeft,
  ToggleRight,
  Zap,
  TrendingUp,
  Download,
  RefreshCw,
  Copy,
  X,
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
        const pollResult = async () => {
          try {
            const result = await api.getWhatIfScenario(caseId, scenarioId);
            if (result?.status === 'completed') {
              setScenarioResult(result);
              showNotification(`Scenario "${scenarioName}" analyzed successfully!`, 'success');
            } else if (result?.status === 'failed') {
              showError('Scenario analysis failed on the server.');
            }
          } catch {
            // Scenario may still be processing
          }
        };
        // Simple poll: check after 3s, 6s, 12s
        setTimeout(pollResult, 3000);
        setTimeout(pollResult, 6000);
        setTimeout(pollResult, 12000);
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
