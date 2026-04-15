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
});
