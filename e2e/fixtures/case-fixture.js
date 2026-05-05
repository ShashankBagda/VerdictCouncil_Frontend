/**
 * Shared fixture data for story-evidence.spec.js.
 *
 * Every mock API response lives here so the spec only concerns itself with
 * navigation and screenshot logic. Shapes are derived from the normalizer
 * functions in src/lib/caseWorkspace.js.
 */

export const CASE_ID = '550e8400-e29b-41d4-a716-446655440001';
export const DOC_ID  = 'doc-aaa-111-bbb-222';

// ── Auth ──────────────────────────────────────────────────────────────────────

export const mockAuth = {
  id: 'user-judge-1',
  email: 'judge@vcourt.sg',
  role: 'judge',
  name: 'Judge Tan Wei Ming',
};

// Session endpoint: expires ~4 min from a fixed test date so SessionWarning
// (shown when remaining ≤ 5 min) fires without waiting for a real timer.
// Shape must satisfy buildSessionState() in src/lib/api.js:
//   root.user → used as the user object; OR id/email/role at root → looksLikeUser
export const mockSessionInfo = {
  user: {
    id: 'user-judge-1',
    email: 'judge@vcourt.sg',
    role: 'judge',
    name: 'Judge Tan Wei Ming',
  },
  expires_at: new Date(Date.now() + 4 * 60 * 1000).toISOString(),
  session_id: 'sess-test-001',
};

// ── Case list (US-003) ────────────────────────────────────────────────────────

export const mockCaseList = {
  items: [
    {
      id: CASE_ID,
      title: 'PP v Lim Ah Kow — Traffic Citation MC-2026-001',
      status: 'awaiting_review_gate1',
      domain: 'traffic_violation',
      created_at: '2026-05-01T08:00:00Z',
      party_1: 'Public Prosecutor',
      party_2: 'Lim Ah Kow',
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440002',
      title: 'Tan v Chen — Small Claims SCT-2026-042',
      status: 'completed',
      domain: 'small_claims',
      created_at: '2026-04-28T10:30:00Z',
      party_1: 'Tan Mei Li',
      party_2: 'Chen Jian Kang',
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440003',
      title: 'PP v Raj Kumar — Speeding MC-2026-007',
      status: 'processing',
      domain: 'traffic_violation',
      created_at: '2026-05-03T09:15:00Z',
      party_1: 'Public Prosecutor',
      party_2: 'Raj Kumar',
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440004',
      title: 'Wong v Lim — Deposit Dispute SCT-2026-088',
      status: 'ready_for_review',
      domain: 'small_claims',
      created_at: '2026-04-20T14:00:00Z',
      party_1: 'Wong Siew Fong',
      party_2: 'Lim Property Pte Ltd',
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440005',
      title: 'PP v Ng Boon Huat — Red Light MC-2026-015',
      status: 'failed',
      domain: 'traffic_violation',
      created_at: '2026-05-04T07:45:00Z',
      party_1: 'Public Prosecutor',
      party_2: 'Ng Boon Huat',
    },
  ],
  total: 5,
  page: 1,
  page_size: 20,
};

// ── Case detail (used by CaseDetail layout + CaseDossier) ────────────────────

export const mockCaseDetail = {
  id: CASE_ID,
  case_id: CASE_ID,
  title: 'PP v Lim Ah Kow — Traffic Citation MC-2026-001',
  status: 'awaiting_review_gate1',
  domain: 'traffic_violation',
  description: 'The accused, Lim Ah Kow, is charged under s65(1) of the Road Traffic Act for failing to conform to a traffic signal on 15 March 2026 at the junction of Orchard Road and Scotts Road, resulting in a collision with a bus.',
  created_at: '2026-05-01T08:00:00Z',
  party_1: 'Public Prosecutor',
  party_2: 'Lim Ah Kow',
  parties: [
    { name: 'Public Prosecutor', role: 'claimant' },
    { name: 'Lim Ah Kow', role: 'respondent' },
  ],
  jurisdiction: { status: 'pass', valid: true, reasons: ['Offence triable by Magistrate Court', 'Geographical jurisdiction confirmed'] },
  complexity: 'medium',
  claim_amount: null,
  gate_state: {
    gate1_status: 'paused',
    gate2_status: 'pending',
    gate3_status: 'pending',
    gate4_status: 'pending',
  },
  judicial_decision: null,
  documents: [
    {
      id: DOC_ID,
      filename: 'traffic-citation-MC-2026-001.pdf',
      file_type: 'application/pdf',
      kind: 'notice_of_traffic_offence',
      uploaded_at: '2026-05-01T08:05:00Z',
      openai_file_id: 'file-abc123',
    },
    {
      id: 'doc-bbb-333-ccc-444',
      filename: 'witness-statement-bus-driver.pdf',
      file_type: 'application/pdf',
      kind: 'witness_statement',
      uploaded_at: '2026-05-01T08:10:00Z',
      openai_file_id: 'file-def456',
    },
  ],
};

// Case detail variant where judicial decision already exists (for US-026 amend)
export const mockCaseDetailWithDecision = {
  ...mockCaseDetail,
  status: 'completed',
  gate_state: {
    gate1_status: 'passed',
    gate2_status: 'passed',
    gate3_status: 'passed',
    gate4_status: 'passed',
  },
  judicial_decision: {
    verdict_text: 'The accused is found guilty of failing to conform to a traffic signal under s65(1) of the Road Traffic Act. Fine of $1,000 and 8 demerit points are imposed.',
    recorded_at: '2026-05-04T14:30:00Z',
    ai_engagements: [
      { conclusion_type: 'verdict_recommendation', agreed: true, reasoning: '' },
      { conclusion_type: 'fairness_flag', agreed: false, reasoning: 'The flagged bias risk is mitigated by independent witness corroboration.' },
    ],
  },
};

// ── Pipeline status (US-002, US-022) ─────────────────────────────────────────

export const mockPipelineStatus = {
  overall_status: 'awaiting_review_gate1',
  overall_progress_percent: 14,
  agents: [
    { agent_id: 'intake',               status: 'completed', elapsed_seconds: 12 },
    { agent_id: 'research-evidence',    status: 'pending',   elapsed_seconds: null },
    { agent_id: 'research-facts',       status: 'pending',   elapsed_seconds: null },
    { agent_id: 'research-witnesses',   status: 'pending',   elapsed_seconds: null },
    { agent_id: 'research-law',         status: 'pending',   elapsed_seconds: null },
    { agent_id: 'synthesis',            status: 'pending',   elapsed_seconds: null },
    { agent_id: 'audit',                status: 'pending',   elapsed_seconds: null },
  ],
};

// SSE stream body — a few completed events so agent cards show content
export const SSE_STREAM_BODY = [
  `data: {"event":"agent_started","agent":"intake","ts":"2026-05-05T08:00:00Z"}\n\n`,
  `data: {"event":"tool_call","agent":"intake","tool_name":"extract_case_metadata","args":{"case_id":"${CASE_ID}"},"ts":"2026-05-05T08:00:02Z"}\n\n`,
  `data: {"event":"tool_result","agent":"intake","tool_name":"extract_case_metadata","result":{"domain":"traffic_violation","complexity":"medium"},"ts":"2026-05-05T08:00:03Z"}\n\n`,
  `data: {"event":"llm_response","agent":"intake","content":"Intake complete. Domain: traffic_violation, complexity: medium. Case forwarded to gate-1 review.","ts":"2026-05-05T08:00:10Z"}\n\n`,
  `data: {"event":"agent_completed","agent":"intake","ts":"2026-05-05T08:00:12Z","output_summary":"Jurisdiction confirmed, complexity assessed as medium"}\n\n`,
  `data: {"event":"awaiting_review","phase":"awaiting_review","detail":{"stopped_at":"gate1"},"ts":"2026-05-05T08:00:13Z"}\n\n`,
].join('');

// ── Dossier tab payloads ──────────────────────────────────────────────────────

// Evidence (US-004) — raw shape that normalizeEvidenceResource accepts
export const mockEvidence = {
  items: [
    {
      id: 'ev-001',
      evidence_type: 'documentary',
      title: 'Traffic Citation Notice MC-2026-001',
      description: 'Issued under s65(1) Road Traffic Act. Records the alleged red-light infringement at Orchard/Scotts junction on 15 Mar 2026 at 14:32.',
      strength: 'strong',
      source: 'Traffic Police Records',
      admissibility_flags: {},
      linked_claims: { main_charge: 'Failure to conform to traffic signal' },
    },
    {
      id: 'ev-002',
      evidence_type: 'testimonial',
      title: 'Bus Driver Witness Statement',
      description: 'Mr Chan Kah Wai (SMRT bus driver) states he observed the accused vehicle enter the junction on red. Statement consistent with CCTV footage timestamps.',
      strength: 'strong',
      source: 'Voluntary Statement — Traffic Police',
      admissibility_flags: {},
      linked_claims: {},
    },
    {
      id: 'ev-003',
      evidence_type: 'physical',
      title: 'CCTV Footage — Orchard/Scotts Junction Camera 4',
      description: 'Footage from 14:30–14:35 on 15 Mar 2026. Shows accused vehicle SGA1234Z crossing the stop line 1.8 seconds after signal turned red.',
      strength: 'strong',
      source: 'LTA Traffic Management Centre',
      admissibility_flags: {},
      linked_claims: {},
    },
  ],
};

// Evidence gaps (US-014) — extractEvidenceGapItems reads weak_evidence + uncorroborated_facts
export const mockEvidenceGaps = {
  weak_evidence: [
    {
      id: 'wev-001',
      evidence_type: 'testimonial',
      description: 'Accused claims traffic light was amber, not red. No independent corroboration of this claim.',
      strength: 'weak',
      admissibility_flags: { corroboration: 'required', source_verification: 'pending' },
    },
  ],
  uncorroborated_facts: [
    {
      id: 'uf-001',
      description: 'Accused states vehicle brakes malfunctioned. No mechanical inspection report in evidence.',
      confidence: 'low',
      status: 'uncorroborated',
    },
  ],
};

// Timeline (US-006, US-008) — raw shape for normalizeTimelineResource
// One event has source_document_id+page_number to enable citation drill-down (US-008)
export const mockTimeline = {
  items: [
    {
      id: 'fact-001',
      description: 'Accused vehicle SGA1234Z was stationary at Orchard/Scotts junction waiting for green signal.',
      event_date: '2026-03-15',
      event_time: '14:31:55',
      status: 'confirmed',
      source_document_id: DOC_ID,
      page_number: 2,
      corroboration: { participants: ['CCTV Camera 4', 'Bus driver Chan Kah Wai'] },
      confidence: 0.95,
    },
    {
      id: 'fact-002',
      description: 'Orchard/Scotts junction signal turned red at 14:32:00.',
      event_date: '2026-03-15',
      event_time: '14:32:00',
      status: 'confirmed',
      source_document_id: DOC_ID,
      page_number: 3,
      corroboration: { participants: ['CCTV Camera 4', 'Traffic light system log'] },
      confidence: 0.99,
    },
    {
      id: 'fact-003',
      description: 'Accused vehicle entered the junction 1.8 seconds after signal turned red, colliding with Bus SBS9876T.',
      event_date: '2026-03-15',
      event_time: '14:32:02',
      status: 'disputed',
      source_document_id: DOC_ID,
      page_number: 4,
      corroboration: { participants: ['CCTV Camera 4'] },
      confidence: 0.88,
    },
  ],
};

// Witnesses (US-012) — raw shape for normalizeWitnessResource
export const mockWitnesses = {
  items: [
    {
      id: 'wit-001',
      name: 'Chan Kah Wai',
      role: 'Bus Driver — SMRT Service 132',
      credibility_score: 85,
      simulated_testimony: 'I was waiting at the Orchard/Scotts stop light junction. The light turned red. I released the brakes and began to move forward. The car in question then crossed the stop line and hit the front of my bus. I am certain the light was red because I specifically checked before moving.',
      bias_indicators: { relationship: 'Independent witness', affiliation: 'SMRT Buses Ltd' },
    },
    {
      id: 'wit-002',
      name: 'Lim Ah Kow',
      role: 'Accused — Driver of SGA1234Z',
      credibility_score: 52,
      simulated_testimony: 'I believed the light was still amber when I entered the junction. My foot slipped on the brakes and the car moved forward unexpectedly. I did not intend to run the red light.',
      bias_indicators: { relationship: 'Accused — interested party', affiliation: null },
    },
  ],
};

// Statutes (US-004 — law tab)
export const mockStatutes = {
  items: [
    {
      id: 'stat-001',
      statute_name: 'Road Traffic Act, Cap 276',
      section: 's65(1)',
      application: 'A person who drives a motor vehicle in contravention of any traffic sign shall be guilty of an offence.',
      verbatim_text: 's65(1): It shall be an offence for any person to drive in contravention of any traffic sign.',
      relevance_score: 0.98,
    },
    {
      id: 'stat-002',
      statute_name: 'Road Traffic Act, Cap 276',
      section: 's131(2)',
      application: 'Penalties for failing to conform to traffic signals: fine not exceeding $1,000 and/or disqualification.',
      verbatim_text: 's131(2): A person convicted under s65 is liable to a fine not exceeding one thousand dollars.',
      relevance_score: 0.91,
    },
  ],
};

// Precedents (US-016) — extractPrecedentItems reads payload.results
export const mockPrecedents = {
  results: [
    {
      id: 'prec-001',
      title: 'PP v Bala s/o Suresh [2022] SGMC 14',
      court: 'Magistrate Court Singapore',
      summary: 'Accused ran red light at junction; CCTV evidence deemed conclusive. Fine of $800 and 8 demerit points imposed. Defence claim of amber light rejected without corroboration.',
      score: 0.94,
      url: 'https://www.elitigation.sg/gd/case/MC-2022-000014',
      distinguishing_factors: 'Present case involves a collision; Bala involved near-miss only.',
    },
    {
      id: 'prec-002',
      title: 'PP v Tan Swee Kiat [2021] SGMC 7',
      court: 'Magistrate Court Singapore',
      summary: 'Mechanical defect defence raised for brake failure. Court held accused responsible for vehicle maintenance under s65 — brakes defence not accepted.',
      score: 0.81,
      url: 'https://www.elitigation.sg/gd/case/MC-2021-000007',
      distinguishing_factors: null,
    },
  ],
};

// Arguments (US-013, US-014) — raw shape for normalizeArgumentsResource
// Each argument has suggested_questions with question_type tags
export const mockArguments = [
  {
    id: 'arg-001',
    side: 'claimant',
    legal_basis: 'The CCTV footage and LTA traffic light logs conclusively establish that the accused vehicle entered the junction 1.8 seconds after the signal turned red, satisfying all elements of s65(1) RTA.',
    weaknesses: 'CCTV angle does not show the interior of the vehicle; cannot directly disprove brake malfunction claim.',
    supporting_evidence: { strength_percent: 88 },
    suggested_questions: [
      { question: 'Can you confirm the accuracy of the timestamp on the CCTV footage?', question_type: 'factual_clarification', rationale: 'Establish evidentiary chain of custody', targets_weakness: null },
      { question: 'Was the traffic light system independently audited around 15 March 2026?', question_type: 'evidence_gap', rationale: 'Close the gap on system reliability', targets_weakness: 'CCTV timestamp sync' },
      { question: 'Has the accused any prior traffic offences?', question_type: 'credibility_probe', rationale: 'Establish pattern', targets_weakness: null },
    ],
  },
  {
    id: 'arg-002',
    side: 'respondent',
    legal_basis: 'The accused had reasonable grounds to believe the signal was still amber at the time of entry. The brakes failure, if proven, would negate mens rea for the wilful act required under s65(1) RTA.',
    weaknesses: 'No mechanical inspection report supports brake malfunction claim. Accused is an interested party with motive to fabricate.',
    supporting_evidence: { strength_percent: 24 },
    suggested_questions: [
      { question: 'When was the vehicle last serviced?', question_type: 'factual_clarification', rationale: 'Establish maintenance history', targets_weakness: null },
      { question: 'Is any vehicle inspection report available from the accident investigation?', question_type: 'evidence_gap', rationale: 'Critical gap — no mechanical evidence filed', targets_weakness: 'Brake malfunction unsubstantiated' },
      { question: 'Was the accused aware of any brake issues prior to the incident?', question_type: 'legal_interpretation', rationale: 'Subjective knowledge for mens rea', targets_weakness: null },
    ],
  },
];

// Hearing analysis (US-009, US-010, US-019, US-024) — normalizeHearingAnalysis reads
// asArray(getRoot(payload)) then takes items[last] or getRoot(payload) directly
export const mockHearingAnalysis = {
  id: 'deliberation-001',
  preliminary_conclusion: 'On the balance of evidence, the accused is guilty of failing to conform to a traffic signal under s65(1) RTA. CCTV footage and witness testimony are consistent and corroborate each other. The brake malfunction defence is unsubstantiated.',
  reasoning_chain: [
    { step_no: 1, description: 'CCTV footage reviewed — vehicle crossed stop line 1.8 seconds after red signal. Timestamp verified against LTA traffic system log.', supports: ['CCTV Camera 4', 'LTA Traffic System Log'] },
    { step_no: 2, description: 'Bus driver Chan Kah Wai provides consistent independent testimony confirming the red light infringement.', supports: ['Witness Statement — Chan Kah Wai'] },
    { step_no: 3, description: 'Accused\'s brake malfunction claim: no mechanical report filed, vehicle serviced 3 months prior without issues. Defence unsupported.', supports: ['Workshop Service Record (inferred absence)'] },
    { step_no: 4, description: 'All elements of s65(1) RTA established. Fine and demerit points within standard sentencing range for first-time offence.', supports: ['PP v Bala s/o Suresh [2022] SGMC 14'] },
  ],
  uncertainty_flags: [
    { topic: 'Potential bias — single CCTV angle', rationale: 'Footage from a single camera; no perpendicular view to confirm signal state from accused\'s vantage point.', severity: 'medium' },
    { topic: 'Brake malfunction not independently verified', rationale: 'No Traffic Police vehicle inspection in evidence. Courts have previously accepted brake failure as partial mitigation.', severity: 'low' },
  ],
  confidence_score: 0.87,
};

// Fairness audit (US-015) — extractFairnessChecks reads payload.checks
export const mockFairnessAudit = {
  checks: [
    { label: 'No protected-class attribute in adverse finding', passed: true, severity: null },
    { label: 'Both parties given equal narrative weight in reconstruction', passed: true, severity: null },
    { label: 'Recommendation aligns with sentencing range for comparable precedents', passed: true, severity: null },
    { label: 'Unverified brake malfunction defence may disproportionately disadvantage unrepresented accused', passed: false, severity: 'MINOR' },
  ],
  fairness_check: {
    audit_passed: true,
    critical_issues_found: false,
    recommendations: ['Prompt accused to engage duty solicitor before sentencing'],
  },
  verdict_fairness_report: {
    score: 92,
    summary: 'Audit passed. One minor fairness flag raised regarding the unrepresented accused. Judge should consider a brief adjournment to allow duty solicitor access before pronouncing sentence.',
    flagged_issues: 1,
  },
};

// Knowledge base (US-018) — normalizeKnowledgeBaseStatus reads payload.vector_store, pair_api, etc.
export const mockKnowledgeBaseStatus = {
  initialized: true,
  vector_store: { status: 'healthy', store_id: 'vs-traffic-sg-001' },
  pair_api: { status: 'available', endpoint: 'https://pair.judiciary.sg/api' },
  documents_count: 1842,
  chunks_count: 28460,
  last_updated_at: '2026-05-04T22:00:00Z',
  domain_has_vector_store: true,
};

// Dashboard stats (US-017)
export const mockDashboardStats = {
  total_cases: 127,
  by_domain: { small_claims: 48, traffic_violation: 79 },
  escalation_rate_percent: 3.1,
  average_verdict_confidence: 0.84,
  pair_api_status: { state: 'closed' },
  average_processing_time_seconds: 187,
  recent_cases: mockCaseList.items.slice(0, 3),
};

// Hearing pack (US-007, US-011)
export const mockHearingPackMarkdown = `# Hearing Pack — MC-2026-001

**Case:** PP v Lim Ah Kow
**Domain:** Traffic Violation
**Date prepared:** ${new Date().toLocaleDateString('en-SG')}

## Charge
Section 65(1) of the Road Traffic Act, Cap 276 — Failure to conform to traffic signal.

## Preliminary Conclusion
The AI analysis recommends a finding of guilt based on CCTV evidence and independent witness testimony.

## Key Evidence
1. CCTV footage — 1.8 second incursion after red signal
2. Bus driver Chan Kah Wai — independent eyewitness
3. LTA traffic light log — timestamps confirmed

## Uncertainty Flags
- Brake malfunction claim unverified
- Single CCTV angle (minor limitation)

## Sentencing Range
Fine: $200–$1,000 | Demerit points: 8 | Disqualification: discretionary
`;

export const mockHearingNotes = {
  items: [
    {
      id: 'note-001',
      content: 'Request accused to bring mechanic workshop records to next hearing. Brake malfunction defence requires documentary support.',
      created_at: '2026-05-04T10:15:00Z',
      is_locked: false,
    },
    {
      id: 'note-002',
      content: 'Consider advising accused to engage duty solicitor given severity of demerit consequence.',
      created_at: '2026-05-04T10:20:00Z',
      is_locked: false,
    },
  ],
};

// Reopen requests (US-025) — initially empty
export const mockReopenRequests = { items: [] };

// Document excerpt (US-008 — SourceExcerptModal)
export const mockDocumentExcerpt = {
  document_id: DOC_ID,
  page: 2,
  excerpt: 'At approximately 14:31:55 on 15 March 2026, the vehicle bearing registration number SGA1234Z was observed stationary at the junction of Orchard Road and Scotts Road, in the left-most lane facing north. The signal was at red phase. The vehicle then proceeded into the intersection at 14:32:02, approximately 1.8 seconds after the commencement of the red phase. This was captured on Traffic Camera 4 (LTA Camera ID: ORD-SCO-CAM4).',
  filename: 'traffic-citation-MC-2026-001.pdf',
};

// Precedent search results (US-016)
export const mockPrecedentSearch = {
  searched_at: new Date().toISOString(),
  results: [
    {
      id: 'live-prec-001',
      title: 'PP v Mohamad Farizal bin Ahmad [2023] SGMC 31',
      court: 'Magistrate Court Singapore',
      summary: 'Red-light infringement with bus collision. Accused ran red by 2.1 seconds. Fine $1,000, 8 demerit points, 3-month disqualification. CCTV plus independent witness testimony held conclusive.',
      score: 0.97,
      url: 'https://www.elitigation.sg/gd/case/MC-2023-000031',
    },
  ],
  source: 'live',
};

// Domains (US-001 — case intake)
export const mockDomains = [
  { code: 'traffic_violation', name: 'Traffic Violation', description: 'Road Traffic Act offences' },
  { code: 'small_claims',     name: 'Small Claims',      description: 'Claims not exceeding $20,000' },
];

// Gate state for GateReviewPanel (US-022, US-023) — the interrupt event
export const mockGateInterrupt = {
  kind: 'interrupt',
  gate: 'gate1',
  case_id: CASE_ID,
  actions: ['advance', 'rerun', 'send_back'],
  audit_summary: null,
  phase_output: {
    domain: 'traffic_violation',
    complexity: 'medium',
    jurisdiction: { status: 'pass' },
  },
  agent: null,
  question: null,
};
