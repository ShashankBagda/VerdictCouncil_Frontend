import { Link } from 'react-router-dom'

const formatSize = (bytes) => {
  if (!bytes && bytes !== 0) return '0 KB'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function AppealIntakePage({
  formState,
  onFieldChange,
  canSubmitAppeal,
  canStartSimulation,
  submitAppeal,
  startOrchestrator,
  resetFlow,
  appealSubmitted,
  appealId,
  disputeSubmitted,
  runState,
  startedAt,
  uploadedFiles,
  onFilesSelected,
  onFileNoteChange,
  onFileRemove,
  loadDemoCase,
}) {
  return (
    <section className="page-shell">
      <div className="page-hero">
        <h2>Appeal Intake & Case Assembly</h2>
        <p>
          Submit the appeal packet, attach dispute materials, and prepare the orchestration
          run. Files are captured as metadata only until backend integration.
        </p>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Case Intake Form</h3>
          <div className="form-grid" style={{ marginTop: '12px' }}>
            <label className="input-field">
              Case Title
              <input
                name="caseTitle"
                value={formState.caseTitle}
                onChange={onFieldChange}
                placeholder="Late delivery refund dispute"
              />
            </label>

            <label className="input-field">
              Domain
              <select name="domain" value={formState.domain} onChange={onFieldChange}>
                <option value="small_claims">Small Claims Tribunal</option>
                <option value="traffic_violation">Traffic Violation</option>
              </select>
            </label>

            <label className="input-field">
              Appellant
              <input
                name="appellant"
                value={formState.appellant}
                onChange={onFieldChange}
                placeholder="Claimant full name"
              />
            </label>

            <label className="input-field">
              Respondent
              <input
                name="respondent"
                value={formState.respondent}
                onChange={onFieldChange}
                placeholder="Respondent full name"
              />
            </label>

            <label className="input-field">
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

            <label className="input-field span-2">
              Appeal Reason
              <textarea
                name="appealReason"
                value={formState.appealReason}
                onChange={onFieldChange}
                placeholder="Why this appeal should be accepted."
              />
            </label>

            <label className="input-field">
              Dispute Type
              <select name="disputeType" value={formState.disputeType} onChange={onFieldChange}>
                <option value="">Choose dispute type</option>
                <option value="refund_dispute">Refund dispute</option>
                <option value="service_complaint">Service complaint</option>
                <option value="contract_disagreement">Contract disagreement</option>
                <option value="traffic_offence">Traffic offence challenge</option>
              </select>
            </label>

            <label className="input-field span-2">
              Dispute Narrative
              <textarea
                name="disputeSummary"
                value={formState.disputeSummary}
                onChange={onFieldChange}
                placeholder="Timeline, parties involved, and requested remedy."
              />
            </label>

            <label className="input-field span-2">
              Evidence Notes
              <textarea
                name="evidenceNotes"
                value={formState.evidenceNotes}
                onChange={onFieldChange}
                placeholder="Receipts, photos, statements, traffic reports, supporting files."
              />
            </label>

            <label className="input-field span-2">
              Attach Intake Files
              <input type="file" multiple onChange={onFilesSelected} />
            </label>
          </div>

          <p className="helper-text">
            Submit the intake packet first, then launch the orchestrator to begin the
            judge-gated agent run.
          </p>

          <div className="btn-row" style={{ marginTop: '16px' }}>
            <button
              className="btn btn-primary"
              type="button"
              disabled={!canSubmitAppeal}
              onClick={submitAppeal}
            >
              Submit Appeal Packet
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              disabled={!canStartSimulation}
              onClick={startOrchestrator}
            >
              Start Orchestrator
            </button>
            <button className="btn btn-ghost" type="button" onClick={loadDemoCase}>
              Load Demo Case
            </button>
            <button className="btn btn-ghost" type="button" onClick={resetFlow}>
              Reset
            </button>
          </div>
        </div>

        <div className="card soft">
          <h3>Case Memory Snapshot</h3>
          <div className="summary-list" style={{ marginTop: '12px' }}>
            <div className="summary-item">
              <span>Domain</span>
              <strong>
                {formState.domain === 'traffic_violation'
                  ? 'Traffic Violation'
                  : 'Small Claims Tribunal'}
              </strong>
            </div>
            <div className="summary-item">
              <span>Parties</span>
              <strong>
                {formState.appellant && formState.respondent
                  ? `${formState.appellant} vs ${formState.respondent}`
                  : 'Awaiting party details'}
              </strong>
            </div>
            <div className="summary-item">
              <span>Appeal ID</span>
              <strong>{appealSubmitted ? appealId : 'Pending submission'}</strong>
            </div>
            <div className="summary-item">
              <span>Dispute Status</span>
              <strong>{disputeSubmitted ? 'Attached to case memory' : 'Not attached yet'}</strong>
            </div>
            <div className="summary-item">
              <span>Orchestrator</span>
              <strong>
                {runState === 'running'
                  ? `Running since ${startedAt}`
                  : runState === 'waiting_judge'
                    ? 'Paused for judge approval'
                    : runState === 'complete'
                      ? 'Run completed'
                      : 'Idle'}
              </strong>
            </div>
          </div>

          <h4 style={{ marginTop: '18px' }}>Uploaded Files</h4>
          <div className="file-list">
            {uploadedFiles.length === 0 ? (
              <div className="summary-item">
                <span>No files yet</span>
                <strong>Upload evidence and supporting documents</strong>
              </div>
            ) : (
              uploadedFiles.map((file) => (
                <div key={file.id} className="file-item">
                  <div className="file-meta">
                    <span>{file.name}</span>
                    <span>{formatSize(file.size)}</span>
                  </div>
                  <div className="file-meta">
                    <span>{file.type || 'unknown type'}</span>
                    <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
                      {file.url ? (
                        <a className="btn btn-ghost" href={file.url} target="_blank" rel="noreferrer">
                          Open
                        </a>
                      ) : null}
                      <button type="button" className="btn btn-ghost" onClick={() => onFileRemove(file.id)}>
                        Remove
                      </button>
                    </div>
                  </div>
                  <label className="input-field">
                    Notes
                    <input
                      value={file.note}
                      onChange={(event) => onFileNoteChange(file.id, event.target.value)}
                      placeholder="Add context or description"
                    />
                  </label>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="btn-row">
          <Link className="btn btn-ghost" to="/graph">
            View Graph Mesh
          </Link>
          <Link className="btn btn-ghost" to="/pipeline">
            View Pipeline
          </Link>
        </div>
      </div>
    </section>
  )
}

export default AppealIntakePage
