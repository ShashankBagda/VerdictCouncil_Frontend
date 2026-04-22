/**
 * HTTP API client with cookie-based auth, normalized errors, and optional 401 redirect behavior.
 *
 * Endpoint status vs VerdictCouncil_Backend (as of 2026-04-19):
 *
 * ✅ Fully linked:
 *   POST /api/v1/auth/login          → auth.router
 *   POST /api/v1/auth/logout         → auth.router
 *   GET  /api/v1/auth/me             → auth.router
 *   POST /api/v1/auth/extend         → auth.router
 *   GET  /api/v1/auth/session        → auth.router
 *   POST /api/v1/auth/request-reset  → auth.router
 *   POST /api/v1/auth/verify-reset   → auth.router
 *   POST /api/v1/cases/              → cases.router (create case)
 *   GET  /api/v1/cases/              → cases.router (list cases)
 *   GET  /api/v1/cases/{id}          → cases.router (full case detail with nested entities)
 *   PATCH /api/v1/cases/{id}/facts/{fid}/dispute → judge.router
 *   GET  /api/v1/cases/{id}/evidence-gaps       → judge.router
 *   GET  /api/v1/cases/{id}/fairness-audit      → judge.router
 *   POST /api/v1/cases/{id}/what-if             → what_if.router
 *   GET  /api/v1/cases/{id}/what-if/{sid}       → what_if.router
 *   POST /api/v1/cases/{id}/stability           → what_if.router
 *   GET  /api/v1/cases/{id}/stability           → what_if.router
 *   POST /api/v1/precedents/search              → precedent_search.router
 *   GET  /api/v1/knowledge-base/status          → knowledge_base.router
 *   GET  /api/v1/dashboard/stats                → dashboard.router
 *   GET  /api/v1/audit/{id}/audit               → audit.router
 *   GET  /api/v1/escalated-cases                → escalation.router
 *   POST /api/v1/escalated-cases/{id}/action    → escalation.router
 *   GET  /api/v1/senior-inbox                   → senior_inbox.router
 *   POST /api/v1/cases/{id}/hearing-pack        → hearing_pack.router
 *   POST /api/v1/cases/{id}/hearing-notes       → hearing_notes.router
 *   GET  /api/v1/cases/{id}/hearing-notes       → hearing_notes.router
 *   PATCH /api/v1/cases/{id}/hearing-notes/{nid} → hearing_notes.router
 *   POST /api/v1/cases/{id}/hearing-notes/{nid}/lock → hearing_notes.router
 *   DELETE /api/v1/cases/{id}/hearing-notes/{nid} → hearing_notes.router
 *   POST /api/v1/cases/{id}/reopen-request      → reopen_requests.router
 *   GET  /api/v1/cases/{id}/reopen-requests     → reopen_requests.router
 *   PATCH /api/v1/cases/{id}/reopen-requests/{rid}/review → reopen_requests.router
 *   GET  /api/v1/health/pair                    → health.router
 *   POST /api/v1/cases/{id}/documents           → case_data.router (file upload)
 *   GET  /api/v1/cases/{id}/status              → case_data.router (pipeline status)
 *   GET  /api/v1/cases/{id}/status/stream       → case_data.router (SSE stream)
 *   GET  /api/v1/cases/{id}/evidence            → case_data.router
 *   GET  /api/v1/cases/{id}/timeline            → case_data.router
 *   GET  /api/v1/cases/{id}/witnesses           → case_data.router
 *   GET  /api/v1/cases/{id}/statutes            → case_data.router
 *   GET  /api/v1/cases/{id}/precedents          → case_data.router
 *   GET  /api/v1/cases/{id}/arguments           → case_data.router
 *   GET  /api/v1/cases/{id}/deliberation        → case_data.router
 *   POST /api/v1/cases/{id}/process             → cases.router (pipeline trigger)
 *   POST /api/v1/admin/vector-stores/refresh → admin.router
 *   POST /api/v1/admin/users/{id}/{action}   → admin.router
 *   POST /api/v1/admin/cost-config           → admin.router
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
    throw new APIError(
      response.status,
      payload?.detail || (typeof payload === 'string' ? payload : `HTTP ${response.status}`),
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
    const domainMap = {
      SCT: 'small_claims',
      Traffic: 'traffic_violation',
    };
    const backendParams = {};
    if (params.status || params.status_filter) {
      backendParams.status = params.status || params.status_filter;
    }
    if (params.domain || params.domain_filter) {
      const domainValue = params.domain || params.domain_filter;
      backendParams.domain = domainMap[domainValue] || domainValue;
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

  uploadDocuments: async (caseId, files, onProgress) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    return uploadWithProgress(
      `${API_BASE_URL}/api/v1/cases/${caseId}/documents`,
      formData,
      onProgress,
    );
  },

  runCase: (caseId) =>
    request('POST', `/api/v1/cases/${caseId}/process`),
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
  getDeliberation: (caseId) =>
    request('GET', `/api/v1/cases/${caseId}/deliberation`),
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

  refreshVectorStore: (store) =>
    request('POST', '/api/v1/admin/vector-stores/refresh', { body: { store } }),
  getAdminHealth: () =>
    request('GET', '/api/v1/health/pair'),
  manageUser: (userId, action, data) =>
    request('POST', `/api/v1/admin/users/${userId}/${action}`, { body: data }),
  setConfig: (config) =>
    request('POST', '/api/v1/admin/cost-config', { body: config }),

  getEscalatedCases: (page = 1, perPage = 20) =>
    request('GET', `/api/v1/escalated-cases/?page=${page}&per_page=${perPage}`),
  actionOnEscalatedCase: (itemId, body) =>
    request('POST', `/api/v1/escalated-cases/${itemId}/action`, { body }),
  getSeniorInbox: (page = 1, perPage = 20) =>
    request('GET', `/api/v1/senior-inbox/?page=${page}&per_page=${perPage}`),
};

export default api;
