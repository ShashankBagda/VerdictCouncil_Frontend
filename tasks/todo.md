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
