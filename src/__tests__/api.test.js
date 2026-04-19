import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('API module', () => {
  let originalFetch;
  let originalXHR;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalXHR = globalThis.XMLHttpRequest;
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: {
          get: () => 'application/json',
        },
        json: () => Promise.resolve({}),
      })
    );
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.XMLHttpRequest = originalXHR;
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('builds APIError and error messages correctly', async () => {
    const { APIError, getErrorMessage } = await import('../lib/api');
    const apiError = new APIError(400, 'Bad request');

    expect(getErrorMessage(apiError, 'fallback')).toBe('Bad request');
    expect(getErrorMessage(new Error('Boom'), 'fallback')).toBe('Boom');
    expect(getErrorMessage(null, 'fallback')).toBe('fallback');
  });

  it('constructs correct login URL', async () => {
    const { default: api } = await import('../lib/api');
    await api.login('test@test.com', 'password');
    const fetchCall = globalThis.fetch.mock.calls[0];
    expect(fetchCall[0]).toContain('/api/v1/auth/login');
    expect(fetchCall[1].method).toBe('POST');
    expect(fetchCall[1].body).toBe(JSON.stringify({ email: 'test@test.com', password: 'password' }));
  });

  it('constructs correct cases list URL', async () => {
    const { default: api } = await import('../lib/api');
    await api.listCases({ status_filter: 'pending', domain_filter: 'civil', page: 2, per_page: 5 });
    const fetchCall = globalThis.fetch.mock.calls[0];
    expect(fetchCall[0]).toContain('/api/v1/cases/?status=pending&domain=civil&page=2&per_page=5');
  });

  it('constructs correct dashboard stats URL', async () => {
    const { default: api } = await import('../lib/api');
    await api.getDashboardStats();
    const fetchCall = globalThis.fetch.mock.calls[0];
    expect(fetchCall[0]).toContain('/api/v1/dashboard/stats');
  });

  it('constructs correct knowledge base URL', async () => {
    const { default: api } = await import('../lib/api');
    await api.listKBDocuments();
    const fetchCall = globalThis.fetch.mock.calls[0];
    expect(fetchCall[0]).toContain('/api/v1/knowledge-base/documents');
  });

  it('throws an APIError on network failures', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('offline')));
    const { default: api } = await import('../lib/api');

    await expect(api.getSession()).rejects.toMatchObject({ status: 0, detail: 'Network error: offline' });
  });

  it('does not redirect during suppressed 401 session bootstrap', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        headers: {
          get: () => 'application/json',
        },
        json: () => Promise.resolve({ detail: 'Unauthorized' }),
      }),
    );

    const { default: api } = await import('../lib/api');

    await expect(api.getSession()).rejects.toMatchObject({ status: 401 });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to /auth/me when /auth/session is unavailable', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: {
          get: () => 'application/json',
        },
        json: () => Promise.resolve({ detail: 'Not found' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: () => 'application/json',
        },
        json: () => Promise.resolve({ id: 'user-1', email: 'judge@verdictcouncil.sg', role: 'judge' }),
      });

    const { default: api } = await import('../lib/api');
    const session = await api.getSession();

    expect(globalThis.fetch.mock.calls[0][0]).toContain('/api/v1/auth/session');
    expect(globalThis.fetch.mock.calls[1][0]).toContain('/api/v1/auth/me');
    expect(session.user.email).toBe('judge@verdictcouncil.sg');
  });

  it('falls back to getSession when session extension endpoint is unavailable', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ detail: 'Missing' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ user: { id: 'user-1', email: 'judge@verdictcouncil.sg', role: 'judge' } }),
      });

    const { default: api } = await import('../lib/api');
    const result = await api.extendSession();

    expect(globalThis.fetch.mock.calls[0][0]).toContain('/api/v1/auth/extend');
    expect(globalThis.fetch.mock.calls[1][0]).toContain('/api/v1/auth/session');
    expect(result.user.email).toBe('judge@verdictcouncil.sg');
  });

  it('normalizes decision payloads for backend compatibility', async () => {
    const { default: api } = await import('../lib/api');
    await api.recordDecision('case-123', { decision_type: 'modify', reason: 'Adjust remedy' });

    const fetchCall = globalThis.fetch.mock.calls[0];
    expect(fetchCall[0]).toContain('/api/v1/cases/case-123/decision');
    expect(fetchCall[1].body).toBe(JSON.stringify({ action: 'modify', notes: 'Adjust remedy', final_order: undefined }));
  });

  it('constructs correct escalated cases URL', async () => {
    const { default: api } = await import('../lib/api');
    await api.getEscalatedCases();
    const fetchCall = globalThis.fetch.mock.calls[0];
    expect(fetchCall[0]).toContain('/api/v1/escalated-cases?page=1');
  });

  it('posts backend-compatible escalated case actions', async () => {
    const { default: api } = await import('../lib/api');
    try {
      await api.actionOnEscalatedCase('case-123', {
        action: 'manual_decision',
        notes: 'Reviewed by senior judge',
        final_order: 'Appeal dismissed.',
      });
    } catch {
      // ignore
    }
    const fetchCall = globalThis.fetch.mock.calls[0];
    expect(fetchCall[0]).toContain('/api/v1/escalated-cases/case-123/action');
    expect(fetchCall[1].method).toBe('POST');
    expect(fetchCall[1].body).toBe(
      JSON.stringify({
        action: 'manual_decision',
        notes: 'Reviewed by senior judge',
        final_order: 'Appeal dismissed.',
      }),
    );
  });

  it('constructs all newly implemented phase5 contract URLs', async () => {
    const { default: api } = await import('../lib/api');

    await api.requestPasswordReset('judge@verdictcouncil.sg');
    await api.verifyPasswordReset('token-1', 'password-2');
    await api.initializeKB();
    await api.searchKB('equity');
    await api.exportCase('case-1', 'pdf');
    await api.refreshVectorStore('primary');
    await api.manageUser('user-1', 'set-role', { role: 'judge' });
    await api.setConfig({ budget_daily: 10 });

    const calledUrls = globalThis.fetch.mock.calls.map((call) => call[0]);
    expect(calledUrls).toEqual(
      expect.arrayContaining([
        expect.stringContaining('/api/v1/auth/request-reset'),
        expect.stringContaining('/api/v1/auth/verify-reset'),
        expect.stringContaining('/api/v1/knowledge-base/initialize'),
        expect.stringContaining('/api/v1/knowledge-base/search'),
        expect.stringContaining('/api/v1/cases/case-1/export?format=pdf'),
        expect.stringContaining('/api/v1/admin/vector-stores/refresh'),
        expect.stringContaining('/api/v1/admin/users/user-1/set-role'),
        expect.stringContaining('/api/v1/admin/cost-config'),
      ]),
    );
  });

  it('creates an EventSource for pipeline streaming', async () => {
    const originalEventSource = globalThis.EventSource;
    const eventSourceMock = vi.fn();
    globalThis.EventSource = eventSourceMock;

    const { default: api } = await import('../lib/api');
    api.streamPipelineStatus('case-123');

    expect(eventSourceMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/cases/case-123/status/stream'),
      { withCredentials: true },
    );

    globalThis.EventSource = originalEventSource;
  });

  it('uploads knowledge base files and reports progress through XMLHttpRequest', async () => {
    const listeners = {};
    const uploadListeners = {};

    class MockXHR {
      constructor() {
        this.upload = {
          addEventListener: (event, handler) => {
            uploadListeners[event] = handler;
          },
        };
        this.responseText = JSON.stringify({ ok: true });
        this.status = 200;
        this.statusText = 'OK';
      }

      addEventListener(event, handler) {
        listeners[event] = handler;
      }

      open(method, url) {
        this.method = method;
        this.url = url;
      }

      send(body) {
        this.body = body;
        uploadListeners.progress({ lengthComputable: true, loaded: 5, total: 10 });
        listeners.load();
      }
    }

    globalThis.XMLHttpRequest = MockXHR;
    const onProgress = vi.fn();
    const file = new File(['hello'], 'kb.txt', { type: 'text/plain' });
    const { default: api } = await import('../lib/api');

    const result = await api.uploadToKB(file, onProgress);

    expect(onProgress).toHaveBeenCalledWith(50);
    expect(result).toEqual({ ok: true });
  });

  it('covers remaining case and hearing workflow endpoints', async () => {
    const { default: api } = await import('../lib/api');

    await api.logout();
    await api.createCase({ title: 'Case A' });
    await api.getCaseDetail('case-1');
    await api.getPipelineStatus('case-1');
    await api.getEvidence('case-1');
    await api.getTimeline('case-1');
    await api.getWitnesses('case-1');
    await api.getStatutes('case-1');
    await api.getPrecedents('case-1');
    await api.getArguments('case-1');
    await api.getDeliberation('case-1');
    await api.getVerdict('case-1');
    await api.getEvidenceGaps('case-1');
    await api.getFairnessAudit('case-1');
    await api.createWhatIfScenario('case-1', { prompt: 'what if' });
    await api.getWhatIfScenario('case-1', 'scenario-1');
    await api.computeStability('case-1', 7);
    await api.getStability('case-1');
    await api.disputeFact('case-1', 'fact-1', { status: 'contested' });
    await api.searchPrecedents('estoppel', 'sg', 3);
    await api.getKnowledgeBaseStatus();
    await api.deleteKBDocument('file-1');
    await api.getAuditTrail('case-1', { actor: 'judge' });
    await api.generateHearingPack('case-1');
    await api.createHearingNote('case-1', { note: 'hearing note' });
    await api.listHearingNotes('case-1');
    await api.updateHearingNote('case-1', 'note-1', { note: 'updated' });
    await api.lockHearingNote('case-1', 'note-1');
    await api.deleteHearingNote('case-1', 'note-1');
    await api.amendDecision('case-1', { change: 'clarify' });
    await api.getDecisionHistory('case-1');
    await api.requestCaseReopen('case-1', { reason: 'new evidence' });
    await api.listReopenRequests('case-1');
    await api.reviewReopenRequest('case-1', 'req-1', { action: 'approve' });
    await api.getAdminHealth();
    await api.getSeniorInbox(2, 15);

    const calledUrls = globalThis.fetch.mock.calls.map((call) => call[0]);
    expect(calledUrls).toEqual(
      expect.arrayContaining([
        expect.stringContaining('/api/v1/auth/logout'),
        expect.stringContaining('/api/v1/cases/'),
        expect.stringContaining('/api/v1/cases/case-1'),
        expect.stringContaining('/api/v1/cases/case-1/status'),
        expect.stringContaining('/api/v1/cases/case-1/evidence'),
        expect.stringContaining('/api/v1/cases/case-1/timeline'),
        expect.stringContaining('/api/v1/cases/case-1/witnesses'),
        expect.stringContaining('/api/v1/cases/case-1/statutes'),
        expect.stringContaining('/api/v1/cases/case-1/precedents'),
        expect.stringContaining('/api/v1/cases/case-1/arguments'),
        expect.stringContaining('/api/v1/cases/case-1/deliberation'),
        expect.stringContaining('/api/v1/cases/case-1/verdict'),
        expect.stringContaining('/api/v1/cases/case-1/evidence-gaps'),
        expect.stringContaining('/api/v1/cases/case-1/fairness-audit'),
        expect.stringContaining('/api/v1/cases/case-1/what-if'),
        expect.stringContaining('/api/v1/cases/case-1/what-if/scenario-1'),
        expect.stringContaining('/api/v1/cases/case-1/stability'),
        expect.stringContaining('/api/v1/cases/case-1/facts/fact-1/dispute'),
        expect.stringContaining('/api/v1/precedents/search'),
        expect.stringContaining('/api/v1/knowledge-base/status'),
        expect.stringContaining('/api/v1/knowledge-base/documents/file-1'),
        expect.stringContaining('/api/v1/audit/case-1/audit?actor=judge'),
        expect.stringContaining('/api/v1/cases/case-1/hearing-pack'),
        expect.stringContaining('/api/v1/cases/case-1/hearing-notes'),
        expect.stringContaining('/api/v1/cases/case-1/hearing-notes/note-1'),
        expect.stringContaining('/api/v1/cases/case-1/hearing-notes/note-1/lock'),
        expect.stringContaining('/api/v1/cases/case-1/amend-decision'),
        expect.stringContaining('/api/v1/cases/case-1/decision-history'),
        expect.stringContaining('/api/v1/cases/case-1/reopen-request'),
        expect.stringContaining('/api/v1/cases/case-1/reopen-requests'),
        expect.stringContaining('/api/v1/cases/case-1/reopen-requests/req-1/review'),
        expect.stringContaining('/api/v1/health/pair'),
        expect.stringContaining('/api/v1/senior-inbox?page=2&per_page=15'),
      ]),
    );
  });

  it('handles text, empty, and upload error responses', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'text/plain' },
        text: () => Promise.resolve('pdf-bytes'),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: { get: () => null },
        text: () => Promise.resolve(''),
      });

    const listeners = {};

    class FailingXHR {
      constructor() {
        this.upload = { addEventListener: vi.fn() };
      }

      addEventListener(event, handler) {
        listeners[event] = handler;
      }

      open() {}

      send() {
        listeners.error();
      }
    }

    globalThis.XMLHttpRequest = FailingXHR;
    const { default: api } = await import('../lib/api');

    await expect(api.exportCase('case-2', 'pdf')).resolves.toBe('pdf-bytes');
    await expect(api.logout()).resolves.toBeNull();
    await expect(api.uploadDocuments('case-2', [new File(['x'], 'doc.txt')])).rejects.toMatchObject({
      status: 0,
      detail: 'Network error during upload',
    });
  });
});
