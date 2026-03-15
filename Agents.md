## Branching Strategy (Gitflow)

### Branch Hierarchy

```
main → release/<context>/<tag> → dev → feat/<context>
```

| Branch | Purpose | Deploys To | Merges Into |
|--------|---------|------------|-------------|
| `main` | Production-ready code | Production | — |
| `release` | Staging/QA validation | Cloud staging | `main` |
| `dev` | Integration branch | Local development | `release` |
| `feat/*` | Unit of work | — | `dev` |

### Rules

- **Never commit directly to `main`, `release`, or `dev`** — all work goes through feat branches
- **Feat branches** branch from `dev` and merge back into `dev` via PR
- **`dev` → `release`**: merge when dev is stable and ready for staging validation
- **`release` → `main`**: merge only after staging QA passes
- **Hotfixes**: branch from `main`, merge into both `main` and `dev`
- Branch naming:
  - Feat branches: `feat/<context>` (e.g., `feat/user-auth`, `feat/payment-api`)
  - Release branches: `release/<context>/<tag_version>` (e.g., `release/sprint-1/v1.0.0`)
- Resolve all merge conflicts in the feature branch before merging into `dev`
- Delete feat branches after merge

### Enforcement

- Before creating a branch: confirm you are branching from the correct parent (`dev` for features)
- Before opening a PR: confirm the target branch is correct (`dev` for features, `release` for dev, `main` for release)
- Before merging: ensure CI passes and conflicts are resolved
- If asked to push directly to `main` or `release`, **refuse and explain the gitflow process**

---

## Pull Request Template

All PRs **must** follow this structure. Use `gh pr create` with the body below.

### PR Title

`<type>(<scope>): <short description>` — under 70 characters.

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `hotfix`

### PR Body

```markdown
## Summary
<!-- 1-3 bullets: what changed and why -->
-

## Type of Change
<!-- Check one -->
- [ ] feat: new functionality
- [ ] fix: bug fix
- [ ] refactor: code restructure (no behavior change)
- [ ] docs: documentation only
- [ ] test: adding/updating tests
- [ ] chore: tooling, config, dependencies
- [ ] hotfix: urgent production fix

## Changes
<!-- List specific files/modules changed and what was done -->
-

## Testing
<!-- How was this verified? -->
- [ ] Unit tests pass
- [ ] Manual testing performed
- [ ] No regressions introduced

## Release Version
<!-- Required for release/* → main and hotfix/* → main PRs. Remove for feat/* → dev PRs. -->
- **Tag**: `vX.Y.Z`
- **Previous version**: `vX.Y.Z`

## Checklist
- [ ] Branch is up to date with target branch
- [ ] Merge conflicts resolved
- [ ] Code follows project conventions
- [ ] No secrets or credentials committed
- [ ] Self-reviewed the diff before submitting
- [ ] Version tag created (release/hotfix PRs only)
```

### Target Branch Rules

| Source | Target | When | Tagging |
|--------|--------|------|---------|
| `feat/*` | `dev` | Feature complete, tests pass | — |
| `dev` | `release/*` | Stable for staging validation | Tag with pre-release: `vX.Y.Z-rc.N` |
| `release/*` | `main` | Staging QA approved | Tag with release: `vX.Y.Z` + GitHub Release |
| `hotfix/*` | `main` + `dev` | Critical production fix | Tag with patch bump: `vX.Y.Z` + GitHub Release |

---

## Versioning & Releases

### Semantic Versioning

All versions follow [SemVer](https://semver.org/): `vMAJOR.MINOR.PATCH`

- **MAJOR**: breaking/incompatible API changes
- **MINOR**: new functionality, backwards-compatible
- **PATCH**: bug fixes, backwards-compatible

### When to Tag

| Event | Tag Format | Example |
|-------|------------|---------|
| `dev` → `release/*` branch created | `vX.Y.Z-rc.N` (pre-release) | `v1.2.0-rc.1` |
| Additional staging fixes on `release/*` | Increment rc: `vX.Y.Z-rc.N+1` | `v1.2.0-rc.2` |
| `release/*` → `main` merged | `vX.Y.Z` (stable) | `v1.2.0` |
| `hotfix/*` → `main` merged | Patch bump `vX.Y.Z` | `v1.2.1` |

### How to Tag & Release

**Pre-release tag** (when creating `release/*` branch):
```bash
git tag -a vX.Y.Z-rc.1 -m "Release candidate: <context>"
git push origin vX.Y.Z-rc.1
```

**Production release** (after `release/*` → `main` merge):
```bash
git tag -a vX.Y.Z -m "Release vX.Y.Z: <summary>"
git push origin vX.Y.Z
gh release create vX.Y.Z --title "vX.Y.Z" --generate-notes --target main
```

**Hotfix release** (after `hotfix/*` → `main` merge):
```bash
git tag -a vX.Y.Z -m "Hotfix vX.Y.Z: <summary>"
git push origin vX.Y.Z
gh release create vX.Y.Z --title "vX.Y.Z" --generate-notes --target main
```

### Rules

- **Always tag before creating a GitHub Release** — the release references the tag
- **Never reuse or move tags** — if a tag is wrong, delete it and create a new one
- **Pre-release tags (`-rc.N`) are not GitHub Releases** — they are lightweight markers for staging
- **Production tags trigger GitHub Releases** — include auto-generated release notes via `--generate-notes`
- **Check the latest tag before bumping**: `git describe --tags --abbrev=0` to determine the next version
- **Include the version in the PR body** when merging `release/*` → `main` or `hotfix/*` → `main`

---

## Workflow Orchestration

### 1. Plan Mode Default

- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately – don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy

- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop

- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done

- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)

- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes – don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing

- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests – then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

---

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

---

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.

---

## gstack

Use `/browse` from gstack for **all web browsing** — never use `mcp__claude-in-chrome__*` tools directly.

Available skills: `/plan-ceo-review`, `/plan-eng-review`, `/review`, `/ship`, `/browse`, `/qa`, `/setup-browser-cookies`, `/retro`

If gstack skills aren't working, run `cd .claude/skills/gstack && ./setup` to build the binary and register skills.