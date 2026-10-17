# Design system

Premium light UI: midnight navy for brand and navigation, emerald for primary actions,
white surfaces on a cool neutral canvas.

## Tokens

Raw values live in [`src/styles/tokens.css`](../src/styles/tokens.css). Tailwind utility
names are mapped in [`src/styles/globals.css`](../src/styles/globals.css) (`@theme inline`).
**Components use semantic utilities only**, never raw hex values.

### Colour

| Semantic utility                                     | Token                   | Value                                   | Use                                                          |
| ---------------------------------------------------- | ----------------------- | --------------------------------------- | ------------------------------------------------------------ |
| `bg-canvas`                                          | `--fg-canvas`           | `#F8FAFC`                               | App background                                               |
| `bg-surface`                                         | `--fg-surface`          | `#FFFFFF`                               | Cards, inputs, topbar                                        |
| `bg-muted`                                           | `--fg-muted`            | `#F1F5F9`                               | Subtle fills, table headers, hover                           |
| `border-border` / `border-border-strong`             |                         | `#E2E8F0` / `#CBD5E1`                   | Dividers / input borders                                     |
| `text-foreground`                                    | `--fg-text`             | `#0F172A`                               | Primary text                                                 |
| `text-muted-foreground`                              | `--fg-text-muted`       | `#64748B`                               | Secondary text                                               |
| `bg-brand` (+`-hover`, `-active`)                    | `--fg-navy-900/800/700` | `#172B4D` …                             | Sidebar, brand surfaces                                      |
| `text-sidebar-foreground` / `text-sidebar-muted`     |                         | `#E2E8F0` / `#A9B6CC`                   | Text on navy                                                 |
| `bg-primary` / `hover:bg-primary-hover`              | `--fg-emerald-700/800`  | `#047857` / `#065F46`                   | **Primary buttons, links, focus ring**                       |
| `bg-accent` / `text-accent`                          | `--fg-emerald-500`      | `#10B981`                               | Indicators and accents on navy only, never behind white text |
| `success`, `warning`, `danger`, `info` (+ `-subtle`) |                         | `#15803D` `#B45309` `#B91C1C` `#1D4ED8` | Status text on matching subtle backgrounds                   |

**Contrast decision:** the specification's emerald `#10B981` gives only about 2.5:1 with
white text, which fails WCAG AA. Primary actions therefore use emerald 700 (`#047857`,
about 5.5:1). `#10B981` remains the brand accent (active-nav indicator, logo, highlights
on navy). All relied-on pairs are asserted in `tests/unit/design-tokens.test.ts`; add a
row there when introducing a new combination.

### Typography, spacing, shape

- Inter via `next/font` (`--font-inter`) with system fallback.
- Tailwind's default 4 px spacing scale.
- Radius: `rounded-sm` 6 px (badges, menu items), `rounded-md` 10 px (controls, buttons),
  `rounded-lg` 14 px (cards).
- Shadows: `shadow-card`, `shadow-popover`.
- Layout: sidebar `w-sidebar` 248 px / `w-sidebar-collapsed` 72 px; topbar `h-topbar`
  64 px; content padding 16 / 24 / 32 px by breakpoint; card padding 20–24 px; controls
  40 px (`h-10`), large 44 px.

## Components

| Component                                       | Path                            | Notes                                                                                                                    |
| ----------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Button                                          | `ui/button.tsx`                 | `primary`, `secondary`, `ghost`, `danger`, `brand`, `link`; sizes `sm/md/lg/icon`; `asChild`                             |
| Input, Select                                   | `ui/input.tsx`, `ui/select.tsx` | Native select for long lists (time zones). `aria-invalid` styling                                                        |
| Label                                           | `ui/label.tsx`                  | Radix Label                                                                                                              |
| Card (+Header/Title/Description/Content/Footer) | `ui/card.tsx`                   | `section` element; title is `h2`                                                                                         |
| Badge                                           | `ui/badge.tsx`                  | tones: neutral, success, warning, danger, info, brand                                                                    |
| Alert                                           | `ui/alert.tsx`                  | `role="alert"` for danger, otherwise `status`                                                                            |
| DropdownMenu                                    | `ui/dropdown-menu.tsx`          | Radix; radio items for switchers                                                                                         |
| Sheet                                           | `ui/sheet.tsx`                  | Radix Dialog; mobile navigation drawer                                                                                   |
| Skeleton                                        | `ui/skeleton.tsx`               | Loading placeholders                                                                                                     |
| FormField                                       | `shared/form-field.tsx`         | Wires label, hint, error, `aria-describedby`, `aria-invalid`, "(optional)"                                               |
| SubmitButton                                    | `shared/submit-button.tsx`      | Pending state via `useFormStatus`                                                                                        |
| ActionMessage                                   | `shared/action-message.tsx`     | Renders a Server Action result                                                                                           |
| PageHeader, EmptyState, PermissionNotice        | `shared/`                       | Page title/actions; empty, error and permission-restricted states                                                        |
| App shell                                       | `layouts/`                      | Collapsible sidebar (persisted per browser), mobile drawer, organization switcher, branch selector, user menu, skip link |

## Interaction conventions

- Every screen handles **loading** (`loading.tsx` skeleton), **empty** (`EmptyState`),
  **error** (`error.tsx` with retry), **not found / no access** (`not-found.tsx`; same
  message for both), **permission-restricted** (`PermissionNotice`; read-only forms via
  `<fieldset disabled>`), **validation** (field errors + submitted values preserved) and
  **success** (`Alert tone="success"`).
- Navigation shows only implemented modules and hides links the role can't use. Hiding is
  a convenience; the server still enforces access.
- Destructive actions explain the consequence and ask for confirmation. Nothing is
  hard-deleted.
- Focus: visible 2 px emerald-700 outline (`:focus-visible`), emerald-500 on navy.
- Demo organizations always show a "Demo data" badge and banner.

## Additional components (milestones 3–8)

| Component                      | Path                   | Notes                                                                            |
| ------------------------------ | ---------------------- | -------------------------------------------------------------------------------- |
| Table primitives               | `ui/table.tsx`         | Table/THead/TBody/Th/Td with horizontal scroll                                   |
| ListToolbar, Pagination        | `shared/`              | GET-form search + allow-listed filters; URL-preserving paging                    |
| SimpleForm, ConfirmAction      | `shared/`              | Server Action forms with result/field errors; single-button actions with confirm |
| Money, StatCard, status badges | `business/`            | Locale/currency formatting; KPI cards; membership/invoice state badges           |
| Charts                         | `business/charts.tsx`  | Recharts bar/line/hour charts using token colors                                 |
| NotificationsBell              | `layouts/`             | Unread count, mark-read                                                          |
| Marketing blocks               | `shared/marketing.tsx` | Hero, FeatureGrid, Section, Prose                                                |

Accessibility is checked automatically: `tests/e2e/accessibility-platform.spec.ts` runs axe
(WCAG 2.0/2.1/2.2 A and AA) on public pages and core app screens.

## Not yet built

Command palette, combobox and date-range picker components (native inputs are used), drag-and-drop
lead board, dark mode.
