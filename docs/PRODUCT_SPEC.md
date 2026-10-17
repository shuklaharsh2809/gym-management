# Product specification

The authoritative product and architecture baseline is
[`../fitgrid-product-spec-and-build-prompt.md`](../fitgrid-product-spec-and-build-prompt.md)
(FitGrid v1.0 specification). It is kept at the repository root, unchanged, as the
project's source of truth.

Do not copy or paraphrase it here; that would create two versions that drift apart.
Record decisions that refine or deviate from it in [`decisions/`](decisions/) and
reflect delivery status in [`ROADMAP.md`](ROADMAP.md).

## Clarifications made during implementation

| Topic                       | Decision                                                        | Record                                                   |
| --------------------------- | --------------------------------------------------------------- | -------------------------------------------------------- |
| Authentication provider     | Better Auth (self-hosted, email + password)                     | [ADR 0002](decisions/0002-authentication-better-auth.md) |
| Branch access model         | `branchScope` on membership + `BranchAssignment` rows           | [ADR 0003](decisions/0003-tenancy-and-authorization.md)  |
| Roles & permissions storage | Fixed role → permission map in code for now                     | [ADR 0004](decisions/0004-rbac-in-code.md)               |
| Primary action colour       | Emerald 700 `#047857`, not `#10B981`, for white-on-emerald text | [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md#colour)              |
| Supported markets           | Curated list of 10 countries at onboarding                      | [`src/lib/markets.ts`](../src/lib/markets.ts)            |
