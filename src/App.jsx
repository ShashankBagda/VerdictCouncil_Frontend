import { useEffect, useMemo, useState } from 'react'
import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import './App.css'
import {
  AGENT_FLOORS,
  LEGAL_CONTEXT,
  buildPipeline,
  roomLookup,
} from './data/architecture'
import AppealIntakePage from './pages/AppealIntakePage'
import BuildingSimulationPage from './pages/BuildingSimulationPage'
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

function App() {
  const [formState, setFormState] = useState(DEFAULT_FORM)
  const [appealId, setAppealId] = useState('')
  const [appealSubmitted, setAppealSubmitted] = useState(false)
  const [disputeSubmitted, setDisputeSubmitted] = useState(false)
  const [simulationState, setSimulationState] = useState('idle')
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [startedAt, setStartedAt] = useState('')
  const [selectedFloorId, setSelectedFloorId] = useState(AGENT_FLOORS[0].id)

  const pipelinePhases = useMemo(
    () => buildPipeline(formState.domain),
    [formState.domain],
  )

  const canSubmitAppeal =
    formState.caseTitle.trim().length > 3 &&
    formState.appellant.trim().length > 2 &&
    formState.respondent.trim().length > 2

  const canStartSimulation =
    appealSubmitted &&
    formState.disputeType &&
    formState.disputeSummary.trim().length > 15

  const currentPhase =
    pipelinePhases[Math.min(phaseIndex, pipelinePhases.length - 1)] ||
    pipelinePhases[0]

  const activeRooms = simulationState === 'running' ? currentPhase.rooms : []

  const completedRooms = useMemo(() => {
    if (simulationState === 'idle') {
      return []
    }
    if (simulationState === 'complete') {
      return [...new Set(pipelinePhases.flatMap((phase) => phase.rooms))]
    }
    return [...new Set(pipelinePhases.slice(0, phaseIndex).flatMap((phase) => phase.rooms))]
  }, [phaseIndex, pipelinePhases, simulationState])

  const progressPercent =
    simulationState === 'idle'
      ? 0
      : simulationState === 'complete'
        ? 100
        : Math.round(((phaseIndex + 1) / pipelinePhases.length) * 100)

  const activeRoomNames = activeRooms.map((roomId) => roomLookup[roomId]?.name || roomId)
  const legalPack = LEGAL_CONTEXT[formState.domain]

  useEffect(() => {
    if (simulationState !== 'running') {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      setPhaseIndex((current) => {
        if (current >= pipelinePhases.length - 1) {
          setSimulationState('complete')
          return current
        }
        return current + 1
      })
    }, 2500)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [pipelinePhases.length, simulationState])

  const onFieldChange = (event) => {
    const { name, value } = event.target
    setFormState((previous) => ({ ...previous, [name]: value }))
  }

  const submitAppeal = () => {
    if (!canSubmitAppeal) {
      return
    }
    setAppealSubmitted(true)
    setAppealId(
      `VC-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    )
  }

  const startAgentSimulation = () => {
    if (!canStartSimulation) {
      return
    }
    setDisputeSubmitted(true)
    setSimulationState('running')
    setPhaseIndex(0)
    setStartedAt(
      new Date().toLocaleTimeString('en-SG', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    )
  }

  const resetFlow = () => {
    setFormState(DEFAULT_FORM)
    setAppealId('')
    setAppealSubmitted(false)
    setDisputeSubmitted(false)
    setSimulationState('idle')
    setPhaseIndex(0)
    setStartedAt('')
    setSelectedFloorId(AGENT_FLOORS[0].id)
  }

  return (
    <div className="vc-shell">
      <header className="vc-header panel-frame">
        <div>
          <p className="eyebrow">VerdictCouncil / v4 UI Flow</p>
          <h1>Appeal Intake, Building Simulation, Pipeline Review</h1>
          <p className="header-subtitle">
            UI is now split into dedicated pages and floor categories are mapped from
            agent architecture specification v4.
          </p>
        </div>
        <div className="header-right">
          <div className="branch-lanes">
            <span className="lane-tag main">main</span>
            <span className="lane-tag development">development</span>
            <span className="lane-tag release">release</span>
          </div>
          <nav className="page-nav">
            <NavLink to="/intake">Intake</NavLink>
            <NavLink to="/building">Building</NavLink>
            <NavLink to="/pipeline">Pipeline</NavLink>
          </nav>
        </div>
      </header>

      <main>
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
                startAgentSimulation={startAgentSimulation}
                resetFlow={resetFlow}
                appealSubmitted={appealSubmitted}
                appealId={appealId}
                disputeSubmitted={disputeSubmitted}
                simulationState={simulationState}
                startedAt={startedAt}
              />
            }
          />
          <Route
            path="/building"
            element={
              <BuildingSimulationPage
                floors={AGENT_FLOORS}
                selectedFloorId={selectedFloorId}
                setSelectedFloorId={setSelectedFloorId}
                simulationState={simulationState}
                currentPhase={currentPhase}
                activeRooms={activeRooms}
                completedRooms={completedRooms}
              />
            }
          />
          <Route
            path="/pipeline"
            element={
              <AgentPipelinePage
                pipelinePhases={pipelinePhases}
                simulationState={simulationState}
                phaseIndex={phaseIndex}
                progressPercent={progressPercent}
                activeRoomNames={activeRoomNames}
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
