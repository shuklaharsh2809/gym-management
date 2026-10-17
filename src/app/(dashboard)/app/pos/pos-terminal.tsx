"use client";

import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { ActionMessage } from "@/components/shared/action-message";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { computeLine, formatMoney, sumLines } from "@/lib/money";
import type { ActionResult } from "@/server/actions";

interface PosProduct {
  id: string;
  name: string;
  sku: string;
  priceMinor: number;
  taxRateBps: number;
  taxInclusive: boolean;
  onHand: number;
}

type Action = (
  state: ActionResult<unknown> | null,
  formData: FormData,
) => Promise<ActionResult<unknown>>;

export function PosTerminal({
  action,
  products,
  branchId,
  currency,
  locale,
  idempotencyKey,
}: {
  action: Action;
  products: PosProduct[];
  branchId: string;
  currency: string;
  locale: string;
  idempotencyKey: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState("");
  const fmt = (v: number) => formatMoney(v, currency, locale);
  const lines = Object.entries(cart).map(([id, quantity]) => ({
    product: products.find((p) => p.id === id)!,
    quantity,
  }));
  // Preview only; the server prices the sale from the catalogue.
  const totals = sumLines(
    lines.map((l) =>
      computeLine({
        unitPriceMinor: l.product.priceMinor,
        quantity: l.quantity,
        taxRateBps: l.product.taxRateBps,
        taxInclusive: l.product.taxInclusive,
      }),
    ),
  );
  const add = (id: string, delta: number) =>
    setCart((c) => {
      const product = products.find((p) => p.id === id)!;
      const next = Math.min(Math.max((c[id] ?? 0) + delta, 0), product.onHand);
      const { [id]: _removed, ...rest } = c;
      return next > 0 ? { ...rest, [id]: next } : rest;
    });
  const visible = products.filter(
    (p) => !filter || `${p.name} ${p.sku}`.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>Products</CardTitle>
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search or scan barcode"
            aria-label="Search products"
          />
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {visible.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={p.onHand === 0 || (cart[p.id] ?? 0) >= p.onHand}
              onClick={() => add(p.id, 1)}
              className="rounded-md border border-border bg-surface p-3 text-left text-sm hover:border-primary disabled:opacity-50"
            >
              <span className="block font-medium">{p.name}</span>
              <span className="block text-xs text-muted-foreground">
                {fmt(p.priceMinor)} · {p.onHand} in stock
              </span>
            </button>
          ))}
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="size-4" aria-hidden /> Sale
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-3">
            <ActionMessage state={state} />
            <input type="hidden" name="branchId" value={branchId} />
            <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
            <input
              type="hidden"
              name="cart"
              value={JSON.stringify(
                lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
              )}
            />
            {lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tap products to add them.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {lines.map((l) => (
                  <li key={l.product.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="min-w-0 flex-1 truncate">{l.product.name}</span>
                    <span className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() => add(l.product.id, -1)}
                        aria-label="Remove one"
                      >
                        <Minus />
                      </Button>
                      <span className="w-6 text-center tabular-nums">{l.quantity}</span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() => add(l.product.id, 1)}
                        aria-label="Add one"
                      >
                        <Plus />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() => add(l.product.id, -l.quantity)}
                        aria-label="Remove line"
                      >
                        <Trash2 />
                      </Button>
                    </span>
                    <span className="w-24 text-right tabular-nums">
                      {fmt(
                        computeLine({
                          unitPriceMinor: l.product.priceMinor,
                          quantity: l.quantity,
                          taxRateBps: l.product.taxRateBps,
                          taxInclusive: l.product.taxInclusive,
                        }).totalMinor,
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <dl className="grid grid-cols-2 gap-y-1 border-t border-border pt-3 text-sm">
              <dt className="text-muted-foreground">Tax</dt>
              <dd className="text-right tabular-nums">{fmt(totals.taxMinor)}</dd>
              <dt className="font-semibold">Total</dt>
              <dd className="text-right font-semibold tabular-nums">{fmt(totals.totalMinor)}</dd>
            </dl>
            <div>
              <Label htmlFor="pos-member">Member number (optional)</Label>
              <Input id="pos-member" name="memberNumber" placeholder="M-00001" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="pos-method">Payment</Label>
                <Select id="pos-method" name="paymentMethod" defaultValue="CASH">
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                  <option value="UPI">UPI</option>
                  <option value="BANK_TRANSFER">Bank transfer</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="pos-ref">Reference</Label>
                <Input id="pos-ref" name="paymentReference" />
              </div>
            </div>
            <SubmitButton size="lg" disabled={lines.length === 0} pendingLabel="Completing sale…">
              Take payment {lines.length > 0 && fmt(totals.totalMinor)}
            </SubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
