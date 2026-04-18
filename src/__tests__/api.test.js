import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test URL construction by importing api and checking the fetch calls
describe('API module', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
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
    vi.resetModules();
  });

  it('constructs correct login URL', async () => {
    const { default: api } = await import('../lib/api');
    try {
      await api.login('test@test.com', 'password');
    } catch {
      // May fail due to response structure, that's fine
    }
    const fetchCall = globalThis.fetch.mock.calls[0];
    expect(fetchCall[0]).toContain('/api/v1/auth/login');
  });

  it('constructs correct cases list URL', async () => {
    const { default: api } = await import('../lib/api');
    try {
      await api.listCases();
    } catch {
      // ignore
    }
    const fetchCall = globalThis.fetch.mock.calls[0];
    expect(fetchCall[0]).toContain('/api/v1/cases');
  });

  it('constructs correct dashboard stats URL', async () => {
    const { default: api } = await import('../lib/api');
    try {
      await api.getDashboardStats();
    } catch {
      // ignore
    }
    const fetchCall = globalThis.fetch.mock.calls[0];
    expect(fetchCall[0]).toContain('/api/v1/dashboard/stats');
  });

  it('constructs correct knowledge base URL', async () => {
    const { default: api } = await import('../lib/api');
    try {
      await api.listKBDocuments();
    } catch {
      // ignore
    }
    const fetchCall = globalThis.fetch.mock.calls[0];
    expect(fetchCall[0]).toContain('/api/v1/knowledge-base/documents');
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

  it('constructs correct escalated cases URL', async () => {
    const { default: api } = await import('../lib/api');
    try {
      await api.getEscalatedCases();
    } catch {
      // ignore
    }
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
});
