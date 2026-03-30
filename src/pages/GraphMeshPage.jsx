import { useMemo, useState } from 'react'
import ReactFlow, { Background, Controls, MarkerType } from 'reactflow'
import 'reactflow/dist/style.css'
import AgentNode from '../components/AgentNode'

const NODE_WIDTH = 220
const NODE_HEIGHT = 96
const COLUMN_WIDTH = 270
const ROW_HEIGHT = 128

const statusLabel = (status) => {
  if (status === 'running') return 'Running'
  if (status === 'waiting_judge') return 'Awaiting Judge'
  if (status === 'approved') return 'Approved'
  if (status === 'completed') return 'Completed'
  if (status === 'redo_requested') return 'Redo Requested'
  return 'Queued'
}

const formatEventTime = (value) => {
  if (!value) {
    return 'Pending'
  }

  return new Date(value).toLocaleTimeString('en-SG', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const buildLayeredNodes = ({ agents, layers, layerLookup, agentStatusMap, redoTargetAgentId, selectedAgentId }) => {
  const layerGroups = layers.map((layer) => ({
    ...layer,
    agents: agents.filter((agent) => agent.layerId === layer.id),
  }))

  return layerGroups.flatMap((layer, columnIndex) =>
    layer.agents.map((agent, rowIndex) => ({
      id: agent.id,
      type: 'agentNode',
      position: {
        x: 40 + columnIndex * COLUMN_WIDTH,
        y: 40 + rowIndex * ROW_HEIGHT + (layer.agents.length === 2 ? 44 : 0),
      },
      data: {
        title: agent.title,
        layer: layerLookup[agent.layerId],
        status: agentStatusMap[agent.id] || 'idle',
        statusLabel: statusLabel(agentStatusMap[agent.id]),
        index: agents.findIndex((entry) => entry.id === agent.id) + 1,
        isRedoTarget: redoTargetAgentId === agent.id,
        isSelected: selectedAgentId === agent.id,
      },
    })),
  )
}

function GraphMeshPage({
  agents,
  layers,
  agentStatusMap,
  runState,
  currentAgentIndex,
  judgeGateMode,
  setJudgeGateMode,
  approveStep,
  sendBackToAgent,
  redoTargetAgentId,
  pipelineStages,
  agentArtifacts,
  auditEvents,
  judgeNoteDraft,
  setJudgeNoteDraft,
  redirectReasonDraft,
  setRedirectReasonDraft,
}) {
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [redirectTarget, setRedirectTarget] = useState('')

  const layerLookup = useMemo(
    () => Object.fromEntries(layers.map((layer) => [layer.id, layer.title])),
    [layers],
  )

  const availableRedirectAgents = useMemo(
    () => agents.slice(0, Math.max(0, currentAgentIndex)),
    [agents, currentAgentIndex],
  )

  const effectiveRedirectTarget = useMemo(() => {
    if (!availableRedirectAgents.length) {
      return ''
    }
    if (availableRedirectAgents.some((agent) => agent.id === redirectTarget)) {
      return redirectTarget
    }
    return availableRedirectAgents.at(-1).id
  }, [availableRedirectAgents, redirectTarget])

  const activeAgentId = agents[currentAgentIndex]?.id || agents[0]?.id
  const effectiveSelectedAgentId =
    agents.find((agent) => agent.id === selectedAgentId)?.id || activeAgentId
  const selectedAgent = agents.find((agent) => agent.id === effectiveSelectedAgentId) || agents[0]
  const selectedArtifact = agentArtifacts[selectedAgent?.id] || null

  const nodes = useMemo(
    () =>
      buildLayeredNodes({
        agents,
        layers,
        layerLookup,
        agentStatusMap,
        redoTargetAgentId,
        selectedAgentId: effectiveSelectedAgentId,
      }),
    [
      agentStatusMap,
      agents,
      effectiveSelectedAgentId,
      layerLookup,
      layers,
      redoTargetAgentId,
    ],
  )

  const edges = useMemo(
    () =>
      agents.slice(0, -1).map((agent, index) => ({
        id: `edge-${agent.id}-${agents[index + 1].id}`,
        source: agent.id,
        target: agents[index + 1].id,
        type: 'smoothstep',
        animated: agentStatusMap[agent.id] === 'running',
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 18,
          height: 18,
          color: '#9fb4cc',
        },
        style: { stroke: '#9fb4cc', strokeWidth: 1.4 },
      })),
    [agents, agentStatusMap],
  )

  const nodeTypes = useMemo(() => ({ agentNode: AgentNode }), [])

  return (
    <section className="page-shell">
      <div className="page-hero">
        <h2>Graph Mesh Orchestration</h2>
        <p>
          The mesh is arranged by architecture layer so every agent remains visible in a
          single screen, while the judge can still inspect dossier details and reroute
          the flow in context.
        </p>
      </div>

      <div className="graph-grid">
        <div className="graph-panel card">
          <div className="layer-ribbon">
            {layers.map((layer) => (
              <div key={layer.id} className="layer-ribbon-item">
                <span className="micro-label">{layer.title}</span>
                <p>{layer.description}</p>
              </div>
            ))}
          </div>
          <div className="graph-canvas graph-canvas-compact">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.08, minZoom: 0.85, maxZoom: 1 }}
              nodesDraggable={false}
              nodesConnectable={false}
              zoomOnScroll={false}
              zoomOnPinch={false}
              panOnScroll={false}
              panOnDrag={false}
              onNodeClick={(_, node) => setSelectedAgentId(node.id)}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#dbe5f0" gap={22} />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
          <div>
            <div className="section-header compact">
              <strong>Orchestrator Timeline</strong>
              <span
                className={`stage-status ${
                  runState === 'waiting_judge'
                    ? 'waiting_judge'
                    : runState === 'complete'
                      ? 'completed'
                      : runState
                }`}
              >
                {runState === 'idle'
                  ? 'Idle'
                  : runState === 'complete'
                    ? 'Complete'
                    : statusLabel(runState)}
              </span>
            </div>
            <div className="timeline">
              {pipelineStages.map((stage) => {
                const status = agentStatusMap[stage.agentId] || 'idle'
                const timelineClass =
                  status === 'running'
                    ? 'active'
                    : status === 'waiting_judge'
                      ? 'waiting_judge'
                      : status
                return (
                  <button
                    type="button"
                    key={stage.id}
                    className={`timeline-item ${timelineClass} ${
                      effectiveSelectedAgentId === stage.agentId ? 'selected' : ''
                    }`}
                    onClick={() => setSelectedAgentId(stage.agentId)}
                  >
                    {stage.title}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <aside className="judge-panel">
          <div className="card">
            <strong>Judge Console</strong>
            <p>Gate mode controls when the orchestrator pauses for approval.</p>
            <div className="toggle-group">
              <button
                type="button"
                className={judgeGateMode === 'per_agent' ? 'active' : ''}
                onClick={() => setJudgeGateMode('per_agent')}
              >
                Per Agent
              </button>
              <button
                type="button"
                className={judgeGateMode === 'per_layer' ? 'active' : ''}
                onClick={() => setJudgeGateMode('per_layer')}
              >
                Per Layer
              </button>
              <button
                type="button"
                className={judgeGateMode === 'end_only' ? 'active' : ''}
                onClick={() => setJudgeGateMode('end_only')}
              >
                End Only
              </button>
            </div>
            <label className="input-field" style={{ marginTop: '16px' }}>
              Judge Note
              <textarea
                value={judgeNoteDraft}
                onChange={(event) => setJudgeNoteDraft(event.target.value)}
                placeholder="Record approval notes, concerns, or follow-up instructions."
              />
            </label>
            <label className="input-field">
              Redirect Reason
              <textarea
                value={redirectReasonDraft}
                onChange={(event) => setRedirectReasonDraft(event.target.value)}
                placeholder="If rerouting, explain what should be revisited."
              />
            </label>
            <div className="btn-row" style={{ marginTop: '16px' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={approveStep}
                disabled={runState !== 'waiting_judge'}
              >
                Approve and Continue
              </button>
            </div>
          </div>

          <div className="card">
            <strong>Redirect Flow</strong>
            <p>Send the case back to any prior agent for rework.</p>
            <div className="input-field">
              <label htmlFor="redirectTarget">Agent to revisit</label>
              <select
                id="redirectTarget"
                value={effectiveRedirectTarget}
                onChange={(event) => setRedirectTarget(event.target.value)}
                disabled={!availableRedirectAgents.length}
              >
                {availableRedirectAgents.length === 0 ? (
                  <option value="">No prior agents yet</option>
                ) : (
                  availableRedirectAgents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.title}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => sendBackToAgent(effectiveRedirectTarget)}
                disabled={!effectiveRedirectTarget || runState !== 'waiting_judge'}
              >
                Send Back to Agent
              </button>
            </div>
          </div>

          <div className="card">
            <strong>Selected Dossier</strong>
            <div className="dossier-block">
              <span className="micro-label">{layerLookup[selectedAgent.layerId]}</span>
              <h3>{selectedAgent.title}</h3>
              <p>{selectedArtifact?.summary}</p>
            </div>
            <div className="dossier-grid">
              <div className="dossier-item">
                <span>Confidence</span>
                <strong>
                  {selectedArtifact?.confidence ? `${selectedArtifact.confidence}%` : 'Pending'}
                </strong>
              </div>
              <div className="dossier-item">
                <span>Status</span>
                <strong>{statusLabel(agentStatusMap[selectedAgent.id])}</strong>
              </div>
            </div>
            <div className="dossier-block">
              <span className="micro-label">Evidence</span>
              <ul className="detail-list">
                {(selectedArtifact?.evidenceRefs || []).length > 0 ? (
                  selectedArtifact.evidenceRefs.map((entry) => <li key={entry}>{entry}</li>)
                ) : (
                  <li>No evidence references recorded yet.</li>
                )}
              </ul>
            </div>
            <div className="dossier-block">
              <span className="micro-label">Risks</span>
              <ul className="detail-list">
                {(selectedArtifact?.risks || []).length > 0 ? (
                  selectedArtifact.risks.map((entry) => <li key={entry}>{entry}</li>)
                ) : (
                  <li>No risk flags recorded yet.</li>
                )}
              </ul>
            </div>
            <div className="dossier-block">
              <span className="micro-label">Judge Review</span>
              <p>
                {selectedArtifact?.judgeNote || 'No judge comment captured for this stage yet.'}
              </p>
              {selectedArtifact?.redirectReason ? (
                <p className="helper-text">Redirect: {selectedArtifact.redirectReason}</p>
              ) : null}
            </div>
          </div>

          <div className="card">
            <strong>Recent Audit</strong>
            <div className="audit-list">
              {auditEvents.slice(0, 6).map((event) => (
                <article key={event.id} className="audit-item">
                  <div className="audit-meta">
                    <span>{event.actor}</span>
                    <span>{formatEventTime(event.createdAt)}</span>
                  </div>
                  <strong>{event.stageTitle || 'Case Event'}</strong>
                  <p>{event.message}</p>
                </article>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}

export default GraphMeshPage
