import JSZip from 'jszip'
import { intakeSectionLookup } from '../data/intakeSections'

export const STORAGE_KEY = 'verdictcouncil-session-v3'

const cloneValue = (value) => JSON.parse(JSON.stringify(value))

const slugify = (value) =>
  (value || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36) || 'unknown'

const getExtension = (filename = '') => {
  const parts = filename.split('.')
  return parts.length > 1 ? parts.at(-1) : 'dat'
}

const sanitizeBaseName = (filename = '') => {
  const lastDot = filename.lastIndexOf('.')
  const base = lastDot > 0 ? filename.slice(0, lastDot) : filename
  return slugify(base)
}

const domainCode = (domain) => (domain === 'traffic_violation' ? 'TV' : 'SC')

export const createAuditEvent = ({
  actor = 'System',
  message,
  stageTitle = '',
  type = 'info',
}) => ({
  id: `evt-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  actor,
  message,
  stageTitle,
  type,
  createdAt: new Date().toISOString(),
})

export const loadSessionSnapshot = () => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const saveSessionSnapshot = (snapshot) => {
  if (typeof window === 'undefined') {
    return
  }

  const safeFiles = (snapshot.uploadedFiles || []).map((file) => {
    const safeFile = { ...file }
    delete safeFile.fileObject
    return safeFile
  })

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...snapshot,
        uploadedFiles: safeFiles,
      }),
    )
  } catch {
    // Ignore persistence failures so the UI can continue working in restricted browsers.
  }
}

export const buildCaseFolderName = ({ appealId, formState }) => {
  const year = new Date().getFullYear()
  const applicant = slugify(formState.appellant)
  const respondent = slugify(formState.respondent)
  const caseSlug = slugify(formState.caseTitle)
  const suffix = appealId || `draft-${caseSlug}`
  return `VC_${year}_${domainCode(formState.domain)}_${applicant}_vs_${respondent}_${suffix}`
}

export const buildCasePackage = ({ appealId, formState, uploadedFiles }) => {
  const folderName = buildCaseFolderName({ appealId, formState })

  const files = uploadedFiles.map((file, index) => {
    const section = intakeSectionLookup[file.sectionKey] || {
      code: 'GEN',
      title: 'General Intake',
    }
    const sectionFolder = `${String(index + 1).padStart(2, '0')}_${section.code}_${slugify(
      section.title,
    )}`
    const generatedName = `${String(index + 1).padStart(3, '0')}_${section.code}_${sanitizeBaseName(
      file.originalName || file.name,
    )}.${getExtension(file.originalName || file.name)}`

    return {
      ...file,
      displayName: file.originalName || file.name,
      sectionTitle: section.title,
      sectionCode: section.code,
      generatedName,
      folderPath: `${folderName}/${sectionFolder}`,
      storagePath: `${folderName}/${sectionFolder}/${generatedName}`,
    }
  })

  return {
    folderName,
    manifestName: `${folderName}_manifest.json`,
    files,
  }
}

export const createCaseSession = ({ appealId, formState, uploadedFiles }) => {
  const packageMeta = buildCasePackage({ appealId, formState, uploadedFiles })

  return {
    caseId: appealId,
    folderName: packageMeta.folderName,
    domain: formState.domain,
    title: formState.caseTitle,
    parties: {
      appellant: formState.appellant,
      respondent: formState.respondent,
    },
    packageMeta,
  }
}

export const syncAgentArtifact = ({
  previousArtifacts,
  agentId,
  patch,
}) => ({
  ...previousArtifacts,
  [agentId]: {
    ...previousArtifacts[agentId],
    ...patch,
  },
})

export const buildDossierSections = ({
  caseSession,
  formState,
  packageMeta,
  pipelineStages,
  agentArtifacts,
  auditEvents,
  judgeGateMode,
}) => {
  const sectionFiles = packageMeta.files.map((file) => `- ${file.storagePath}`).join('\n')

  const sections = [
    {
      id: 'executive-summary',
      title: 'Executive Summary',
      fileName: `${caseSession.folderName}_executive-summary.md`,
      content: `# Executive Summary

Case ID: ${caseSession.caseId || 'Pending'}
Case Title: ${formState.caseTitle}
Domain: ${formState.domain}
Gate Mode: ${judgeGateMode}

Parties:
- Applicant: ${formState.appellant || 'Pending'}
- Respondent: ${formState.respondent || 'Pending'}
- Claim Amount: ${formState.claimAmount || 'Not provided'}
- Dispute Type: ${formState.disputeType || 'Not provided'}
`,
    },
    {
      id: 'participants',
      title: 'Participants & Representation',
      fileName: `${caseSession.folderName}_participants.md`,
      content: `# Participants & Representation

- Applicant: ${formState.appellant || 'Pending'}
- Respondent: ${formState.respondent || 'Pending'}
- Case Folder: ${caseSession.folderName}

Structured Upload Sections:
${Object.values(intakeSectionLookup)
  .map((section) => `- ${section.title} (${section.code})`)
  .join('\n')}
`,
    },
    {
      id: 'evidence-registry',
      title: 'Evidence Registry',
      fileName: `${caseSession.folderName}_evidence-registry.md`,
      content: `# Evidence Registry

Generated Package Paths:
${sectionFiles || '- No files registered'}
`,
    },
    {
      id: 'agent-dossier',
      title: 'Agent Dossier',
      fileName: `${caseSession.folderName}_agent-dossier.md`,
      content: `# Agent Dossier

${pipelineStages
  .map((stage) => {
    const artifact = agentArtifacts[stage.agentId]
    return `## ${stage.title}

- Summary: ${artifact.summary}
- Confidence: ${artifact.confidence ? `${artifact.confidence}%` : 'Pending'}
- Judge Decision: ${artifact.judgeDecision}
- Judge Note: ${artifact.judgeNote || 'None'}
- Redirect Reason: ${artifact.redirectReason || 'None'}
`
  })
  .join('\n')}
`,
    },
    {
      id: 'judge-review',
      title: 'Judge Review Log',
      fileName: `${caseSession.folderName}_judge-review.md`,
      content: `# Judge Review Log

${pipelineStages
  .map((stage) => {
    const artifact = agentArtifacts[stage.agentId]
    return `- ${stage.title}: ${artifact.judgeDecision} | ${artifact.judgeNote || 'No note'}`
  })
  .join('\n')}
`,
    },
    {
      id: 'audit-trail',
      title: 'Audit Trail',
      fileName: `${caseSession.folderName}_audit-trail.md`,
      content: `# Audit Trail

${auditEvents
  .map(
    (event) =>
      `- [${event.createdAt}] ${event.actor}${event.stageTitle ? ` / ${event.stageTitle}` : ''}: ${event.message}`,
  )
  .join('\n')}
`,
    },
  ]

  return sections
}

export const downloadTextAsset = ({ fileName, content, mimeType = 'text/markdown' }) => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const buildPlaceholderFile = (file) =>
  `Original file unavailable in browser memory.

Display Name: ${file.displayName}
Section: ${file.sectionTitle}
Declared Type: ${file.type}
Size: ${file.size}
Notes: ${file.note || 'None'}
Generated Storage Path: ${file.storagePath}
`

export const downloadCasePackageZip = async ({ caseSession, dossierSections }) => {
  const zip = new JSZip()
  const root = zip.folder(caseSession.folderName)

  root.file(
    caseSession.packageMeta.manifestName,
    JSON.stringify(
      {
        caseId: caseSession.caseId,
        folderName: caseSession.folderName,
        files: caseSession.packageMeta.files.map((file) => ({
          displayName: file.displayName,
          generatedName: file.generatedName,
          storagePath: file.storagePath,
          section: file.sectionTitle,
          note: file.note || '',
        })),
      },
      null,
      2,
    ),
  )

  caseSession.packageMeta.files.forEach((file) => {
    const folder = root.folder(file.folderPath.replace(`${caseSession.folderName}/`, ''))
    if (file.fileObject) {
      folder.file(file.generatedName, file.fileObject)
    } else {
      folder.file(`${sanitizeBaseName(file.generatedName)}-placeholder.txt`, buildPlaceholderFile(file))
    }
  })

  const dossierFolder = root.folder('99_DOS_dossier_reports')
  dossierSections.forEach((section) => {
    dossierFolder.file(section.fileName, section.content)
  })

  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${caseSession.folderName}.zip`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export const cloneSessionValue = cloneValue
