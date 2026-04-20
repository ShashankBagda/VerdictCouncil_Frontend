import React, { useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { RefreshCw, WifiOff } from 'lucide-react';
import { useAPI, useCase, usePipelineStatus } from '../../hooks';
import FloorPixelMap from '../../components/FloorPixelMap';
import AgentStreamPanel from '../../components/AgentStreamPanel';
import { BUILDING_FLOORS, deriveRoomStatus } from '../../data/buildingFloors';

const FADE = { IDLE: 'idle', OUT: 'fade_out', IN: 'fade_in' };

export default function BuildingSimulation() {
  const { caseId } = useParams();
  const { showError } = useAPI();
  const { updatePipelineStatus } = useCase();

  const [selectedFloor, setSelectedFloor] = useState(BUILDING_FLOORS[0]);
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [fadeState, setFadeState] = useState(FADE.IDLE);

  const {
    loading,
    pipelineStatus,
    error,
    isStale,
    isGivenUp,
    retry,
  } = usePipelineStatus(caseId, {
    onStatus: updatePipelineStatus,
    onError: showError,
  });

  const switchFloor = useCallback(
    (floor) => {
      if (floor.id === selectedFloor.id) return;
      setFadeState(FADE.OUT);
      setTimeout(() => {
        setSelectedFloor(floor);
        setSelectedAgentId(null);
        setFadeState(FADE.IN);
        setTimeout(() => setFadeState(FADE.IDLE), 210);
      }, 170);
    },
    [selectedFloor],
  );

  const handleSelectAgent = useCallback((roomId) => {
    setSelectedAgentId(roomId);
  }, []);

  const { activeRooms, completedRooms } = deriveRoomStatus(
    pipelineStatus?.agents,
    selectedFloor.id,
  );
  const isDev = import.meta.env.DEV;

  const mapTelemetry = useMemo(() => {
    const roomNpcCounts = selectedFloor.rooms.map((room) => ({
      roomId: room.id,
      npcCount: Number.isFinite(room.npcs) ? room.npcs : 0,
    }));

    return {
      selectedRoomId: selectedAgentId || 'none',
      totalNpcs: roomNpcCounts.reduce((acc, room) => acc + room.npcCount, 0),
      roomNpcCounts,
    };
  }, [selectedAgentId, selectedFloor]);

  if (loading && !pipelineStatus) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="spinner w-8 h-8 mx-auto mb-4" />
          <p className="text-gray-600">Loading building visualization...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Top bar: overall progress */}
      <div className="flex items-center justify-between bg-white rounded-lg shadow-sm px-6 py-3 border border-gray-200">
        <div>
          <h2 className="text-xl font-bold text-navy-900">Verdict Council Building</h2>
          <p className="text-sm text-gray-600">9-agent pipeline for case {caseId}</p>
        </div>
        {pipelineStatus && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Progress</span>
            <div className="w-32 h-2 bg-gray-200 rounded-full">
              <div
                className="h-2 bg-teal-500 rounded-full transition-all duration-500"
                style={{
                  width: `${pipelineStatus.overall_progress_percent || 0}%`,
                }}
              />
            </div>
            <span className="text-sm font-semibold text-teal-700">
              {pipelineStatus.overall_progress_percent || 0}%
            </span>
            <span
              className={`px-2 py-0.5 rounded text-xs font-semibold capitalize ${
                pipelineStatus.overall_status === 'processing'
                  ? 'bg-blue-100 text-blue-800'
                  : pipelineStatus.overall_status === 'ready_for_review'
                    ? 'bg-emerald-100 text-emerald-800'
                    : pipelineStatus.overall_status === 'completed'
                      ? 'bg-emerald-100 text-emerald-800'
                      : pipelineStatus.overall_status === 'failed'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-gray-100 text-gray-800'
              }`}
            >
              {pipelineStatus.overall_status?.replace(/_/g, ' ')}
            </span>

            {/* Stale / error indicators */}
            {isStale && !isGivenUp && (
              <span
                className="flex items-center gap-1 text-xs text-amber-600"
                title="Data may be stale — waiting for next update"
              >
                <WifiOff className="w-3 h-3" />
                <span className="hidden sm:inline">Stale</span>
              </span>
            )}
            {isGivenUp && (
              <button
                onClick={retry}
                className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800"
                title="Polling stopped — click to retry"
              >
                <RefreshCw className="w-3 h-3" /> Retry
              </button>
            )}
            {error && !isGivenUp && (
              <span
                className="text-xs text-rose-500 max-w-[160px] truncate"
                title={error}
              >
                {error}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Connection error banner */}
      {isGivenUp && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-2 flex items-center justify-between">
          <p className="text-sm text-rose-700">
            Pipeline polling stopped due to repeated errors.
            {error && <span className="ml-1 text-rose-500">({error})</span>}
          </p>
          <button
            onClick={retry}
            className="text-sm text-teal-700 hover:text-teal-900 flex items-center gap-1 font-semibold"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      )}

      {/* Stale data warning — softer than give-up */}
      {isStale && !isGivenUp && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 flex items-center gap-2">
          <WifiOff className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-700">
            Pipeline data may be stale — waiting for the next update from the server.
          </p>
        </div>
      )}

      {/* Floor selector tabs */}
      <div className="flex gap-2">
        {BUILDING_FLOORS.map((floor) => (
          <button
            key={floor.id}
            onClick={() => switchFloor(floor)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              selectedFloor.id === floor.id
                ? 'bg-navy-900 text-white shadow'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            Floor {floor.number}: {floor.title}
          </button>
        ))}
      </div>

      {/* Main split panel */}
      <div className="flex gap-4 flex-1 min-h-0" style={{ height: '520px' }}>
        {/* Left: Pixi.js building (55%) */}
        <div
          className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-900"
          style={{
            width: '55%',
            opacity: fadeState === FADE.IDLE ? 1 : 0,
            transition:
              fadeState === FADE.OUT
                ? 'opacity 170ms ease-out'
                : fadeState === FADE.IN
                  ? 'opacity 210ms ease-in'
                  : 'none',
          }}
        >
          <FloorPixelMap
            floor={selectedFloor}
            activeRooms={activeRooms}
            completedRooms={completedRooms}
          />
          <div className="absolute bottom-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded">
            Click an agent name below to view its stream
          </div>
        </div>

        {/* Right: Agent stream panel (45%) */}
        <div style={{ width: '45%' }}>
          <AgentStreamPanel
            caseId={caseId}
            selectedAgentId={selectedAgentId}
            agentStatuses={pipelineStatus?.agents}
          />
        </div>
      </div>

      {/* Agent selector row */}
      <div className="flex flex-wrap gap-2">
        {selectedFloor.rooms.map((room) => {
          const agentStatus = pipelineStatus?.agents?.find(
            (a) => a.agent_id === room.id,
          );
          const status = agentStatus?.status || 'pending';
          return (
            <button
              key={room.id}
              onClick={() => handleSelectAgent(room.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border-2 ${
                selectedAgentId === room.id
                  ? 'border-teal-500 bg-teal-50 text-teal-800'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              <span
                className={`mr-1.5 inline-block w-2 h-2 rounded-full ${
                  status === 'running'
                    ? 'bg-blue-500 animate-pulse'
                    : status === 'completed'
                      ? 'bg-emerald-500'
                      : status === 'failed'
                        ? 'bg-rose-500'
                        : 'bg-gray-300'
                }`}
              />
              {room.label}
            </button>
          );
        })}
      </div>

      {isDev && (
        <div className="bg-gray-900 rounded-lg border border-gray-700 px-3 py-2">
          <p className="text-xs text-gray-300 font-semibold mb-1">Map telemetry</p>
          <p className="text-[11px] text-gray-400">
            selectedRoom={mapTelemetry.selectedRoomId} totalNpcs={mapTelemetry.totalNpcs}
          </p>
          <p className="text-[11px] text-gray-500 truncate">
            {mapTelemetry.roomNpcCounts.map((room) => `${room.roomId}:${room.npcCount}`).join(' | ')}
          </p>
        </div>
      )}
    </div>
  );
}
