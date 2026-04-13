import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useAPI } from '../../hooks';
import { useCase } from '../../hooks';
import api from '../../lib/api';

// Agent metadata for display
const AGENT_METADATA = {
  'fact-reconstruction': {
    label: 'Fact Reconstruction',
    floor: 4,
    color: 'blue',
    icon: '📋',
  },
  'evidence-analysis': {
    label: 'Evidence Analysis',
    floor: 4,
    color: 'blue',
    icon: '🔍',
  },
  'witness-analysis': {
    label: 'Witness Analysis',
    floor: 3,
    color: 'purple',
    icon: '👤',
  },
  'legal-knowledge': {
    label: 'Legal Knowledge',
    floor: 3,
    color: 'purple',
    icon: '⚖️',
  },
  'argument-construction': {
    label: 'Argument Construction',
    floor: 2,
    color: 'green',
    icon: '🗣️',
  },
  'complexity-routing': {
    label: 'Complexity Routing',
    floor: 2,
    color: 'green',
    icon: '🎯',
  },
  'deliberation': {
    label: 'Deliberation',
    floor: 1,
    color: 'amber',
    icon: '🤔',
  },
  'governance-verdict': {
    label: 'Governance & Verdict',
    floor: 1,
    color: 'amber',
    icon: '⚡',
  },
  'layer2-aggregator': {
    label: 'Layer 2 Aggregator',
    floor: 1,
    color: 'red',
    icon: '🔗',
  },
};

const STATUS_CONFIG = {
  pending: { label: 'Pending', icon: Clock, color: 'gray', bgColor: 'bg-gray-50' },
  running: { label: 'Running', icon: Clock, color: 'blue', bgColor: 'bg-blue-50' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'emerald', bgColor: 'bg-emerald-50' },
  failed: { label: 'Failed', icon: AlertCircle, color: 'rose', bgColor: 'bg-rose-50' },
};

export default function BuildingSimulation() {
  const { caseId } = useParams();
  const { showError } = useAPI();
  const { pipelineStatus: cachedStatus, updatePipelineStatus } = useCase();

  const [loading, setLoading] = useState(true);
  const [pipelineStatus, setPipelineStatus] = useState(null);
  const [expandedAgent, setExpandedAgent] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState(null);

  // Fetch pipeline status on mount
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setLoading(true);
        const res = await api.getPipelineStatus(caseId);
        setPipelineStatus(res.data);
        updatePipelineStatus(res.data);
      } catch (err) {
        const msg = err.response?.data?.detail || 'Failed to fetch pipeline status';
        showError(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();

    // Optional: Poll for updates every 5 seconds
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [caseId, showError, updatePipelineStatus]);

  // Use cached status if initial load failed
  const status = pipelineStatus || cachedStatus;

  // Group agents by floor
  const agentsByFloor = {
    4: [],
    3: [],
    2: [],
    1: [],
  };

  if (status?.agents) {
    status.agents.forEach((agent) => {
      const meta = AGENT_METADATA[agent.agent_id];
      if (meta) {
        agentsByFloor[meta.floor].push({ ...agent, meta });
      }
    });
  }

  // Get agent status
  const getAgentStatus = (agentId) => {
    if (!status?.agents) return 'pending';
    const agent = status.agents.find((a) => a.agent_id === agentId);
    return agent?.status || 'pending';
  };

  if (loading) {
    return (
      <div className="card-lg flex items-center justify-center h-96">
        <div className="text-center">
          <div className="spinner w-8 h-8 mx-auto mb-4" />
          <p className="text-gray-600">Loading building visualization...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-navy-900 mb-2">Verdict Council Building</h2>
            <p className="text-gray-600">
              9-agent analysis pipeline processing case {caseId}
            </p>
          </div>
          {status && (
            <div className="text-right">
              <p className="text-sm text-gray-600 mb-1">Overall Progress</p>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-gray-200 rounded-full">
                  <div
                    className="h-2 bg-teal-500 rounded-full transition-all"
                    style={{ width: `${status.overall_progress_percent || 0}%` }}
                  />
                </div>
                <span className="text-lg font-bold text-teal-600">
                  {status.overall_progress_percent || 0}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Building Visualization */}
      <div className="card-lg bg-gradient-to-br from-sky-50 to-blue-50">
        <div className="space-y-8">
          {/* Floors from top to bottom */}
          {[4, 3, 2, 1].map((floorNum) => (
            <div key={floorNum} className="border-b border-gray-200 pb-8 last:border-0">
              {/* Floor Label */}
              <div className="flex items-center gap-4 mb-6">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-lg bg-navy-900 text-white flex items-center justify-center font-bold text-lg">
                    {floorNum}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Floor</p>
                </div>
                <h3 className="text-xl font-bold text-navy-900">
                  {floorNum === 4
                    ? 'Evidence Layer'
                    : floorNum === 3
                      ? 'Analysis Layer'
                      : floorNum === 2
                        ? 'Argumentation Layer'
                        : 'Decision Layer'}
                </h3>
              </div>

              {/* Agents on this floor */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ml-16">
                {agentsByFloor[floorNum].length > 0 ? (
                  agentsByFloor[floorNum].map((agent) => {
                    const statusConfig = STATUS_CONFIG[agent.status] || STATUS_CONFIG.pending;
                    const StatusIcon = statusConfig.icon;
                    const isExpanded = expandedAgent === agent.agent_id;

                    return (
                      <button
                        key={agent.agent_id}
                        onClick={() =>
                          setExpandedAgent(isExpanded ? null : agent.agent_id)
                        }
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                          statusConfig.bgColor
                        } border-${statusConfig.color}-300 hover:shadow-md`}
                      >
                        {/* Agent Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-2xl">{agent.meta.icon}</span>
                              <h4 className="font-semibold text-navy-900 text-sm">
                                {agent.meta.label}
                              </h4>
                            </div>
                            <div className="flex items-center gap-2">
                              <StatusIcon
                                className={`w-4 h-4 text-${statusConfig.color}-600`}
                              />
                              <span
                                className={`text-xs font-semibold text-${statusConfig.color}-700`}
                              >
                                {statusConfig.label}
                              </span>
                            </div>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-600 flex-shrink-0" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-600 flex-shrink-0" />
                          )}
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="mt-4 pt-4 border-t border-gray-200 space-y-2 text-xs">
                            {agent.start_time && (
                              <div>
                                <p className="text-gray-600">Started:</p>
                                <p className="font-mono text-gray-900">
                                  {new Date(agent.start_time).toLocaleTimeString()}
                                </p>
                              </div>
                            )}
                            {agent.end_time && (
                              <div>
                                <p className="text-gray-600">Ended:</p>
                                <p className="font-mono text-gray-900">
                                  {new Date(agent.end_time).toLocaleTimeString()}
                                </p>
                              </div>
                            )}
                            {agent.elapsed_seconds && (
                              <div>
                                <p className="text-gray-600">Duration:</p>
                                <p className="font-mono text-gray-900">
                                  {agent.elapsed_seconds}s
                                </p>
                              </div>
                            )}
                            {agent.error_message && (
                              <div className="mt-2 p-2 bg-rose-100 rounded border border-rose-200">
                                <p className="text-rose-900 font-mono text-xs">
                                  {agent.error_message}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="text-gray-500 italic text-sm">
                    No agents on this floor
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Status Legend */}
      <div className="card-lg">
        <h3 className="font-semibold text-navy-900 mb-4">Status Legend</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(STATUS_CONFIG).map(([key, config]) => {
            const Icon = config.icon;
            return (
              <div key={key} className="flex items-center gap-3">
                <Icon className={`w-5 h-5 text-${config.color}-600`} />
                <span className={`text-sm text-${config.color}-900`}>{config.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
