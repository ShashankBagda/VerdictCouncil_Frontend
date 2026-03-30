export const INTAKE_SECTIONS = [
  {
    id: 'applicant_submission',
    code: 'APL',
    title: 'Applicant Submission',
    description: 'Applicant statement, requested remedy, and core filing documents.',
    required: true,
  },
  {
    id: 'respondent_submission',
    code: 'RSP',
    title: 'Respondent Submission',
    description: 'Opposition materials, reply bundle, and rebuttal documents.',
    required: true,
  },
  {
    id: 'applicant_counsel',
    code: 'ACL',
    title: 'Applicant Counsel',
    description: 'Lawyer submissions, legal opinions, and representation notes.',
    required: false,
  },
  {
    id: 'respondent_counsel',
    code: 'RCL',
    title: 'Respondent Counsel',
    description: 'Defense counsel materials and legal submissions.',
    required: false,
  },
  {
    id: 'witness_materials',
    code: 'WIT',
    title: 'Witness Materials',
    description: 'Witness statements, transcripts, and supporting recollections.',
    required: false,
  },
  {
    id: 'proof_bundle',
    code: 'PRF',
    title: 'Proof Bundle',
    description: 'Invoices, photographs, media, receipts, and other proofs.',
    required: true,
  },
  {
    id: 'other_participants',
    code: 'OTH',
    title: 'Other Participants',
    description: 'Any other involved party, expert, or project stakeholder record.',
    required: false,
  },
]

export const intakeSectionLookup = Object.fromEntries(
  INTAKE_SECTIONS.map((section) => [section.id, section]),
)
