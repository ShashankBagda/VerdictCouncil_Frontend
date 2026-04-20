# Pixel Courtroom Phased Git Workflow

## Base Branch

- Base all phase branches from development.
- Keep each phase in an isolated branch and merge via PR.

## Branch Naming Standard

Use this format:

- feat/pixel-courtroom-phase-<n>-<scope>-frontend

Examples:

- feat/pixel-courtroom-phase-0-observability-frontend
- feat/pixel-courtroom-phase-1-room-schema-frontend
- feat/pixel-courtroom-phase-2-stream-normalizer-frontend
- feat/pixel-courtroom-phase-3-map-communication-frontend
- feat/pixel-courtroom-phase-5-qa-polish-frontend

## Commit Message Standard

Use Conventional Commits with clear phase tags:

- feat(building): phase-0 add SSE counters and unsupported payload banner
- feat(building): phase-0 add map telemetry for room NPC counts
- chore(workflow): add phased git branch and commit convention

## Per-Phase Checklist

1. Pull latest development.
2. Create phase branch from development.
3. Implement only the scoped phase changes.
4. Run checks (lint/tests relevant to touched files).
5. Commit in small logical units.
6. Push branch and open PR into development.
7. Merge only after review and green checks.

## Guardrails

- No direct commits to development.
- No force-push after review starts unless coordinated.
- Keep backend and frontend phase branches separate unless a coordinated cross-repo release is required.
