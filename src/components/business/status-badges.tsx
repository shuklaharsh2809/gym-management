import { Badge } from "@/components/ui/badge";
import type { EffectiveStatus } from "@/modules/memberships/lifecycle";

const MEMBERSHIP: Record<
  EffectiveStatus,
  { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }
> = {
  active: { label: "Active", tone: "success" },
  grace: { label: "Grace period", tone: "warning" },
  frozen: { label: "Frozen", tone: "info" },
  scheduled: { label: "Starts later", tone: "info" },
  expired: { label: "Expired", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export function MembershipStateBadge({ state }: { state: EffectiveStatus | null }) {
  if (!state) return <Badge>No membership</Badge>;
  const { label, tone } = MEMBERSHIP[state];
  return <Badge tone={tone}>{label}</Badge>;
}

export function InvoiceStatusBadge({
  status,
  refunded,
}: {
  status: "OPEN" | "PAID" | "VOID";
  refunded?: boolean;
}) {
  if (status === "VOID") return <Badge>Void</Badge>;
  if (status === "PAID")
    return (
      <Badge tone={refunded ? "warning" : "success"}>{refunded ? "Paid · refunded" : "Paid"}</Badge>
    );
  return <Badge tone="warning">Due</Badge>;
}
