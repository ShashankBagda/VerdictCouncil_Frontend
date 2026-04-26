// Sprint 4 4.C5.1 — Sentry → LangSmith trace handoff.
//
// Initialises @sentry/react when VITE_SENTRY_DSN is set; otherwise the
// init() call is a no-op so dev / CI environments without a DSN don't
// break or ship empty Sentry events.
//
// `tagSession(traceId, project)` stamps the active Sentry scope with
// the W3C OTEL trace_id from the most recent SSE event plus a
// LangSmith trace URL. When a frontend error fires, the captured
// Sentry event then carries `backend_trace_id` + `backend_trace_url`
// tags — clicking the URL opens the matching backend run in LangSmith.

import * as Sentry from '@sentry/react';

const LANGSMITH_BASE_URL =
  import.meta.env.VITE_LANGSMITH_BASE_URL || 'https://smith.langchain.com';

const DEFAULT_LANGSMITH_PROJECT =
  import.meta.env.VITE_LANGSMITH_PROJECT || 'verdictcouncil';

let initialised = false;

/**
 * Boot Sentry if VITE_SENTRY_DSN is set.
 *
 * @returns {boolean} true when @sentry/react is now active; false on
 *   silent no-op (no DSN) so callers can decide whether to log.
 */
export function initSentry() {
  if (initialised) return true;
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    // Silent no-op: most dev workstations and CI runs don't need
    // Sentry. A loud failure here would force every contributor to
    // configure a DSN before `npm run dev` works.
    return false;
  }

  Sentry.init({
    dsn,
    environment:
      import.meta.env.VITE_SENTRY_ENV || import.meta.env.MODE || 'development',
    // Disable performance + replay by default — the LangSmith handoff
    // is the primary value of this integration; tracing/perf can be
    // toggled on later via env if needed.
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
  initialised = true;
  return true;
}

/**
 * Build the LangSmith trace URL for a given W3C OTEL trace_id.
 *
 * The URL pattern matches what the backend's LangSmith client renders
 * for a single run. ``trace_id`` is the W3C value the backend
 * propagates from the API request through ``trace_id`` on each SSE
 * frame (Sprint 2 2.C1.6).
 *
 * @param {string} traceId
 * @param {string} [project]
 * @returns {string}
 */
export function langsmithTraceUrl(traceId, project = DEFAULT_LANGSMITH_PROJECT) {
  const encoded = encodeURIComponent(project);
  return `${LANGSMITH_BASE_URL}/o/projects/p/${encoded}/r/${traceId}`;
}

/**
 * Stamp the current Sentry scope with the backend trace handoff.
 *
 * Called from the SSE consumer for every frame that carries a
 * ``trace_id`` (so the *latest* event's trace is the one a subsequent
 * frontend error attaches to — typical for SPA error → backend-cause
 * navigation). Undefined / empty trace_ids are dropped silently to
 * keep stale tags from sticking on the scope.
 *
 * @param {string|null|undefined} traceId
 * @param {string} [project]
 */
export function tagSession(traceId, project = DEFAULT_LANGSMITH_PROJECT) {
  if (!traceId) return;
  Sentry.setTag('backend_trace_id', traceId);
  Sentry.setTag('backend_trace_url', langsmithTraceUrl(traceId, project));
}

/** Test-only: reset the module-level guard so each test re-enters init(). */
export function __resetForTests() {
  initialised = false;
}
