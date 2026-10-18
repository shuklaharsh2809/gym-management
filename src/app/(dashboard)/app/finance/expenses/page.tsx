import { Receipt } from "@/components/icons";
import type { Metadata } from "next";
import { Money } from "@/components/business/money";
import { EmptyState } from "@/components/shared/empty-state";
import { ListToolbar } from "@/components/shared/list-toolbar";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { SimpleForm } from "@/components/shared/simple-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TBody, Td, Th, THead } from "@/components/ui/table";
import { compareDates, fromDbDate, isDateOnly, todayIn } from "@/lib/dates";
import { EXPENSE_LABELS } from "@/modules/inventory/schemas";
import { listExpenses, listSuppliers } from "@/modules/inventory/service";
import { getActiveBranchState } from "@/server/active-branch";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";
import { createExpenseAction, voidExpenseAction } from "../../inventory/actions";

export const metadata: Metadata = { title: "Expenses" };

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "expenses.read")) return <PermissionNotice what="expenses" />;
  const sp = await searchParams;
  const { activeBranch, branches } = await getActiveBranchState();
  const today = todayIn(activeBranch?.timezone ?? ctx.organization.timezone);
  const from = sp.from && isDateOnly(sp.from) ? sp.from : `${today.slice(0, 8)}01`;
  const to = sp.to && isDateOnly(sp.to) && compareDates(sp.to, from) >= 0 ? sp.to : today;
  const category = sp.category && sp.category in EXPENSE_LABELS ? sp.category : null;
  const [{ items, totalMinor }, suppliers] = await Promise.all([
    listExpenses(db, ctx, { from, to, branchId: activeBranch?.id, category }),
    listSuppliers(db, ctx).catch(() => []),
  ]);
  const { locale, currency } = ctx.organization;
  const canManage = hasPermission(ctx, "expenses.manage");
  return (
    <>
      <PageHeader
        title="Expenses"
        description={`Operating costs ${activeBranch ? `at ${activeBranch.name}` : "for your branches"}.`}
      />
      <ListToolbar
        filters={[
          {
            name: "category",
            label: "Category",
            value: category ?? "",
            options: [
              { value: "", label: "All" },
              ...Object.entries(EXPENSE_LABELS).map(([value, label]) => ({ value, label })),
            ],
          },
        ]}
        extra={
          <>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              From
              <Input type="date" name="from" defaultValue={from} className="text-foreground" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              To
              <Input type="date" name="to" defaultValue={to} className="text-foreground" />
            </label>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">
              Total ({from} to {to})
            </p>
            <p className="mt-1 text-2xl font-semibold">
              <Money minor={totalMinor} currency={currency} locale={locale} />
            </p>
          </Card>
          <Card className="overflow-hidden">
            {items.length === 0 ? (
              <EmptyState icon={Receipt} title="No expenses in this period" />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Description</Th>
                    <Th>Category</Th>
                    <Th className="text-right">Amount</Th>
                    {canManage && <Th />}
                  </tr>
                </THead>
                <TBody>
                  {items.map((e) => (
                    <tr
                      key={e.id}
                      className={e.voidedAt ? "text-muted-foreground line-through" : ""}
                    >
                      <Td className="whitespace-nowrap">{fromDbDate(e.incurredOn)}</Td>
                      <Td>
                        {e.description}
                        <p className="text-xs text-muted-foreground no-underline">
                          {[
                            e.branch.name,
                            e.supplier?.name,
                            e.voidReason && `void: ${e.voidReason}`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </Td>
                      <Td>
                        <Badge>{EXPENSE_LABELS[e.category]}</Badge>
                      </Td>
                      <Td className="text-right">
                        <Money minor={e.amountMinor} currency={e.currency} locale={locale} />
                      </Td>
                      {canManage && (
                        <Td>
                          {!e.voidedAt && (
                            <details>
                              <summary className="cursor-pointer text-xs text-primary">
                                Void
                              </summary>
                              <SimpleForm
                                action={voidExpenseAction.bind(null, e.id)}
                                submit="Void"
                                variant="danger"
                              >
                                <Input name="reason" placeholder="Reason" aria-label="Reason" />
                              </SimpleForm>
                            </details>
                          )}
                        </Td>
                      )}
                    </tr>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </div>
        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>Record expense</CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleForm action={createExpenseAction} submit="Record">
                <Label htmlFor="ex-branch">Branch</Label>
                <Select id="ex-branch" name="branchId" defaultValue={activeBranch?.id}>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
                <Label htmlFor="ex-cat">Category</Label>
                <Select id="ex-cat" name="category">
                  {Object.entries(EXPENSE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
                <Label htmlFor="ex-desc">Description</Label>
                <Input id="ex-desc" name="description" />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="ex-amount">Amount ({currency})</Label>
                    <Input id="ex-amount" name="amount" inputMode="decimal" />
                  </div>
                  <div>
                    <Label htmlFor="ex-date">Date</Label>
                    <Input id="ex-date" name="incurredOn" type="date" defaultValue={today} />
                  </div>
                </div>
                <Label htmlFor="ex-method">Paid by</Label>
                <Select id="ex-method" name="paymentMethod" defaultValue="BANK_TRANSFER">
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                  <option value="UPI">UPI</option>
                </Select>
                <Label htmlFor="ex-supplier">Supplier</Label>
                <Select id="ex-supplier" name="supplierId">
                  <option value="">None</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
                <Label htmlFor="ex-ref">Reference</Label>
                <Input id="ex-ref" name="reference" />
              </SimpleForm>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
