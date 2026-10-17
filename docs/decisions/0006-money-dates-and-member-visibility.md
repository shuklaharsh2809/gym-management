# ADR 0006: Money, dates and member visibility

- **Status:** Accepted
- **Date:** 2026-10-17

## Money

- All amounts are **integer minor units** (`Int` columns named `*_minor`) with an ISO 4217
  currency. Precision comes from `Intl` (INR 2, JPY 0, BHD 3). No floating point is used for
  arithmetic (`src/lib/money.ts`).
- Tax is computed per invoice line in basis points with half-away-from-zero rounding.
  Inclusive prices are split as `net = round(gross × 10000 / (10000 + bps))`, `tax = gross − net`,
  so `net + tax = total` always holds (also a CHECK constraint).
- The browser may preview totals, but the server always recomputes from catalogue/plan prices.
- `Int` (max ≈ 21 million in a 2-decimal currency) is sufficient for single invoices and plans; reports
  aggregate with `SUM` as `bigint`.

## Dates

- Calendar concepts (membership start/end, expense date, leave) are Postgres `date` values handled as
  `YYYY-MM-DD` strings (`src/lib/dates.ts`). Membership end dates are inclusive.
- Instants (payments, check-ins, classes) are `timestamptz`. "Today" and day ranges are computed in the
  **branch's** IANA time zone (organization time zone for all-branch views), using DST-safe day bounds
  (23 h and 25 h days are tested).
- Membership states that depend on time (scheduled, grace, expired, end of a freeze) are **derived** at
  read time, never stored, so they can't go stale. A daily job still normalizes ended freezes.

## Member visibility across branches (spec §3 rule 8)

- A member belongs to the organization and has a **home branch**.
- `organizations.member_visibility`:
  - `ORGANIZATION` (default): branch-restricted staff can see and serve all members (members commonly
    visit several branches).
  - `HOME_BRANCH`: branch-restricted staff see only members whose home branch is assigned to them.
- Organization-wide roles always see all members. Duplicate detection always runs organization-wide.
- **Where a membership can be used** is a separate, per-plan rule: all branches, or listed branches
  (`plan_branches`). Check-in eligibility enforces it.
