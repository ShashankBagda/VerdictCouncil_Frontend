// Sprint 4 4.C5.1 — sentry.ts contract.
//
// Locks two invariants:
//
//   1. initSentry() is a silent no-op when VITE_SENTRY_DSN is unset.
//      Dev and CI runs without a DSN must not crash, must not call
//      Sentry.init, and must report `false` so the caller can decide
//      whether to log.
//   2. tagSession(traceId) sets `backend_trace_id` + `backend_trace_url`
//      on the active Sentry scope, building the LangSmith URL from
//      the configured project (or the default).
//
// @sentry/react is mocked at the module boundary — these tests do not
// reach into the real Sentry runtime.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const initMock = vi.fn();
const setTagMock = vi.fn();

vi.mock('@sentry/react', () => ({
  init: (...args) => initMock(...args),
  setTag: (...args) => setTagMock(...args),
}));

const importFresh = async () => {
  vi.resetModules();
  const mod = await import('../sentry');
  return mod;
};

beforeEach(() => {
  initMock.mockClear();
  setTagMock.mockClear();
  // Wipe DSN-related env between cases — Vite stubEnv auto-restores in
  // unstubAllEnvs (afterEach).
  vi.stubEnv('VITE_SENTRY_DSN', '');
  vi.stubEnv('VITE_LANGSMITH_BASE_URL', 'https://smith.langchain.com');
  vi.stubEnv('VITE_LANGSMITH_PROJECT', 'verdictcouncil');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('initSentry', () => {
  it('is a silent no-op when VITE_SENTRY_DSN is empty', async () => {
    const { initSentry } = await importFresh();

    expect(initSentry()).toBe(false);
    expect(initMock).not.toHaveBeenCalled();
  });

  it('calls Sentry.init exactly once when DSN is set', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://abc@o0.ingest.sentry.io/1');
    const { initSentry } = await importFresh();

    expect(initSentry()).toBe(true);
    expect(initSentry()).toBe(true); // idempotent
    expect(initMock).toHaveBeenCalledTimes(1);
    const passed = initMock.mock.calls[0][0];
    expect(passed.dsn).toBe('https://abc@o0.ingest.sentry.io/1');
  });
});

describe('tagSession', () => {
  it('sets backend_trace_id + backend_trace_url scope tags', async () => {
    const { tagSession, langsmithTraceUrl } = await importFresh();
    const traceId = '0af7651916cd43dd8448eb211c80319c';

    tagSession(traceId);

    expect(setTagMock).toHaveBeenCalledWith('backend_trace_id', traceId);
    expect(setTagMock).toHaveBeenCalledWith(
      'backend_trace_url',
      langsmithTraceUrl(traceId),
    );
  });

  it('drops undefined / empty trace_ids silently', async () => {
    const { tagSession } = await importFresh();

    tagSession(undefined);
    tagSession(null);
    tagSession('');

    expect(setTagMock).not.toHaveBeenCalled();
  });

  it('honours an explicit project override', async () => {
    const { tagSession } = await importFresh();

    tagSession('abc123', 'staging-project');

    const urlCall = setTagMock.mock.calls.find(
      (c) => c[0] === 'backend_trace_url',
    );
    expect(urlCall[1]).toContain('staging-project');
  });
});

describe('langsmithTraceUrl', () => {
  it('builds an absolute URL on the configured base + project', async () => {
    const { langsmithTraceUrl } = await importFresh();

    const url = langsmithTraceUrl('trace-1');

    expect(url).toBe(
      'https://smith.langchain.com/o/projects/p/verdictcouncil/r/trace-1',
    );
  });

  it('url-encodes the project name', async () => {
    const { langsmithTraceUrl } = await importFresh();

    const url = langsmithTraceUrl('trace-2', 'has spaces');

    expect(url).toContain('/p/has%20spaces/');
  });
});
