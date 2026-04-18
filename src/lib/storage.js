/**
 * localStorage wrapper for persistent preferences and non-auth session data.
 * Auth is cookie-based and should not be mirrored into localStorage.
 */

export const storage = {
  // User preferences
  getTheme: () => localStorage.getItem('vc_theme') || 'light',
  setTheme: (theme) => localStorage.setItem('vc_theme', theme),

  // Case filters
  getCaseFilters: () => {
    const stored = localStorage.getItem('vc_case_filters');
    return stored ? JSON.parse(stored) : {};
  },
  setCaseFilters: (filters) => {
    localStorage.setItem('vc_case_filters', JSON.stringify(filters));
  },

  // Last viewed case
  setLastCaseId: (caseId) => {
    localStorage.setItem('vc_last_case_id', caseId);
  },
  getLastCaseId: () => {
    return localStorage.getItem('vc_last_case_id');
  },

  // Offline queue (for PWA)
  addToQueue: (action) => {
    const queue = JSON.parse(localStorage.getItem('vc_queue') || '[]');
    queue.push(action);
    localStorage.setItem('vc_queue', JSON.stringify(queue));
  },
  getQueue: () => {
    return JSON.parse(localStorage.getItem('vc_queue') || '[]');
  },
  clearQueue: () => {
    localStorage.removeItem('vc_queue');
  },

  // General key-value
  set: (key, value) => {
    localStorage.setItem(`vc_${key}`, JSON.stringify(value));
  },
  get: (key) => {
    const item = localStorage.getItem(`vc_${key}`);
    return item ? JSON.parse(item) : null;
  },
  remove: (key) => {
    localStorage.removeItem(`vc_${key}`);
  },
};

export default storage;
