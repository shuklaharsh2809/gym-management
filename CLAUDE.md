# FitGrid: notes for coding agents

- Source of truth: `fitgrid-product-spec-and-build-prompt.md`. Follow its working agreement (§14) and definition of done (§11).
- Start every session by reading `docs/ROADMAP.md` (current status and next increment). Build on what exists; do not regenerate finished work.
- At the end of an increment, update `docs/ROADMAP.md`, plus `docs/ARCHITECTURE.md`, `docs/SECURITY.md` and `docs/DESIGN_SYSTEM.md` when affected. Add an ADR in `docs/decisions/` for consequential choices.
- Use Node 24 (`.nvmrc`) and npm. Local Postgres is on port **5433** (`npm run db:up`).
- Tenant rules: services take `(db, ctx, input)`, call `requirePermission` first and filter by `ctx.organizationId`. Never trust client IDs. Every new tenant-owned table needs `organization_id`, and branch-owned tables need a composite FK to `branches(id, organization_id)`. Add isolation tests.
- Before claiming done, run: `npm run check` and `npm run test:e2e`.
