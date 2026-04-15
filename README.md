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

## Routes

| Route | Page | Description |
|-------|------|-------------|
| `/login` | LoginPage | JWT authentication |
| `/dashboard` | Dashboard | Case stats and recent activity |
| `/intake` | CaseIntake | Structured case submission with file uploads and demo case loader |
| `/cases` | CaseList | Paginated case list with status filters |
| `/cases/:id` | CaseDetail | Individual case view with pipeline status |
| `/cases/:id/dossier` | CaseDossier | Full analysis dossier with JSON export |
| `/knowledge-base` | KnowledgeBase | Per-judge document management, vector search, and upload |
| `/escalated-cases` | EscalatedCases | Cases flagged for human review |
| `/building` | BuildingSimulation | 3D building visualization of agent pipeline |
| `/graph` | GraphMesh | Graph mesh orchestration view |
| `/whatif` | WhatIfMode | What-if scenario analysis |

## Tech Stack

- **React 18** — UI framework
- **Vite 5** — build tool and dev server
- **TailwindCSS 3** — utility-first styling
- **React Router 7** — client-side routing
- **ReactFlow** + Dagre — graph/mesh visualization
- **Framer Motion** — animations
- **Pixi.js** — 2D graphics (building simulation)
- **Vitest** + React Testing Library — testing

## Development

Build, lint, and test:

```bash
npm run lint          # ESLint
npm run lint:fix      # auto-fix lint issues
npm run type-check    # TypeScript validation
npm run build         # production build
npm test              # Vitest + React Testing Library
npm run test:watch    # watch mode
```

## Testing

Uses Vitest with jsdom environment and React Testing Library. Tests live in `src/__tests__/`.

```bash
npm test              # run all tests once
npm run test:watch    # watch mode
```

## Branch Model

CI is configured to run on:
- `main`
- `development`
- `release`

Recommended workflow:
1. Work on feature branches from `development`.
2. Merge into `development` for integration testing.
3. Promote stable changes to `release`.
4. Merge production-ready code into `main`.
