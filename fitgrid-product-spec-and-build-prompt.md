# FitGrid --- Product Requirements, Architecture & AI Build Instructions

**Document type:** Product specification and implementation brief\
**Product:** FitGrid\
**Version:** 1.0\
**Status:** Initial implementation baseline\
**Target market:** India and international markets\
**Primary stack:** Next.js, React, TypeScript, PostgreSQL, Prisma\
**Product direction:** Premium light UI with navy and emerald accents\
**Architecture:** Modular monolith\
**Delivery approach:** Full product vision, delivered in small, tested
phases

------------------------------------------------------------------------

## 1. Instructions for the developer or AI coding agent

You are the technical lead and implementation engineer for **FitGrid**,
a multi-tenant gym and fitness-business management SaaS.

Use this document as the product and architecture baseline. Build a
real, maintainable application---not a static mockup or a collection of
disconnected CRUD screens.

### Required working method

1.  **Inspect before changing.** If a repository already exists, inspect
    its structure, package manager, dependencies, scripts, conventions,
    current implementation and Git status before editing. Preserve
    useful existing work.
2.  **Plan the smallest useful increment.** Do not attempt to implement
    the entire platform in one giant change. Start with the repository
    foundation and secure multi-tenant core, then implement end-to-end
    vertical slices.
3.  **Use deterministic commands.** Prefer the package manager already
    established by the repository. Do not switch package managers
    without a clear reason.
4.  **Validate every change.** Run relevant linting, type checks, tests
    and builds. Do not claim checks passed unless they were actually run
    and passed.
5.  **Keep the application runnable.** Each milestone should leave the
    project in a coherent, buildable state.
6.  **Use realistic data only for demos.** Clearly label seeded/demo
    data. Do not represent simulated integrations as live integrations.
7.  **Ask only blocking questions.** Make sensible, documented defaults
    for reversible decisions. Ask before irreversible actions, paid
    services, production data changes or external side effects.
8.  **Do not silently expand scope.** Maintain a short list of completed
    work, remaining work, assumptions and risks.
9.  **Do not stop at attractive UI.** Core features must persist data,
    enforce server-side authorization and have meaningful success,
    loading, empty and error states.
10. **Never expose secrets.** Use environment variables and a documented
    `.env.example` containing placeholders only.

### First response and first implementation task

If no code repository has been provided, produce a concise
implementation plan and initialize the project only when the user
authorizes or requests code changes. If a repository is available,
inspect it first.

The first implementation milestone is:

-   establish the application foundation and design tokens;
-   create the initial database schema for users, organizations,
    organization memberships, branches and branch assignments;
-   implement authentication integration using a selected, documented
    provider;
-   implement server-side tenant and branch authorization;
-   add seeded demo organizations and branches;
-   write tests proving that tenant boundaries cannot be bypassed;
-   create the initial application shell and organization onboarding
    flow.

Do not build all feature modules before the tenant model and
authorization tests are working.

------------------------------------------------------------------------

## 2. Product vision

FitGrid gives fitness businesses one place to manage members,
memberships, payments, attendance, staff, classes, equipment, inventory
and business performance across multiple locations.

**Product tagline:** *Every location. One connected business.*

### Target customers

-   Independent gyms
-   Multi-branch gym chains
-   Boutique fitness studios
-   Personal training businesses
-   Franchise operators

### Product principles

1.  Organization-first and branch-aware architecture.
2.  Secure tenant isolation and least-privilege access.
3.  Complete business workflows, not disconnected CRUD pages.
4.  Fast, clear workflows for front-desk staff.
5.  Consistent design system and accessible interactions.
6.  International readiness: locale, currency, timezone and configurable
    tax/payment integrations.
7.  Traceable financial and operational history.
8.  Incremental delivery with automated verification.

### Product scope

The long-term product includes:

-   Platform and SaaS administration
-   Organizations and branches
-   Users, roles and permissions
-   Members and member profiles
-   Membership plans and purchased memberships
-   Invoices, payments, refunds and expenses
-   Attendance and front-desk check-in
-   Leads, sales pipeline and follow-ups
-   Staff, trainers, shifts and leave
-   Classes, bookings, rooms and personal training
-   Equipment, maintenance and asset transfers
-   Inventory, suppliers, purchasing and point of sale
-   Reports and analytics
-   Notifications and scheduled jobs
-   Organization settings, integrations and audit logs
-   Future member portal and AI-assisted analytics

Build this in phases. The initial release must prioritize the secure
multi-tenant foundation and a complete core workflow.

------------------------------------------------------------------------

## 3. Multi-tenant domain model --- non-negotiable

FitGrid is a multi-tenant SaaS. The terms below have distinct meanings:

-   **Platform:** FitGrid itself and its platform administrators.
-   **Organization / tenant:** a customer business that owns its data.
-   **Branch:** a physical or operational location within an
    organization.
-   **User:** a global identity that may belong to more than one
    organization.
-   **Organization membership:** a user's relationship, status and role
    within an organization.
-   **Branch assignment:** a user's access and responsibilities at a
    specific branch.
-   **Gym membership:** a member's purchased access agreement with a
    gym. This is separate from the organization's SaaS subscription to
    FitGrid.

A user may have different roles in different organizations. Never assume
that a global user account is itself an employee or a member.

### Tenant rules

1.  Every tenant-owned record must have an enforceable organization
    relationship, directly or through a rigorously validated parent
    relationship.
2.  Branch-owned records must reference a branch belonging to the same
    organization.
3.  A user cannot access another organization's records by changing a
    URL, body field, query parameter or record ID.
4.  Never trust a client-provided `organizationId` or `branchId` as
    proof of authorization.
5.  Resolve organization membership and branch scope from authenticated
    server-side data.
6.  Every server action, route handler, background job and webhook must
    apply the appropriate authorization or trusted service identity
    checks.
7.  Organization-wide access and branch-restricted access must be
    distinct.
8.  Cross-branch member access must be explicit and configurable.
9.  Deactivating an organization, branch, member or employee must not
    silently erase financial or audit history.
10. Tenant and branch boundaries must be covered by automated tests.

### Initial roles

-   Platform administrator
-   Organization owner
-   Organization administrator
-   Branch manager
-   Receptionist
-   Trainer
-   Accountant
-   Equipment technician

Implement role-based access control (RBAC) with granular permissions and
organization/branch scope. Example permissions include `members.read`,
`members.create`, `members.update`, `members.export`,
`memberships.manage`, `payments.collect`, `payments.refund`,
`reports.financial.read`, `branches.manage` and
`equipment.maintenance.manage`.

Do not rely on hiding UI controls for security. Authorization must be
enforced on the server.

### Initial database strategy

Use one PostgreSQL database with shared tables and explicit organization
ownership. Use UUID primary keys unless the existing codebase has a
justified convention. Use foreign keys, unique constraints, check
constraints and indexes where appropriate. Consider composite foreign
keys to prevent relationships across tenants. PostgreSQL row-level
security may be added as defense in depth if it is safely compatible
with the application's connection and transaction model; it does not
replace application authorization.

Do not introduce microservices or separate databases per tenant in the
initial version.

------------------------------------------------------------------------

## 4. Functional requirements

### 4.1 Platform and SaaS administration

-   Manage organizations and their status.
-   Manage platform plans, feature entitlements and usage limits.
-   Inspect subscription state and platform-level audit events.
-   Protect platform administration with a separate authorization
    boundary.
-   Keep platform-level access exceptional, logged and auditable.

### 4.2 Organizations and branches

-   Create an organization during onboarding.
-   Configure business name, legal details, branding, country, timezone,
    default currency and locale.
-   Create, edit and deactivate branches.
-   Store branch address, contact details, opening hours, timezone and
    local settings.
-   Assign organization users and branch staff.
-   Configure plan availability and branch-level operational settings.
-   Provide branch-level and consolidated organization reporting.
-   Support member and equipment transfers with traceable history.

### 4.3 Members

-   Member directory with search, filters, pagination and sorting.
-   Create and edit member profiles.
-   Contact details, emergency contact and member ID.
-   Current and historical memberships.
-   Invoice and payment history.
-   Attendance and booking history.
-   Assigned trainer and permitted fitness records.
-   Notes, documents, waivers and consent records.
-   Tags, CSV import/export and duplicate detection.
-   Lifecycle states such as lead, trial, active, frozen, expired and
    cancelled where appropriate.
-   Restrict sensitive health/fitness information to authorized users.

A member belongs to an organization. Branch association should be
modeled according to the actual business relationship; do not assume a
person can belong to only one branch forever.

### 4.4 Membership plans and purchased memberships

Plans define the product; purchased memberships define an individual
member's agreement and history.

Support:

-   Monthly, quarterly, half-yearly, annual and custom-duration plans.
-   Day passes, class packages and personal training packages.
-   Joining fees, discounts, coupons and configurable tax treatment.
-   Start date, expiry date, renewal rules and grace periods.
-   Freeze, resume, extend, upgrade, downgrade, renewal and
    cancellation.
-   Branch eligibility and cross-branch access policy.
-   Renewal reminders and membership history.

Define legal state transitions. Avoid overwriting historical memberships
during renewals or plan changes.

### 4.5 Billing and finance

-   Invoices with immutable line-item snapshots.
-   Payments, payment attempts, partial payments and outstanding
    balances.
-   Payment methods configurable by market: cash, bank transfer, UPI,
    cards and online payments.
-   Refunds, adjustments and reconciliation.
-   Discounts, tax details and receipts.
-   Recurring billing and failed-payment handling where supported.
-   Operating expenses, categories, suppliers and receipt attachments.
-   Daily collection and branch financial reports.
-   Payment provider integration through a provider adapter, initially
    in sandbox mode.

Financial requirements:

-   Never use JavaScript floating-point numbers for monetary arithmetic.
-   Use integer minor units or a suitable exact decimal representation,
    with currency-specific precision.
-   Never trust totals calculated by the browser.
-   Verify provider webhooks cryptographically.
-   Make payment mutations and webhook handling idempotent.
-   Use database transactions for related financial updates.
-   Preserve issued invoice and payment history.
-   Clearly distinguish invoice value, collected amount, refunds,
    outstanding balances and recognized revenue.

### 4.6 Attendance and front desk

-   Search by member name, phone, member ID or QR code.
-   Check membership eligibility on the server at check-in time.
-   Record check-in and optional check-out.
-   Prevent duplicate check-ins according to defined policy.
-   Handle expired, frozen, cancelled or otherwise ineligible
    memberships clearly.
-   Enforce branch access policy.
-   Provide attendance history and daily visitor reports.
-   Support future integrations with QR scanners, RFID, biometric and
    physical access-control hardware.

Start with a browser-based check-in flow. Hardware integration is a
later phase.

### 4.7 Leads and CRM

-   Capture walk-ins, website leads, referrals, calls and campaign
    leads.
-   Pipeline stages: New, Contacted, Trial Booked, Trial Completed,
    Negotiation, Won and Lost.
-   Assign lead owner and follow-up date.
-   Store notes and contact history.
-   Schedule reminders.
-   Track lost reasons, lead source and conversion.
-   Convert a lead into a member without duplicate records and while
    preserving sales history.

### 4.8 Staff and trainers

-   Employee profiles, roles, employment status and documents.
-   Staff-to-branch assignments.
-   Trainer specializations, assigned members and session history.
-   Shifts, attendance, leave requests and schedules.
-   Compensation, commissions, incentives and reimbursement summaries.
-   Restrict salary and employment information to authorized roles.
-   Treat advanced statutory payroll as a later, market-specific
    capability.

### 4.9 Classes and bookings

-   Class types, recurring schedules, rooms and capacity.
-   Trainer availability and conflict detection.
-   Member bookings, cancellations and waitlists.
-   Attendance and no-show tracking.
-   Personal training appointments and session packages.
-   Calendar views by day, week, trainer, room and branch.
-   Notifications and reminders.
-   Prevent race conditions for the last available booking slot.
-   Define how paid session credits are consumed and restored.

### 4.10 Equipment and maintenance

-   Unique equipment asset ID and optional QR label.
-   Category, brand, model, serial number and purchase date.
-   Cost, supplier, warranty and location.
-   Status: Active, Under Maintenance, Out of Service or Retired.
-   Preventive maintenance schedules and overdue reminders.
-   Fault reports, priority, technician assignment and work orders.
-   Service history, repair costs and downtime.
-   Branch transfers with an audit trail.
-   Later: depreciation and asset valuation.

### 4.11 Inventory and point of sale

-   Products, categories, SKU/barcode, variants and pricing.
-   Stock levels and low-stock alerts.
-   Suppliers and purchase orders.
-   Sales, returns, damaged goods and stock adjustments.
-   Branch transfers and inventory history.
-   Track stock movements rather than merely overwriting quantities.
-   Generate itemized receipts and preserve financial relationships.

### 4.12 Reports and analytics

-   Revenue, collections, refunds and outstanding balances.
-   Membership growth, renewals, cancellations and churn.
-   Attendance by day, hour, member and branch.
-   Lead conversion and sales performance.
-   Trainer utilization, class occupancy and no-shows.
-   Equipment maintenance cost and downtime.
-   Expenses and inventory valuation.
-   CSV exports and saved filters.
-   Consistent date-range, timezone and branch filtering.
-   Reuse shared server-side metric definitions across dashboard cards,
    charts and reports.

### 4.13 Notifications, jobs and integrations

-   Membership renewal and payment reminders.
-   Booking confirmations and reminders.
-   Equipment service reminders.
-   Staff invitations and account notifications.
-   Email and in-app notifications initially; messaging integrations
    later.
-   Background jobs with retry policy, idempotency and delivery logs.
-   Webhook endpoints and delivery history where needed.
-   Never expose provider secrets to the browser.

### 4.14 Future expansion

Keep these out of the initial critical path unless specifically
prioritized:

-   Member self-service portal.
-   Fitness progress and workout tracking.
-   Advanced payroll.
-   Hardware access-control integration.
-   Advanced franchise analytics.
-   AI assistant for authorized business data queries.

------------------------------------------------------------------------

## 5. Sitemap and routes

### Public routes

-   `/` --- product landing page
-   `/features`
-   `/solutions/gyms`
-   `/solutions/fitness-chains`
-   `/pricing`
-   `/contact`
-   `/privacy`
-   `/terms`
-   `/login`
-   `/register`
-   `/forgot-password`
-   `/invite/[token]`

### Authenticated organization application

-   `/app` --- dashboard
-   `/app/members`
-   `/app/members/[memberId]`
-   `/app/memberships`
-   `/app/plans`
-   `/app/finance/payments`
-   `/app/finance/invoices`
-   `/app/finance/expenses`
-   `/app/attendance`
-   `/app/front-desk`
-   `/app/leads`
-   `/app/staff`
-   `/app/trainers`
-   `/app/shifts`
-   `/app/leave`
-   `/app/classes`
-   `/app/bookings`
-   `/app/equipment`
-   `/app/maintenance`
-   `/app/inventory`
-   `/app/suppliers`
-   `/app/reports`
-   `/app/organization`
-   `/app/organization/branches`
-   `/app/organization/team`
-   `/app/settings`
-   `/app/settings/integrations`
-   `/app/settings/audit-logs`

### Platform administration

-   `/platform/organizations`
-   `/platform/organizations/[organizationId]`
-   `/platform/subscriptions`
-   `/platform/plans`
-   `/platform/usage`
-   `/platform/audit-logs`
-   `/platform/settings`

Protect routes and data on the server. A route being hidden from
navigation does not make it secure. Use stable internal IDs, validate
route parameters and handle revoked membership or branch access
intentionally.

------------------------------------------------------------------------

## 6. Design system and UX requirements

### Visual direction

-   Premium light theme.
-   Midnight navy for brand and navigation.
-   Emerald for primary actions and positive accents.
-   White surfaces and light neutral backgrounds.
-   Clear typography, restrained shadows and consistent spacing.
-   Desktop-first administration with responsive tablet and mobile
    workflows.
-   Accessibility target: WCAG 2.2 AA where practical, including
    contrast and keyboard interaction.

### Initial color tokens

-   Primary navy: `#172B4D`
-   Primary emerald: `#10B981`
-   Deep emerald: `#064E3B`
-   Canvas: `#F8FAFC`
-   Surface: `#FFFFFF`
-   Primary text: `#0F172A`
-   Secondary text: `#64748B`
-   Border: `#E2E8F0`
-   Muted surface: `#F1F5F9`
-   Success: `#15803D`
-   Warning: `#B45309`
-   Danger: `#B91C1C`
-   Info: `#1D4ED8`

Validate actual color combinations for contrast before treating them as
final. Use semantic tokens instead of scattering literal colors through
components.

### Typography and layout

-   Initial typeface: Inter with system fallback.
-   4 px spacing base.
-   Sidebar: approximately 248 px expanded and 72 px collapsed.
-   Topbar: approximately 64 px.
-   Desktop content padding: 24--32 px.
-   Standard card padding: 20--24 px.
-   Controls: approximately 40--44 px high.
-   Small radius: 6 px; standard radius: 10 px; large radius: 14 px.

These are initial tokens, to be refined after testing real screens.

### Component inventory

-   Application shell, sidebar, topbar, breadcrumbs and page headers.
-   Buttons, text inputs, selects, comboboxes, checkboxes, switches and
    date pickers.
-   Data tables, sorting, pagination, filter bars and bulk actions.
-   Cards, metric cards, charts and timelines.
-   Status badges for memberships, payments and equipment.
-   Dialogs, drawers, dropdown menus and command palette.
-   Form validation, toasts, alerts and confirmation dialogs.
-   Loading skeletons, empty states, error states and retry actions.
-   Member profile header, branch selector and membership summary.

Use Shadcn UI and Radix primitives where helpful, then apply FitGrid's
tokens and patterns. Do not create a separate visual implementation for
every page when a shared component can serve the use case.

Every important screen must handle loading, empty, error, success,
validation, disabled and permission-restricted states. Test keyboard
behavior and responsive layouts.

------------------------------------------------------------------------

## 7. Technical architecture

### Stack

-   Next.js App Router
-   React and TypeScript with strict mode
-   Tailwind CSS
-   Shadcn UI and Radix primitives
-   PostgreSQL
-   Prisma ORM
-   Zod for server-boundary validation
-   React Hook Form for complex forms
-   Auth.js or a suitable managed authentication provider, selected
    after checking current integration requirements
-   TanStack Table for complex data tables
-   Recharts for analytics
-   Vitest for unit/integration tests
-   Playwright for end-to-end tests

Use TanStack Query only where client-side server-state behavior
justifies it. Prefer a modular monolith over microservices.

### Application architecture

-   Server Components for appropriate initial data rendering.
-   Client Components only where interactivity requires browser state.
-   Server Actions for suitable first-party mutations.
-   Route Handlers for HTTP APIs, provider webhooks and external
    integrations.
-   Domain services for business rules.
-   Repositories for database access.
-   Centralized authentication and authorization utilities.
-   Background job processing for scheduled work.
-   Shared validation schemas and consistent error handling.

Server Actions and Route Handlers are public trust boundaries:
authenticate, validate and authorize each operation independently.

### Suggested repository layout

``` text
fitgrid/
  prisma/
    schema.prisma
    migrations/
    seed.ts
  public/
  src/
    app/
      (marketing)/
      (auth)/
      (dashboard)/
      platform/
      api/
    components/
      ui/
      shared/
      layouts/
      business/
    modules/
      identity/
      organizations/
      branches/
      members/
      memberships/
      billing/
      attendance/
      crm/
      workforce/
      scheduling/
      equipment/
      inventory/
      reporting/
      notifications/
      audit/
    server/
      auth/
      authorization/
      database/
      services/
      jobs/
      integrations/
    lib/
      env.ts
      errors.ts
      logger.ts
      formatters.ts
      dates.ts
    styles/
      globals.css
      tokens.css
  tests/
    integration/
    e2e/
  .env.example
  README.md
```

Treat this as a guide, not a reason to create empty modules. Add module
structure as implementation begins. Follow existing repository
conventions where they are sound.

### Backend conventions

-   Validate inputs on the server.
-   Use consistent errors for validation, permission failures, conflicts
    and unexpected failures.
-   Paginate large datasets.
-   Allowlist sort and filter fields.
-   Use transactions for multi-record business operations.
-   Add idempotency to payment operations and other retry-sensitive
    mutations.
-   Store secrets only server-side.
-   Use structured logs and avoid logging sensitive personal or
    financial data.
-   Keep external API contracts versioned when third parties depend on
    them.
-   Return only the data the UI needs.

### Date and money handling

-   Store instants in timezone-aware timestamps.
-   Store each branch's IANA timezone.
-   Use branch timezone for local business-day calculations.
-   Use date-only types for genuine date-only concepts such as a plan's
    calendar start date where appropriate.
-   Avoid floating-point arithmetic for money.
-   Support currency-specific decimal precision.
-   Make locale, currency, timezone and tax settings configurable.
-   Test daylight-saving transitions and local-day boundaries for
    relevant markets.

------------------------------------------------------------------------

## 8. Initial data model

Start with the following entities and add detail when each module is
implemented.

### Identity and tenancy

-   `User`
-   `Organization`
-   `OrganizationMembership`
-   `Branch`
-   `BranchAssignment`
-   `Role`
-   `Permission`
-   `Invitation`
-   `AuditLog`
-   `OrganizationSubscription`

### Core operations

-   `Member`
-   `MemberContact`
-   `MemberDocument`
-   `MemberNote`
-   `MembershipPlan`
-   `PlanBranch`
-   `Membership`
-   `MembershipChange`
-   `Invoice`
-   `InvoiceLine`
-   `Payment`
-   `PaymentAttempt`
-   `Refund`
-   `Expense`
-   `CheckIn`
-   `Lead`
-   `LeadActivity`
-   `FollowUp`
-   `Employee`
-   `StaffAssignment`
-   `Shift`
-   `LeaveRequest`
-   `TrainerProfile`
-   `ClassType`
-   `ClassSession`
-   `Booking`
-   `Room`
-   `TrainingSession`
-   `Equipment`
-   `MaintenanceSchedule`
-   `MaintenanceWorkOrder`
-   `EquipmentTransfer`
-   `Product`
-   `StockMovement`
-   `Supplier`
-   `PurchaseOrder`
-   `Sale`
-   `Notification`
-   `WebhookEndpoint`
-   `WebhookDelivery`

### Data integrity

-   Tenant-owned records must have enforceable organization
    relationships.
-   Branch-owned records must belong to the same organization as their
    parent relationships.
-   Use foreign keys, unique constraints, appropriate checks and
    indexes.
-   Preserve historical invoices, payments and audit events.
-   Prefer archival over destructive deletion for important business
    entities.
-   Keep organization subscriptions separate from gym member
    subscriptions.
-   Do not model all business events as a single generic transaction
    table.
-   Make important multi-record workflows transactional.

------------------------------------------------------------------------

## 9. Delivery roadmap

Implement in small, verified milestones.

### Milestone 1 --- Foundation and design system

-   Inspect repository and document existing conventions.
-   Establish Next.js, TypeScript, linting, formatting and environment
    validation.
-   Establish database connection and migration workflow.
-   Define color, typography, spacing and semantic tokens.
-   Build core primitives and responsive application shell.
-   Add initial tests and structured error handling.

**Exit criteria:** application runs, builds and has a reusable shell
with design tokens.

### Milestone 2 --- Authentication and multi-tenancy

-   Integrate authentication and account recovery.
-   Create organization and first branch onboarding.
-   Implement organization membership, roles and branch assignments.
-   Add server-side authorization utilities.
-   Seed multiple demo organizations and branches.
-   Test tenant isolation and branch scoping.

**Exit criteria:** users in separate organizations cannot access each
other's data, and branch restrictions are verified by tests.

### Milestone 3 --- Members and memberships

-   Member directory, profiles, search, filters and pagination.
-   Membership plans and branch eligibility.
-   Membership lifecycle and history.
-   Audit events and realistic demo data.

**Exit criteria:** member and membership workflows persist data and
enforce permissions.

### Milestone 4 --- Billing and attendance

-   Invoices, payments, balances and refunds.
-   Payment sandbox integration and webhook verification.
-   Front-desk member lookup and check-in.
-   Attendance history and basic reporting.
-   Idempotency and financial integrity tests.

**Exit criteria:** complete workflow from member registration through
membership, payment and check-in.

### Milestone 5 --- Dashboard, CRM and workforce

-   Shared server-side KPI definitions.
-   Dashboard cards, charts and branch filters.
-   Lead pipeline and follow-ups.
-   Staff, trainers, shifts and leave foundations.
-   Class and booking foundations.

**Exit criteria:** owner and staff experiences are role-aware and
operationally useful.

### Milestone 6 --- Facility operations

-   Equipment registry and asset history.
-   Maintenance schedules and work orders.
-   Suppliers, inventory, purchases and stock movements.
-   Expenses and branch transfers.

**Exit criteria:** assets and stock have traceable lifecycle histories.

### Milestone 7 --- Automation and advanced reports

-   Background jobs and notifications.
-   Renewal and maintenance reminders.
-   Consolidated branch reporting.
-   CSV imports and exports.
-   Audit viewer, integration delivery logs and SaaS entitlements.

**Exit criteria:** asynchronous workflows have retries, logs and clear
failure handling.

### Milestone 8 --- QA, deployment and portfolio readiness

-   End-to-end and security tests.
-   Accessibility and responsive QA.
-   Error monitoring and production configuration.
-   Database backups and recovery verification.
-   Demo accounts and internally consistent seeded data.
-   Product landing page, case study and walkthrough.

**Exit criteria:** a deployed, demonstrable product with documented
limitations and setup instructions.

The roadmap is a planning baseline, not a promise that every advanced
feature will fit into a fixed deadline. Re-estimate after the foundation
and core workflow are implemented.

------------------------------------------------------------------------

## 10. Testing requirements

### Unit tests

Test membership transitions, permission logic, money calculations, date
rules, invoice totals and shared reporting calculations.

### Integration tests

Test database constraints, tenant scoping, branch assignments,
transactions, payment processing and webhook idempotency.

### End-to-end tests

At minimum, automate:

1.  Create an account and organization.
2.  Create a branch.
3.  Invite a manager and assign branch access.
4.  Create a member.
5.  Assign a membership plan.
6.  Record a payment.
7.  Check the member in.
8.  Verify dashboard values and audit history.

### Security tests

-   Organization A cannot read or mutate Organization B's records.
-   A branch-restricted user cannot access an unassigned branch.
-   A receptionist cannot issue a refund without permission.
-   Revoked branch access is enforced on subsequent requests.
-   Duplicate payment webhooks do not duplicate financial effects.
-   Private documents cannot be downloaded across tenants.
-   Booking concurrency does not exceed capacity.
-   Check-in validates membership status on the server.

Never claim tests passed without executing them and inspecting the
results.

------------------------------------------------------------------------

## 11. Definition of done

A feature is done only when:

-   Its business rules are documented and implemented.
-   Inputs are validated on the server.
-   Tenant, branch and role authorization are enforced.
-   Data is persisted correctly.
-   Loading, empty, success, validation and error states are
    implemented.
-   Important actions produce appropriate audit events.
-   Relevant unit, integration or end-to-end tests pass.
-   Type checks, linting and relevant builds pass.
-   The UI follows FitGrid design tokens and responsive conventions.
-   Documentation and demo data are updated where needed.
-   Any incomplete integration or limitation is explicitly documented.

A visually complete page backed by hard-coded data is not a complete
feature unless it is explicitly identified as a temporary prototype.

------------------------------------------------------------------------

## 12. First vertical slice

The first end-to-end product demonstration should be:

``` text
Create FitGrid account
  -> Create organization
  -> Create first branch
  -> Invite branch manager
  -> Register member
  -> Assign membership plan
  -> Record payment
  -> Check member in
  -> Verify dashboard and audit history
```

This workflow is more valuable than creating many disconnected screens.
It validates the tenancy model, data relationships, permissions, core
domain rules and design system together.

------------------------------------------------------------------------

## 13. Documentation and repository hygiene

Maintain:

-   `README.md` --- setup, scripts, environment variables, migrations,
    seed data and test commands.
-   `docs/PRODUCT_SPEC.md` --- this product specification.
-   `docs/ARCHITECTURE.md` --- module boundaries, data flow and key
    decisions.
-   `docs/SECURITY.md` --- tenant model, permission rules and security
    assumptions.
-   `docs/DESIGN_SYSTEM.md` --- tokens, components and interaction
    conventions.
-   `docs/ROADMAP.md` --- milestone status, outstanding work and risks.
-   `docs/decisions/` --- short architecture decision records for
    consequential choices.

Keep `.env.example` up to date with placeholders. Never commit real
secrets, production data, credentials or provider tokens.

Use clear, focused commits. Do not rewrite unrelated files or perform
destructive database or Git operations without explicit approval.

------------------------------------------------------------------------

## 14. Working agreement for an AI coding agent

At the start of each work session:

1.  Read this specification and the repository README.
2.  Inspect Git status and the files relevant to the task.
3.  Identify the current milestone and its acceptance criteria.
4.  State a concise plan before making broad or risky changes.
5.  Implement the smallest coherent increment.
6.  Run relevant checks and inspect failures.
7.  Fix regressions introduced by the change.
8.  Update documentation and milestone status.
9.  Summarize files changed, behavior implemented, commands run, test
    outcomes, assumptions and remaining risks.

Do not:

-   Implement every module in one pass.
-   Bypass authorization to make a demo easier.
-   Trust client-supplied tenant IDs.
-   use mock data as if it were persisted production data.
-   claim integrations are live when they are simulated.
-   suppress TypeScript errors or tests merely to get a green build.
-   introduce microservices without a concrete need.
-   add dependencies without evaluating whether they are necessary.
-   make destructive changes without permission.

When blocked, explain the exact blocker and present the smallest
decision needed to continue. For reversible choices, choose a sensible
default and document it.

------------------------------------------------------------------------

## 15. Kickoff instruction

**Begin with Milestone 1 and the tenant foundations required for
Milestone 2. Do not attempt the whole roadmap in a single implementation
pass.**

First inspect the existing repository, identify its current state and
report:

1.  What already exists and can be reused.
2.  Any architectural conflicts with this specification.
3.  The smallest implementation plan for the next milestone.
4.  Required environment variables and external services, if any.
5.  Tests and acceptance criteria for that increment.

Then implement the approved increment, validate it, and summarize the
results. The first major gate is a working organization/branch model
with tested tenant isolation. Only after that gate passes should the
member and membership workflows be built.
