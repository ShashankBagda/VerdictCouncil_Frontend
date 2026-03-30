import { Link } from 'react-router-dom'

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

function AgentPipelinePage({
  pipelineStages,
  agentStatusMap,
  currentAgentIndex,
  runState,
  legalPack,
  agentArtifacts,
  auditEvents,
  judgeGateMode,
}) {
  const progressCount = pipelineStages.filter((stage) => {
    const status = agentStatusMap[stage.agentId]
    return status === 'approved' || status === 'completed'
  }).length

  const progressPercent = pipelineStages.length
    ? Math.round((progressCount / pipelineStages.length) * 100)
    : 0

  return (
    <section className="page-shell">
      <div className="page-hero">
        <h2>Pipeline Review</h2>
        <p>
          Track every agent in the consolidated architecture, inspect dossier outputs,
          and review judge decisions across the full orchestration run.
        </p>
      </div>

      <div className="card">
        <div className="section-header compact">
          <div>
            <strong>Workflow Progress</strong>
            <p className="helper-text">
              Current gate mode: {judgeGateMode.replace('_', ' ')}
            </p>
          </div>
          <span
            className={`stage-status ${
              runState === 'waiting_judge'
                ? 'waiting_judge'
                : runState === 'complete'
                  ? 'completed'
                  : runState
            }`}
          >
            {runState === 'idle' ? 'Idle' : runState === 'complete' ? 'Completed' : statusLabel(runState)}
          </span>
        </div>
        <p style={{ margin: '8px 0' }}>{progressPercent}% complete</p>
        <div
          style={{
            height: '10px',
            background: '#e3e9f1',
            borderRadius: '999px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progressPercent}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #003d7c, #ef7c00)',
            }}
          />
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
        {pipelineStages.map((stage, index) => {
          const status = agentStatusMap[stage.agentId] || 'idle'
          const artifact = agentArtifacts[stage.agentId]
          return (
            <div key={stage.id} className="stage-card">
              <div className="stage-header">
                <div>
                  <span className="micro-label">Stage {index + 1}</span>
                  <strong>{stage.title}</strong>
                  <p style={{ margin: '4px 0 0', color: 'var(--color-muted)' }}>
                    {stage.detail}
                  </p>
                </div>
                <span className={`stage-status ${status}`}>{statusLabel(status)}</span>
              </div>
              <div className="dossier-grid">
                <div className="dossier-item">
                  <span>Output</span>
                  <strong>
                    {artifact?.summary && artifact.summary !== 'No output generated yet.'
                      ? 'Draft ready'
                      : 'Pending'}
                  </strong>
                </div>
                <div className="dossier-item">
                  <span>Confidence</span>
                  <strong>{artifact?.confidence ? `${artifact.confidence}%` : 'Pending'}</strong>
                </div>
              </div>
              <p className="stage-summary">{artifact?.summary}</p>
              <div className="dossier-grid">
                <div className="dossier-item">
                  <span>Judge Decision</span>
                  <strong>
                    {artifact?.judgeDecision === 'approved'
                      ? 'Judge Approved'
                      : artifact?.judgeDecision === 'redirected'
                        ? 'Redirected'
                        : status === 'waiting_judge'
                          ? 'Awaiting Judge'
                          : 'Not Reviewed'}
                  </strong>
                </div>
                <div className="dossier-item">
                  <span>Reviewed At</span>
                  <strong>{formatEventTime(artifact?.reviewedAt)}</strong>
                </div>
              </div>
              {artifact?.judgeNote ? (
                <p className="stage-note">Judge note: {artifact.judgeNote}</p>
              ) : null}
              {artifact?.redirectReason ? (
                <p className="stage-note">Redirect reason: {artifact.redirectReason}</p>
              ) : null}
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
          <p className="helper-text">
            Use the graph mesh to review the live dossier and approve or reroute the
            current step.
          </p>
        </div>
        <div className="card">
          <h3>{legalPack.title}</h3>
          <ul className="detail-list">
            {legalPack.details.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card">
        <div className="section-header compact">
          <div>
            <h3>Audit History</h3>
            <p className="helper-text">Latest case events across intake, review, and reroutes.</p>
          </div>
        </div>
        <div className="audit-list">
          {auditEvents.map((event) => (
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

      <div className="card">
        <div className="btn-row">
          <Link className="btn btn-ghost" to="/intake">
            Return to Intake
          </Link>
          <Link className="btn btn-ghost" to="/graph">
            Open Graph Mesh
          </Link>
          <Link className="btn btn-ghost" to="/dossier">
            Open Case Dossier
          </Link>
        </div>
      </div>
    </section>
  )
}

export default AgentPipelinePage
