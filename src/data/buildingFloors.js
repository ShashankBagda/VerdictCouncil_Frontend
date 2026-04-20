// Maps VerdictCouncil's 9 agents to FloorPixelMap floor/room structure

const DEFAULT_ROOM_ASSETS = {
  wall: '/pixel-assets/walls/kenney_dirt_tile.png',
  desk: '/pixel-assets/desks/itch_wood_desk.png',
  monitor: '/pixel-assets/monitors/kenney_console_alt.png',
  prop: '/pixel-assets/props/itch_bookshelf.png',
};

const ROOM_ASSET_PRESETS = {
  intake: {
    wall: '/pixel-assets/walls/kenney_grass_tile.png',
    desk: '/pixel-assets/desks/itch_wood_desk.png',
    monitor: '/pixel-assets/monitors/kenney_console_alt.png',
    prop: '/pixel-assets/oga/office/water-bottle.png',
  },
  classification: {
    wall: '/pixel-assets/walls/kenney_dirt_tile.png',
    desk: '/pixel-assets/desks/itch_drawer_desk.png',
    monitor: '/pixel-assets/monitors/kenney_console_red.png',
    prop: '/pixel-assets/oga/office/office-paper-work.png',
  },
  evidence: {
    wall: '/pixel-assets/walls/kenney_dirt_tile.png',
    desk: '/pixel-assets/desks/itch_drawer_desk.png',
    monitor: '/pixel-assets/monitors/kenney_console_red.png',
    prop: '/pixel-assets/props/itch_cabinet.png',
  },
  timeline: {
    wall: '/pixel-assets/walls/kenney_grass_tile.png',
    desk: '/pixel-assets/desks/itch_wood_desk.png',
    monitor: '/pixel-assets/monitors/kenney_console_alt.png',
    prop: '/pixel-assets/oga/office/cup-of-pens.png',
  },
  witness: {
    wall: '/pixel-assets/walls/kenney_dirt_tile.png',
    desk: '/pixel-assets/desks/itch_wood_desk.png',
    monitor: '/pixel-assets/monitors/kenney_console_alt.png',
    prop: '/pixel-assets/props/itch_chair_red.png',
  },
  policy: {
    wall: '/pixel-assets/walls/kenney_grass_tile.png',
    desk: '/pixel-assets/desks/itch_drawer_desk.png',
    monitor: '/pixel-assets/monitors/kenney_console_red.png',
    prop: '/pixel-assets/props/itch_bookshelf.png',
  },
  advocate: {
    wall: '/pixel-assets/walls/kenney_dirt_tile.png',
    desk: '/pixel-assets/desks/itch_drawer_desk.png',
    monitor: '/pixel-assets/monitors/kenney_console_red.png',
    prop: '/pixel-assets/oga/office/office-paper-work.png',
  },
  deliberation: {
    wall: '/pixel-assets/walls/kenney_grass_tile.png',
    desk: '/pixel-assets/desks/itch_wood_desk.png',
    monitor: '/pixel-assets/monitors/kenney_console_alt.png',
    prop: '/pixel-assets/props/itch_small_drawer.png',
  },
  verdict: {
    wall: '/pixel-assets/walls/kenney_dirt_tile.png',
    desk: '/pixel-assets/desks/itch_drawer_desk.png',
    monitor: '/pixel-assets/monitors/kenney_console_red.png',
    prop: '/pixel-assets/oga/office/cup-of-pens.png',
  },
};

const roomAssets = (theme) => ROOM_ASSET_PRESETS[theme] || DEFAULT_ROOM_ASSETS;

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
        assets: roomAssets('evidence'),
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
        assets: roomAssets('timeline'),
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
        assets: roomAssets('witness'),
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
        assets: roomAssets('policy'),
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
        assets: roomAssets('advocate'),
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
        assets: roomAssets('intake'),
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
        assets: roomAssets('classification'),
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
        assets: roomAssets('deliberation'),
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
        assets: roomAssets('verdict'),
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
