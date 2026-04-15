// Maps VerdictCouncil's 9 agents to FloorPixelMap floor/room structure

export const BUILDING_FLOORS = [
  {
    id: 'floor-4',
    number: 4,
    title: 'Evidence Layer',
    layoutTemplate: 'split_wings',
    rooms: [
      { id: 'evidence-analysis', theme: 'evidence', label: 'Evidence Analysis' },
      { id: 'fact-reconstruction', theme: 'timeline', label: 'Fact Reconstruction' },
      { id: 'witness-analysis', theme: 'witness', label: 'Witness Analysis' },
    ],
  },
  {
    id: 'floor-3',
    number: 3,
    title: 'Legal Layer',
    layoutTemplate: 'default',
    rooms: [
      { id: 'legal-knowledge', theme: 'policy', label: 'Legal Knowledge' },
      { id: 'argument-construction', theme: 'advocate', label: 'Argument Construction' },
    ],
  },
  {
    id: 'floor-2',
    number: 2,
    title: 'Processing Layer',
    layoutTemplate: 'default',
    rooms: [
      { id: 'case-processing', theme: 'intake', label: 'Case Processing' },
      { id: 'complexity-routing', theme: 'classification', label: 'Complexity Routing' },
    ],
  },
  {
    id: 'floor-1',
    number: 1,
    title: 'Decision Layer',
    layoutTemplate: 'default',
    rooms: [
      { id: 'deliberation', theme: 'deliberation', label: 'Deliberation' },
      { id: 'governance-verdict', theme: 'verdict', label: 'Governance & Verdict' },
    ],
  },
];

/**
 * Given the list of agent statuses from the pipeline status API,
 * return { activeRooms, completedRooms } for a given floor.
 */
export function deriveRoomStatus(agentStatuses, floorId) {
  const floor = BUILDING_FLOORS.find((f) => f.id === floorId);
  if (!floor || !agentStatuses) return { activeRooms: [], completedRooms: [] };

  const activeRooms = [];
  const completedRooms = [];

  floor.rooms.forEach((room) => {
    const agent = agentStatuses.find((a) => a.agent_id === room.id);
    if (!agent) return;
    if (agent.status === 'running') activeRooms.push(room.id);
    if (agent.status === 'completed') completedRooms.push(room.id);
  });

  return { activeRooms, completedRooms };
}
