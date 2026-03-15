import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import FloorPixelMap from '../components/FloorPixelMap'

const FADE_OUT_MS = 170
const FADE_IN_MS = 210

function BuildingSimulationPage({
  floors,
  selectedFloorId,
  setSelectedFloorId,
  simulationState,
  currentPhase,
  activeRooms,
  completedRooms,
}) {
  const [displayFloorId, setDisplayFloorId] = useState(selectedFloorId)
  const [pendingFloorId, setPendingFloorId] = useState(null)
  const [fadePhase, setFadePhase] = useState('idle')

  const activeSet = useMemo(() => new Set(activeRooms), [activeRooms])
  const doneSet = useMemo(() => new Set(completedRooms), [completedRooms])

  const displayFloor = floors.find((floor) => floor.id === displayFloorId) || floors[0]
  const isSwitching = fadePhase !== 'idle'

  useEffect(() => {
    if (fadePhase !== 'idle') {
      return
    }
    setDisplayFloorId(selectedFloorId)
  }, [fadePhase, selectedFloorId])

  useEffect(() => {
    if (fadePhase === 'fade_out' && pendingFloorId) {
      const timeout = window.setTimeout(() => {
        setDisplayFloorId(pendingFloorId)
        setSelectedFloorId(pendingFloorId)
        setFadePhase('fade_in')
      }, FADE_OUT_MS)
      return () => window.clearTimeout(timeout)
    }

    if (fadePhase === 'fade_in') {
      const timeout = window.setTimeout(() => {
        setFadePhase('idle')
        setPendingFloorId(null)
      }, FADE_IN_MS)
      return () => window.clearTimeout(timeout)
    }

    return undefined
  }, [fadePhase, pendingFloorId, setSelectedFloorId])

  const requestFloor = (floorId) => {
    if (isSwitching || floorId === displayFloorId) {
      return
    }
    setPendingFloorId(floorId)
    setFadePhase('fade_out')
  }

  const roomStatus = (roomId) => {
    if (activeSet.has(roomId)) {
      return 'active'
    }
    if (doneSet.has(roomId)) {
      return 'done'
    }
    return 'idle'
  }

  return (
    <section className="panel-frame page-panel">
      <header className="page-header">
        <div>
          <h2>Court Building Simulation</h2>
          <p className="section-note">
            Floor switching uses a clean fade transition and each office displays agent
            code, role, and task summary.
          </p>
        </div>
        <span className={`building-state ${simulationState}`}>
          {simulationState === 'running'
            ? `Live: ${currentPhase.title}`
            : simulationState === 'complete'
              ? 'Run complete'
              : 'Waiting for run'}
        </span>
      </header>

      <div className="building-layout">
        <aside className="floor-selector-panel">
          <h3>Floors</h3>
          <div className="floor-indicator">
            <span>Viewing</span>
            <strong>{displayFloor.title}</strong>
            <small>{isSwitching ? 'Switching...' : 'Ready'}</small>
          </div>
          <div className="floor-menu-list">
            {floors
              .slice()
              .reverse()
              .map((floor) => (
                <button
                  type="button"
                  key={floor.id}
                  className={floor.id === displayFloor.id ? 'active' : ''}
                  disabled={isSwitching}
                  onClick={() => requestFloor(floor.id)}
                  aria-label={`Go to ${floor.title}`}
                >
                  <span>{floor.title}</span>
                  <strong>{floor.category}</strong>
                </button>
              ))}
          </div>
        </aside>

        <article className="floor-view">
          <header className="floor-view-header">
            <div>
              <h3>{displayFloor.title}</h3>
              <p>{displayFloor.category}</p>
              <small>{displayFloor.description}</small>
            </div>
          </header>

          <div className={`map-fade-stage ${fadePhase}`}>
            <FloorPixelMap
              floor={displayFloor}
              activeRooms={activeRooms}
              completedRooms={completedRooms}
            />
          </div>

          <div className="room-detail-grid">
            {displayFloor.rooms.map((room) => {
              const status = roomStatus(room.id)
              return (
                <article key={room.id} className={`room-detail ${status}`}>
                  <header>
                    <span>{room.code}</span>
                    <small>
                      {status === 'active'
                        ? 'working'
                        : status === 'done'
                          ? 'completed'
                          : 'standby'}
                    </small>
                  </header>
                  <h4>{room.name}</h4>
                  <p className="room-role">{room.roleLabel}</p>
                  <p className="room-task">{room.taskLabel}</p>
                </article>
              )
            })}
          </div>
        </article>
      </div>

      <footer className="page-footer">
        <Link to="/intake" className="inline-link">
          Go to Intake Page
        </Link>
        <Link to="/pipeline" className="inline-link">
          Go to Pipeline Page
        </Link>
      </footer>
    </section>
  )
}

export default BuildingSimulationPage
