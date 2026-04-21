# VerdictCouncil Frontend

React 18 + Vite + TailwindCSS frontend for the VerdictCouncil judicial decision-support system.

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | `brew install node` |

## Setup

```bash
cp .env.example .env    # configure API URL (default: http://127.0.0.1:8001)
npm install
npm run dev             # starts Vite dev server on http://localhost:5173
```

Requires the backend API running on port 8001 (see `VerdictCouncil_Backend`).

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://127.0.0.1:8001` | Backend API base URL |
| `VITE_BYPASS_AUTH` | `false` | Skip login in development |
| `VITE_BYPASS_AUTH_EMAIL` | `judge@verdictcouncil.sg` | Email used when auth is bypassed |
| `VITE_BYPASS_AUTH_ROLE` | `judge` | Role used when auth is bypassed |
| `VITE_DEMO_MODE` | `false` | Enable demo case loader in CaseIntake |
| `VITE_PIPELINE_STATUS_POLL_MS` | `3000` | Polling interval (ms) for pipeline status updates |

## Project Layout

```
src/
├── pages/          # Route-level components (auth/, cases/, analysis/, judge/,
│                   # escalation/, senior/, visualizations/, whatif/, Dashboard.jsx)
├── components/     # Shared UI (auth/, layout/, shared/, cases/, analysis/, escalation/, judge/)
├── contexts/       # AuthContext, APIContext, CaseContext
├── hooks/          # usePipelineStatus.js and index.js
├── lib/            # api.js (API client), authSession.js, pipelineStatus.js,
│                   # offline.js, caseWorkspace.js, escalationWorkflow.js,
│                   # hearingMode.js, backendAdapter.js, storage.js
├── data/           # Static fixtures (demoCases.js, buildingFloors.js, etc.)
└── __tests__/      # 17 Vitest test files + setup.js
```

No `src/api/` folder — the API client lives at `src/lib/api.js`.

## Routes

### Public

| Route | Page | Description |
|-------|------|-------------|
| `/login` | LoginPage | Cookie-based session login |
| `/forgot-password` | ForgotPasswordPage | Password reset request |
| `/reset-password` | ResetPasswordPage | Token-based password reset |

### Protected

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | Case stats and recent activity |
| `/cases/intake` | CaseIntake | Structured case submission with file uploads and demo case loader |
| `/cases` | CaseList | Paginated case list with status filters |
| `/case/:caseId` | CaseDetail | Individual case view — redirects to `building` by default |
| `/case/:caseId/building` | BuildingSimulation | 3D building visualization of agent pipeline |
| `/case/:caseId/graph` | GraphMesh | Graph mesh orchestration view |
| `/case/:caseId/dossier` | CaseDossier | Full analysis dossier |
| `/case/:caseId/what-if` | WhatIfMode | What-if scenario analysis |
| `/case/:caseId/hearing-pack` | HearingPack | Hearing preparation pack |
| `/escalated-cases` | EscalatedCases | Cases flagged for human review |

### Role-gated

| Route | Page | Allowed roles |
|-------|------|---------------|
| `/knowledge-base` | KnowledgeBase | `admin`, `senior_judge` |
| `/senior-inbox` | SeniorJudgeInbox | `admin`, `senior_judge` |

## Auth

Authentication uses cookie-based sessions — the backend sets a `vc_token` httpOnly cookie on login. The `AuthContext` bootstraps on load via `api.getSession()`, tracks session expiry with a 30-second warning, and exposes `login`, `logout`, `extendSession`, `hasRole`, and `hasAnyRole`. `ProtectedRoute` enforces `allowedRoles` where specified.

In development: set `VITE_BYPASS_AUTH=true` to skip the login screen and inject a fake user from `VITE_BYPASS_AUTH_EMAIL` + `VITE_BYPASS_AUTH_ROLE`.

## State Management

Pure React Context — `AuthProvider`, `APIProvider` (global loading/error/notification toasts), `CaseProvider`. No React Query, Redux, or Zustand.

## Tech Stack

- **React 18** — UI framework
- **Vite 5** — build tool and dev server
- **TailwindCSS 3** — utility-first styling
- **React Router 7** — client-side routing
- **ReactFlow** + Dagre — graph/mesh visualization
- **Framer Motion** — animations
- **Pixi.js 8** — 2D graphics (building simulation)
- **Vitest** + React Testing Library — testing

## Development

Build, lint, and test:

```bash
npm run dev           # Vite dev server
npm run build         # production build
npm run preview       # preview production build locally
npm run lint          # ESLint
npm run lint:fix      # auto-fix lint issues
npm run type-check    # TypeScript validation (tsc --noEmit)
npm test              # Vitest + React Testing Library
npm run test:watch    # watch mode
npm run check:contract # verify every /api/v1/* call exists in backend OpenAPI spec
```

## Testing

Vitest with jsdom environment and React Testing Library. Tests live in `src/__tests__/` (17 files, setup at `src/__tests__/setup.js`).

```bash
npm test              # run all tests once
npm run test:watch    # watch mode
```

## Contract Check

`scripts/check-api-contract.mjs` scans `src/lib/api.js` for every `/api/v1/*` literal and validates each one against the backend's committed `docs/openapi.json`. This ensures the frontend and backend contracts stay in sync.

```bash
npm run check:contract
```

By default the script reads `../VerdictCouncil_Backend/docs/openapi.json` (the sibling submodule). Override with:

```bash
VC_BACKEND_OPENAPI=/path/to/openapi.json npm run check:contract
```

## Branch Model

CI runs on: `main`, `development`, `release`.

Recommended workflow:
1. Work on feature branches from `development`.
2. Merge into `development` for integration testing.
3. Promote stable changes to `release`.
4. Merge production-ready code into `main`.

## Related Docs

- [`VerdictCouncil_Backend/README.md`](../VerdictCouncil_Backend/README.md) — backend setup, agents, API surface
- [`SECURITY.md`](SECURITY.md) — vulnerability reporting policy
- [Orchestration root README](../README.md) — `./dev.sh`, submodule workflow, full stack quickstart
