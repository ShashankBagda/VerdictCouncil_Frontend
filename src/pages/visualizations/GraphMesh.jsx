import React, { useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useParams } from 'react-router-dom';
import { Clock, CheckCircle, AlertCircle, Info, RefreshCw, WifiOff } from 'lucide-react';
import { useAPI, useCase, usePipelineStatus } from '../../hooks';
import { PIPELINE_AGENT_LABELS } from '../../lib/pipelineStatus';

const STATUS_CONFIG = {
  pending: { color: '#e5e7eb', textColor: '#666' },
  running: { color: '#dbeafe', textColor: '#1e40af' },
  completed: { color: '#d1fae5', textColor: '#065f46' },
  failed: { color: '#fee2e2', textColor: '#7f1d1d' },
};

const AGENT_POSITIONS = {
  'case-processing': { x: 0, y: 0 },
  'complexity-routing': { x: 0, y: 150 },
  'evidence-analysis': { x: -200, y: 300 },
  'fact-reconstruction': { x: 0, y: 300 },
  'witness-analysis': { x: 200, y: 300 },
  'legal-knowledge': { x: -200, y: 450 },
  'argument-construction': { x: 100, y: 450 },
  'hearing-analysis': { x: -100, y: 600 },
  'hearing-governance': { x: 100, y: 600 },
};

const AGENT_EDGES = [
  { source: 'case-processing', target: 'complexity-routing' },
  { source: 'complexity-routing', target: 'evidence-analysis' },
  { source: 'complexity-routing', target: 'fact-reconstruction' },
  { source: 'complexity-routing', target: 'witness-analysis' },
  { source: 'evidence-analysis', target: 'legal-knowledge' },
  { source: 'fact-reconstruction', target: 'argument-construction' },
  { source: 'witness-analysis', target: 'argument-construction' },
  { source: 'legal-knowledge', target: 'hearing-analysis' },
  { source: 'argument-construction', target: 'hearing-analysis' },
  { source: 'hearing-analysis', target: 'hearing-governance' },
];

export default function GraphMesh() {
  const { caseId } = useParams();
  const { showError } = useAPI();
  const { updatePipelineStatus } = useCase();
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const {
    loading,
    pipelineStatus,
    error,
    isStale,
    isGivenUp,
    retry,
  } = usePipelineStatus(caseId, {
    onStatus: updatePipelineStatus,
    onError: showError,
  });

  useEffect(() => {
    if (!pipelineStatus?.agents?.length) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const agentMap = Object.fromEntries(
      pipelineStatus.agents.map((agent) => [agent.agent_id, agent]),
    );

    const nextNodes = pipelineStatus.agents.map((agent) => {
      const position = AGENT_POSITIONS[agent.agent_id] || { x: 0, y: 0 };
      const config = STATUS_CONFIG[agent.status] || STATUS_CONFIG.pending;

      return {
        id: agent.agent_id,
        data: {
          label: (
            <div className="text-center font-semibold">
              <div className="text-xs leading-tight">
                {PIPELINE_AGENT_LABELS[agent.agent_id] || agent.name}
              </div>
              <div className="text-xs mt-1 text-gray-600 capitalize">{agent.status}</div>
            </div>
          ),
        },
        position,
        style: {
          background: config.color,
          border: `2px solid ${config.textColor}`,
          borderRadius: '8px',
          padding: '10px',
          width: '160px',
          color: config.textColor,
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          boxShadow: agent.status === 'running' ? `0 0 10px ${config.color}` : 'none',
          whiteSpace: 'normal',
          wordBreak: 'break-word',
        },
      };
    });

    const nextEdges = AGENT_EDGES.map((edge, index) => ({
      id: `edge-${index}`,
      source: edge.source,
      target: edge.target,
      animated: agentMap[edge.source]?.status === 'completed',
      style: {
        stroke:
          agentMap[edge.source]?.status === 'completed'
            ? '#10b981'
            : agentMap[edge.target]?.status === 'running'
              ? '#3b82f6'
              : '#d1d5db',
        strokeWidth: 2,
      },
    }));

    setNodes(nextNodes);
    setEdges(nextEdges);
  }, [pipelineStatus, setEdges, setNodes]);

  const selectedAgent = useMemo(
    () =>
      pipelineStatus?.agents?.find((agent) => agent.agent_id === selectedNode) ||
      null,
    [pipelineStatus, selectedNode],
  );

  if (loading && !pipelineStatus) {
    return (
      <div className="card-lg flex items-center justify-center h-96">
        <div className="text-center">
          <div className="spinner w-8 h-8 mx-auto mb-4" />
          <p className="text-gray-600">Loading pipeline graph...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
      {/* ── Stale / give-up banners (above the graph) ──────────────────── */}
      {isGivenUp && (
        <div className="absolute top-0 left-0 right-0 z-10 bg-rose-50 border-b border-rose-200 px-4 py-2 flex items-center justify-between">
          <p className="text-sm text-rose-700">
            Pipeline polling stopped due to repeated errors.
            {error && <span className="ml-1 text-rose-500">({error})</span>}
          </p>
          <button
            onClick={retry}
            className="text-sm text-teal-700 hover:text-teal-900 flex items-center gap-1 font-semibold"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      )}
      {isStale && !isGivenUp && (
        <div className="absolute top-0 left-0 right-0 z-10 bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2">
          <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700">
            Pipeline data may be stale — waiting for the next update.
          </p>
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => setSelectedNode(node.id)}
        fitView
      >
        <Background color="#aaa" gap={16} />
        <Controls />

        {/* ── Top-left: progress panel ─────────────────────────────────── */}
        <Panel
          position="top-left"
          className="bg-white rounded-lg shadow-lg p-4 border border-gray-200 max-w-sm"
        >
          <h3 className="font-bold text-navy-900 mb-3">Pipeline Status</h3>
          <div className="space-y-2 text-sm">
            <div>
              <p className="text-gray-600">Progress</p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div
                  className="bg-teal-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${pipelineStatus?.overall_progress_percent || 0}%`,
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {pipelineStatus?.overall_progress_percent || 0}%
              </p>
            </div>
            <div className="pt-2 border-t text-xs">
              <p className="text-gray-600">
                {pipelineStatus?.agents?.filter((a) => a.status === 'completed').length || 0} /{' '}
                {pipelineStatus?.agents?.length || 0} agents completed
              </p>
            </div>

            {/* Stale / error indicators */}
            {isStale && !isGivenUp && (
              <div className="pt-2 border-t flex items-center gap-1 text-xs text-amber-600">
                <WifiOff className="w-3 h-3" />
                Data may be stale — waiting for next update
              </div>
            )}
            {isGivenUp && (
              <div className="pt-2 border-t">
                <p className="text-xs text-rose-600 mb-1">
                  Polling stopped due to repeated errors.
                </p>
                <button
                  onClick={retry}
                  className="text-xs text-teal-700 hover:text-teal-900 flex items-center gap-1 underline"
                >
                  <RefreshCw className="w-3 h-3" /> Retry
                </button>
              </div>
            )}
            {error && !isGivenUp && (
              <p className="pt-1 text-xs text-rose-500 truncate" title={error}>
                {error}
              </p>
            )}
          </div>
        </Panel>

        {/* ── Right: selected agent detail ─────────────────────────────── */}
        {selectedAgent && (
          <Panel
            position="right"
            className="bg-white rounded-lg shadow-lg p-4 border border-gray-200 max-w-xs"
          >
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-navy-900 text-sm mb-1">
                  {PIPELINE_AGENT_LABELS[selectedAgent.agent_id] || selectedAgent.name}
                </h4>
                <div className="flex items-center gap-2 mb-2">
                  {selectedAgent.status === 'completed' && (
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                  )}
                  {selectedAgent.status === 'running' && (
                    <Clock className="w-4 h-4 text-blue-600" />
                  )}
                  {selectedAgent.status === 'failed' && (
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                  )}
                  <span className="text-xs font-semibold text-gray-700 capitalize">
                    {selectedAgent.status}
                  </span>
                </div>
              </div>

              <div className="border-t pt-3 space-y-2 text-xs">
                {selectedAgent.start_time && (
                  <div>
                    <p className="text-gray-600">Started</p>
                    <p className="font-mono text-gray-900">
                      {new Date(selectedAgent.start_time).toLocaleTimeString()}
                    </p>
                  </div>
                )}
                {selectedAgent.end_time && (
                  <div>
                    <p className="text-gray-600">Ended</p>
                    <p className="font-mono text-gray-900">
                      {new Date(selectedAgent.end_time).toLocaleTimeString()}
                    </p>
                  </div>
                )}
                {selectedAgent.elapsed_seconds && (
                  <div>
                    <p className="text-gray-600">Duration</p>
                    <p className="font-mono text-gray-900">
                      {selectedAgent.elapsed_seconds}s
                    </p>
                  </div>
                )}
              </div>

              {selectedAgent.error_message && (
                <div className="border-t pt-3">
                  <p className="text-xs text-gray-600 mb-2">Error</p>
                  <p className="text-xs bg-rose-50 text-rose-900 p-2 rounded-sm border border-rose-200 font-mono">
                    {selectedAgent.error_message}
                  </p>
                </div>
              )}

              {selectedAgent.output_summary && (
                <div className="border-t pt-3">
                  <p className="text-xs text-gray-600 mb-2">Output</p>
                  <p className="text-xs bg-blue-50 text-blue-900 p-2 rounded-sm border border-blue-200 whitespace-pre-wrap wrap-break-word max-h-24 overflow-y-auto">
                    {typeof selectedAgent.output_summary === 'string'
                      ? selectedAgent.output_summary
                      : JSON.stringify(selectedAgent.output_summary, null, 2)}
                  </p>
                </div>
              )}
            </div>
          </Panel>
        )}

        {/* ── Bottom-left: help text ───────────────────────────────────── */}
        <Panel
          position="bottom-left"
          className="text-xs text-gray-600 bg-white rounded-sm px-2 py-1 border border-gray-200"
        >
          <p className="flex items-center gap-1">
            <Info className="w-3 h-3" />
            Click nodes to view details · Drag to pan · Scroll to zoom
          </p>
        </Panel>
      </ReactFlow>
    </div>
  );
}
