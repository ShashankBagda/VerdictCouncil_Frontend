export const AGENT_LAYERS = [
  {
    id: 'case-prep',
    title: 'Case Preparation',
    description: 'Initialize the case, classify the domain, and validate jurisdiction.',
  },
  {
    id: 'evidence-recon',
    title: 'Evidence Reconstruction',
    description: 'Analyze evidence, reconstruct facts, and assess witness reliability.',
  },
  {
    id: 'legal-reasoning',
    title: 'Legal Reasoning',
    description: 'Retrieve legal knowledge and construct arguments.',
  },
  {
    id: 'judicial-decision',
    title: 'Judicial Decision',
    description: 'Synthesize deliberation and governance into a verdict.',
  },
]

export const AGENTS = [
  {
    id: 'case-processing',
    title: 'Case Processing',
    layerId: 'case-prep',
    roleLabel: 'Initialization',
    taskLabel: 'Parse intake, structure case, classify domain, validate jurisdiction.',
  },
  {
    id: 'complexity-routing',
    title: 'Complexity & Routing',
    layerId: 'case-prep',
    roleLabel: 'Control Gate',
    taskLabel: 'Assess complexity, escalate if required, and route the case path.',
  },
  {
    id: 'evidence-analysis',
    title: 'Evidence Analysis',
    layerId: 'evidence-recon',
    roleLabel: 'Evidence Quality',
    taskLabel: 'Check admissibility, contradictions, and coverage gaps.',
  },
  {
    id: 'fact-reconstruction',
    title: 'Fact Reconstruction',
    layerId: 'evidence-recon',
    roleLabel: 'Timeline Building',
    taskLabel: 'Transform evidence into structured events and timelines.',
  },
  {
    id: 'witness-analysis',
    title: 'Witness Analysis',
    layerId: 'evidence-recon',
    roleLabel: 'Credibility',
    taskLabel: 'Identify witnesses, simulate testimony, and score reliability.',
  },
  {
    id: 'legal-knowledge',
    title: 'Legal Knowledge',
    layerId: 'legal-reasoning',
    roleLabel: 'Statutes + Precedent',
    taskLabel: 'Retrieve rules, cases, and relevant legal standards.',
  },
  {
    id: 'argument-construction',
    title: 'Argument Construction',
    layerId: 'legal-reasoning',
    roleLabel: 'Claim vs Defense',
    taskLabel: 'Generate and compare claimant and respondent arguments.',
  },
  {
    id: 'deliberation',
    title: 'Deliberation',
    layerId: 'judicial-decision',
    roleLabel: 'Judicial Reasoning',
    taskLabel: 'Synthesize facts, law, and arguments into reasoning.',
  },
  {
    id: 'governance-verdict',
    title: 'Governance & Verdict',
    layerId: 'judicial-decision',
    roleLabel: 'Fairness + Confidence',
    taskLabel: 'Validate fairness and issue the confidence-scored recommendation.',
  },
]

export const LEGAL_CONTEXT = {
  small_claims: {
    title: 'Small Claims Tribunal Path',
    details: [
      'Argument Construction emphasizes balanced claimant vs respondent analysis.',
      'Complexity routing prioritizes early human escalation for high-value disputes.',
      'Judicial decision includes fairness checks before recommendation delivery.',
    ],
  },
  traffic_violation: {
    title: 'Traffic Violation Path',
    details: [
      'Argument Construction emphasizes prosecution vs defense synthesis.',
      'Legal Knowledge retrieval is statute-heavy with penalty references.',
      'Governance & Verdict checks confidence before final recommendation.',
    ],
  },
}

const ARGUMENT_DETAILS = {
  small_claims:
    'Balanced claimant/respondent synthesis with settlement and remedy focus.',
  traffic_violation:
    'Prosecution/defense synthesis with statute and penalty alignment.',
}

export const buildPipeline = (domain) =>
  AGENTS.map((agent, index) => ({
    id: `stage-${index + 1}`,
    agentId: agent.id,
    title: agent.title,
    layerId: agent.layerId,
    detail:
      agent.id === 'argument-construction'
        ? ARGUMENT_DETAILS[domain] || ARGUMENT_DETAILS.small_claims
        : agent.taskLabel,
  }))
