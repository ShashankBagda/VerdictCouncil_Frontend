# VerdictCouncil Frontend

React + Vite frontend for the VerdictCouncil project.

## Current UI Scope

This UI pass includes a routed, multi-page flow:
- `/intake`: Appeal and dispute intake form
- `/building`: One-floor-at-a-time courtroom simulation with categorized agent offices
- `/pipeline`: Agent orchestration timeline and legal-path context

Highlights:
- Floors divided by v4 agent categories (A-01 to A-18 + oversight)
- Pixel NPC sprites with active thought-bubble animation
- Domain-aware pipeline (Small Claims vs Traffic Violation)

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
