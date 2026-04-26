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

// W3C trace-context trace_id is 32 hex chars (128-bit). Some emitters
// truncate to a 16-char span-id shape, so accept either length and
// hex-only — anything else is rejected so a malformed or attacker-
// supplied value cannot reach an <a href> as a path-traversal or
// header-injection payload.
const TRACE_ID_RE = /^[0-9a-f]{16,32}$/i;

/**
 * Build the LangSmith trace URL for a given W3C OTEL trace_id.
 *
 * The URL pattern matches what the backend's LangSmith client renders
 * for a single run. ``trace_id`` is the W3C value the backend
 * propagates from the API request through ``trace_id`` on each SSE
 * frame (Sprint 2 2.C1.6).
 *
 * Returns `null` when the trace_id is empty, malformed, or doesn't
 * match the W3C trace-id shape — callers must handle the null branch
 * and skip rendering the link rather than emit an unsafe href.
 *
 * @param {string} traceId
 * @param {string} [project]
 * @returns {string|null}
 */
export function langsmithTraceUrl(traceId, project = DEFAULT_LANGSMITH_PROJECT) {
  if (typeof traceId !== 'string' || !TRACE_ID_RE.test(traceId)) {
    return null;
  }
  const encodedProject = encodeURIComponent(project);
  // traceId already passed the hex-only regex; encodeURIComponent is
  // belt-and-braces so a future regex change can't quietly let a
  // path-traversal payload reach the URL.
  const encodedTrace = encodeURIComponent(traceId);
  return `${LANGSMITH_BASE_URL}/o/projects/p/${encodedProject}/r/${encodedTrace}`;
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
  const url = langsmithTraceUrl(traceId, project);
  if (url === null) {
    // Malformed trace_id — refuse to stamp the tags rather than emit a
    // broken backend_trace_url that, if rendered into an anchor, could
    // surface as a reflected-link bug.
    return;
  }
  Sentry.setTag('backend_trace_id', traceId);
  Sentry.setTag('backend_trace_url', url);
}

/**
 * Clear the backend trace tags from the current Sentry scope.
 *
 * Call when navigating between cases / sessions so a late-arriving
 * frontend error from a prior case doesn't end up tagged with the
 * *new* case's trace_id (or vice versa). Without this, the SSE
 * consumer for case B overwrites case A's tags as soon as the first
 * frame arrives, leaving a window where errors mid-navigation get
 * misattributed.
 */
export function clearSessionTags() {
  Sentry.setTag('backend_trace_id', null);
  Sentry.setTag('backend_trace_url', null);
}

/** Test-only: reset the module-level guard so each test re-enters init(). */
export function __resetForTests() {
  initialised = false;
}
