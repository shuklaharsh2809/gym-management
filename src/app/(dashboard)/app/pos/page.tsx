import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionNotice } from "@/components/shared/permission-notice";
import { Alert } from "@/components/ui/alert";
import { listProducts } from "@/modules/inventory/service";
import { getActiveBranchState } from "@/server/active-branch";
import { requireOrganizationContext } from "@/server/auth/session";
import { hasPermission } from "@/server/authorization/guards";
import { db } from "@/server/database/client";
import { newIdempotencyKey } from "@/server/forms";
import { createSaleAction } from "../inventory/actions";
import { PosTerminal } from "./pos-terminal";

export const metadata: Metadata = { title: "Point of sale" };

export default async function PosPage() {
  const ctx = await requireOrganizationContext();
  if (!hasPermission(ctx, "pos.sell") || !hasPermission(ctx, "payments.collect"))
    return <PermissionNotice what="the point of sale" />;
  const { activeBranch } = await getActiveBranchState();
  if (!activeBranch) {
    return (
      <>
        <PageHeader title="Point of sale" />
        <Alert tone="info">
          Choose the branch you&apos;re selling at from the branch selector at the top.
        </Alert>
      </>
    );
  }
  const products = await listProducts(db, ctx, { branchId: activeBranch.id });
  return (
    <>
      <PageHeader
        title="Point of sale"
        description={`Selling at ${activeBranch.name}. Stock is deducted when the sale completes.`}
      />
      {products.length === 0 ? (
        <Alert tone="info">
          No products yet.{" "}
          <Link href="/app/inventory/new" className="underline">
            Add products
          </Link>{" "}
          and stock first.
        </Alert>
      ) : (
        <PosTerminal
          action={createSaleAction}
          branchId={activeBranch.id}
          currency={ctx.organization.currency}
          locale={ctx.organization.locale}
          idempotencyKey={newIdempotencyKey()}
          products={products.map((p) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            priceMinor: p.priceMinor,
            taxRateBps: p.taxRateBps,
            taxInclusive: p.taxInclusive,
            onHand: p.onHand,
          }))}
        />
      )}
    </>
  );
}
