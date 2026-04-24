# VerdictCouncil Frontend - Backend Adapter + Dossier Slice

- [x] Add a backend adapter layer for case sessions, dossier sections, audit events, and export packaging
- [x] Add a dedicated Case Dossier page with downloadable report sections and package export
- [x] Rebuild intake around structured section-based file buckets for parties, counsel, witnesses, proofs, and other participants
- [x] Generate AI-friendly case folder and file nomenclature for every uploaded item
- [x] Compact the graph mesh so all agents remain visible in a single screen layout
- [x] Keep seeded demo scenarios compatible with the structured intake workflow
- [x] Refresh README copy to describe the new intake, dossier, and export flow

## Review
- [x] `npm run lint`
- [x] `npm run build` attempted; blocked by company-laptop `esbuild` spawn policy (`spawn EPERM`)

---

# Local integration verification (prereq to merging PR #141)

Goal: prove the frontend ↔ backend contract works end-to-end on this laptop before provisioning DO App Platform apps. If local is broken, App Platform won't magically fix it.

All commands run from orchestration root `/Users/douglasswm/Project/AAS/VER/` unless noted.

## 1. Pre-flight
- [ ] `docker info` returns without error (Docker Desktop running)
- [ ] `command -v docker python3.12 node npm make` — all 5 present on PATH
- [ ] Both `.env` files exist and are filled in:
  - [ ] `VerdictCouncil_Backend/.env` — `OPENAI_API_KEY`, `JWT_SECRET`, `DATABASE_URL`, `REDIS_URL`, `SOLACE_BROKER_URL` populated
  - [ ] `VerdictCouncil_Frontend/.env` — `VITE_API_URL=http://localhost:8001`, `VITE_DEMO_MODE=false`, `VITE_BYPASS_AUTH=false` (real integration, not demo/bypass)
- [ ] Backend `.env` `FRONTEND_ORIGINS` includes `http://localhost:5173` (CORS)

## 2. Bring stack up
- [ ] `./dev.sh` runs to "Stack is up — backend :8001, frontend :5173" with no tracebacks
- [ ] `curl -sf http://localhost:8001/api/v1/health/pair` → 200 JSON
- [ ] `curl -sf http://localhost:5173/` → 200 HTML (Vite dev server)

## 3. Seed database
- [ ] In a second terminal: `cd VerdictCouncil_Backend && .venv/bin/python -m scripts.seed_data`
- [ ] Seeded judge credentials work (default `judge@verdictcouncil.sg` / `password` unless overridden)

## 4. Contract verification (the critical checks)
- [ ] **Frontend → OpenAPI snapshot**: `npm --prefix VerdictCouncil_Frontend run check:contract` — exits 0, no drift between `src/lib/api.js` and `VerdictCouncil_Backend/docs/openapi.json`
- [ ] **Backend snapshot current**: `make -C VerdictCouncil_Backend openapi-check` — no uncommitted changes to `docs/openapi.json`
- [ ] **Live endpoint smoke**: with stack running, `SMOKE_BASE_URL=http://localhost:8001 make -C VerdictCouncil_Backend smoke-contract` — every frontend endpoint returns expected status. If it fails on a specific path, that's exactly the integration gap to fix before deploying.

## 5. Browser smoke (the flows that matter)
- [ ] Open `http://localhost:5173`, sign in as seeded judge
- [ ] Dashboard loads with stats, case list, escalated + senior-inbox panels (all 4 backend calls succeed, no 4xx/5xx in Network tab)
- [ ] Open the seeded case's dossier → evidence, witnesses, arguments, precedents, statutes, deliberation, timeline, audit all render
- [ ] Pipeline status updates via SSE (watch Network tab for `/status` stream) or falls back to polling at `VITE_PIPELINE_STATUS_POLL_MS`
- [ ] Intake: upload a trivial test PDF into one of the structured section buckets — confirm it lands in the right agent-friendly nomenclature
- [ ] Dossier export / package download returns a file
- [ ] Browser console: zero CORS errors, zero 404s on `/api/v1/*`

## 6. Negative tests (catches config regressions)
- [ ] Stop backend (`Ctrl+C` on dev.sh) → frontend surfaces a clear error state, not a white screen
- [ ] Restart with `VITE_DEMO_MODE=true` → confirm demo path works as a fallback surface (useful while backend is being redeployed)

## 7. Document what breaks
- [ ] For every check that fails: capture the exact command + error in `tasks/lessons.md` (or a new `tasks/integration-gaps.md`) and decide: fix locally before PR #141 merges, or open a separate `feat/*` branch.

---

# DO App Platform deploy (PR #141) — follow-ups

PR: https://github.com/ShashankBagda/VerdictCouncil_Frontend/pull/141 (`feat/do-app-platform-deploy` → `development`)

## User actions required before merge
- [ ] `doctl apps list --format Spec.Name,ID` — check for name collisions with `verdictcouncil-frontend-staging` / `-production`; suffix if needed and update specs
- [ ] `doctl apps create --spec .do/app.staging.yaml` — capture the returned app UUID
- [ ] `doctl apps create --spec .do/app.production.yaml` — capture the returned app UUID
- [ ] Add repo secrets on `ShashankBagda/VerdictCouncil_Frontend`:
  - [ ] `DIGITALOCEAN_ACCESS_TOKEN`
  - [ ] `DO_APP_ID_STAGING`
  - [ ] `DO_APP_ID_PRODUCTION`
- [ ] (Optional) Configure GitHub environment protection rules on `staging` / `production`

## Verification after merge
- [ ] `ci.yml` green on PR #141
- [ ] Merge PR → `staging-deploy.yml` runs green, staging App Platform URL serves new bundle
- [ ] Deep route (e.g. `/dossier/<id>`) returns 200 — proves `catchall_document` took effect
- [ ] Promote `development → release/* → main` → `production-deploy.yml` runs green, prod URL updated

## Follow-up PRs
- [ ] After one clean prod App Platform deploy: delete `cd.yml` (or trim to `build-artifact` only if a consumer of the artifact is identified). Grep for artifact consumers before ripping it out.
- [ ] Remove the `github-pages` environment from repo settings if no other workflow uses it.
- [ ] Root submodule bump: once PR lands on `main`, `cd /Users/douglasswm/Project/AAS/VER && git add VerdictCouncil_Frontend && git commit -m "chore: bump frontend to <sha> (DO App Platform deploys)" && git push origin main`

---

# LangGraph & Streaming Remediation — Remaining Frontend Items

Spec: `/Users/douglasswm/.claude/plans/users-douglasswm-claude-plans-do-deep-r-serene-platypus.md`
Branch: `feat/sse-event-types` — PR #152 merged → `development` (`98aebf9`)

## Merge gate ✅

- [x] **PR #152 review passes** — no blocking comments
- [x] `npm run test -- --run` green in CI (137 tests)
- [x] `npm run lint` clean
- [x] `npm run check:contract` clean (57 frontend paths in OpenAPI spec)
- [x] `npm run check:contract:sse` clean (4 schema kinds / 4 client kinds match)
- [x] `feat/sse-event-types` merged into `development`
- [x] Root submodule bump: `7b5e1cf` on root `main`

## P3.18 — Enable checkJs for sseEvents.ts only ✅

- [x] **Goal**: catch TypeScript type errors in `src/lib/sseEvents.ts` without enabling strict mode globally across the JSX codebase
- [x] **Create** `src/lib/tsconfig.json` overlay — extends root, includes only `sseEvents.ts`, sets `checkJs: true, noResolve: false, strict: false`
- [x] **Verify**: `npx tsc -p src/lib/tsconfig.json --noEmit` → PASS
- [x] **Acceptance**: accessing `.nonexistent_field` on `SseEvent` union → TS2339; JSX files unaffected
- [x] **Files**: `src/lib/tsconfig.json` (new)
- [x] **Branch**: `feat/sse-checkjs` → `development`

## End-to-end smoke (run after both PRs merge)

See backend `tasks/todo.md` Scenarios A–D — frontend is the observation surface.

- [ ] **Scenario A** — backend killed mid-run → AgentStreamPanel switches to "Polling" badge, then surfaces error toast (not silent hang)
- [ ] **Scenario B** — cancel via second tab → BuildingSimulation and AgentStreamPanel both show terminal state
- [ ] **Scenario C** — two tabs open → both receive live events; close one → other continues
- [ ] **Scenario D** — `vc_token` expires → `auth_expiring` SSE event → `window.location.href = '/login'` fires

---

# Story-aligned integration remediation

Goal: rework the frontend to follow `01-user-stories.md` and `/Users/douglasswm/Project/AAS/VER/AGENT_ARCHITECTURE.md` as the product contract, rather than preserving accidental assumptions from earlier local adapters.

## Checklist
- [x] Replace intake payload assumptions with the structured case metadata required by US-001, US-003, and US-028
- [x] Align the pipeline visualisation and status mapping to the fixed 9-agent order from the architecture doc
- [x] Refactor the dossier adapters and sections to consume real backend shapes for evidence, facts, disputes, witnesses, statutes, precedents, arguments, deliberation, verdict, and fairness outputs
- [x] Standardize escalation, senior-inbox, amendment, and reopen UI flows around shared workflow-item fields
- [x] Bring dashboard, knowledge-base, hearing-pack, and export surfaces in line with the user stories that are actually implemented
- [x] Add schema-aware tests that lock the frontend against the story-aligned backend contract

## Review
- Intake, case list, case detail, dossier, hearing pack, dashboard, knowledge-base, escalation queue, and senior inbox were all reworked to treat the backend user-story contract as the source of truth rather than preserving older client-side assumptions.
- The frontend pipeline view now uses the architecture-defined 9-agent order and the dossier normalizers consume the backend’s real field names for evidence, facts, witnesses, statutes, precedents, arguments, deliberation, verdict, fairness, and workflow history.
- Exception handling is now truthful: reopen requests go through the backend flow, while amendment actions remain explicitly read-only until the backend exposes the missing endpoint instead of pretending local-only completion.
- Added schema-aware frontend contract coverage in `src/__tests__/backendSchemaContract.test.js`, alongside the existing path-contract guard, so the UI is checked against the committed backend OpenAPI snapshot as well as representative story-aligned payloads.
- Verification passed with `npm run lint`, `npm test`, `npm run build`, and `npm run check:contract`.
- Residual frontend gaps are now explicit instead of masked: amendment submission / approval remains blocked by missing backend support, some senior-judge actions from `US-040` are still absent, and unrelated pre-existing React `act(...)` warnings remain in `src/contexts/AuthContext.jsx` tests.
