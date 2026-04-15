# VerdictCouncil Frontend

React 18 + Vite frontend for the VerdictCouncil judicial decision-support system.

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

## Development

```bash
npm install
npm run dev
```

Build, lint, and test:

```bash
npm run lint
npm run build
npm test          # Vitest + React Testing Library
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
