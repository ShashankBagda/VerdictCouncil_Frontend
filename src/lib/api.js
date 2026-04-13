/**
 * HTTP API client with automatic auth, error handling, and 401 redirects
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const isTruthyEnv = (value) => {
  if (value === true) return true;
  if (!value) return false;
  const normalized = String(value).toLowerCase();
  return normalized === 'true' || normalized === '1';
};

const BYPASS_AUTH = import.meta.env.DEV && isTruthyEnv(import.meta.env.VITE_BYPASS_AUTH);

async function request(method, path, body = null) {
  const url = `${API_BASE_URL}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Include HTTP-only cookies
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    throw new APIError(0, 'Network error: ' + error.message);
  }

  // Handle 401 - redirect to login
  if (response.status === 401) {
    if (!BYPASS_AUTH) {
      window.location.href = '/login';
      throw new APIError(401, 'Session expired. Redirecting to login...');
    }

    throw new APIError(401, 'Unauthorized (dev bypass auth enabled)');
  }

  // Handle 429 - rate limited
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After') || '60';
    throw new APIError(429, `Rate limited. Retry after ${retryAfter} seconds`);
  }

  // Parse response
  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  // Handle error responses
  if (!response.ok) {
    const detail = data?.detail || `HTTP ${response.status}`;
    const fieldErrors = data?.fieldErrors || {};
    throw new APIError(response.status, detail, fieldErrors);
  }

  return data;
}

export const api = {
  // Auth
  login: (email, password) =>
    request('POST', '/api/v1/auth/login', { email, password }),
  logout: () =>
    request('POST', '/api/v1/auth/logout'),

  // Cases
  createCase: (caseData) =>
    request('POST', '/api/v1/cases/', caseData),
  listCases: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request('GET', `/api/v1/cases/?${query}`);
  },
  getCaseDetail: (caseId) =>
    request('GET', `/api/v1/cases/${caseId}`),

  // Documents
  uploadDocuments: async (caseId, files, onProgress) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    const url = `${API_BASE_URL}/api/v1/cases/${caseId}/documents`;
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onProgress(percent);
          }
        });
      }

      xhr.addEventListener('load', () => {
        if (xhr.status === 401) {
          if (!BYPASS_AUTH) {
            window.location.href = '/login';
            reject(new APIError(401, 'Session expired'));
            return;
          }

          reject(new APIError(401, 'Unauthorized (dev bypass auth enabled)'));
        } else if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve({ data: JSON.parse(xhr.responseText) });
          } catch {
            resolve({ data: null });
          }
        } else {
          try {
            const data = JSON.parse(xhr.responseText);
            reject(new APIError(xhr.status, data.detail || xhr.statusText));
          } catch {
            reject(new APIError(xhr.status, xhr.statusText));
          }
        }
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
  },

  // Pipeline Status
  getPipelineStatus: (caseId) =>
    request('GET', `/api/v1/cases/${caseId}/status`),
  
  // Stream SSE for real-time status
  streamPipelineStatus: (caseId) => {
    const url = `${API_BASE_URL}/api/v1/cases/${caseId}/status/stream`;
    return new EventSource(url, { withCredentials: true });
  },

  // Analysis Views
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

  // Decisions
  recordDecision: (caseId, decision) =>
    request('POST', `/api/v1/cases/${caseId}/decision`, decision),

  // What-If
  createWhatIfScenario: (caseId, scenario) =>
    request('POST', `/api/v1/what-if/scenarios`, { caseId, ...scenario }),
  getWhatIfScenario: (scenarioId) =>
    request('GET', `/api/v1/what-if/scenarios/${scenarioId}`),
  computeStability: (caseId) =>
    request('POST', `/api/v1/what-if/stability`, { caseId }),
  getStability: (caseId) =>
    request('GET', `/api/v1/what-if/stability/${caseId}`),

  // Dispute Fact
  disputeFact: (caseId, factId) =>
    request('PATCH', `/api/v1/cases/${caseId}/facts/${factId}/dispute`),

  // Precedent Search
  searchPrecedents: (query, domain) =>
    request('POST', '/api/v1/precedents/search', { query, domain }),

  // Knowledge Base
  getKnowledgeBaseStatus: () =>
    request('GET', '/api/v1/knowledge-base/status'),

  // Dashboard
  getDashboardStats: (timeWindow = '30d') =>
    request('GET', `/api/v1/dashboard/stats?window=${timeWindow}`),

  // Audit Trail
  getAuditTrail: (caseId, filters = {}) => {
    const query = new URLSearchParams(filters).toString();
    return request('GET', `/api/v1/audit/${caseId}/audit?${query}`);
  },

  // Export
  exportCase: (caseId, format = 'pdf') =>
    request('GET', `/api/v1/cases/${caseId}/export?format=${format}`),
  generateHearingPack: (caseId) =>
    request('POST', `/api/v1/cases/${caseId}/hearing-pack`),

  // Admin
  refreshVectorStore: (store) =>
    request('POST', '/api/v1/admin/vector-stores/refresh', { store }),
  getAdminHealth: () =>
    request('GET', '/api/v1/admin/health'),
  manageUser: (userId, action, data) =>
    request('POST', `/api/v1/admin/users/${userId}/${action}`, data),
  setConfig: (config) =>
    request('POST', '/api/v1/admin/cost-config', config),

  // Senior Judge
  getSeniorInbox: (page = 1) =>
    request('GET', `/api/v1/senior-judge/inbox?page=${page}`),
  actionOnInbox: (itemId, action, reason = '') =>
    request('POST', `/api/v1/senior-judge/inbox/${itemId}/action`, { action, reason }),
};

export class APIError extends Error {
  constructor(status, detail, fieldErrors = {}) {
    super(detail);
    this.status = status;
    this.detail = detail;
    this.fieldErrors = fieldErrors;
  }
}

export default api;
