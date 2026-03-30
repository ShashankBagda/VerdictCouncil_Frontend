import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import './App.css'
import { AGENTS, AGENT_LAYERS, LEGAL_CONTEXT, buildPipeline } from './data/architecture'
import { DEMO_CASES } from './data/demoCases'
import { INTAKE_SECTIONS } from './data/intakeSections'
import {
  buildDossierSections,
  cloneSessionValue,
  createAuditEvent,
  createCaseSession,
  downloadCasePackageZip,
  downloadTextAsset,
  loadSessionSnapshot,
  saveSessionSnapshot,
  syncAgentArtifact,
} from './lib/backendAdapter'
import AppealIntakePage from './pages/AppealIntakePage'
import GraphMeshPage from './pages/GraphMeshPage'
import AgentPipelinePage from './pages/AgentPipelinePage'
import CaseDossierPage from './pages/CaseDossierPage'

const DEFAULT_FORM = {
  caseTitle: '',
  domain: 'small_claims',
  appellant: '',
  respondent: '',
  claimAmount: '',
  disputeType: '',
}

const buildInitialAgentStates = () =>
  AGENTS.map((agent) => ({ id: agent.id, status: 'idle' }))

const buildInitialArtifacts = () =>
  Object.fromEntries(
    AGENTS.map((agent) => [
      agent.id,
      {
        summary: 'No output generated yet.',
        evidenceRefs: [],
        risks: [],
        confidence: null,
        judgeDecision: 'pending',
        judgeNote: '',
        redirectReason: '',
        updatedAt: '',
        reviewedAt: '',
      },
    ]),
  )

const buildAgentDraft = (agent, formState, packageMeta, index) => {
  const amount = Number(formState.claimAmount || 0)
  const confidence = Math.min(95, 73 + index * 3)
  const domainLabel =
    formState.domain === 'traffic_violation' ? 'traffic violation' : 'small claims'
  const sectionTitles = [...new Set(packageMeta.files.map((file) => file.sectionTitle))]
  const primaryEvidence = packageMeta.files.slice(0, 3).map((file) => file.generatedName)

  const drafts = {
    'case-processing': {
      summary: `Structured ${packageMeta.folderName} for ${formState.appellant || 'applicant'} vs ${formState.respondent || 'respondent'} with ${packageMeta.files.length} intake file(s) across ${sectionTitles.length} section(s).`,
      evidenceRefs: primaryEvidence,
      risks: amount > 5000 ? ['Higher claim value may require closer human scrutiny.'] : [],
    },
    'complexity-routing': {
      summary:
        amount > 5000
          ? 'Flagged the case for closer oversight while keeping the AI analysis route active.'
          : 'Classified the case as suitable for standard AI review with judge checkpoints.',
      evidenceRefs: primaryEvidence,
      risks:
        amount > 5000
          ? ['Potential escalation threshold reached for claim amount.']
          : ['Judge should verify completeness before final recommendation.'],
    },
    'evidence-analysis': {
      summary: `Reviewed the uploaded proof and party bundles for admissibility, contradictions, and missing support. Primary references: ${primaryEvidence.join(', ') || 'no uploaded evidence yet'}.`,
      evidenceRefs: primaryEvidence,
      risks: primaryEvidence.length < 2 ? ['Evidence coverage is light for a contested matter.'] : [],
    },
    'fact-reconstruction': {
      summary: `Built a working chronology from the ${domainLabel} filings, with emphasis on ${sectionTitles.join(', ') || 'pending sections'}.`,
      evidenceRefs: primaryEvidence,
      risks: ['Sequence of events should be checked against witness and counsel submissions.'],
    },
    'witness-analysis': {
      summary:
        formState.domain === 'traffic_violation'
          ? 'Assessed witness materials and party submissions against the traffic notice and proof bundle.'
          : 'Assessed witness and participant materials against the party submissions and proof bundle.',
      evidenceRefs: packageMeta.files
        .filter((file) => file.sectionCode === 'WIT' || file.sectionCode === 'OTH')
        .slice(0, 3)
        .map((file) => file.generatedName),
      risks: ['Witness credibility is inferred from submitted records, not direct testimony.'],
    },
    'legal-knowledge': {
      summary:
        formState.domain === 'traffic_violation'
          ? 'Retrieved statute-oriented references, offence framing, and comparable enforcement precedents.'
          : 'Retrieved tribunal principles on refunds, contract performance, and service obligations.',
      evidenceRefs: primaryEvidence,
      risks: ['Legal retrieval should be validated against the latest official sources during backend integration.'],
    },
    'argument-construction': {
      summary:
        formState.domain === 'traffic_violation'
          ? 'Drafted prosecution and defense narratives from the applicant, respondent, and counsel bundles.'
          : 'Drafted claimant and respondent positions from party submissions, counsel notes, and proof bundles.',
      evidenceRefs: primaryEvidence,
      risks: ['Argument strength depends on whether the uploaded package is complete.'],
    },
    deliberation: {
      summary: 'Synthesized facts, legal materials, and argument strength into a single draft reasoning chain for judicial review.',
      evidenceRefs: primaryEvidence,
      risks: ['Reasoning chain should be reviewed for unsupported assumptions before approval.'],
    },
    'governance-verdict': {
      summary:
        formState.domain === 'traffic_violation'
          ? 'Produced a draft recommendation with confidence scoring and fairness checks for the alleged offence.'
          : 'Produced a draft recommendation with fairness checks and proposed remedy framing for the claim.',
      evidenceRefs: primaryEvidence,
      risks: ['Final recommendation remains non-binding until judge approval.'],
    },
  }

  return {
    ...drafts[agent.id],
    confidence,
    updatedAt: new Date().toISOString(),
  }
}

function App() {
  const persistedSession = useMemo(() => loadSessionSnapshot(), [])

  const [formState, setFormState] = useState(
    () => persistedSession?.formState || DEFAULT_FORM,
  )
  const [appealId, setAppealId] = useState(() => persistedSession?.appealId || '')
  const [appealSubmitted, setAppealSubmitted] = useState(
    () => persistedSession?.appealSubmitted || false,
  )
  const [disputeSubmitted, setDisputeSubmitted] = useState(
    () => persistedSession?.disputeSubmitted || false,
  )
  const [runState, setRunState] = useState(() => persistedSession?.runState || 'idle')
  const [currentAgentIndex, setCurrentAgentIndex] = useState(
    () => persistedSession?.currentAgentIndex || 0,
  )
  const [judgeGateMode, setJudgeGateMode] = useState(
    () => persistedSession?.judgeGateMode || 'per_agent',
  )
  const [redoTargetAgentId, setRedoTargetAgentId] = useState(
    () => persistedSession?.redoTargetAgentId || '',
  )
  const [startedAt, setStartedAt] = useState(() => persistedSession?.startedAt || '')
  const [agentStates, setAgentStates] = useState(
    () => persistedSession?.agentStates || buildInitialAgentStates(),
  )
  const [uploadedFiles, setUploadedFiles] = useState(
    () => persistedSession?.uploadedFiles || [],
  )
  const [selectedDemoCaseId, setSelectedDemoCaseId] = useState(
    () => persistedSession?.selectedDemoCaseId || DEMO_CASES[0].id,
  )
  const [agentArtifacts, setAgentArtifacts] = useState(
    () => persistedSession?.agentArtifacts || buildInitialArtifacts(),
  )
  const [auditEvents, setAuditEvents] = useState(() => persistedSession?.auditEvents || [])
  const [judgeNoteDraft, setJudgeNoteDraft] = useState(
    () => persistedSession?.judgeNoteDraft || '',
  )
  const [redirectReasonDraft, setRedirectReasonDraft] = useState(
    () => persistedSession?.redirectReasonDraft || '',
  )

  const pipelineStages = useMemo(() => buildPipeline(formState.domain), [formState.domain])
  const agentStatusMap = useMemo(
    () => Object.fromEntries(agentStates.map((state) => [state.id, state.status])),
    [agentStates],
  )

  const layerBreakIndexes = useMemo(() => {
    const indexes = []
    for (let i = 0; i < AGENTS.length; i += 1) {
      if (i === AGENTS.length - 1 || AGENTS[i].layerId !== AGENTS[i + 1].layerId) {
        indexes.push(i)
      }
    }
    return indexes
  }, [])

  const packageMeta = useMemo(
    () => createCaseSession({ appealId, formState, uploadedFiles }),
    [appealId, formState, uploadedFiles],
  )

  const legalPack = LEGAL_CONTEXT[formState.domain]
  const dossierSections = useMemo(
    () =>
      buildDossierSections({
        caseSession: packageMeta,
        formState,
        packageMeta: packageMeta.packageMeta,
        pipelineStages,
        agentArtifacts,
        auditEvents,
        judgeGateMode,
      }),
    [agentArtifacts, auditEvents, formState, judgeGateMode, packageMeta, pipelineStages],
  )

  const requiredSectionIds = useMemo(
    () => INTAKE_SECTIONS.filter((section) => section.required).map((section) => section.id),
    [],
  )

  const uploadedFilesBySection = useMemo(
    () =>
      INTAKE_SECTIONS.map((section) => ({
        ...section,
        files: packageMeta.packageMeta.files.filter((file) => file.sectionKey === section.id),
      })),
    [packageMeta.packageMeta.files],
  )

  const hasRequiredSections = requiredSectionIds.every((sectionId) =>
    uploadedFiles.some((file) => file.sectionKey === sectionId),
  )

  const canSubmitAppeal =
    !appealSubmitted &&
    formState.caseTitle.trim().length > 3 &&
    formState.appellant.trim().length > 2 &&
    formState.respondent.trim().length > 2 &&
    hasRequiredSections

  const canStartSimulation = appealSubmitted && Boolean(formState.disputeType) && hasRequiredSections

  const runStatusLabel =
    runState === 'idle'
      ? 'Idle'
      : runState === 'running'
        ? 'Running'
        : runState === 'waiting_judge'
          ? 'Waiting for Judge'
          : 'Complete'

  const runStatusClass =
    runState === 'waiting_judge' ? 'waiting' : runState === 'complete' ? 'complete' : runState

  const appendAuditEvent = useCallback((event) => {
    setAuditEvents((previous) => [event, ...previous].slice(0, 80))
  }, [])

  const clearJudgeDrafts = useCallback(() => {
    setJudgeNoteDraft('')
    setRedirectReasonDraft('')
  }, [])

  const resetFlow = () => {
    setFormState(DEFAULT_FORM)
    setAppealId('')
    setAppealSubmitted(false)
    setDisputeSubmitted(false)
    setRunState('idle')
    setCurrentAgentIndex(0)
    setJudgeGateMode('per_agent')
    setStartedAt('')
    setAgentStates(buildInitialAgentStates())
    setRedoTargetAgentId('')
    setUploadedFiles([])
    setSelectedDemoCaseId('')
    setAgentArtifacts(buildInitialArtifacts())
    setAuditEvents([])
    clearJudgeDrafts()
  }

  const loadDemoCase = (demoCaseId = selectedDemoCaseId) => {
    const selectedCase =
      DEMO_CASES.find((demoCase) => demoCase.id === demoCaseId) || DEMO_CASES[0]

    setSelectedDemoCaseId(selectedCase.id)
    setFormState(cloneSessionValue(selectedCase.formState))
    setAppealId('')
    setAppealSubmitted(false)
    setDisputeSubmitted(false)
    setRunState('idle')
    setCurrentAgentIndex(0)
    setJudgeGateMode('per_agent')
    setStartedAt('')
    setAgentStates(buildInitialAgentStates())
    setRedoTargetAgentId('')
    setUploadedFiles(cloneSessionValue(selectedCase.files))
    setAgentArtifacts(buildInitialArtifacts())
    setAuditEvents([
      createAuditEvent({
        actor: 'System',
        type: 'scenario',
        message: `Loaded demo scenario "${selectedCase.label}".`,
      }),
    ])
    clearJudgeDrafts()
  }

  const submitAppeal = () => {
    if (!canSubmitAppeal || appealSubmitted) {
      return
    }

    const nextAppealId = `VC-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`
    setAppealSubmitted(true)
    setAppealId(nextAppealId)
    appendAuditEvent(
      createAuditEvent({
        actor: 'Clerk',
        type: 'intake',
        message: `Appeal packet submitted with case ID ${nextAppealId}. Case folder prepared as ${createCaseSession({
          appealId: nextAppealId,
          formState,
          uploadedFiles,
        }).folderName}.`,
      }),
    )
  }

  const finalizeRun = useCallback(
    (message) => {
      setAgentStates((previous) =>
        previous.map((state) =>
          state.status === 'idle' ? state : { ...state, status: 'completed' },
        ),
      )
      setRunState('complete')
      clearJudgeDrafts()
      appendAuditEvent(
        createAuditEvent({
          actor: 'System',
          type: 'run_complete',
          message,
        }),
      )
    },
    [appendAuditEvent, clearJudgeDrafts],
  )

  const startOrchestrator = () => {
    if (!canStartSimulation) {
      return
    }

    const startedTime = new Date().toLocaleTimeString('en-SG', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

    setDisputeSubmitted(true)
    setRunState('running')
    setCurrentAgentIndex(0)
    setAgentStates(
      AGENTS.map((agent, index) => ({
        id: agent.id,
        status: index === 0 ? 'running' : 'idle',
      })),
    )
    setAgentArtifacts(buildInitialArtifacts())
    setStartedAt(startedTime)
    setRedoTargetAgentId('')
    clearJudgeDrafts()
    appendAuditEvent(
      createAuditEvent({
        actor: 'Orchestrator',
        type: 'run_start',
        message: `Orchestrator started under ${judgeGateMode.replace('_', ' ')} gating using package ${packageMeta.folderName}.`,
      }),
    )
  }

  const shouldGate = useCallback(
    (index) => {
      if (judgeGateMode === 'per_agent') {
        return true
      }
      if (judgeGateMode === 'per_layer') {
        return layerBreakIndexes.includes(index)
      }
      return index === AGENTS.length - 1
    },
    [judgeGateMode, layerBreakIndexes],
  )

  const advanceAgent = useCallback(() => {
    const currentAgent = AGENTS[currentAgentIndex]
    if (!currentAgent) {
      return
    }

    const currentStatus = agentStatusMap[currentAgent.id]
    if (currentStatus === 'redo_requested') {
      setAgentStates((previous) =>
        previous.map((state) =>
          state.id === currentAgent.id ? { ...state, status: 'running' } : state,
        ),
      )
      appendAuditEvent(
        createAuditEvent({
          actor: 'Orchestrator',
          type: 'rerun',
          stageTitle: currentAgent.title,
          message: `${currentAgent.title} restarted after judge redirection.`,
        }),
      )
      return
    }

    const gateNow = shouldGate(currentAgentIndex)
    const isLast = currentAgentIndex >= AGENTS.length - 1
    const draftOutput = buildAgentDraft(
      currentAgent,
      formState,
      packageMeta.packageMeta,
      currentAgentIndex,
    )

    setAgentArtifacts((previous) =>
      syncAgentArtifact({
        previousArtifacts: previous,
        agentId: currentAgent.id,
        patch: draftOutput,
      }),
    )

    setAgentStates((previous) => {
      const updated = previous.map((state) => ({ ...state }))
      updated[currentAgentIndex].status = gateNow ? 'waiting_judge' : 'approved'

      if (!gateNow && !isLast) {
        updated[currentAgentIndex + 1].status = 'running'
      }

      if (!gateNow && isLast) {
        return updated.map((state) =>
          state.status === 'idle' ? state : { ...state, status: 'completed' },
        )
      }

      return updated
    })

    appendAuditEvent(
      createAuditEvent({
        actor: currentAgent.title,
        type: 'agent_output',
        stageTitle: currentAgent.title,
        message: `${currentAgent.title} drafted an output with ${draftOutput.confidence}% confidence.`,
      }),
    )

    if (gateNow) {
      setRunState('waiting_judge')
      appendAuditEvent(
        createAuditEvent({
          actor: 'Orchestrator',
          type: 'judge_gate',
          stageTitle: currentAgent.title,
          message: `Judge review requested for ${currentAgent.title}.`,
        }),
      )
      return
    }

    if (isLast) {
      finalizeRun('Orchestrator completed the final recommendation package.')
      return
    }

    setCurrentAgentIndex((index) => index + 1)
    if (redoTargetAgentId === currentAgent.id) {
      setRedoTargetAgentId('')
    }
  }, [
    agentStatusMap,
    appendAuditEvent,
    currentAgentIndex,
    finalizeRun,
    formState,
    packageMeta.packageMeta,
    redoTargetAgentId,
    shouldGate,
  ])

  useEffect(() => {
    if (runState !== 'running') {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      advanceAgent()
    }, 2300)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [advanceAgent, runState])

  const approveStep = () => {
    if (runState !== 'waiting_judge') {
      return
    }

    const currentAgent = AGENTS[currentAgentIndex]
    if (!currentAgent) {
      return
    }

    const isLast = currentAgentIndex >= AGENTS.length - 1
    const note = judgeNoteDraft.trim() || 'Approved without additional comment.'
    const reviewedAt = new Date().toISOString()

    setAgentArtifacts((previous) =>
      syncAgentArtifact({
        previousArtifacts: previous,
        agentId: currentAgent.id,
        patch: {
          judgeDecision: 'approved',
          judgeNote: note,
          redirectReason: '',
          reviewedAt,
        },
      }),
    )

    setAgentStates((previous) => {
      const updated = previous.map((state) => ({ ...state }))
      updated[currentAgentIndex].status = 'approved'
      if (!isLast) {
        updated[currentAgentIndex + 1].status = 'running'
      }
      return updated
    })

    appendAuditEvent(
      createAuditEvent({
        actor: 'Judge',
        type: 'judge_approval',
        stageTitle: currentAgent.title,
        message: `Judge approved ${currentAgent.title}. ${note}`,
      }),
    )

    clearJudgeDrafts()

    if (isLast) {
      finalizeRun('Judge approved the final recommendation.')
      return
    }

    setRunState('running')
    setCurrentAgentIndex((index) => index + 1)
  }

  const sendBackToAgent = (agentId) => {
    if (runState !== 'waiting_judge') {
      return
    }

    const targetIndex = AGENTS.findIndex((agent) => agent.id === agentId)
    const currentAgent = AGENTS[currentAgentIndex]
    if (targetIndex < 0 || !currentAgent) {
      return
    }

    const targetAgent = AGENTS[targetIndex]
    const note = judgeNoteDraft.trim() || 'Judge requested rework before approval.'
    const reason =
      redirectReasonDraft.trim() ||
      `Revisit ${targetAgent.title} to strengthen the case record.`
    const reviewedAt = new Date().toISOString()

    setAgentArtifacts((previous) => ({
      ...syncAgentArtifact({
        previousArtifacts: previous,
        agentId: currentAgent.id,
        patch: {
          judgeDecision: 'redirected',
          judgeNote: note,
          redirectReason: `${targetAgent.title}: ${reason}`,
          reviewedAt,
        },
      }),
      [targetAgent.id]: {
        ...previous[targetAgent.id],
        redirectReason: reason,
      },
    }))

    setRedoTargetAgentId(agentId)
    setRunState('running')
    setCurrentAgentIndex(targetIndex)
    setAgentStates((previous) =>
      previous.map((state, index) => {
        if (index < targetIndex) {
          return { ...state, status: 'approved' }
        }
        if (index === targetIndex) {
          return { ...state, status: 'redo_requested' }
        }
        return { ...state, status: 'idle' }
      }),
    )

    appendAuditEvent(
      createAuditEvent({
        actor: 'Judge',
        type: 'judge_redirect',
        stageTitle: currentAgent.title,
        message: `Judge redirected the case from ${currentAgent.title} back to ${targetAgent.title}. ${reason}`,
      }),
    )

    clearJudgeDrafts()
  }

  const onFieldChange = (event) => {
    const { name, value } = event.target
    setFormState((previous) => ({ ...previous, [name]: value }))
  }

  const onFilesSelected = (sectionKey, event) => {
    const fileList = Array.from(event.target.files || [])
    if (fileList.length === 0) {
      return
    }

    setUploadedFiles((previous) => [
      ...previous,
      ...fileList.map((file) => ({
        id: `${sectionKey}-${file.name}-${file.lastModified}-${Math.random()
          .toString(16)
          .slice(2)}`,
        sectionKey,
        originalName: file.name,
        type: file.type || 'unknown',
        size: file.size,
        note: '',
        fileObject: file,
      })),
    ])

    appendAuditEvent(
      createAuditEvent({
        actor: 'User',
        type: 'file_upload',
        message: `${fileList.length} file(s) added to ${INTAKE_SECTIONS.find((section) => section.id === sectionKey)?.title || sectionKey}.`,
      }),
    )

    event.target.value = ''
  }

  const onFileNoteChange = (fileId, note) => {
    setUploadedFiles((previous) =>
      previous.map((file) => (file.id === fileId ? { ...file, note } : file)),
    )
  }

  const onFileRemove = (fileId) => {
    const fileName =
      uploadedFiles.find((file) => file.id === fileId)?.originalName || 'file'
    setUploadedFiles((previous) => previous.filter((file) => file.id !== fileId))
    appendAuditEvent(
      createAuditEvent({
        actor: 'User',
        type: 'file_remove',
        message: `Removed ${fileName} from the case package.`,
      }),
    )
  }

  const onDownloadDossierSection = (sectionId) => {
    const section = dossierSections.find((entry) => entry.id === sectionId)
    if (!section) {
      return
    }

    downloadTextAsset({
      fileName: section.fileName,
      content: section.content,
    })
  }

  const onDownloadCasePackage = async () => {
    await downloadCasePackageZip({
      caseSession: packageMeta,
      dossierSections,
    })
  }

  useEffect(() => {
    saveSessionSnapshot({
      formState,
      appealId,
      appealSubmitted,
      disputeSubmitted,
      runState,
      currentAgentIndex,
      judgeGateMode,
      redoTargetAgentId,
      startedAt,
      agentStates,
      uploadedFiles,
      selectedDemoCaseId,
      agentArtifacts,
      auditEvents,
      judgeNoteDraft,
      redirectReasonDraft,
    })
  }, [
    agentArtifacts,
    agentStates,
    appealId,
    appealSubmitted,
    auditEvents,
    currentAgentIndex,
    disputeSubmitted,
    formState,
    judgeGateMode,
    judgeNoteDraft,
    redirectReasonDraft,
    redoTargetAgentId,
    runState,
    selectedDemoCaseId,
    startedAt,
    uploadedFiles,
  ])

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <img className="brand-logo" src="/logo.png" alt="VerdictCouncil logo" />
          <div>
            <p className="brand-sub">VerdictCouncil</p>
            <h1 className="brand-title">Multi-Agent Orchestration Console</h1>
          </div>
        </div>
        <nav className="nav-tabs">
          <NavLink to="/intake">Intake</NavLink>
          <NavLink to="/graph">Graph Mesh</NavLink>
          <NavLink to="/pipeline">Pipeline</NavLink>
          <NavLink to="/dossier">Case Dossier</NavLink>
        </nav>
        <span className={`status-chip ${runStatusClass}`}>{runStatusLabel}</span>
      </header>

      <main className="page-shell">
        <Routes>
          <Route path="/" element={<Navigate to="/intake" replace />} />
          <Route
            path="/intake"
            element={
              <AppealIntakePage
                formState={formState}
                onFieldChange={onFieldChange}
                canSubmitAppeal={canSubmitAppeal}
                canStartSimulation={canStartSimulation}
                submitAppeal={submitAppeal}
                startOrchestrator={startOrchestrator}
                resetFlow={resetFlow}
                appealSubmitted={appealSubmitted}
                appealId={appealId}
                disputeSubmitted={disputeSubmitted}
                runState={runState}
                startedAt={startedAt}
                uploadedFilesBySection={uploadedFilesBySection}
                onFilesSelected={onFilesSelected}
                onFileNoteChange={onFileNoteChange}
                onFileRemove={onFileRemove}
                loadDemoCase={loadDemoCase}
                demoCases={DEMO_CASES}
                selectedDemoCaseId={selectedDemoCaseId}
                caseSession={packageMeta}
              />
            }
          />
          <Route
            path="/graph"
            element={
              <GraphMeshPage
                agents={AGENTS}
                layers={AGENT_LAYERS}
                agentStatusMap={agentStatusMap}
                runState={runState}
                currentAgentIndex={currentAgentIndex}
                judgeGateMode={judgeGateMode}
                setJudgeGateMode={setJudgeGateMode}
                approveStep={approveStep}
                sendBackToAgent={sendBackToAgent}
                redoTargetAgentId={redoTargetAgentId}
                pipelineStages={pipelineStages}
                agentArtifacts={agentArtifacts}
                auditEvents={auditEvents}
                judgeNoteDraft={judgeNoteDraft}
                setJudgeNoteDraft={setJudgeNoteDraft}
                redirectReasonDraft={redirectReasonDraft}
                setRedirectReasonDraft={setRedirectReasonDraft}
              />
            }
          />
          <Route
            path="/pipeline"
            element={
              <AgentPipelinePage
                pipelineStages={pipelineStages}
                agentStatusMap={agentStatusMap}
                currentAgentIndex={currentAgentIndex}
                runState={runState}
                legalPack={legalPack}
                agentArtifacts={agentArtifacts}
                auditEvents={auditEvents}
                judgeGateMode={judgeGateMode}
              />
            }
          />
          <Route
            path="/dossier"
            element={
              <CaseDossierPage
                caseSession={packageMeta}
                dossierSections={dossierSections}
                uploadedFilesBySection={uploadedFilesBySection}
                onDownloadDossierSection={onDownloadDossierSection}
                onDownloadCasePackage={onDownloadCasePackage}
                appealSubmitted={appealSubmitted}
              />
            }
          />
        </Routes>
      </main>
    </div>
  )
}

export default App
