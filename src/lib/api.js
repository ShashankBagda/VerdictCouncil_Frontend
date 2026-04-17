/**
 * HTTP API client with cookie-based auth, normalized errors, and optional 401 redirect behavior.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
  const user = root.user || payload?.user || null;
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
  extendSession: () =>
    request('POST', '/api/v1/auth/extend'),
  getSession: async () => {
    try {
      const payload = await request('GET', '/api/v1/auth/session', {
        suppress401Redirect: true,
      });
      return buildSessionState(payload);
    } catch (error) {
      if (!(error instanceof APIError)) {
        throw error;
      }

      if (error.status === 404) {
        const payload = await request('GET', '/api/v1/auth/me', {
          suppress401Redirect: true,
        });
        return buildSessionState(payload);
      }

      throw error;
    }
  },

  createCase: (caseData) =>
    request('POST', '/api/v1/cases/', { body: caseData }),
  listCases: (params = {}) => {
    const query = new URLSearchParams(params).toString();
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
  getVerdict: (caseId) =>
    request('GET', `/api/v1/cases/${caseId}/verdict`),
  getEvidenceGaps: (caseId) =>
    request('GET', `/api/v1/cases/${caseId}/evidence-gaps`),
  getFairnessAudit: (caseId) =>
    request('GET', `/api/v1/cases/${caseId}/fairness-audit`),

  recordDecision: (caseId, decision) =>
    request('POST', `/api/v1/cases/${caseId}/decision`, { body: decision }),

  createWhatIfScenario: (caseId, scenario) =>
    request('POST', '/api/v1/what-if/scenarios', { body: { caseId, ...scenario } }),
  getWhatIfScenario: (scenarioId) =>
    request('GET', `/api/v1/what-if/scenarios/${scenarioId}`),
  computeStability: (caseId) =>
    request('POST', '/api/v1/what-if/stability', { body: { caseId } }),
  getStability: (caseId) =>
    request('GET', `/api/v1/what-if/stability/${caseId}`),

  disputeFact: (caseId, factId, body = {}) =>
    request('PATCH', `/api/v1/cases/${caseId}/facts/${factId}/dispute`, { body }),

  searchPrecedents: (query, domain) =>
    request('POST', '/api/v1/precedents/search', { body: { query, domain } }),

  getKnowledgeBaseStatus: () =>
    request('GET', '/api/v1/knowledge-base/status'),
  initializeKB: () =>
    request('POST', '/api/v1/knowledge-base/initialize'),
  uploadToKB: async (file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    return uploadWithProgress(
      `${API_BASE_URL}/api/v1/knowledge-base/documents`,
      formData,
      onProgress,
    );
  },
  listKBDocuments: () =>
    request('GET', '/api/v1/knowledge-base/documents'),
  deleteKBDocument: (fileId) =>
    request('DELETE', `/api/v1/knowledge-base/documents/${fileId}`),
  searchKB: (query) =>
    request('POST', '/api/v1/knowledge-base/search', { body: { query } }),

  getDashboardStats: (timeWindow = '30d') =>
    request('GET', `/api/v1/dashboard/stats?window=${timeWindow}`),

  getAuditTrail: (caseId, filters = {}) => {
    const query = new URLSearchParams(filters).toString();
    return request('GET', `/api/v1/audit/${caseId}/audit${query ? `?${query}` : ''}`);
  },

  exportCase: (caseId, format = 'pdf') =>
    request('GET', `/api/v1/cases/${caseId}/export?format=${format}`),
  generateHearingPack: (caseId) =>
    request('POST', `/api/v1/cases/${caseId}/hearing-pack`),

  refreshVectorStore: (store) =>
    request('POST', '/api/v1/admin/vector-stores/refresh', { body: { store } }),
  getAdminHealth: () =>
    request('GET', '/api/v1/admin/health'),
  manageUser: (userId, action, data) =>
    request('POST', `/api/v1/admin/users/${userId}/${action}`, { body: data }),
  setConfig: (config) =>
    request('POST', '/api/v1/admin/cost-config', { body: config }),

  getEscalatedCases: (page = 1) =>
    request('GET', `/api/v1/cases/escalated?page=${page}`),
  actionOnEscalatedCase: (itemId, action, reason = '') =>
    request('POST', `/api/v1/cases/escalated/${itemId}/action`, {
      body: { action, reason },
    }),
};

export default api;
