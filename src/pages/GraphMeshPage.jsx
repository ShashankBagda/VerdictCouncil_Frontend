import { useMemo, useState } from 'react'
import ReactFlow, { Background, Controls } from 'reactflow'
import dagre from '@dagrejs/dagre'
import 'reactflow/dist/style.css'
import AgentNode from '../components/AgentNode'

const NODE_WIDTH = 220
const NODE_HEIGHT = 96

const getLayoutedElements = (nodes, edges) => {
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({ rankdir: 'LR', ranksep: 80, nodesep: 40 })

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  })

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target)
  })

  dagre.layout(dagreGraph)

  return {
    nodes: nodes.map((node) => {
      const { x, y } = dagreGraph.node(node.id)
      return {
        ...node,
        position: {
          x: x - NODE_WIDTH / 2,
          y: y - NODE_HEIGHT / 2,
        },
      }
    }),
    edges,
  }
}

const statusLabel = (status) => {
  if (status === 'running') return 'Running'
  if (status === 'waiting_judge') return 'Awaiting Judge'
  if (status === 'approved') return 'Approved'
  if (status === 'completed') return 'Completed'
  if (status === 'redo_requested') return 'Redo Requested'
  return 'Queued'
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
}) {
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

  const nodes = useMemo(
    () =>
      agents.map((agent, index) => ({
        id: agent.id,
        type: 'agentNode',
        data: {
          title: agent.title,
          layer: layerLookup[agent.layerId],
          status: agentStatusMap[agent.id] || 'idle',
          statusLabel: statusLabel(agentStatusMap[agent.id]),
          index: index + 1,
          isRedoTarget: redoTargetAgentId === agent.id,
        },
        position: { x: 0, y: 0 },
      })),
    [agents, agentStatusMap, layerLookup, redoTargetAgentId],
  )

  const edges = useMemo(
    () =>
      agents.slice(0, -1).map((agent, index) => ({
        id: `edge-${agent.id}-${agents[index + 1].id}`,
        source: agent.id,
        target: agents[index + 1].id,
        animated: agentStatusMap[agent.id] === 'running',
        style: { stroke: '#9fb4cc', strokeWidth: 1.4 },
      })),
    [agents, agentStatusMap],
  )

  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => getLayoutedElements(nodes, edges),
    [nodes, edges],
  )

  const nodeTypes = useMemo(() => ({ agentNode: AgentNode }), [])

  return (
    <section className="page-shell">
      <div className="page-hero">
        <h2>Graph Mesh Orchestration</h2>
        <p>
          The orchestrator visualizes the 9-agent pipeline, highlights the active stage,
          and pauses for judge approval based on the selected gate mode.
        </p>
      </div>

      <div className="graph-grid">
        <div className="graph-panel card">
          <div className="graph-canvas">
            <ReactFlow
              nodes={layoutedNodes}
              edges={layoutedEdges}
              nodeTypes={nodeTypes}
              fitView
              nodesDraggable={false}
              nodesConnectable={false}
              zoomOnScroll={false}
              panOnScroll
            >
              <Background color="#dbe5f0" gap={20} />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
          <div>
            <strong>Orchestrator Timeline</strong>
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
                  <span key={stage.id} className={`timeline-item ${timelineClass}`}>
                    {stage.title}
                  </span>
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
                disabled={!effectiveRedirectTarget}
              >
                Send Back to Agent
              </button>
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}

export default GraphMeshPage
