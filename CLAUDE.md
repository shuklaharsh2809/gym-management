# FitGrid: notes for coding agents

- Source of truth: `fitgrid-product-spec-and-build-prompt.md`. Follow its working agreement (§14) and definition of done (§11).
- Start by reading `docs/ROADMAP.md` (status, limitations, next steps) and `docs/ARCHITECTURE.md` (conventions). Extend what exists; don't regenerate it.
- At the end of an increment update `docs/ROADMAP.md` and any affected docs (ARCHITECTURE, SECURITY, DESIGN_SYSTEM, OPERATIONS); add an ADR in `docs/decisions/` for consequential choices.
- Node 24 (`.nvmrc`) and npm. Local Postgres on port **5433** (`npm run db:up`).
- Tenant rules: services take `(db, ctx, input)`, call `requirePermission` first and filter by `ctx.organizationId` and branch scope. Never trust client IDs. New tenant tables need `organization_id`; required references use composite FKs to `(id, organization_id)`; optional references use the `fg_assert_same_organization` trigger. Add isolation tests.
- Money is integer minor units; calendar dates are `YYYY-MM-DD`; compute "today" in the branch time zone.
- Migrations are additive. Don't use `prisma migrate reset` without explicit human approval.
- Before claiming done: `npm run check` and `npm run test:e2e`.
