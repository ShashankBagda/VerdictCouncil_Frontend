#!/usr/bin/env node
/**
 * Contract lint: every literal `/api/v1/...` path in src/lib/api.js must exist
 * in the committed VerdictCouncil_Backend/docs/openapi.json. Fails with a clear
 * diff when the frontend calls a path the backend does not expose.
 *
 * Usage:
 *   npm run check:contract
 *
 * Resolution strategy for the OpenAPI snapshot (first match wins):
 *   1. $VC_BACKEND_OPENAPI   — explicit absolute path override.
 *   2. ../VerdictCouncil_Backend/docs/openapi.json (sibling checkout layout).
 *   3. ./src/lib/openapi-contract.json (optional pinned copy).
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

function loadOpenApi() {
  const candidates = [
    process.env.VC_BACKEND_OPENAPI,
    resolve(repoRoot, '../VerdictCouncil_Backend/docs/openapi.json'),
    resolve(repoRoot, 'src/lib/openapi-contract.json'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const raw = readFileSync(candidate, 'utf-8');
      return { spec: JSON.parse(raw), source: candidate };
    } catch {
      /* try the next candidate */
    }
  }

  throw new Error(
    `Could not find openapi.json. Tried:\n  ${candidates.join('\n  ')}\n` +
      'Set VC_BACKEND_OPENAPI or keep VerdictCouncil_Backend checked out as a sibling directory.',
  );
}

function extractFrontendPaths(source) {
  const pathPattern = /['"`](\/api\/v1\/[A-Za-z0-9_\-/${}?.=&]*)['"`]/g;
  const found = new Set();
  let match;
  while ((match = pathPattern.exec(source)) !== null) {
    found.add(match[1]);
  }
  return [...found];
}

function normalizeFrontendPath(raw) {
  let path = raw;
  const qs = path.indexOf('?');
  if (qs !== -1) path = path.slice(0, qs);
  path = path.replace(/\$\{[^}]+\}/g, '{param}');
  return path;
}

function buildSpecMatcher(spec) {
  const patterns = Object.keys(spec.paths).map((p) => {
    const regex = new RegExp('^' + p.replace(/\{[^}]+\}/g, '[^/]+') + '$');
    return { raw: p, regex };
  });
  return (candidate) => {
    const normalized = candidate.replace(/\{param\}/g, 'x');
    return patterns.some(({ regex }) => regex.test(normalized));
  };
}

function main() {
  const { spec, source } = loadOpenApi();
  const apiJsPath = resolve(repoRoot, 'src/lib/api.js');
  const apiJs = readFileSync(apiJsPath, 'utf-8');
  const frontendPaths = extractFrontendPaths(apiJs);

  const matches = buildSpecMatcher(spec);
  const unknown = [];
  for (const raw of frontendPaths) {
    const normalized = normalizeFrontendPath(raw);
    if (!matches(normalized)) {
      unknown.push({ raw, normalized });
    }
  }

  console.log(`check:contract — verified against ${source}`);
  console.log(`  frontend literal paths: ${frontendPaths.length}`);
  console.log(`  OpenAPI paths:          ${Object.keys(spec.paths).length}`);

  if (unknown.length === 0) {
    console.log('  ✓ every frontend path is declared in the OpenAPI spec');
    return 0;
  }

  console.error(`\n✗ ${unknown.length} frontend path(s) are not in the OpenAPI spec:`);
  for (const { raw, normalized } of unknown) {
    console.error(`  - ${raw}   (normalized: ${normalized})`);
  }
  console.error(
    '\nEither add the route to the backend (and commit a fresh docs/openapi.json),\n' +
      'or remove the call from src/lib/api.js.',
  );
  return 1;
}

process.exit(main());
