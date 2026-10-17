import { Badge } from "@/components/ui/badge";

export function BranchStatusBadge({ status }: { status: "ACTIVE" | "INACTIVE" }) {
  return status === "ACTIVE" ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>;
}
