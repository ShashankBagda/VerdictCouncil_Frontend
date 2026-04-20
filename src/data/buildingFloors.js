// Maps VerdictCouncil's 9 agents to FloorPixelMap floor/room structure

const DEFAULT_ROOM_ASSETS = {
  wall: '/pixel-assets/l1/Wall-Graph.png',
  desk: '/pixel-assets/l1/Desk.png',
  monitor: '/pixel-assets/l1/Big-Office-Printer.png',
  prop: '/pixel-assets/l1/Small-Plant.png',
};

export const BUILDING_FLOORS = [
  {
    id: 'floor-4',
    number: 4,
    title: 'Evidence Layer',
    layoutTemplate: 'split_wings',
    rooms: [
      {
        id: 'evidence-analysis',
        label: 'Evidence Analysis',
        floorId: 'floor-4',
        interiorTheme: 'evidence',
        code: 'EA-03',
        roleLabel: 'Evidence Quality',
        taskLabel: 'Check admissibility, contradictions, and coverage gaps.',
        npcs: 4,
        assets: DEFAULT_ROOM_ASSETS,
        linksTo: ['fact-reconstruction'],
      },
      {
        id: 'fact-reconstruction',
        label: 'Fact Reconstruction',
        floorId: 'floor-4',
        interiorTheme: 'timeline',
        code: 'FR-04',
        roleLabel: 'Timeline Building',
        taskLabel: 'Transform evidence into structured events and timelines.',
        npcs: 4,
        assets: DEFAULT_ROOM_ASSETS,
        linksTo: ['witness-analysis'],
      },
      {
        id: 'witness-analysis',
        label: 'Witness Analysis',
        floorId: 'floor-4',
        interiorTheme: 'witness',
        code: 'WA-05',
        roleLabel: 'Credibility',
        taskLabel: 'Identify witnesses, simulate testimony, and score reliability.',
        npcs: 3,
        assets: DEFAULT_ROOM_ASSETS,
        linksTo: ['legal-knowledge'],
      },
    ],
  },
  {
    id: 'floor-3',
    number: 3,
    title: 'Legal Layer',
    layoutTemplate: 'default',
    rooms: [
      {
        id: 'legal-knowledge',
        label: 'Legal Knowledge',
        floorId: 'floor-3',
        interiorTheme: 'policy',
        code: 'LK-06',
        roleLabel: 'Statutes + Precedent',
        taskLabel: 'Retrieve rules, cases, and relevant legal standards.',
        npcs: 3,
        assets: DEFAULT_ROOM_ASSETS,
        linksTo: ['argument-construction'],
      },
      {
        id: 'argument-construction',
        label: 'Argument Construction',
        floorId: 'floor-3',
        interiorTheme: 'advocate',
        code: 'AC-07',
        roleLabel: 'Claim vs Defense',
        taskLabel: 'Generate and compare claimant and respondent arguments.',
        npcs: 3,
        assets: DEFAULT_ROOM_ASSETS,
        linksTo: ['deliberation'],
      },
    ],
  },
  {
    id: 'floor-2',
    number: 2,
    title: 'Processing Layer',
    layoutTemplate: 'default',
    rooms: [
      {
        id: 'case-processing',
        label: 'Case Processing',
        floorId: 'floor-2',
        interiorTheme: 'intake',
        code: 'CP-01',
        roleLabel: 'Initialization',
        taskLabel: 'Parse intake, structure case, classify domain, and validate jurisdiction.',
        npcs: 5,
        assets: DEFAULT_ROOM_ASSETS,
        linksTo: ['complexity-routing'],
      },
      {
        id: 'complexity-routing',
        label: 'Complexity Routing',
        floorId: 'floor-2',
        interiorTheme: 'classification',
        code: 'CR-02',
        roleLabel: 'Control Gate',
        taskLabel: 'Assess complexity, escalate if required, and route the case path.',
        npcs: 4,
        assets: DEFAULT_ROOM_ASSETS,
        linksTo: ['evidence-analysis'],
      },
    ],
  },
  {
    id: 'floor-1',
    number: 1,
    title: 'Decision Layer',
    layoutTemplate: 'default',
    rooms: [
      {
        id: 'deliberation',
        label: 'Deliberation',
        floorId: 'floor-1',
        interiorTheme: 'deliberation',
        code: 'DL-08',
        roleLabel: 'Judicial Reasoning',
        taskLabel: 'Synthesize facts, law, and arguments into judicial reasoning.',
        npcs: 3,
        assets: DEFAULT_ROOM_ASSETS,
        linksTo: ['governance-verdict'],
      },
      {
        id: 'governance-verdict',
        label: 'Governance & Verdict',
        floorId: 'floor-1',
        interiorTheme: 'verdict',
        code: 'GV-09',
        roleLabel: 'Fairness + Confidence',
        taskLabel: 'Validate fairness constraints and issue recommendation output.',
        npcs: 2,
        assets: DEFAULT_ROOM_ASSETS,
        linksTo: [],
      },
    ],
  },
];

/**
 * Given the list of agent statuses from the pipeline status API,
 * return { activeRooms, completedRooms } for a given floor.
 */
export function deriveRoomStatus(agentStatuses, floorId) {
  const floor = BUILDING_FLOORS.find((f) => f.id === floorId);
  if (!floor || !agentStatuses) {
    return { activeRooms: [], completedRooms: [], failedRooms: [] };
  }

  const activeRooms = [];
  const completedRooms = [];
  const failedRooms = [];

  floor.rooms.forEach((room) => {
    const agent = agentStatuses.find((a) => a.agent_id === room.id);
    if (!agent) return;
    if (agent.status === 'running') activeRooms.push(room.id);
    if (agent.status === 'completed') completedRooms.push(room.id);
    if (agent.status === 'failed') failedRooms.push(room.id);
  });

  return { activeRooms, completedRooms, failedRooms };
}
