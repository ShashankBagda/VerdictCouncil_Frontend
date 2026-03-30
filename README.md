# VerdictCouncil Frontend

React + Vite frontend for the VerdictCouncil project.

## Current UI Scope

This UI pass includes a routed, multi-page flow:
- `/intake`: Structured case intake with section-based file buckets
- `/graph`: Graph mesh orchestration view (primary simulation)
- `/pipeline`: Agent pipeline progress and judge-gating status
- `/dossier`: Case dossier, exportable report sections, and package download

Highlights:
- Consolidated 9-agent architecture across 4 layers
- Judge-controlled approval gates (per agent, per layer, or end-only)
- Single-screen graph mesh layout with all agents visible at once
- Per-agent dossier outputs, judge notes, and audit history
- Multiple seeded demo scenarios with local session persistence
- Structured intake sections for applicant, respondent, counsel, witnesses, proofs, and other participants
- Backend adapter layer for session storage, dossier generation, audit shaping, and ZIP export
- AI-friendly case folder and file nomenclature for downloadable case packages
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
