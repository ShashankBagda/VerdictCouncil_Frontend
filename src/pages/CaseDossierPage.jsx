import { Link } from 'react-router-dom'

function CaseDossierPage({
  caseSession,
  dossierSections,
  uploadedFilesBySection,
  onDownloadDossierSection,
  onDownloadCasePackage,
  appealSubmitted,
}) {
  return (
    <section className="page-shell">
      <div className="page-hero">
        <h2>Case Dossier</h2>
        <p>
          Review the generated case package, inspect downloadable report sections, and
          export a structured bundle with AI-friendly folder and file naming.
        </p>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="section-header">
            <div>
              <h3>Case Package</h3>
              <p className="helper-text">
                Folder nomenclature is generated from case metadata for consistent handling.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onDownloadCasePackage}
              disabled={!appealSubmitted}
            >
              Download Package
            </button>
          </div>
          <div className="summary-list" style={{ marginTop: '14px' }}>
            <div className="summary-item">
              <span>Case Folder</span>
              <strong>{caseSession.folderName}</strong>
            </div>
            <div className="summary-item">
              <span>Case ID</span>
              <strong>{caseSession.caseId || 'Pending submission'}</strong>
            </div>
            <div className="summary-item">
              <span>Manifest</span>
              <strong>{caseSession.packageMeta.manifestName}</strong>
            </div>
          </div>
        </div>

        <div className="card soft">
          <h3>Structured Upload Sections</h3>
          <div className="audit-list" style={{ marginTop: '12px' }}>
            {uploadedFilesBySection.map((section) => (
              <article key={section.id} className="audit-item">
                <div className="audit-meta">
                  <span>{section.code}</span>
                  <span>{section.files.length} file(s)</span>
                </div>
                <strong>{section.title}</strong>
                <p>{section.description}</p>
                <ul className="detail-list">
                  {section.files.length > 0 ? (
                    section.files.map((file) => <li key={file.id}>{file.storagePath}</li>)
                  ) : (
                    <li>No files attached yet.</li>
                  )}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-header">
          <div>
            <h3>Dossier Sections</h3>
            <p className="helper-text">
              Export each section independently or include them all in the package ZIP.
            </p>
          </div>
        </div>
        <div className="report-grid">
          {dossierSections.map((section) => (
            <article key={section.id} className="report-card">
              <div className="section-header compact">
                <div>
                  <span className="micro-label">{section.fileName}</span>
                  <h4>{section.title}</h4>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => onDownloadDossierSection(section.id)}
                >
                  Download
                </button>
              </div>
              <pre className="report-preview">{section.content}</pre>
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
          <Link className="btn btn-ghost" to="/pipeline">
            Open Pipeline
          </Link>
        </div>
      </div>
    </section>
  )
}

export default CaseDossierPage
