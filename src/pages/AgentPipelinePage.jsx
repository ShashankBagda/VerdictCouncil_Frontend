import { Link } from 'react-router-dom'

function AgentPipelinePage({
  pipelinePhases,
  simulationState,
  phaseIndex,
  progressPercent,
  activeRoomNames,
  legalPack,
}) {
  const stageCards = pipelinePhases.map((phase, index) => {
    let status = 'pending'
    if (simulationState === 'complete' || index < phaseIndex) {
      status = 'done'
    } else if (simulationState === 'running' && index === phaseIndex) {
      status = 'active'
    }
    return { ...phase, status }
  })

  return (
    <section className="panel-frame page-panel">
      <header className="page-header">
        <div>
          <h2>Agent Pipeline</h2>
          <p className="section-note">
            Sequential orchestration based on VerdictCouncil v4 architecture.
          </p>
        </div>
      </header>

      <section className="progress-shell">
        <header>
          <span>Workflow Progress</span>
          <strong>{progressPercent}%</strong>
        </header>
        <div className="progress-track">
          <div style={{ width: `${progressPercent}%` }} />
        </div>
        <p>
          {simulationState === 'running'
            ? pipelinePhases[phaseIndex]?.detail
            : simulationState === 'complete'
              ? 'Agent run finished. Recommendation is ready for human review.'
              : 'Pipeline idle. Start from intake page.'}
        </p>
      </section>

      <ul className="stage-list">
        {stageCards.map((phase) => (
          <li key={phase.id} className={`stage-card ${phase.status}`}>
            <h3>{phase.title}</h3>
            <small>{phase.detail}</small>
          </li>
        ))}
      </ul>

      <div className="pipeline-bottom">
        <section className="live-rooms">
          <h3>Active Rooms</h3>
          {activeRoomNames.length > 0 ? (
            <ul>
              {activeRoomNames.map((roomName) => (
                <li key={roomName}>{roomName}</li>
              ))}
            </ul>
          ) : (
            <p>No active rooms right now.</p>
          )}
        </section>

        <section className="legal-context">
          <h3>{legalPack.title}</h3>
          <ul>
            {legalPack.details.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="page-footer">
        <Link to="/intake" className="inline-link">
          Go to Intake Page
        </Link>
        <Link to="/building" className="inline-link">
          Go to Building Page
        </Link>
      </footer>
    </section>
  )
}

export default AgentPipelinePage
