"use client";

import { AlertTriangle } from "@/components/icons";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Card>
      <EmptyState
        titleAs="h1"
        icon={AlertTriangle}
        title="Something went wrong"
        description="We couldn't load this page. Your data is safe. Try again, and contact support if it keeps happening."
        action={<Button onClick={reset}>Try again</Button>}
      />
    </Card>
  );
}
