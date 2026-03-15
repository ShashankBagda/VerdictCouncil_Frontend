import { Link } from 'react-router-dom'

function AppealIntakePage({
  formState,
  onFieldChange,
  canSubmitAppeal,
  canStartSimulation,
  submitAppeal,
  startAgentSimulation,
  resetFlow,
  appealSubmitted,
  appealId,
  disputeSubmitted,
  simulationState,
  startedAt,
}) {
  return (
    <section className="panel-frame page-panel">
      <header className="page-header">
        <div>
          <h2>Appeal and Dispute Intake</h2>
          <p className="section-note">
            Step 1: submit appeal packet. Step 2: attach dispute details and trigger
            agent pipeline.
          </p>
        </div>
      </header>

      <div className="form-grid">
        <label>
          Case Title
          <input
            name="caseTitle"
            value={formState.caseTitle}
            onChange={onFieldChange}
            placeholder="Late delivery refund dispute"
          />
        </label>

        <label>
          Domain
          <select name="domain" value={formState.domain} onChange={onFieldChange}>
            <option value="small_claims">Small Claims Tribunal</option>
            <option value="traffic_violation">Traffic Violation</option>
          </select>
        </label>

        <label>
          Appellant
          <input
            name="appellant"
            value={formState.appellant}
            onChange={onFieldChange}
            placeholder="Claimant full name"
          />
        </label>

        <label>
          Respondent
          <input
            name="respondent"
            value={formState.respondent}
            onChange={onFieldChange}
            placeholder="Respondent full name"
          />
        </label>

        <label>
          Claim / Fine Amount
          <input
            name="claimAmount"
            type="number"
            min="0"
            value={formState.claimAmount}
            onChange={onFieldChange}
            placeholder="Optional amount"
          />
        </label>

        <label className="span-2">
          Appeal Reason
          <textarea
            name="appealReason"
            value={formState.appealReason}
            onChange={onFieldChange}
            placeholder="Why this appeal should be accepted by the court."
          />
        </label>

        <label>
          Dispute Type
          <select name="disputeType" value={formState.disputeType} onChange={onFieldChange}>
            <option value="">Choose dispute type</option>
            <option value="refund_dispute">Refund dispute</option>
            <option value="service_complaint">Service complaint</option>
            <option value="contract_disagreement">Contract disagreement</option>
            <option value="traffic_offence">Traffic offence challenge</option>
          </select>
        </label>

        <label className="span-2">
          Dispute Narrative
          <textarea
            name="disputeSummary"
            value={formState.disputeSummary}
            onChange={onFieldChange}
            placeholder="Timeline, parties involved, and requested remedy."
          />
        </label>

        <label className="span-2">
          Evidence Notes
          <textarea
            name="evidenceNotes"
            value={formState.evidenceNotes}
            onChange={onFieldChange}
            placeholder="Receipts, photos, statements, traffic reports, supporting files."
          />
        </label>
      </div>

      <div className="action-row">
        <button
          className="primary-btn"
          type="button"
          disabled={!canSubmitAppeal}
          onClick={submitAppeal}
        >
          1. Submit Appeal Packet
        </button>
        <button
          className="primary-btn emphasize"
          type="button"
          disabled={!canStartSimulation}
          onClick={startAgentSimulation}
        >
          2. Add Dispute and Start Agents
        </button>
        <button className="ghost-btn" type="button" onClick={resetFlow}>
          Reset
        </button>
      </div>

      <div className="state-grid">
        <article>
          <span className={`dot ${appealSubmitted ? 'live' : ''}`} />
          <div>
            <strong>Appeal Packet</strong>
            <p>{appealSubmitted ? `Registered: ${appealId}` : 'Awaiting submission'}</p>
          </div>
        </article>
        <article>
          <span className={`dot ${disputeSubmitted ? 'live' : ''}`} />
          <div>
            <strong>Dispute Case Memory</strong>
            <p>{disputeSubmitted ? 'Dispute attached to shared state' : 'Not attached yet'}</p>
          </div>
        </article>
        <article>
          <span className={`dot ${simulationState === 'running' ? 'live' : ''}`} />
          <div>
            <strong>Agent Pipeline</strong>
            <p>
              {simulationState === 'running'
                ? `Running since ${startedAt}`
                : simulationState === 'complete'
                  ? 'Completed. Human review pending.'
                  : 'Idle'}
            </p>
          </div>
        </article>
      </div>

      <footer className="page-footer">
        <Link to="/building" className="inline-link">
          Open Building Simulation
        </Link>
        <Link to="/pipeline" className="inline-link">
          Open Agent Pipeline Page
        </Link>
      </footer>
    </section>
  )
}

export default AppealIntakePage
