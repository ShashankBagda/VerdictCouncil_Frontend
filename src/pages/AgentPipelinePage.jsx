import { Link } from 'react-router-dom'

const statusLabel = (status) => {
  if (status === 'running') return 'Running'
  if (status === 'waiting_judge') return 'Awaiting Judge'
  if (status === 'approved') return 'Approved'
  if (status === 'completed') return 'Completed'
  if (status === 'redo_requested') return 'Redo Requested'
  return 'Queued'
}

function AgentPipelinePage({
  pipelineStages,
  agentStatusMap,
  currentAgentIndex,
  runState,
  legalPack,
}) {
  const progressCount = pipelineStages.filter((stage, index) => {
    const status = agentStatusMap[stage.agentId]
    if (status === 'approved' || status === 'completed') {
      return true
    }
    if (status === 'running' && index < currentAgentIndex) {
      return true
    }
    return false
  }).length

  const progressPercent = pipelineStages.length
    ? Math.round((progressCount / pipelineStages.length) * 100)
    : 0

  return (
    <section className="page-shell">
      <div className="page-hero">
        <h2>Pipeline Review</h2>
        <p>
          Track every agent in the consolidated architecture, including judge gating and
          rework signals.
        </p>
      </div>

      <div className="card">
        <strong>Workflow Progress</strong>
        <p style={{ margin: '8px 0' }}>{progressPercent}% complete</p>
        <div style={{
          height: '10px',
          background: '#e3e9f1',
          borderRadius: '999px',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${progressPercent}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #003d7c, #ef7c00)',
          }} />
        </div>
        <p style={{ marginTop: '10px', color: 'var(--color-muted)' }}>
          {runState === 'running'
            ? 'Orchestrator is actively processing the case.'
            : runState === 'waiting_judge'
              ? 'Paused for judge approval.'
              : runState === 'complete'
                ? 'Pipeline completed. Final recommendation ready.'
                : 'Pipeline idle. Start from the intake page.'}
        </p>
      </div>

      <div className="pipeline-list">
        {pipelineStages.map((stage) => {
          const status = agentStatusMap[stage.agentId] || 'idle'
          return (
            <div key={stage.id} className="stage-card">
              <div className="stage-header">
                <div>
                  <strong>{stage.title}</strong>
                  <p style={{ margin: '4px 0 0', color: 'var(--color-muted)' }}>
                    {stage.detail}
                  </p>
                </div>
                <span className={`stage-status ${status}`}>{statusLabel(status)}</span>
              </div>
              <p style={{ margin: 0, color: 'var(--color-muted)' }}>
                Output: {status === 'approved' || status === 'completed' ? 'Draft ready' : 'Pending'}
              </p>
            </div>
          )
        })}
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Active Agent</h3>
          <p>
            {pipelineStages[currentAgentIndex]
              ? pipelineStages[currentAgentIndex].title
              : 'No active agent'}
          </p>
        </div>
        <div className="card">
          <h3>{legalPack.title}</h3>
          <ul style={{ margin: '10px 0 0', paddingLeft: '18px' }}>
            {legalPack.details.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card">
        <div className="btn-row">
          <Link className="btn btn-ghost" to="/intake">
            Return to Intake
          </Link>
          <Link className="btn btn-ghost" to="/graph">
            Open Graph Mesh
          </Link>
        </div>
      </div>
    </section>
  )
}

export default AgentPipelinePage
