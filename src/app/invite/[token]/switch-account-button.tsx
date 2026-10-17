"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SwitchAccountButton({ next, email }: { next: string; email: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await authClient.signOut();
        router.replace(
          `/login?next=${encodeURIComponent(next)}&email=${encodeURIComponent(email)}`,
        );
        router.refresh();
      }}
    >
      Sign in with a different account
    </Button>
  );
}
