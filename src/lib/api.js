/**
 * HTTP API client with cookie-based auth, normalized errors, and optional 401 redirect behavior.
 *
 * Endpoint status vs VerdictCouncil_Backend (v0.3.0 — LangGraph 4-gate HITL, 2026-04-24):
 *
 * ✅ Fully linked:
 *   POST /api/v1/auth/login          → auth.router
 *   POST /api/v1/auth/logout         → auth.router
 *   GET  /api/v1/auth/me             → auth.router
 *   POST /api/v1/auth/extend         → auth.router
 *   GET  /api/v1/auth/session        → auth.router
 *   POST /api/v1/auth/request-reset  → auth.router
 *   POST /api/v1/auth/verify-reset   → auth.router
 *   POST /api/v1/auth/register       → auth.router
 *   POST /api/v1/cases/              → cases.router (create case)
 *   POST /api/v1/cases/draft         → cases.router (draft intake)
 *   POST /api/v1/cases/{id}/confirm  → cases.router (confirm intake)
 *   POST /api/v1/cases/{id}/intake/extract → cases.router
 *   POST /api/v1/cases/{id}/intake/message → cases.router
 *   GET  /api/v1/cases/{id}/intake/stream  → cases.router (SSE ai-sdk format)
 *   GET  /api/v1/cases/              → cases.router (list cases)
 *   GET  /api/v1/cases/{id}          → cases.router (full case detail with nested entities)
 *   POST /api/v1/cases/{id}/process  → cases.router (start 9-agent LangGraph pipeline)
 *   POST /api/v1/cases/{id}/restart  → cases.router (restart failed pipeline)
 *   POST /api/v1/cases/{id}/gates/{gate}/advance → cases.router (4-gate HITL advance)
 *   POST /api/v1/cases/{id}/gates/{gate}/rerun   → cases.router (4-gate HITL rerun)
 *   POST /api/v1/cases/{id}/decision             → cases.router (record judicial decision)
 *   PATCH /api/v1/cases/{id}/suggested-questions → cases.router
 *   PATCH /api/v1/cases/{id}/facts/{fid}/dispute → judge.router
 *   GET  /api/v1/cases/{id}/evidence-gaps        → judge.router
 *   GET  /api/v1/cases/{id}/fairness-audit       → judge.router
 *   POST /api/v1/cases/{id}/what-if              → what_if.router
 *   GET  /api/v1/cases/{id}/what-if/{sid}        → what_if.router
 *   POST /api/v1/cases/{id}/stability            → what_if.router (async, returns stability_id)
 *   GET  /api/v1/cases/{id}/stability            → what_if.router (latest result)
 *   POST /api/v1/cases/{id}/reopen-request       → reopen_requests.router
 *   GET  /api/v1/cases/{id}/reopen-requests      → reopen_requests.router
 *   PATCH /api/v1/cases/{id}/reopen-requests/{rid}/review → reopen_requests.router
 *   POST /api/v1/cases/{id}/hearing-pack         → hearing_pack.router
 *   GET  /api/v1/cases/{id}/hearing-pack         → cases.router (zip download)
 *   POST /api/v1/cases/{id}/hearing-notes        → hearing_notes.router
 *   GET  /api/v1/cases/{id}/hearing-notes        → hearing_notes.router
 *   PATCH /api/v1/cases/{id}/hearing-notes/{nid} → hearing_notes.router
 *   POST /api/v1/cases/{id}/hearing-notes/{nid}/lock → hearing_notes.router
 *   DELETE /api/v1/cases/{id}/hearing-notes/{nid}    → hearing_notes.router
 *   GET  /api/v1/health/pair                     → health.router
 *   POST /api/v1/health/pair/probe               → health.router
 *   POST /api/v1/cases/{id}/documents            → case_data.router (file upload)
 *   GET  /api/v1/cases/{id}/status               → case_data.router (pipeline status poll)
 *   GET  /api/v1/cases/{id}/status/stream        → case_data.router (SSE PipelineProgressEvent)
 *   GET  /api/v1/cases/{id}/evidence             → case_data.router
 *   GET  /api/v1/cases/{id}/timeline             → case_data.router (facts ordered by event_date)
 *   GET  /api/v1/cases/{id}/witnesses            → case_data.router
 *   GET  /api/v1/cases/{id}/statutes             → case_data.router (legal-rules)
 *   GET  /api/v1/cases/{id}/precedents           → case_data.router
 *   GET  /api/v1/cases/{id}/arguments            → case_data.router
 *   GET  /api/v1/cases/{id}/hearing-analysis     → case_data.router (replaces /deliberation)
 *   GET  /api/v1/documents/{id}/excerpt          → documents.router
 *   POST /api/v1/precedents/search               → precedent_search.router
 *   GET  /api/v1/knowledge-base/status           → knowledge_base.router
 *   GET  /api/v1/dashboard/stats                 → dashboard.router
 *   GET  /api/v1/audit/{id}/audit                → audit.router
 *   POST /api/v1/admin/vector-stores/refresh     → admin.router (body: {store})
 *   POST /api/v1/admin/users/{id}/{action}       → admin.router (actions: set-role, revoke-sessions)
 *   POST /api/v1/admin/cost-config               → admin.router
 *   GET  /api/v1/domains/                        → domains.router
 *   GET  /api/v1/domains/capabilities            → domains.router
 *   GET  /api/v1/domains/admin                   → domains.router (admin only)
 *   POST /api/v1/domains/admin                   → domains.router
 *   PATCH /api/v1/domains/admin/{id}             → domains.router
 *   POST /api/v1/domains/admin/{id}/documents    → domains.router
 *   DELETE /api/v1/domains/admin/{id}/documents/{doc_id} → domains.router
 *
 * 🔄 LangGraph pipeline events (SSE format: PipelineProgressEvent):
 *   {case_id, agent, phase, step, total, ts, error, detail, trace_id}
 *   Agents: case-processing → complexity-routing → [evidence-analysis, fact-reconstruction,
 *           witness-analysis, legal-knowledge] → argument-construction → hearing-analysis
 *           → hearing-governance
 *   Phases: started | completed | failed | terminal | awaiting_review
 *   Terminal events: agent="pipeline" phase="terminal"|"awaiting_review"
 *                   OR agent="hearing-governance" phase="completed"|"failed"
 *
 * 📋 Senior-judge escalation (served via cases list with status=escalated):
 *   GET /api/v1/cases/?status=escalated — escalated cases visible to senior judges
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

const isTruthyEnv = (value) => {
  if (value === true) return true;
  if (!value) return false;
  const normalized = String(value).toLowerCase();
  return normalized === 'true' || normalized === '1';
};

const BYPASS_AUTH = import.meta.env.DEV && isTruthyEnv(import.meta.env.VITE_BYPASS_AUTH);

export class APIError extends Error {
  constructor(status, detail, fieldErrors = {}, code = null, data = null) {
    super(detail);
    this.name = 'APIError';
    this.status = status;
    this.detail = detail;
    this.fieldErrors = fieldErrors;
    this.code = code;
    this.data = data;
  }
}

export function getErrorMessage(error, fallback = 'Something went wrong') {
  if (error instanceof APIError) {
    return error.detail || fallback;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
}

const shouldParseJson = (response) => {
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('application/json');
};

async function parseResponseBody(response) {
  if (response.status === 204) {
    return null;
  }

  if (shouldParseJson(response)) {
    return response.json();
  }

  const text = await response.text();
  return text || null;
}

async function request(method, path, options = {}) {
  const {
    body = null,
    headers = {},
    credentials = 'include',
    suppress401Redirect = false,
  } = options;

  const url = `${API_BASE_URL}${path}`;
  const requestHeaders = new Headers(headers);
  const fetchOptions = {
    method,
    headers: requestHeaders,
    credentials,
  };

  if (body !== null && body !== undefined) {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    if (isFormData) {
      fetchOptions.body = body;
    } else {
      if (!requestHeaders.has('Content-Type')) {
        requestHeaders.set('Content-Type', 'application/json');
      }
      fetchOptions.body = JSON.stringify(body);
    }
  }

  let response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (error) {
    throw new APIError(0, `Network error: ${error.message}`);
  }

  const payload = await parseResponseBody(response);

  if (response.status === 401) {
    if (!suppress401Redirect && !BYPASS_AUTH) {
      window.location.assign('/login');
    }

    throw new APIError(
      401,
      payload?.detail || 'Session expired. Redirecting to login...',
      payload?.fieldErrors || {},
      payload?.code || 'unauthorized',
      payload,
    );
  }

  if (!response.ok) {
    const rawDetail = payload?.detail;
    const detail = Array.isArray(rawDetail)
      ? rawDetail.map((e) => e.msg || String(e)).join('; ')
      : rawDetail || (typeof payload === 'string' ? payload : `HTTP ${response.status}`);
    throw new APIError(
      response.status,
      detail,
      payload?.fieldErrors || {},
      payload?.code || null,
      payload,
    );
  }

  return payload;
}

function buildSessionState(payload) {
  const root = payload?.data || payload || {};
  const looksLikeUser =
    root &&
    typeof root === 'object' &&
    !Array.isArray(root) &&
    ('email' in root || 'role' in root || 'id' in root);
  const user = root.user || payload?.user || (looksLikeUser ? root : null);
  const session = root.session || payload?.session || null;
  const expiresAt = root.expires_at || session?.expires_at || user?.expires_at || null;

  return {
    user,
    session,
    expiresAt,
    raw: payload,
  };
}

async function uploadWithProgress(url, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (onProgress) {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      });
    }

    xhr.addEventListener('load', () => {
      let payload = null;
      try {
        payload = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        payload = xhr.responseText || null;
      }

      if (xhr.status === 401) {
        if (!BYPASS_AUTH) {
          window.location.assign('/login');
        }

        reject(
          new APIError(
            401,
            payload?.detail || 'Session expired. Redirecting to login...',
            payload?.fieldErrors || {},
            payload?.code || 'unauthorized',
            payload,
          ),
        );
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload);
        return;
      }

      reject(
        new APIError(
          xhr.status,
          payload?.detail || xhr.statusText || 'Request failed',
          payload?.fieldErrors || {},
          payload?.code || null,
          payload,
        ),
      );
    });

    xhr.addEventListener('error', () => {
      reject(new APIError(0, 'Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new APIError(0, 'Upload cancelled'));
    });

    xhr.withCredentials = true;
    xhr.open('POST', url);
    xhr.send(formData);
  });
}

export const api = {
  login: (email, password) =>
    request('POST', '/api/v1/auth/login', { body: { email, password } }),
  logout: () =>
    request('POST', '/api/v1/auth/logout', { suppress401Redirect: true }),
  extendSession: async () => {
    try {
      const payload = await request('POST', '/api/v1/auth/extend', {
        suppress401Redirect: true,
      });
      return buildSessionState(payload);
    } catch (error) {
      if (!(error instanceof APIError)) {
        throw error;
      }

      // Backward-compatible fallback for older backend deployments.
      if (error.status === 404) {
        return api.getSession();
      }

      throw error;
    }
  },
  getSession: async () => {
    const payload = await request('GET', '/api/v1/auth/session', {
      suppress401Redirect: true,
    });
    return buildSessionState(payload);
  },
  requestPasswordReset: (email) =>
    request('POST', '/api/v1/auth/request-reset', { body: { email } }),
  verifyPasswordReset: (token, newPassword) =>
    request('POST', '/api/v1/auth/verify-reset', {
      body: { token, new_password: newPassword },
    }),

  createCase: (caseData) =>
    request('POST', '/api/v1/cases/', { body: caseData }),
  listCases: (params = {}) => {
    const backendParams = {};
    if (params.status || params.status_filter) {
      backendParams.status = params.status || params.status_filter;
    }
    if (params.domain || params.domain_filter) {
      backendParams.domain = params.domain || params.domain_filter;
    }
    if (params.search) backendParams.search = params.search;
    if (params.complexity) backendParams.complexity = params.complexity;
    if (params.outcome) backendParams.outcome = params.outcome;
    if (params.filed_from) backendParams.filed_from = params.filed_from;
    if (params.filed_to) backendParams.filed_to = params.filed_to;
    if (params.sort_by) backendParams.sort_by = params.sort_by;
    if (params.sort_direction) backendParams.sort_direction = params.sort_direction;
    if (params.page) backendParams.page = params.page;
    if (params.per_page) backendParams.per_page = params.per_page;
    const query = new URLSearchParams(backendParams).toString();
    return request('GET', `/api/v1/cases/${query ? `?${query}` : ''}`);
  },
  getCaseDetail: (caseId) =>
    request('GET', `/api/v1/cases/${caseId}`),

  uploadDocuments: async (caseId, files, onProgress, kinds) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    if (Array.isArray(kinds) && kinds.length === files.length) {
      kinds.forEach((kind) => formData.append('kinds', kind));
    }
    return uploadWithProgress(
      `${API_BASE_URL}/api/v1/cases/${caseId}/documents`,
      formData,
      onProgress,
    );
  },

  // Chat-first intake — docs-as-source-of-truth flow.
  // Creates a draft in `draft` state; only domain is required upfront.
  createCaseDraft: (body) =>
    request('POST', '/api/v1/cases/draft', { body }),
  // Transition draft/awaiting_intake_confirmation → pending with the
  // judge's confirmed fields.
  confirmCaseIntake: (caseId, body) =>
    request('POST', `/api/v1/cases/${caseId}/confirm`, { body }),
  // (Re-)enqueue intake extraction; idempotent.
  triggerIntakeExtraction: (caseId) =>
    request('POST', `/api/v1/cases/${caseId}/intake/extract`),
  // Judge's plain-text correction on the intake chat. Server re-runs
  // extraction with the correction treated as authoritative-over-docs.
  sendIntakeMessage: (caseId, content) =>
    request('POST', `/api/v1/cases/${caseId}/intake/message`, {
      body: { content },
    }),
  // SSE stream of intake events (status / done / user_message /
  // error / confirmed). Close on terminal event types.
  streamIntakeEvents: (caseId) =>
    new EventSource(`${API_BASE_URL}/api/v1/cases/${caseId}/intake/stream`, {
      withCredentials: true,
    }),

  runCase: (caseId) =>
    request('POST', `/api/v1/cases/${caseId}/process`),
  restartPipeline: (caseId) =>
    request('POST', `/api/v1/cases/${caseId}/restart`),
  getPipelineStatus: (caseId) =>
    request('GET', `/api/v1/cases/${caseId}/status`),
  streamPipelineStatus: (caseId) =>
    new EventSource(`${API_BASE_URL}/api/v1/cases/${caseId}/status/stream`, {
      withCredentials: true,
    }),

  getEvidence: (caseId) =>
    request('GET', `/api/v1/cases/${caseId}/evidence`),
  getTimeline: (caseId) =>
    request('GET', `/api/v1/cases/${caseId}/timeline`),
  getWitnesses: (caseId) =>
    request('GET', `/api/v1/cases/${caseId}/witnesses`),
  getStatutes: (caseId) =>
    request('GET', `/api/v1/cases/${caseId}/statutes`),
  getPrecedents: (caseId) =>
    request('GET', `/api/v1/cases/${caseId}/precedents`),
  getArguments: (caseId) =>
    request('GET', `/api/v1/cases/${caseId}/arguments`),
  getHearingAnalysis: (caseId) =>
    request('GET', `/api/v1/cases/${caseId}/hearing-analysis`),
  getEvidenceGaps: (caseId) =>
    request('GET', `/api/v1/cases/${caseId}/evidence-gaps`),
  getFairnessAudit: (caseId) =>
    request('GET', `/api/v1/cases/${caseId}/fairness-audit`),

  createWhatIfScenario: (caseId, scenario) =>
    request('POST', `/api/v1/cases/${caseId}/what-if`, { body: scenario }),
  getWhatIfScenario: (caseId, scenarioId) =>
    request('GET', `/api/v1/cases/${caseId}/what-if/${scenarioId}`),
  computeStability: (caseId, perturbationCount = 5) =>
    request('POST', `/api/v1/cases/${caseId}/stability`, {
      body: { perturbation_count: perturbationCount },
    }),
  getStability: (caseId) =>
    request('GET', `/api/v1/cases/${caseId}/stability`),

  disputeFact: (caseId, factId, body = {}) =>
    request('PATCH', `/api/v1/cases/${caseId}/facts/${factId}/dispute`, { body }),

  searchPrecedents: (query, jurisdiction = 'small_claims', maxResults = 10) =>
    request('POST', '/api/v1/precedents/search', {
      body: { query, jurisdiction, max_results: maxResults },
    }),

  getKnowledgeBaseStatus: () =>
    request('GET', '/api/v1/knowledge-base/status'),

  initializeKnowledgeBase: () =>
    request('POST', '/api/v1/knowledge-base/initialize'),

  uploadKnowledgeBaseDocument: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return uploadWithProgress(`${API_BASE_URL}/api/v1/knowledge-base/documents`, formData, null);
  },

  listKnowledgeBaseDocuments: () =>
    request('GET', '/api/v1/knowledge-base/documents'),

  deleteKnowledgeBaseDocument: (fileId) =>
    request('DELETE', `/api/v1/knowledge-base/documents/${fileId}`),

  getDashboardStats: (timeWindow = '30d') =>
    request('GET', `/api/v1/dashboard/stats?window=${timeWindow}`),

  getAuditTrail: (caseId, filters = {}) => {
    const query = new URLSearchParams(filters).toString();
    return request('GET', `/api/v1/audit/${caseId}/audit${query ? `?${query}` : ''}`);
  },

  generateHearingPack: (caseId) =>
    request('POST', `/api/v1/cases/${caseId}/hearing-pack`),
  createHearingNote: (caseId, body) =>
    request('POST', `/api/v1/cases/${caseId}/hearing-notes`, { body }),
  listHearingNotes: (caseId) =>
    request('GET', `/api/v1/cases/${caseId}/hearing-notes`),
  updateHearingNote: (caseId, noteId, body) =>
    request('PATCH', `/api/v1/cases/${caseId}/hearing-notes/${noteId}`, { body }),
  lockHearingNote: (caseId, noteId) =>
    request('POST', `/api/v1/cases/${caseId}/hearing-notes/${noteId}/lock`),
  deleteHearingNote: (caseId, noteId) =>
    request('DELETE', `/api/v1/cases/${caseId}/hearing-notes/${noteId}`),
  requestCaseReopen: (caseId, body) =>
    request('POST', `/api/v1/cases/${caseId}/reopen-request`, { body }),
  listReopenRequests: (caseId) =>
    request('GET', `/api/v1/cases/${caseId}/reopen-requests`),
  reviewReopenRequest: (caseId, requestId, body) =>
    request('PATCH', `/api/v1/cases/${caseId}/reopen-requests/${requestId}/review`, { body }),

  getAdminHealth: () =>
    request('GET', '/api/v1/health/pair'),
  refreshVectorStore: (store = 'primary') =>
    request('POST', '/api/v1/admin/vector-stores/refresh', { body: { store } }),
  manageUser: (userId, action, body = {}) =>
    request('POST', `/api/v1/admin/users/${userId}/${action}`, { body }),
  setConfig: (body) =>
    request('POST', '/api/v1/admin/cost-config', { body }),

  // Domain management
  listDomains: () =>
    request('GET', '/api/v1/domains/'),
  listDomainsAdmin: () =>
    request('GET', '/api/v1/domains/admin'),
  createDomain: (data) =>
    request('POST', '/api/v1/domains/admin', { body: data }),
  getDomainAdmin: (domainId) =>
    request('GET', `/api/v1/domains/admin/${domainId}`),
  updateDomain: (domainId, data) =>
    request('PATCH', `/api/v1/domains/admin/${domainId}`, { body: data }),
  retireDomain: (domainId, hard = false) =>
    request('DELETE', `/api/v1/domains/admin/${domainId}?hard=${hard}`),
  getDomainCapabilities: () =>
    request('GET', '/api/v1/domains/capabilities'),
  uploadDomainDocument: (domainId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return request('POST', `/api/v1/domains/admin/${domainId}/documents`, { body: formData });
  },
  listDomainDocuments: (domainId) =>
    request('GET', `/api/v1/domains/admin/${domainId}/documents`),
  deleteDomainDocument: (domainId, docId) =>
    request('DELETE', `/api/v1/domains/admin/${domainId}/documents/${docId}`),

  advanceGate: (caseId, gateName) =>
    request('POST', `/api/v1/cases/${caseId}/gates/${gateName}/advance`, { body: {} }),
  rerunGate: (caseId, gateName, { agentName, instructions } = {}) =>
    request('POST', `/api/v1/cases/${caseId}/gates/${gateName}/rerun`, {
      body: { agent_name: agentName, instructions },
    }),
  recordDecision: (caseId, body) =>
    request('POST', `/api/v1/cases/${caseId}/decision`, { body }),
  getDocumentExcerpt: (documentId, page) =>
    request('GET', `/api/v1/documents/${documentId}/excerpt?page=${page}`),
  updateSuggestedQuestions: (caseId, body) =>
    request('PATCH', `/api/v1/cases/${caseId}/suggested-questions`, { body }),

  // Senior judge — escalated case list (served by the standard cases endpoint
  // with status=escalated; no dedicated escalation router exists yet).
  listEscalatedCases: (params = {}) => {
    const q = new URLSearchParams({ ...params, status: 'escalated' }).toString();
    return request('GET', `/api/v1/cases/?${q}`);
  },

  // Authenticated user profile (short-circuit of GET /auth/session).
  getMe: () =>
    request('GET', '/api/v1/auth/me', { suppress401Redirect: true }),

  // PAIR API active health probe.
  probePairApi: () =>
    request('POST', '/api/v1/health/pair/probe'),
};

export default api;
