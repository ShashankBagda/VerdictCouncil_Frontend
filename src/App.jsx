import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import './App.css'
import { AGENTS, AGENT_LAYERS, LEGAL_CONTEXT, buildPipeline } from './data/architecture'
import AppealIntakePage from './pages/AppealIntakePage'
import GraphMeshPage from './pages/GraphMeshPage'
import AgentPipelinePage from './pages/AgentPipelinePage'

const DEFAULT_FORM = {
  caseTitle: '',
  domain: 'small_claims',
  appellant: '',
  respondent: '',
  claimAmount: '',
  appealReason: '',
  disputeType: '',
  disputeSummary: '',
  evidenceNotes: '',
}

const DEMO_CASE = {
  caseTitle: 'Late delivery refund dispute',
  domain: 'small_claims',
  appellant: 'Amelia Tan',
  respondent: 'Horizon Electronics Pte Ltd',
  claimAmount: '850',
  appealReason:
    'Refund request denied despite delivery delay and incomplete accessories. Seeking refund for failed service.',
  disputeType: 'refund_dispute',
  disputeSummary:
    'Product arrived 12 days late and missing accessories. Multiple follow-ups with vendor were unresolved.',
  evidenceNotes:
    'Order invoice, delivery timestamp, email thread, and item photos attached.',
}

const buildInitialAgentStates = () =>
  AGENTS.map((agent) => ({ id: agent.id, status: 'idle' }))

function App() {
  const [formState, setFormState] = useState(DEFAULT_FORM)
  const [appealId, setAppealId] = useState('')
  const [appealSubmitted, setAppealSubmitted] = useState(false)
  const [disputeSubmitted, setDisputeSubmitted] = useState(false)
  const [runState, setRunState] = useState('idle')
  const [currentAgentIndex, setCurrentAgentIndex] = useState(0)
  const [judgeGateMode, setJudgeGateMode] = useState('per_agent')
  const [redoTargetAgentId, setRedoTargetAgentId] = useState('')
  const [startedAt, setStartedAt] = useState('')
  const [agentStates, setAgentStates] = useState(buildInitialAgentStates)
  const [uploadedFiles, setUploadedFiles] = useState([])

  const pipelineStages = useMemo(
    () => buildPipeline(formState.domain),
    [formState.domain],
  )

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

  const canSubmitAppeal =
    formState.caseTitle.trim().length > 3 &&
    formState.appellant.trim().length > 2 &&
    formState.respondent.trim().length > 2

  const canStartSimulation =
    appealSubmitted &&
    formState.disputeType &&
    formState.disputeSummary.trim().length > 15

  const legalPack = LEGAL_CONTEXT[formState.domain]
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

  const resetFlow = () => {
    setFormState(DEFAULT_FORM)
    setAppealId('')
    setAppealSubmitted(false)
    setDisputeSubmitted(false)
    setRunState('idle')
    setCurrentAgentIndex(0)
    setStartedAt('')
    setAgentStates(buildInitialAgentStates())
    setRedoTargetAgentId('')
    setUploadedFiles([])
  }

  const loadDemoCase = () => {
    setFormState(DEMO_CASE)
    setAppealId('')
    setAppealSubmitted(false)
    setDisputeSubmitted(false)
    setRunState('idle')
    setCurrentAgentIndex(0)
    setStartedAt('')
    setAgentStates(buildInitialAgentStates())
    setRedoTargetAgentId('')
    setUploadedFiles([
      {
        id: 'demo-invoice',
        name: 'Invoice_2025-11-15.pdf',
        type: 'application/pdf',
        size: 482190,
        note: 'Original invoice with itemized charges.',
      },
      {
        id: 'demo-intake',
        name: 'VC_Demo_Intake.txt',
        type: 'text/plain',
        size: 1060,
        note: 'Consolidated intake packet (demo).',
        url: '/demo-case/VC_Demo_Intake.txt',
      },
      {
        id: 'demo-email-thread',
        name: 'Email_Thread_Support.msg',
        type: 'application/vnd.ms-outlook',
        size: 231004,
        note: 'Vendor communication and escalation history.',
      },
      {
        id: 'demo-photos',
        name: 'Delivery_Photos.zip',
        type: 'application/zip',
        size: 1250902,
        note: 'Photos showing missing accessories.',
      },
    ])
  }

  const submitAppeal = () => {
    if (!canSubmitAppeal) {
      return
    }
    setAppealSubmitted(true)
    setAppealId(`VC-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`)
  }

  const startOrchestrator = () => {
    if (!canStartSimulation) {
      return
    }
    setDisputeSubmitted(true)
    setRunState('running')
    setCurrentAgentIndex(0)
    setAgentStates(
      AGENTS.map((agent, index) => ({
        id: agent.id,
        status: index === 0 ? 'running' : 'idle',
      })),
    )
    setStartedAt(
      new Date().toLocaleTimeString('en-SG', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    )
    setRedoTargetAgentId('')
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

  const finalizeRun = useCallback(() => {
    setAgentStates((prev) =>
      prev.map((state) =>
        state.status === 'idle' ? state : { ...state, status: 'completed' },
      ),
    )
    setRunState('complete')
  }, [])

  const advanceAgent = useCallback(() => {
    const currentAgent = AGENTS[currentAgentIndex]
    if (!currentAgent) {
      return
    }

    const currentStatus = agentStatusMap[currentAgent.id]
    if (currentStatus === 'redo_requested') {
      setAgentStates((prev) =>
        prev.map((state) =>
          state.id === currentAgent.id ? { ...state, status: 'running' } : state,
        ),
      )
      return
    }

    const gateNow = shouldGate(currentAgentIndex)
    const isLast = currentAgentIndex >= AGENTS.length - 1

    setAgentStates((prev) => {
      const updated = prev.map((state) => ({ ...state }))
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

    if (gateNow) {
      setRunState('waiting_judge')
      return
    }

    if (isLast) {
      finalizeRun()
      return
    }

    setCurrentAgentIndex((index) => index + 1)
    if (redoTargetAgentId === AGENTS[currentAgentIndex].id) {
      setRedoTargetAgentId('')
    }
  }, [
    agentStatusMap,
    currentAgentIndex,
    finalizeRun,
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

    const isLast = currentAgentIndex >= AGENTS.length - 1

    setAgentStates((prev) => {
      const updated = prev.map((state) => ({ ...state }))
      updated[currentAgentIndex].status = 'approved'

      if (!isLast) {
        updated[currentAgentIndex + 1].status = 'running'
      }
      return updated
    })

    if (isLast) {
      finalizeRun()
      return
    }

    setRunState('running')
    setCurrentAgentIndex((index) => index + 1)
  }

  const sendBackToAgent = (agentId) => {
    const targetIndex = AGENTS.findIndex((agent) => agent.id === agentId)
    if (targetIndex < 0) {
      return
    }

    setRedoTargetAgentId(agentId)
    setRunState('running')
    setCurrentAgentIndex(targetIndex)
    setAgentStates((prev) =>
      prev.map((state, index) => {
        if (index < targetIndex) {
          return { ...state, status: 'approved' }
        }
        if (index === targetIndex) {
          return { ...state, status: 'redo_requested' }
        }
        return { ...state, status: 'idle' }
      }),
    )
  }

  const onFieldChange = (event) => {
    const { name, value } = event.target
    setFormState((previous) => ({ ...previous, [name]: value }))
  }

  const onFilesSelected = (event) => {
    const fileList = Array.from(event.target.files || [])
    if (fileList.length === 0) {
      return
    }

    setUploadedFiles((previous) => [
      ...previous,
      ...fileList.map((file) => ({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(16).slice(2)}`,
        name: file.name,
        type: file.type || 'unknown',
        size: file.size,
        note: '',
      })),
    ])

    event.target.value = ''
  }

  const onFileNoteChange = (fileId, note) => {
    setUploadedFiles((previous) =>
      previous.map((file) => (file.id === fileId ? { ...file, note } : file)),
    )
  }

  const onFileRemove = (fileId) => {
    setUploadedFiles((previous) => previous.filter((file) => file.id !== fileId))
  }

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
        </nav>
        <span className={`status-chip ${runStatusClass}`}>
          {runStatusLabel}
        </span>
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
                uploadedFiles={uploadedFiles}
                onFilesSelected={onFilesSelected}
                onFileNoteChange={onFileNoteChange}
                onFileRemove={onFileRemove}
                loadDemoCase={loadDemoCase}
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
              />
            }
          />
        </Routes>
      </main>
    </div>
  )
}

export default App
