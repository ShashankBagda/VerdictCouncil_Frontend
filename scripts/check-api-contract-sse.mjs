#!/usr/bin/env node
/**
 * SSE contract lint: every event kind handled on the frontend via
 * EventSource.addEventListener must exist in the backend SSE schema
 * (docs/sse-schema.json), and vice versa.
 *
 * Fails with an explicit diff when schema kinds ↔ client kinds drift.
 *
 * Usage:
 *   npm run check:contract:sse
 *
 * Schema resolution (first match wins):
 *   1. $VC_SSE_SCHEMA   — explicit absolute path override.
 *   2. ../VerdictCouncil_Backend/docs/sse-schema.json (sibling checkout layout).
 */

import { readFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

// ── Load SSE schema ──────────────────────────────────────────────────────────

function loadSseSchema() {
  const candidates = [
    process.env.VC_SSE_SCHEMA,
    resolve(repoRoot, '../VerdictCouncil_Backend/docs/sse-schema.json'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const raw = readFileSync(candidate, 'utf-8');
      return { schema: JSON.parse(raw), source: candidate };
    } catch {
      // try the next candidate
    }
  }

  throw new Error(
    'Could not find docs/sse-schema.json. ' +
    'Set $VC_SSE_SCHEMA or ensure the backend submodule is checked out.',
  );
}

// ── Extract kind values from the schema ─────────────────────────────────────

function extractSchemaKinds(schema) {
  const defs = schema['$defs'] || {};
  const oneOf = schema['oneOf'] || schema['anyOf'] || [];
  const kinds = new Set();

  for (const variant of oneOf) {
    const ref = variant['$ref'];
    if (!ref) continue;
    const defName = ref.replace('#/$defs/', '');
    const defn = defs[defName];
    if (!defn) continue;
    const kindConst = defn?.properties?.kind?.const;
    if (kindConst) kinds.add(kindConst);
  }

  // Fallback: scan all defs for kind.const even if no oneOf
  if (kinds.size === 0) {
    for (const defn of Object.values(defs)) {
      const kindConst = defn?.properties?.kind?.const;
      if (kindConst) kinds.add(kindConst);
    }
  }

  return kinds;
}

// ── Scan frontend source for addEventListener event names ────────────────────

function collectJsFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
      collectJsFiles(full, files);
    } else if (/\.(jsx?|tsx?|mjs)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

// Matches: .addEventListener('progress', ...) or .addEventListener("agent", ...)
const LISTENER_RE = /\.addEventListener\s*\(\s*['"]([^'"]+)['"]\s*,/g;

// Only scan files that are SSE consumers — those that call into the SSE
// factory functions (streamPipelineStatus / streamIntakeEvents).  This
// prevents XHR upload addEventListener('progress', ...) calls in api.js
// from falsely matching the 'progress' SSE kind.
const SSE_CONSUMER_RE = /streamPipelineStatus|streamIntakeEvents/;

function extractClientKinds(srcDir, schemaKinds) {
  const files = collectJsFiles(srcDir);
  const found = new Set();

  for (const file of files) {
    const src = readFileSync(file, 'utf-8');
    if (!SSE_CONSUMER_RE.test(src)) continue;
    for (const match of src.matchAll(LISTENER_RE)) {
      const name = match[1];
      // Only keep names that appear in the schema — ignore browser DOM events
      if (schemaKinds.has(name)) {
        found.add(name);
      }
    }
  }

  return found;
}

// ── Main ─────────────────────────────────────────────────────────────────────

const { schema, source } = loadSseSchema();
console.log(`SSE schema: ${source}`);

const schemaKinds = extractSchemaKinds(schema);
console.log(`Schema kinds (${schemaKinds.size}): ${[...schemaKinds].sort().join(', ')}`);

const srcDir = resolve(repoRoot, 'src');
const clientKinds = extractClientKinds(srcDir, schemaKinds);
console.log(`Client kinds (${clientKinds.size}): ${[...clientKinds].sort().join(', ')}`);

const missingFromClient = [...schemaKinds].filter((k) => !clientKinds.has(k));
const extraOnClient = [...clientKinds].filter((k) => !schemaKinds.has(k));

let ok = true;

if (missingFromClient.length > 0) {
  console.error(
    `\n✗ Schema kinds not handled by client: ${missingFromClient.join(', ')}\n` +
    `  Add EventSource.addEventListener('${missingFromClient[0]}', ...) in a SSE consumer.`,
  );
  ok = false;
}

if (extraOnClient.length > 0) {
  console.error(
    `\n✗ Client handles unknown SSE kinds: ${extraOnClient.join(', ')}\n` +
    `  Update docs/sse-schema.json or remove the stale addEventListener call.`,
  );
  ok = false;
}

if (ok) {
  console.log('\n✓ SSE contract OK — schema kinds and client listeners match.');
  process.exit(0);
} else {
  process.exit(1);
}
