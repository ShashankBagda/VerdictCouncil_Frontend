const getRoot = (payload) => payload?.data || payload || {};

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.results)) return value.results;
  return [];
};

const toPercent = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  return null;
};

const coalesce = (...values) => values.find((value) => value !== undefined && value !== null);

const formatReasonMap = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.filter(Boolean).join(' • ');
  if (typeof value === 'object') {
    return Object.entries(value)
      .filter(([, entry]) => entry)
      .map(([key, entry]) => `${key}: ${entry}`)
      .join(' • ');
  }
  return null;
};

export function normalizeCaseSummary(payload) {
  const root = getRoot(payload);
  const parties = asArray(root.parties);
  const pipelineProgress = getRoot(root.pipeline_progress);
  const currentAgent = pipelineProgress.current_agent || root.current_agent || null;
  const percent =
    pipelineProgress.pipeline_progress_percent ??
    root.pipeline_progress_percent ??
    root.pipeline_progress ??
    0;

  return {
    ...root,
    id: root.id || root.case_id || null,
    case_id: root.case_id || root.id || null,
    title: root.title || `Case ${root.case_id || root.id || ''}`.trim(),
    case_description: root.description || root.summary_snippet || '',
    description: root.description || root.summary_snippet || '',
    status: root.status_group || root.status || 'processing',
    raw_status: root.status || null,
    domain: root.domain || '',
    filed_date: root.filed_date || null,
    created_at: root.created_at || null,
    updated_at: root.updated_at || null,
    party_1:
      root.claimant_name || root.prosecution_name || parties[0]?.name || '',
    party_2:
      root.respondent_name || root.accused_name || parties[1]?.name || '',
    parties,
    party_names: root.party_names || parties.map((party) => party.name).filter(Boolean),
    pipeline_progress: toPercent(percent) ?? 0,
    current_agent: currentAgent,
    escalation_reason: root.escalation_reason || null,
    outcome_summary: root.outcome_summary || null,
    reopen_state: root.reopen_state || null,
    jurisdiction: root.jurisdiction || null,
    claim_amount: root.claim_amount ?? null,
    consent_to_higher_claim_limit: Boolean(root.consent_to_higher_claim_limit),
    offence_code: root.offence_code || null,
  };
}

export function normalizeCaseDetail(payload, caseId) {
  const root = getRoot(payload);
  const summary = normalizeCaseSummary({ ...root, case_id: root.case_id || root.id || caseId });
  const documents = asArray(root.documents);

  return {
    ...summary,
    documents: documents.map((document, index) => ({
      id: document.id || document.document_id || `doc-${index}`,
      filename: document.filename || document.name || `Document ${index + 1}`,
      uploaded_at: document.uploaded_at || document.created_at || null,
      version: document.version || index + 1,
      affected_stages: document.affected_stages || document.retriggered_agents || [],
      status: document.status || 'uploaded',
      openai_file_id: document.openai_file_id || null,
    })),
  };
}

export function normalizeUploadedDocument(payload, fallbackFileName, fallbackIndex = 0) {
  const root = getRoot(payload);

  return {
    id: root.id || root.document_id || `uploaded-${fallbackIndex}`,
    filename: root.filename || fallbackFileName,
    uploaded_at: root.uploaded_at || new Date().toISOString(),
    version: root.version || fallbackIndex + 1,
    affected_stages: root.affected_stages || [],
    status: root.status || 'uploaded',
    openai_file_id: root.openai_file_id || null,
  };
}

export function normalizeEvidenceResource(payload) {
  const items = asArray(getRoot(payload)).map((item, index) => ({
    id: item.id || `evidence-${index}`,
    title: item.title || item.evidence_type || `Evidence ${index + 1}`,
    description:
      item.description ||
      formatReasonMap(item.linked_claims) ||
      formatReasonMap(item.admissibility_flags) ||
      'No narrative supplied by the evidence-analysis stage.',
    content: item.description || formatReasonMap(item.linked_claims) || '',
    type: item.evidence_type || item.type || 'documentary',
    strength: item.strength || null,
    source: item.source || null,
    admissibility_flags: item.admissibility_flags || null,
    linked_claims: item.linked_claims || null,
  }));

  return { items };
}

export function normalizeTimelineResource(payload) {
  const items = asArray(getRoot(payload)).map((fact, index) => ({
    id: fact.id || `fact-${index}`,
    date: fact.event_date || null,
    time: fact.event_time || null,
    title: fact.description || `Fact ${index + 1}`,
    description: fact.description || '',
    participants: fact.corroboration?.participants || [],
    confidence: fact.confidence || null,
    status: fact.status || null,
    source_document_id: fact.source_document_id || null,
    source: fact.source_document_id || null,
    dispute_reason: fact.corroboration?.dispute_reason || null,
  }));

  return { events: items };
}

export function normalizeWitnessResource(payload) {
  const items = asArray(getRoot(payload)).map((witness, index) => ({
    id: witness.id || `witness-${index}`,
    name: witness.name || `Witness ${index + 1}`,
    role: witness.role || 'Role not specified',
    credibility: witness.credibility_score ?? witness.credibility ?? null,
    bias_indicators: witness.bias_indicators || null,
    statement: witness.simulated_testimony || null,
    simulated_testimony: witness.simulated_testimony || null,
    affiliation:
      witness.bias_indicators?.relationship ||
      witness.bias_indicators?.affiliation ||
      null,
  }));

  return { items };
}

export function normalizeStatutesResource(payload) {
  const items = asArray(getRoot(payload)).map((statute, index) => ({
    id: statute.id || `statute-${index}`,
    title: statute.statute_name || statute.title || `Statute ${index + 1}`,
    code: statute.section || statute.code || null,
    summary: statute.application || statute.verbatim_text || '',
    relevance:
      statute.relevance_score != null
        ? `${Math.round(Number(statute.relevance_score) * 100)}%`
        : null,
    verbatim_text: statute.verbatim_text || null,
    application: statute.application || null,
    precedents: [],
  }));

  return { items };
}

export function normalizeArgumentsResource(payload) {
  const items = asArray(getRoot(payload));
  const grouped = {
    claimant: { arguments: [], summary: null },
    respondent: { arguments: [], summary: null },
  };

  items.forEach((argument, index) => {
    const side = String(argument.side || '').toLowerCase();
    const bucket =
      side === 'claimant' || side === 'prosecution' ? grouped.claimant : grouped.respondent;
    bucket.arguments.push({
      id: argument.id || `argument-${index}`,
      title: `Issue ${bucket.arguments.length + 1}`,
      text: argument.legal_basis || '',
      strength: coalesce(argument.supporting_evidence?.strength_percent, null),
      weaknesses: argument.weaknesses || null,
      supporting_evidence: argument.supporting_evidence || null,
      suggested_questions: argument.suggested_questions || null,
    });
  });

  if (grouped.claimant.arguments.length === 0) grouped.claimant = null;
  if (grouped.respondent.arguments.length === 0) grouped.respondent = null;

  return grouped;
}

const stringListFromUnknown = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === 'string') return entry;
        if (typeof entry === 'object' && entry) {
          return entry.title || entry.description || entry.summary || JSON.stringify(entry);
        }
        return null;
      })
      .filter(Boolean);
  }
  if (typeof value === 'object') {
    return Object.entries(value).map(([key, entry]) =>
      typeof entry === 'string' ? `${key}: ${entry}` : `${key}: ${JSON.stringify(entry)}`,
    );
  }
  return [String(value)];
};

export function normalizeHearingAnalysis(payload) {
  const items = asArray(getRoot(payload));
  const deliberation = items[items.length - 1] || getRoot(payload);
  const reasoningChain = deliberation.reasoning_chain || {};

  return {
    id: deliberation.id || 'deliberation',
    reasoning:
      typeof reasoningChain === 'string'
        ? reasoningChain
        : JSON.stringify(reasoningChain, null, 2),
    key_points:
      stringListFromUnknown(reasoningChain.key_points || reasoningChain.steps).slice(0, 10),
    risks: stringListFromUnknown(deliberation.uncertainty_flags),
    confidence_score: deliberation.confidence_score ?? null,
    preliminary_conclusion: deliberation.preliminary_conclusion || null,
  };
}

export const extractItems = (payload, keys = []) => {
  const root = getRoot(payload);

  for (const key of keys) {
    if (Array.isArray(root?.[key])) {
      return root[key];
    }
  }

  return asArray(root);
};

export function normalizeKnowledgeBaseStatus(payload) {
  const root = getRoot(payload);
  const vectorStore = root.vector_store || {};
  const pairApi = root.pair_api || {};
  const initialized = Boolean(root.initialized);

  return {
    initialized,
    status: vectorStore.status || (initialized ? 'healthy' : 'not_initialized'),
    documents_count: root.documents_count ?? 0,
    chunks_count: root.chunks_count ?? null,
    last_updated: root.last_updated_at || null,
    vector_store: vectorStore,
    pair_api: pairApi,
    last_checked: root.last_checked || null,
  };
}
