import { Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "./empty-state";

/** Shown when the user is signed in but their role does not allow this screen. */
export function PermissionNotice({ what = "this page" }: { what?: string }) {
  return (
    <Card>
      <EmptyState
        titleAs="h1"
        icon={Lock}
        title="You don't have access"
        description={`Your role doesn't include permission to view ${what}. Ask an organization owner or administrator if you need access.`}
      />
    </Card>
  );
}
