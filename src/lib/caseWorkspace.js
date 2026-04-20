export function normalizeCaseDetail(payload, caseId) {
  const root = payload?.data || payload || {};
  const documents = root.documents || root.document_history || root.files || [];

  return {
    ...root,
    case_id: root.case_id || root.id || caseId,
    status: root.status || 'processing',
    case_description: root.case_description || root.description || '',
    documents: documents.map((document, index) => ({
      id: document.id || document.document_id || `doc-${index}`,
      filename: document.filename || document.name || `Document ${index + 1}`,
      uploaded_at: document.uploaded_at || document.created_at || null,
      version: document.version || index + 1,
      affected_stages: document.affected_stages || document.retriggered_agents || [],
      status: document.status || 'uploaded',
    })),
  };
}

export function normalizeUploadedDocument(payload, fallbackFileName, fallbackIndex = 0) {
  const root = payload?.data || payload || {};

  return {
    id: root.id || root.document_id || `uploaded-${fallbackIndex}`,
    filename: root.filename || fallbackFileName,
    uploaded_at: root.uploaded_at || new Date().toISOString(),
    version: root.version || fallbackIndex + 1,
    affected_stages: root.affected_stages || [],
    status: root.status || 'uploaded',
  };
}

export function normalizeVerdict(payload) {
  const root = payload?.data || payload || {};

  return {
    ...root,
    recommendation: root.recommendation || root.decision || null,
    confidence: root.confidence ?? null,
    remedy: root.remedy || root.outcome || null,
  };
}

export const extractItems = (payload, keys = []) => {
  if (!payload) return [];
  const root = payload?.data || payload;
  if (!root) return [];

  for (const key of keys) {
    if (Array.isArray(root?.[key])) {
      return root[key];
    }
  }

  if (Array.isArray(root?.items)) return root.items;
  if (Array.isArray(root?.results)) return root.results;
  if (Array.isArray(root)) return root;
  return [];
};

export function normalizeKnowledgeBaseStatus(payload) {
  const root = payload?.data || payload || {};
  const initialized = Boolean(root.initialized ?? root.ready ?? root.available);
  return {
    initialized,
    status: root.status || (initialized ? 'ready' : 'not_initialized'),
    documents_count: root.documents_count ?? root.document_count ?? root.documents ?? 0,
    chunks_count: root.chunks_count ?? root.chunk_count ?? null,
    last_updated: root.updated_at || root.last_updated_at || root.last_indexed_at || null,
  };
}

