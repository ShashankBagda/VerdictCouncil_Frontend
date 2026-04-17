# VerdictCouncil Frontend Phase Plan

## Scope

This plan covers only `VerdictCouncil_Frontend`.

Rules for execution:
- Modify frontend code only.
- Do not patch backend contracts as part of implementation.
- Where backend endpoints are missing or mismatched, add frontend adapters, feature flags, placeholder states, and clear integration seams instead of changing backend code.
- Execute in phases with a working app at the end of each phase.

## Current Audit

### Already present but incomplete

- `VER-14` Partial
  - `src/lib/api.js` already centralizes most HTTP calls, includes `credentials: 'include'`, and redirects on `401`.
  - `src/contexts/AuthContext.jsx` still relies on local token persistence and mocked session expiry instead of a backend-driven session model.
  - `src/lib/backendAdapter.js` still contains legacy local-session and package-building logic and must be reduced or isolated.

- `VER-15` Partial
  - `src/pages/cases/CaseIntake.jsx` already calls `createCase` and `uploadDocuments`.
  - Missing robust field-level validation handling, demo-mode split, per-file error states, and a clean redirect into the real pipeline/status flow.

- `VER-16` Partial
  - `src/pages/visualizations/GraphMesh.jsx` and `src/pages/visualizations/BuildingSimulation.jsx` already poll status.
  - Polling is duplicated, hardcoded, and not normalized to the backend enum/shape expected by the ticket.

- `VER-41` Partial
  - `src/pages/auth/LoginPage.jsx`, `src/components/shared/SessionWarning.jsx`, protected routes, and logout wiring already exist.
  - Session timing is mocked client-side, role/session bootstrap is weak, and route guarding is only auth/not role aware.

- `VER-128` Stub
  - `src/pages/judge/HearingPack.jsx` exists, but hearing mode and note sync are not implemented.

- `VER-135` Partial
  - `src/pages/senior/SeniorJudgeInbox.jsx` exists.
  - It does not yet match the Linear requirements: no nav badge, no right-pane detail workflow, no target judge selection for reassign, and no role gate.

### Not implemented or not wired to routes

- `VER-17` Evidence Gaps + Disputed Facts UI
- `VER-18` Live precedent search panel UI
- `VER-19` Knowledge base status indicator
- `VER-20` Fairness audit checklist UI
- `VER-21` Escalated cases inbox + actions UI
- `VER-22` Modify/Reject decision form
- `VER-117` Add Documents UI + version history list
- `VER-130` Amend decision UI + history view
- `VER-132` Reopen request UI + senior judge approval inbox

### Structural gaps in current frontend

- No stable feature-oriented API layer; `api.js` is broad but not normalized by domain.
- No shared polling hook for case pipeline or inbox counts.
- No route-level role guard for `senior_judge` or admin-only views.
- `CaseDetail` only exposes current tabs and has no expansion points for the new ticket set.
- Some pages still use mismatched assumptions like `err.response?.data` even though `api.js` throws `APIError`.
- Existing code mixes “demo app” behavior and “real API” behavior in the same components.

## Phase Order

The order below follows frontend dependency pressure and minimizes rework.

## Phase 1: Platform Hardening

Tickets:
- `VER-14`
- `VER-41`

Goal:
- Establish one reliable frontend integration layer before adding new feature pages.

Implementation:
- Replace ad hoc auth bootstrap with a real session bootstrap flow in `AuthContext`.
- Keep `src/lib/api.js` as the single transport layer, but normalize all thrown errors to `APIError`.
- Remove direct dependency on local auth token state except for explicit dev bypass mode.
- Add route guards for:
  - authenticated user
  - role-restricted pages
- Make session warning read from a backend session payload if available; fall back cleanly when unavailable.
- Keep `backendAdapter.js` only for local packaging or demo artifacts that are still needed by existing pages; do not let it remain the auth/data source.

Exit criteria:
- Login, logout, protected routes, and `401` redirect flow are consistent.
- Senior/admin pages can be role-gated from frontend state.
- New features can depend on a stable API and auth surface.

## Phase 2: Intake And Real Pipeline State

Tickets:
- `VER-15`
- `VER-16`

Goal:
- Turn case intake and pipeline monitoring into the primary real-app flow.

Implementation:
- Refactor `src/pages/cases/CaseIntake.jsx` to:
  - support real create/upload flow,
  - preserve demo mode behind `VITE_DEMO_MODE`,
  - track per-file success/error/progress explicitly.
- Introduce a shared polling hook for `GET /cases/{id}/status`.
- Reuse that hook in:
  - `src/pages/visualizations/GraphMesh.jsx`
  - `src/pages/visualizations/BuildingSimulation.jsx`
  - any case list/detail status surfaces
- Stop polling on terminal states and on unmount.
- Normalize backend agent state values into one frontend model.

Exit criteria:
- A new case can be created from the intake screen and redirect into a real status-driven case view.
- Pipeline polling is centralized and configurable.

## Phase 3: Core Decision Workspace

Tickets:
- `VER-22`
- `VER-117`

Goal:
- Make the case detail workflow usable for day-to-day judge actions.

Implementation:
- Extend `CaseDetail` to support:
  - add-documents workflow,
  - version history list,
  - decision form state surfaces.
- Update the graph/verdict area to support Accept / Modify / Reject with required-reason enforcement.
- Build shared form primitives for:
  - inline API error display,
  - pending/success/error action states,
  - file upload list items.
- Ensure new documents and decision state refresh the relevant case views after mutation.

Exit criteria:
- Judges can add documents and record Accept / Modify / Reject decisions from the case workspace.

## Phase 4: Analysis Surfaces

Tickets:
- `VER-17`
- `VER-18`
- `VER-19`
- `VER-20`

Goal:
- Fill the missing analytical tabs around a case.

Implementation:
- Add analysis subviews/components for:
  - evidence gaps grouped by burden party,
  - disputed facts modal/action flow,
  - live precedent search with source/fallback labels,
  - knowledge base status chip and detail surface,
  - fairness audit checklist with acknowledgement actions.
- Prefer integrating these into the existing dossier/case-detail shell rather than creating disconnected standalone pages unless routing makes that cleaner.
- Create a consistent “analysis panel” pattern so these features do not fragment the UX.

Exit criteria:
- The case analysis experience exposes the missing backend-powered decision-support surfaces without page-level inconsistency.

## Phase 5: Exception And Escalation Workflows

Tickets:
- `VER-21`
- `VER-130`
- `VER-132`
- `VER-135`

Goal:
- Deliver the advanced human-review and escalation flows.

Implementation:
- Build escalated cases inbox UI and action flows.
- Add amend-decision modal and amendment history chain.
- Add reopen-request UI on closed cases.
- Rework `SeniorJudgeInbox` to match ticket scope:
  - ranked list,
  - filters,
  - right-pane detail context,
  - approve/reject/reassign/request-info,
  - reason and reassignment requirements,
  - nav badge count,
  - senior judge role gating.
- Keep backend mismatches isolated behind frontend adapters until the BE tickets land.

Exit criteria:
- All special review workflows are available in the frontend behind clean route and role controls.

## Phase 6: Hearing Mode

Tickets:
- `VER-128`

Goal:
- Add the offline-resilient hearing notes experience on top of the base hearing pack.

Implementation:
- Build hearing mode entry/exit flow inside `src/pages/judge/HearingPack.jsx`.
- Add local note queue storage using the frontend repo only.
- Sync queued notes opportunistically when online.
- Lock notes when hearing mode ends.
- Surface probative notes back into the decision workflow if the backend payload supports it; otherwise keep the UI seam ready.

Exit criteria:
- Hearing notes survive temporary offline periods and are read-only after lock.

## Recommended Execution Sequence

1. Phase 1
2. Phase 2
3. Phase 3
4. Phase 4
5. Phase 5
6. Phase 6

Reason:
- Phases 1 and 2 remove the largest integration uncertainty.
- Phase 3 turns the app into a workable case-processing shell.
- Phases 4 and 5 add specialist surfaces on top of a stable shell.
- Phase 6 is isolated and can ship last without blocking the broader backlog.

## Ticket Matrix

| Ticket | Status in repo | Planned phase | Notes |
| --- | --- | --- | --- |
| VER-14 | Partial | 1 | Existing `api.js` is the right base, auth/session model is not complete |
| VER-41 | Partial | 1 | Login/logout/warning exist, but session model is mocked |
| VER-15 | Partial | 2 | Real create/upload exists, needs production-grade state handling |
| VER-16 | Partial | 2 | Polling exists but is duplicated and hardcoded |
| VER-22 | Missing/partial | 3 | Existing graph workspace does not implement full decision form |
| VER-117 | Missing | 3 | Needs add-documents workflow in case detail |
| VER-17 | Missing | 4 | No dedicated evidence gaps/dispute UI found |
| VER-18 | Missing | 4 | Search API exists, no UI found |
| VER-19 | Missing/partial | 4 | Admin health exists; no case-level KB status chip/panel |
| VER-20 | Missing | 4 | Fairness endpoint exists, no checklist UI found |
| VER-21 | Missing | 5 | No escalated cases inbox UI found |
| VER-130 | Missing | 5 | No amendment form/history UI found |
| VER-132 | Missing | 5 | No reopen request UI found |
| VER-135 | Partial | 5 | Existing inbox is not feature-complete |
| VER-128 | Stub | 6 | Hearing pack exists as placeholder only |

## Constraints To Respect During Implementation

- Do not edit `VerdictCouncil_Backend`.
- If an endpoint contract is missing, create a frontend adapter seam and mark the integration point clearly.
- Keep feature work incremental; each phase should end with:
  - lint passing,
  - build passing,
  - routes still navigable,
  - no broken auth flow.

## Immediate Next Phase

Start with Phase 1.

Concrete first tasks:
- audit every use of `storage.getAuthToken()` and remove auth dependence on it,
- normalize `api.js` and consumer error handling,
- add frontend role guards,
- rework `LoginPage`, `AuthContext`, and `RootLayout` to support the real session/auth foundation needed by the remaining backlog.
