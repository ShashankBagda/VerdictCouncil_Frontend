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
  uploadedFilesBySection,
  onFilesSelected,
  onFileNoteChange,
  onFileRemove,
  loadDemoCase,
  demoCases,
  selectedDemoCaseId,
  caseSession,
}) {
  return (
    <section className="page-shell">
      <div className="page-hero">
        <h2>Structured Case Intake</h2>
        <p>
          Capture only the case essentials, then attach evidence in dedicated section
          buckets for applicant, respondent, counsel, witnesses, proofs, and other
          participants. The app will generate a clean folder and file nomenclature for
          downstream AI handling.
        </p>
      </div>

      <div className="card soft">
        <div className="section-header">
          <div>
            <h3>Demo Scenarios</h3>
            <p className="helper-text">
              Load a seeded matter to test structured uploads, dossier exports, and judge
              review flows without manual entry.
            </p>
          </div>
        </div>
        <div className="scenario-grid">
          {demoCases.map((demoCase) => (
            <button
              type="button"
              key={demoCase.id}
              className={`scenario-card ${
                selectedDemoCaseId === demoCase.id ? 'selected' : ''
              }`}
              onClick={() => loadDemoCase(demoCase.id)}
            >
              <span className="scenario-label">{demoCase.label}</span>
              <strong>{demoCase.formState.caseTitle}</strong>
              <p>{demoCase.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Case Essentials</h3>
          <div className="form-grid intake-grid" style={{ marginTop: '12px' }}>
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
              Applicant
              <input
                name="appellant"
                value={formState.appellant}
                onChange={onFieldChange}
                placeholder="Applicant full name"
              />
            </label>

            <label className="input-field">
              Opposition Party
              <input
                name="respondent"
                value={formState.respondent}
                onChange={onFieldChange}
                placeholder="Opposition party full name"
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
          </div>

          <p className="helper-text">
            Required upload buckets: Applicant Submission, Respondent Submission, and
            Proof Bundle. Once submitted, the case package becomes export-ready from the
            dossier page.
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
            <button className="btn btn-ghost" type="button" onClick={resetFlow}>
              Reset Case
            </button>
          </div>
        </div>

        <div className="card soft">
          <h3>Case Package Snapshot</h3>
          <div className="summary-list" style={{ marginTop: '12px' }}>
            <div className="summary-item">
              <span>Case Folder</span>
              <strong>{caseSession.folderName}</strong>
            </div>
            <div className="summary-item">
              <span>Appeal ID</span>
              <strong>{appealSubmitted ? appealId : 'Pending submission'}</strong>
            </div>
            <div className="summary-item">
              <span>Package Files</span>
              <strong>{caseSession.packageMeta.files.length} structured files</strong>
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
            <div className="summary-item">
              <span>Dispute Status</span>
              <strong>{disputeSubmitted ? 'Attached to case memory' : 'Not attached yet'}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-header">
          <div>
            <h3>Section Upload Buckets</h3>
            <p className="helper-text">
              Each section gets its own upload area and generated storage path, keeping the
              case folder clean for AI ingestion and human review.
            </p>
          </div>
        </div>
        <div className="upload-section-grid">
          {uploadedFilesBySection.map((section) => (
            <article key={section.id} className="upload-section-card">
              <div className="section-header compact">
                <div>
                  <span className="micro-label">{section.code}</span>
                  <h4>{section.title}</h4>
                </div>
                {section.required ? <span className="required-pill">Required</span> : null}
              </div>
              <p className="helper-text" style={{ marginTop: 0 }}>
                {section.description}
              </p>
              <label className="btn btn-ghost upload-trigger">
                Attach Files
                <input type="file" multiple onChange={(event) => onFilesSelected(section.id, event)} />
              </label>
              <div className="file-list compact">
                {section.files.length > 0 ? (
                  section.files.map((file) => (
                    <div key={file.id} className="file-item">
                      <div className="file-meta">
                        <span>{file.generatedName}</span>
                        <span>{formatSize(file.size)}</span>
                      </div>
                      <p className="helper-text file-path">{file.storagePath}</p>
                      <label className="input-field">
                        Notes
                        <input
                          value={file.note}
                          onChange={(event) => onFileNoteChange(file.id, event.target.value)}
                          placeholder="Add context or handling notes"
                        />
                      </label>
                      <div className="btn-row file-actions">
                        {file.url ? (
                          <a className="btn btn-ghost" href={file.url} target="_blank" rel="noreferrer">
                            Open
                          </a>
                        ) : null}
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => onFileRemove(file.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="summary-item">
                    <span>No files yet</span>
                    <strong>Attach one or more files for this section.</strong>
                  </div>
                )}
              </div>
            </article>
          ))}
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
          <Link className="btn btn-ghost" to="/dossier">
            Open Case Dossier
          </Link>
        </div>
      </div>
    </section>
  )
}

export default AppealIntakePage
