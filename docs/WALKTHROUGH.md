# FitGrid walkthrough (demo script)

Everything below runs on fictional demo data (`npm run db:seed`). Password for all demo accounts:
`FitGrid-demo-2026`.

## 1. Owner view (5 minutes)

Sign in as **owner.northside@example.com** (Northside Fitness, three branches in India, INR).

1. **Dashboard**: active members, today's collections and visits, expiring memberships, outstanding
   balance, lead conversion, collections and visits charts, busiest hours, follow-ups due and recent
   activity. Switch branch in the top bar; every number re-scopes.
2. **Reports**: change the date range; compare branches; download CSVs (exports are audited).
3. **Notifications** (bell): daily reminders about renewals, maintenance, low stock and follow-ups.

## 2. Front desk (3 minutes)

Sign in as **frontdesk.bandra@example.com** (receptionist, Bandra only).

1. **Front desk**: search a member and check them in. Try a second tap (duplicate), and a member
   without a membership (denied, with the reason).
2. **Members → Add member** with a phone already used: the duplicate warning appears.
3. **Sell membership**: pick a plan, see the tax preview, take a partial UPI payment. The invoice opens;
   record the rest. Note there's no Refund button: receptionists can't refund.
4. **Point of sale**: sell two protein bars and water; stock drops and an itemized receipt is produced.

## 3. Isolation and roles (2 minutes)

1. Copy a Bandra member URL, sign in as **owner.harbour@example.com** (another organization) and open it:
   "Not found".
2. **alex.consultant@example.com** belongs to both organizations with different roles; use the
   organization switcher.
3. **manager.andheri@example.com** sees only Andheri West branches, invoices, equipment and classes.

## 4. Operations (3 minutes)

- **Classes**: weekly schedule, book a member into a class, see waitlists and pack credits.
- **Leads**: the pipeline board; open a lead, log a call, schedule a follow-up, convert to a member.
- **Equipment / Maintenance**: an out-of-service cable crossover with an open work order; complete it
  and record the repair cost as an expense.
- **Inventory**: stock ledger per product, purchase orders, low-stock badges.
- **Settings → Integrations**: add a webhook endpoint and send a test event; see the delivery log.

## 5. Online payment (sandbox)

On any open invoice choose **Create online checkout link**, open it, and press **Pay (simulated)**. The
sandbox posts a signed webhook to FitGrid; the invoice becomes paid. Replaying the webhook changes nothing.

## 6. Platform administration

Sign in as **platform.admin@example.com**. You land in the platform area: organizations, plans and limits,
subscriptions, usage, the platform audit log and contact requests. Organization users get a 404 here.

## Case study: what's notable technically

- **Tenant isolation in three layers**: database (composite foreign keys, same-organization triggers,
  CHECK constraints), request context (membership re-resolved per request), and services
  (`requirePermission` + organization filter on every query). Mutation-tested.
- **Concurrency-safe money and capacity**: row-locked invoice payments, idempotent sales and webhooks,
  advisory-locked check-ins, `FOR UPDATE` on class sessions, and a CHECK-constrained stock ledger.
- **One set of metric definitions** feeds the dashboard, reports and CSV exports.
- **Accessibility**: tokens validated for WCAG contrast; axe scans on public and core app pages in CI.
