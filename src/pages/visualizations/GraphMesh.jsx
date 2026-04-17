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
import { Clock, CheckCircle, AlertCircle, Info } from 'lucide-react';
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
  'fact-reconstruction': { x: -180, y: 130 },
  'evidence-analysis': { x: 0, y: 130 },
  'witness-analysis': { x: 180, y: 130 },
  'legal-knowledge': { x: -110, y: 280 },
  'argument-construction': { x: 110, y: 280 },
  'complexity-routing': { x: 0, y: 430 },
  'deliberation': { x: -120, y: 580 },
  'governance-verdict': { x: 120, y: 580 },
};

const AGENT_EDGES = [
  { source: 'case-processing', target: 'fact-reconstruction' },
  { source: 'case-processing', target: 'evidence-analysis' },
  { source: 'case-processing', target: 'witness-analysis' },
  { source: 'fact-reconstruction', target: 'argument-construction' },
  { source: 'evidence-analysis', target: 'legal-knowledge' },
  { source: 'witness-analysis', target: 'argument-construction' },
  { source: 'legal-knowledge', target: 'complexity-routing' },
  { source: 'argument-construction', target: 'complexity-routing' },
  { source: 'complexity-routing', target: 'deliberation' },
  { source: 'complexity-routing', target: 'governance-verdict' },
];

export default function GraphMesh() {
  const { caseId } = useParams();
  const { showError } = useAPI();
  const { updatePipelineStatus } = useCase();
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const { loading, pipelineStatus } = usePipelineStatus(caseId, {
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
            <div className="text-center text-xs font-semibold">
              <div className="text-sm">{PIPELINE_AGENT_LABELS[agent.agent_id] || agent.name}</div>
              <div className="text-xs mt-1 text-gray-600 capitalize">{agent.status}</div>
            </div>
          ),
        },
        position,
        style: {
          background: config.color,
          border: `2px solid ${config.textColor}`,
          borderRadius: '8px',
          padding: '12px',
          width: '150px',
          color: config.textColor,
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          boxShadow: agent.status === 'running' ? `0 0 10px ${config.color}` : 'none',
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

  const selectedAgent = useMemo(() => (
    pipelineStatus?.agents?.find((agent) => agent.agent_id === selectedNode) || null
  ), [pipelineStatus, selectedNode]);

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

        <Panel position="top-left" className="bg-white rounded-lg shadow-lg p-4 border border-gray-200 max-w-sm">
          <h3 className="font-bold text-navy-900 mb-3">Pipeline Status</h3>
          <div className="space-y-2 text-sm">
            <div>
              <p className="text-gray-600">Progress</p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div
                  className="bg-teal-500 h-2 rounded-full transition-all"
                  style={{ width: `${pipelineStatus?.overall_progress_percent || 0}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {pipelineStatus?.overall_progress_percent || 0}%
              </p>
            </div>
            <div className="pt-2 border-t text-xs">
              <p className="text-gray-600">
                {pipelineStatus?.agents?.filter((agent) => agent.status === 'completed').length || 0} /
                {pipelineStatus?.agents?.length || 0} agents completed
              </p>
            </div>
          </div>
        </Panel>

        {selectedAgent && (
          <Panel position="right" className="bg-white rounded-lg shadow-lg p-4 border border-gray-200 max-w-xs">
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
                    <p className="font-mono text-gray-900">{selectedAgent.elapsed_seconds}s</p>
                  </div>
                )}
              </div>

              {selectedAgent.error_message && (
                <div className="border-t pt-3">
                  <p className="text-xs text-gray-600 mb-2">Error</p>
                  <p className="text-xs bg-rose-50 text-rose-900 p-2 rounded border border-rose-200 font-mono">
                    {selectedAgent.error_message}
                  </p>
                </div>
              )}

              {selectedAgent.output_summary && (
                <div className="border-t pt-3">
                  <p className="text-xs text-gray-600 mb-2">Output</p>
                  <p className="text-xs bg-blue-50 text-blue-900 p-2 rounded border border-blue-200 whitespace-pre-wrap break-words max-h-24 overflow-y-auto">
                    {typeof selectedAgent.output_summary === 'string'
                      ? selectedAgent.output_summary
                      : JSON.stringify(selectedAgent.output_summary, null, 2)}
                  </p>
                </div>
              )}
            </div>
          </Panel>
        )}

        <Panel position="bottom-left" className="text-xs text-gray-600 bg-white rounded px-2 py-1 border border-gray-200">
          <p className="flex items-center gap-1">
            <Info className="w-3 h-3" />
            Click nodes to view details • Drag to pan • Scroll to zoom
          </p>
        </Panel>
      </ReactFlow>
    </div>
  );
}
