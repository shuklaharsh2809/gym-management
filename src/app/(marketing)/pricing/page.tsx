import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Hero, Section } from "@/components/shared/marketing";
import { PHOTOS } from "@/lib/imagery";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { db } from "@/server/database/client";

export const metadata: Metadata = { title: "Pricing" };
export const dynamic = "force-dynamic";

const FEATURE_LABELS: Record<string, string> = {
  core: "Members, memberships, billing, front desk, reports",
  classes: "Classes, bookings and personal training",
  inventory: "Inventory, purchasing and point of sale",
  webhooks: "Webhooks and integrations",
  priority_support: "Priority support",
};

export default async function PricingPage() {
  const plans = await db.platformPlan.findMany({
    where: { active: true },
    orderBy: { priceMinorMonthly: "asc" },
  });
  return (
    <>
      <Hero
        photo={PHOTOS.dumbbells}
        eyebrow="Pricing"
        title="Simple plans that grow with you"
        body="Every plan starts with a 14-day free trial. Prices exclude taxes."
        cta={false}
      />
      <Section title="Plans">
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((p, i) => (
            <Card
              key={p.id}
              className={`flex flex-col p-6 ${i === 1 ? "border-primary ring-1 ring-primary" : ""}`}
            >
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                {formatMoney(p.priceMinorMonthly, p.currency, "en-IN")}
                <span className="text-sm font-normal text-muted-foreground"> / month</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {p.maxBranches
                  ? `Up to ${p.maxBranches} branch${p.maxBranches === 1 ? "" : "es"}`
                  : "Unlimited branches"}{" "}
                ·{" "}
                {p.maxMembers
                  ? `${p.maxMembers.toLocaleString("en-IN")} members`
                  : "unlimited members"}
              </p>
              <ul className="mt-4 flex flex-1 flex-col gap-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    {FEATURE_LABELS[f] ?? f}
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-6" variant={i === 1 ? "primary" : "secondary"}>
                <Link href="/register">Start free trial</Link>
              </Button>
            </Card>
          ))}
        </div>
      </Section>
    </>
  );
}
