import { SearchX } from "@/components/icons";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function AppNotFound() {
  return (
    <Card>
      <EmptyState
        titleAs="h1"
        icon={SearchX}
        title="Not found"
        description="This record doesn't exist, or you don't have access to it."
        action={
          <Button asChild variant="secondary">
            <Link href="/app">Back to dashboard</Link>
          </Button>
        }
      />
    </Card>
  );
}
