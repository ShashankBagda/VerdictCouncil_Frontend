# VerdictCouncil Frontend

React + Vite frontend for the VerdictCouncil project.

## Current UI Scope

This UI pass includes a routed, multi-page flow:
- `/intake`: Appeal and dispute intake form with multi-file capture
- `/graph`: Graph mesh orchestration view (primary simulation)
- `/pipeline`: Agent pipeline progress and judge-gating status

Highlights:
- Consolidated 9-agent architecture across 4 layers
- Judge-controlled approval gates (per agent, per layer, or end-only)
- Auto-layout graph mesh visualization
- Domain-aware copy (Small Claims vs Traffic Violation)

## Development

```bash
npm install
npm run dev
```

Build and lint:

```bash
npm run lint
npm run build
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
