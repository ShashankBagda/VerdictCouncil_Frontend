# Frontend Asset License Policy

Date: 2026-04-20
Scope: VerdictCouncil_Frontend

## Allowed License Classes
- CC0 (preferred)
- CC-BY (with attribution)
- OGA-BY (with attribution)
- Custom-commercial-safe (requires explicit source statement and review note)

## Disallowed License Classes
- Non-commercial only
- Unknown or unverifiable provenance
- GPL art packs (unless legal approval is documented)

## Intake Workflow
1. Download assets from original source page only.
2. Capture source URL, author, license, and date in public/licenses/ASSET_MANIFEST.json.
3. Add required attribution text to public/licenses/ATTRIBUTION.md.
4. Set usage_status to approved, approved-with-review, blocked, or blocked-until-verified.

## Runtime Rule
No blocked or blocked-until-verified asset path may be introduced into runtime imports.

## Existing Remediation
- public/Sprout Lands - Sprites - Basic pack is blocked due to non-commercial terms.
- public/pixel-assets/l1 remains blocked-until-verified and must be replaced or verified before release.
